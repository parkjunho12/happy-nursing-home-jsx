import { apiClient } from './client'

const BASE = '/api/v1/admin/outgoing-docs'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 내보내야 할 문서 한 건. issued_at 이 차면 목록에서 내려가고 기록으로 남는다. */
export interface OutgoingDoc {
  id: string
  person_id?: string | null
  person_name?: string | null
  title: string
  note: string
  target?: string | null
  /** 지금 그 서류가 어디 있는가 — 기본 '1층 현관' */
  location?: string | null
  due_date?: string | null
  issued_at?: string | null
  issued_by?: string | null
  issued_to?: string | null
  created_by?: string | null
  created_at?: string | null
}

export const outgoingDocAPI = {
  /** issued 를 비우면 전부 — 화면에서 '내보낼 것'과 '기록'으로 나눠 쓴다 */
  list: (issued?: boolean) =>
    apiClient.get(BASE, { params: issued === undefined ? {} : { issued } })
      .then(unwrap<OutgoingDoc[]>),
  add: (b: { person_id?: string | null; title: string; note?: string
             target?: string | null; location?: string | null; due_date?: string | null }) =>
    apiClient.post(BASE, b).then(unwrap<OutgoingDoc>),
  /** 교부 전에 고친다 — 위치가 가장 자주 바뀐다 */
  edit: (id: string, b: { title?: string; note?: string; target?: string
                          location?: string; due_date?: string }) =>
    apiClient.patch(`${BASE}/${id}`, b).then(unwrap<OutgoingDoc>),
  /** 교부 — 목록에서 내리고 날짜를 남긴다 */
  issue: (id: string, b?: { issued_to?: string; issued_at?: string }) =>
    apiClient.post(`${BASE}/${id}/issue`, b ?? {}).then(unwrap<OutgoingDoc>),
  /** 잘못 눌렀을 때 되돌린다 */
  undo: (id: string) => apiClient.post(`${BASE}/${id}/undo`).then(unwrap<OutgoingDoc>),
  /** 아직 교부하지 않은 줄만 지울 수 있다 */
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(unwrap<{ deleted: string }>),
}
