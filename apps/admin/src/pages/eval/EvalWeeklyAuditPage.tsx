import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Printer, Search, X, Info } from 'lucide-react'
import {
  careLogAuditAPI,
  type WeeklyAuditDetail,
  type WeeklyAuditFinding,
  type WeeklyAuditWeek,
} from '@/api/careLogAuditClient'
import { KIND_LABEL, WEEKLY_WHERE, filterFindings, formatRange, groupByDate, sortStaffRows, staffBreakdown, weeklyPrintDigest, type StaffSortKey } from '@/utils/weeklyAudit'

const KIND_BADGE: Record<WeeklyAuditFinding['kind'], string> = {
  error: 'bg-red-100 text-red-700',
  blank: 'bg-amber-100 text-amber-700',
  check: 'bg-gray-100 text-gray-600',
}

function hhmm(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function EvalWeeklyAuditPage() {
  const [weeks, setWeeks] = useState<WeeklyAuditWeek[]>([])
  const [weekStart, setWeekStart] = useState<string>('')
  const [detail, setDetail] = useState<WeeklyAuditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [staffFilter, setStaffFilter] = useState('')
  const [residentFilter, setResidentFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<StaffSortKey>('default')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // 인쇄 판: 선생님별(표+선생님마다 무엇을 틀렸는지) / 날짜별 확인 목록(며칠·어디서·누구)
  const [printMode, setPrintMode] = useState<'staff' | 'dates'>('dates')

  useEffect(() => {
    let alive = true
    careLogAuditAPI.weeks()
      .then(list => {
        if (!alive) return
        setWeeks(list)
        if (list.length > 0) setWeekStart(list[0].week_start)
        else setLoading(false)
      })
      .catch(e => { if (alive) { setError(e?.message ?? '목록을 불러오지 못했습니다.'); setLoading(false) } })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!weekStart) return
    let alive = true
    setLoading(true)
    careLogAuditAPI.week(weekStart)
      .then(d => { if (alive) { setDetail(d); setLoading(false) } })
      .catch(e => { if (alive) { setError(e?.message ?? '점검 결과를 불러오지 못했습니다.'); setLoading(false) } })
    return () => { alive = false }
  }, [weekStart])

  const staffRows = useMemo(() => sortStaffRows(detail?.summary?.by_staff ?? [], sortKey, sortDir), [detail, sortKey, sortDir])
  // 같은 열을 다시 누르면 방향 반전, 세 번째는 기본 순서로
  const toggleSort = (key: StaffSortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('desc'); return }
    if (sortDir === 'desc') { setSortDir('asc'); return }
    setSortKey('default'); setSortDir('desc')
  }
  const sortMark = (key: StaffSortKey) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''

  const filtered = useMemo(() => {
    if (!detail) return []
    return filterFindings(detail.findings ?? [], {
      staff: staffFilter, resident: residentFilter, area: areaFilter, kind: kindFilter, q,
    })
  }, [detail, staffFilter, residentFilter, areaFilter, kindFilter, q])

  const dateGroups = useMemo(() => groupByDate(filtered), [filtered])
  const printDays = useMemo(() => weeklyPrintDigest(filtered), [filtered])
  const printStaff = useMemo(() => staffBreakdown(detail?.findings ?? []), [detail])
  const printAreas = useMemo(() => Object.keys(detail?.summary?.by_area ?? {}), [detail])
  const hasFilter = !!(staffFilter || residentFilter || areaFilter || kindFilter || q)

  const areas = useMemo(
    () => Object.keys(detail?.summary?.by_area ?? {}),
    [detail],
  )
  const residents = useMemo(
    () => (detail?.summary?.by_resident ?? []).map(r => r.resident),
    [detail],
  )

  const clearFilters = () => {
    setStaffFilter(''); setResidentFilter(''); setAreaFilter(''); setKindFilter(''); setQ('')
  }

  if (loading && weeks.length === 0 && !error) {
    return <div className="text-sm text-gray-400 py-10 text-center">불러오는 중…</div>
  }

  if (!loading && weeks.length === 0) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          아직 점검 결과가 없습니다 — 매주 일요일 15:00 자동 점검
        </div>
      </div>
    )
  }

  const summary = detail?.summary

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Header />
      </div>

      {/* 인쇄본 — 화면 대신 압축 표만 찍는다 (간호기록 점검과 같은 방식) */}
      {detail && (
        <div className="hidden print:block nursing-print">
          <h1 className="text-base font-bold">행복한요양원 주간 기록지 점검 — {formatRange(detail.week_start, detail.week_end)} · {printMode === 'staff' ? '선생님별' : '날짜별 확인 목록'}</h1>
          <p className="text-[10px] text-gray-500 mb-2">
            총 {summary?.total ?? 0}건 (오류 {summary?.by_kind?.error ?? 0} · 공란 {summary?.by_kind?.blank ?? 0} · 확인 {summary?.by_kind?.check ?? 0}) · 대상 {detail.coverage?.residents ?? '-'}명 · 점검 {hhmm(detail.generated_at)} · 출력 {hhmm(new Date().toISOString())}
            {printMode === 'dates' && hasFilter && <> · 필터: {[staffFilter, residentFilter, areaFilter, kindFilter && KIND_LABEL[kindFilter as WeeklyAuditFinding['kind']], q].filter(Boolean).join(' · ')} — {filtered.length}건</>}
          </p>

          {printMode === 'staff' ? (
            <>
              <table className="w-full text-[10px] border-collapse table-fixed mb-3">
                <colgroup><col style={{ width: '12%' }} /><col style={{ width: '7%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8%' }} /><col style={{ width: '41%' }} /></colgroup>
                <thead><tr className="border-b border-gray-400 text-left">
                  <th className="py-0.5 pr-2">선생님</th><th className="py-0.5 pr-2 text-right">오류</th><th className="py-0.5 pr-2 text-right">공란후보</th><th className="py-0.5 pr-2 text-right">공동</th><th className="py-0.5 pr-2 text-right">확인</th><th className="py-0.5 pr-2 text-right">작성횟수</th><th className="py-0.5 pr-2 text-right">오류율</th><th className="py-0.5">무엇을 틀렸나 (오류 건수 · 공란 후보)</th>
                </tr></thead>
                <tbody>
                  {staffRows.map(r => {
                    const bd = printStaff.find(x => x.staff === r.staff)
                    return (
                      <tr key={r.staff} className="border-b border-gray-200 align-top">
                        <td className="py-0.5 pr-2 font-semibold">{r.staff}</td>
                        <td className="py-0.5 pr-2 text-right font-bold">{r.error || ''}</td>
                        <td className="py-0.5 pr-2 text-right">{r.blank_owner || ''}</td>
                        <td className="py-0.5 pr-2 text-right">{r.shared || ''}</td>
                        <td className="py-0.5 pr-2 text-right text-gray-500">{r.check || ''}</td>
                        <td className="py-0.5 pr-2 text-right">{r.mentions ?? ''}</td>
                        <td className="py-0.5 pr-2 text-right">{r.error_rate != null ? `${r.error_rate}%` : '-'}</td>
                        <td className="py-0.5 text-gray-700">{(bd?.items ?? []).slice(0, 8).map(i => `${i.label} ${i.count}`).join(', ')}{(bd?.items ?? []).length > 8 ? ` 외 ${(bd?.items ?? []).length - 8}` : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <h2 className="text-xs font-bold mt-2 mb-1">어디서 고치나 (케어포)</h2>
              <table className="w-full text-[10px] border-collapse table-fixed">
                <colgroup><col style={{ width: '18%' }} /><col style={{ width: '82%' }} /></colgroup>
                <tbody>
                  {printAreas.map(a => (
                    <tr key={a} className="border-b border-gray-200 align-top"><td className="py-0.5 pr-2 font-semibold">{a}</td><td className="py-0.5 text-gray-600">{WEEKLY_WHERE[a] || ''}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[9px] text-gray-500 mt-2">공동 = 하루 합계 기준(기저귀 6회·체위변경 12회 등) 미달을 당일 담당자 모두에게 붙인 것. 작성 횟수 = 그 주 기록에 이름이 들어간 횟수, 오류율 = 오류 ÷ 작성 횟수. 작성자는 기록에 지정된 이름 기준.</p>
            </>
          ) : (
            <>
              <table className="w-full text-[10px] border-collapse table-fixed mb-3">
                <colgroup><col style={{ width: '14%' }} /><col style={{ width: '6%' }} /><col style={{ width: '80%' }} /></colgroup>
                <thead><tr className="border-b border-gray-400 text-left"><th className="py-0.5 pr-2">분야</th><th className="py-0.5 pr-2 text-right">건수</th><th className="py-0.5">어디서 고치나 (케어포)</th></tr></thead>
                <tbody>
                  {printAreas.map(a => (
                    <tr key={a} className="border-b border-gray-200 align-top"><td className="py-0.5 pr-2 font-semibold">{a}</td><td className="py-0.5 pr-2 text-right">{summary?.by_area?.[a] ?? ''}</td><td className="py-0.5 text-gray-600">{WEEKLY_WHERE[a] || ''}</td></tr>
                  ))}
                </tbody>
              </table>
              <h2 className="text-xs font-bold mt-2 mb-1">날짜별 확인 목록 <span className="font-normal text-gray-500">(어르신(호실) 문제 작성자 — 같은 어르신·문제는 한 번만)</span></h2>
              <table className="w-full text-[10px] border-collapse table-fixed">
                <colgroup><col style={{ width: '11%' }} /><col style={{ width: '20%' }} /><col style={{ width: '19%' }} /><col style={{ width: '50%' }} /></colgroup>
                <thead><tr className="border-b border-gray-400 text-left">
                  <th className="py-0.5 pr-2">날짜</th><th className="py-0.5 pr-2">어디서</th><th className="py-0.5 pr-2">항목</th><th className="py-0.5">누구 (호실) · 문제 · 작성자</th>
                </tr></thead>
                <tbody>
                  {printDays.map(d => d.lines.map((l, i) => (
                    <tr key={`${d.date}|${i}`} className={`align-top ${i === d.lines.length - 1 ? 'border-b border-gray-300' : ''}`}>
                      <td className="py-0.5 pr-2 font-semibold whitespace-nowrap">{i === 0 ? <>{d.date.slice(5).replace('-', '/')}({d.weekday})<div className="font-normal text-gray-500">오류 {d.error} · 공란 {d.blank} · 확인 {d.check}</div></> : ''}</td>
                      <td className="py-0.5 pr-2 text-gray-600">{l.where}</td>
                      <td className="py-0.5 pr-2"><span className={l.kind === 'error' ? 'font-bold' : ''}>{KIND_LABEL[l.kind]}</span> {l.item} <span className="text-gray-500">{l.count}</span></td>
                      <td className="py-0.5">{l.text}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
              <p className="text-[9px] text-gray-500 mt-2">오류 = 작성자에게 귀속되는 기록 오류 · 공란 = 작성자 없음(책임 후보 표시) · 확인 = 외출·근무표 등 상황 확인 뒤 판단. 작성자는 기록에 지정된 이름 기준.</p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 print:hidden">{error}</div>
      )}

      {/* 주 선택 · 기간 · 요약 칩 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={weekStart}
            onChange={e => setWeekStart(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 font-semibold text-gray-700"
          >
            {weeks.map(w => (
              <option key={w.week_start} value={w.week_start}>
                {formatRange(w.week_start, w.week_end)}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-1.5">
            <select
              value={printMode}
              onChange={e => setPrintMode(e.target.value as 'staff' | 'dates')}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600"
              title="인쇄 판 선택"
            >
              <option value="dates">인쇄: 날짜별 확인 목록</option>
              <option value="staff">인쇄: 선생님별</option>
            </select>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
            >
              <Printer size={13} /> 인쇄
            </button>
          </div>
        </div>

        {detail && (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-bold text-gray-900">{formatRange(detail.week_start, detail.week_end)}</h2>
              <span className="text-xs text-gray-400">생성 {hhmm(detail.generated_at)}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Chip label={`총 ${summary?.total ?? 0}건`} tone="bg-gray-800 text-white" />
              <Chip label={`오류 ${summary?.by_kind?.error ?? 0}`} tone="bg-red-100 text-red-700" />
              <Chip label={`공란 ${summary?.by_kind?.blank ?? 0}`} tone="bg-amber-100 text-amber-700" />
              <Chip label={`확인 ${summary?.by_kind?.check ?? 0}`} tone="bg-gray-100 text-gray-600" />
              {typeof detail.coverage?.residents === 'number' && (
                <Chip label={`대상 어르신 ${detail.coverage.residents}명`} tone="bg-blue-50 text-blue-600" />
              )}
              {typeof detail.coverage?.resident_days === 'number' && (
                <Chip label={`어르신·일수 ${detail.coverage.resident_days}`} tone="bg-blue-50 text-blue-600" />
              )}
            </div>

            {Array.isArray(detail.coverage?.notes) && detail.coverage.notes.length > 0 && (
              <ul className="text-[11px] text-gray-400 space-y-0.5">
                {detail.coverage.notes.map((n: string, i: number) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* 선생님별 표 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">선생님별</h3>
          {staffFilter && (
            <button onClick={() => setStaffFilter('')} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 print:hidden">
              <X size={11} /> {staffFilter} 필터 해제
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left font-semibold px-4 py-2">
                <button type="button" onClick={() => toggleSort('default')} className="hover:text-gray-800" title="기본 순서(오류+공란+공동)">선생님{sortKey === 'default' ? ' ▼' : ''}</button>
              </th>
              {([
                ['error', '오류', undefined],
                ['blank_owner', '공란(책임후보)', undefined],
                ['shared', '공동', undefined],
                ['check', '확인', undefined],
                ['total', '합계', undefined],
                ['mentions', '작성 횟수', '그 주 기록에 이름이 들어간 횟수 — 신체·인지·식사 작성자, 기저귀·집중배설 행 담당자, 체위변경 제공자'],
                ['error_rate', '오류율', '오류 ÷ 작성 횟수 · 누르면 정렬'],
              ] as [StaffSortKey, string, string | undefined][]).map(([key, label, title]) => (
                <th key={key} className="text-right font-semibold px-4 py-2" title={title}>
                  <button type="button" onClick={() => toggleSort(key)} className={`hover:text-gray-800 ${sortKey === key ? 'text-gray-900' : ''}`}>{label}{sortMark(key)}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {staffRows.map(r => (
              <tr
                key={r.staff}
                onClick={() => setStaffFilter(cur => cur === r.staff ? '' : r.staff)}
                className={`cursor-pointer hover:bg-gray-50 ${staffFilter === r.staff ? 'bg-violet-50' : ''}`}
              >
                <td className="px-4 py-2 font-semibold text-gray-800">{r.staff}</td>
                <td className="px-4 py-2 text-right text-red-600 font-semibold">{r.error}</td>
                <td className="px-4 py-2 text-right text-amber-600 font-semibold">{r.blank_owner}</td>
                <td className="px-4 py-2 text-right text-violet-600 font-semibold">{r.shared ?? 0}</td>
                <td className="px-4 py-2 text-right text-gray-500">{r.check}</td>
                <td className="px-4 py-2 text-right font-bold text-gray-900">{r.total}</td>
                <td className="px-4 py-2 text-right text-gray-700 tabular-nums" title={mentionsTitle(r.mentions_by_area)}>{r.mentions ?? 0}</td>
                <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{r.error_rate != null ? `${r.error_rate}%` : '-'}</td>
              </tr>
            ))}
            {staffRows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-xs">집계된 선생님이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex flex-wrap gap-2 items-center print:hidden">
        <FilterSelect value={residentFilter} onChange={setResidentFilter} placeholder="어르신 전체" options={residents} />
        <FilterSelect value={areaFilter} onChange={setAreaFilter} placeholder="분야 전체" options={areas} />
        <FilterSelect
          value={kindFilter} onChange={setKindFilter} placeholder="종류 전체"
          options={['error', 'blank', 'check']}
          labelOf={(v) => KIND_LABEL[v as WeeklyAuditFinding['kind']]}
        />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="검색어"
            className="text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 w-40"
          />
        </div>
        {(staffFilter || residentFilter || areaFilter || kindFilter || q) && (
          <button onClick={clearFilters} className="text-xs font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <X size={12} /> 필터 초기화
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length}건</span>
      </div>

      {/* 날짜별 상세 */}
      <div className="space-y-3 print:hidden">
        {dateGroups.map(g => (
          <div key={g.date} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <h4 className="text-sm font-bold text-gray-800">
                {g.date}{g.weekday ? `(${g.weekday})` : ''} <span className="text-gray-400 font-normal">· {g.items.length}건</span>
              </h4>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-[11px]">
                  <th className="text-left font-semibold px-4 py-1.5">어르신(호실)</th>
                  <th className="text-left font-semibold px-4 py-1.5">분야/항목</th>
                  <th className="text-left font-semibold px-4 py-1.5">문제</th>
                  <th className="text-left font-semibold px-4 py-1.5">종류</th>
                  <th className="text-left font-semibold px-4 py-1.5">작성자/책임후보</th>
                  <th className="text-left font-semibold px-4 py-1.5">근무대조</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {g.items.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 align-top text-gray-800 font-medium whitespace-nowrap">
                      {item.resident}{item.room ? `(${item.room})` : ''}
                    </td>
                    <td className="px-4 py-2 align-top text-gray-600 whitespace-nowrap">{item.area} / {item.item}</td>
                    <td className="px-4 py-2 align-top text-gray-800">
                      {item.issue}
                      {item.evidence && <div className="text-[10px] text-gray-400 mt-0.5">근거: {item.evidence}</div>}
                    </td>
                    <td className="px-4 py-2 align-top whitespace-nowrap">
                      <span className={`inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full ${KIND_BADGE[item.kind]}`}>
                        {KIND_LABEL[item.kind]}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top text-gray-600">
                      {item.staff
                        ? <>{item.staff}{item.staff_basis && <div className="text-[10px] text-gray-400 mt-0.5">{item.staff_basis}</div>}</>
                        : (item.owner_candidates ?? []).length
                          ? <><span className="text-[10px] font-bold text-amber-700 mr-1">후보</span>{(item.owner_candidates ?? []).join(', ')}{item.owner_basis && <div className="text-[10px] text-gray-400 mt-0.5">{item.owner_basis}</div>}</>
                          : '-'}
                    </td>
                    <td className="px-4 py-2 align-top text-gray-500 whitespace-nowrap">{item.schedule_check || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {dateGroups.length === 0 && detail && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            조건에 맞는 항목이 없습니다.
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 flex items-start gap-1.5 print:hidden">
        <Info size={12} className="mt-0.5 shrink-0" />
        작성자는 기록에 지정된 이름 기준이며 실제 입력자를 뜻하지 않습니다. 공란의 책임 후보는 담당 배정과 근무표에서 계산한 것입니다.
      </p>
    </div>
  )
}

/** 작성 횟수 칸에 마우스를 올리면 분야별 내역 */
function mentionsTitle(byArea?: Record<string, number>): string {
  if (!byArea) return ''
  return Object.entries(byArea).map(([k, v]) => `${k} ${v}`).join(' · ')
}

function Header() {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
        <ClipboardCheck size={20} className="text-primary-orange" />
        주간 기록지 점검
      </h1>
      <p className="text-sm text-gray-500 mt-0.5">케어포 요양급여 제공기록 · 주간 자동 점검 결과</p>
    </div>
  )
}

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tone}`}>{label}</span>
}

function FilterSelect({
  value, onChange, placeholder, options, labelOf,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: string[]
  labelOf?: (v: string) => string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600"
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o} value={o}>{labelOf ? labelOf(o) : o}</option>
      ))}
    </select>
  )
}
