import { useEffect, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Sun } from 'lucide-react'
import { leaveAPI, MAX_HOPE_PER_MONTH, type LeaveRequest, type MyAnnual } from '@/api/leaveClient'
import SignatureInput, { type SigValue } from './SignatureInput'

/**
 * 연차·희망휴무 신청 — 탭 없이 두 카드를 위아래로.
 *
 * 50~60대 선생님 기준 설계 원칙:
 *  · 화면 하나에 결정 하나 — "연차 쓰기"와 "쉬고 싶은 날"을 섞지 않는다
 *  · 탭은 지금 안 보이는 쪽이 있다는 걸 기억해야 해서 어렵다 — 쭉 내리면 다 보이게
 *  · 글씨 크게, 안내는 짧게, 다음에 뭘 누를지 분명하게
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

const EMPTY_SIG: SigValue = { use_saved: false, signature: null, save: true, ok: false }

/** '2026-08' → '2026-09'. 12월이면 해가 넘어간다. */
const nextMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export default function LeaveRequestCard({ month: monthProp }: { month?: string } = {}) {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(monthProp ?? thisMonth)
  useEffect(() => { if (monthProp) setMonth(monthProp) }, [monthProp])

  const [mine, setMine] = useState<LeaveRequest[]>([])
  const [annual, setAnnual] = useState<MyAnnual | null>(null)

  const load = () => {
    leaveAPI.mine().then(r => setMine(r.requests)).catch(() => {})
    leaveAPI.myAnnual().then(setAnnual).catch(() => {})
  }
  useEffect(load, [])

  // ═══════ 연차 상태 ═══════
  const [myShifts, setMyShifts] = useState<{ saved: boolean; shifts: Record<string, string> } | null>(null)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [dates, setDates] = useState<string[]>([])
  const [annualSig, setAnnualSig] = useState<SigValue>(EMPTY_SIG)
  const [annualBusy, setAnnualBusy] = useState(false)
  const [annualErr, setAnnualErr] = useState('')

  useEffect(() => {
    let dead = false
    setLoadingShifts(true)
    leaveAPI.myShifts(month)
      .then(r => { if (!dead) setMyShifts(r) })
      .catch(() => { if (!dead) setMyShifts(null) })
      .finally(() => { if (!dead) setLoadingShifts(false) })
    return () => { dead = true }
  }, [month])

  const moveMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const submitAnnual = async () => {
    if (dates.length === 0) { setAnnualErr('아래에서 근무 날짜를 골라주세요.'); return }
    if (annual && dates.length > Math.max(0, annual.available)) {
      setAnnualErr(`지금 쓸 수 있는 연차는 ${Math.max(0, annual.available)}개예요.`); return
    }
    if (!annualSig.ok) { setAnnualErr('서명해주세요.'); return }
    setAnnualBusy(true); setAnnualErr('')
    try {
      await leaveAPI.create(dates, '연차', undefined, annualSig)
      setDates([]); load()
      alert('연차를 신청했습니다.\n관리자가 확인하면 알림으로 알려드려요.')
    } catch (e: any) { setAnnualErr(e?.response?.data?.detail ?? '신청 실패') }
    finally { setAnnualBusy(false) }
  }

  // ═══════ 희망휴무 상태 ═══════
  const [hopeDate, setHopeDate] = useState('')
  const [useAnnual, setUseAnnual] = useState(true)
  const [hopeSig, setHopeSig] = useState<SigValue>(EMPTY_SIG)
  const [hopeBusy, setHopeBusy] = useState(false)
  const [hopeErr, setHopeErr] = useState('')

  // 아직 안 나온 '다음 달' 근무표에 반영해달라고 내는 신청이다.
  // 보고 있는 달의 다음 달 1일에서 달력이 열려야 매번 넘기지 않는다.
  const hopeMonth = nextMonth(month)

  useEffect(() => {
    if (!hopeDate || hopeDate.slice(0, 7) !== hopeMonth) setHopeDate(`${hopeMonth}-01`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const hopeUsed = (ym: string) =>
    mine.filter(r => r.kind === '희망휴무' && r.status !== 'rejected' && r.date.startsWith(ym)).length

  const submitHope = async () => {
    if (!hopeDate) { setHopeErr('쉬고 싶은 날을 골라주세요.'); return }
    if (hopeUsed(hopeDate.slice(0, 7)) >= MAX_HOPE_PER_MONTH) {
      setHopeErr(`한 달에 ${MAX_HOPE_PER_MONTH}일까지예요. ${Number(hopeDate.slice(5, 7))}월은 이미 다 썼습니다.`); return
    }
    if (!hopeSig.ok) { setHopeErr('서명해주세요.'); return }
    setHopeBusy(true); setHopeErr('')
    try {
      await leaveAPI.create([hopeDate], '희망휴무', undefined, hopeSig, useAnnual)
      load()
      alert('신청했습니다.\n근무 인원을 보고 승인·반려로 알려드릴게요.\n결과는 알림으로 와요.')
    } catch (e: any) { setHopeErr(e?.response?.data?.detail ?? '신청 실패') }
    finally { setHopeBusy(false) }
  }

  const cancel = async (r: LeaveRequest) => {
    if (!confirm(`${fmtD(r.date)} ${r.kind} 신청을 취소할까요?`)) return
    try { await leaveAPI.cancel(r.id); load() }
    catch (e: any) { alert(e?.response?.data?.detail ?? '취소 실패') }
  }

  // 이번 달 이후 신청만 이력에 (지난달은 자동 정리)
  const monthStart = `${thisMonth}-01`
  const myList = (kind: string) =>
    mine.filter(r => r.kind === kind && r.date >= monthStart).slice(0, 6)

  const MyList = ({ kind }: { kind: '연차' | '희망휴무' }) => {
    const list = myList(kind)
    if (list.length === 0) return null
    return (
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs font-bold text-gray-500 mb-2">내가 신청한 {kind}</p>
        <ul className="space-y-1.5">
          {list.map(r => {
            const st = STATUS_LABEL[r.status]
            return (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-700">{fmtD(r.date)}</span>
                {r.kind === '희망휴무' && r.use_annual && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">연차로</span>
                )}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${st.cls}`}>{st.t}</span>
                {r.status === 'pending' && (
                  <button onClick={() => cancel(r)} className="ml-auto text-xs text-gray-400 hover:text-red-500">취소</button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <>
      {/* ═══════════ 카드 1 — 연차 쓰기 ═══════════ */}
      <div className="mt-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2">
          <CalendarPlus size={18} className="text-emerald-600" />
          <h2 className="text-lg font-bold text-gray-800">연차 쓰기</h2>
          {annual && (
            <span className={`ml-auto text-sm font-extrabold ${annual.available <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {Math.max(0, annual.available)}개 남음
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1 mb-3">
          근무표에서 <b>근무 있는 날</b>을 누르고 서명하면 끝이에요. 승인되면 그날이 연차(休)로 바뀝니다.
        </p>
        {annual && (
          <p className="text-xs text-gray-400 mb-3">
            올해 발생 {annual.entitle}개 · 사용 {annual.used}개{annual.pending > 0 ? ` · 대기 ${annual.pending}개` : ''}
            — 남은 연차는 연말에 사라져요(이월 없음)
          </p>
        )}

        {/* 달 이동 + 근무 고르기 */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <button onClick={() => moveMonth(-1)} className="p-2.5 rounded-xl border border-gray-200 text-gray-500" aria-label="이전 달"><ChevronLeft size={16} /></button>
          <span className="text-base font-bold text-gray-700">{Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월</span>
          <button onClick={() => moveMonth(1)} className="p-2.5 rounded-xl border border-gray-200 text-gray-500" aria-label="다음 달"><ChevronRight size={16} /></button>
        </div>
        {loadingShifts ? (
          <p className="text-sm text-gray-400 text-center py-3"><Loader2 size={14} className="animate-spin inline mr-1" />근무표 확인 중…</p>
        ) : !myShifts?.saved ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-3">
            이 달 근무표가 아직 없어요. 미리 쉬고 싶은 날은 아래 <b>쉬고 싶은 날 신청</b>을 이용해주세요.
          </p>
        ) : Object.keys(myShifts.shifts).length === 0 ? (
          <p className="text-sm text-gray-400 py-2 text-center">이 달 근무표에 내 근무가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(myShifts.shifts).map(([d, code]) => {
              const taken = mine.some(r => r.date === d && r.status !== 'rejected')
              const on = dates.includes(d)
              return (
                <button key={d} disabled={taken}
                  onClick={() => setDates(p => on ? p.filter(x => x !== d) : [...p, d].sort())}
                  className={`px-2.5 py-2 rounded-xl border text-sm font-semibold transition-all
                    ${on ? 'ring-2 ring-emerald-400 bg-emerald-50 text-emerald-800 border-emerald-200'
                      : taken ? 'opacity-30 bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200'}`}>
                  {fmtD(d)} <b>{code}</b>
                </button>
              )
            })}
          </div>
        )}
        {dates.length > 0 && (
          <p className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 mt-2 text-center">
            {dates.map(fmtD).join(', ')} — {dates.length}일 연차
          </p>
        )}

        <div className="mt-3">
          <SignatureInput label="연차 신청서에 들어갑니다" onChange={setAnnualSig} />
        </div>
        {annualErr && <p className="text-sm text-red-500 mt-2">{annualErr}</p>}
        <button onClick={submitAnnual} disabled={annualBusy || dates.length === 0 || !annualSig.ok}
          className="mt-2 w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold disabled:opacity-40">
          {annualBusy ? <Loader2 size={16} className="animate-spin mx-auto" />
            : dates.length > 0 ? `연차 ${dates.length}일 신청하기` : '날짜를 고르면 신청할 수 있어요'}
        </button>
        <MyList kind="연차" />
      </div>

      {/* ═══════════ 카드 2 — 쉬고 싶은 날 (희망휴무) ═══════════ */}
      <div className="mt-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2">
          <Sun size={18} className="text-sky-500" />
          <h2 className="text-lg font-bold text-gray-800">쉬고 싶은 날 신청</h2>
          <span className="ml-auto text-xs text-gray-400">한 달 {MAX_HOPE_PER_MONTH}일까지</span>
        </div>
        <p className="text-sm text-gray-500 mt-1 mb-3">
          <b>다음 달 근무표가 나오기 전에</b> 미리 내는 신청이에요. 근무표를 짤 때 최대한 반영해드립니다.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-3 leading-relaxed">
          다만 <b>그날 근무 인원이 부족하면 어려울 수 있어요.</b> 관리자가 인원을 보고
          승인 또는 반려로 알려드립니다 — 결과는 알림으로 와요.
        </p>

        <p className="text-xs font-semibold text-gray-500 mb-1">
          쉬고 싶은 날
          <span className="ml-1.5 font-normal text-gray-400">
            {Number(hopeMonth.slice(5, 7))}월 신청이에요
          </span>
        </p>
        <input type="date" value={hopeDate} onChange={e => setHopeDate(e.target.value)}
          className="w-full px-3 py-3 text-base border border-gray-200 rounded-xl mb-2" />
        {hopeDate && hopeDate.slice(0, 7) !== hopeMonth && (
          // 다른 달을 고를 수는 있게 두되, 알고 고르는 것인지 짚어준다
          <p className="text-xs text-amber-600 -mt-1 mb-2">
            {Number(hopeDate.slice(5, 7))}월로 신청됩니다 — 이미 나온 근무표라면 바꾸기 어려울 수 있어요.
          </p>
        )}

        <label className="flex items-start gap-2 mb-3 p-3 rounded-xl bg-sky-50/60 border border-sky-100 cursor-pointer">
          <input type="checkbox" checked={useAnnual} onChange={e => setUseAnnual(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-sky-600" />
          <span className="text-sm text-gray-600 leading-relaxed">
            <b className="text-sky-700">이날 연차 쓰기</b> — 연차 1일이 사용돼요.<br />
            <span className="text-xs text-gray-400">체크를 끄면 연차는 안 쓰고 그냥 쉬는 날로만 맞춰드려요.</span>
          </span>
        </label>

        <SignatureInput label="신청서에 들어갑니다" onChange={setHopeSig} />
        {hopeErr && <p className="text-sm text-red-500 mt-2">{hopeErr}</p>}
        <button onClick={submitHope} disabled={hopeBusy || !hopeDate || !hopeSig.ok}
          className="mt-2 w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-base font-bold disabled:opacity-40">
          {hopeBusy ? <Loader2 size={16} className="animate-spin mx-auto" /> : hopeDate ? `${fmtD(hopeDate)} 쉬고 싶어요` : '날짜를 골라주세요'}
        </button>
        <MyList kind="희망휴무" />
      </div>
    </>
  )
}
