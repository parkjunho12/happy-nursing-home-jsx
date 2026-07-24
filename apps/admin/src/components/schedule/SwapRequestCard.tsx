import { useEffect, useState } from 'react'
import { ArrowLeftRight, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { swapAPI, SWAP_STATUS_META, type SwapRequest } from '@/api/leaveClient'
import SignatureInput, { type SigValue } from './SignatureInput'

const fmtD = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${w})`
}

/** 근무 코드별 색 — 근무표와 같은 인상을 주도록 */
const CODE_CLS: Record<string, string> = {
  D: 'bg-sky-100 text-sky-800 border-sky-200',
  N: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  M: 'bg-amber-100 text-amber-800 border-amber-200',
}
const codeCls = (c: string) => CODE_CLS[c] ?? 'bg-gray-100 text-gray-700 border-gray-200'

/**
 * 근무 맞교대 — 동료와 합의해 근무를 바꾼다.
 *
 * 날짜를 손으로 적게 하면 근무표에 없는 날을 적는 실수가 나온다.
 * 그래서 저장된 근무표의 '실제 근무'만 골라 담게 하고,
 * 같은 근무(D↔D, N↔N)끼리만 바꿀 수 있게 화면에서부터 걸러준다.
 * 말로만 합의하면 나중에 "그런 적 없다"가 되므로 양쪽 다 서명을 남기고,
 * 관리자 승인이 나면 근무표가 자동으로 바뀐다.
 */
export default function SwapRequestCard({ month: monthProp }: { month?: string } = {}) {
  // 바꿀 수 있는 상대 = 같은 직종의 재직자만 (서버가 거른 목록)
  const [partners, setPartners] = useState<{ id: string; name: string; position?: string | null }[]>([])
  const [myPosition, setMyPosition] = useState<string | null>(null)
  useEffect(() => {
    swapAPI.partners()
      .then(r => { setPartners(r.partners); setMyPosition(r.my_position) })
      .catch(() => {})
  }, [])

  const [mine, setMine] = useState<SwapRequest[]>([])
  const [partner, setPartner] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(monthProp ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  useEffect(() => { if (monthProp) setMonth(monthProp) }, [monthProp])
  const [shifts, setShifts] = useState<{ saved: boolean; mine: Record<string, string>; partner: Record<string, string> } | null>(null)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [myDate, setMyDate] = useState('')
  const [theirDate, setTheirDate] = useState('')
  const [reason, setReason] = useState('')
  const [sig, setSig] = useState<SigValue>({ use_saved: false, signature: null, save: true, ok: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // 동의 서명 모달
  const [consentTarget, setConsentTarget] = useState<SwapRequest | null>(null)
  const [consentSig, setConsentSig] = useState<SigValue>({ use_saved: false, signature: null, save: true, ok: false })

  const load = () => { swapAPI.mine().then(setMine).catch(() => {}) }
  useEffect(load, [])

  // 상대·달이 정해지면 실제 근무표에서 두 사람의 근무를 가져온다
  useEffect(() => {
    if (!partner) { setShifts(null); return }
    let dead = false
    setLoadingShifts(true); setMyDate(''); setTheirDate('')
    swapAPI.shifts(partner, month)
      .then(r => { if (!dead) setShifts(r) })
      .catch(() => { if (!dead) setShifts(null) })
      .finally(() => { if (!dead) setLoadingShifts(false) })
    return () => { dead = true }
  }, [partner, month])

  const moveMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const myCode = myDate && shifts ? shifts.mine[myDate] : null
  const partnerName = partners.find(s => s.id === partner)?.name ?? '상대'

  const submit = async () => {
    if (!partner) { setErr('바꿀 상대를 선택해주세요.'); return }
    if (!myDate) { setErr('내 근무를 골라주세요.'); return }
    if (!theirDate) { setErr(`${partnerName} 선생님의 근무를 골라주세요.`); return }
    if (!sig.ok) { setErr('서명이 필요합니다.'); return }
    setBusy(true); setErr('')
    try {
      await swapAPI.create(partner, myDate, theirDate, reason || undefined, sig)
      setPartner(''); setMyDate(''); setTheirDate(''); setReason(''); setShifts(null)
      load()
      alert('요청했습니다. 상대 선생님이 동의하면 관리자 승인으로 넘어갑니다.')
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '요청 실패') }
    finally { setBusy(false) }
  }

  const doConsent = async (agree: boolean) => {
    if (!consentTarget) return
    if (agree && !consentSig.ok) { alert('동의하려면 서명해주세요.'); return }
    setBusy(true)
    try {
      await swapAPI.consent(consentTarget.id, agree, agree ? consentSig : undefined)
      setConsentTarget(null); load()
    } catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
    finally { setBusy(false) }
  }

  const incoming = mine.filter(r => r.i_am === 'partner' && r.status === 'partner_wait')
  // 지난달 교대 요청은 이력에서 자동으로 사라진다 — 쌓이면 화면만 길어지므로
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const others = mine
    .filter(r => !(r.i_am === 'partner' && r.status === 'partner_wait'))
    .filter(r => (r.dates ?? []).some(d => d >= monthStart))
    .slice(0, 6)
  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl'

  /** 근무 칩 목록 — 고를 수 있는 것만 진하게 */
  const ShiftPicker = ({ items, value, onPick, matchCode }: {
    items: Record<string, string>; value: string
    onPick: (d: string) => void; matchCode?: string | null
  }) => {
    const entries = Object.entries(items)
    if (entries.length === 0) return <p className="text-xs text-gray-400 py-1.5">이 달 근무표에 근무가 없습니다.</p>
    return (
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([d, code]) => {
          const disabled = !!matchCode && code !== matchCode
          const on = value === d
          return (
            <button key={d} onClick={() => !disabled && onPick(on ? '' : d)} disabled={disabled}
              title={disabled ? `${code} 근무 — 내 ${matchCode} 근무와는 바꿀 수 없어요` : undefined}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all
                ${on ? 'ring-2 ring-sky-400 ' + codeCls(code)
                  : disabled ? 'opacity-30 bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                  : codeCls(code) + ' hover:ring-1 hover:ring-gray-300'}`}>
              {fmtD(d)} <b>{code}</b>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <ArrowLeftRight size={16} className="text-sky-600" />
        <h2 className="text-base font-bold text-gray-800">근무 바꾸기 (맞교대)</h2>
        {incoming.length > 0 && (
          <span className="text-[10px] font-extrabold bg-sky-500 text-white rounded-full px-1.5 py-0.5">동의 요청 {incoming.length}</span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        같은 직종·같은 근무끼리만 바꿀 수 있어요 (D↔D · N↔N) — 두 분 다 서명하고 관리자가 승인하면 근무표가 바뀝니다.
      </p>

      {/* 나에게 온 동의 요청 — 가장 위 (행동이 필요한 것부터) */}
      {incoming.map(r => (
        <div key={r.id} className="mb-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
          <p className="text-sm text-gray-700">
            <b>{r.requester_name}</b> 선생님 요청 —
            {r.shift_code && <span className={`mx-1 text-[11px] font-bold px-1.5 py-0.5 rounded border ${codeCls(r.shift_code)}`}>{r.shift_code} 근무</span>}
            <b>{fmtD(r.dates[0])}</b>(그분) ↔ <b>{r.dates[1] ? fmtD(r.dates[1]) : ''}</b>(나)
          </p>
          {r.reason && <p className="text-xs text-gray-500 mt-1">사유 · {r.reason}</p>}
          {consentTarget?.id === r.id ? (
            <div className="mt-2">
              <SignatureInput label="동의 확인용" onChange={setConsentSig} />
              <div className="flex gap-2 mt-2">
                <button onClick={() => doConsent(true)} disabled={busy || !consentSig.ok}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:opacity-40">동의하고 서명 제출</button>
                <button onClick={() => setConsentTarget(null)} className="px-4 rounded-xl border border-gray-200 text-sm text-gray-500">취소</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mt-2">
              <button onClick={() => setConsentTarget(r)}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold">동의 (서명)</button>
              <button onClick={() => { setConsentTarget(r); doConsent(false) }} disabled={busy}
                className="px-4 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-red-500">거절</button>
            </div>
          )}
        </div>
      ))}

      {/* 신청 폼 — ① 상대 ② 내 근무 ③ 상대 근무 ④ 서명 */}
      <div className="space-y-2.5">
        <select value={partner} onChange={e => setPartner(e.target.value)} className={inp}>
          <option value="">① 바꿀 상대 선생님 선택{myPosition ? ` — 같은 직종(${myPosition})만` : ''}</option>
          {partners.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.position ? ` (${s.position})` : ''}</option>
          ))}
        </select>
        {partners.length === 0 && (
          <p className="text-xs text-gray-400">같은 직종의 다른 선생님이 없어 맞교대를 신청할 수 없습니다.</p>
        )}

        {partner && (
          <>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500"><ChevronLeft size={14} /></button>
              <span className="text-sm font-bold text-gray-700">{Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월</span>
              <button onClick={() => moveMonth(1)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500"><ChevronRight size={14} /></button>
            </div>

            {loadingShifts ? (
              <p className="text-xs text-gray-400 text-center py-2"><Loader2 size={13} className="animate-spin inline mr-1" />근무표 확인 중…</p>
            ) : !shifts?.saved ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                이 달 근무표가 아직 저장되지 않았어요. 근무표가 나온 뒤에 신청할 수 있습니다.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 mb-1.5">② 내가 내놓을 근무</p>
                  <ShiftPicker items={shifts.mine} value={myDate}
                    onPick={d => { setMyDate(d); setTheirDate('') }} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 mb-1.5">
                    ③ {partnerName} 선생님의 근무
                    {myCode && <span className="font-normal text-gray-400"> — {myCode} 근무만 고를 수 있어요</span>}
                  </p>
                  {!myDate ? <p className="text-xs text-gray-400 py-1.5">먼저 내 근무를 골라주세요.</p>
                    : <ShiftPicker items={shifts.partner} value={theirDate} onPick={setTheirDate} matchCode={myCode} />}
                </div>
                {myDate && theirDate && (
                  <p className="text-sm font-semibold text-center text-sky-700 bg-sky-50 border border-sky-100 rounded-xl py-2">
                    내 {fmtD(myDate)} <b>{myCode}</b> ↔ {partnerName} {fmtD(theirDate)} <b>{shifts.partner[theirDate]}</b>
                  </p>
                )}
              </>
            )}
          </>
        )}

        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="사유 (선택)" className={inp} />
        <div>
          <SignatureInput label="④ 합의 확인용" onChange={setSig} />
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <button onClick={submit} disabled={busy || !partner || !myDate || !theirDate || !sig.ok}
          className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin mx-auto" /> : '교대 요청 보내기'}
        </button>
      </div>

      {/* 진행 상황 */}
      {others.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-50">
          <p className="text-xs font-bold text-gray-500 mb-2">교대 요청 현황</p>
          <ul className="space-y-1.5">
            {others.map(r => {
              const st = SWAP_STATUS_META[r.status]
              const other = r.i_am === 'requester' ? r.partner_name : r.requester_name
              return (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-gray-700 truncate">
                    {other} · {r.dates.map(fmtD).join(' ↔ ')}{r.shift_code ? ` (${r.shift_code})` : ''}
                  </span>
                  <span className={`ml-auto shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${st.cls}`}>{st.t}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
