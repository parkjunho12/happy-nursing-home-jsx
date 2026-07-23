import { useEffect, useState } from 'react'
import { CalendarHeart, Check, Ban, Loader2, X } from 'lucide-react'
import { visitAPI, type VisitReservation } from '@/api/visitClient'

const fmtD = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${w})`
}

/**
 * 면회 예약 승인함 — 보호자 신청을 확인하고 승인하면
 * 캘린더에 '면회' 일정이 자동 등록되고 보호자에게 푸시가 간다.
 * 전화 응대를 줄이는 게 목적이라, 처리 자체를 빠르게 만든다.
 */
export default function VisitInboxPanel({ onClose, onDecided }: { onClose: () => void; onDecided: () => void }) {
  const [rows, setRows] = useState<VisitReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    visitAPI.list('pending').then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const decide = async (r: VisitReservation, approve: boolean) => {
    let note: string | undefined
    if (!approve) {
      const t = prompt(`${r.guardian_name} 님 ${fmtD(r.date)} ${r.time} 반려 사유 (보호자에게 전달됩니다)`, '')
      if (t === null) return
      note = t.trim() || undefined
    }
    setBusy(r.id)
    try { await visitAPI.decide(r.id, approve, note); onDecided(); load() }
    catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
    finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start md:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <CalendarHeart size={17} className="text-yellow-600" />
          <h2 className="text-base font-bold text-gray-800">면회 예약 대기</h2>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-3">승인하면 캘린더에 면회 일정이 자동 등록되고, 보호자에게 확정 알림이 갑니다.</p>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">대기 중인 면회 예약이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map(r => (
              <li key={r.id} className="rounded-xl border border-yellow-100 bg-yellow-50/40 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-800">{fmtD(r.date)} {r.time}</span>
                  <span className="text-sm text-gray-600">{r.resident_name} 어르신</span>
                  <span className="text-xs text-gray-500">
                    {r.guardian_name}{r.relation ? `(${r.relation})` : ''} · {r.visitors}명
                  </span>
                  <div className="ml-auto flex gap-1.5">
                    <button onClick={() => decide(r, true)} disabled={busy === r.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold disabled:opacity-50">
                      {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} 승인
                    </button>
                    <button onClick={() => decide(r, false)} disabled={busy === r.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 text-xs font-bold disabled:opacity-50">
                      <Ban size={12} /> 반려
                    </button>
                  </div>
                </div>
                {r.memo && <p className="text-xs text-gray-500 mt-1.5">보호자 메모 · {r.memo}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
