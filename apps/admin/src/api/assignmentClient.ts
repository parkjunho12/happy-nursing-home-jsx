import { apiClient } from './client'

const BASE = '/api/v1/admin/assignments'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface AssignRow {
  resident_id: string
  name: string
  floor: string
  room: string
  admission_date?: string | null
  care_staff_id?: string | null
  care_staff_name?: string | null
  rehab_staff_id?: string | null
  rehab_staff_name?: string | null
  note?: string | null
}
export interface StaffOpt { id: string; name: string }
export interface AssignLog {
  id: string; resident_name?: string | null; field: string
  before?: string | null; after?: string | null; changed_by?: string | null; at?: string | null
}

export const assignmentAPI = {
  roster: () => apiClient.get(BASE).then(unwrap<{ rows: AssignRow[]; care_staff: StaffOpt[]; rehab_staff: StaffOpt[] }>),
  setCare: (rid: string, staffId: string | null) =>
    apiClient.put(`${BASE}/${rid}`, { care_staff_id: staffId, set_care: true }).then(r => r.data),
  setRehab: (rid: string, staffId: string | null) =>
    apiClient.put(`${BASE}/${rid}`, { rehab_staff_id: staffId, set_rehab: true }).then(r => r.data),
  setNote: (rid: string, note: string) =>
    apiClient.put(`${BASE}/${rid}`, { note, set_note: true }).then(r => r.data),
  setRoom: (rid: string, room: string) =>
    apiClient.put(`${BASE}/${rid}`, { room, set_room: true }).then(r => r.data),
  auto: (kind: 'care' | 'rehab') =>
    apiClient.post(`${BASE}/auto?kind=${kind}`).then(unwrap<{ assigned: number; load: { name: string; count: number }[] }>),
  logs: (limit = 50) => apiClient.get(`${BASE}/logs`, { params: { limit } }).then(unwrap<AssignLog[]>),
}
