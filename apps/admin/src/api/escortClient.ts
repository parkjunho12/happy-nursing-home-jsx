import { apiClient } from './client'

const BASE = '/api/v1/admin/hospital-escorts'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type EscortStatus = 'draft' | 'shared' | 'sent' | 'decided' | 'done' | 'canceled'

export interface Escort {
  id: string
  resident_id?: string | null
  resident_name: string
  floor?: string | null
  room?: string | null
  /** 가능 · 부축 필요 · 불가 */
  walking?: string | null
  /** 있음 · 없음 */
  hemiplegia?: string | null
  /** 사용 · 미사용 */
  wheelchair?: string | null
  notes?: string | null
  hospital: string
  department?: string | null
  visit_date: string
  visit_time?: string | null
  status: EscortStatus
  vendor?: string | null
  transport?: string | null
  transport_note?: string | null
  cancel_reason?: string | null
  shared_at?: string | null; shared_by?: string | null
  sent_at?: string | null; sent_by?: string | null
  decided_at?: string | null; decided_by?: string | null
  done_at?: string | null; done_by?: string | null
  created_by?: string | null
  created_at?: string | null
  /** 부서 톡방에 붙여넣을 글 — 서버가 만든다 */
  request_text: string
  /** 이동수단 확정 알림 글 (정해진 뒤에만) */
  decision_text?: string | null
  /** 업체에 넘기기 전에 채워야 하는 칸 */
  missing: string[]
  can_nursing: boolean
  can_welfare: boolean
}

export interface EscortList {
  items: Escort[]
  options: { walking: string[]; hemiplegia: string[]; wheelchair: string[] }
  can_nursing: boolean
  can_welfare: boolean
}

export interface EscortLog {
  id: string
  action: string
  label: string
  memo?: string | null
  actor?: string | null
  created_at?: string | null
}

export interface EscortInput {
  resident_id?: string | null
  resident_name: string
  floor?: string | null
  room?: string | null
  walking?: string | null
  hemiplegia?: string | null
  wheelchair?: string | null
  notes?: string | null
  hospital: string
  department?: string | null
  visit_date: string
  visit_time?: string | null
}

export const escortAPI = {
  list: (scope: 'open' | 'all' | 'done' = 'open') =>
    apiClient.get(BASE, { params: { scope } }).then(unwrap<EscortList>),
  create: (b: EscortInput) => apiClient.post(BASE, b).then(unwrap<Escort>),
  edit: (id: string, b: EscortInput) => apiClient.patch(`${BASE}/${id}`, b).then(unwrap<Escort>),
  /** 부서 톡방에 올렸다고 표시 */
  share: (id: string, memo?: string) =>
    apiClient.post(`${BASE}/${id}/share`, { memo }).then(unwrap<Escort>),
  /** 업체에 전달했다고 표시 */
  send: (id: string, b: { vendor?: string; memo?: string }) =>
    apiClient.post(`${BASE}/${id}/send`, b).then(unwrap<Escort>),
  /** 보호자·업체가 협의해 정한 이동수단을 적는다 */
  decide: (id: string, b: { transport: string; transport_note?: string }) =>
    apiClient.post(`${BASE}/${id}/decide`, b).then(unwrap<Escort>),
  done: (id: string, memo?: string) =>
    apiClient.post(`${BASE}/${id}/done`, { memo }).then(unwrap<Escort>),
  cancel: (id: string, reason: string) =>
    apiClient.post(`${BASE}/${id}/cancel`, { reason }).then(unwrap<Escort>),
  logs: (id: string) => apiClient.get(`${BASE}/${id}/logs`).then(unwrap<EscortLog[]>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(unwrap<{ deleted: string }>),
}
