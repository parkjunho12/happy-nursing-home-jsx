import { apiClient } from './client'

const BASE = '/api/v1/admin/routines'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export const ROUTINE_CATEGORIES = ['신고·납부', '급여', '보고', '점검', '기타'] as const
export type RoutineCategory = (typeof ROUTINE_CATEGORIES)[number]

/** 그 달에 해야 할 업무 1건 — 규칙 + 그 달의 완료 여부 */
export interface RoutineItem {
  id: string
  title: string
  day: number            // 매월 며칠 (1~31, 31 = 말일)
  date: string           // 그 달의 실제 날짜 'YYYY-MM-DD' (없는 날은 말일로 당김)
  category: string
  memo?: string | null
  active: boolean
  sort: number
  done: boolean
  done_date?: string | null
  done_by?: string | null
  done_memo?: string | null
  overdue: boolean       // 날짜는 지났는데 아직 안 한 것
}

export interface RoutineMonth {
  month: string          // 'YYYY-MM'
  today: string
  items: RoutineItem[]
  total: number
  done_count: number
}

export interface RoutineInput {
  title: string
  day: number
  category: string
  memo?: string | null
  sort?: number
  active?: boolean
}

export const adminRoutineAPI = {
  month: (month?: string, includeInactive = false) =>
    apiClient.get(BASE, { params: { ...(month ? { month } : {}), include_inactive: includeInactive } })
      .then(unwrap<RoutineMonth>),
  create: (body: RoutineInput) => apiClient.post(BASE, body).then(unwrap<{ id: string }>),
  update: (id: string, body: Partial<RoutineInput>) =>
    apiClient.patch(`${BASE}/${id}`, body).then(r => r.data),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
  setDone: (id: string, body: { month?: string; done: boolean; done_date?: string; memo?: string }) =>
    apiClient.post(`${BASE}/${id}/done`, body).then(unwrap<{ done: boolean; done_date?: string; done_by?: string }>),
}
