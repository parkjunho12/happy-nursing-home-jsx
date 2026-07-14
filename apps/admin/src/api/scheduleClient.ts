import { apiClient } from './client'

const BASE = '/api/v1/admin/schedule'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export const SCHEDULE_CATEGORIES = ['방문상담', '외부방문', '회의', '행사', '기타'] as const
export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[number]

export interface ScheduleEvent {
  id: string
  category: string
  title: string
  start_at?: string | null
  end_at?: string | null
  location?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  memo?: string | null
  status: string
  created_by?: string | null
  created_by_id?: string | null
  can_edit?: boolean
  created_at?: string | null
}
export interface EventInput {
  category?: string
  title: string
  start_at: string
  end_at?: string | null
  location?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  memo?: string | null
}

export interface LifecycleEvent {
  id: string
  kind: 'admission' | 'hire'
  name: string
  date: string          // YYYY-MM-DD
  gender?: string | null
  status?: string | null
}

export interface RenewalEvent {
  id: string
  name?: string | null
  position?: string | null
  date: string          // YYYY-MM-DD
}

export interface DocCalEvent {
  id: string
  resident_id?: string | null
  name?: string | null
  doc_type: 'contract' | 'plan' | 'eval'
  doc_label: string
  date: string          // YYYY-MM-DD
  kind?: string | null
  memo?: string | null
}

export interface EduCalEvent {
  id: string
  date: string          // YYYY-MM-DD (완료면 실시일, 미완료면 예정일)
  title: string
  division: '평가' | '법정' | '기타'
  eval_no?: string | null
  org?: string | null
  done: boolean
}

export const scheduleAPI = {
  events: (params?: { start_date?: string; end_date?: string; category?: string }) =>
    apiClient.get(`${BASE}/events`, { params: params ?? {} }).then(unwrap<ScheduleEvent[]>),
  createEvent: (body: EventInput) => apiClient.post(`${BASE}/events`, body).then(unwrap<ScheduleEvent>),
  updateEvent: (id: string, body: Partial<EventInput> & { status?: string }) =>
    apiClient.patch(`${BASE}/events/${id}`, body).then(unwrap<ScheduleEvent>),
  deleteEvent: (id: string) => apiClient.delete(`${BASE}/events/${id}`).then(r => r.data),
  lifecycle: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get(`${BASE}/lifecycle`, { params: params ?? {} }).then(unwrap<LifecycleEvent[]>),
  renewals: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get(`${BASE}/renewals`, { params: params ?? {} }).then(unwrap<RenewalEvent[]>),
  docEvents: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get(`${BASE}/doc-events`, { params: params ?? {} }).then(unwrap<DocCalEvent[]>),
  eduEvents: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get(`${BASE}/edu-events`, { params: params ?? {} }).then(unwrap<EduCalEvent[]>),
}
