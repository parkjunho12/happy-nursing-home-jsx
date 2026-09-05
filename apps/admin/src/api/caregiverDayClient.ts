import { apiClient } from './client'

const BASE = '/api/v1/admin/caregiver-day'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 근무 유형별 일과표 한 줄 */
export interface Routine {
  id?: string
  shift_code: string
  floor?: string | null      // 비면 모든 층 공통
  start_time: string         // 'HH:MM'
  end_time?: string | null
  title: string
  note?: string | null
  sort?: number
}

/** 그날만의 일정 — 대상이 다 비면 전체 */
export interface DayTask {
  id: string
  date: string
  staff_id?: string | null
  staff_name?: string | null
  floor?: string | null
  start_time?: string | null
  title: string
  note?: string | null
  created_by?: string | null
}

/** 앱에서 보는 '내 하루' */
export interface MyDay {
  date: string
  staff_name?: string | null
  /** 직원 명단과 계정이 연결됐는지 — false 면 관리자에게 연동을 요청해야 한다 */
  linked: boolean
  shift_code?: string | null
  shift_label?: string | null
  floor?: string | null
  items: { time?: string | null; end?: string | null; title: string
           note?: string | null; kind: 'routine' | 'extra'; floor?: string | null }[]
  residents: { id: string; name: string; floor: string; room: string; note?: string | null }[]
}

export const caregiverDayAPI = {
  /** 오늘(또는 그날) 내 하루 — 근무·일과·오늘만의 일·담당 어르신을 한 번에 */
  mine: (date?: string) =>
    apiClient.get(`${BASE}/mine`, { params: date ? { date } : {} }).then(unwrap<MyDay>),

  routines: () => apiClient.get(`${BASE}/routines`).then(unwrap<{
    items: Routine[]
    shift_codes: { code: string; label: string }[]
  }>),
  /** 통째로 저장 — 화면에 보이는 것이 곧 저장된 것 */
  saveRoutines: (items: Routine[]) =>
    apiClient.put(`${BASE}/routines`, { items }).then(unwrap<{ count: number }>),

  day: (date: string) => apiClient.get(`${BASE}/day`, { params: { date } }).then(unwrap<DayTask[]>),
  addDay: (b: { date: string; staff_id?: string | null; floor?: string | null
                start_time?: string | null; title: string; note?: string | null }) =>
    apiClient.post(`${BASE}/day`, b).then(unwrap<DayTask>),
  removeDay: (id: string) =>
    apiClient.delete(`${BASE}/day/${id}`).then(unwrap<{ deleted: string }>),
}
