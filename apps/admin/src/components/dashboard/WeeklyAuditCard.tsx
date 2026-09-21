import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, ChevronRight } from 'lucide-react'
import { careLogAuditAPI, type WeeklyAuditLatest } from '@/api/careLogAuditClient'
import { formatRange } from '@/utils/weeklyAudit'

/**
 * 최신 주간 기록지 점검 결과 위젯.
 * - 점검 결과가 없거나 권한이 없으면(403) 아무것도 렌더하지 않는다(위젯 자체가 숨김).
 */
export default function WeeklyAuditCard() {
  const navigate = useNavigate()
  const [data, setData] = useState<WeeklyAuditLatest | null>(null)

  useEffect(() => {
    let alive = true
    careLogAuditAPI.latest()
      .then(res => { if (alive) setData(res) })
      .catch(() => { if (alive) setData(null) })   // 403(권한없음) 포함 → 숨김
    return () => { alive = false }
  }, [])

  if (!data) return null

  return (
    <section className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
      <button onClick={() => navigate('/eval/weekly-audit')} className="w-full text-left">
        <div className="flex items-center justify-between px-4 py-3 border-b border-orange-50 bg-orange-50/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
              <ClipboardCheck size={14} className="text-orange-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">주간 기록지 점검</h2>
            <span className="text-[11px] text-gray-400">{formatRange(data.week_start, data.week_end)}</span>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </div>

        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-2 mb-2.5">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-800 text-white">총 {data.total}건</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">오류 {data.by_kind?.error ?? 0}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">공란 {data.by_kind?.blank ?? 0}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">확인 {data.by_kind?.check ?? 0}</span>
          </div>

          {(data.top_staff ?? []).length > 0 && (
            <ul className="space-y-1">
              {data.top_staff.slice(0, 3).map((s, i) => (
                <li key={s.staff} className="text-[13px] text-gray-600 flex gap-1.5">
                  <span className="text-orange-400 shrink-0">{i + 1}.</span>
                  <span className="truncate"><b className="font-bold text-gray-800">{s.staff}</b> {s.total}</span>
                </li>
              ))}
            </ul>
          )}

          <span className="inline-block mt-2.5 text-[11px] font-bold text-orange-600">자세히 보기 →</span>
        </div>
      </button>
    </section>
  )
}
