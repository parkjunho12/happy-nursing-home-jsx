import type { Metadata } from 'next'
import Image from 'next/image'
import { API_BASE_URL } from '@/lib/api-client'

export const dynamic = 'force-dynamic'

type Notice = {
  id: string
  title: string
  content: string | null
  level: 'info' | 'important' | 'urgent'
  author_name: string | null
  created_at: string | null
}

const LEVEL: Record<string, { label: string; cls: string; emoji: string }> = {
  info: { label: '안내', cls: 'bg-gray-100 text-gray-600', emoji: '📢' },
  important: { label: '중요', cls: 'bg-amber-100 text-amber-700', emoji: '⚠️' },
  urgent: { label: '긴급', cls: 'bg-red-100 text-red-700', emoji: '🚨' },
}

async function fetchNotice(id: string): Promise<Notice | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/public/notices/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.data ?? null
  } catch {
    return null
  }
}

function fmtDate(s: string | null) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 본문 안 URL을 클릭 가능한 링크로 변환 (줄바꿈 유지)
function renderContent(text: string) {
  // 캡처 그룹으로 split → URL 조각과 일반 텍스트가 번갈아 나온다
  const parts = text.split(/(https?:\/\/[^\s<]+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const href = part.replace(/[.,)\]}]+$/, '') // 끝의 문장부호는 링크에서 제외
      const trail = part.slice(href.length)
      return (
        <span key={i}>
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-orange-600 underline underline-offset-2 break-all hover:text-orange-700">
            {href}
          </a>
          {trail}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const n = await fetchNotice(params.id)
  const title = n ? `${n.title} | 행복한요양원 공지` : '공지 | 행복한요양원'
  const desc = n?.content?.slice(0, 100) || '행복한요양원 공지사항입니다.'
  return {
    title,
    description: desc,
    robots: { index: false, follow: false }, // 검색엔진 색인 차단
    openGraph: {
      title,
      description: desc,
      images: ['/assets/logo/logo.png'],
      type: 'article',
    },
  }
}

export default async function PublicNoticePage({ params }: { params: { id: string } }) {
  const n = await fetchNotice(params.id)

  if (!n) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">🔒</div>
          <p className="font-bold text-gray-800 text-lg">공지를 열 수 없습니다</p>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            삭제되었거나 공개되지 않은 공지입니다.<br />링크가 정확한지 확인해 주세요.
          </p>
          <a href="https://www.xn--p80bu1t60gba47bg6abm347gsla.com"
            className="inline-block mt-6 px-5 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm">
            행복한요양원 홈으로
          </a>
        </div>
      </div>
    )
  }

  const lv = LEVEL[n.level] ?? LEVEL.info

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white border-b border-orange-100">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white ring-1 ring-orange-100 flex items-center justify-center">
            <Image src="/assets/logo/logo.png" alt="행복한요양원" width={36} height={36} className="w-full h-full object-contain p-0.5" />
          </div>
          <p className="font-bold text-gray-900 text-sm">행복한요양원 공지</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-7">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${lv.cls}`}>{lv.emoji} {lv.label}</span>
          <span className="text-xs text-gray-400">{fmtDate(n.created_at)}</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 leading-snug">{n.title}</h1>
        <p className="text-xs text-gray-400 mt-2">{n.author_name ?? '행복한요양원'}</p>

        {n.content && (
          <div className="mt-5 text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {renderContent(n.content)}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">행복한요양원 · 녹양역</p>
        </div>
      </main>
    </div>
  )
}
