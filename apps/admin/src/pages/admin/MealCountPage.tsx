import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, ChevronDown, ChevronUp, Loader2, Printer, Settings2 } from 'lucide-react'
import { mealCountAPI, type MealCountData } from '@/api/mealClient'

/**
 * 식수 정산 — 재원 어르신(경관식 제외) × 5끼니에서
 * 외출·외박·외래로 자리 비운 끼니를 자동으로 뺀 월별 집계.
 * 어떤 일정과 겹쳐 빠졌는지까지 그대로 보여준다.
 */
const MEAL_META: Record<string, { label: string; emoji: string; head: string }> = {
  breakfast: { label: '아침', emoji: '🌅', head: 'text-sky-600' },
  snack_am: { label: '아침 간식', emoji: '🥛', head: 'text-amber-500' },
  lunch: { label: '점심', emoji: '🍚', head: 'text-orange-600' },
  snack_pm: { label: '저녁 간식', emoji: '🍞', head: 'text-amber-500' },
  dinner: { label: '저녁', emoji: '🌙', head: 'text-violet-600' },
}
const CAT_CLS: Record<string, string> = {
  외출: 'bg-cyan-100 text-cyan-700', 외박: 'bg-indigo-100 text-indigo-700', '외래·병원': 'bg-rose-100 text-rose-700', 퇴소: 'bg-gray-200 text-gray-600',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

export default function MealCountPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [data, setData] = useState<MealCountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exclOpen, setExclOpen] = useState(true)

  useEffect(() => {
    setLoading(true)
    mealCountAPI.month(ym).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [ym])

  const move = (d: number) => {
    const [y, m] = ym.split('-').map(Number)
    const nd = new Date(y, m - 1 + d, 1)
    setYm(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`)
  }

  const [y, m] = ym.split('-').map(Number)
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
  const noTimes = data && data.meal_order.length === 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Calculator size={20} className="text-orange-500" />
        <h1 className="text-xl font-bold text-gray-900">식수 정산</h1>
        <span className="text-[11px] text-gray-400">외출·외박·외래로 비운 끼니는 자동 제외 (실제 귀원 기록 기준)</span>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 print:hidden">
            <Printer size={13} /> 인쇄
          </button>
        </div>
      </div>

      {/* 월 이동 */}
      <div className="flex items-center justify-center gap-3 my-3 print:hidden">
        <button onClick={() => move(-1)} className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500">‹</button>
        <span className="text-base font-bold text-gray-800 min-w-[110px] text-center">{y}년 {m}월</span>
        <button onClick={() => move(1)} className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : !data ? (
        <p className="text-center py-16 text-sm text-gray-400">집계를 불러오지 못했습니다.</p>
      ) : noTimes ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Settings2 size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">식사 시간이 아직 설정되지 않았어요.</p>
          <button onClick={() => navigate('/settings')} className="mt-3 text-sm font-bold text-orange-500 hover:underline">설정 → 식사 시간에서 등록하기 ›</button>
        </div>
      ) : (
        <>
          {/* ── 요약 히어로 ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="col-span-2 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white p-4 shadow-md">
              <p className="text-[11px] font-bold opacity-90">{m}월 총 식수</p>
              <p className="text-3xl font-black leading-tight">{data.grand_total.toLocaleString()}<span className="text-base font-bold ml-1">식</span></p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {data.meal_order.map(k => (
                  <span key={k} className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5">
                    {MEAL_META[k]?.emoji} {MEAL_META[k]?.label} {data.totals[k]?.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-[11px] font-bold text-gray-400">제외된 끼니</p>
              <p className="text-2xl font-black text-rose-500">{data.excluded_total}<span className="text-sm font-bold">끼</span></p>
              <p className="text-[10px] text-gray-400 mt-1">외출·외박·외래 겹침</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-[11px] font-bold text-gray-400">경관식 어르신</p>
              <p className="text-2xl font-black text-gray-700">{data.tube_feeding.length}<span className="text-sm font-bold">명</span></p>
              <p className="text-[10px] text-gray-400 mt-1 truncate" title={data.tube_feeding.join(' · ')}>
                {data.tube_feeding.length ? data.tube_feeding.join(' · ') : '식수에서 상시 제외'}
              </p>
            </div>
          </div>

          {/* 귀원 미기록 경고 */}
          {data.warnings.length > 0 && (
            <div className="mb-3 px-3.5 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              ⚠ <b>귀원 기록이 없는 외박 {data.warnings.length}건</b> — 출발일은 안 드신 것으로 계산했어요. 다른 날짜에 걸치면 일정 캘린더 「귀원 대기」에서 기록해주세요.
              <span className="block mt-0.5 text-amber-600">
                {data.warnings.slice(0, 5).map(w => `${Number(w.date.slice(8, 10))}일 ${w.name}(${w.category})`).join(' · ')}
                {data.warnings.length > 5 && ` 외 ${data.warnings.length - 5}건`}
              </span>
            </div>
          )}

          {/* ── 일자별 표 ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 text-[11px] font-bold text-gray-500">
                  <th className="px-2.5 py-2 text-left border-b border-gray-100 w-20">일자</th>
                  <th className="px-2 py-2 text-center border-b border-gray-100">대상 인원</th>
                  {data.meal_order.map(k => (
                    <th key={k} className={`px-2 py-2 text-center border-b border-gray-100 ${MEAL_META[k]?.head}`}>
                      {MEAL_META[k]?.emoji} {MEAL_META[k]?.label}
                      <span className="block text-[9px] font-semibold text-gray-300">{data.meal_times[k]}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center border-b border-gray-100">계</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map(d => {
                  const dow = new Date(d.date).getDay()
                  const daySum = data.meal_order.reduce((a, k) => a + (d.meals[k] ?? 0), 0)
                  return (
                    <tr key={d.date} className={`text-sm ${d.date === today ? 'bg-amber-50/70' : dow === 0 ? 'bg-red-50/30' : dow === 6 ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-2.5 py-1.5 border-b border-gray-50 whitespace-nowrap">
                        <span className={`font-bold ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                          {Number(d.date.slice(8, 10))}일
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1">{DOW[dow]}</span>
                      </td>
                      <td className="px-2 py-1.5 border-b border-gray-50 text-center text-xs text-gray-500">{d.base}명</td>
                      {data.meal_order.map(k => {
                        const n = d.meals[k] ?? 0
                        const cut = d.base - n
                        return (
                          <td key={k} className="px-2 py-1.5 border-b border-gray-50 text-center">
                            <span className={`font-semibold ${cut > 0 ? 'text-gray-800' : 'text-gray-600'}`}>{n}</span>
                            {cut > 0 && <span className="ml-0.5 text-[10px] font-bold text-rose-500">−{cut}</span>}
                          </td>
                        )
                      })}
                      <td className="px-2 py-1.5 border-b border-gray-50 text-center font-bold text-gray-800">{daySum}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-orange-50/60 text-sm font-black text-gray-800">
                  <td className="px-2.5 py-2" colSpan={2}>합계</td>
                  {data.meal_order.map(k => <td key={k} className="px-2 py-2 text-center">{data.totals[k]?.toLocaleString()}</td>)}
                  <td className="px-2 py-2 text-center text-orange-600">{data.grand_total.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── 제외 내역 — 어떤 일정과 겹쳤는지 ── */}
          {data.exclusions.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <button onClick={() => setExclOpen(v => !v)} className="w-full flex items-center gap-2 text-left">
                <h2 className="text-sm font-bold text-gray-800">제외 내역 <span className="font-normal text-gray-400">— 어떤 일정과 겹쳐서 빠졌는지</span></h2>
                <span className="text-xs font-bold text-rose-500">{data.excluded_total}끼</span>
                {exclOpen ? <ChevronUp size={14} className="ml-auto text-gray-300" /> : <ChevronDown size={14} className="ml-auto text-gray-300" />}
              </button>
              {exclOpen && (
                <div className="mt-2 space-y-1.5">
                  {data.exclusions.map(e => (
                    <div key={e.date} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-gray-50/60 border border-gray-100">
                      <span className="shrink-0 text-xs font-bold text-gray-600 w-12 pt-0.5">{Number(e.date.slice(8, 10))}일 {DOW[new Date(e.date).getDay()]}</span>
                      <div className="flex-1 flex flex-wrap gap-1">
                        {e.items.map((it, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 rounded-lg px-1.5 py-0.5">
                            <span className={`text-[9px] font-bold px-1 py-px rounded ${CAT_CLS[it.category] ?? 'bg-gray-100 text-gray-500'}`}>{it.category}</span>
                            <b className="text-gray-700">{it.name}</b>
                            <span className="text-gray-400">{MEAL_META[it.meal]?.emoji} {MEAL_META[it.meal]?.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
            대상 인원 = 그날 재원 어르신(경관식·입소 전·퇴소 후 제외) · <span className="text-rose-500 font-bold">−N</span> = 일정 겹침으로 빠진 인원 ·
            부재 구간은 출발 시각부터 <b>실제 귀원 기록</b>(없으면 예정 귀원)까지 · 귀원 기록 없는 외출·외래는 드신 것으로, 외박은 출발일을 안 드신 것으로 계산합니다
          </p>
        </>
      )}
    </div>
  )
}
