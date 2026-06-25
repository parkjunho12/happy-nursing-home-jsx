import { apiClient } from './client'

const BASE = '/api/v1'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type VolunteerStatus = '대기' | '연락완료' | '승인' | '보류'

export interface Volunteer {
  id: string
  name: string
  phone: string
  birth_or_age?: string | null
  preferred_activity?: string | null
  preferred_day?: string | null
  preferred_time?: string | null
  experience?: string | null
  memo?: string | null
  privacy_agreed: boolean
  status: VolunteerStatus
  admin_memo?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const volunteerAPI = {
  list: (status?: string) =>
    apiClient.get(`${BASE}/admin/volunteers`, { params: status ? { status } : {} })
      .then(unwrap<{ items: Volunteer[]; counts: Record<string, number> }>),
  get: (id: string) =>
    apiClient.get(`${BASE}/admin/volunteers/${id}`).then(unwrap<Volunteer>),
  update: (id: string, body: { status?: string; admin_memo?: string }) =>
    apiClient.patch(`${BASE}/admin/volunteers/${id}`, body).then(unwrap<Volunteer>),
}
