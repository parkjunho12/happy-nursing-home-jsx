'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { resolveApiBase } from '@/lib/api-client'
import FamilyTabBar from '@/components/family/FamilyTabBar'

type News = {
  id: string; category: string; title: string
  summary: string | null; image_url: string | null
  is_pinned: boolean; published_at: string | null; created_at: string | null
}

const CAT_EMOJI: Record<string, string> = {
  일반: '📢', 행사: '🎉', 면회: '🤝', 건강: '💊', 식단: '🍚', 봉사: '💛', 긴급: '🚨', 기타: '📌',
}
const CAT_COLOR: Record<string, string> = {
  일반: 'bg-gray-100 text-gray-600', 행사: 'bg-pink-100 text-pink-700', 면회: 'bg-blue-100 text-blue-700',
  건강: 'bg-emerald-100 text-emerald-700', 식단: 'bg-amber-100 text-amber-700', 봉사: 'bg-violet-100 text-violet-700',
  긴급: 'bg-red-100 text-red-700', 기타: 'bg-slate-100 text-slate-600',
}

async function fetchNews(token: string): Promise<News[]> {
  const res = await fetch(`${resolveApiBase()}/api/v1/family/news`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  if (res.status === 401) throw new Error('auth')
  const json = await res.json()
  return json.data ?? []
}
const imgUrl = (u: string | null) => (!u ? null : u.startsWith('http') ? u : `${resolveApiBase()}${u}`)
const fmtDate = (s?: string | null) => {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
const isNew = (s?: string | null) => !!s && Date.now() - new Date(s).getTime() < 3 * 86400000

export default function FamilyNewsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const token = localStorage.getItem('family_token')
    if (!token) { router.replace('/family'); return }
    setLoading(true); setError('')
    try { setRows(await fetchNews(token)) }
    catch (e: any) {
      if (e.message === 'auth') { localStorage.clear(); router.replace('/family') }
      else setError('시설소식을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white border-b border-orange-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-white ring-1 ring-orange-100 flex items-center justify-center">
              <Image src="/assets/logo/logo.png" alt="로고" width={36} height={36} className="w-full h-full object-contain p-0.5" />
            </div>
            <p className="font-bold text-gray-900 text-sm">시설소식</p>
          </div>
          <button onClick={() => load()} disabled={loading} aria-label="새로고침"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-50">
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-3 pb-28">
        {loading ? (
          <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}</div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">😢</div>
            <p className="font-bold text-gray-700">{error}</p>
            <button onClick={() => load()} className="mt-5 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-[15px] min-h-[48px]">다시 시도</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-5 text-5xl">📮</div>
            <p className="font-bold text-gray-800 text-lg">아직 등록된 소식이 없습니다</p>
            <p className="text-[15px] text-gray-500 mt-3 leading-relaxed">요양원 행사·안내 소식이 준비되는 대로<br />이곳에서 확인하실 수 있습니다.</p>
          </div>
        ) : (
          rows.map(n => {
            const cover = imgUrl(n.image_url)
            return (
              <button key={n.id} onClick={() => router.push(`/family/news/${n.id}`)}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.99] transition-all text-left flex">
                {cover && <img src={cover} alt="" className="w-24 h-auto object-cover shrink-0" />}
                <div className="flex-1 min-w-0 p-3.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {n.is_pinned && <span className="text-[11px] font-bold text-orange-600">📌 고정</span>}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${CAT_COLOR[n.category] ?? 'bg-gray-100 text-gray-600'}`}>{CAT_EMOJI[n.category]} {n.category}</span>
                    {isNew(n.published_at || n.created_at) && <span className="text-[10px] font-extrabold text-white bg-rose-500 px-1.5 py-0.5 rounded-full">NEW</span>}
                  </div>
                  <p className="font-bold text-gray-900 text-[15px] mt-1.5 line-clamp-2">{n.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{fmtDate(n.published_at || n.created_at)}</p>
                  {n.summary && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{n.summary}</p>}
                </div>
              </button>
            )
          })
        )}
      </main>

      <FamilyTabBar />
    </div>
  )
}
