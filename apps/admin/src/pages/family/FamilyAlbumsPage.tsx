import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut, Image } from 'lucide-react'
import { familyAPI } from '@/api/albumClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8010'
const mediaUrl = (url: string) => url?.startsWith('http') ? url : `${API_BASE}${url}`

type Album = {
  id: string; title: string; description: string; cover_url: string|null
  media_count: number; resident_name: string; created_at: string
}

export default function FamilyAlbumsPage() {
  const nav = useNavigate()
  const [albums,   setAlbums]   = useState<Album[]>([])
  const [loading,  setLoading]  = useState(true)
  const [guardian, setGuardian] = useState<{name:string}|null>(null)
  const [residents, setResidents] = useState<{name:string;relation:string}[]>([])

  useEffect(() => {
    const token = localStorage.getItem('family_token')
    if (!token) { nav('/family/login'); return }
    const g = localStorage.getItem('family_guardian')
    const r = localStorage.getItem('family_residents')
    if (g) setGuardian(JSON.parse(g))
    if (r) setResidents(JSON.parse(r))
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await familyAPI.albums()
      setAlbums(data)
    } catch {
      localStorage.removeItem('family_token')
      nav('/family/login')
    } finally { setLoading(false) }
  }

  const logout = () => {
    localStorage.removeItem('family_token')
    localStorage.removeItem('family_guardian')
    localStorage.removeItem('family_residents')
    nav('/family/login')
  }

  const fmt = (s: string) => {
    const d = new Date(s)
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="text-lg">🌸</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">우리 가족 앨범</p>
              {guardian && <p className="text-xs text-gray-500">{guardian.name}님</p>}
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <LogOut size={13}/> 로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* 가족 소개 */}
        {residents.length > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <span className="text-2xl">👴</span>
            <div>
              <p className="text-sm font-bold text-orange-800">
                {residents.map(r => r.name).join(', ')}
              </p>
              <p className="text-xs text-orange-600">
                {residents.map(r => r.relation).join(' · ')}의 앨범을 보고 계십니다
              </p>
            </div>
          </div>
        )}

        {/* 앨범 목록 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin mb-3"/>
            <p className="text-sm text-gray-500">앨범을 불러오는 중...</p>
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📷</span>
            </div>
            <p className="font-bold text-gray-700">아직 등록된 앨범이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1.5">곧 소중한 순간들이 올라올 예정이에요 🌻</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 font-medium">앨범 {albums.length}개</p>
            <div className="space-y-3">
              {albums.map(album => (
                <button key={album.id} onClick={() => nav(`/family/albums/${album.id}`)}
                  className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md active:scale-[0.98] transition-all text-left">
                  <div className="flex gap-4 p-4">
                    {/* 썸네일 */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-100 to-amber-100">
                      {album.cover_url ? (
                        <img src={mediaUrl(album.cover_url)} className="w-full h-full object-cover" alt=""/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image size={24} className="text-orange-300"/>
                        </div>
                      )}
                    </div>
                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base leading-snug">{album.title}</p>
                      {album.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{album.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-full">
                          사진 {album.media_count}장
                        </span>
                        <span className="text-xs text-gray-400">{fmt(album.created_at)}</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 self-center flex-shrink-0"/>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
