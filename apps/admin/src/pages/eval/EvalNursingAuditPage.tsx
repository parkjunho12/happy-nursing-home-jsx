import { useEffect, useMemo, useState } from 'react'
import { Stethoscope, Printer, Search, X, Info } from 'lucide-react'
import {
  nursingAuditAPI,
  type NursingAuditDetail,
  type NursingAuditFinding,
  type NursingAuditMonth,
} from '@/api/nursingAuditClient'
import {
  KIND_LABEL, filterFindings, formatMonth, formatRange, groupByDate, itemMatrix, weeksOfMonth, mondayOf, addDays,
} from '@/utils/nursingAudit'

const KIND_BADGE: Record<NursingAuditFinding['kind'], string> = {
  error: 'bg-red-100 text-red-700',
  check: 'bg-amber-100 text-amber-700',
  info: 'bg-gray-100 text-gray-500',
}

type Mode = 'month' | 'week'

function hhmm(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function EvalNursingAuditPage() {
  const [months, setMonths] = useState<NursingAuditMonth[]>([])
  const [mode, setMode] = useState<Mode>('month')
  const [month, setMonth] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [detail, setDetail] = useState<NursingAuditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [residentFilter, setResidentFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    nursingAuditAPI.months()
      .then(list => {
        if (!alive) return
        setMonths(list)
        if (list.length > 0) {
          setMonth(list[0].month)
          // 주별 기본값: 점검된 마지막 날이 속한 주
          setWeekStart(mondayOf(list[0].window_end))
        } else setLoading(false)
      })
      .catch(e => { if (alive) { setError(e?.message ?? '목록을 불러오지 못했습니다.'); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const monthInfo = useMemo(() => months.find(m => m.month === month), [months, month])
  const weeks = useMemo(() => {
    if (!month) return []
    // 그 달과 겹치는 주 중 점검 시작일 이후에 걸친 주만
    return weeksOfMonth(month).filter(w => !monthInfo || w.start <= monthInfo.window_end)
  }, [month, monthInfo])

  useEffect(() => {
    if (mode !== 'week' || weeks.length === 0) return
    if (!weeks.some(w => w.start === weekStart)) setWeekStart(weeks[0].start)
  }, [mode, weeks, weekStart])

  useEffect(() => {
    if (!month) return
    let alive = true
    setLoading(true); setError(null)
    const p = mode === 'month'
      ? nursingAuditAPI.month(month)
      : (weekStart ? nursingAuditAPI.range(weekStart, addDays(weekStart, 6)) : Promise.resolve(null))
    p.then(d => { if (alive) { setDetail(d); setLoading(false) } })
      .catch(e => {
        if (!alive) return
        setDetail(null)
        setError(e?.response?.status === 404 ? '그 기간의 점검 결과가 없습니다.' : (e?.message ?? '점검 결과를 불러오지 못했습니다.'))
        setLoading(false)
      })
    return () => { alive = false }
  }, [mode, month, weekStart])

  const filtered = useMemo(() => {
    if (!detail) return []
    return filterFindings(detail.findings ?? [], { resident: residentFilter, area: areaFilter, item: itemFilter, kind: kindFilter, staff: staffFilter, q })
  }, [detail, residentFilter, areaFilter, itemFilter, kindFilter, staffFilter, q])

  const dateGroups = useMemo(() => groupByDate(filtered), [filtered])
  const matrix = useMemo(() => itemMatrix(detail?.findings ?? []), [detail])
  const areas = useMemo(() => [...new Set(matrix.map(m => m.area))], [matrix])
  const items = useMemo(() => [...new Set(matrix.filter(m => !areaFilter || m.area === areaFilter).map(m => m.item))], [matrix, areaFilter])
  const residents = useMemo(() => (detail?.summary?.by_resident ?? []).map(r => r.resident), [detail])
  const staffs = useMemo(() => (detail?.summary?.by_staff ?? []).map(r => r.staff), [detail])
  const homeRows = useMemo(() => (detail?.home_nursing ?? []).filter(h => h.home_nursing), [detail])
  const hasFilter = !!(residentFilter || areaFilter || itemFilter || kindFilter || staffFilter || q)
  const clearFilters = () => { setResidentFilter(''); setAreaFilter(''); setItemFilter(''); setKindFilter(''); setStaffFilter(''); setQ('') }

  const periodTitle = detail
    ? (mode === 'month' ? `${formatMonth(month)} (${formatRange(detail.window_start, detail.window_end)})` : formatRange(detail.window_start, detail.window_end))
    : ''

  if (loading && months.length === 0 && !error) {
    return <div className="text-sm text-gray-400 py-10 text-center">불러오는 중…</div>
  }
  if (!loading && months.length === 0) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          아직 점검 결과가 없습니다.
        </div>
      </div>
    )
  }

  const summary = detail?.summary

  return (
    <div className="space-y-4 nursing-audit-print">
      <div className="print:hidden"><Header /></div>

      {/* 인쇄용 머리글 */}
      <div className="hidden print:block">
        <h1 className="text-lg font-bold">행복한요양원 간호기록 점검 — {periodTitle}</h1>
        <p className="text-[11px] text-gray-500">케어포 3-1 간호급여 제공기록 · 투약 / 진료 / 간호일지 / 욕창 / 도뇨관 · 출력 {hhmm(new Date().toISOString())}</p>
      </div>

      {/* 기간 선택 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
            {(['month', 'week'] as Mode[]).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-3 py-1.5 ${mode === m ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {m === 'month' ? '월별' : '주별'}
              </button>
            ))}
          </div>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 font-semibold text-gray-700">
            {months.map(m => <option key={m.month} value={m.month}>{formatMonth(m.month)}</option>)}
          </select>
          {mode === 'week' && (
            <select value={weekStart} onChange={e => setWeekStart(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 font-semibold text-gray-700">
              {weeks.map(w => <option key={w.start} value={w.start}>{w.label}</option>)}
            </select>
          )}
          <button onClick={() => window.print()}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            <Printer size={13} /> 인쇄
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
        {loading && <div className="text-sm text-gray-400">불러오는 중…</div>}

        {detail && !loading && (
          <>
            <div className="flex flex-wrap items-baseline gap-2 print:hidden">
              <h2 className="text-lg font-bold text-gray-900">{periodTitle}</h2>
              <span className="text-xs text-gray-400">점검 {hhmm(detail.generated_at)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip label={`총 ${summary?.total ?? 0}건`} tone="bg-gray-800 text-white" />
              <Chip label={`오류 ${summary?.by_kind?.error ?? 0}`} tone="bg-red-100 text-red-700" />
              <Chip label={`확인 ${summary?.by_kind?.check ?? 0}`} tone="bg-amber-100 text-amber-700" />
              <Chip label={`참고 ${summary?.by_kind?.info ?? 0}`} tone="bg-gray-100 text-gray-500" />
              {typeof detail.coverage?.residents === 'number' && <Chip label={`대상 어르신 ${detail.coverage.residents}명`} tone="bg-blue-50 text-blue-600" />}
              {typeof detail.coverage?.dates === 'number' && <Chip label={`${detail.coverage.dates}일`} tone="bg-blue-50 text-blue-600" />}
            </div>
            {Array.isArray(detail.coverage?.notes) && detail.coverage.notes.length > 0 && (
              <ul className="text-[11px] text-gray-400 space-y-0.5">
                {detail.coverage.notes.slice(0, 8).map((n: string, i: number) => <li key={i}>· {n}</li>)}
              </ul>
            )}
          </>
        )}
      </div>

      {detail && !loading && (
        <>
          {/* 항목별 요약 */}
          <div className="grid gap-4 lg:grid-cols-3 print:block print:space-y-3">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:break-inside-avoid">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">항목별</h3>
                {itemFilter && (
                  <button onClick={() => setItemFilter('')} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 print:hidden">
                    <X size={11} /> {itemFilter} 필터 해제
                  </button>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="text-left font-semibold px-4 py-2">분야</th>
                    <th className="text-left font-semibold px-4 py-2">항목</th>
                    <th className="text-right font-semibold px-4 py-2">오류</th>
                    <th className="text-right font-semibold px-4 py-2">확인</th>
                    <th className="text-right font-semibold px-4 py-2">참고</th>
                    <th className="text-right font-semibold px-4 py-2">합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {matrix.map(r => (
                    <tr key={`${r.area}|${r.item}`}
                      onClick={() => { setAreaFilter(''); setItemFilter(cur => cur === r.item ? '' : r.item) }}
                      className={`cursor-pointer hover:bg-gray-50 ${itemFilter === r.item ? 'bg-violet-50' : ''}`}>
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{r.area}</td>
                      <td className="px-4 py-2 font-semibold text-gray-800">{r.item}</td>
                      <td className="px-4 py-2 text-right text-red-600 font-semibold">{r.error}</td>
                      <td className="px-4 py-2 text-right text-amber-600 font-semibold">{r.check}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{r.info}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900">{r.total}</td>
                    </tr>
                  ))}
                  {matrix.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-xs">지적 항목이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* 어르신별 · 제공자별 */}
            <div className="space-y-4 print:space-y-3">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">어르신별 <span className="text-gray-400 font-normal text-xs">(오류 많은 순)</span></h3>
                  {residentFilter && (
                    <button onClick={() => setResidentFilter('')} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 print:hidden">
                      <X size={11} /> 해제
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-auto print:max-h-none print:overflow-visible">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0"><tr className="bg-gray-50 text-gray-500 text-xs">
                      <th className="text-left font-semibold px-4 py-2">어르신</th>
                      <th className="text-right font-semibold px-3 py-2">오류</th>
                      <th className="text-right font-semibold px-3 py-2">확인</th>
                      <th className="text-right font-semibold px-3 py-2">합계</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {(summary?.by_resident ?? []).map(r => (
                        <tr key={`${r.resident}|${r.room ?? ''}`} onClick={() => setResidentFilter(cur => cur === r.resident ? '' : r.resident)}
                          className={`cursor-pointer hover:bg-gray-50 ${residentFilter === r.resident ? 'bg-violet-50' : ''}`}>
                          <td className="px-4 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{r.resident}<span className="text-gray-400 font-normal text-xs ml-1">{r.room}</span></td>
                          <td className="px-3 py-1.5 text-right text-red-600 font-semibold">{r.error}</td>
                          <td className="px-3 py-1.5 text-right text-amber-600">{r.check}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-gray-900">{r.total}</td>
                        </tr>
                      ))}
                      {(summary?.by_resident ?? []).length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400 text-xs">없음</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">제공자별 <span className="text-gray-400 font-normal text-xs">(기록에 적힌 이름 기준)</span></h3>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="text-left font-semibold px-4 py-2">제공자</th>
                    <th className="text-right font-semibold px-3 py-2">오류</th>
                    <th className="text-right font-semibold px-3 py-2">확인</th>
                    <th className="text-right font-semibold px-3 py-2">합계</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {(summary?.by_staff ?? []).map(r => (
                      <tr key={r.staff} onClick={() => setStaffFilter(cur => cur === r.staff ? '' : r.staff)}
                        className={`cursor-pointer hover:bg-gray-50 ${staffFilter === r.staff ? 'bg-violet-50' : ''}`}>
                        <td className="px-4 py-1.5 font-semibold text-gray-800">{r.staff}</td>
                        <td className="px-3 py-1.5 text-right text-red-600 font-semibold">{r.error}</td>
                        <td className="px-3 py-1.5 text-right text-amber-600">{r.check}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-gray-900">{r.total}</td>
                      </tr>
                    ))}
                    {(summary?.by_staff ?? []).length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400 text-xs">없음</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 가정간호 처치 기록 (청구 대조용) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">가정간호 처치 기록 <span className="text-gray-400 font-normal text-xs">— 욕창간호 {summary?.home_nursing?.['욕창간호'] ?? 0} · 비위관 {summary?.home_nursing?.['비위관'] ?? 0} · 도뇨관 {summary?.home_nursing?.['도뇨관'] ?? 0} (가정간호 청구서와 날짜·처치를 대조하세요)</span></h3>
            </div>
            {homeRows.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">이 기간에 '가정간호'가 적힌 욕창·비위관·도뇨관 기록이 없습니다.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left font-semibold px-4 py-2">날짜</th>
                  <th className="text-left font-semibold px-4 py-2">어르신(호실)</th>
                  <th className="text-left font-semibold px-4 py-2">구분</th>
                  <th className="text-left font-semibold px-4 py-2">기록 내용</th>
                  <th className="text-left font-semibold px-4 py-2">작성자</th>
                  <th className="text-left font-semibold px-4 py-2 print:table-cell">청구 대조</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {homeRows.map((h, i) => (
                    <tr key={`${h.date}|${h.resident}|${h.type}|${i}`}>
                      <td className="px-4 py-1.5 whitespace-nowrap text-gray-700">{h.date.slice(5).replace('-', '/')}({h.weekday})</td>
                      <td className="px-4 py-1.5 whitespace-nowrap font-medium text-gray-800">{h.resident}{h.room ? `(${h.room})` : ''}</td>
                      <td className="px-4 py-1.5 whitespace-nowrap text-gray-600">{h.type}</td>
                      <td className="px-4 py-1.5 text-gray-700">{h.text}</td>
                      <td className="px-4 py-1.5 whitespace-nowrap text-gray-600">{h.writer || '-'}</td>
                      <td className="px-4 py-1.5 text-gray-300">☐ 일치 ☐ 불일치</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 필터 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex flex-wrap gap-2 items-center print:hidden">
            <FilterSelect value={residentFilter} onChange={setResidentFilter} placeholder="어르신 전체" options={residents} />
            <FilterSelect value={areaFilter} onChange={v => { setAreaFilter(v); setItemFilter('') }} placeholder="분야 전체" options={areas} />
            <FilterSelect value={itemFilter} onChange={setItemFilter} placeholder="항목 전체" options={items} />
            <FilterSelect value={kindFilter} onChange={setKindFilter} placeholder="종류 전체" options={['error', 'check', 'info']} labelOf={v => KIND_LABEL[v as NursingAuditFinding['kind']]} />
            <FilterSelect value={staffFilter} onChange={setStaffFilter} placeholder="제공자 전체" options={staffs} />
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색어"
                className="text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 w-36" />
            </div>
            {hasFilter && (
              <button onClick={clearFilters} className="text-xs font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <X size={12} /> 필터 초기화
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">{filtered.length}건</span>
          </div>

          {/* 날짜별 상세 */}
          <div className="space-y-3">
            {hasFilter && (
              <div className="hidden print:block text-[11px] text-gray-500">
                필터: {[residentFilter, areaFilter, itemFilter, kindFilter && KIND_LABEL[kindFilter as NursingAuditFinding['kind']], staffFilter, q].filter(Boolean).join(' · ')} — {filtered.length}건
              </div>
            )}
            {dateGroups.map(g => (
              <div key={g.date} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <h4 className="text-sm font-bold text-gray-800">
                    {g.date}({g.weekday}) <span className="text-gray-400 font-normal">· {g.items.length}건</span>
                  </h4>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-[11px]">
                      <th className="text-left font-semibold px-4 py-1.5">어르신(호실)</th>
                      <th className="text-left font-semibold px-4 py-1.5">분야/항목</th>
                      <th className="text-left font-semibold px-4 py-1.5">시각</th>
                      <th className="text-left font-semibold px-4 py-1.5">내용</th>
                      <th className="text-left font-semibold px-4 py-1.5">종류</th>
                      <th className="text-left font-semibold px-4 py-1.5">제공자</th>
                      <th className="text-left font-semibold px-4 py-1.5">예외·비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {g.items.map(item => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 align-top text-gray-800 font-medium whitespace-nowrap">{item.resident}{item.room ? `(${item.room})` : ''}</td>
                        <td className="px-4 py-2 align-top text-gray-600 whitespace-nowrap">{item.area} / {item.item}</td>
                        <td className="px-4 py-2 align-top text-gray-600 whitespace-nowrap tabular-nums">{item.time || '-'}</td>
                        <td className="px-4 py-2 align-top text-gray-800">
                          {item.issue}
                          {item.evidence && <div className="text-[10px] text-gray-400 mt-0.5">근거: {item.evidence}</div>}
                        </td>
                        <td className="px-4 py-2 align-top whitespace-nowrap">
                          <span className={`inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full ${KIND_BADGE[item.kind]}`}>{KIND_LABEL[item.kind]}</span>
                        </td>
                        <td className="px-4 py-2 align-top text-gray-600 whitespace-nowrap">{item.staff || '-'}</td>
                        <td className="px-4 py-2 align-top text-gray-500 text-xs">{item.exception || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {dateGroups.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">조건에 맞는 항목이 없습니다.</div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 shrink-0" />
            오류 = 기록 기준상 고쳐야 할 것, 확인 = 외출·입소·퇴소 등 상황 확인 뒤 판단, 참고 = 정상일 가능성이 높은 것(전일 외박 등).
            제공자는 기록에 적힌 이름 기준이며 실제 입력자를 뜻하지 않습니다. 가정간호 청구서는 케어포에 없으므로 위 표와 수기로 대조합니다.
          </p>
        </>
      )}
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Stethoscope size={20} className="text-primary-orange" />
        간호기록 점검
      </h1>
      <p className="text-sm text-gray-500 mt-0.5">케어포 3-1 간호급여 제공기록(투약·진료·간호일지·욕창·도뇨관) 월별·주별 점검 — 관리자·시설장</p>
    </div>
  )
}

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tone}`}>{label}</span>
}

function FilterSelect({ value, onChange, placeholder, options, labelOf }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[]; labelOf?: (v: string) => string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600">
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{labelOf ? labelOf(o) : o}</option>)}
    </select>
  )
}
