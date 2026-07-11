import { apiClient } from './client'

const BASE = '/api/v1/admin/staffing'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface StaffingConfig {
  placement_ratio: number
  daily_hours: number
  daily_max_recognized_hours: number
  max_immediate_hires: number
  safety_factor: number
  scan_days: number
}
export interface AppliedHoliday { date: string; name: string }
export interface PlannedAdmission { admission_date: string; discharge_date?: string | null }
export interface Candidate { name?: string; hire_date?: string | null; available_hours?: number | null; confirmed?: boolean }

export interface StaffingContext {
  year: number; month: number
  config: StaffingConfig
  residents: { name?: string; admission_date: string; discharge_date?: string | null; status?: string }[]
  workers: { name?: string; hire_date?: string | null; resign_date?: string | null; is_expected_hire?: boolean; position?: string }[]
  caregiver_count: number
  resident_count: number
  monthly_standard_detail: MonthlyStandard
  applied_holidays: AppliedHoliday[]
}

export interface MonthlyStandard {
  year: number; month: number
  weekday_count: number; holiday_excluded_count: number; workdays: number
  daily_hours: number; hours: number; applied_holiday_dates: string[]
}

export interface StaffingResult {
  year: number; month: number; as_of: string
  config: StaffingConfig
  admission_status: 'SAFE' | 'CONDITIONAL' | 'UNSAFE_THIS_MONTH' | 'NEXT_MONTH_RECOMMENDED'
  feasibility_level: 'FEASIBLE_SINGLE' | 'FEASIBLE_DISTRIBUTED' | 'HIGH_OPERATIONAL_RISK' | 'PRACTICALLY_IMPOSSIBLE' | null
  before_avg_resident_count: number
  after_avg_resident_count: number
  before_required_worker_count: number
  after_required_worker_count: number
  worker_count_increased: boolean
  current_worker_count: number
  max_allowed_avg_resident_count: number
  monthly_standard_hours: number
  monthly_standard_detail: MonthlyStandard
  applied_holidays: AppliedHoliday[]
  secured_hours: number
  required_hours_before: number
  required_hours_after: number
  shortage_hours: number
  single_worker_theoretical_max_hours: number
  single_worker_recommended_max_hours: number
  remaining_workdays: number
  remaining_calendar_days: number
  minimum_new_worker_count: number | null
  recommended_new_worker_count: number | null
  candidate_allocation: { count: number; allocation: number[]; total: number; feasible: boolean } | null
  candidate_detail: { name?: string; hire_date?: string | null; available_hours: number; confirmed: boolean }[]
  confirmed_candidate_count: number
  candidate_total_available_hours: number
  candidate_shortage_hours: number
  schedule_feasible: boolean
  schedule_note: string
  latest_safe_hire_dates: Record<string, string | null>
  earliest_safe_admission_date: string | null
  next_month_required_worker_count: number
  next_month_additional_full_time_workers: number
  next_month_projection: { year: number; month: number; avg: number; required_worker_count: number; additional_full_time_workers: number }
  worker_hours_detail: { name?: string; hire_date?: string | null; is_expected_hire: boolean; hours: number; meets_standard: boolean }[]
  resident_days: { total_days: number; days_in_month: number; per: { admission_date?: string; discharge_date?: string | null; days: number; planned: boolean }[] }
  is_estimate: boolean
  recommendation: string
}

export interface SimulateInput {
  year: number; month: number
  as_of?: string | null
  config?: Partial<StaffingConfig>
  residents?: any[]
  workers?: any[]
  planned_admissions?: PlannedAdmission[]
  candidates?: Candidate[]
  extra_excluded_dates?: string[]
  use_db_residents?: boolean
  use_db_workers?: boolean
}

export const staffingAPI = {
  context: (year?: number, month?: number) =>
    apiClient.get(`${BASE}/context`, { params: { year, month } }).then(unwrap<StaffingContext>),
  simulate: (body: SimulateInput) =>
    apiClient.post(`${BASE}/simulate`, body).then(unwrap<StaffingResult>),
}

// 상태/등급 한글 표시
export const ADMISSION_STATUS: Record<string, { title: string; desc: string; tone: 'green' | 'amber' | 'red' | 'blue' }> = {
  SAFE: { title: '입소 가능', desc: '현재 인력으로 당월과 다음 달 기준을 충족할 수 있습니다.', tone: 'green' },
  CONDITIONAL: { title: '조건부 입소 가능', desc: '신규 직원의 채용과 근무 배치가 확정되어야 인력기준을 충족할 수 있습니다.', tone: 'amber' },
  UNSAFE_THIS_MONTH: { title: '당월 인력기준 충족 불가 예상', desc: '현재 조건에서는 이번 달 필요한 근무시간을 확보하기 어렵습니다.', tone: 'red' },
  NEXT_MONTH_RECOMMENDED: { title: '다음 달 입소 권장', desc: '이번 달 입소보다 다음 달 1일 이후 입소가 인력배치상 안전합니다.', tone: 'blue' },
}
export const FEASIBILITY: Record<string, string> = {
  FEASIBLE_SINGLE: '신규 1명으로 충족 가능',
  FEASIBLE_DISTRIBUTED: '여러 명 분산근무 필요',
  HIGH_OPERATIONAL_RISK: '운영상 고위험',
  PRACTICALLY_IMPOSSIBLE: '당월 인력기준 충족 불가 예상',
}
