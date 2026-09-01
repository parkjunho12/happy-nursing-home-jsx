import { apiClient } from './client'

const BASE = '/api/v1/admin/staff-eval'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface EvalItem { key: string; label: string }

export interface Evaluation {
  period: string
  scores: Record<string, number>
  items: EvalItem[]
  comment: string
  total: number
  /** 몇 항목을 매겼는지 — 빈 칸이 있으면 합계를 믿으면 안 된다 */
  filled: number
  item_count: number
  evaluator_name?: string | null
  updated_at?: string | null
}

export interface EvalRow {
  staff_id: string
  name: string
  position?: string | null
  hire_date?: string | null
  evaluation: Evaluation | null
}

export interface EvalPage {
  period: string
  items: EvalItem[]
  max_score: number
  full_marks: number
  rows: EvalRow[]
}

export const staffEvalAPI = {
  list: (period: string) =>
    apiClient.get(BASE, { params: { period } }).then(unwrap<EvalPage>),
  save: (staffId: string, period: string, body: { scores: Record<string, number>; comment: string }) =>
    apiClient.put(`${BASE}/${staffId}`, body, { params: { period } }).then(unwrap<Evaluation>),
  remove: (staffId: string, period: string) =>
    apiClient.delete(`${BASE}/${staffId}`, { params: { period } }).then(unwrap<{ deleted: boolean }>),
  history: (staffId: string) =>
    apiClient.get(`${BASE}/history/${staffId}`).then(unwrap<{ rows: Evaluation[] }>),
}

export { currentPeriod, periodLabel, shiftPeriod } from '@/utils/evalPeriod'
