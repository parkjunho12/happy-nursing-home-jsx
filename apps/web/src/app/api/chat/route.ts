import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'

import { checkAndMaskPII, formatWarnings } from '@/lib/chat/pii-filter'
import { checkRateLimit, getClientIP } from '@/lib/chat/rate-limiter'
import { getDocumentChunks } from '@/lib/chat/mdLoader'
import { searchDocuments } from '@/lib/chat/retriever'
import { RAG_SYSTEM_PROMPT, formatSearchContext } from '@/lib/chat/ragPrompt'

export const runtime = 'nodejs'

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

/**
 * UIMessage에서 마지막 user 텍스트를 안전하게 뽑기
 * - v6: parts 기반
 * - 하위호환: content(string) 기반
 */
function getLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m: any = messages[i]
    if (m?.role !== 'user') continue

    // v6 UI 메시지: parts 배열에서 text 추출
    const parts: any[] = m?.parts
    if (Array.isArray(parts)) {
      const textPart = parts.find((p) => p?.type === 'text' && typeof p.text === 'string')
      if (textPart?.text) return textPart.text
    }

    // 하위호환: content 기반
    const content: any = m?.content
    if (typeof content === 'string') return content
  }
  return ''
}

export async function POST(req: Request) {
  try {
    // 1) Rate limit
    const clientIP = getClientIP(req)
    const rateLimit = checkRateLimit(clientIP)
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: rateLimit.reason, resetAt: rateLimit.resetAt }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(((rateLimit.resetAt || 0) - Date.now()) / 1000)),
        },
      })
    }

    // 2) Parse
    const body = await req.json().catch(() => null)
    const messages = body?.messages as UIMessage[] | undefined

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request format: messages[] required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3) API Key
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: '챗봇 서비스가 일시적으로 사용 불가합니다. 전화나 상담 폼을 이용해주세요.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 4) 마지막 user 텍스트 + PII 체크 (messages는 mutate하지 않고 system note로만)
    const userQueryRaw = getLastUserText(messages)
    const piiCheck = checkAndMaskPII(userQueryRaw)
    const userQuery = piiCheck.hasPII ? piiCheck.maskedText : userQueryRaw

    const piiSystemNote = piiCheck.hasPII
      ? [
          `사용자가 민감 정보를 입력했습니다(${piiCheck.detectedTypes.join(', ')}).`,
          `답변에서 해당 정보를 직접 언급하지 말고, 상담 폼/전화로 안전하게 전달하도록 안내하세요.`,
          formatWarnings(piiCheck.warnings) || '',
        ]
          .filter(Boolean)
          .join(' ')
      : ''

    // 5) RAG search
    const allChunks = getDocumentChunks()
    const searchResults = searchDocuments(userQuery, allChunks, 4, 0.3)
    const searchContext = formatSearchContext(searchResults)

    // 6) streamText
    const modelMessages = await convertToModelMessages(messages as any)

    const result = await streamText({
    model: openai(MODEL),
    system: [RAG_SYSTEM_PROMPT, searchContext, piiSystemNote].filter(Boolean).join('\n\n'),
    messages: modelMessages,
    temperature: 0.7,
    maxOutputTokens: 800,
    })


    // ✅ useChat(@ai-sdk/react) v6 호환 응답
    return result.toUIMessageStreamResponse({
      headers: {
        'X-Rate-Limit-Remaining': String(rateLimit.remaining || 0),
        'X-Sources-Count': String(searchResults.length),
      },
    })
  } catch (error: any) {
    console.error('[Chat API Error]:', error)
    return new Response(
      JSON.stringify({
        error: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
