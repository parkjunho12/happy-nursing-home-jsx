import { useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, Check, Loader2, Trash2, Upload } from 'lucide-react'
import { payslipAPI, payslipImageUrl, type Payslip } from '@/api/payslipClient'
import { useLtcStore } from '@/store/ltc'

/**
 * 급여명세서 관리 (ADMIN·시설장) — 사진 찍어 직원별로 올린다.
 * 올리는 즉시 그 직원에게 푸시가 가고, 직원은 내 근무표에서 확인·서명한다.
 * 서명 안 한 사람이 한눈에 보이므로 수령 확인을 쫓아다닐 필요가 없다.
 */
export default function PayslipManager() {
  const { staffList, loaded, loadAll } = useLtcStore()
  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [rows, setRows] = useState<Payslip[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<string>('')

  const load = () => { payslipAPI.list(ym).then(setRows).catch(() => setRows([])) }
  useEffect(load, [ym])

  const moveYm = (d: number) => {
    const [y, m] = ym.split('-').map(Number)
    const nd = new Date(y, m - 1 + d, 1)
    setYm(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`)
  }

  const byStaff = useMemo(() => new Map(rows.map(r => [r.staff_id, r])), [rows])
  const active = staffList.filter(s => s.status === 'active')
  const signedCount = rows.filter(r => r.signed).length

  const pick = (staffId: string) => { targetRef.current = staffId; fileRef.current?.click() }
  const onFile = async (f: File | null) => {
    if (!f || !targetRef.current) return
    const sid = targetRef.current
    setBusy(sid)
    try { await payslipAPI.upload(ym, sid, f); load() }
    catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '업로드 실패') }
    finally { setBusy(null); targetRef.current = '' }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { onFile(e.target.files?.[0] ?? null); e.target.value = '' }} />

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="inline-flex items-center h-9 border border-gray-200 rounded-xl bg-white overflow-hidden">
          <button onClick={() => moveYm(-1)} className="h-full px-2.5 text-gray-400 hover:text-gray-700">‹</button>
          <span className="px-2 text-sm font-bold text-gray-700 min-w-[7rem] text-center">{Number(ym.slice(0, 4))}년 {Number(ym.slice(5, 7))}월</span>
          <button onClick={() => moveYm(1)} className="h-full px-2.5 text-gray-400 hover:text-gray-700">›</button>
        </div>
        <span className="text-xs text-gray-400">
          업로드 {rows.length}/{active.length}명 · 서명 완료 <b className={signedCount < rows.length ? 'text-amber-600' : 'text-emerald-600'}>{signedCount}/{rows.length}</b>
        </span>
        <span className="text-[11px] text-gray-400 ml-auto">올리면 그 직원에게 알림이 가고, 내 근무표에서 확인·서명합니다</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {active.map(s => {
          const p = byStaff.get(s.id)
          return (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-24 shrink-0 text-sm font-bold text-gray-800">{s.name}</span>
              <span className="w-24 shrink-0 text-xs text-gray-400">{s.position ?? '-'}</span>
              {p ? (
                <>
                  <a href={payslipImageUrl(p.image_url)!} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={payslipImageUrl(p.image_url)!} alt="명세서" className="h-10 w-14 object-cover rounded-lg border border-gray-100" />
                  </a>
                  {p.signed
                    ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><Check size={13} /> 서명 완료 {p.signed_at ? new Date(p.signed_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : ''}</span>
                    : <span className="text-xs font-bold text-amber-600">서명 대기</span>}
                  <div className="ml-auto flex gap-1.5">
                    <button onClick={() => pick(s.id)} disabled={busy === s.id}
                      className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50">
                      {busy === s.id ? <Loader2 size={12} className="animate-spin" /> : '다시 올리기'}
                    </button>
                    <button onClick={async () => { if (confirm(`${s.name} 명세서를 삭제할까요?`)) { await payslipAPI.remove(p.id); load() } }}
                      className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                  </div>
                </>
              ) : (
                <button onClick={() => pick(s.id)} disabled={busy === s.id}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">
                  {busy === s.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} 명세서 올리기
                </button>
              )}
            </div>
          )
        })}
        {active.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10"><Banknote size={16} className="inline mr-1" />재직 직원이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
