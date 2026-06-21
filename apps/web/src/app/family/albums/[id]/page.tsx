'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { API_BASE_URL } from '@/lib/api-client'

type Media = {
  id: string; media_type: string; file_url: string
  thumbnail_url?: string | null; file_name: string; created_at: string
}
type Album = {
  id: string; title: string; description: string
  resident_name: string; created_at: string; media: Media[]
}

async function fetchAlbum(id: string, token: string): Promise<Album> {
  const res = await fetch(`${API_BASE_URL}/api/v1/family/albums/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 401 || res.status === 403) throw new Error('auth')
  const json = await res.json()
  return json.data
}

function mediaUrl(url: string) {
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

/**
 * 다운로드 URL 생성
 * - 백엔드 /api/v1/family/download/:id?token=JWT
 * - <a href download> 방식 → CORS 완전 우회, 강제 저장
 */
function downloadUrl(mediaId: string): string {
  const token = localStorage.getItem('family_token') ?? ''
  return `${API_BASE_URL}/api/v1/family/download/${mediaId}?token=${encodeURIComponent(token)}`
}

function triggerDownload(mediaId: string, fileName: string) {
  const a = document.createElement('a')
  a.href = downloadUrl(mediaId)
  a.download = fileName || 'download'
  a.target = '_blank'          // 혹시 브라우저가 새 탭으로 열어도 OK
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function formatDate(s: string) {
  const d = new Date(s)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function FamilyAlbumDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [album,   setAlbum]   = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewer,  setViewer]  = useState<{ media: Media; idx: number } | null>(null)

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
    if (!viewer || !album) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && viewer.idx > 0)
        setViewer({ media: album.media[viewer.idx - 1], idx: viewer.idx - 1 })
      else if (e.key === 'ArrowRight' && viewer.idx < album.media.length - 1)
        setViewer({ media: album.media[viewer.idx + 1], idx: viewer.idx + 1 })
      else if (e.key === 'Escape') setViewer(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [viewer, album])

  if (loading) return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin"/>
        <p className="text-sm text-gray-400">사진을 불러오는 중...</p>
      </div>
    </div>
  )

  if (!album) return null

  const photos = album.media.filter(m => m.media_type === 'photo')
  const videos = album.media.filter(m => m.media_type === 'video')

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-orange-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-orange-100 transition-colors text-gray-600 hover:text-orange-600 font-bold text-lg">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{album.title}</p>
            <p className="text-xs text-gray-400">{album.resident_name} · {formatDate(album.created_at)}</p>
          </div>
          {/* 전체 다운로드 */}
          {album.media.length > 0 && (
            <button
              onClick={() => album.media.forEach((m, i) => {
                setTimeout(() => triggerDownload(m.id, m.file_name || `photo_${i+1}`), i * 400)
              })}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl hover:bg-orange-100 transition-colors flex-shrink-0"
            >
              ⬇ 전체 저장
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 pb-20 space-y-5">
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
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">전체 {album.media.length}개</p>
            <div className="grid grid-cols-2 gap-2">
              {album.media.map((m, idx) => (
                <div key={m.id} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                  <button onClick={() => setViewer({ media: m, idx })} className="absolute inset-0 w-full h-full">
                    {m.media_type === 'photo' ? (
                      <Image
                    src={mediaUrl(m.thumbnail_url || m.file_url)}
                    alt=""
                    fill
                    className="object-cover"
                    loading="lazy"
                    unoptimized
                  />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                        <span className="text-2xl text-white">▶</span>
                        <span className="text-[10px] text-white/60 mt-1">동영상</span>
                      </div>
                    )}
                  </button>
                  {/* 다운로드 버튼 */}
                  <button
                    onClick={e => { e.stopPropagation(); triggerDownload(m.id, m.file_name || `photo_${idx + 1}`) }}
                    className="absolute top-2 right-2 w-9 h-9 bg-black/55 hover:bg-black/75 active:bg-black/85 text-white rounded-xl flex items-center justify-center text-base shadow-sm transition-colors"
                    title="저장"
                    aria-label="사진 저장"
                  >
                    ⬇
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-gray-400">🌸 요양원에서 정성껏 기록한 소중한 순간들입니다</p>
        </div>
      </main>

      {viewer && album && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={() => setViewer(null)}>
          <div className="flex items-center justify-between px-5 py-4 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
            <button onClick={() => setViewer(null)} className="text-white/80 hover:text-white text-2xl w-10 h-10 flex items-center justify-center">✕</button>
            <span className="text-white/60 text-sm">{viewer.idx + 1} / {album.media.length}</span>
            <button
              onClick={e => { e.stopPropagation(); triggerDownload(viewer.media.id, viewer.media.file_name || `photo_${viewer.idx + 1}`) }}
              className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="다운로드"
            >
              ⬇
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative" onClick={e => e.stopPropagation()}>
            {viewer.media.media_type === 'photo' ? (
              <div className="relative w-full h-full">
                <Image src={mediaUrl(viewer.media.file_url)} alt="" fill className="object-contain" unoptimized/>
              </div>
            ) : (
              <video src={mediaUrl(viewer.media.file_url)} controls autoPlay className="max-w-full max-h-full"/>
            )}
            {viewer.idx > 0 && (
              <button onClick={e => { e.stopPropagation(); setViewer({ media: album.media[viewer.idx-1], idx: viewer.idx-1 }) }}
                className="absolute left-3 w-11 h-11 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white text-2xl">‹</button>
            )}
            {viewer.idx < album.media.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setViewer({ media: album.media[viewer.idx+1], idx: viewer.idx+1 }) }}
                className="absolute right-3 w-11 h-11 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white text-2xl">›</button>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 py-4 px-4 bg-gradient-to-t from-black/80 to-transparent" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-lg mx-auto">
              {album.media.map((m, idx) => (
                <button key={m.id} onClick={() => setViewer({ media: m, idx })}
                  className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === viewer.idx ? 'border-orange-400 scale-110' : 'border-white/20 opacity-50'
                  }`}>
                  {m.media_type === 'photo' ? (
                    <Image src={mediaUrl(m.thumbnail_url || m.file_url)} alt="" width={56} height={56} className="object-cover w-full h-full" loading="lazy" unoptimized/>
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white">▶</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
