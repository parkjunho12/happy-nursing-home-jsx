import { useEffect, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { leaveAPI, LEAVE_KIND_META, MAX_HOPE_PER_MONTH, type LeaveKind, type LeaveRequest, type MyAnnual } from '@/api/leaveClient'
import SignatureInput, { type SigValue } from './SignatureInput'

/**
 * 연차·휴무 신청 — 선생님이 앱에서 직접 낸다.
 * 지금까지는 말로 전하고 관리자가 수기로 적었는데, 그 사이에서 누락이 났다.
 * 신청 → 관리자 승인 → 근무표 자동 반영으로 잇는다.
 */
const STATUS_LABEL = {
  pending: { t: '대기 중', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { t: '승인됨', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { t: '반려됨', cls: 'bg-red-50 text-red-600 border-red-200' },
} as const

const fmtD = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일(${w})`
}

export default function LeaveRequestCard({ month: monthProp }: { month?: string } = {}) {
  const [dates, setDates] = useState<string[]>([])
  const [dateInput, setDateInput] = useState('')
  // 연차는 근무표의 내 근무 날짜에서만 고른다 (근무 → 休 교체이므로)
  const now = new Date()
  const [month, setMonth] = useState(monthProp ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  // 위 근무표에서 달을 바꾸면 신청 카드도 따라간다
  useEffect(() => { if (monthProp) setMonth(monthProp) }, [monthProp])
  const [myShifts, setMyShifts] = useState<{ saved: boolean; shifts: Record<string, string> } | null>(null)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [kind, setKind] = useState<LeaveKind>('연차')
  const [reason, setReason] = useState('')
  const [mine, setMine] = useState<LeaveRequest[]>([])
  const [usedAnnual, setUsedAnnual] = useState<number | null>(null)
  const [annual, setAnnual] = useState<MyAnnual | null>(null)
  const [busy, setBusy] = useState(false)
  const [sig, setSig] = useState<SigValue>({ use_saved: false, signature: null, save: true, ok: false })
  // 희망휴무를 연차(休)로 우선 반영 — 시설 기본 방침이라 켬이 기본
  const [useAnnual, setUseAnnual] = useState(true)
  const [err, setErr] = useState('')

  const load = () => {
    leaveAPI.mine()
      .then(r => { setMine(r.requests); setUsedAnnual(r.used_annual) })
      .catch(() => { /* 명단 미연결 등 — 카드 자체는 조용히 비움 */ })
    leaveAPI.myAnnual().then(setAnnual).catch(() => {})
  }
  useEffect(load, [])

  useEffect(() => {
    if (kind !== '연차') return
    let dead = false
    setLoadingShifts(true)
    leaveAPI.myShifts(month)
      .then(r => { if (!dead) setMyShifts(r) })
      .catch(() => { if (!dead) setMyShifts(null) })
      .finally(() => { if (!dead) setLoadingShifts(false) })
    return () => { dead = true }
  }, [kind, month])

  // 희망휴무 날짜 선택 — 달력이 '보던 달'에서 열리도록 비어 있으면 그 달 1일을 넣어둔다
  useEffect(() => {
    if (kind !== '희망휴무') return
    if (!dateInput || dateInput.slice(0, 7) !== month) setDateInput(`${month}-01`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, month])

  const moveMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  /** 그 달에 이미 낸 희망휴무 수 (대기·승인) */
  const hopeCountFor = (ym: string) =>
    mine.filter(r => r.kind === '희망휴무' && r.status !== 'rejected' && r.date.startsWith(ym)).length


  const submit = async () => {
    // 희망휴무는 날짜 하나를 골라 바로 신청 — 담는 단계가 오히려 헷갈린다
    const target = kind === '희망휴무' ? (dateInput ? [dateInput] : []) : dates
    if (target.length === 0) { setErr(kind === '희망휴무' ? '쉬고 싶은 날을 골라주세요.' : '날짜를 하나 이상 골라주세요.'); return }
    if (kind === '희망휴무' && hopeCountFor(dateInput.slice(0, 7)) >= MAX_HOPE_PER_MONTH) {
      setErr(`희망휴무는 한 달에 최대 ${MAX_HOPE_PER_MONTH}일까지예요. ${Number(dateInput.slice(5, 7))}월은 이미 다 찼습니다.`); return
    }
    if (kind === '연차' && annual && target.length > Math.max(0, annual.available)) {
      setErr(`지금 쓸 수 있는 연차는 ${Math.max(0, annual.available)}개인데 ${target.length}일을 담았어요.`); return
    }
    if (!sig.ok) { setErr('신청에는 서명이 필요합니다. 아래에 서명해주세요.'); return }
    setBusy(true); setErr('')
    try {
      await leaveAPI.create(target, kind, reason || undefined, sig,
        kind === '희망휴무' ? useAnnual : undefined)
      setDates([]); setReason('')
      load()
      alert('신청했습니다. 관리자가 확인하면 알림으로 알려드립니다.')
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? '신청 실패')
    } finally { setBusy(false) }
  }

  // 이번 달 1일 이후 날짜의 신청만 이력에 남긴다
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const visibleMine = mine.filter(r => r.date >= monthStart)

  const cancel = async (r: LeaveRequest) => {
    if (!confirm(`${fmtD(r.date)} ${r.kind} 신청을 취소할까요?`)) return
    try { await leaveAPI.cancel(r.id); load() }
    catch (e: any) { alert(e?.response?.data?.detail ?? '취소 실패') }
  }

  return (
    <div className="mt-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarPlus size={16} className="text-emerald-600" />
        <h2 className="text-base font-bold text-gray-800">연차·휴무 신청</h2>
        {annual ? (
          <span className="ml-auto text-xs text-gray-400">쓸 수 있는 연차 <b className={annual.available <= 0 ? 'text-red-500' : 'text-emerald-600'}>{annual.available}개</b></span>
        ) : usedAnnual !== null && (
          <span className="ml-auto text-xs text-gray-400">올해 사용 연차 <b className="text-gray-600">{usedAnnual}일</b></span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">{LEAVE_KIND_META[kind].hint}</p>

      {/* 종류 */}
      <div className="flex gap-1.5 mb-3">
        {(Object.keys(LEAVE_KIND_META) as LeaveKind[]).map(k => (
          <button key={k} onClick={() => { setKind(k); setDates([]); setErr('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${kind === k ? LEAVE_KIND_META[k].cls + ' ring-2 ring-offset-1 ring-gray-200' : 'bg-white text-gray-400 border-gray-200'}`}>
            {k}
          </button>
        ))}
      </div>

      {/* 날짜 담기 — 연차는 근무표의 내 근무에서만, 희망휴무는 자유 날짜 */}
      {kind === '연차' ? (
        <div className="mb-2">
          {annual && (
            <div className="mb-2 rounded-xl bg-emerald-50/60 border border-emerald-100 px-3 py-2.5 text-xs text-gray-600 leading-relaxed">
              올해({annual.year}) 발생 <b>{annual.entitle}개</b>
              {annual.accrued < annual.entitle && <> · 지금까지 발생 <b>{annual.accrued}개</b></>}
              {' '}· 사용 <b>{annual.used}개</b>
              {annual.pending > 0 && <> · 대기 <b>{annual.pending}개</b></>}
              {' → '}지금 쓸 수 있는 연차 <b className={annual.available <= 0 ? 'text-red-500' : 'text-emerald-700'}>{annual.available}개</b>
              <span className="block text-[10px] text-gray-400 mt-0.5">이월 없음 — 남은 연차는 연말에 소멸됩니다 (사용촉진제)</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 mb-2">
            <button onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500"><ChevronLeft size={14} /></button>
            <span className="text-sm font-bold text-gray-700">{Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월 내 근무</span>
            <button onClick={() => moveMonth(1)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500"><ChevronRight size={14} /></button>
          </div>
          {loadingShifts ? (
            <p className="text-xs text-gray-400 text-center py-2"><Loader2 size={13} className="animate-spin inline mr-1" />근무표 확인 중…</p>
          ) : !myShifts?.saved ? (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              이 달 근무표가 아직 없어요. 근무표가 나온 뒤 연차를 신청할 수 있습니다.
              미리 쉬고 싶은 날은 <b>희망휴무</b>로 내주세요.
            </p>
          ) : Object.keys(myShifts.shifts).length === 0 ? (
            <p className="text-xs text-gray-400 py-1.5">이 달 근무표에 내 근무가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(myShifts.shifts).map(([d, code]) => {
                const taken = mine.some(r => r.date === d && r.status !== 'rejected')
                const on = dates.includes(d)
                return (
                  <button key={d} disabled={taken}
                    title={taken ? '이미 신청한 날짜예요' : undefined}
                    onClick={() => setDates(p => on ? p.filter(x => x !== d) : [...p, d].sort())}
                    className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all
                      ${on ? 'ring-2 ring-emerald-400 bg-emerald-50 text-emerald-800 border-emerald-200'
                        : taken ? 'opacity-30 bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-200 hover:ring-1 hover:ring-gray-300'}`}>
                    {fmtD(d)} <b>{code}</b>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-2">
          <p className="text-[11px] font-semibold text-gray-500 mb-1">쉬고 싶은 날 <span className="font-normal text-gray-400">— 하루씩 바로 신청돼요 (한 달 최대 {MAX_HOPE_PER_MONTH}일)</span></p>
          <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl" />
        </div>
      )}
      {kind === '연차' && dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {dates.map(d => (
            <span key={d} className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
              {fmtD(d)}
              <button onClick={() => setDates(p => p.filter(x => x !== d))} aria-label="빼기"><X size={12} className="text-gray-400" /></button>
            </span>
          ))}
        </div>
      )}
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="사유 (선택)"
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl mb-2" />

      {kind === '희망휴무' && (
        <label className="flex items-start gap-2 mb-2 p-2.5 rounded-xl bg-sky-50/60 border border-sky-100 cursor-pointer">
          <input type="checkbox" checked={useAnnual} onChange={e => setUseAnnual(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-sky-600" />
          <span className="text-xs text-gray-600 leading-relaxed">
            <b className="text-sky-700">이날을 연차(休)로 우선 반영</b><br />
            근무표를 짤 때 이날에 연차를 먼저 넣어드립니다. 남은 연차에서 1일이 사용돼요.
            체크를 끄면 연차 차감 없이 &lsquo;쉬고 싶은 날&rsquo;로만 참고합니다.
          </span>
        </label>
      )}
      <div className="mb-2">
        <SignatureInput label="신청서에 들어갑니다" onChange={setSig} />
      </div>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
      <button onClick={submit} disabled={busy || (kind === '연차' ? dates.length === 0 : !dateInput) || !sig.ok}
        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-40">
        {busy ? <Loader2 size={15} className="animate-spin mx-auto" /> : kind === '연차' && dates.length > 1 ? `${dates.length}일 신청하기` : '신청하기'}
      </button>

      {/* 내 신청 현황 — 지난달 것은 자동으로 사라진다 (계속 쌓이면 화면만 길어지므로) */}
      {visibleMine.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-50">
          <p className="text-xs font-bold text-gray-500 mb-2">내 신청</p>
          <ul className="space-y-1.5">
            {visibleMine.slice(0, 8).map(r => {
              const st = STATUS_LABEL[r.status]
              return (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-gray-700 w-24 shrink-0">{fmtD(r.date)}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${LEAVE_KIND_META[r.kind].cls}`}>{r.kind}</span>
                  {r.kind === '희망휴무' && r.use_annual && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">연차반영</span>
                  )}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${st.cls}`}>{st.t}</span>
                  {r.status === 'pending' && (
                    <button onClick={() => cancel(r)} className="ml-auto text-[11px] text-gray-400 hover:text-red-500">취소</button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
