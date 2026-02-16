import { streamText, convertToCoreMessages } from 'ai'
import { openai } from '@ai-sdk/openai'

import { checkAndMaskPII, formatWarnings } from '@/lib/chat/pii-filter'
import { checkRateLimit, getClientIP } from '@/lib/chat/rate-limiter'
import { getDocumentChunks } from '@/lib/chat/mdLoader'
import { searchDocuments } from '@/lib/chat/retriever'
import { RAG_SYSTEM_PROMPT, formatSearchContext } from '@/lib/chat/ragPrompt'

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export async function POST(req: Request) {
  try {
    // 1) Rate limit
    const clientIP = getClientIP(req)
    const rateLimit = checkRateLimit(clientIP)
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: rateLimit.reason, resetAt: rateLimit.resetAt }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(((rateLimit.resetAt || 0) - Date.now()) / 1000)),
          },
        }
      )
    }

    // 2) Parse
    const body = await req.json()
    const messages = body?.messages
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3) API Key
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: '챗봇 서비스가 일시적으로 사용 불가합니다. 전화나 상담 폼을 이용해주세요.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 4) Last user msg PII mask
    const last = messages[messages.length - 1]
    let piiSystemNote = ''
    if (last?.role === 'user' && typeof last?.content === 'string') {
      const piiCheck = checkAndMaskPII(last.content)
      if (piiCheck.hasPII) {
        last.content = piiCheck.maskedText
        const warningText = formatWarnings(piiCheck.warnings)
        piiSystemNote = warningText
          ? `사용자가 민감 정보를 입력했습니다(${piiCheck.detectedTypes.join(
              ', '
            )}). 답변에서 이를 언급하지 말고 상담 폼/전화로 안전하게 전달하도록 안내하세요.`
          : ''
      }
    }

    const userQuery = last?.content || ''

    // 5) RAG search
    const allChunks = getDocumentChunks()
    const searchResults = searchDocuments(userQuery, allChunks, 4, 0.3)
    const searchContext = formatSearchContext(searchResults)

    // 6) streamText (AI SDK v4)
    const result = await streamText({
      model: openai(MODEL),
      system: [
        RAG_SYSTEM_PROMPT,
        searchContext,
        piiSystemNote ? `\n\n[PII 경고]\n${piiSystemNote}\n` : '',
      ].join('\n\n'),
      messages: convertToCoreMessages(messages),
      temperature: 0.7,
      maxTokens: 800,
    })

    return result.toDataStreamResponse({
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
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
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
