'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { resolveApiBase } from '@/lib/api-client'

type Media = {
  id: string; media_type: string; file_url: string
  thumbnail_url?: string | null; file_name: string; created_at: string
}
type Album = {
  id: string; title: string; description: string
  resident_name: string; created_at: string; media: Media[]
}

async function fetchAlbum(id: string, token: string): Promise<Album> {
  const res = await fetch(`${resolveApiBase()}/api/v1/family/albums/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 401 || res.status === 403) throw new Error('auth')
  const json = await res.json()
  return json.data
}

function mediaUrl(url: string) {
  return url.startsWith('http') ? url : `${resolveApiBase()}${url}`
}

function downloadUrl(mediaId: string): string {
  const token = localStorage.getItem('family_token') ?? ''
  return `${resolveApiBase()}/api/v1/family/download/${mediaId}?token=${encodeURIComponent(token)}`
}

function downloadAllZip(albumId: string) {
  const token = localStorage.getItem('family_token') ?? ''
  const url = `${resolveApiBase()}/api/v1/family/albums/${albumId}/download-zip?token=${encodeURIComponent(token)}`
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function triggerDownload(mediaId: string, fileName: string) {
  const a = document.createElement('a')
  a.href = downloadUrl(mediaId)
  a.download = fileName || 'download'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function formatDate(s: string) {
  const d = new Date(s)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}
function formatDay(s: string) {
  const d = new Date(s)
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`
}

export default function FamilyAlbumDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState<number | null>(null)

  const load = useCallback(async () => {
    const token = localStorage.getItem('family_token')
    if (!token) { router.replace('/family'); return }
    setLoading(true)
    try {
      setAlbum(await fetchAlbum(id, token))
    } catch (e: any) {
      if (e.message === 'auth') { localStorage.clear(); router.replace('/family') }
      else router.replace('/family/albums')
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (idx === null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [idx])

  if (loading) return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">사진을 불러오는 중...</p>
      </div>
    </div>
  )

  if (!album) return null

  const photos = album.media.filter(m => m.media_type === 'photo')
  const videos = album.media.filter(m => m.media_type === 'video')

  const dayMap: Record<string, { m: Media; i: number }[]> = {}
  album.media.forEach((m, i) => {
    const day = (m.created_at || '').slice(0, 10) || '기타'
    ;(dayMap[day] ||= []).push({ m, i })
  })
  const days = Object.keys(dayMap).sort((a, b) => b.localeCompare(a))

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white/95 backdrop-blur border-b border-orange-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-orange-100 transition-colors text-gray-600 hover:text-orange-600 font-bold text-lg active:scale-95">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{album.title}</p>
            <p className="text-xs text-gray-400">{album.resident_name} · {formatDate(album.created_at)}</p>
          </div>
          {album.media.length > 0 && (
            <button onClick={() => downloadAllZip(album.id)}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl hover:bg-orange-100 active:scale-95 transition-all flex-shrink-0">
              ⬇ 전체 저장
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 pb-24 space-y-5">
        {album.description && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl px-5 py-4">
            <p className="text-sm text-orange-800 leading-relaxed">{album.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-2xl px-4 py-3.5 text-center">
            <p className="text-2xl font-bold text-blue-600">{photos.length}</p>
            <p className="text-xs text-blue-400 mt-0.5 font-medium">사진</p>
          </div>
          <div className="bg-purple-50 rounded-2xl px-4 py-3.5 text-center">
            <p className="text-2xl font-bold text-purple-600">{videos.length}</p>
            <p className="text-xs text-purple-400 mt-0.5 font-medium">동영상</p>
          </div>
        </div>

        {album.media.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📷</p>
            <p className="text-sm">아직 사진이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-6">
            {days.map(day => (
              <section key={day}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-sm font-bold text-gray-700">{day === '기타' ? '날짜 미상' : formatDay(day)}</span>
                  <span className="text-xs text-gray-300">{dayMap[day].length}장</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {dayMap[day].map(({ m, i }) => (
                    <div key={m.id} className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                      <button onClick={() => setIdx(i)} className="absolute inset-0 w-full h-full active:scale-[0.97] transition-transform" aria-label="크게 보기">
                        {m.media_type === 'photo' ? (
                          <Image src={mediaUrl(m.thumbnail_url || m.file_url)} alt="" fill className="object-cover" loading="lazy" unoptimized />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                            <span className="text-2xl text-white">▶</span>
                            <span className="text-[10px] text-white/60 mt-1">동영상</span>
                          </div>
                        )}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); triggerDownload(m.id, m.file_name || `photo_${i + 1}`) }}
                        className="absolute bottom-1.5 right-1.5 w-8 h-8 bg-black/45 hover:bg-black/70 active:bg-black/85 text-white rounded-lg flex items-center justify-center text-sm shadow-sm transition-colors"
                        title="저장" aria-label="사진 저장">
                        ⬇
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-gray-400">🌸 요양원에서 정성껏 기록한 소중한 순간들입니다</p>
        </div>
      </main>

      {idx !== null && (
        <Lightbox items={album.media} index={idx} onIndex={setIdx} onClose={() => setIdx(null)} />
      )}
    </div>
  )
}

function Lightbox({ items, index, onIndex, onClose }: {
  items: Media[]; index: number; onIndex: (i: number) => void; onClose: () => void
}) {
  const m = items[index]
  const isPhoto = m.media_type === 'photo'
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [loaded, setLoaded] = useState(false)
  const t = useRef<any>({})

  useEffect(() => { setScale(1); setPos({ x: 0, y: 0 }); setLoaded(!isPhoto) }, [index, isPhoto])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      else if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [index, items.length, onIndex, onClose])

  const dist = (ts: React.TouchList) => {
    const dx = ts[0].clientX - ts[1].clientX, dy = ts[0].clientY - ts[1].clientY
    return Math.hypot(dx, dy)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isPhoto) return
    const ts = e.touches
    if (ts.length === 2) {
      t.current = { mode: 'pinch', dist: dist(ts), startScale: scale }
    } else {
      const now = Date.now()
      const dbl = now - (t.current.lastTap || 0) < 300
      t.current = { mode: scale > 1 ? 'pan' : 'swipe', x: ts[0].clientX, y: ts[0].clientY, startPos: pos, lastTap: now, dbl }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isPhoto) return
    const ts = e.touches
    if (t.current.mode === 'pinch' && ts.length === 2) {
      const s = Math.max(1, Math.min(4, t.current.startScale * (dist(ts) / t.current.dist)))
      setScale(s)
    } else if (t.current.mode === 'pan' && ts.length === 1) {
      setPos({ x: t.current.startPos.x + (ts[0].clientX - t.current.x), y: t.current.startPos.y + (ts[0].clientY - t.current.y) })
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isPhoto) return
    const c = t.current
    if (c.mode === 'pinch') { if (scale <= 1.08) { setScale(1); setPos({ x: 0, y: 0 }) } return }
    if (c.dbl) {
      if (scale > 1) { setScale(1); setPos({ x: 0, y: 0 }) }
      else setScale(2.5)
      return
    }
    if (c.mode === 'swipe' && scale === 1) {
      const ct = e.changedTouches[0]
      const dx = ct.clientX - c.x, dy = ct.clientY - c.y
      const adx = Math.abs(dx), ady = Math.abs(dy)
      if (adx > 45 && adx > ady) {
        if (dx < 0 && index < items.length - 1) onIndex(index + 1)
        else if (dx > 0 && index > 0) onIndex(index - 1)
      } else if (dy > 90 && ady > adx) {
        onClose()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-4 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="text-white/85 hover:text-white text-2xl w-11 h-11 flex items-center justify-center active:scale-90">✕</button>
        <span className="text-white/70 text-sm font-medium">{index + 1} / {items.length}</span>
        <button onClick={e => { e.stopPropagation(); triggerDownload(m.id, m.file_name || `photo_${index + 1}`) }}
          className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-90" title="다운로드">⬇</button>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        style={{ touchAction: isPhoto ? 'none' : 'auto' }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {isPhoto ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-9 h-9 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(m.file_url)} alt=""
              onLoad={() => setLoaded(true)}
              draggable={false}
              className={`max-w-full max-h-full object-contain ${loaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: t.current.mode ? 'none' : 'transform 0.15s ease-out' }}
            />
          </>
        ) : (
          <video src={mediaUrl(m.file_url)} controls autoPlay playsInline className="max-w-full max-h-full" />
        )}

        {index > 0 && scale === 1 && (
          <button onClick={e => { e.stopPropagation(); onIndex(index - 1) }}
            className="hidden sm:flex absolute left-3 w-11 h-11 bg-black/50 hover:bg-black/70 rounded-full items-center justify-center text-white text-2xl">‹</button>
        )}
        {index < items.length - 1 && scale === 1 && (
          <button onClick={e => { e.stopPropagation(); onIndex(index + 1) }}
            className="hidden sm:flex absolute right-3 w-11 h-11 bg-black/50 hover:bg-black/70 rounded-full items-center justify-center text-white text-2xl">›</button>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 pt-6 pb-4 px-4 bg-gradient-to-t from-black/85 to-transparent" onClick={e => e.stopPropagation()}>
        {scale === 1 && (
          <p className="sm:hidden text-center text-[11px] text-white/40 mb-2">← 좌우로 넘기기 · 두 번 탭하면 확대 · 아래로 쓸면 닫기</p>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-lg mx-auto">
          {items.map((it, i) => (
            <button key={it.id} onClick={() => onIndex(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === index ? 'border-orange-400 scale-110' : 'border-white/20 opacity-50'}`}>
              {it.media_type === 'photo' ? (
                <Image src={mediaUrl(it.thumbnail_url || it.file_url)} alt="" width={56} height={56} className="object-cover w-full h-full" loading="lazy" unoptimized />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white">▶</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
