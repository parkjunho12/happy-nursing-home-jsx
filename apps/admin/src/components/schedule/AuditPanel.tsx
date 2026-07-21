import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Issue } from '@/utils/scheduleAudit'

/** 점검 패널 — 확정 전에 인원 구멍·시간 초과/미달·연속 근무를 자동으로 훑는다 */
export default function AuditPanel({ issues, danger, open, onToggle, minStaff, setMinStaff, onFocus }: {
  issues: Issue[]
  danger: number
  open: boolean
  onToggle: () => void
  minStaff: number
  setMinStaff: (n: number) => void
  onFocus: (f: { staffId?: string; day?: number }) => void
}) {
  return (
        <div className={`mb-3 rounded-2xl border ${danger > 0 ? 'border-red-200 bg-red-50/60' : issues.length > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
          <button onClick={() => onToggle()} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
            {issues.length === 0
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              : <AlertTriangle className={`w-4 h-4 shrink-0 ${danger > 0 ? 'text-red-600' : 'text-amber-600'}`} />}
            <span className="text-sm font-bold text-gray-800">
              {issues.length === 0 ? '점검 통과 — 확정해도 됩니다'
                : `점검 ${issues.length}건`}
            </span>
            {danger > 0 && <span className="text-[10px] font-extrabold bg-red-600 text-white px-1.5 py-0.5 rounded-full">위험 {danger}</span>}
            <label className="ml-auto text-[11px] text-gray-500 flex items-center gap-1" onClick={e => e.stopPropagation()}>
              하루 최소 인원
              <input type="number" min={0} value={minStaff} onChange={e => setMinStaff(Number(e.target.value) || 0)}
                className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center" />
            </label>
            <span className="text-[11px] text-gray-400">{open ? '접기 ▴' : '펼치기 ▾'}</span>
          </button>
          {open && issues.length > 0 && (
            <ul className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-1">
              {issues.map(i => (
                <li key={i.id}>
                  <button onClick={() => onFocus({ staffId: i.staffId, day: i.day })}
                    className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 bg-white/80 border hover:bg-white ${i.level === 'danger' ? 'border-red-200' : 'border-amber-200'}`}>
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${i.level === 'danger' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-gray-800">{i.title}</span>
                      <span className="block text-[11px] text-gray-500">{i.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
  )
}
