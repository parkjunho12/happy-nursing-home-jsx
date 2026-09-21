import { apiClient } from './client'

const BASE = '/api/v1/admin/care-log-audit'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 케어포 판정 결과 한 건 — kind: 오류(작성자 귀속) / blank(공란·책임후보) / check(확인 필요) */
export interface WeeklyAuditFinding {
  id: string
  date: string
  weekday?: string | null
  resident: string
  resident_id?: string | null
  room?: string | null
  floor?: string | null
  area: string
  item: string
  kind: 'error' | 'blank' | 'check'
  issue: string
  staff?: string | null
  staff_basis?: string | null
  owner_candidates?: string[]
  owner_basis?: string | null
  schedule_check?: string | null
  evidence?: string | null
  exception?: string | null
  time?: string | null
}

export interface WeeklyAuditStaffRow {
  staff: string
  error: number
  blank_owner: number
  /** 하루 합계 기준(교체 6회 등) 공동 항목 수 */
  shared?: number
  check: number
  total: number
  signed_resident_days?: number
}

export interface WeeklyAuditResidentRow {
  resident: string
  room?: string | null
  total: number
}

export interface WeeklyAuditSummary {
  total: number
  by_kind: { error: number; blank: number; check: number }
  by_staff: WeeklyAuditStaffRow[]
  by_area: Record<string, number>
  by_resident: WeeklyAuditResidentRow[]
  by_date: Record<string, number>
}

/** GET /weeks 목록 항목 */
export interface WeeklyAuditWeek {
  week_start: string
  week_end: string
  generated_at?: string | null
  total: number
  by_kind: { error: number; blank: number; check: number }
  uploaded_by?: string | null
}

/** GET /weeks/{week_start} 전체 */
export interface WeeklyAuditDetail {
  week_start: string
  week_end: string
  generated_at?: string | null
  source?: string | null
  coverage: Record<string, any>
  summary: WeeklyAuditSummary
  findings: WeeklyAuditFinding[]
  staff_workload: { staff: string; days_scheduled?: number; signed_resident_days?: number }[]
  uploaded_by?: string | null
}

/** GET /latest */
export interface WeeklyAuditLatest {
  week_start: string
  week_end: string
  generated_at?: string | null
  total: number
  by_kind: { error: number; blank: number; check: number }
  top_staff: { staff: string; error: number; blank_owner: number; shared?: number; total: number }[]
  by_area: Record<string, number>
}

export const careLogAuditAPI = {
  weeks: () => apiClient.get(`${BASE}/weeks`).then(unwrap<WeeklyAuditWeek[]>),
  week: (weekStart: string) => apiClient.get(`${BASE}/weeks/${weekStart}`).then(unwrap<WeeklyAuditDetail>),
  latest: () => apiClient.get(`${BASE}/latest`).then(unwrap<WeeklyAuditLatest | null>),
}
