import { apiClient } from './client'

const BASE = '/api/v1/admin/diet-followups'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 식이가 바뀌면 따라오는 일 한 건 */
export interface DietFollowUp {
  id: string
  resident_id: string
  resident_name?: string | null
  floor?: string | null
  room?: string | null
  /** 식이가 바뀐 날 */
  effective_date: string
  before_label?: string | null
  after_label?: string | null
  /** 식이를 바꾼 사유 */
  note?: string | null
  tasks: { key: 'assess' | 'plan'; label: string; done_at?: string | null; done_by?: string | null }[]
  done_at?: string | null
  done_by?: string | null
  /** '해당 없음' 으로 접은 까닭 */
  skip_reason?: string | null
  created_at?: string | null
}

export const dietFollowupAPI = {
  /** scope: open(아직 안 끝난 것) · done · all */
  list: (scope: 'open' | 'done' | 'all' = 'open', limit = 100) =>
    apiClient.get(BASE, { params: { scope, limit } })
      .then(unwrap<{ items: DietFollowUp[]; open_count: number }>),
  setTask: (id: string, task: 'assess' | 'plan', done: boolean) =>
    apiClient.post(`${BASE}/${id}/task`, { task, done }).then(unwrap<DietFollowUp>),
  /** 해당 없음으로 접기 — 까닭을 적어야 접힌다 */
  skip: (id: string, reason: string) =>
    apiClient.post(`${BASE}/${id}/skip`, { reason }).then(unwrap<DietFollowUp>),
  reopen: (id: string) => apiClient.post(`${BASE}/${id}/reopen`).then(unwrap<DietFollowUp>),
}
