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

export const residentDocAPI = {
  list: (includeInactive = false) =>
    apiClient.get(`${BASE}/records`, { params: includeInactive ? { include_inactive: true } : {} }).then(unwrap<ResidentDoc[]>),
  create: (b: DocInput) => apiClient.post(`${BASE}/records`, b).then(unwrap<ResidentDoc>),
  update: (id: string, b: DocInput) => apiClient.patch(`${BASE}/records/${id}`, b).then(unwrap<ResidentDoc>),
  remove: (id: string) => apiClient.delete(`${BASE}/records/${id}`).then(r => r.data),
}
