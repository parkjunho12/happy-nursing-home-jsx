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
export interface StaffOpt { id: string; name: string; pending?: boolean; hire_date?: string | null }
export interface AssignLog {
  id: string; resident_name?: string | null; field: string
  before?: string | null; after?: string | null; changed_by?: string | null; at?: string | null
}

export interface AssignNote {
  content: string
  updated_at?: string | null
  updated_by?: string | null
  max_length: number
}

export interface SnapDay {
  date: string
  count: number
  changed_by?: string | null
  updated_at?: string | null
}

export interface SnapDetail {
  date: string
  rows: AssignRow[]
  memo: string
  changed_by?: string | null
  updated_at?: string | null
}

export const assignmentAPI = {
  /** 명단이 바뀐 날 목록 — 그날 탭을 만든다 */
  snapshots: () => apiClient.get(`${BASE}/snapshots`)
    .then(unwrap<{ today: string; days: SnapDay[] }>),
  snapshot: (date: string) =>
    apiClient.get(`${BASE}/snapshots/${date}`).then(unwrap<SnapDetail>),

  /** 명단에 함께 붙는 메모 — 어르신 한 분이 아니라 다 같이 알아야 하는 것 */
  note: () => apiClient.get(`${BASE}/note`).then(unwrap<AssignNote>),
  saveNote: (content: string) =>
    apiClient.put(`${BASE}/note`, { content }).then(unwrap<AssignNote>),

  roster: () => apiClient.get(BASE).then(unwrap<{ rows: AssignRow[]; care_staff: StaffOpt[]; rehab_staff: StaffOpt[] }>),
  setCare: (rid: string, staffId: string | null) =>
    apiClient.put(`${BASE}/${rid}`, { care_staff_id: staffId, set_care: true }).then(r => r.data),
  setRehab: (rid: string, staffId: string | null) =>
    apiClient.put(`${BASE}/${rid}`, { rehab_staff_id: staffId, set_rehab: true }).then(r => r.data),
  setNote: (rid: string, note: string) =>
    apiClient.put(`${BASE}/${rid}`, { note, set_note: true }).then(r => r.data),
  setRoom: (rid: string, room: string) =>
    apiClient.put(`${BASE}/${rid}`, { room, set_room: true }).then(r => r.data),
  /** 층·호실을 한 번에 — 빈 문자열 둘 다 보내면 배정 해제. force=만실 강행 */
  setBed: (rid: string, floor: string, room: string, force?: boolean) =>
    apiClient.put(`${BASE}/${rid}`, {
      floor, room, set_floor: true, set_room: true,
      ...(force ? { allow_over_capacity: true } : {}),
    }).then(r => r.data),
  auto: (kind: 'care' | 'rehab') =>
    apiClient.post(`${BASE}/auto?kind=${kind}`).then(unwrap<{ assigned: number; load: { name: string; count: number }[] }>),
  logs: (limit = 50) => apiClient.get(`${BASE}/logs`, { params: { limit } }).then(unwrap<AssignLog[]>),
}
