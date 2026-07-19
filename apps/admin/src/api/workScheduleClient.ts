import { apiClient } from './client'

const BASE = '/api/v1/admin/work-schedule'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type ScheduleData = Record<string, Record<string, string>>  // { staffId: { day: code } }
export interface WorkScheduleDoc {
  year_month: string
  data: ScheduleData
  updated_by?: string | null
  updated_at?: string | null
}

export const workScheduleAPI = {
  get: (month: string) => apiClient.get(BASE, { params: { month } }).then(unwrap<WorkScheduleDoc>),
  save: (year_month: string, data: ScheduleData) =>
    apiClient.put(BASE, { year_month, data }).then(unwrap<WorkScheduleDoc>),
}
