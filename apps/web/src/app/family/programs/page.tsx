'use client'

/**
 * 보호자앱 — 월간 프로그램표.
 * 게시된 달만 보인다. '오늘 프로그램' 히어로 + 일자별 아젠다(모바일 우선, 40~70대 보호자).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { resolveApiBase } from '@/lib/api-client'
import FamilyTabBar from '@/components/family/FamilyTabBar'

type Entry = { slot: '오전' | '오후'; group: string | null; title: string; time?: string | null; kind?: string | null }
type MonthData = { month: string; days: Record<string, Entry[]> | null; notes: string[]; published_months: string[] }

const chipCls = (g: string | null, kind?: string | null) => {
  if (kind === '교육') return 'bg-pink-50 text-pink-700 border-pink-200'
  if (!g) return 'bg-slate-50 text-slate-600 border-slate-200'
  if (g.startsWith('인지')) return 'bg-violet-50 text-violet-700 border-violet-200'
  if (g.startsWith('여가')) return 'bg-sky-50 text-sky-700 border-sky-200'
  if (g.startsWith('신체')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

async function fetchMonth(token: string, month: string): Promise<MonthData> {
  const res = await fetch(`${resolveApiBase()}/api/v1/family/programs?month=${month}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  if (res.status === 401) throw new Error('auth')
  const json = await res.json()
  return json.data
}

const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export default function FamilyProgramsPage() {
  const router = useRouter()
  const today = new Date()
  const [ym, setYm] = useState(ymOf(today))
  const [data, setData] = useState<MonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const todayRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (month: string) => {
    const token = localStorage.getItem('family_token')
    if (!token) { router.replace('/family'); return }
    setLoading(true); setError('')
    try { setData(await fetchMonth(token, month)) }
    catch (e: any) {
      if (e.message === 'auth') { localStorage.clear(); router.replace('/family') }
      else setError('프로그램표를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { load(ym) }, [ym, load])

  const [y, m] = ym.split('-').map(Number)
  const isThisMonth = ym === ymOf(today)
  const move = (d: number) => {
    const nd = new Date(y, m - 1 + d, 1)
    setYm(ymOf(nd))
  }

  const todayEntries: Entry[] = (isThisMonth && data?.days?.[String(today.getDate())]) || []
  const total = new Date(y, m, 0).getDate()
  const dayList = Array.from({ length: total }, (_, i) => i + 1)

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white border-b border-orange-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-white ring-1 ring-orange-100 flex items-center justify-center">
              <Image src="/assets/logo/logo.png" alt="로고" width={36} height={36} className="w-full h-full object-contain p-0.5" />
            </div>
            <p className="font-bold text-gray-900 text-sm">프로그램표</p>
          </div>
          {isThisMonth && data?.days && (
            <button onClick={() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="text-[13px] font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl min-h-[36px]">
              오늘로 이동
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-5 pb-28">
        {/* 월 이동 */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => move(-1)} aria-label="이전 달"
            className="w-11 h-11 rounded-2xl bg-white border border-gray-200 text-gray-500 text-lg font-bold shadow-sm active:scale-95">‹</button>
          <p className="text-lg font-extrabold text-gray-900">{y}년 {m}월</p>
          <button onClick={() => move(1)} aria-label="다음 달"
            className="w-11 h-11 rounded-2xl bg-white border border-gray-200 text-gray-500 text-lg font-bold shadow-sm active:scale-95">›</button>
        </div>

        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}</div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">😢</div>
            <p className="font-bold text-gray-700">{error}</p>
            <button onClick={() => load(ym)} className="mt-5 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-[15px] min-h-[48px]">다시 시도</button>
          </div>
        ) : !data?.days ? (
          <div className="text-center py-20 px-4">
            <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-5 text-5xl">🗓️</div>
            <p className="font-bold text-gray-800 text-lg">{m}월 프로그램표는 준비 중이에요</p>
            <p className="text-[15px] text-gray-500 mt-3 leading-relaxed">완성되는 대로 이곳에서<br />확인하실 수 있습니다.</p>
            {(data?.published_months?.length ?? 0) > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {data!.published_months.slice(-4).map(pm => (
                  <button key={pm} onClick={() => setYm(pm)}
                    className="px-4 py-2.5 rounded-2xl bg-white border border-orange-200 text-orange-700 font-bold text-sm min-h-[44px]">
                    {Number(pm.slice(5, 7))}월 보기
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 오늘 프로그램 히어로 */}
            {isThisMonth && (
              <div className="mb-5 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-400 p-[1.5px] shadow-md">
                <div className="rounded-[calc(1.5rem-1.5px)] bg-white p-4">
                  <p className="text-[13px] font-extrabold text-orange-600 mb-2">
                    ☀️ 오늘 {m}월 {today.getDate()}일 ({DOW[today.getDay()]}) 프로그램
                  </p>
                  {todayEntries.length === 0 ? (
                    <p className="text-[15px] text-gray-500">오늘은 예정된 프로그램이 없습니다.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(['오전', '오후'] as const).map(slot => {
                        const es = todayEntries.filter(e => e.slot === slot)
                        if (es.length === 0) return null
                        return (
                          <div key={slot} className="flex gap-2">
                            <span className="shrink-0 mt-0.5 text-[12px] font-extrabold text-gray-400 w-8">{slot}</span>
                            <div className="flex-1 flex flex-wrap gap-1.5">
                              {es.map((e, i) => (
                                <span key={i} className={`text-[13px] font-semibold px-2.5 py-1 rounded-xl border ${chipCls(e.group, e.kind)}`}>
                                  {e.time && <b className="mr-1">{e.time}</b>}
                                  {e.kind === '교육' && '📖 '}
                                  {e.title || e.group}
                                  {e.kind === '자체' && <span className="text-red-500"> ♥</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 일자별 아젠다 */}
            <div className="space-y-2">
              {dayList.map(day => {
                const es = data.days![String(day)] ?? []
                if (es.length === 0) return null
                const dow = new Date(y, m - 1, day).getDay()
                const isToday = isThisMonth && day === today.getDate()
                return (
                  <div key={day} ref={isToday ? todayRef : undefined}
                    className={`flex gap-3 bg-white rounded-2xl border p-3 shadow-sm ${isToday ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-100'}`}>
                    <div className={`shrink-0 w-12 h-12 rounded-2xl flex flex-col items-center justify-center ${
                      isToday ? 'bg-orange-500 text-white' : dow === 0 ? 'bg-red-50 text-red-500' : dow === 6 ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-600'}`}>
                      <span className="text-base font-extrabold leading-none">{day}</span>
                      <span className="text-[10px] font-bold mt-0.5">{DOW[dow]}</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {(['오전', '오후'] as const).map(slot => {
                        const se = es.filter(e => e.slot === slot)
                        if (se.length === 0) return null
                        return (
                          <div key={slot} className="flex gap-1.5 items-start">
                            <span className="shrink-0 mt-1 text-[11px] font-extrabold text-gray-300 w-6">{slot}</span>
                            <div className="flex-1 flex flex-wrap gap-1">
                              {se.map((e, i) => (
                                <span key={i} className={`text-[12px] font-semibold px-2 py-0.5 rounded-lg border ${chipCls(e.group, e.kind)}`}>
                                  {e.time && <b className="mr-0.5">{e.time}</b>}
                                  {e.kind === '교육' && '📖 '}
                                  {e.title || e.group}
                                  {e.kind === '자체' && <span className="text-red-500"> ♥</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 안내 */}
            {data.notes.length > 0 && (
              <div className="mt-5 bg-white rounded-2xl border border-orange-100 p-4">
                <p className="text-[13px] font-extrabold text-orange-600 mb-2">📋 안내</p>
                <ul className="space-y-1">
                  {data.notes.map((n, i) => (
                    <li key={i} className="text-[13px] text-gray-600 leading-relaxed">{n}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-[12px] text-gray-400 text-center leading-relaxed">
              📖 분홍 = 어르신 대상 교육 · <span className="text-red-500 font-bold">♥</span> = 요양원 자체 프로그램<br />
              프로그램은 요양원 사정에 따라 변경될 수 있습니다.
            </p>
          </>
        )}
      </main>

      <FamilyTabBar />
    </div>
  )
}
