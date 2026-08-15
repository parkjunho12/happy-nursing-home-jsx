import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Users, AlertTriangle, ChevronDown } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { checkDone, daysLeftOf } from '@/utils/checklistStatus'
import { FREQUENCY_LABELS, todayKST, type ChecklistItem } from '@/utils/period'

const FREQUENT = ['daily', 'weekly', 'weekly_dow']  // 일·주간
const HORIZONS = [15, 30, 60, 90]

type Entry = { item: ChecklistItem; title: string; person: string; freq: string; late: boolean; daysLeft: number | null }
type Row = { key: string; name: string; overdue: number; soon: number; items: Entry[] }

export default function StaffWorkloadPage() {
  const { checklists, loadAll } = useLtcStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState<string | null>(null)
  const [horizon, setHorizon] = useState(30)
  const [showFrequent, setShowFrequent] = useState(true)
  const today = todayKST()

  useEffect(() => { loadAll() }, [loadAll])

  const rows = useMemo<Row[]>(() => {
    const map: Record<string, Row> = {}
    checklists.filter(c => c.active).forEach(c => {
      if (!showFrequent && FREQUENT.includes(c.frequency)) return
      if (checkDone(c)) return
      const dl = daysLeftOf(c, today)
      // 지연(dl<0) 또는 앞으로 horizon일 이내(dl<=horizon). 기한없음(dl=null, 이벤트성)은 항상 포함
      if (dl != null && dl > horizon) return

      // 담당자 식별: 이름(assignee) 우선 → 예전(id 없음)·신규 데이터를 한 사람으로 병합
      const nm = (c.assignee || '').trim()
      const key = nm || c.assigned_user_id || '__unassigned__'
      const name = nm || '미배정'
      const late = dl != null && dl < 0
      const r = (map[key] ||= { key, name, overdue: 0, soon: 0, items: [] })
      if (late) r.overdue++; else r.soon++
      r.items.push({
        item: c, title: c.title, person: c.personName || '시설 공통',
        freq: FREQUENCY_LABELS[c.frequency as any] ?? c.frequency, late, daysLeft: dl,
      })
    })
    const k = (dl: number | null) => (dl == null ? 99999 : dl)
    Object.values(map).forEach(r => r.items.sort((a, b) => k(a.daysLeft) - k(b.daysLeft)))
    return Object.values(map).sort((a, b) => (b.overdue - a.overdue) || (b.soon - a.soon))
  }, [checklists, today, horizon, showFrequent])

  const totals = rows.reduce((t, r) => ({ people: t.people + 1, overdue: t.overdue + r.overdue, soon: t.soon + r.soon }),
    { people: 0, overdue: 0, soon: 0 })

  // 전체/담당자별 완료 진행률 (현재 주기 기준, 옵션 스코프 반영)
  const scopeItems = useMemo(
    () => checklists.filter(c => c.active && (showFrequent || !FREQUENT.includes(c.frequency))),
    [checklists, showFrequent])
  const perAssignee = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {}
    scopeItems.forEach(c => {
      const key = (c.assignee || '').trim() || c.assigned_user_id || '__unassigned__'
      const r = (m[key] ||= { total: 0, done: 0 })
      r.total++; if (checkDone(c)) r.done++
    })
    return m
  }, [scopeItems])
  const overall = useMemo(
    () => scopeItems.reduce((t, c) => ({ total: t.total + 1, done: t.done + (checkDone(c) ? 1 : 0) }), { total: 0, done: 0 }),
    [scopeItems])
  const overallPct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0

  const dueLabel = (dl: number | null) =>
    dl == null ? '기한 없음' : dl < 0 ? `${Math.abs(dl)}일 지남` : dl === 0 ? '오늘 마감' : `D-${dl}`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">담당자별 임박·지연 현황</h1>
        <button onClick={() => loadAll()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <RotateCcw size={14} /> 새로고침
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">이미 <b className="text-red-600">지연</b>됐거나 <b>앞으로 {horizon}일 이내(D-{horizon})</b> 마감인 미완료 항목을 담당자별로 보여줍니다.</p>

      {/* 옵션 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
          {HORIZONS.map(h => (
            <button key={h} onClick={() => { setHorizon(h); setOpen(null) }}
              className={`px-3 py-1.5 text-sm font-semibold transition-colors ${horizon === h ? 'bg-primary-orange text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              D-{h}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto cursor-pointer">
          <input type="checkbox" checked={showFrequent} onChange={e => setShowFrequent(e.target.checked)} className="w-4 h-4 accent-orange-500" />
          일·주간도 포함
        </label>
      </div>

      {/* 전체 진행률 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900">전체 진행률</span>
          <span className="text-sm text-gray-500 tabular-nums"><b className="text-green-600">{overall.done}</b> / {overall.total}개 완료 · {overallPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Kpi label="지연" value={`${totals.overdue}`} color={totals.overdue > 0 ? 'text-red-600' : 'text-gray-900'} icon={<AlertTriangle size={16} className={totals.overdue > 0 ? 'text-red-400' : 'text-gray-300'} />} />
        <Kpi label={`임박 (D-${horizon} 이내)`} value={`${totals.soon}`} color={totals.soon > 0 ? 'text-orange-600' : 'text-gray-900'} />
        <Kpi label="해당 담당자" value={`${totals.people}명`} icon={<Users size={16} className="text-gray-400" />} />
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm">지연되거나 D-{horizon} 이내 마감인 미완료 항목이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const isOpen = open === r.key
            return (
              <div key={r.key} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : r.key)} className="w-full text-left p-4 hover:bg-gray-50/60 transition-colors flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-orange-50 text-primary-orange flex items-center justify-center font-bold shrink-0">{r.name.slice(0, 1)}</div>
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const at = perAssignee[r.key]; const pct = at && at.total ? Math.round((at.done / at.total) * 100) : 0
                      return (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-gray-900 truncate">{r.name}</span>
                            <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{at?.done ?? 0}/{at?.total ?? 0} · {pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden my-1.5">
                            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-orange-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </>
                      )
                    })()}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.overdue > 0 && <span className="text-[11px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-0.5">지연 {r.overdue}</span>}
                      {r.soon > 0 && <span className="text-[11px] font-bold text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">임박 {r.soon}</span>}
                    </div>
                  </div>
                  <ChevronDown size={18} className={`text-gray-300 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {r.items.map((e, i) => (
                      <div key={e.item.id + '-' + i} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${e.late ? 'bg-red-500' : 'bg-orange-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                          <p className="text-[11px] text-gray-400">{e.person} · {e.freq}</p>
                        </div>
                        <span className={`text-[11px] font-bold shrink-0 ${e.late ? 'text-red-600' : e.daysLeft === 0 ? 'text-red-500' : 'text-orange-600'}`}>{dueLabel(e.daysLeft)}</span>
                      </div>
                    ))}
                    <div className="px-4 py-2.5 bg-gray-50/50">
                      <button onClick={() => navigate('/eval/checklist')} className="text-xs font-semibold text-primary-orange hover:underline">체크리스트로 이동 →</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color = 'text-gray-900', icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">{icon}<p className="text-xs text-gray-500">{label}</p></div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
