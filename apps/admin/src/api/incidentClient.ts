import { apiClient } from './client'

const BASE = '/api/v1/admin/incidents'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export const INCIDENT_TYPES = ['낙상', '상처·욕창', '투약', '발열', '식사', '행동', '기타'] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]
export const SEVERITIES = ['경미', '중등', '심각'] as const

export interface Incident {
  id: string
  resident_id?: string | null
  resident_name?: string | null
  type: IncidentType
  severity: string
  occurred_date: string
  occurred_time?: string | null
  location?: string | null
  description?: string | null
  action?: string | null
  follow_up?: string | null
  guardian_notified: boolean
  guardian_notified_at?: string | null
  guardian_method?: string | null
  guardian_note?: string | null
  status: 'open' | 'closed'
  source: 'manual' | 'handover'
  handover_ref?: string | null
  reporter_name?: string | null
  created_at?: string | null
}

export interface IncidentInput extends Partial<Omit<Incident, 'id' | 'created_at' | 'source'>> {
  type: IncidentType
  occurred_date: string
  handover_ref?: string | null
}

export interface HandoverCandidate {
  handover_ref: string
  date?: string | null
  time?: string | null
  resident_id?: string | null
  resident_name?: string | null
  category: string
  suggested_type: IncidentType
  note: string
}

export const incidentAPI = {
  list: (year?: number, status?: string) =>
    apiClient.get(BASE, { params: { ...(year ? { year } : {}), ...(status ? { status } : {}) } })
      .then(unwrap<Incident[]>),
  create: (b: IncidentInput) => apiClient.post(BASE, b).then(unwrap<Incident>),
  update: (id: string, b: IncidentInput) => apiClient.patch(`${BASE}/${id}`, b).then(unwrap<Incident>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
  candidates: (days = 7) => apiClient.get(`${BASE}/candidates`, { params: { days } })
    .then(unwrap<HandoverCandidate[]>),
}
