import { useEffect, useState, useCallback } from 'react'
import { Users, AlertTriangle, CheckCircle2, Info, X, BookOpen, ChevronDown, ChevronUp, Loader2, CalendarClock, HelpCircle } from 'lucide-react'
import DateField from '@/components/ui/DateField'
import {
  staffingAPI, ADMISSION_STATUS, FEASIBILITY,
  type StaffingResult, type StaffingContext, type PlannedAdmission, type Candidate,
} from '@/api/staffingClient'

const fmtD = (s?: string | null) => { if (!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[0]}.${p[1]}.${p[2]}` : s }
const toneCls: Record<string, string> = {
  green: 'bg-green-50 border-green-200 text-green-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle">
      <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-56 bg-gray-900 text-white text-[11px] rounded-lg p-2 opacity-0 group-hover:opacity-100 transition z-[100] leading-relaxed whitespace-pre-line shadow-lg">{text}</span>
    </span>
  )
}

export default function StaffingSimulatorPage() {
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [planned, setPlanned] = useState<PlannedAdmission[]>([{ admission_date: today }])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [ratio, setRatio] = useState(2.1)
  const [dailyHours, setDailyHours] = useState(8)
  const [maxHires, setMaxHires] = useState(3)
  const [fullMonthDay, setFullMonthDay] = useState(3)
  const [ctx, setCtx] = useState<StaffingContext | null>(null)
  const [res, setRes] = useState<StaffingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBasis, setShowBasis] = useState(false)
  const [showHolidays, setShowHolidays] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [manual, setManual] = useState(false)
  const [scenarios, setScenarios] = useState<StaffingResult[] | null>(null)
  const [scenLoading, setScenLoading] = useState(false)
  // 직원별 근무시간 수동 조정 (employee_id → 시간). 값이 없으면 자동 계산.
  const [hourOverrides, setHourOverrides] = useState<Record<string, number>>({})
  const [autoHours, setAutoHours] = useState<Record<string, number>>({})   // 자동 계산 스냅샷(비교용)
  const [showWorkers, setShowWorkers] = useState(false)

  useEffect(() => { staffingAPI.context(year, month).then(setCtx).catch(() => {}) }, [year, month])
  // 저장된 직원별 근무시간 조정값 로드 (DB 영속)
  useEffect(() => {
    staffingAPI.listHours(year, month)
      .then(setHourOverrides)
      .catch(() => setHourOverrides({}))
  }, [year, month])

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const r = await staffingAPI.simulate({
        year, month,
        planned_admissions: planned.filter(p => p.admission_date),
        candidates: candidates.filter(c => c.hire_date || c.available_hours != null),
        config: { placement_ratio: ratio, daily_hours: dailyHours, max_immediate_hires: maxHires, full_month_hire_day: fullMonthDay },
      })
      setRes(r)
      // 조정값이 없는 직원의 결과 = 자동 계산값 → 비교용 스냅샷 갱신
      setAutoHours(prev => {
        const snap = { ...prev }
        r.worker_hours_detail.forEach(w => {
          if (w.employee_id && !w.overridden) snap[w.employee_id] = w.hours
        })
        return snap
      })
    } finally { setLoading(false) }
  }, [year, month, planned, candidates, ratio, dailyHours, maxHires, fullMonthDay, hourOverrides])

  useEffect(() => { const t = setTimeout(run, 350); return () => clearTimeout(t) }, [run])

  // 직원별 근무시간 저장 (DB 영속)
  const [savingId, setSavingId] = useState<string | null>(null)
  const saveHours = async (staffId: string, hours: number) => {
    setSavingId(staffId)
    try {
      await staffingAPI.saveHours(staffId, year, month, hours)
      setHourOverrides(prev => ({ ...prev, [staffId]: hours }))
    } finally { setSavingId(null) }
  }
  const resetHours = async (staffId: string) => {
    setSavingId(staffId)
    try {
      await staffingAPI.resetHours(staffId, year, month)
      setHourOverrides(prev => { const n = { ...prev }; delete n[staffId]; return n })
    } finally { setSavingId(null) }
  }

  const runScenarios = async () => {
    setScenLoading(true)
    try {
      const base = planned[0]?.admission_date || today
      const out: StaffingResult[] = []
      for (let n = 1; n <= 4; n++) {
        const r = await staffingAPI.simulate({
          year, month,
          planned_admissions: Array.from({ length: n }, () => ({ admission_date: base })),
          candidates: candidates.filter(c => c.hire_date || c.available_hours != null),
          config: { placement_ratio: ratio, daily_hours: dailyHours, max_immediate_hires: maxHires, full_month_hire_day: fullMonthDay },
        })
        out.push(r)
      }
      setScenarios(out)
    } finally { setScenLoading(false) }
  }

  const st = res ? ADMISSION_STATUS[res.admission_status] : null
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4'

  return (
    <div className="p-4 md:p-6 max-w-full space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center"><Users className="w-5 h-5 text-indigo-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">요양보호사 인력배치 · 입소 가능성 시뮬레이터</h1>
            <p className="text-xs text-gray-400">지금 입소를 받아도 되는지, 요양보호사가 몇 명 더 필요한지 자동 판단합니다. <span className="text-amber-500 font-semibold">예상값</span></p>
          </div>
        </div>
        <button onClick={() => setManual(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
          <BookOpen className="w-4 h-4" /> 사용 방법
        </button>
      </div>

      {/* 기준월 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-600">기준월</span>
        <select value={year} onChange={e => setYear(+e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(+e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(mm => <option key={mm} value={mm}>{mm}월</option>)}
        </select>
        {ctx && <span className="text-xs text-gray-400">현재 입소자 {ctx.resident_count}명 · 요양보호사 {ctx.caregiver_count}명 · 월 기준시간 {ctx.monthly_standard_detail.hours}시간</span>}
        {ctx && ctx.caregiver_count === 0 && <span className="text-xs text-red-500 font-semibold">⚠ 직원 관리에서 직종이 '요양보호사'인 재직자를 찾지 못했습니다. 직종 표기를 확인하세요.</span>}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
      </div>

      {res && st && (
        <>
          {/* 상태 배너 */}
          <div className={`rounded-2xl border p-4 ${toneCls[st.tone]}`}>
            <div className="flex items-start gap-3">
              {st.tone === 'green' ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : st.tone === 'red' ? <AlertTriangle className="w-6 h-6 shrink-0" /> : <Info className="w-6 h-6 shrink-0" />}
              <div>
                <p className="text-xs font-semibold opacity-70">이번 달 입소 가능성</p>
                <p className="text-lg font-extrabold">{st.title}</p>
                <p className="text-sm mt-1 leading-relaxed text-gray-700">{res.recommendation}</p>
              </div>
            </div>
          </div>

          {/* 인력 위험 경고 — '필요 인원 증가'와 '실제 인력 부족'을 구분한다 */}
          {(() => {
            const shortage = res.shortage_hours > 0
            const overCapacity = res.after_avg_resident_count > res.max_allowed_avg_resident_count
            const increased = res.worker_count_increased

            // ① 실제 부족 → 빨간 경고
            if (shortage) {
              return (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                    <div className="text-sm text-red-700">
                      <p className="font-bold">당월 인력기준 충족 위험 — 근무시간 부족</p>
                      {overCapacity ? (
                        <p className="mt-1">예상 월평균 입소자 <b>{res.after_avg_resident_count}명</b>이 현재 요양보호사 {res.current_worker_count}명이 관리 가능한 <b>{res.max_allowed_avg_resident_count}명</b>을 초과합니다.</p>
                      ) : (
                        <p className="mt-1">인원수는 충족하나 <b>확보 근무시간이 부족</b>합니다 (확보 {res.secured_hours}h / 필요 {res.required_hours_after.toLocaleString()}h).</p>
                      )}
                      <p className="mt-0.5">
                        필요 요양보호사 <b>{res.before_required_worker_count}명 → {res.after_required_worker_count}명</b>
                        {' · '}부족 <b>{res.shortage_hours}시간</b>
                        {' · '}최소 즉시 투입 <b>{res.minimum_new_worker_count ?? '-'}명</b>
                      </p>
                    </div>
                  </div>
                </div>
              )
            }

            // ② 필요 인원은 늘었지만 현재 인력으로 충족 → 정보성 안내(빨강 아님)
            if (increased) {
              return (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-6 h-6 text-blue-500 shrink-0" />
                    <div className="text-sm text-blue-700">
                      <p className="font-bold">필요 요양보호사가 늘어나지만 현재 인력으로 충족됩니다</p>
                      <p className="mt-1">
                        예상 월평균 입소자 <b>{res.after_avg_resident_count}명</b> → 필요 <b>{res.before_required_worker_count}명 → {res.after_required_worker_count}명</b>.
                        현재 요양보호사 <b>{res.current_worker_count}명</b>이 관리 가능한 범위는 <b>{res.max_allowed_avg_resident_count}명</b>이며,
                        확보 근무시간 <b>{res.secured_hours}h</b> ≥ 필요 <b>{res.required_hours_after.toLocaleString()}h</b> 이므로 <b>부족시간 0</b>입니다.
                      </p>
                      <p className="mt-0.5 text-blue-500">추가 채용 없이 입소 가능합니다.</p>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* 핵심 카드 6종 */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
            <Kpi label="입소 가능성" value={st.title} tone={st.tone} tip="현재 인력·입소예정·신규채용을 반영한 이번 달 인력기준 충족 예상입니다." />
            <Kpi label="부족 인정시간" value={`${res.shortage_hours}h`} tone={res.shortage_hours > 0 ? 'red' : 'green'} tip="현재 직원 근무시간만으로 인력기준을 충족하지 못해 추가로 필요한 요양보호사 근무시간입니다." />
            <Kpi label="최소 즉시 투입" value={res.minimum_new_worker_count == null ? '불가' : `${res.minimum_new_worker_count}명`} tone={(res.minimum_new_worker_count ?? 0) > 0 ? 'amber' : 'green'} tip="부족시간을 채우기 위해 채용해야 하는 신규 요양보호사 최소 인원입니다." />
            <Kpi label="최종 안전 채용일" value={fmtD(res.latest_safe_hire_dates['1'] || res.latest_safe_hire_dates['2'])} tone="blue" tip="필요한 근무시간을 월말까지 확보하려면 직원을 채용해야 하는 가장 늦은 날짜입니다." />
            <Kpi label="권장 입소일" value={res.earliest_safe_admission_date ? fmtD(res.earliest_safe_admission_date) : (res.shortage_hours > 0 ? '탐색 필요' : '현행 유지')} tone="blue" tip="현재 인력으로 인력기준을 충족할 수 있는 가장 빠른 입소일입니다." />
            <Kpi label="다음 달 필요 정규직" value={`${res.next_month_additional_full_time_workers}명`} tone={res.next_month_additional_full_time_workers > 0 ? 'amber' : 'green'} tip="다음 달 재원 예상 기준으로 추가로 필요한 정규 요양보호사 수입니다." />
          </div>

          {/* 실현 가능성 */}
          {res.feasibility_level && (
            <div className={card}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-400">실현 가능성</p>
                  <p className="text-base font-bold text-gray-800">{FEASIBILITY[res.feasibility_level]}</p>
                </div>
                <div className="text-xs text-gray-500">
                  신규 1인 이론상 최대 <b>{res.single_worker_theoretical_max_hours}h</b> · 현실적 권장 <b>{res.single_worker_recommended_max_hours}h</b>
                  <Tip text={'이론상 최대 = 달력상 근무가능일 × 1일 최대시간 (참고 상한)\n현실적 확보 = 월 기준시간 ÷ 월 총일수 × 재직일수\n(월초 1~3일 입사는 만근 처리)'} />
                </div>
              </div>
              {res.candidate_allocation && res.candidate_detail.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5">
                  <p className="font-semibold mb-1">신규 후보 {res.candidate_detail.length}명 근무시간 합산</p>
                  {res.candidate_detail.map((c, i) => <span key={i} className="inline-block mr-2">· {c.name || `후보${i + 1}`} {c.available_hours}h{c.confirmed ? '(확정)' : ''}</span>)}
                  <p className="mt-1 text-teal-600 font-semibold">합계 {res.candidate_total_available_hours}h {res.candidate_total_available_hours >= res.shortage_hours ? '→ 부족시간 충족' : `→ ${res.candidate_shortage_hours}h 부족`}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 입력: 입소 예정 */}
      <div className={card}>
        <div className="flex items-center gap-1.5 mb-2"><CalendarClock className="w-4 h-4 text-teal-600" /><h2 className="text-sm font-bold text-gray-800">입소 예정 입력</h2></div>
        <div className="space-y-2">
          {planned.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">{i + 1}</span>
              <DateField value={p.admission_date} onChange={v => setPlanned(a => a.map((x, xi) => xi === i ? { ...x, admission_date: v } : x))} className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg" wrapperClassName="flex-1 min-w-[9rem]" clearable={false} />
              <span className="text-[11px] text-gray-400">예상 퇴소</span>
              <DateField value={p.discharge_date} onChange={v => setPlanned(a => a.map((x, xi) => xi === i ? { ...x, discharge_date: v } : x))} className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg" wrapperClassName="flex-1 min-w-[9rem]" />
              {planned.length > 1 && <button onClick={() => setPlanned(a => a.filter((_, xi) => xi !== i))} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button>}
            </div>
          ))}
          <button onClick={() => setPlanned(a => [...a, { admission_date: today }])} className="text-xs font-semibold text-teal-600 hover:underline">+ 입소 예정자 추가</button>
        </div>
      </div>

      {/* 입력: 신규 직원 후보 */}
      <div className={card}>
        <div className="flex items-center gap-1.5 mb-2"><Users className="w-4 h-4 text-indigo-600" /><h2 className="text-sm font-bold text-gray-800">신규 직원 후보 <span className="text-xs font-normal text-gray-400">(선택 — 없으면 자동 산정)</span></h2></div>
        <div className="space-y-2">
          {candidates.map((c, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <input value={c.name ?? ''} onChange={e => setCandidates(a => a.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} placeholder={`후보${i + 1}`} className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg w-24" />
              <span className="text-[11px] text-gray-400">입사</span>
              <DateField value={c.hire_date} onChange={v => setCandidates(a => a.map((x, xi) => xi === i ? { ...x, hire_date: v } : x))} className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg" wrapperClassName="min-w-[8rem]" />
              <input type="number" value={c.available_hours ?? ''} onChange={e => setCandidates(a => a.map((x, xi) => xi === i ? { ...x, available_hours: e.target.value === '' ? null : +e.target.value } : x))} placeholder="가능시간(자동)" className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg w-32" />
              <label className="inline-flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={!!c.confirmed} onChange={e => setCandidates(a => a.map((x, xi) => xi === i ? { ...x, confirmed: e.target.checked } : x))} className="accent-indigo-600" />확정</label>
              <button onClick={() => setCandidates(a => a.filter((_, xi) => xi !== i))} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => setCandidates(a => [...a, { name: '', hire_date: today, confirmed: false }])} className="text-xs font-semibold text-indigo-600 hover:underline">+ 신규 후보 추가</button>
        </div>
      </div>

      {/* 직원별 근무시간 조정 */}
      {res && res.worker_hours_detail.length > 0 && (
        <div className={card}>
          <button onClick={() => setShowWorkers(v => !v)} className="w-full flex items-center justify-between text-sm font-bold text-gray-700">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              직원별 근무시간 조정
              <span className="text-xs font-normal text-gray-400">
                ({Object.keys(hourOverrides).length > 0 ? `${Object.keys(hourOverrides).length}명 저장된 조정값 적용 중` : '전원 자동 계산'})
              </span>
            </span>
            {showWorkers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showWorkers && (
            <div className="mt-3">
              <p className="text-[11px] text-gray-400 mb-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                기본은 <b>월 기준시간 {res.monthly_standard_hours}h ÷ 월 {res.resident_days.days_in_month}일 × 재직일수</b>로 자동 계산됩니다.
                실제 근무시간이 다르면 아래에서 <b>직접 입력</b>하세요. 입력값은 <b>{year}년 {month}월 기준으로 저장</b>되어 다음에 열어도 유지됩니다. "자동"을 누르면 자동 계산으로 되돌아갑니다.
              </p>

              <div className="space-y-1.5">
                {res.worker_hours_detail.map((w, i) => {
                  const id = w.employee_id ?? ''
                  const ov = id ? hourOverrides[id] : undefined
                  const isOv = ov != null
                  const auto = id ? autoHours[id] : undefined
                  return (
                    <div key={id || i} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 ${isOv ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-100'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {w.name || `직원${i + 1}`}
                          {w.on_leave && <span className="ml-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">휴직 {w.leave_days}일</span>}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          입사 {w.hire_date ? fmtD(w.hire_date) : '-'}
                          {auto != null && <> · 자동 계산 <b className="text-gray-500">{auto}h</b></>}
                          {isOv && <span className="ml-1 text-indigo-600 font-semibold">→ 수동 {ov}h</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={0} step={0.5}
                          defaultValue={ov ?? ''}
                          key={`${id}-${ov ?? 'auto'}`}
                          placeholder={String(auto ?? w.hours)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          onBlur={e => {
                            const v = e.target.value.trim()
                            if (!id) return
                            if (v === '') { if (isOv) resetHours(id); return }
                            const n = Math.max(0, +v)
                            if (!isNaN(n) && n !== ov) saveHours(id, n)
                          }}
                          disabled={!id || savingId === id}
                          className="w-24 px-2.5 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
                        />
                        <span className="text-xs text-gray-400 w-8">시간</span>
                        {savingId === id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        ) : isOv ? (
                          <button onClick={() => resetHours(id)}
                            className="text-[11px] font-semibold text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-50">
                            자동
                          </button>
                        ) : (
                          <span className={`text-[11px] font-bold w-14 text-right ${w.meets_standard ? 'text-green-600' : 'text-amber-600'}`}>
                            {w.hours}h
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {Object.keys(hourOverrides).length > 0 && (
                <button onClick={async () => {
                    if (!confirm(`${year}년 ${month}월 저장된 조정값을 모두 삭제하고 자동 계산으로 되돌릴까요?`)) return
                    for (const sid of Object.keys(hourOverrides)) await staffingAPI.resetHours(sid, year, month)
                    setHourOverrides({})
                  }}
                  className="mt-2 text-xs font-semibold text-gray-400 hover:text-indigo-600">
                  전체 자동 계산으로 되돌리기
                </button>
              )}

              <p className="mt-2 text-[11px] font-semibold text-gray-600">
                확보 예상시간 합계 <span className="text-indigo-600">{res.secured_hours}h</span>
                {' · '}필요 {res.required_hours_after.toLocaleString()}h
                {' · '}부족 <span className={res.shortage_hours > 0 ? 'text-red-600' : 'text-green-600'}>{res.shortage_hours}h</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 설정 */}
      <div className={card}>
        <button onClick={() => setShowConfig(v => !v)} className="w-full flex items-center justify-between text-sm font-bold text-gray-700">
          <span>배치 설정 <span className="text-xs font-normal text-gray-400">(행정판정 기준은 공단 안내 확인)</span></span>
          {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showConfig && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <label className="text-xs text-gray-600">배치비율 (N:1)
              <input type="number" step="0.1" value={ratio} onChange={e => setRatio(+e.target.value || 2.1)} className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 rounded-lg" /></label>
            <label className="text-xs text-gray-600">1일 근무시간
              <input type="number" value={dailyHours} onChange={e => setDailyHours(+e.target.value || 8)} className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 rounded-lg" /></label>
            <label className="text-xs text-gray-600">최대 즉시채용
              <input type="number" value={maxHires} onChange={e => setMaxHires(+e.target.value || 3)} className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 rounded-lg" /></label>
            <label className="text-xs text-gray-600 col-span-3">월초 만근 인정일 <span className="text-gray-400">(이 날짜 이하 입사자는 만근 — 기본 3일)</span>
              <input type="number" min={1} max={10} value={fullMonthDay} onChange={e => setFullMonthDay(+e.target.value || 3)} className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 rounded-lg" /></label>
          </div>
        )}
      </div>

      {/* 입소 전후 비교 */}
      {res && (
        <div className={card}>
          <h2 className="text-sm font-bold text-gray-800 mb-2">입소 전후 비교</h2>
          <div className="overflow-visible">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs"><th className="text-left py-1">구분</th><th className="text-right py-1">입소 전</th><th className="text-right py-1">입소 후</th></tr></thead>
              <tbody className="text-gray-700">
                <tr className="border-t border-gray-50"><td className="py-1.5">월평균 입소자 <Tip text="해당 월에 어르신들이 실제로 입소해 있던 전체 일수를 월의 날짜 수로 나눈 값입니다." /></td><td className="text-right">{res.before_avg_resident_count}명</td><td className="text-right font-semibold">{res.after_avg_resident_count}명</td></tr>
                <tr className="border-t border-gray-50"><td className="py-1.5">필요 요양보호사 <Tip text="요양보호사의 월 인정근무시간을 월 기준근무시간으로 환산한 인원입니다." /></td><td className="text-right">{res.before_required_worker_count}명</td><td className={`text-right font-semibold ${res.worker_count_increased ? 'text-red-600' : ''}`}>{res.after_required_worker_count}명</td></tr>
                <tr className="border-t border-gray-50"><td className="py-1.5">필요 인정시간</td><td className="text-right">{res.required_hours_before.toLocaleString()}시간</td><td className="text-right font-semibold">{res.required_hours_after.toLocaleString()}시간</td></tr>
                <tr className="border-t border-gray-50"><td className="py-1.5">부족 인정시간 <Tip text="현재 직원들의 근무시간만으로 인력기준을 충족하지 못해 추가로 필요한 시간입니다." /></td><td className="text-right">0시간</td><td className={`text-right font-semibold ${res.shortage_hours > 0 ? 'text-red-600' : 'text-green-600'}`}>{res.shortage_hours}시간</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 시나리오 비교 */}
      <div className={card}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-800">추가 입소 1~4명 시나리오 비교</h2>
          <button onClick={runScenarios} disabled={scenLoading} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50">{scenLoading ? '계산 중...' : '시나리오 생성'}</button>
        </div>
        {scenarios && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead><tr className="text-gray-400"><th className="text-left py-1 px-2">추가 입소</th><th className="px-2">월평균 입소자</th><th className="px-2">필요 요양보호사</th><th className="px-2">부족시간</th><th className="px-2">최소 신규</th><th className="px-2">당월 충족</th><th className="px-2">권장 입소일</th><th className="px-2">다음 달 정규직</th></tr></thead>
              <tbody className="text-gray-700 text-center">
                {scenarios.map((s, i) => {
                  const stt = ADMISSION_STATUS[s.admission_status]
                  return (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-1.5 px-2 text-left font-semibold">{i + 1}명</td>
                      <td className="px-2">{s.after_avg_resident_count}명</td>
                      <td className={`px-2 ${s.worker_count_increased ? 'text-red-600 font-semibold' : ''}`}>{s.after_required_worker_count}명</td>
                      <td className={`px-2 ${s.shortage_hours > 0 ? 'text-red-600' : ''}`}>{s.shortage_hours}h</td>
                      <td className="px-2">{s.minimum_new_worker_count ?? '불가'}</td>
                      <td className="px-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${toneCls[stt.tone]}`}>{stt.title}</span></td>
                      <td className="px-2">{s.earliest_safe_admission_date ? fmtD(s.earliest_safe_admission_date) : '-'}</td>
                      <td className="px-2">{s.next_month_additional_full_time_workers}명</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 mt-2">💡 월평균 입소자는 재원일수 기반 평균이라 소수로 나옵니다. 현재 요양보호사가 관리 가능한 인원을 초과하면 필요 인원이 늘어납니다.</p>
          </div>
        )}
      </div>

      {/* 계산 근거 */}
      {res && (
        <div className={card}>
          <button onClick={() => setShowBasis(v => !v)} className="w-full flex items-center justify-between text-sm font-bold text-gray-700">
            <span>계산 근거 보기</span>{showBasis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showBasis && (
            <div className="mt-3 space-y-3 text-sm text-gray-600">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-700 mb-1">{res.year}년 {res.month}월 월 기준근무시간</p>
                <p>전체 평일 {res.monthly_standard_detail.weekday_count}일 · 제외 공휴일 {res.monthly_standard_detail.holiday_excluded_count}일 · 최종 근무가능일 {res.monthly_standard_detail.workdays}일</p>
                <p className="font-semibold text-gray-800">{res.monthly_standard_detail.workdays}일 × {res.monthly_standard_detail.daily_hours}시간 = {res.monthly_standard_hours}시간</p>
                <button onClick={() => setShowHolidays(v => !v)} className="text-xs text-indigo-500 mt-1">적용 공휴일 {res.applied_holidays.length}일 {showHolidays ? '접기 ▴' : '보기 ▾'}</button>
                {showHolidays && <div className="mt-1 flex flex-wrap gap-1">{res.applied_holidays.map(h => <span key={h.date} className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5">{fmtD(h.date)} {h.name}</span>)}</div>}
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-700 mb-1">월평균 입소자</p>
                <p>재원일수 합계 {res.resident_days.total_days}일 ÷ {res.resident_days.days_in_month}일 = <b>{res.after_avg_resident_count}명</b></p>
                <p className="text-xs text-gray-400 mt-0.5">현재 요양보호사 {res.current_worker_count}명 × {res.config.placement_ratio} = 최대 {res.max_allowed_avg_resident_count}명까지 관리 가능</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-700 mb-1">인식된 요양보호사 {res.worker_hours_detail.length}명 · 직원별 인정시간</p>
                <p className="text-[11px] text-gray-400 mb-1.5 bg-white rounded px-2 py-1 border border-gray-100">
                  산식: <b>월 기준시간 {res.monthly_standard_hours}h ÷ 월 {res.resident_days.days_in_month}일 × 재직일수</b>
                  &nbsp;· 월초 <b>1~{res.config.full_month_hire_day}일</b> 입사자는 <b>만근</b> · 휴직일수는 재직일수에서 차감
                </p>
                {res.worker_hours_detail.length === 0 ? <p className="text-gray-400 text-xs">등록된 요양보호사 없음</p> : res.worker_hours_detail.map((w, i) => (
                  <p key={i} className="text-xs">· {w.name || `직원${i + 1}`} {w.hours}시간 {w.meets_standard ? <span className="text-green-600">충족</span> : <span className="text-amber-600">미달</span>}{w.on_leave ? <span className="text-amber-600 font-semibold"> · 휴직 {w.leave_days}일 제외</span> : null}{w.is_expected_hire ? ' (예정)' : ''}</p>
                ))}
                <p className="mt-1 font-semibold text-gray-800">확보 예상시간 {res.secured_hours}시간 · 필요 {res.required_hours_after.toLocaleString()}시간 · 부족 {res.shortage_hours}시간</p>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">이 결과는 입력된 입소일·근무시간을 기준으로 계산한 <b>예상값</b>입니다. 실제 인력신고 및 장기요양기관 행정판정은 관련 규정과 공단 안내를 최종 확인하세요.</p>
            </div>
          )}
        </div>
      )}

      {manual && <ManualModal onClose={() => setManual(false)} />}
    </div>
  )
}

function Kpi({ label, value, tone, tip }: { label: string; value: string; tone: string; tip: string }) {
  const c: Record<string, string> = { green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-600', blue: 'text-blue-600' }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
      <p className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">{label}<Tip text={tip} /></p>
      <p className={`text-base font-extrabold mt-0.5 ${c[tone] || 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

function ManualModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white"><h3 className="font-bold text-gray-900">인력배치 시뮬레이터 사용 방법</h3><button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className="px-5 py-4 space-y-3 text-sm text-gray-600 leading-relaxed">
          {[
            ['1. 기준월을 선택하세요', '입소를 검토하는 월을 선택합니다. 월 기준근무시간과 공휴일은 자동으로 계산됩니다.'],
            ['2. 입소예정자를 등록하세요', '입소 예정 인원과 입소 예정일을 입력합니다. 여러 명의 입소일이 다르면 각각 입력하세요.'],
            ['3. 신규 직원 정보를 입력하세요', '채용 예정인 요양보호사의 입사 가능일과 근무 가능시간을 입력합니다. 미확정이면 후보로 두면 됩니다. (비워두면 자동 산정)'],
            ['4. 입소 가능성을 확인하세요', '입소 가능 / 조건부 가능 / 당월 충족 불가 예상 / 다음 달 입소 권장 중 하나로 판단합니다.'],
            ['5. 부족시간을 확인하세요', '부족 인정시간은 추가로 확보해야 하는 요양보호사 근무시간입니다. 예: 176시간 = 요양보호사 1명의 월 기준시간.'],
            ['6. 최소 신규인원을 확인하세요', '신규 1명이 월말까지 기준시간을 못 채우면 여러 명의 시간을 합산합니다.'],
            ['7. 최종 안전 채용일을 확인하세요', '그 날짜까지 채용해야 월말까지 필요한 근무시간을 확보할 수 있습니다.'],
            ['8. 권장 입소일을 확인하세요', '현재 입소일에 기준을 맞추기 어렵다면 가장 빠른 안전 입소일을 안내합니다.'],
            ['9. 계산 근거를 확인하세요', '월평균 입소자·재원일수·월 기준시간·적용 공휴일·직원별 인정시간·부족시간 산식을 확인할 수 있습니다.'],
          ].map(([t, d]) => <div key={t}><p className="font-bold text-gray-800">{t}</p><p>{d}</p></div>)}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">이 결과는 입력값 기준 예상값입니다. 실제 인력신고 및 장기요양기관 행정판정은 관련 규정과 공단 안내를 최종 확인하세요.</div>
        </div>
      </div>
    </div>
  )
}
