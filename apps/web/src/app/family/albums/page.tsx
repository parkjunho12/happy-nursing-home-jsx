'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { resolveApiBase } from '@/lib/api-client'
import FamilyTabBar from '@/components/family/FamilyTabBar'

type Album = {
  id: string; title: string; description: string
  cover_url: string | null; media_count: number
  resident_name: string; created_at: string
}

async function fetchAlbums(token: string): Promise<Album[]> {
  const res = await fetch(`${resolveApiBase()}/api/v1/family/albums`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 401) throw new Error('auth')
  const json = await res.json()
  return json.data ?? []
}

function mediaUrl(url: string | null) {
  if (!url) return null
  return url.startsWith('http') ? url : `${resolveApiBase()}${url}`
}

function formatDate(s: string) {
  const d = new Date(s)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}
const _sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
function relativeDate(s: string) {
  const d = new Date(s)
  const days = Math.floor((_sod(new Date()) - _sod(d)) / 86400000)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return formatDate(s)
}
function isNew(s: string) {
  return Date.now() - new Date(s).getTime() < 3 * 86400000
}

export default function FamilyAlbumsPage() {
  const router = useRouter()
  const [albums,    setAlbums]    = useState<Album[]>([])
  const [loading,   setLoading]   = useState(true)
  const [guardian,  setGuardian]  = useState<{ name: string } | null>(null)
  const [residents, setResidents] = useState<{ name: string; relation: string }[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const token = localStorage.getItem('family_token')
    if (!token) { router.replace('/family'); return }
    const g = localStorage.getItem('family_guardian')
    const r = localStorage.getItem('family_residents')
    if (g) setGuardian(JSON.parse(g))
    if (r) setResidents(JSON.parse(r))
    setLoading(true); setError('')
    try {
      setAlbums(await fetchAlbums(token))
    } catch (e: any) {
      if (e.message === 'auth') {
        localStorage.clear()
        router.replace('/family')
      } else {
        setError('앨범을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { load() }, [load])

  // 앱(WebView)일 때 FCM 토큰을 서버에 등록 (브릿지가 있을 때만)
  const registerPush = useCallback(async () => {
    const native = (window as any).HappyCareNative
    if (!native || typeof native.getFcmToken !== 'function') return
    const token = native.getFcmToken()
    const jwt = localStorage.getItem('family_token')
    if (!token || !jwt) return
    try {
      await fetch(`${resolveApiBase()}/api/v1/family/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ token, platform: native.getPlatform?.() ?? 'android' }),
      })
    } catch { /* 등록 실패는 조용히 무시 */ }
  }, [])

  useEffect(() => {
    registerPush()
    const t = setTimeout(registerPush, 2000)   // 토큰 준비 지연 대비 1회 재시도
    return () => clearTimeout(t)
  }, [registerPush])

  // 안드로이드 앱(WebView) 안에서 실행 중이면 FCM 토큰을 백엔드에 등록
  useEffect(() => {
    const bridge = (window as any).NativeBridge
    const token = typeof window !== 'undefined' ? localStorage.getItem('family_token') : null
    if (!bridge?.getFcmToken || !token) return
    try {
      const fcm: string = bridge.getFcmToken()
      if (!fcm) return
      fetch(`${resolveApiBase()}/api/v1/family/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: fcm, platform: 'android' }),
      }).catch(() => {})
    } catch { /* 앱 밖이면 무시 */ }
  }, [])

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
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-white ring-1 ring-orange-100 flex items-center justify-center"><Image src="/assets/logo/logo.png" alt="로고" width={36} height={36} className="w-full h-full object-contain p-0.5" /></div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">우리 가족 앨범</p>
              {guardian && <p className="text-xs text-gray-400">{guardian.name}님</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => load()}
              disabled={loading}
              aria-label="새로고침"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="text-xs text-gray-400 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-5 pb-28">
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
          <div className="space-y-4">
            {[0, 1].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="w-full aspect-[16/10] bg-gray-100" />
                <div className="px-4 py-3 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">😢</div>
            <p className="font-bold text-gray-700">{error}</p>
            <button onClick={() => load()} className="mt-5 px-6 py-3.5 min-h-[48px] bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-200 text-[15px]">
              다시 시도
            </button>
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-5 text-5xl">
              🌻
            </div>
            <p className="font-bold text-gray-800 text-lg">아직 등록된 사진이 없습니다</p>
            <p className="text-[15px] text-gray-500 mt-3 leading-relaxed">
              어르신의 일상 사진이 준비되는 대로<br />
              이곳에서 확인하실 수 있습니다.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 bg-amber-50 text-amber-700 rounded-2xl px-4 py-3 text-sm font-medium">
              <span aria-hidden>💛</span>
              소중한 가족의 하루를 정성껏 담고 있어요
            </div>
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
                    {isNew(album.created_at) && (
                      <span className="absolute top-2.5 left-2.5 z-10 text-[11px] font-extrabold text-white bg-rose-500 px-2.5 py-1 rounded-full shadow-md animate-pulse">NEW</span>
                    )}
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
                    <p className="text-xs text-gray-400 mt-1">{relativeDate(album.created_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      <FamilyTabBar />
    </div>
  )
}
