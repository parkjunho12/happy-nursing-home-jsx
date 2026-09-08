import { useMemo, useState } from 'react'
import { ListChecks, Search, X } from 'lucide-react'
import type { ChecklistItem } from '@/utils/period'
import { dutyRoleOf, ROLE_TONE } from '@/utils/dutyRole'
import { useLtcStore } from '@/store/ltc'

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
 * ■ 왜 탭인가
 *
 *   여섯 주기를 한 번에 늘어놓으면 86줄이라 스크롤이 길다. 실제로는 '이번 달
 *   뭐 하지' 처럼 한 주기만 본다. 탭으로 나누면 그 주기만 한눈에 들어온다.
 *
 * ■ 왜 이름이 아니라 직종인가
 *
 *   담당자 이름을 적어 두면 그분이 퇴사하거나 담당이 바뀔 때마다 목록이 틀린
 *   정보가 된다. '이건 간호팀이 하는 일' 은 사람이 바뀌어도 그대로다.
 */

/** 화면에 낼 주기와 그 차례. 여기 없는 주기(일회성·입소 시 등)는 안 낸다 —
 *  그건 정기 업무가 아니라 그때그때 생기는 일이다. */
const PERIODS: { id: string; keys: string[]; label: string }[] = [
  { id: 'daily',   keys: ['daily'], label: '일일' },
  { id: 'weekly',  keys: ['weekly', 'weekly_dow'], label: '주별' },
  { id: 'monthly', keys: ['monthly', 'monthly_day', 'monthly_nth_dow'], label: '월별' },
  { id: 'quarter', keys: ['quarterly'], label: '분기별' },
  { id: 'half',    keys: ['half-yearly'], label: '반기별' },
  { id: 'yearly',  keys: ['yearly'], label: '연별' },
]

export default function RoutineReference({ items, onOpen }: {
  items: ChecklistItem[]
  onOpen?: (item: ChecklistItem) => void
}) {
  const [tab, setTab] = useState('daily')
  const [q, setQ] = useState('')
  const { staffList } = useLtcStore()

  /** 이름 → 직종. 직원 명단이 기준이라 담당이 바뀌어도 저절로 따라간다. */
  const staffPos = useMemo(() => {
    const m = new Map<string, string>()
    staffList.forEach(s => { if (s.name && s.position) m.set(s.name, s.position) })
    return m
  }, [staffList])

  /** 시설 정기 업무만 — 어르신·직원에게 붙은 것은 왼쪽 '내 업무' 쪽 이야기다. */
  const facility = useMemo(
    () => items.filter(i => !i.personId && i.active !== false)
      .map(i => ({ item: i, duty: dutyRoleOf(i, staffPos) })),
    [items, staffPos])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    PERIODS.forEach(p => { c[p.id] = facility.filter(f => p.keys.includes(f.item.frequency)).length })
    return c
  }, [facility])

  const shown = useMemo(() => {
    const p = PERIODS.find(x => x.id === tab)!
    const k = q.trim()
    return facility
      .filter(f => p.keys.includes(f.item.frequency))
      .filter(f => !k || f.item.title.includes(k) || f.duty.role.includes(k)
        || (f.item.description ?? '').includes(k))
      // 같은 직종끼리 모아 둔다 — '간호팀이 할 일' 을 한 번에 보게 된다
      .sort((a, b) => a.duty.role.localeCompare(b.duty.role, 'ko')
        || a.item.title.localeCompare(b.item.title, 'ko'))
  }, [facility, tab, q])

  // 탭에 나오는 것만 센다. facility 에는 일회성도 들어 있어 그대로 세면
  // 배지는 137인데 탭 합계는 86이라 서로 맞지 않는다.
  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0), [counts])

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <ListChecks size={15} className="text-gray-500 shrink-0" />
        <h2 className="text-sm font-bold text-gray-800 shrink-0">시설 정기 업무</h2>
        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{total}</span>
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="업무 · 직종"
            className="w-32 sm:w-40 pl-7 pr-6 py-1.5 rounded-lg border border-gray-200 text-[12px] focus:outline-none focus:border-gray-400" />
          {q && <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={11} /></button>}
        </div>
      </div>

      {/* 주기 탭 — 실제로는 한 주기만 본다 */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-50 overflow-x-auto">
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setTab(p.id)}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
              tab === p.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {p.label}
            <span className={`ml-1 text-[10px] ${tab === p.id ? 'text-gray-300' : 'text-gray-400'}`}>
              {counts[p.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <p className="px-4 py-1.5 text-[11px] text-gray-400 border-b border-gray-50">
        무엇을 해야 하는지 보는 목록입니다 — 완료 처리는 왼쪽 「내 업무」에서 합니다.
      </p>

      <div className="flex-1 overflow-y-auto max-h-[62vh]">
        {shown.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-12">
            {q ? '찾는 업무가 없습니다.' : '이 주기에 등록된 업무가 없습니다.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {shown.map(({ item: i, duty }) => (
              <li key={i.id}>
                <button onClick={() => onOpen?.(i)} disabled={!onOpen}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 disabled:hover:bg-transparent flex items-start gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-gray-800 leading-snug">{i.title}</span>
                    {i.description && (
                      <span className="block text-[11px] text-gray-400 truncate">{i.description}</span>
                    )}
                  </span>
                  {/* 짐작한 직종은 옅게 — 짐작을 사실처럼 보여주면 그걸 믿고 일한다 */}
                  <span className={`shrink-0 text-[11px] font-bold rounded px-1.5 py-0.5 ${ROLE_TONE[duty.role]} ${duty.guessed ? 'opacity-50' : ''}`}
                    title={duty.guessed ? '업무 이름으로 미룬 직종입니다 — 눌러서 담당을 정해주세요' : undefined}>
                    {duty.role}{duty.guessed && '?'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="px-4 py-1.5 text-[10px] text-gray-300 border-t border-gray-50">
        직종은 담당자의 직원 정보에서 가져옵니다 · <span className="opacity-60">옅은 표시(?)</span>는 업무 이름으로 미룬 것이라 확인이 필요합니다
      </p>
    </section>
  )
}
