import { apiClient } from './client'

const BASE = '/api/v1/admin/nursing-audit'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type NursingAuditKind = 'error' | 'check' | 'info'

/** 케어포 간호기록 판정 결과 한 건 — kind: 오류 / 확인 필요 / 참고(정상 가능) */
export interface NursingAuditFinding {
  id: string
  date: string
  weekday?: string | null
  resident: string
  resident_id?: string | null
  room?: string | null
  floor?: string | null
  area: string
  item: string
  kind: NursingAuditKind
  issue: string
  staff?: string | null
  time?: string | null
  evidence?: string | null
  exception?: string | null
  residents?: string[]
}

/** 욕창·비위관·도뇨관 기록 한 줄(가정간호 청구 대조용) */
export interface HomeNursingRow {
  date: string
  weekday?: string | null
  resident: string
  resident_id?: string | null
  room?: string | null
  type: '욕창간호' | '비위관' | '도뇨관'
  text: string
  writer?: string | null
  home_nursing: boolean
}

export interface NursingAuditSummary {
  total: number
  by_kind: { error: number; check: number; info: number }
  by_area: Record<string, number>
  by_item: Record<string, number>
  by_date: Record<string, { error: number; check: number; info: number }>
  by_resident: { resident: string; room?: string | null; error: number; check: number; info: number; total: number }[]
  by_staff: { staff: string; error: number; check: number; info: number; total: number }[]
  home_nursing: Record<string, number>
}

export interface NursingAuditMonth {
  month: string
  window_start: string
  window_end: string
  generated_at?: string | null
  total: number
  by_kind: { error: number; check: number; info: number }
  uploaded_by?: string | null
}

export interface NursingAuditDetail {
  month?: string
  window_start: string
  window_end: string
  requested_start?: string
  requested_end?: string
  generated_at?: string | null
  source?: string | null
  coverage: Record<string, any>
  summary: NursingAuditSummary
  findings: NursingAuditFinding[]
  home_nursing: HomeNursingRow[]
  uploaded_by?: string | null
}

export const nursingAuditAPI = {
  months: () => apiClient.get(`${BASE}/months`).then(unwrap<NursingAuditMonth[]>),
  month: (month: string) => apiClient.get(`${BASE}/months/${month}`).then(unwrap<NursingAuditDetail>),
  range: (start: string, end: string) => apiClient.get(`${BASE}/range`, { params: { start, end } }).then(unwrap<NursingAuditDetail>),
  latest: () => apiClient.get(`${BASE}/latest`).then(unwrap<NursingAuditMonth | null>),
}
