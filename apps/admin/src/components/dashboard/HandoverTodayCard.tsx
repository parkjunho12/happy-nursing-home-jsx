import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, AlertTriangle, ChevronRight } from 'lucide-react'
import { handoverAPI, type HandoverRecord } from '@/api/handoverClient'

/** KST 기준 YYYY-MM-DD */
const kstDay = (d: Date | string) =>
  new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

const hhmm = (iso?: string | null) => {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/**
 * 오늘 올라온 인수인계 AI 리포트 위젯.
 * - 오늘자 업로드가 없거나 열람 권한이 없으면 아무것도 렌더하지 않는다(위젯 자체가 숨김).
 */
export default function HandoverTodayCard() {
  const navigate = useNavigate()
  const [rec, setRec] = useState<HandoverRecord | null>(null)

  useEffect(() => {
    let alive = true
    handoverAPI.history()
      .then(list => {
        if (!alive) return
        const today = kstDay(new Date())
        const mine = (list || []).find(r => r.created_at && kstDay(r.created_at) === today)
        setRec(mine ?? null)
      })
      .catch(() => { if (alive) setRec(null) })   // 403(권한없음) 포함 → 숨김
    return () => { alive = false }
  }, [])

  if (!rec) return null

  const rep = rec.report ?? ({} as any)
  const alerts = rep.alerts ?? []
  const points: string[] = (rep.key_points ?? []).slice(0, 2)

  return (
    <section className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
      <button onClick={() => navigate(`/handover/${rec.id}`)} className="w-full text-left">
        <div className="flex items-center justify-between px-4 py-3 border-b border-violet-50 bg-violet-50/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
              <Sparkles size={14} className="text-violet-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">오늘 인수인계</h2>
            <span className="text-[11px] text-gray-400">{hhmm(rec.created_at)} · {rec.author ?? '-'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {alerts.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> 주의 {alerts.length}
              </span>
            )}
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="text-[14px] text-gray-700 leading-relaxed line-clamp-2">
            {rep.summary || '요약이 없습니다.'}
          </p>

          {alerts.length > 0 && (
            <div className="mt-2.5 space-y-1">
              {alerts.slice(0, 2).map((a: any, i: number) => (
                <p key={i} className="text-[13px] text-red-600 flex gap-1.5">
                  <span className="shrink-0">•</span>
                  <span className="truncate"><b className="font-bold">{a.resident || '—'}</b> {a.issue}</span>
                </p>
              ))}
            </div>
          )}

          {alerts.length === 0 && points.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {points.map((k, i) => (
                <li key={i} className="text-[13px] text-gray-500 flex gap-1.5">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span className="truncate">{k}</span>
                </li>
              ))}
            </ul>
          )}

          <span className="inline-block mt-2.5 text-[11px] font-bold text-violet-600">자세히 보기 →</span>
        </div>
      </button>
    </section>
  )
}
