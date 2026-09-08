import { useMemo, useState } from 'react'
import { ListChecks, Search, X } from 'lucide-react'
import type { ChecklistItem } from '@/utils/period'

/**
 * 시설 정기 업무 — '우리가 무엇을 해야 하는가' 를 주기별로 훑는 목록.
 *
 * ■ 왜 체크박스가 없는가
 *
 *   예전에는 주기가 돌 때마다 체크할 항목이 자동으로 쌓였다. 그런데 이건
 *   '이번 주기에 누가 해야 할 일' 이라기보다 '우리 시설이 이런 것들을 한다'
 *   는 목록에 가깝다. 자동으로 쌓이면 아무도 안 지운 항목이 계속 밀려
 *   정작 '남은 일' 이 무엇인지 알 수 없게 된다.
 *
 *   그래서 여기는 보기 전용이다. 실제로 체크하는 것은 왼쪽 '내 업무' 에서만
 *   한다. 항목 자체를 고치려면 눌러서 상세를 연다.
 *
 * ■ 왜 주기 순서를 정해 두는가
 *
 *   일일 → 주별 → 월별 → 분기 → 반기 → 연별. 자주 하는 것부터 본다.
 *   가나다순이나 등록순으로 두면 '오늘 뭘 봐야 하지' 를 찾는 데 시간이 든다.
 */

/** 화면에 낼 주기와 그 차례. 여기 없는 주기(일회성·입소 시 등)는 이 목록에 안 낸다 —
 *  그건 정기 업무가 아니라 그때그때 생기는 일이다. */
const PERIODS: { keys: string[]; label: string; tone: string }[] = [
  { keys: ['daily'], label: '일일', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { keys: ['weekly', 'weekly_dow'], label: '주별', tone: 'bg-green-50 text-green-700 border-green-200' },
  { keys: ['monthly', 'monthly_day', 'monthly_nth_dow'], label: '월별', tone: 'bg-purple-50 text-purple-700 border-purple-200' },
  { keys: ['quarterly'], label: '분기별', tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { keys: ['half-yearly'], label: '반기별', tone: 'bg-pink-50 text-pink-700 border-pink-200' },
  { keys: ['yearly'], label: '연별', tone: 'bg-red-50 text-red-700 border-red-200' },
]

export default function RoutineReference({ items, onOpen }: {
  items: ChecklistItem[]
  onOpen?: (item: ChecklistItem) => void
}) {
  const [q, setQ] = useState('')

  /** 시설 정기 업무만 — 어르신·직원에게 붙은 것은 왼쪽 '내 업무' 쪽 이야기다. */
  const facility = useMemo(
    () => items.filter(i => !i.personId && i.active !== false),
    [items])

  const groups = useMemo(() => {
    const k = q.trim()
    const match = (i: ChecklistItem) =>
      !k || i.title.includes(k) || (i.assignee ?? '').includes(k) || (i.description ?? '').includes(k)
    return PERIODS.map(p => ({
      ...p,
      list: facility
        .filter(i => p.keys.includes(i.frequency))
        .filter(match)
        .sort((a, b) => (a.assignee ?? '힣').localeCompare(b.assignee ?? '힣', 'ko')
          || a.title.localeCompare(b.title, 'ko')),
    })).filter(g => g.list.length > 0)
  }, [facility, q])

  const total = groups.reduce((n, g) => n + g.list.length, 0)

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <ListChecks size={15} className="text-gray-500 shrink-0" />
        <h2 className="text-sm font-bold text-gray-800 shrink-0">시설 정기 업무</h2>
        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{total}</span>
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="업무 · 담당자"
            className="w-36 sm:w-44 pl-7 pr-6 py-1.5 rounded-lg border border-gray-200 text-[12px] focus:outline-none focus:border-gray-400" />
          {q && <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={11} /></button>}
        </div>
      </div>

      <p className="px-4 py-1.5 text-[11px] text-gray-400 border-b border-gray-50">
        무엇을 해야 하는지 보는 목록입니다 — 완료 처리는 왼쪽 「내 업무」에서 합니다.
      </p>

      <div className="flex-1 overflow-y-auto max-h-[70vh]">
        {groups.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-12">
            {q ? '찾는 업무가 없습니다.' : '등록된 정기 업무가 없습니다.'}
          </p>
        ) : groups.map(g => (
          <div key={g.label}>
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 py-1.5 border-b border-gray-50 flex items-center gap-2">
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded border ${g.tone}`}>{g.label}</span>
              <span className="text-[11px] text-gray-400">{g.list.length}건</span>
            </div>
            <ul className="divide-y divide-gray-50">
              {g.list.map(i => (
                <li key={i.id}>
                  <button onClick={() => onOpen?.(i)} disabled={!onOpen}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 disabled:hover:bg-transparent flex items-start gap-2">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-gray-800 leading-snug">{i.title}</span>
                      {i.description && (
                        <span className="block text-[11px] text-gray-400 truncate">{i.description}</span>
                      )}
                    </span>
                    {i.assignee && (
                      <span className="shrink-0 text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                        {i.assignee}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
