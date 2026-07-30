import type { Metadata } from 'next'
import Link from 'next/link'
import { Youtube } from 'lucide-react'
import YouTubeButton from '@/components/video/modal/YouTubeButton'
import { SITE_INFO } from '@/lib/constants'

/**
 * 영상 페이지 — 유튜브 채널 RSS에서 최신 영상을 자동으로 불러온다(API 키 불필요).
 * 1시간 캐시(revalidate). RSS가 막히면 대표 영상 폴백으로 조용히 내려앉는다.
 */
export const metadata: Metadata = {
  title: '영상으로 보는 행복한요양원 | 행복한요양원 녹양역점',
  description:
    '행복한요양원 녹양역점의 어르신 일상, 프로그램 활동, 시설 곳곳을 영상으로 만나보세요. 유튜브 채널의 최신 영상을 모아 보여드립니다.',
  alternates: { canonical: '/videos' },
}

const CHANNEL_ID = 'UCr5NVnuu8ROSXjAuY1uVM-Q'
const RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`

interface Video { id: string; title: string; published: string | null }

/** RSS가 실패해도 페이지가 비지 않도록 — 대표 영상 폴백 */
const FALLBACK: Video[] = [
  { id: 'oIGB8jPFgWI', title: '행복한요양원 녹양역점 어르신들의 하루 일과', published: null },
]

const unescape = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")

async function fetchVideos(): Promise<Video[]> {
  try {
    const res = await fetch(RSS, { next: { revalidate: 3600 } })
    if (!res.ok) return FALLBACK
    const xml = await res.text()
    const out: Video[] = []
    for (const entry of xml.split('<entry>').slice(1)) {
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      const title = entry.match(/<title>([^<]*)<\/title>/)?.[1]
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null
      if (id && title) out.push({ id, title: unescape(title), published })
    }
    return out.length > 0 ? out : FALLBACK
  } catch {
    return FALLBACK
  }
}

const fmtDate = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default async function VideosPage() {
  const videos = await fetchVideos()
  const [latest, ...rest] = videos

  return (
    <main className="overflow-hidden">
      {/* 헤더 */}
      <section className="pt-28 pb-10 md:pt-36 md:pb-14 bg-gradient-to-b from-amber-50/70 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">Video</div>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
            영상으로 만나는 행복한요양원
          </h1>
          <p className="text-lg text-text-gray max-w-2xl mx-auto">
            사진 몇 장보다 진짜 하루가 궁금하시죠.
            어르신들의 일상과 프로그램, 시설 곳곳을 영상으로 담았습니다.
          </p>
        </div>
      </section>

      {/* 최신 영상 크게 */}
      {latest && (
        <section className="pb-12 md:pb-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-extrabold text-white bg-red-600 px-2 py-0.5 rounded-full">최신 영상</span>
              {fmtDate(latest.published) && <span className="text-xs text-gray-400">{fmtDate(latest.published)}</span>}
            </div>
            <YouTubeButton
              videoId={latest.id}
              title={latest.title}
              variant="thumbnail"
              showTitle={false}
              className="w-full rounded-2xl overflow-hidden shadow-large hover:shadow-xl transition-shadow duration-300"
            />
            <h2 className="mt-4 text-xl md:text-2xl font-bold text-gray-900">{latest.title}</h2>
          </div>
        </section>
      )}

      {/* 나머지 영상 그리드 */}
      {rest.length > 0 && (
        <section className="pb-14 md:pb-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {rest.map(v => (
                <div key={v.id} className="group flex flex-col rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
                  <YouTubeButton
                    videoId={v.id}
                    title={v.title}
                    variant="thumbnail"
                    showTitle={false}
                    className="w-full aspect-video"
                  />
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-[15px] font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-primary-orange transition-colors">
                      {v.title}
                    </h3>
                    {fmtDate(v.published) && (
                      <p className="text-xs text-gray-400 mt-auto pt-2">{fmtDate(v.published)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 채널 구독 CTA */}
      <section className="pb-16 md:pb-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-8 md:px-10 md:py-10 text-center shadow-lg shadow-red-200/50">
            <Youtube className="w-10 h-10 mx-auto mb-3" />
            <p className="text-xl md:text-2xl font-bold mb-2">새 영상이 올라오면 가장 먼저 만나보세요</p>
            <p className="text-white/85 text-sm mb-5">어르신들의 행복한 일상을 꾸준히 담아 올리고 있습니다.</p>
            <a href={SITE_INFO.social.youtube} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-6 py-3 rounded-2xl hover:bg-red-50 transition-colors">
              <Youtube className="w-5 h-5" /> 유튜브 채널 구독하기
            </a>
          </div>
          <p className="text-center mt-6 text-sm text-text-gray">
            시설이 더 궁금하시다면 <Link href="/contact" className="text-primary-orange font-bold hover:underline">방문 상담</Link>으로 직접 둘러보세요.
          </p>
        </div>
      </section>
    </main>
  )
}
