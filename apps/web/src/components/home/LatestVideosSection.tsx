'use client'

/**
 * 홈 최신 영상 캐러셀 — 가운데 1개 또렷 + 양옆 블러 미리보기, 3초 자동 회전.
 * 슬롯(왼/중앙/오른) 위치를 카드에 클래스로 입혀 transition-all로 실제 미끄러지는 움직임.
 * 호버·모달 중엔 자동 회전 정지. 데이터는 /api/videos (채널 RSS 1시간 캐시).
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Play, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import YouTubeModal from '@/components/video/modal/YouTubeModal'

interface Video { id: string; title: string; published: string | null }

const fmtDate = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 슬롯별 배치 — 카드 폭 55%, 양옆은 축소+블러+반투명
const SLOT: Record<string, string> = {
  center: 'translate-x-[-50%] translate-y-[-50%] scale-100 opacity-100 blur-0 z-20',
  right:  'translate-x-[15%] translate-y-[-50%] scale-[0.82] opacity-45 blur-[3px] z-10',
  left:   'translate-x-[-115%] translate-y-[-50%] scale-[0.82] opacity-45 blur-[3px] z-10',
  hidden: 'translate-x-[-50%] translate-y-[-50%] scale-75 opacity-0 z-0 pointer-events-none',
}

export default function LatestVideosSection() {
  const [videos, setVideos] = useState<Video[]>([])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState<Video | null>(null)
  const hoverRef = useRef(false)
  const playingRef = useRef(false)
  playingRef.current = !!playing

  useEffect(() => {
    fetch('/api/videos')
      .then(r => r.json())
      .then(j => setVideos((j?.videos ?? []).slice(0, 6)))   // 최신 6개만 돌린다
      .catch(() => setVideos([]))
  }, [])

  // 3초 자동 회전 — 호버·재생 중엔 쉼
  useEffect(() => {
    if (videos.length < 2) return
    const t = setInterval(() => {
      if (!hoverRef.current && !playingRef.current) setIdx(i => (i + 1) % videos.length)
    }, 3000)
    return () => clearInterval(t)
  }, [videos.length])

  if (videos.length === 0) return null
  const n = videos.length
  const cur = videos[idx]

  const slotOf = (i: number): keyof typeof SLOT => {
    const off = (i - idx + n) % n
    if (off === 0) return 'center'
    if (off === 1) return 'right'
    if (off === n - 1) return 'left'
    return 'hidden'
  }

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-white to-amber-50/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 md:mb-12">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            Latest Video
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
            최신 영상
          </h2>
          <p className="text-lg text-text-gray max-w-2xl mx-auto">
            어르신들의 일상을 영상으로 꾸준히 담아 올리고 있습니다.
          </p>
        </div>

        {/* 캐러셀 */}
        <div
          className="relative h-48 sm:h-64 md:h-[21rem] lg:h-[24rem] select-none"
          onMouseEnter={() => { hoverRef.current = true }}
          onMouseLeave={() => { hoverRef.current = false }}
        >
          {videos.map((v, i) => {
            const slot = slotOf(i)
            return (
              <button
                key={v.id}
                type="button"
                aria-label={slot === 'center' ? `${v.title} 재생` : '옆 영상으로 이동'}
                onClick={() => slot === 'center' ? setPlaying(v) : setIdx(i)}
                className={`absolute left-1/2 top-1/2 w-[78%] sm:w-[62%] md:w-[55%] aspect-video rounded-2xl overflow-hidden shadow-xl
                  transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${SLOT[slot]}`}
              >
                <img
                  src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`}
                  alt={v.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {slot === 'center' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/25 transition-colors">
                    <span className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-red-600 shadow-xl">
                      <Play className="ml-0.5 h-7 w-7 text-white" fill="white" />
                    </span>
                  </span>
                )}
              </button>
            )
          })}

          {/* 좌우 이동 */}
          <button onClick={() => setIdx(i => (i - 1 + n) % n)} aria-label="이전 영상"
            className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-500 hover:text-primary-orange">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setIdx(i => (i + 1) % n)} aria-label="다음 영상"
            className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-500 hover:text-primary-orange">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 가운데 영상 제목 + 점 */}
        <div className="text-center mt-6">
          <p className="text-base md:text-lg font-bold text-gray-900 line-clamp-1">{cur.title}</p>
          {fmtDate(cur.published) && <p className="text-xs text-gray-400 mt-1">{fmtDate(cur.published)}</p>}
          <div className="flex justify-center gap-1.5 mt-3">
            {videos.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`${i + 1}번 영상`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-primary-orange' : 'w-1.5 bg-gray-200 hover:bg-gray-300'}`} />
            ))}
          </div>
          <Link href="/videos"
            className="inline-flex items-center gap-1.5 mt-6 text-sm font-bold text-primary-orange hover:underline">
            영상 전체 보기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {playing && (
        <YouTubeModal videoId={playing.id} isOpen onClose={() => setPlaying(null)} title={playing.title} />
      )}
    </section>
  )
}
