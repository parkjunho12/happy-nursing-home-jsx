import { OpenAI } from 'openai'
import { OpenAIStream, StreamingTextResponse } from 'ai'

import { checkAndMaskPII } from '@/lib/chat/pii-filter'
import { checkRateLimit, getClientIP } from '@/lib/chat/rate-limiter'
import { getDocumentChunks } from '@/lib/chat/mdLoader'
import { searchDocuments } from '@/lib/chat/retriever'
import { RAG_SYSTEM_PROMPT, formatSearchContext } from '@/lib/chat/ragPrompt'

type ChatRole = 'system' | 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string; id?: string; createdAt?: string | Date }

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// 운영 안정성: 과도한 히스토리/입력 폭발 방지
const MAX_MESSAGES = 20
const MAX_USER_CHARS = 1500
const MAX_TOKENS = 800

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  })
}

function isValidMessages(x: any): x is ChatMessage[] {
  return Array.isArray(x) && x.every(m => m && typeof m.role === 'string' && typeof m.content === 'string')
}

export async function POST(req: Request) {
  try {
    // 0) API Key 체크
    if (!process.env.OPENAI_API_KEY) {
      return json(
        { error: '챗봇 서비스가 일시적으로 사용 불가합니다. 전화나 상담 폼을 이용해주세요.' },
        { status: 503 }
      )
    }

    // 1) Rate limit
    const clientIP = getClientIP(req)
    const rate = checkRateLimit(clientIP)
    if (!rate.allowed) {
      return json(
        { error: rate.reason, resetAt: rate.resetAt },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil(((rate.resetAt || 0) - Date.now()) / 1000))),
            'X-Rate-Limit-Remaining': String(rate.remaining || 0),
          },
        }
      )
    }

    // 2) Body 파싱/검증
    const body = await req.json().catch(() => null)
    const messagesRaw = body?.messages

    if (!isValidMessages(messagesRaw)) {
      return json({ error: 'Invalid request format: messages[] required' }, { status: 400 })
    }

    // 3) 히스토리 컷 + 마지막 user 메시지 확보
    const messages = messagesRaw.slice(-MAX_MESSAGES)

    const last = messages[messages.length - 1]
    if (!last || last.role !== 'user') {
      return json({ error: 'Last message must be user' }, { status: 400 })
    }

    const userQuery = (last.content || '').slice(0, MAX_USER_CHARS).trim()
    if (!userQuery) {
      return json({ error: 'Empty user message' }, { status: 400 })
    }

    // 4) PII 마스킹 (원본 배열 변조 금지 → 새 배열로)
    const pii = checkAndMaskPII(userQuery)
    const sanitizedMessages: ChatMessage[] = messages.map((m, idx) => {
      // 마지막 유저 메시지만 마스킹 반영
      if (idx === messages.length - 1 && m.role === 'user') {
        return { ...m, content: pii.hasPII ? pii.maskedText : userQuery }
      }
      return { ...m }
    })

    // PII 경고 시스템 메시지 (선택: 모델에게만 주기)
    const piiSystemMsg: ChatMessage | null = pii.hasPII
      ? {
          role: 'system',
          content:
            `사용자가 민감 정보를 입력했습니다 (${pii.detectedTypes.join(', ')}). ` +
            `답변에서 민감정보를 반복/언급하지 말고, 안전한 채널(전화/상담폼)로 안내하세요.`,
        }
      : null

    // 5) RAG 검색
    const allChunks = getDocumentChunks()
    const searchResults = searchDocuments(pii.hasPII ? pii.maskedText : userQuery, allChunks, 4, 0.3)

    // 6) 검색 컨텍스트 생성 (0개면 “없음”을 명시해 모델이 추측하지 않게)
    const searchContext =
      searchResults.length > 0
        ? formatSearchContext(searchResults)
        : `SEARCH RESULTS:\n(없음)\n\n규칙: 검색 결과가 없으면 추측하지 말고 "확인이 필요합니다"로 안내하세요.`

    // 7) OpenAI 호출(스트리밍)
    const completion = await openai.chat.completions.create({
      model: MODEL,
      stream: true,
      temperature: 0.4, // RAG는 보통 낮게(근거 기반)
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: RAG_SYSTEM_PROMPT },
        { role: 'system', content: searchContext },
        ...(piiSystemMsg ? [piiSystemMsg] : []),
        ...sanitizedMessages.map(m => ({ role: m.role, content: m.content })),
      ],
    })

    const stream = OpenAIStream(completion, {
      onFinal: (finalText) => {
        // 운영 로그는 과도하게 남기지 말고, 필요한 정보만
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Chat RAG]', {
            ip: clientIP,
            q: userQuery.slice(0, 80),
            sources: searchResults.length,
            out: finalText.slice(0, 120),
          })
        }
      },
    })

    return new StreamingTextResponse(stream, {
      headers: {
        'X-Rate-Limit-Remaining': String(rate.remaining || 0),
        'X-Sources-Count': String(searchResults.length),
      },
    })
  } catch (err: any) {
    console.error('[Chat API Error]', err)
    return json(
      {
        error: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        details: process.env.NODE_ENV === 'development' ? String(err?.message || err) : undefined,
      },
      { status: 500 }
    )
  }
}
