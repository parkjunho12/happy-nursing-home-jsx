import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, FileSignature, ClipboardCheck, ShieldAlert, ChevronRight, Loader2, Check, BellRing, HandCoins, ArrowRight, MessageSquareWarning } from 'lucide-react'
import { residentDocAPI, type ResidentDoc } from '@/api/residentDocClient'
import { currentCert, certState, renewalDue } from '@/utils/cert'
import { asEvent, todayISO, effStatus, type DocEvent } from '@/utils/docEvents'
import { careMeta, deriveCare, needsFacilityApply, APPLY_STAGES, stageMeta, stageIndex, nextStage, stageProgress, GUARDIAN_STALE_DAYS } from '@/utils/careType'

const fmt = (iso?: string | null) => {
  if (!iso) return '-'
  const [, m, d] = iso.split('-')
  const dt = new Date(iso + 'T00:00:00')
  return `${+m}.${+d}(${['일','월','화','수','목','금','토'][dt.getDay()]})`
}
const dday = (iso: string) =>
  Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(todayISO() + 'T00:00:00').getTime()) / 86400000)

/** 서류 3종이 공유하는 행 */
interface TaskRow { docId: string; idx: number; name: string; date: string; kind?: string | null; d: number; care?: string | null }
interface CertRow { docId: string; name: string; end: string; due: string; d: number; expired: boolean; care?: string | null; upcoming?: boolean; dToDue?: number; renewing?: boolean }

type DocField = 'plan_lines' | 'contract_lines' | 'eval_lines'
type TabKey = 'plan' | 'contract' | 'eval' | 'cert' | 'apply'

const UPCOMING_WINDOW = 90   // 앞으로 90일 이내 예정까지 표시 (지연 항목은 기간 제한 없음)

/** D-day 배지 — 지난 건 '지연', 오늘은 '오늘' */
function DdayBadge({ d, tone }: { d: number; tone: string }) {
  const late = d < 0
  return (
    <span className={`w-12 shrink-0 text-center text-[11px] font-extrabold rounded-lg py-1 ${
      late ? 'bg-red-500 text-white' : d <= 3 ? 'bg-amber-100 text-amber-700' : tone}`}>
      {late ? `지연 ${-d}일` : d === 0 ? '오늘' : `D-${d}`}
    </span>
  )
}

/**
 * 어르신 서류 위젯 — 4가지 '해야 할 일'을 탭으로 나눠 D-day와 함께 보여준다.
 * 계획서 · 계약서 · 결과평가는 저장된 일시 중 미완료 건, 인정서는 만료 90일 이내.
 * 지난 일정도 숨기지 않고 '지연'으로 올려 보낸다 — 놓치면 안 되는 서류이기 때문.
 */
export default function UpcomingDocs() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ResidentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('plan')
  const [doneBusy, setDoneBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    residentDocAPI.list(false).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }, [])

  // 서류 일시 완료 처리
  // ⚠ 낙관적 업데이트 금지 — 서버가 저장한 결과를 진실로 삼는다.
  const complete = async (field: DocField, p: TaskRow) => {
    const key = `${field}-${p.docId}-${p.idx}`
    setDoneBusy(key); setErr('')
    try {
      const doc = rows.find(r => r.id === p.docId)
      if (!doc) return
      const next = ((doc[field] as DocEvent[]) ?? []).map(asEvent).map((e, i) => i === p.idx ? { ...e, done: true, status: '완료' as const } : e)
      const saved = await residentDocAPI.update(p.docId, { [field]: next })
      const savedDone = effStatus(((saved[field] as DocEvent[]) ?? []).map(asEvent)[p.idx] ?? {}) === '완료'
      if (!savedDone) {
        setErr('완료 상태가 서버에 저장되지 않았습니다. 백엔드가 최신 버전인지 확인해주세요.')
        return
      }
      setRows(prev => prev.map(r => r.id === p.docId ? { ...r, ...saved } : r))
    } catch (e: any) {
      setErr(e?.message ?? '완료 처리에 실패했습니다.')
    } finally { setDoneBusy(null) }
  }

  const [renewBusy, setRenewBusy] = useState<string | null>(null)
  const applyRenew = async (c: CertRow) => {
    if (!confirm(`${c.name} 어르신 인정서 갱신을 신청했나요?\n「갱신 신청 중」으로 표시되고, 새 인정서가 등록되면 자동으로 사라집니다.`)) return
    setRenewBusy(c.docId)
    const todayIso = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    try {
      const saved = await residentDocAPI.update(c.docId, { renew_applied_at: todayIso, renew_base_end: c.end } as any)
      setRows(prev => prev.map(r => r.id === c.docId ? { ...r, ...saved } : r))
    } catch (e: any) { setErr(e?.message ?? '갱신 신청 저장 실패') }
    finally { setRenewBusy(null) }
  }

  /** 미완료 일시 → 지연 먼저, 그다음 임박순 */
  const collect = (field: DocField): TaskRow[] => {
    const out: TaskRow[] = []
    rows.forEach(r => {
      ((r[field] as DocEvent[]) ?? []).map(asEvent).forEach((e, idx) => {
        // 지난 날짜에 아무 표시가 없으면 이미 작성한 것으로 본다 → 할 일에서 제외.
        // 안 된 건은 미비·서명미비·챙길것으로 표시해야 여기에 남는다.
        if (!e.date || effStatus(e) === '완료') return
        const d = dday(e.date)
        if (d > UPCOMING_WINDOW) return
        out.push({ docId: r.id, idx, name: r.name ?? '-', date: e.date, kind: e.kind, d, care: deriveCare(r.certifications) })
      })
    })
    return out.sort((a, b) => a.d - b.d)
  }

  const plans = useMemo(() => collect('plan_lines'), [rows])
  const contracts = useMemo(() => collect('contract_lines'), [rows])
  const evals = useMemo(() => collect('eval_lines'), [rows])

  const certs: CertRow[] = useMemo(() => {
    const out: CertRow[] = []
    rows.forEach(r => {
      const cur = currentCert(r.certifications ?? [])
      const st = certState(cur)
      if (!cur?.end) return
      if (st.status === 'renew' || st.status === 'expired') {
        const renewing = !!(r as any).renew_applied_at
          && (!(r as any).renew_base_end || cur.end <= (r as any).renew_base_end)
        out.push({ docId: r.id, name: r.name ?? '-', end: cur.end, due: renewalDue(cur.end),
                   d: dday(cur.end), expired: st.status === 'expired', care: deriveCare(r.certifications), renewing })
      } else if (st.status === 'ok') {
        // 아직 90일 밖 — 갱신 기간 진입까지 45일 이내면 '준비' 줄로 미리 보여준다.
        // 진입하고 나서 서두르는 것보다, 진입 전에 보호자 안내·서류 준비가 먼저다.
        const dToDue = dday(renewalDue(cur.end))
        if (dToDue >= 0 && dToDue <= 45) {
          out.push({ docId: r.id, name: r.name ?? '-', end: cur.end, due: renewalDue(cur.end),
                     d: dday(cur.end), expired: false, care: deriveCare(r.certifications),
                     upcoming: true, dToDue })
        }
      }
    })
    // 만료·갱신 중이 먼저, 준비는 뒤에
    return out.sort((a, b) => Number(!!a.upcoming) - Number(!!b.upcoming) || a.d - b.d)
  }, [rows])

  // 재가·등급외(신청예정) 어르신 중 확인일이 지났거나 확인일이 안 잡힌 분
  const followups = useMemo(() => rows.filter(r => {
    if (!needsFacilityApply(r.certifications)) return false
    return !r.followup_date || dday(r.followup_date) <= 0
  }), [rows])

  // 시설급여 신청 진행 중인 어르신 — 단계가 뒤일수록(=오래 기다린 분) 위로
  const applying = useMemo(() =>
    rows.filter(r => needsFacilityApply(r.certifications) && r.apply_stage !== '완료')
        .sort((a, b) => stageIndex(b.apply_stage) - stageIndex(a.apply_stage)),
  [rows])

  /** 한 단계 진행 */
  const advance = async (r: ResidentDoc) => {
    const nx = nextStage(r.apply_stage ?? '예정')
    if (!nx) return
    if (!confirm(`${r.name} 어르신을 「${nx.label}」 단계로 넘길까요?`)) return
    setDoneBusy(`stage-${r.id}`); setErr('')
    try {
      const saved = await residentDocAPI.update(r.id, { apply_stage: nx.v })
      if (saved.apply_stage !== nx.v) { setErr('단계 변경이 서버에 저장되지 않았습니다.'); return }
      setRows(prev => prev.map(x => x.id === r.id ? { ...x, ...saved } : x))
    } catch (e: any) { setErr(e?.message ?? '단계 변경에 실패했습니다.') } finally { setDoneBusy(null) }
  }

  const TABS: { k: TabKey; short: string; label: string; icon: any; count: number; tone: string; badge: string }[] = [
    { k: 'plan',     short: '계획서', label: '급여제공계획서', icon: FileText,       count: plans.length,     tone: 'text-sky-600',    badge: 'bg-sky-100 text-sky-700' },
    { k: 'contract', short: '계약서', label: '계약서',        icon: FileSignature,  count: contracts.length, tone: 'text-teal-600',   badge: 'bg-teal-100 text-teal-700' },
    { k: 'eval',     short: '평가',   label: '결과평가',      icon: ClipboardCheck, count: evals.length,     tone: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
    { k: 'cert',     short: '인정서', label: '인정서 갱신',    icon: ShieldAlert,    count: certs.length,     tone: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700' },
    { k: 'apply',    short: '시설급여', label: '시설급여 신청',  icon: HandCoins,      count: applying.length,  tone: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  ]

  const TASK_TABS: Record<Exclude<TabKey, 'cert' | 'apply'>, { rows: TaskRow[]; field: DocField; empty: string; hover: string; tone: string }> = {
    plan:     { rows: plans,     field: 'plan_lines',     empty: '작성할 급여제공계획서가 없습니다', hover: 'hover:bg-sky-50/60',    tone: 'bg-sky-50 text-sky-600' },
    contract: { rows: contracts, field: 'contract_lines', empty: '작성할 계약서가 없습니다',        hover: 'hover:bg-teal-50/60',   tone: 'bg-teal-50 text-teal-600' },
    eval:     { rows: evals,     field: 'eval_lines',     empty: '작성할 결과평가가 없습니다',       hover: 'hover:bg-indigo-50/60', tone: 'bg-indigo-50 text-indigo-600' },
  }

  const CareTag = ({ care }: { care?: string | null }) => {
    if (!care || care === '시설') return null
    const m = careMeta(care)
    return <span className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded border ${m.cls}`}>{m.short}</span>
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 pt-2.5 overflow-x-auto">
        {TABS.map(t => {
          const on = tab === t.k
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-1 px-2 md:px-2.5 py-2.5 md:py-2 min-h-[40px] shrink-0 rounded-xl text-xs font-bold transition-colors ${on ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}>
              <t.icon size={13} className={on ? t.tone : ''} />
              <span className="md:hidden">{t.short}</span>
              <span className="hidden md:inline">{t.label}</span>
              {t.count > 0 && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${t.badge}`}>{t.count}</span>
              )}
            </button>
          )
        })}
        <button onClick={() => navigate('/resident-docs')} aria-label="어르신 서류 현황 전체 보기"
          className="ml-auto shrink-0 text-[11px] font-semibold text-gray-400 hover:text-gray-700 px-2 py-1 inline-flex items-center">
          전체 <ChevronRight size={13} />
        </button>
      </div>

      {/* 재가·등급외 어르신은 서류 일정이 없어 잊히기 쉬워 별도로 띄운다 */}
      {!loading && followups.length > 0 && (
        <button onClick={() => setTab('apply')}
          className="w-full flex items-center gap-2 px-3 py-2 mt-1.5 bg-violet-50/70 border-y border-violet-100 text-left hover:bg-violet-50">
          <BellRing size={13} className="text-violet-500 shrink-0" />
          <span className="text-[11.5px] text-violet-800 flex-1 min-w-0 truncate">
            <b>재가·등급외 어르신 {followups.length}명</b> 확인할 때가 됐습니다 — {followups.slice(0, 3).map(r => r.name).join(', ')}{followups.length > 3 ? ' 외' : ''}
          </span>
          <ChevronRight size={13} className="text-violet-400 shrink-0" />
        </button>
      )}

      <div className="px-3 pb-3 pt-1.5">
        {err && (
          <p className="mb-2 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">{err}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : tab === 'apply' ? (
          applying.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8 leading-relaxed">
              시설급여 신청을 진행 중인 어르신이 없습니다.<br />
              <span className="text-[11px]">재가·등급외 어르신은 서류 현황에서 구분을 지정해주세요.</span>
            </p>
          ) : (
            <>
              <p className="text-[10px] text-gray-400 px-1 pb-1.5">
                시설급여가 적용돼야 본인부담금이 내려갑니다 — <b>보호자 안내</b>가 오래된 분은 붉게 표시됩니다
              </p>
              <ul className="space-y-1.5 md:max-h-[240px] md:overflow-y-auto md:pr-0.5">
                {applying.map(r => {
                  const st = stageMeta(r.apply_stage) ?? APPLY_STAGES[0]
                  const nx = nextStage(r.apply_stage ?? '예정')
                  const gd = r.guardian_notified_at ? -dday(r.guardian_notified_at) : null   // 안내 후 며칠 지났나
                  const stale = gd === null || gd >= GUARDIAN_STALE_DAYS
                  const busy = doneBusy === `stage-${r.id}`
                  return (
                    <li key={r.id} className="px-2 py-2 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/30">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-800 truncate cursor-pointer" onClick={() => navigate('/resident-docs')}>{r.name}</span>
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${careMeta(deriveCare(r.certifications)).cls}`}>{careMeta(deriveCare(r.certifications)).short}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                        {nx && (
                          <button onClick={() => advance(r)} disabled={busy}
                            title={`다음 단계: ${nx.label}`}
                            className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-violet-600 border border-violet-200 rounded-lg px-1.5 py-1 hover:bg-violet-100 disabled:opacity-50">
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <><ArrowRight size={11} /> {nx.label}</>}
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full transition-all ${st.bar}`} style={{ width: `${Math.max(8, stageProgress(r.apply_stage))}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{st.guide}</p>
                      {r.apply_note && <p className="text-[10px] text-gray-400 mt-0.5">메모 · {r.apply_note}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        <MessageSquareWarning size={10} className={stale ? 'text-red-500' : 'text-gray-300'} />
                        <span className={`text-[10px] font-semibold ${stale ? 'text-red-500' : 'text-gray-400'}`}>
                          {gd === null ? '보호자 안내 기록 없음' : gd === 0 ? '오늘 보호자에게 안내함' : `보호자 안내 ${gd}일 전`}
                        </span>
                        {stale && <span className="text-[10px] text-gray-400">— 진행 상황을 알려드리세요</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )
        ) : tab === 'cert' ? (
          certs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">인정서 만료 90일 이내인 어르신이 없습니다 👍</p>
          ) : (
            <>
              <p className="text-[10px] text-gray-400 px-1 pb-1.5">색 배지 = <b>갱신 기간(만료 90일 이내)</b> · 회색 = 갱신 기간 진입까지 D-day (미리 준비)</p>
              <ul className="space-y-1 md:max-h-[220px] md:overflow-y-auto md:pr-0.5">
                {certs.map(c => (
                  <li key={c.docId} onClick={() => navigate('/resident-docs')}
                    className="flex items-center gap-2.5 px-1.5 md:px-2.5 py-2 min-h-[44px] rounded-xl hover:bg-amber-50/60 cursor-pointer">
                    <span className={`w-12 shrink-0 text-center text-[11px] font-extrabold rounded-lg py-1 ${
                      c.expired ? 'bg-red-500 text-white'
                      : c.upcoming ? 'bg-gray-100 text-gray-500'
                      : c.d <= 30 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                      {c.expired ? '만료' : c.upcoming ? `D-${c.dToDue}` : `D-${c.d}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1">
                        {c.name} <CareTag care={c.care} />
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {c.expired
                          ? <span className="text-red-500 font-semibold">만료 지남 · {fmt(c.end)}</span>
                          : c.upcoming
                            ? <>갱신 기간 진입 {fmt(c.due)} — <b className="text-gray-500">미리 준비</b> · 만료 {fmt(c.end)}</>
                            : <>갱신 기간 — 만료 {fmt(c.end)}까지 D-{c.d}</>}
                      </p>
                    </div>
                    {c.renewing ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-sky-100 text-sky-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" /> 갱신 신청 중
                      </span>
                    ) : !c.upcoming && (
                      <button onClick={e => { e.stopPropagation(); applyRenew(c) }} disabled={renewBusy === c.docId}
                        className="shrink-0 text-[10px] font-bold text-sky-600 border border-sky-200 px-2 py-1 rounded-full hover:bg-sky-50 disabled:opacity-40">
                        {renewBusy === c.docId ? '저장 중…' : '갱신 신청 →'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )
        ) : (() => {
          const t = TASK_TABS[tab as Exclude<TabKey, 'cert' | 'apply'>]
          if (t.rows.length === 0) return <p className="text-xs text-gray-400 text-center py-8">{t.empty}</p>
          const late = t.rows.filter(r => r.d < 0).length
          return (
            <>
              {late > 0 && (
                <p className="text-[10px] text-red-500 font-semibold px-1 pb-1.5">기한이 지난 <b>{late}건</b>이 맨 위에 있습니다</p>
              )}
              <ul className="space-y-1 md:max-h-[220px] md:overflow-y-auto md:pr-0.5">
                {t.rows.map(p => {
                  const key = `${t.field}-${p.docId}-${p.idx}`
                  return (
                    <li key={key} className={`flex items-center gap-2.5 px-1.5 md:px-2.5 py-2 min-h-[44px] rounded-xl group ${t.hover}`}>
                      <DdayBadge d={p.d} tone={t.tone} />
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/resident-docs')}>
                        <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1">
                          {p.name} <CareTag care={p.care} />
                        </p>
                        <p className="text-[10px] text-gray-400">{fmt(p.date)}{p.kind ? ` · ${p.kind}` : ''}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); complete(t.field, p) }}
                        disabled={doneBusy === key}
                        title="작성 완료 처리" aria-label="작성 완료 처리"
                        className="w-11 h-11 md:w-8 md:h-8 shrink-0 rounded-lg border border-gray-100 bg-gray-50 text-gray-300 hover:bg-sky-500 hover:text-white hover:border-sky-500 active:bg-sky-500 active:text-white flex items-center justify-center transition-colors disabled:opacity-50">
                        {doneBusy === key ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )
        })()}
      </div>
    </section>
  )
}
