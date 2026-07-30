import { useEffect, useRef, useState } from 'react'
import { ChefHat, Loader2, Upload } from 'lucide-react'
import { mealAPI, MEAL_KEYS, type MealKey, type MealWeekData, type MealMonthData } from '@/api/mealClient'

/**
 * 식단표 — 영양사가 만들던 주간메뉴표 엑셀을 그대로 올려 화면으로.
 * 주간 보기(엑셀과 같은 7일 표) + 월간 보기(달력, 점심 대표 메뉴).
 */
const DOW = ['월', '화', '수', '목', '금', '토', '일']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mondayOf = (d: Date) => { const n = new Date(d); n.setDate(n.getDate() - ((n.getDay() + 6) % 7)); return n }

const MEAL_META: Record<MealKey, { label: string; emoji: string; head: string; cell: string }> = {
  '아침':       { label: '상쾌한 아침', emoji: '🌅', head: 'bg-sky-50 text-sky-700',       cell: 'bg-sky-50/30' },
  '간식(오전)': { label: '오전 간식',   emoji: '🥛', head: 'bg-amber-50 text-amber-600',   cell: 'bg-amber-50/30' },
  '점심':       { label: '행복한 점심', emoji: '🍚', head: 'bg-orange-50 text-orange-700', cell: 'bg-orange-50/30' },
  '간식(오후)': { label: '오후 간식',   emoji: '🍞', head: 'bg-amber-50 text-amber-600',   cell: 'bg-amber-50/30' },
  '저녁':       { label: '편안한 저녁', emoji: '🌙', head: 'bg-violet-50 text-violet-700', cell: 'bg-violet-50/30' },
}

export default function MealPlanPage() {
  const today = iso(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(() => iso(mondayOf(new Date())))          // 주간 기준(월요일)
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [week, setWeek] = useState<MealWeekData | null>(null)
  const [month, setMonth] = useState<MealMonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    const p = view === 'week' ? mealAPI.week(anchor).then(setWeek) : mealAPI.month(ym).then(setMonth)
    p.catch(() => { view === 'week' ? setWeek(null) : setMonth(null) }).finally(() => setLoading(false))
  }
  useEffect(load, [view, anchor, ym])

  const moveWeek = (d: number) => {
    const n = new Date(anchor); n.setDate(n.getDate() + d * 7)
    setAnchor(iso(mondayOf(n)))
  }
  const moveMonth = (d: number) => {
    const [y, m] = ym.split('-').map(Number)
    const nd = new Date(y, m - 1 + d, 1)
    setYm(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`)
  }

  const onUpload = async (f: File | null) => {
    if (!f) return
    setBusy(true)
    try {
      const r = await mealAPI.upload(f)
      setView('week'); setAnchor(r.start)
      alert(`${Number(r.start.slice(5, 7))}/${Number(r.start.slice(8, 10))} ~ ${Number(r.end.slice(5, 7))}/${Number(r.end.slice(8, 10))} 식단 ${r.day_count}일치를 저장했습니다.`)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '업로드 실패') }
    finally { setBusy(false); load() }
  }

  // 주간 날짜 배열 — 저장된 주가 있으면 그 범위, 없으면 anchor 기준 7일
  const weekDates: string[] = (() => {
    const s = week?.start ?? anchor
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return iso(d) })
  })()

  const fmtRange = () => {
    const s = weekDates[0]; const e = weekDates[6]
    return `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))} ~ ${Number(e.slice(5, 7))}.${Number(e.slice(8, 10))}`
  }

  // 월간 달력 그리드
  const [gy, gm] = ym.split('-').map(Number)
  const total = new Date(gy, gm, 0).getDate()
  const firstDow = (new Date(gy, gm - 1, 1).getDay() + 6) % 7   // 월요일 시작
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
        onChange={e => { onUpload(e.target.files?.[0] ?? null); e.target.value = '' }} />

      <div className="flex items-center gap-2 flex-wrap mb-1">
        <ChefHat size={20} className="text-orange-500" />
        <h1 className="text-xl font-bold text-gray-900">식단표</h1>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} 주간 식단표 업로드
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">쓰시던 주간메뉴표 엑셀 그대로 올리면 됩니다 — 같은 주는 새 파일로 교체돼요</p>

      {/* 보기 전환 + 이동 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex gap-1">
          {([['week', '주간'], ['month', '월간']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border ${view === v ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mx-auto">
          <button onClick={() => view === 'week' ? moveWeek(-1) : moveMonth(-1)} className="p-2 rounded-xl border border-gray-200 text-gray-500">‹</button>
          <span className="text-base font-bold text-gray-800 min-w-[140px] text-center">
            {view === 'week' ? fmtRange() : `${gy}년 ${gm}월`}
          </span>
          <button onClick={() => view === 'week' ? moveWeek(1) : moveMonth(1)} className="p-2 rounded-xl border border-gray-200 text-gray-500">›</button>
        </div>
        <button onClick={() => { setView('week'); setAnchor(iso(mondayOf(new Date()))) }}
          className="px-3 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-600 text-xs font-bold">오늘</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : view === 'week' ? (
        !week ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <p className="text-sm">이 주의 식단표가 아직 없습니다 — 「주간 식단표 업로드」로 올려주세요.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full border-collapse min-w-[880px]">
              <thead>
                <tr>
                  <th className="w-24 px-2 py-2.5 text-[11px] font-bold text-gray-400 border-b border-r border-gray-100 bg-gray-50/50">구분</th>
                  {weekDates.map((d, i) => (
                    <th key={d} className={`px-2 py-2.5 border-b border-gray-100 text-center ${d === today ? 'bg-orange-50' : ''}`}>
                      <p className={`text-xs font-extrabold ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-700'}`}>
                        {Number(d.slice(5, 7))}/{Number(d.slice(8, 10))} ({DOW[i]})
                      </p>
                      {d === today && <p className="text-[9px] font-bold text-orange-500">오늘</p>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_KEYS.map(k => {
                  const meta = MEAL_META[k]
                  const snack = k.startsWith('간식')
                  return (
                    <tr key={k}>
                      <td className={`px-2 py-2 border-b border-r border-gray-100 text-center align-middle ${meta.head}`}>
                        <p className="text-lg leading-none mb-0.5">{meta.emoji}</p>
                        <p className="text-[11px] font-extrabold whitespace-nowrap">{meta.label}</p>
                      </td>
                      {weekDates.map(d => {
                        const items = week.days[d]?.[k] ?? []
                        return (
                          <td key={d} className={`px-2 ${snack ? 'py-1.5' : 'py-2'} border-b border-gray-50 align-top ${d === today ? 'bg-orange-50/40' : meta.cell}`}>
                            {items.map((it, i2) => (
                              <p key={i2} className={`leading-snug ${i2 === 0 && !snack ? 'text-[11.5px] font-bold text-gray-800' : 'text-[11px] text-gray-600'}`}>{it}</p>
                            ))}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(week.notes ?? []).length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/40">
                {week.notes.map((n, i) => <p key={i} className="text-[11px] text-gray-500">{n}</p>)}
              </div>
            )}
          </div>
        )
      ) : (
        /* ── 월간 보기 — 점심 위주 요약 달력 ── */
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DOW.map((d, i) => (
                <div key={d} className={`py-2 text-center text-xs font-bold ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                const dIso = day ? `${ym}-${String(day).padStart(2, '0')}` : ''
                const md = day ? month?.days[dIso] : undefined
                return (
                  <div key={i}
                    onClick={day ? () => { setAnchor(iso(mondayOf(new Date(dIso)))); setView('week') } : undefined}
                    title={day ? '클릭하면 이 주 식단으로' : undefined}
                    className={`min-h-[86px] border-b border-r border-gray-50 p-1.5 ${day === null ? 'bg-gray-50/50' : 'cursor-pointer hover:bg-orange-50/40'} ${dIso === today ? 'ring-2 ring-inset ring-orange-300' : ''}`}>
                    {day !== null && (
                      <>
                        <p className={`text-[11px] font-bold mb-1 ${i % 7 === 6 ? 'text-red-500' : i % 7 === 5 ? 'text-blue-500' : 'text-gray-600'}`}>{day}</p>
                        {md ? (
                          <>
                            <p className="text-[10px] leading-tight text-gray-700 font-semibold">🍚 {(md['점심'] ?? [])[1] ?? (md['점심'] ?? [])[0] ?? ''}</p>
                            <p className="text-[9.5px] leading-tight text-gray-500">{(md['점심'] ?? [])[2] ?? ''}</p>
                            {(md['간식(오후)'] ?? [])[0] && <p className="text-[9.5px] leading-tight text-amber-600 mt-0.5">🍞 {(md['간식(오후)'] ?? [])[0]}</p>}
                          </>
                        ) : (
                          <p className="text-[9.5px] text-gray-300">—</p>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            달력에는 점심 국·메인 반찬과 오후 간식만 요약해 보여드려요 — 날짜를 클릭하면 그 주 전체 식단으로 이동
            {month && month.week_count > 0 && ` · 이 달에 등록된 주간표 ${month.week_count}개`}
          </p>
        </>
      )}
    </div>
  )
}
