import { useEffect, useState } from 'react'
import { X, Inbox, Loader2, Check, Ban } from 'lucide-react'
import { leaveAPI, swapAPI, LEAVE_KIND_META, signatureUrl, type LeaveRequest, type SwapRequest } from '@/api/leaveClient'
import { ArrowLeftRight } from 'lucide-react'

const fmtD = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${w})`
}

/** 휴무 신청 승인함 — 연차·반차는 승인 즉시 그 달 근무표에 休·반이 적힌다 */
export default function LeaveInboxPanel({ onClose, onChanged }: {
  onClose: () => void
  onChanged: () => void      // 승인이 근무표를 바꾸므로 화면 재조회 필요
}) {
  const [rows, setRows] = useState<LeaveRequest[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      leaveAPI.list(undefined, 'pending').catch(() => [] as LeaveRequest[]),
      swapAPI.list('pending').catch(() => [] as SwapRequest[]),
    ]).then(([l, s]) => { setRows(l); setSwaps(s) }).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const decide = async (r: LeaveRequest, approve: boolean) => {
    let note: string | undefined
    if (!approve) {
      const t = prompt(`${r.staff_name} · ${fmtD(r.date)} ${r.kind} 반려 사유 (신청자에게 전달됩니다)`, '')
      if (t === null) return
      note = t.trim() || undefined
    }
    setBusy(r.id)
    try {
      const res = await leaveAPI.decide(r.id, approve, note)
      setTouched(true)
      if (approve && res.schedule_written) {
        // 근무표에 바로 적혔음을 알려준다 — 관리자가 또 손으로 적는 이중 작업 방지
        // (자동 생성 시에도 이 칸은 보존된다)
      }
      load()
    } catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '처리 실패') }
    finally { setBusy(null) }
  }

  const close = () => { if (touched) onChanged(); onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-emerald-600" />
            <h3 className="font-bold text-gray-900">휴무 신청 승인함</h3>
            {(rows.length + swaps.length) > 0 && <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{rows.length + swaps.length}건 대기</span>}
          </div>
          <button onClick={close} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-5 py-3">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
          ) : rows.length === 0 && swaps.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">대기 중인 신청이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map(r => (
                <li key={r.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">{r.staff_name}</span>
                    <span className="text-sm font-semibold text-gray-600">{fmtD(r.date)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${LEAVE_KIND_META[r.kind].cls}`}>{r.kind}</span>
                    {r.kind === '희망휴무' && r.use_annual && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200"
                        title="승인하면 이날이 연차(休)로 근무표에 들어가고, 연차 1일이 사용됩니다">연차반영</span>
                    )}
                    <div className="ml-auto flex gap-1.5">
                      <button onClick={() => decide(r, true)} disabled={busy === r.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">
                        {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} 승인
                      </button>
                      <button onClick={() => decide(r, false)} disabled={busy === r.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 text-xs font-bold disabled:opacity-50">
                        <Ban size={12} /> 반려
                      </button>
                    </div>
                  </div>
                  {r.reason && <p className="text-xs text-gray-500 mt-1.5">사유 · {r.reason}</p>}
                  {r.signature_url && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">서명</span>
                      <img src={signatureUrl(r.signature_url)!} alt={`${r.staff_name} 서명`}
                        className="h-10 rounded border border-gray-100 bg-white" />
                    </div>
                  )}
                  {(r.kind !== '희망휴무' || r.use_annual) && (
                    <p className="text-[11px] text-emerald-600 mt-1">승인하면 {r.date.slice(5, 7)}월 근무표에 休로 바로 적힙니다</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {swaps.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                <ArrowLeftRight size={12} className="text-sky-600" /> 근무 맞교대 <span className="font-normal text-gray-400">— 양측 서명 완료, 승인 시 근무표가 바로 바뀝니다</span>
              </p>
              <ul className="space-y-2">
                {swaps.map(r => (
                  <li key={r.id} className="rounded-xl border border-sky-100 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{r.requester_name} ↔ {r.partner_name}</span>
                      <span className="text-sm text-gray-600">{r.dates.map(fmtD).join(' ↔ ')}</span>
                      {r.shift_code && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-sky-50 text-sky-700 border-sky-200">{r.shift_code} 근무끼리</span>
                      )}
                      <div className="ml-auto flex gap-1.5">
                        <button onClick={async () => {
                          setBusy(r.id)
                          try { await swapAPI.decide(r.id, true); setTouched(true); load() }
                          catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
                          finally { setBusy(null) }
                        }} disabled={busy === r.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50">
                          <Check size={12} /> 승인·교환
                        </button>
                        <button onClick={async () => {
                          const t = prompt('반려 사유 (두 분에게 전달됩니다)', ''); if (t === null) return
                          setBusy(r.id)
                          try { await swapAPI.decide(r.id, false, t.trim() || undefined); setTouched(true); load() }
                          catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
                          finally { setBusy(null) }
                        }} disabled={busy === r.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 text-xs font-bold disabled:opacity-50">
                          <Ban size={12} /> 반려
                        </button>
                      </div>
                    </div>
                    {r.reason && <p className="text-xs text-gray-500 mt-1.5">사유 · {r.reason}</p>}
                    <div className="mt-1.5 flex items-center gap-3">
                      {r.requester_signature_url && (
                        <span className="flex items-center gap-1.5"><span className="text-[10px] text-gray-400">{r.requester_name}</span>
                          <img src={signatureUrl(r.requester_signature_url)!} alt="" className="h-9 rounded border border-gray-100 bg-white" /></span>
                      )}
                      {r.partner_signature_url && (
                        <span className="flex items-center gap-1.5"><span className="text-[10px] text-gray-400">{r.partner_name}</span>
                          <img src={signatureUrl(r.partner_signature_url)!} alt="" className="h-9 rounded border border-gray-100 bg-white" /></span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
