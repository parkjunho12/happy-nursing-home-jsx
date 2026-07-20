import { apiClient } from './client'

const BASE = '/api/v1/admin/work-schedule'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** kind: public=관공서 공휴일(빨간날) · paid=유급휴일(근로자의 날) */
export interface HolidayInfo { name: string; kind: string }

export type ScheduleData = Record<string, Record<string, string>>  // { staffId: { day: code } }
/** 근무표 왼쪽 고정열(직종·조) — 편성표 양식 */
export interface ScheduleRow {
  staff_id: string
  position?: string | null    // 직종 (시설장·사회복지사·간호조무사·요양보호사…)
  team?: string | null        // 조 (A조·B조·C조·주간)
  order?: number
  note?: string | null        // 비고
}
export interface WorkScheduleDoc {
  year_month: string
  data: ScheduleData
  rows: ScheduleRow[]
  base_hours?: string | null
  base_days?: string | null
  as_of?: string | null
  team_offsets?: Record<string, number> | null
  rows_from?: string | null   // 조 편성을 물려받은 달 (없으면 이번 달 것)
  updated_by?: string | null
  updated_at?: string | null
}
export interface SavePayload {
  year_month: string
  data: ScheduleData
  rows?: ScheduleRow[]
  base_hours?: string
  base_days?: string
  as_of?: string
  team_offsets?: Record<string, number>
}

/** 근무표 저장 이력 */
export interface ScheduleVersion {
  id: string
  year_month: string
  cells: number          // 입력된 근무 칸 수
  changed: number        // 직전 저장 대비 바뀐 칸 수
  base_hours?: string | null
  base_days?: string | null
  saved_by?: string | null
  saved_at?: string | null
}
export interface ScheduleVersionFull extends ScheduleVersion {
  data: ScheduleData
  rows: ScheduleRow[]
  as_of?: string | null
  team_offsets?: Record<string, number> | null
}

export const workScheduleAPI = {
  get: (month: string) => apiClient.get(BASE, { params: { month } }).then(unwrap<WorkScheduleDoc>),
  save: (body: SavePayload) => apiClient.put(BASE, body).then(unwrap<WorkScheduleDoc>),
  versions: (month: string) =>
    apiClient.get(`${BASE}/versions`, { params: { month } }).then(unwrap<ScheduleVersion[]>),
  version: (id: string) =>
    apiClient.get(`${BASE}/versions/${id}`).then(unwrap<ScheduleVersionFull>),
  /** 해당 월 공휴일 { 'YYYY-MM-DD': { name, kind } } */
  holidays: (month: string) =>
    apiClient.get(`${BASE}/holidays`, { params: { month } }).then(unwrap<Record<string, HolidayInfo>>),
}
