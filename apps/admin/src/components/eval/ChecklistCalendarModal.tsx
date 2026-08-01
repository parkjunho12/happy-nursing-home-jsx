import { useMemo, useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { useLtcStore, type ChecklistItem } from '@/store/ltc'

/**
 * 체크리스트 달력 — '매월 언제부터 언제까지'가 한눈에.
 * 기간형(월별 기간 지정·매월 지정일)은 시작~종료 막대로,
 * 날짜형(매주 요일·매월 N째주·기한 1회)은 해당 날짜 칩으로 표시.
 */
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const BAR_COLORS = [
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
]

const clampDay = (y: number, m0: number, d: number) => Math.max(1, Math.min(d, new Date(y, m0 + 1, 0).getDate()))
const nthWeekday = (y: number, m0: number, wd: number, n: number) => {
  if (n >= 5) { // 마지막 주
    const last = new Date(y, m0 + 1, 0)
    const diff = (last.getDay() - wd + 7) % 7
    return last.getDate() - diff
  }
  const first = new Date(y, m0, 1)
  const off = (wd - first.getDay() + 7) % 7
  return 1 + off + (n - 1) * 7
}

export default function ChecklistCalendarModal({ onClose }: { onClose: () => void }) {
  const { checklists } = useLtcStore()
  const now = new Date()
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth()]) // [year, month0]
  const [y, m0] = ym
  const total = new Date(y, m0 + 1, 0).getDate()
  const todayD = now.getFullYear() === y && now.getMonth() === m0 ? now.getDate() : -1

  const move = (d: number) => {
    const nd = new Date(y, m0 + d, 1)
    setYm([nd.getFullYear(), nd.getMonth()])
  }

  // 이 달에 그릴 것들 — 기간 막대 / 날짜 칩
  const { bars, dots } = useMemo(() => {
    const items = checklists.filter(c => c.active && !c.personId)
    const bars: { item: ChecklistItem; start: number; end: number; color: string }[] = []
    const dots: Record<number, { item: ChecklistItem; color: string }[]> = {}
    let ci = 0
    const push = (day: number, item: ChecklistItem, color: string) => {
      (dots[day] ??= []).push({ item, color })
    }
    for (const c of items) {
      const color = BAR_COLORS[ci % BAR_COLORS.length]
      const f = c.frequency
      if (f === 'monthly' && (c.recurDay || c.recurDueDay)) {
        bars.push({ item: c, start: clampDay(y, m0, c.recurDay ?? 1), end: clampDay(y, m0, c.recurDueDay ?? total), color }); ci++
      } else if (f === 'monthly_day') {
        bars.push({ item: c, start: clampDay(y, m0, c.recurDay ?? 1), end: clampDay(y, m0, c.recurDueDay ?? c.recurDay ?? 1), color }); ci++
      } else if (f === 'monthly_nth_dow' && c.recurWeekday != null) {
        push(clampDay(y, m0, nthWeekday(y, m0, c.recurWeekday, c.recurWeekOfMonth ?? 1)), c, color); ci++
      } else if (f === 'weekly_dow' && c.recurWeekday != null) {
        for (let d = 1; d <= total; d++) if (new Date(y, m0, d).getDay() === c.recurWeekday) push(d, c, color)
        ci++
      } else if (f === 'one_time' && c.dueDate) {
        const dd = c.dueDate.slice(0, 10)
        if (dd.startsWith(`${y}-${String(m0 + 1).padStart(2, '0')}`)) { push(Number(dd.slice(8, 10)), c, color); ci++ }
      }
    }
    bars.sort((a, b) => a.start - b.start || a.end - b.end)
    return { bars, dots }
  }, [checklists, y, m0, total])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={17} className="text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800">체크리스트 달력</h2>
          <div className="flex items-center gap-1.5 mx-auto">
            <button onClick={() => move(-1)} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500">‹</button>
            <span className="text-sm font-bold text-gray-800 min-w-[92px] text-center">{y}년 {m0 + 1}월</span>
            <button onClick={() => move(1)} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500">›</button>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>

        {/* 기간 막대 — 매월 언제부터 언제까지 */}
        {bars.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {bars.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <p className="w-32 md:w-44 shrink-0 text-[11px] font-bold text-gray-700 truncate" title={b.item.title}>{b.item.title}</p>
                <div className="flex-1 relative h-6 bg-gray-50 rounded-lg overflow-hidden">
                  {/* 오늘 위치 세로선 */}
                  {todayD > 0 && <span className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: `${((todayD - 0.5) / total) * 100}%` }} />}
                  <span className={`absolute top-0.5 bottom-0.5 rounded-md border text-[10px] font-bold flex items-center justify-center px-1 ${b.color}`}
                    style={{ left: `${((b.start - 1) / total) * 100}%`, width: `${((b.end - b.start + 1) / total) * 100}%` }}>
                    {b.start}일 ~ {b.end}일
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 달력 그리드 — 날짜형 항목 */}
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
            {DOW.map((d, i) => (
              <div key={d} className={`py-1.5 text-center text-[11px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {[...Array(new Date(y, m0, 1).getDay()).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)].map((day, i) => (
              <div key={i} className={`min-h-[62px] border-b border-r border-gray-50 p-1 ${day === null ? 'bg-gray-50/40' : ''} ${day === todayD ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : ''}`}>
                {day !== null && (
                  <>
                    <p className={`text-[10px] font-bold ${i % 7 === 0 ? 'text-red-500' : i % 7 === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{day}</p>
                    {(dots[day] ?? []).slice(0, 3).map((x, j) => (
                      <p key={j} className={`text-[9px] leading-tight px-1 py-0.5 rounded border mb-0.5 truncate ${x.color}`} title={x.item.title}>{x.item.title}</p>
                    ))}
                    {(dots[day] ?? []).length > 3 && <p className="text-[9px] text-gray-400">+{dots[day].length - 3}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[10.5px] text-gray-400">
          막대 = 매월 기간이 정해진 업무(시작~종료) · <span className="text-red-400">│</span> 오늘 · 달력 칩 = 특정 날짜 업무(매주 요일·N째주·1회 기한)
        </p>
      </div>
    </div>
  )
}
