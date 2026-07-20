import { apiClient } from './client'
import type { Certification } from '@/utils/cert'
export type { Certification } from '@/utils/cert'
import type { DocEvent } from '@/utils/docEvents'
export type { DocEvent } from '@/utils/docEvents'

const BASE = '/api/v1/admin/resident-docs'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface CertPeriod { start?: string | null; end?: string | null; type?: string | null; level?: string | null }
export interface ResidentDoc {
  id: string
  resident_id?: string | null
  floor?: string | null
  care_type?: string | null       // 시설 | 재가 | 신청예정
  followup_date?: string | null   // 다음 확인일 ISO
  apply_stage?: string | null     // 시설급여 신청 단계
  apply_note?: string | null
  guardian_notified_at?: string | null
  seq: number
  name?: string | null
  admission_date?: string | null
  grade?: string | null
  base_date?: string | null
  cert_periods?: CertPeriod[]
  certifications?: Certification[]
  contract_lines?: DocEvent[]
  plan_lines?: DocEvent[]
  eval_lines?: DocEvent[]
  memo?: string | null
  active?: boolean
}
export interface DocInput {
  resident_id?: string | null
  floor?: string | null
  care_type?: string | null
  followup_date?: string | null
  apply_stage?: string | null
  apply_note?: string | null
  guardian_notified_at?: string | null
  name?: string | null
  admission_date?: string | null
  grade?: string | null
  base_date?: string | null
  cert_periods?: CertPeriod[]
  certifications?: Certification[]
  contract_lines?: DocEvent[]
  plan_lines?: DocEvent[]
  eval_lines?: DocEvent[]
  memo?: string | null
  active?: boolean
}

/** 수정 이력 — 저장 시 바뀐 항목만 자동 기록된다. */
export interface DocChangeItem {
  field: string
  label: string
  before?: string | null      // 단일값 변경
  after?: string | null
  added?: string[]            // 목록형(인정서·일시) 변경
  removed?: string[]
}
export interface DocChange {
  id: string
  doc_id: string
  resident_name?: string | null
  action: 'create' | 'update' | 'delete'
  changes: DocChangeItem[]
  user_name?: string | null
  created_at?: string | null
}

export const residentDocAPI = {
  list: (includeInactive = false) =>
    apiClient.get(`${BASE}/records`, { params: includeInactive ? { include_inactive: true } : {} }).then(unwrap<ResidentDoc[]>),
  create: (b: DocInput) => apiClient.post(`${BASE}/records`, b).then(unwrap<ResidentDoc>),
  update: (id: string, b: DocInput) => apiClient.patch(`${BASE}/records/${id}`, b).then(unwrap<ResidentDoc>),
  remove: (id: string) => apiClient.delete(`${BASE}/records/${id}`).then(r => r.data),
  changes: (id: string, limit = 50) =>
    apiClient.get(`${BASE}/records/${id}/changes`, { params: { limit } }).then(unwrap<DocChange[]>),
  recentChanges: (limit = 30) =>
    apiClient.get(`${BASE}/changes`, { params: { limit } }).then(unwrap<DocChange[]>),
}
