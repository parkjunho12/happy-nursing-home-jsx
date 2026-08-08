import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, X, Play, Image as ImageIcon } from 'lucide-react'
import { familyAPI } from '@/api/albumClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8010'
const mediaUrl = (url: string) => url?.startsWith('http') ? url : `${API_BASE}${url}`

type Media = { id:string; media_type:string; file_url:string; file_name:string; created_at:string }
type Album = { id:string; title:string; description:string; resident_name:string; created_at:string; media:Media[] }

export default function FamilyAlbumDetailPage() {
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [album,   setAlbum]   = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewer,  setViewer]  = useState<Media | null>(null)
  const [viewIdx, setViewIdx] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('family_token')
    if (!token) { nav('/family/login'); return }
    if (id) load(id)
  }, [id])

  const load = async (albumId: string) => {
    setLoading(true)
    try {
      const data = await familyAPI.album(albumId)
      setAlbum(data)
    } catch {
      nav('/family/albums')
    } finally { setLoading(false) }
  }

  const openViewer = (m: Media, idx: number) => { setViewer(m); setViewIdx(idx) }
  const prevMedia = () => {
    if (!album) return
    const idx = Math.max(0, viewIdx - 1)
    setViewer(album.media[idx]); setViewIdx(idx)
  }
  const nextMedia = () => {
    if (!album) return
    const idx = Math.min(album.media.length - 1, viewIdx + 1)
    setViewer(album.media[idx]); setViewIdx(idx)
  }

  const fmt = (s: string) => {
    const d = new Date(s)
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`
  }

  if (loading) return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  if (!album) return null

  const photos = album.media.filter(m => m.media_type === 'photo')
  const videos = album.media.filter(m => m.media_type === 'video')

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button onClick={() => nav('/family/albums')}
            className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors">
            <ChevronLeft size={18} className="text-gray-600"/>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{album.title}</p>
            <p className="text-xs text-gray-500">{album.resident_name} · {fmt(album.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-5 space-y-5">
        {/* 설명 */}
        {album.description && (
          <div className="bg-orange-50 rounded-2xl px-4 py-3.5">
            <p className="text-sm text-orange-800 leading-relaxed">{album.description}</p>
          </div>
        )}

        {/* 통계 */}
        <div className="flex gap-3">
          <div className="flex-1 bg-blue-50 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{photos.length}</p>
            <p className="text-xs text-blue-500 mt-0.5">사진</p>
          </div>
          <div className="flex-1 bg-purple-50 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-purple-600">{videos.length}</p>
            <p className="text-xs text-purple-500 mt-0.5">동영상</p>
          </div>
        </div>

        {/* 미디어 그리드 */}
        {album.media.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ImageIcon size={40} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">아직 사진이 없습니다</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">사진 · 동영상 {album.media.length}개</p>
            <div className="grid grid-cols-3 gap-1.5">
              {album.media.map((m, idx) => (
                <button key={m.id} onClick={() => openViewer(m, idx)}
                  className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden active:scale-95 transition-transform">
                  {m.media_type === 'photo' ? (
                    <img src={mediaUrl(m.file_url)} className="w-full h-full object-cover" alt=""/>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-700">
                      <Play size={22} className="text-white mb-1"/>
                      <span className="text-[10px] text-white/70">동영상</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 하단 안내 */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            🌸 요양원에서 정성껏 기록한 소중한 순간들입니다
          </p>
        </div>
      </div>

      {/* 미디어 뷰어 */}
      {viewer && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* 뷰어 헤더 */}
          <div className="flex items-center justify-between px-4 py-4 bg-black/50">
            <button onClick={() => setViewer(null)} className="text-white/70 hover:text-white">
              <X size={22}/>
            </button>
            <span className="text-white/70 text-sm">{viewIdx+1} / {album.media.length}</span>
            <div className="w-6"/>
          </div>

          {/* 미디어 */}
          <div className="flex-1 flex items-center justify-center px-4 relative">
            {viewer.media_type === 'photo' ? (
              <img src={mediaUrl(viewer.file_url)} className="max-w-full max-h-full object-contain rounded-lg" alt=""/>
            ) : (
              <video src={mediaUrl(viewer.file_url)} controls className="max-w-full max-h-full rounded-lg" autoPlay/>
            )}

            {/* 이전/다음 */}
            {viewIdx > 0 && (
              <button onClick={prevMedia}
                className="absolute left-2 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                <ChevronLeft size={20}/>
              </button>
            )}
            {viewIdx < album.media.length - 1 && (
              <button onClick={nextMedia}
                className="absolute right-2 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 rotate-180">
                <ChevronLeft size={20}/>
              </button>
            )}
          </div>

          {/* 썸네일 스트립 */}
          <div className="overflow-x-auto flex gap-2 px-4 py-3 bg-black/50">
            {album.media.map((m, idx) => (
              <button key={m.id} onClick={() => { setViewer(m); setViewIdx(idx) }}
                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === viewIdx ? 'border-orange-400' : 'border-transparent opacity-50'
                }`}>
                {m.media_type === 'photo' ? (
                  <img src={mediaUrl(m.file_url)} className="w-full h-full object-cover" alt=""/>
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <Play size={14} className="text-white"/>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
