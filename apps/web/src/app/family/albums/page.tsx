'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { API_BASE_URL } from '@/lib/api-client'

type Album = {
  id: string; title: string; description: string
  cover_url: string | null; media_count: number
  resident_name: string; created_at: string
}

async function fetchAlbums(token: string): Promise<Album[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/family/albums`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 401) throw new Error('auth')
  const json = await res.json()
  return json.data ?? []
}

function mediaUrl(url: string | null) {
  if (!url) return null
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

function formatDate(s: string) {
  const d = new Date(s)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function FamilyAlbumsPage() {
  const router = useRouter()
  const [albums,    setAlbums]    = useState<Album[]>([])
  const [loading,   setLoading]   = useState(true)
  const [guardian,  setGuardian]  = useState<{ name: string } | null>(null)
  const [residents, setResidents] = useState<{ name: string; relation: string }[]>([])

  const load = useCallback(async () => {
    const token = localStorage.getItem('family_token')
    if (!token) { router.replace('/family'); return }
    const g = localStorage.getItem('family_guardian')
    const r = localStorage.getItem('family_residents')
    if (g) setGuardian(JSON.parse(g))
    if (r) setResidents(JSON.parse(r))
    setLoading(true)
    try {
      setAlbums(await fetchAlbums(token))
    } catch (e: any) {
      if (e.message === 'auth') {
        localStorage.clear()
        router.replace('/family')
      }
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { load() }, [load])

  const logout = () => {
    localStorage.removeItem('family_token')
    localStorage.removeItem('family_guardian')
    localStorage.removeItem('family_residents')
    router.replace('/family')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-orange-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center text-xl">🌸</div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">우리 가족 앨범</p>
              {guardian && <p className="text-xs text-gray-400">{guardian.name}님</p>}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-5 pb-20">
        {/* 가족 안내 배너 */}
        {residents.length > 0 && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl px-5 py-4 text-white shadow-lg shadow-orange-200">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👴</span>
              <div>
                <p className="font-bold text-base">
                  {residents.map(r => r.name).join(', ')} {residents.map(r => r.relation).join(' · ')}님
                </p>
                <p className="text-orange-100 text-sm mt-0.5">
                  소중한 가족의 일상을 담았습니다 💛
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 앨범 목록 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-3 border-orange-300 border-t-orange-500 rounded-full animate-spin"/>
            <p className="text-sm text-gray-400">앨범을 불러오는 중...</p>
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-5 text-5xl">
              📷
            </div>
            <p className="font-bold text-gray-700 text-lg">아직 앨범이 없습니다</p>
            <p className="text-sm text-gray-400 mt-2">곧 소중한 순간들이 올라올 거예요 🌻</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 font-medium">앨범 {albums.length}개</p>
            {albums.map(album => {
              const cover = mediaUrl(album.cover_url)
              return (
                <button
                  key={album.id}
                  onClick={() => router.push(`/family/albums/${album.id}`)}
                  className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.99] transition-all hover:shadow-md text-left"
                >
                  {/* 큰 표지 사진 */}
                  <div className="relative w-full aspect-[16/10] bg-gradient-to-br from-orange-100 to-amber-100">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={album.title}
                        fill
                        className="object-cover"
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">📷</div>
                    )}
                    <span className="absolute bottom-2.5 right-2.5 text-xs font-semibold text-white bg-black/45 px-2.5 py-1 rounded-full">
                      📸 {album.media_count}장
                    </span>
                  </div>

                  {/* 정보 */}
                  <div className="px-4 py-3">
                    <p className="font-bold text-gray-900 text-lg truncate">{album.title}</p>
                    {album.description && (
                      <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{album.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(album.created_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* 홈 링크 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-3 px-5">
        <a
          href="/"
          className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-orange-500 transition-colors"
        >
          <span>🏥</span> 행복한요양원 홈페이지 바로가기
        </a>
      </div>
    </div>
  )
}
