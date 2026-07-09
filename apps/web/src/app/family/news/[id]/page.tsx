'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { resolveApiBase } from '@/lib/api-client'

type News = {
  id: string; category: string; title: string
  summary: string | null; content: string | null; image_url: string | null
  is_pinned: boolean; author_name: string | null
  published_at: string | null; created_at: string | null
}

const CAT_EMOJI: Record<string, string> = {
  일반: '📢', 행사: '🎉', 면회: '🤝', 건강: '💊', 식단: '🍚', 봉사: '💛', 긴급: '🚨', 기타: '📌',
}
const CAT_COLOR: Record<string, string> = {
  일반: 'bg-gray-100 text-gray-600', 행사: 'bg-pink-100 text-pink-700', 면회: 'bg-blue-100 text-blue-700',
  건강: 'bg-emerald-100 text-emerald-700', 식단: 'bg-amber-100 text-amber-700', 봉사: 'bg-violet-100 text-violet-700',
  긴급: 'bg-red-100 text-red-700', 기타: 'bg-slate-100 text-slate-600',
}
const imgUrl = (u: string | null) => (!u ? null : u.startsWith('http') ? u : `${resolveApiBase()}${u}`)
const fmtDate = (s?: string | null) => {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function FamilyNewsDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [n, setN] = useState<News | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const token = localStorage.getItem('family_token')
    if (!token) { router.replace('/family'); return }
    setLoading(true)
    try {
      const res = await fetch(`${resolveApiBase()}/api/v1/family/news/${id}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      })
      if (res.status === 401) { localStorage.clear(); router.replace('/family'); return }
      if (!res.ok) { router.replace('/family/news'); return }
      const json = await res.json()
      setN(json.data)
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
    </div>
  )
  if (!n) return null

  const cover = imgUrl(n.image_url)

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white/95 backdrop-blur border-b border-orange-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center gap-3">
          <button onClick={() => router.back()} aria-label="뒤로"
            className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-orange-100 hover:text-orange-600 font-bold text-lg active:scale-95">←</button>
          <p className="font-bold text-gray-900 truncate">시설소식</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 pb-10">
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {n.is_pinned && <span className="text-[11px] font-bold text-orange-600">📌 고정</span>}
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${CAT_COLOR[n.category] ?? 'bg-gray-100 text-gray-600'}`}>{CAT_EMOJI[n.category]} {n.category}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 leading-snug">{n.title}</h1>
        <p className="text-sm text-gray-400 mt-2">{fmtDate(n.published_at || n.created_at)}{n.author_name ? ` · ${n.author_name}` : ''}</p>

        {cover && <img src={cover} alt="" className="w-full rounded-2xl mt-4 border border-gray-100" />}

        {n.summary && (
          <div className="mt-4 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 text-[15px] text-orange-800 leading-relaxed">{n.summary}</div>
        )}
        {n.content && (
          <div className="mt-4 text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">{n.content}</div>
        )}
      </main>
    </div>
  )
}
