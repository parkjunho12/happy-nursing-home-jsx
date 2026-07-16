import type { Metadata } from 'next'
import Image from 'next/image'
import { API_BASE_URL } from '@/lib/api-client'
import { SITE_INFO } from '@/lib/constants'

export const dynamic = 'force-dynamic'

type Notice = {
  id: string
  title: string
  content: string | null
  level: 'info' | 'important' | 'urgent'
  image_url: string | null
  author_name: string | null
  created_at: string | null
}

type Theme = { label: string; emoji: string; badge: string; bar: string; ring: string }
const THEME: Record<string, Theme> = {
  urgent:    { label: '긴급 공지', emoji: '🚨', badge: 'bg-red-500 text-white',    bar: 'from-red-500 to-rose-500',      ring: 'ring-red-100' },
  important: { label: '중요 공지', emoji: '📢', badge: 'bg-amber-500 text-white',  bar: 'from-amber-400 to-orange-400',  ring: 'ring-amber-100' },
  info:      { label: '공지',      emoji: '💬', badge: 'bg-orange-500 text-white', bar: 'from-orange-400 to-amber-400',  ring: 'ring-orange-100' },
}

async function fetchNotice(id: string): Promise<Notice | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/public/notices/${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json?.data ?? null
  } catch {
    return null
  }
}

const imgAbs = (u: string | null) => (!u ? null : u.startsWith('http') ? u : `${API_BASE_URL}${u}`)

function fmtDate(s: string | null) {
  if (!s) return ''
  const d = new Date(s)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

// 본문 안 URL·전화번호를 눌러서 이동/통화 가능하게 변환 (줄바꿈 유지)
const PHONE_RE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/
function renderContent(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<]+|0\d{1,2}-?\d{3,4}-?\d{4})/g)
  return parts.map((part, i) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const href = part.replace(/[.,)\]}]+$/, '')
      const trail = part.slice(href.length)
      return (
        <span key={i}>
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-orange-600 font-medium underline underline-offset-2 break-all hover:text-orange-700">{href}</a>{trail}
        </span>
      )
    }
    if (PHONE_RE.test(part)) {
      return (
        <a key={i} href={`tel:${part.replace(/-/g, '')}`}
          className="text-orange-600 font-medium underline underline-offset-2 whitespace-nowrap hover:text-orange-700">{part}</a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const n = await fetchNotice(params.id)
  const t = n ? THEME[n.level] ?? THEME.info : THEME.info
  const title = n ? `${t.emoji} ${n.title}` : '공지 | 행복한요양원'
  const desc = (n?.content || '').replace(/\s+/g, ' ').trim().slice(0, 100) || '행복한요양원 공지사항입니다.'
  return {
    title,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: { title, description: desc, images: [imgAbs(n?.image_url ?? null) || '/assets/logo/logo.png'], type: 'article' },
  }
}

export default async function PublicNoticePage({ params }: { params: { id: string } }) {
  const n = await fetchNotice(params.id)

  if (!n) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">🔒</div>
          <p className="font-bold text-gray-800 text-lg">공지를 열 수 없습니다</p>
          <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">삭제되었거나 공개되지 않은 공지입니다.<br />링크가 정확한지 확인해 주세요.</p>
          <a href="https://www.xn--p80bu1t60gba47bg6abm347gsla.com"
            className="inline-block mt-6 px-6 py-3.5 bg-orange-500 text-white rounded-2xl font-bold text-[15px] active:scale-95 transition-transform">
            행복한요양원 홈으로
          </a>
        </div>
      </div>
    )
  }

  const t = THEME[n.level] ?? THEME.info

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/30 to-white">
      {/* 상단 바 */}
      <header className="bg-white/80 backdrop-blur border-b border-orange-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white ring-1 ring-orange-100 flex items-center justify-center">
            <Image src="/assets/logo/logo.png" alt="행복한요양원" width={32} height={32} className="w-full h-full object-contain p-0.5" />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-gray-900 text-[13px]">{SITE_INFO.name}</p>
            <p className="text-[10px] text-gray-400">공지사항</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* 공지 카드 */}
        <article className={`bg-white rounded-3xl shadow-sm ring-1 ${t.ring} overflow-hidden`}>
          {/* 레벨 컬러 스트립 */}
          <div className={`h-1.5 bg-gradient-to-r ${t.bar}`} />

          <div className="px-6 pt-6 pb-7">
            <div className="flex items-center gap-2 mb-4">
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${t.badge}`}>
                {t.emoji} {t.label}
              </span>
              <span className="text-xs text-gray-400">{fmtDate(n.created_at)}</span>
            </div>

            <h1 className="text-[22px] font-extrabold text-gray-900 leading-snug tracking-tight">{n.title}</h1>

            <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-[10px] font-bold">
                {(n.author_name ?? '요')[0]}
              </span>
              {n.author_name ?? '행복한요양원'}
            </div>

            {imgAbs(n.image_url) && (
              <img src={imgAbs(n.image_url)!} alt="공지 이미지" className="w-full rounded-xl border border-gray-100 mt-4" />
            )}

            {n.content && (
              <>
                <div className="my-5 border-t border-dashed border-gray-200" />
                <div className="text-[16px] text-gray-700 leading-[1.85] whitespace-pre-wrap break-words">
                  {renderContent(n.content)}
                </div>
              </>
            )}
          </div>
        </article>

        {/* 하단 신뢰/문의 CTA */}
        <div className="mt-5 bg-white rounded-2xl ring-1 ring-orange-100 px-5 py-4">
          <p className="text-[13px] font-bold text-gray-800">문의는 언제든지 편히 연락 주세요</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{SITE_INFO.name}</p>
          <div className="flex gap-2 mt-3">
            <a href={`tel:${SITE_INFO.phone.replace(/-/g, '')}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-orange-500 text-white rounded-xl py-3 font-bold text-[15px] active:scale-95 transition-transform">
              📞 {SITE_INFO.phone}
            </a>
            <a href="https://www.xn--p80bu1t60gba47bg6abm347gsla.com"
              className="inline-flex items-center justify-center px-4 bg-orange-50 text-orange-600 rounded-xl py-3 font-bold text-[14px] active:scale-95 transition-transform">
              홈
            </a>
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-300 mt-6">
          이 링크는 공개 공지 전용이며 검색에 노출되지 않습니다.
        </p>
      </main>
    </div>
  )
}
