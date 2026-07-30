import { apiClient } from './client'

const BASE = '/api/v1/admin/meals'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export const MEAL_KEYS = ['아침', '간식(오전)', '점심', '간식(오후)', '저녁'] as const
export type MealKey = typeof MEAL_KEYS[number]
export type MealDay = Record<MealKey, string[]>

export interface MealWeekData {
  start: string; end: string
  days: Record<string, MealDay>
  notes: string[]
  updated_by?: string | null
  updated_at?: string | null
}
export interface MealMonthData {
  month: string
  days: Record<string, MealDay>
  notes: string[]
  week_count: number
}

export const mealAPI = {
  upload: (file: File) => {
    const f = new FormData(); f.append('file', file)
    return apiClient.post(`${BASE}/upload`, f, { headers: { 'Content-Type': undefined as any } })
      .then(unwrap<{ start: string; end: string; day_count: number }>)
  },
  week: (date: string) =>
    apiClient.get(`${BASE}/week`, { params: { date } }).then(unwrap<MealWeekData | null>),
  month: (month: string) =>
    apiClient.get(`${BASE}/month`, { params: { month } }).then(unwrap<MealMonthData>),
  weeks: () =>
    apiClient.get(`${BASE}/weeks`).then(unwrap<{ start: string; end: string; updated_by?: string | null }[]>),
}
