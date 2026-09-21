import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Printer, Search, X, Info } from 'lucide-react'
import {
  careLogAuditAPI,
  type WeeklyAuditDetail,
  type WeeklyAuditFinding,
  type WeeklyAuditWeek,
} from '@/api/careLogAuditClient'
import { KIND_LABEL, filterFindings, formatRange, groupByDate, rankStaff } from '@/utils/weeklyAudit'

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

  const staffRows = useMemo(() => rankStaff(detail?.summary?.by_staff ?? []), [detail])

  const filtered = useMemo(() => {
    if (!detail) return []
    return filterFindings(detail.findings ?? [], {
      staff: staffFilter, resident: residentFilter, area: areaFilter, kind: kindFilter, q,
    })
  }, [detail, staffFilter, residentFilter, areaFilter, kindFilter, q])

  const dateGroups = useMemo(() => groupByDate(filtered), [filtered])

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

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 print:hidden">{error}</div>
      )}

      {/* 주 선택 · 기간 · 요약 칩 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
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
          <button
            onClick={() => window.print()}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
          >
            <Printer size={13} /> 인쇄
          </button>
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
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
              <th className="text-left font-semibold px-4 py-2">선생님</th>
              <th className="text-right font-semibold px-4 py-2">오류</th>
              <th className="text-right font-semibold px-4 py-2">공란(책임후보)</th>
              <th className="text-right font-semibold px-4 py-2">공동</th>
              <th className="text-right font-semibold px-4 py-2">확인</th>
              <th className="text-right font-semibold px-4 py-2">합계</th>
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
              </tr>
            ))}
            {staffRows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-xs">집계된 선생님이 없습니다.</td></tr>
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
      <div className="space-y-3">
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
