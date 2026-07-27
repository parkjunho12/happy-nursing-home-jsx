import { useEffect, useState } from 'react'
import { Banknote, Check, Loader2 } from 'lucide-react'
import { payslipAPI, payslipImageUrl, type Payslip } from '@/api/payslipClient'
import { signatureUrl } from '@/api/leaveClient'
import SignatureInput, { type SigValue } from './SignatureInput'

/**
 * 내 급여명세서 — 관리자가 올린 이 달 명세서를 확인하고 수령 서명한다.
 * 서명하면 끝 — 종이에 사인 받으러 다닐 필요가 없다.
 */
export default function PayslipCard({ month }: { month: string }) {
  const [slip, setSlip] = useState<Payslip | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [sig, setSig] = useState<SigValue>({ use_saved: false, signature: null, save: true, ok: false })
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(false)

  const load = () => {
    payslipAPI.mine(month).then(r => { setSlip(r); setLoaded(true) })
      .catch(() => { setSlip(null); setLoaded(true) })
  }
  useEffect(load, [month])

  // 이 달 명세서가 없으면 카드 자체를 숨긴다 — 빈 카드는 소음이다
  if (!loaded || !slip) return null

  const img = payslipImageUrl(slip.image_url)
  const [, m] = month.split('-').map(Number)

  const sign = async () => {
    if (!sig.ok) { alert('서명해주세요.'); return }
    if (!confirm(`${m}월 급여명세서를 확인했고 수령에 서명합니다.`)) return
    setBusy(true)
    try { await payslipAPI.sign(month, sig); load(); alert('서명했습니다. 수고하셨습니다!') }
    catch (e: any) { alert(e?.response?.data?.detail ?? '서명 실패') }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <Banknote size={18} className="text-amber-600" />
        <h2 className="text-lg font-bold text-gray-800">{m}월 급여명세서</h2>
        {slip.signed && (
          <span className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
            <Check size={15} /> 서명 완료
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {slip.signed
          ? `${slip.signed_at ? new Date(slip.signed_at).toLocaleDateString('ko-KR') : ''} 수령 확인하셨습니다.`
          : '명세서를 눌러 크게 확인한 뒤, 아래에 수령 서명을 해주세요.'}
      </p>

      {img && (
        <img src={img} alt={`${m}월 급여명세서`} onClick={() => setZoom(true)}
          className="w-full max-h-72 object-contain bg-gray-50 rounded-xl border border-gray-100 cursor-zoom-in" />
      )}
      {zoom && img && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 cursor-zoom-out" onClick={() => setZoom(false)}>
          <img src={img} alt="급여명세서 확대" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}

      {slip.signed ? (
        slip.signature_url && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">내 서명</span>
            <img src={signatureUrl(slip.signature_url)!} alt="서명" className="h-10 bg-white rounded border border-gray-100" />
          </div>
        )
      ) : (
        <div className="mt-3">
          <SignatureInput label="수령 확인용" onChange={setSig} />
          <button onClick={sign} disabled={busy || !sig.ok}
            className="mt-2 w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-base font-bold disabled:opacity-40">
            {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : '확인했습니다 — 수령 서명'}
          </button>
        </div>
      )}
    </div>
  )
}
