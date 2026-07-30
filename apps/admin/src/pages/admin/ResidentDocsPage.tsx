import { useEffect, useState, useCallback, useMemo } from 'react'
import { ClipboardList, Plus, X, Trash2, Loader2, Check, BookOpen, RefreshCw, History, HelpCircle } from 'lucide-react'
import DateField from '@/components/ui/DateField'
import { residentDocAPI, type ResidentDoc, type DocInput } from '../../api/residentDocClient'
import CertificationEditor from '@/components/eval/CertificationEditor'
import DocEventsEditor from '@/components/eval/DocEventsEditor'
import DocChangesModal from '@/components/eval/DocChangesModal'
import { CARE_TYPES, careMeta, deriveCare, needsFacilityApply, APPLY_STAGES, stageMeta, stageProgress } from '@/utils/careType'
import { currentCert, certState, renewalDue, daysUntil, gradeLabel, benefitLabel } from '@/utils/cert'
import { type DocEvent, type DocType, KINDS, kindMeta, asEvent, fmtYMD, fmtMD, autoDocEvents, appendAuto, todayISO, STATUSES, statusMeta, effStatus, isAlert, isExplicitDone, isImplicitDone } from '@/utils/docEvents'
import { useLtcStore, type LtcResident } from '@/store/ltc'

const fmtD = (s?: string | null) => {
  if (!s) return ''
  const p = s.split('-')
  return p.length === 3 ? `${p[0].slice(2)}.${p[1]}.${p[2]}` : s
}
const plus6 = (s?: string | null) => {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return ''
  let ny = y, nm = m + 6
  if (nm > 12) { ny += Math.floor((nm - 1) / 12); nm = ((nm - 1) % 12) + 1 }
  const dim = new Date(ny, nm, 0).getDate()
  return fmtMD(`${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`)
}

const SOP = `▶ 서류(인정서, 개장기) 사진찍어 복지톡에 업로드
▶ 보호자께 갱신 서류 도착 문자 알림
▶ 서류 복사 후 복사본은 어르신 개인 파일에 철하기
▶ 원본은 출입구 앞 파일에 넣기(보호자 오시면 드리기)
▶ 계약서 준비 후 출입구 앞 파일에(내용 전부 미리 작성, 보호자 서명만)
▶ 케어포 등급 및 본인부담률 수정 / 구글 현황표 수정
* 갱신기준일자에 맞춰 급여제공계획서 작성 후 보호자 서명받아 철하기
* 갱신기준일자에 맞춰 급여제공평가 등 각종 평가 작성
* 국민건강보험공단에 갱신 등록`
// 기존 엑셀 시트 '예시' 행에 적혀 있던 열별 작성 규칙 — 화면에서도 켜서 볼 수 있게 옮겨왔다
const COL_RULES: Record<string, string[]> = {
  cert:     ['재가도 인정서 작성', '등급외는 1년으로 기재'],
  grade:    ['입소(갱신) 시점 자격 기재'],
  base:     ['인정서 시작일자가 기준일', '(괄호)는 6개월 뒤 일자'],
  contract: ['입소 때 작성', '매년 1월 1일 작성', '갱신 때 작성'],
  plan:     ['입소 때 작성', '6개월마다 작성', '변화 시 작성'],
  eval:     ['6개월마다 작성', '변화 시 작성', '퇴소 시 작성'],
}

const SMS = `안녕하세요. 행복한요양원 복지팀 000입니다. 어르신 인정서 갱신서류가 우편으로 도착했습니다. 원 방문 시 계약 서류 작성 부탁드립니다 ^^`

export default function ResidentDocsPage() {
  const [rows, setRows] = useState<ResidentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ResidentDoc | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [showDischarged, setShowDischarged] = useState(false)
  const [search, setSearch] = useState('')
  const [fee, setFee] = useState('')
  const [floorF, setFloorF] = useState('')
  // 정렬 — 이 페이지의 목적은 '챙길 어르신 찾기'라 급한 순이 기본이다
  const [sortMode, setSortMode] = useState<'urgent' | 'name' | 'room' | 'admission'>('name')
  const [careF, setCareF] = useState('')
  const [rulesOn, setRulesOn] = useState(true)    // 작성 기준 안내 행 — 기본 표시 (버튼으로 끌 수 있음)
  const [quick, setQuick] = useState<'all' | 'cert' | 'month' | 'alert'>('all')
  const [sopOpen, setSopOpen] = useState(false)
  // 수정 이력 모달 — null=닫힘, {}=전체 최근, {id,name}=해당 어르신
  const [histOpen, setHistOpen] = useState<{ id?: string; name?: string } | null>(null)
  const { residents, loaded: ltcLoaded, loadAll } = useLtcStore()
  useEffect(() => { if (!ltcLoaded) loadAll() }, [ltcLoaded, loadAll])
  const [exp, setExp] = useState<Set<string>>(new Set())
  const toggleExp = (k: string) => setExp(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await residentDocAPI.list(showDischarged)) } finally { setLoading(false) }
  }, [showDischarged])
  useEffect(() => { load() }, [load])

  const rankById = useMemo(() => new Map(rows.map((r, i) => [r.id, i + 1])), [rows])
  const nowMonth = new Date().getMonth() + 1
  const docInfo = (r: ResidentDoc) => {
    const cur = currentCert(r.certifications ?? [])
    const st = certState(cur)
    const rm = r.base_date ? (() => { const m = Number(r.base_date!.split('-')[1]); return m ? [m, ((m - 1 + 6) % 12) + 1] : [] })() : []
    return { cur, st, renew: rm.includes(nowMonth) }
  }
  /** 조치가 필요한 일시(미비·서명미비·챙길것) 건수 */
  const alertCount = (r: ResidentDoc) =>
    [...(r.contract_lines ?? []), ...(r.plan_lines ?? []), ...(r.eval_lines ?? [])].map(asEvent).filter(isAlert).length
  /** 서류가 통째로 비어 있는 어르신 — 신규 입소 직후라 챙겨야 한다 */
  const isEmpty = (r: ResidentDoc) =>
    !(r.certifications?.length) && !(r.contract_lines?.length) && !(r.plan_lines?.length) && !(r.eval_lines?.length)

  const summary = useMemo(() => {
    let cert = 0, month = 0, alerts = 0, empty = 0
    rows.forEach(r => {
      const i = docInfo(r)
      if (i.st.status === 'expired' || i.st.status === 'renew') cert++
      if (i.renew) month++
      alerts += alertCount(r)
      if (isEmpty(r)) empty++
    })
    return { total: rows.length, cert, month, alerts, empty }
  }, [rows])
  const floors = useMemo(() => Array.from(new Set(rows.map(r => (r as any).floor).filter(Boolean))).sort() as string[], [rows])
  const filtered = useMemo(() => rows.filter(r => {
    if (search && !(r.name ?? '').includes(search)) return false
    if (fee && !(r.grade ?? '').includes(fee)) return false
    if (floorF && (r as any).floor !== floorF) return false
    if (careF && deriveCare(r.certifications) !== careF) return false
    const i = docInfo(r)
    if (quick === 'cert' && !(i.st.status === 'expired' || i.st.status === 'renew')) return false
    if (quick === 'month' && !i.renew) return false
    if (quick === 'alert' && alertCount(r) === 0 && !isEmpty(r)) return false
    return true
  }).sort((a, b) => {
    if (sortMode === 'name') return (a.name ?? '').localeCompare(b.name ?? '', 'ko')
    if (sortMode === 'room')
      return ((a as any).floor ?? '').localeCompare((b as any).floor ?? '') ||
        ((a as any).room ?? '999').localeCompare((b as any).room ?? '999') ||
        (a.name ?? '').localeCompare(b.name ?? '', 'ko')
    if (sortMode === 'admission')
      return (a.admission_date ?? '9999').localeCompare(b.admission_date ?? '9999')
    // 급한 순: 만료 → 갱신 기간(만료 임박순) → 조치 필요 건수 많은 순 → 서류 빈 신규 → 나머지 가나다
    const rank = (r: ResidentDoc) => {
      const i = docInfo(r)
      if (i.st.status === 'expired') return 0
      if (i.st.status === 'renew') return 1
      if (isEmpty(r)) return 2
      if (alertCount(r) > 0) return 3
      return 4
    }
    const da = docInfo(a).st.daysToEnd ?? 9999, db2 = docInfo(b).st.daysToEnd ?? 9999
    return rank(a) - rank(b) || da - db2 || alertCount(b) - alertCount(a) ||
      (a.name ?? '').localeCompare(b.name ?? '', 'ko')
  }), [rows, search, fee, floorF, quick, sortMode])

  const th = 'px-1.5 py-1.5 text-[11px] font-bold text-gray-500 whitespace-nowrap text-center border-b border-gray-200'
  const td = 'px-1.5 py-1.5 text-xs align-top border-b border-gray-50'

  /**
   * 서류 일시 셀 — '다음에 할 일'이 먼저 보이도록 구성한다.
   * 시트에서는 전부 나열하고 눈으로 훑었지만, 화면에서는 위에서 5건만 보이면
   * 정작 다음 예정이 접힌 채 숨는다. 그래서 다음 예정 → 미정 → 직전 기록 순으로 세운다.
   */
  const DocCell = ({ id, type, items, admission }: { id: string; type: DocType; items?: DocEvent[]; admission?: string | null }) => {
    const evs = (items ?? []).map(asEvent).filter(e => e.date || e.memo).filter(e => !admission || !e.date || e.date >= admission)
    if (!evs.length) return <span className="text-gray-300">-</span>
    const today = todayISO()
    const byDate = (a: DocEvent, b: DocEvent) => (a.date || '9999').localeCompare(b.date || '9999')

    const dated = evs.filter(e => e.date).sort(byDate)
    const undated = evs.filter(e => !e.date)                       // '시설급여 나온시점'처럼 날짜 미정
    const isDone = (e: DocEvent) => effStatus(e) === '완료'
    const upcoming = dated.filter(e => !isDone(e) && e.date! >= today)
    const overdue = dated.filter(e => !isDone(e) && e.date! < today)
    const past = dated.filter(e => isDone(e) || e.date! < today)

    const next = overdue[0] ?? upcoming[0] ?? null                 // 지난 미완료가 가장 급하다
    const lastDone = [...past].reverse().find(e => e !== next) ?? null
    const key = `${id}|${type}`, open = exp.has(key)

    const dnum = (iso: string) =>
      Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)

    const row = (e: DocEvent, rk: string, mode: 'next' | 'dim' | 'plain' = 'plain') => {
      const meta = kindMeta(type, e.kind) ?? KINDS[type][0]
      const st = statusMeta(effStatus(e))          // 상태(완료·미비·서명미비·챙길것)가 색을 결정
      const done = st?.v === '완료'
      const marked = isExplicitDone(e)             // 직접 완료 체크한 것만 체크표시/취소선
      const implicit = isImplicitDone(e)           // 날짜가 지나 완료로 본 것 — 흐리게만
      const late = !done && !!e.date && e.date < today
      return (
        <div key={rk} className="whitespace-nowrap flex items-center gap-1">
          {marked
            ? <Check className="w-3 h-3 shrink-0 text-green-600" strokeWidth={3} />
            : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st && !implicit ? st.dot : meta.dot} ${mode === 'dim' || implicit ? 'opacity-40' : ''}`} />}
          <span className={`font-semibold ${marked ? 'line-through text-gray-400' : implicit ? 'text-gray-400' : st ? st.text : mode === 'dim' ? 'text-gray-400' : late ? 'text-red-600' : meta.text} ${mode === 'next' ? 'text-[13px]' : ''}`}>
            {e.date ? fmtYMD(e.date) : '미정'}
          </span>
          {st && st.alert && <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${st.chip}`}>{st.short}</span>}
          {e.kind && e.kind !== '기준' && <span className="text-[10px] text-gray-400">({e.kind})</span>}
          {e.memo && <span className="text-[11px] text-gray-400 truncate max-w-[7rem]">· {e.memo}</span>}
          {mode === 'next' && e.date && (
            <span className={`text-[10px] font-extrabold px-1 py-0.5 rounded ${late ? 'bg-red-500 text-white' : dnum(e.date) <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
              {late ? `지연 ${-dnum(e.date)}일` : dnum(e.date) === 0 ? '오늘' : `D-${dnum(e.date)}`}
            </span>
          )}
        </div>
      )
    }

    if (open) {
      return (
        <div className="space-y-0.5">
          {[...dated, ...undated].map((e, i) => row(e, `a${i}`, e === next ? 'next' : (e.done || (!!e.date && e.date < today)) && e !== next ? 'dim' : 'plain'))}
          <button onClick={() => toggleExp(key)} className="text-[10px] text-indigo-500">접기 ▴</button>
        </div>
      )
    }
    const hiddenCount = evs.length - (next ? 1 : 0) - undated.length - (lastDone ? 1 : 0)
    return (
      <div className="space-y-0.5">
        {next ? row(next, 'next', 'next') : <span className="text-[11px] text-gray-300">예정 없음</span>}
        {undated.map((e, i) => row(e, `u${i}`))}
        {lastDone && row(lastDone, 'last', 'dim')}
        {hiddenCount > 0 && (
          <button onClick={() => toggleExp(key)} className="text-[10px] text-indigo-500">전체 {evs.length}건 ▾</button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-teal-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">어르신 서류 현황</h1>
            <p className="text-xs text-gray-400">인정서·계약서·급여제공계획서·평가 일시를 관리합니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRulesOn(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-semibold ${rulesOn ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <HelpCircle className="w-4 h-4" /> 작성 기준
          </button>
          <button onClick={() => setHistOpen({})} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <History className="w-4 h-4" /> 수정 이력
          </button>
          <button onClick={() => setSopOpen(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <BookOpen className="w-4 h-4" /> 서류 절차 안내
          </button>
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-sm">
            <Plus className="w-4 h-4" /> 어르신 추가
          </button>
        </div>
      </div>

      {sopOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 text-sm">
          <p className="font-bold text-amber-800 mb-1.5">★ 인정서·개장기 갱신 서류 도착 시 처리 순서 ★</p>
          <pre className="whitespace-pre-wrap text-[13px] text-amber-800 leading-relaxed font-sans">{SOP}</pre>
          <p className="font-bold text-amber-800 mt-3 mb-1">보호자 안내 문자 예시</p>
          <div className="bg-white rounded-lg p-2.5 text-[13px] text-gray-600">{SMS}</div>
        </div>
      )}

      {/* 요약 알림 — 클릭하면 필터 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <button onClick={() => setQuick('all')}
          className={`rounded-xl p-3 text-left border transition-colors ${quick === 'all' ? 'bg-teal-50 border-teal-300' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
          <p className="text-[11px] font-semibold text-gray-500">전체 어르신</p>
          <p className="text-xl font-extrabold text-gray-900">{summary.total}<span className="text-sm font-bold text-gray-400">명</span></p>
        </button>
        <button onClick={() => setQuick(quick === 'cert' ? 'all' : 'cert')}
          className={`rounded-xl p-3 text-left border transition-colors ${quick === 'cert' ? 'bg-amber-100 border-amber-300' : summary.cert > 0 ? 'bg-amber-50 border-amber-100 hover:border-amber-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[11px] font-semibold text-amber-600">갱신 대상 (종료 90일↓)</p>
          <p className={`text-xl font-extrabold ${summary.cert > 0 ? 'text-amber-700' : 'text-gray-300'}`}>{summary.cert}<span className="text-sm font-bold text-gray-400">명</span></p>
        </button>
        <button onClick={() => setQuick(quick === 'month' ? 'all' : 'month')}
          className={`rounded-xl p-3 text-left border transition-colors ${quick === 'month' ? 'bg-blue-100 border-blue-300' : summary.month > 0 ? 'bg-blue-50 border-blue-100 hover:border-blue-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[11px] font-semibold text-blue-600">이번 달 갱신 기준일</p>
          <p className={`text-xl font-extrabold ${summary.month > 0 ? 'text-blue-700' : 'text-gray-300'}`}>{summary.month}<span className="text-sm font-bold text-gray-400">명</span></p>
        </button>
        <button onClick={() => setQuick(quick === 'alert' ? 'all' : 'alert')}
          className={`rounded-xl p-3 text-left border transition-colors ${quick === 'alert' ? 'bg-red-100 border-red-300' : (summary.alerts + summary.empty) > 0 ? 'bg-red-50 border-red-100 hover:border-red-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[11px] font-semibold text-red-600">챙겨야 할 서류</p>
          <p className={`text-xl font-extrabold ${(summary.alerts + summary.empty) > 0 ? 'text-red-700' : 'text-gray-300'}`}>
            {summary.alerts}<span className="text-sm font-bold text-gray-400">건</span>
            {summary.empty > 0 && <span className="text-[11px] font-bold text-red-500 ml-1">· 미등록 {summary.empty}명</span>}
          </p>
        </button>
      </div>

      <div className="flex items-center gap-2.5 mb-2 flex-wrap px-0.5">
        <span className="text-[11px] font-semibold text-gray-400">서류 상태</span>
        {STATUSES.map(st => (
          <span key={st.v} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <span className={`w-2 h-2 rounded-full ${st.dot}`} /> {st.label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="어르신 성함 검색"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 w-40" />
        <select value={careF} onChange={e => setCareF(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200">
          <option value="">전체 구분</option>
          {CARE_TYPES.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
        <select value={fee} onChange={e => setFee(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200">
          <option value="">전체 급여</option>
          <option value="시설">시설</option>
          <option value="재가">재가</option>
          <option value="등급외">등급외</option>
        </select>
        {floors.length > 0 && (
          <select value={floorF} onChange={e => setFloorF(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200">
            <option value="">전체 층</option>
            {floors.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer ml-1">
          <input type="checkbox" checked={showDischarged} onChange={e => setShowDischarged(e.target.checked)} className="accent-teal-600" /> 퇴소 포함
        </label>
        <div className="inline-flex bg-gray-100 rounded-xl p-0.5 ml-auto">
          {([['name', '가나다'], ['urgent', '급한 순'], ['room', '호실'], ['admission', '입소일']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setSortMode(v)}
              title={v === 'urgent' ? '만료 → 갱신 기간 → 신규(서류 없음) → 조치 필요 순' : undefined}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${sortMode === v ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{filtered.length} / {rows.length}명</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto max-h-[72vh]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-30 bg-white">
              <tr className="bg-gray-50/90">
                <th className={`${th} sticky left-0 z-20 bg-gray-50 text-left border-r border-gray-200 min-w-[110px]`}>어르신 <span className="font-normal text-gray-400">· 입소일</span></th>
                <th className={`${th} text-left`}>인정서 기간</th>
                <th className={th}>등급/급여 <span className="font-normal text-gray-400">· 기준일</span></th>
                <th className={`${th} text-left bg-emerald-50/70 text-emerald-800`}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 align-middle" />계약서 일시</th>
                <th className={`${th} text-left bg-sky-50/70 text-sky-800`}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 mr-1 align-middle" />급여제공 계획서 일시</th>
                <th className={`${th} text-left bg-fuchsia-50/70 text-fuchsia-800`}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-fuchsia-500 mr-1 align-middle" />급여제공 결과평가 일시</th>
                <th className={th}></th>
              </tr>
              {rulesOn && (() => {
                const rc = 'px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-800 align-top border-b border-amber-200 bg-amber-50/70'
                const cell = (k: string) => (
                  <td className={rc}>
                    {(COL_RULES[k] ?? []).map((t, i) => <div key={i} className="whitespace-nowrap">· {t}</div>)}
                  </td>
                )
                return (
                  <tr>
                    <td className={`${rc} sticky left-0 z-20 bg-amber-50 border-r border-amber-200`}>
                      <div className="whitespace-nowrap">· ㄱㄴㄷ순 정렬</div>
                    </td>
                    {cell('cert')}
                    <td className={rc}>
                      {[...(COL_RULES['grade'] ?? []), ...(COL_RULES['base'] ?? [])].map((t, i) => <div key={i} className="whitespace-nowrap">· {t}</div>)}
                    </td>
                    {cell('contract')}{cell('plan')}{cell('eval')}
                    <td className={rc} />
                  </tr>
                )
              })()}
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}
                  onClick={e => {
                    // 셀 안의 버튼(펼치기·이력 등)을 눌렀을 땐 행 클릭으로 안 잡는다
                    if ((e.target as HTMLElement).closest('button, a, input, select')) return
                    setEditing(r)
                  }}
                  title="행을 누르면 수정이 열립니다"
                  className={`group cursor-pointer hover:bg-teal-50/30 ${r.active === false ? 'opacity-50' : ''} ${(() => {
                    // ② 행 위험 신호 — 인정서 만료(빨강)·갱신 기간(주황)을 왼쪽 띠로
                    const st = certState(currentCert(r.certifications ?? []))
                    return st.status === 'expired' ? 'shadow-[inset_3px_0_0_#dc2626]'
                      : st.status === 'renew' ? 'shadow-[inset_3px_0_0_#f59e0b]' : ''
                  })()}`}>
                  <td className={`${td} sticky left-0 z-10 bg-white group-hover:bg-teal-50/40 border-r border-gray-100 whitespace-nowrap`}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] text-gray-300">{rankById.get(r.id)}</span>
                      <span className="text-sm font-bold text-gray-800">{r.name || '-'}</span>
                      {(r.floor || (r as any).room) && (
                        <span className="text-[10px] font-semibold text-gray-400">
                          {[r.floor, (r as any).room ? `${(r as any).room}호` : ''].filter(Boolean).join(' ')}
                        </span>
                      )}
                      {r.active === false && <span className="text-[9px] font-bold text-white bg-gray-400 px-1 py-0.5 rounded">퇴소</span>}
                      {isEmpty(r) && <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded">서류 미등록</span>}
                      {deriveCare(r.certifications) !== '시설' && (
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${careMeta(deriveCare(r.certifications)).cls}`}>{careMeta(deriveCare(r.certifications)).short}</span>
                      )}
                    </div>
                    {needsFacilityApply(r.certifications) && r.apply_stage && (() => {
                      const st = stageMeta(r.apply_stage)!
                      return (
                        <div className="mt-1 flex items-center gap-1">
                          <div className="w-14 h-1 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full ${st.bar}`} style={{ width: `${Math.max(8, stageProgress(r.apply_stage))}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-gray-500">{st.label}</span>
                        </div>
                      )
                    })()}
                    {needsFacilityApply(r.certifications) && (() => {
                      const f = r.followup_date
                      const d = f ? Math.round((new Date(f + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) : null
                      const due = d !== null && d <= 0
                      return (
                        <div className={`text-[10px] mt-0.5 font-semibold ${!f || due ? 'text-red-500' : 'text-gray-400'}`}>
                          {!f ? '확인일 미정' : due ? `확인일 지남 (${fmtD(f)})` : `확인 ${fmtD(f)} (D-${d})`}
                        </div>
                      )
                    })()}
                  </td>
                  <td className={`${td} text-gray-500`}>
                    {r.certifications && r.certifications.length > 0 ? (() => {
                      const certs = r.certifications!
                      // 추가된(현재) 인정서 = 편집기의 '· 현재'(마지막 항목) — 항상 보이게, 나머지는 더보기
                      const cur = certs[certs.length - 1]
                      const others = certs.filter(c => c !== cur)
                      const st = certState(cur)
                      const badge = st.status === 'expired' ? { t: '만료 지남', c: 'bg-red-100 text-red-600' }
                        : st.status === 'renew' ? { t: `갱신대상 D-${Math.max(0, st.daysToEnd ?? 0)}`, c: 'bg-amber-100 text-amber-700' } : null
                      const key = `${r.id}|cert`, open = exp.has(key)
                      const line = (c: typeof cur) => `${gradeLabel(c)}${benefitLabel(c) ? ' · ' + benefitLabel(c) : ''}`
                      return (
                        <button onClick={() => toggleExp(key)} className="text-left">
                          {open ? (
                            <div className="space-y-0.5">
                              {[cur, ...others].map((c, i) => (
                                <div key={i} className={`whitespace-nowrap ${c === cur ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>
                                  <span className="text-teal-600">{line(c)}</span> {fmtD(c.start) || '?'}~{fmtD(c.end) || '진행'}
                                  {c === cur && <span className="text-[10px] text-primary-orange ml-1">· 현재</span>}
                                </div>
                              ))}
                              <span className="text-[10px] text-indigo-500">접기 ▴</span>
                            </div>
                          ) : (
                            <div className="whitespace-nowrap">
                              <span className="font-semibold text-gray-700"><span className="text-teal-600">{line(cur)}</span> {fmtD(cur.start) || '?'}~{fmtD(cur.end) || '진행'}</span>
                              {others.length > 0 && <span className="text-[10px] text-indigo-500 ml-1">외 {others.length}건 ▾</span>}
                            </div>
                          )}
                          {cur.end && (() => {
                            const st = certState(cur)
                            const dDue = daysUntil(renewalDue(cur.end))   // 갱신 가능일(만료 90일 전)까지
                            if (st.status === 'expired')
                              return <div className="text-[10px] font-bold text-red-600 mt-0.5">만료됨 ({fmtD(cur.end)})</div>
                            if (st.status === 'renew')
                              return <div className={`text-[10px] font-bold mt-0.5 ${st.daysToEnd !== null && st.daysToEnd <= 30 ? 'text-red-600' : 'text-amber-600'}`}>
                                갱신 기간 — 만료 D-{st.daysToEnd}
                              </div>
                            return <div className="text-[10px] text-gray-400 mt-0.5">
                              갱신기준 {renewalDue(cur.end)} <b className="text-gray-500">(D-{dDue})</b>
                            </div>
                          })()}
                          {badge && <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.c}`}>{badge.t}</span>}
                        </button>
                      )
                    })() : <span className="text-gray-300">-</span>}
                  </td>
                  <td className={`${td} text-gray-600 text-center whitespace-pre-line ${docInfo(r).renew ? 'bg-blue-50' : ''}`}>
                    {r.grade || '-'}
                    {r.base_date && (
                      <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                        기준 {fmtMD(r.base_date)} <span className="text-gray-300">(6개월 {plus6(r.base_date)})</span>
                        {docInfo(r).renew && <span className="ml-1 inline-block text-[9px] font-bold text-blue-600 bg-blue-100 px-1 py-0.5 rounded-full">이번 달</span>}
                      </div>
                    )}
                  </td>
                  <td className={`${td} text-gray-500 bg-emerald-50/25`}><DocCell id={r.id} type="contract" items={r.contract_lines} admission={r.admission_date} /></td>
                  <td className={`${td} text-gray-500 bg-sky-50/25`}><DocCell id={r.id} type="plan" items={r.plan_lines} admission={r.admission_date} /></td>
                  <td className={`${td} text-gray-500 bg-fuchsia-50/25`}><DocCell id={r.id} type="eval" items={r.eval_lines} admission={r.admission_date} /></td>
                  <td className={`${td} text-center whitespace-nowrap`}>
                    <button onClick={() => setEditing(r)}
                      className="text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-100 hover:bg-teal-100 px-2.5 py-1 rounded-full">수정</button>
                    <button onClick={() => setHistOpen({ id: r.id, name: r.name || '' })} title="이 어르신의 수정 이력"
                      aria-label="수정 이력" className="ml-0.5 p-1 text-gray-300 hover:text-teal-600 rounded hover:bg-teal-50 align-middle">
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-sm text-gray-400">{rows.length === 0 ? '등록된 어르신이 없습니다.' : '조건에 맞는 어르신이 없습니다.'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">💡 계약서·계획서·평가 칸에는 <b className="text-gray-500">다음에 할 일</b>이 D-day와 함께 맨 위에 옵니다. 「전체 N건」을 누르면 지난 기록까지 펼쳐집니다. 열별 작성 규칙이 항상 표시됩니다 — 필요 없으면 상단 「작성 기준」 버튼으로 끄세요.</p>

      {histOpen && (
        <DocChangesModal docId={histOpen.id} name={histOpen.name} onClose={() => setHistOpen(null)} />
      )}

      {(addOpen || editing) && (
        <DocFormModal editing={editing} residents={residents} docByResident={new Map(rows.filter(r => r.resident_id).map(r => [r.resident_id as string, r]))} onClose={() => { setAddOpen(false); setEditing(null) }} onSaved={() => { setAddOpen(false); setEditing(null); load() }} />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>{children}</div>
}

const Sec = ({ n, t, hint }: { n: string; t: string; hint?: string }) => (
  <div className="flex items-center gap-2 pt-2 mt-1 border-t border-gray-100 first:border-0 first:mt-0 first:pt-0">
    <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{n}</span>
    <span className="text-sm font-bold text-gray-800">{t}</span>
    {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
  </div>
)

function DocFormModal({ editing, residents = [], docByResident = new Map<string, ResidentDoc>(), onClose, onSaved }: { editing: ResidentDoc | null; residents?: LtcResident[]; docByResident?: Map<string, ResidentDoc>; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing
  const [f, setF] = useState<DocInput>({
    resident_id: editing?.resident_id ?? null, name: editing?.name ?? '', admission_date: editing?.admission_date ?? '', floor: editing?.floor ?? '2층',
    followup_date: editing?.followup_date ?? '',
    apply_stage: editing?.apply_stage ?? null, apply_note: editing?.apply_note ?? '', guardian_notified_at: editing?.guardian_notified_at ?? '',
    certifications: editing?.certifications ? editing.certifications.map(c => ({ ...c, benefits: (c.benefits ?? []).map(b => ({ ...b })) })) : [],
    contract_lines: editing?.contract_lines ?? [], plan_lines: editing?.plan_lines ?? [], eval_lines: editing?.eval_lines ?? [],
    memo: editing?.memo ?? '', active: editing?.active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  // 처음 상태 스냅샷 — 실수로 배경을 눌러 입력을 날리는 사고를 막는 기준
  const [initial] = useState(() => JSON.stringify(f))
  const dirty = JSON.stringify(f) !== initial
  const safeClose = () => {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 닫을까요?')) return
    onClose()
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200'

  const submit = async () => {
    if (!f.name?.trim()) { setErr('어르신 성함을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      if (isEdit) await residentDocAPI.update(editing!.id, f); else await residentDocAPI.create(f)
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }
  const autoFill = () => {
    const a = autoDocEvents(f.certifications ?? [], f.admission_date)
    // 기존 일시는 건드리지 않고, 없는 날짜만 새로 더한다.
    // 갱신 인정서를 추가했을 때 이미 적어둔 기록이 사라지면 안 되기 때문.
    const c = appendAuto(f.contract_lines, a.contract)
    const pl = appendAuto(f.plan_lines, a.plan)
    const ev = appendAuto(f.eval_lines, a.eval)
    const total = c.added + pl.added + ev.added
    setF(p => ({ ...p, contract_lines: c.next, plan_lines: pl.next, eval_lines: ev.next }))
    alert(total === 0
      ? '새로 추가할 일시가 없습니다. (이미 모두 등록되어 있습니다)'
      : `일시 ${total}건을 추가했습니다.\n계약서 ${c.added} · 계획서 ${pl.added} · 평가 ${ev.added}건\n\n기존 기록은 그대로 두었습니다.`)
  }
  const del = async () => { if (!isEdit || !confirm('이 기록을 삭제할까요?')) return; setSaving(true); try { await residentDocAPI.remove(editing!.id); onSaved() } finally { setSaving(false) } }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={safeClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900">
            {isEdit ? '어르신 서류 수정' : '어르신 추가'}
            {dirty && <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 align-middle">수정 중</span>}
          </h3>
          <button onClick={safeClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {!isEdit && (() => {
            const actives = residents.filter(r => r.status === 'active')
            if (actives.length === 0) return null
            const picked = actives.find(x => x.id === f.resident_id)
            const pickedDoc = picked ? docByResident.get(picked.id) : undefined
            const certCount = pickedDoc?.certifications?.length ?? 0
            return (
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                <label className="text-xs font-semibold text-teal-700 mb-1 block">기존 수급자에서 불러오기</label>
                <select className={inp} value={f.resident_id ?? ''} onChange={e => {
                  const r = actives.find(x => x.id === e.target.value)
                  if (!r) { setF(p => ({ ...p, resident_id: null })); return }
                  const doc = docByResident.get(r.id)
                  const certs = doc?.certifications ? doc.certifications.map(c => ({ ...c, benefits: (c.benefits ?? []).map(b => ({ ...b })) })) : undefined
                  setF(p => ({
                    ...p, resident_id: r.id, name: r.name, admission_date: r.admissionDate,
                    base_date: doc?.base_date || r.careGradeStartDate,
                    ...(certs ? { certifications: certs } : {}),
                  }))
                }}>
                  <option value="">직접 입력</option>
                  {actives.map(r => {
                    const cnt = docByResident.get(r.id)?.certifications?.length ?? 0
                    return <option key={r.id} value={r.id}>{r.name} (입소 {r.admissionDate || '-'}){docByResident.has(r.id) ? ` · 등록됨${cnt ? ` (인정서 ${cnt}건)` : ''}` : ''}</option>
                  })}
                </select>
                {pickedDoc
                  ? <p className="text-[11px] text-amber-600 mt-1">⚠ 이미 서류가 등록된 수급자입니다{certCount ? ` — 인정서 갱신 이력 ${certCount}건을 함께 불러왔습니다` : ''}. 기존 기록 수정 권장.</p>
                  : <p className="text-[11px] text-teal-500 mt-1">선택하면 성함·입소일·인정서 이력이 자동으로 채워지고 수급자와 연동됩니다.</p>}
              </div>
            )
          })()}
          <Sec n="1" t="기본 정보" />
          <div className="grid grid-cols-3 gap-2">
            <Field label="성함 *"><input value={f.name ?? ''} onChange={e => setF({ ...f, name: e.target.value })} className={inp} autoFocus /></Field>
            <Field label="입소일"><DateField value={f.admission_date} onChange={v => setF({ ...f, admission_date: v })} className={inp} /></Field>
            <Field label="생활 층">
              <select value={f.floor ?? '2층'} onChange={e => setF({ ...f, floor: e.target.value })} className={inp}>
                {['1층','2층','3층','4층','5층'].map(fl => <option key={fl} value={fl}>{fl}</option>)}
              </select>
            </Field>
          </div>
          <Sec n="2" t="장기요양인정서" hint="구분(시설·재가)은 여기서 자동으로 정해집니다" />
          <div className="flex items-center gap-2 flex-wrap rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
            <span className="text-xs font-semibold text-gray-500">구분</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${careMeta(deriveCare(f.certifications)).cls}`}>
              {careMeta(deriveCare(f.certifications)).label}
            </span>
            <span className="text-[11px] text-gray-400">아래 인정서의 급여에서 자동으로 정해집니다</span>
          </div>
          {needsFacilityApply(f.certifications) && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-2.5 space-y-2">
              <p className="text-[11px] font-bold text-violet-700">시설급여 신청 진행</p>
              <div className="flex gap-1.5 flex-wrap">
                {APPLY_STAGES.map(st => (
                  <button key={st.v} type="button" onClick={() => setF({ ...f, apply_stage: st.v })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${f.apply_stage === st.v ? st.cls + ' ring-2 ring-offset-1 ring-violet-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                    {st.label}
                  </button>
                ))}
              </div>
              {f.apply_stage && (
                <p className="text-[11px] text-violet-700">↳ {stageMeta(f.apply_stage)?.guide}</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Field label="다음 확인일">
                  <DateField value={f.followup_date} onChange={v => setF({ ...f, followup_date: v })} className={inp} />
                </Field>
                <Field label="보호자 안내일">
                  <DateField value={f.guardian_notified_at} onChange={v => setF({ ...f, guardian_notified_at: v })} className={inp} />
                </Field>
                <Field label="진행 메모">
                  <input value={f.apply_note ?? ''} onChange={e => setF({ ...f, apply_note: e.target.value })} className={inp} placeholder="예: 의사소견서 제출 대기" />
                </Field>
              </div>
              <p className="text-[11px] text-violet-500">보호자에게 마지막으로 설명한 날을 적어두면, 오래됐을 때 대시보드가 알려줍니다.</p>
            </div>
          )}
          <div>
            <label className="text-[11px] text-gray-400 mb-1.5 block">등급 · 유효기간(2/3/4년) · 급여(재가↔시설) — 종료 90일 전부터 갱신</label>
            <CertificationEditor value={f.certifications ?? []} onChange={cs => setF({ ...f, certifications: cs })} />
          </div>
          <Sec n="3" t="서류 일시" hint="계약서 · 계획서 · 평가 — 아래 버튼이 인정서 기준으로 채워줍니다" />
          <button type="button" onClick={autoFill} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100">
            <RefreshCw className="w-3.5 h-3.5" /> 인정서 기준으로 일시 추가 <span className="font-normal text-teal-500">(기존 기록은 유지)</span>
          </button>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> 계약서 일시
            </p>
            <DocEventsEditor type="contract" value={f.contract_lines} onChange={v => setF({ ...f, contract_lines: v })} defaultAddKind="변경" addLabel="+ 일시 추가" />
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-sky-700 mb-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> 급여제공계획서 일시
            </p>
            <DocEventsEditor type="plan" value={f.plan_lines} onChange={v => setF({ ...f, plan_lines: v })} defaultAddKind="변화" addLabel="+ 일시 추가" />
          </div>
          <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-700 mb-2">
              <span className="w-2 h-2 rounded-full bg-fuchsia-500" /> 급여제공 결과평가 일시
            </p>
            <DocEventsEditor type="eval" value={f.eval_lines} onChange={v => setF({ ...f, eval_lines: v })} defaultAddKind="변화" addLabel="+ 일시 추가" />
          </div>
          <Sec n="4" t="상태" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">상태</span>
            <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
              {([['재실', true], ['퇴소', false]] as const).map(([t, v]) => (
                <button key={t} type="button" onClick={() => setF({ ...f, active: v })} className={`px-3 py-1 rounded-md text-xs font-semibold ${!!f.active === v ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-400'}`}>{t}</button>
              ))}
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        {/* 저장 바 — 긴 폼에서도 항상 손 닿는 곳에 (sticky) */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white z-10">
          {isEdit && <button onClick={del} disabled={saving} className="mr-auto px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />삭제</button>}
          <button onClick={safeClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
          <button onClick={submit} disabled={saving || (isEdit && !dirty)}
            title={isEdit && !dirty ? '변경된 내용이 없습니다' : undefined}
            className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{isEdit ? (dirty ? '저장' : '변경 없음') : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
