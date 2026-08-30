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
  floor?: string | null       // 담당 층 (2층·3층…) — 요양보호사만 쓴다
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
  /** 확정 잠금 — 켜져 있으면 이 달은 아무도 못 고친다 */
  locked?: boolean
  locked_by?: string | null
  locked_at?: string | null
}
/** 내 근무표 응답 */
export interface MySchedule {
  year_month: string
  staff_name: string
  team?: string | null
  codes: Record<string, string>   // day → 근무 코드
  updated_at?: string | null
  note?: string | null   // 개인별 한 줄 설명 (저장 시 생성)
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
  /** 확정 잠금 — ADMIN만. 잠그면 저장·휴가 승인·맞교대가 모두 막힌다 */
  setLock: (year_month: string, locked: boolean) =>
    apiClient.post(`${BASE}/lock`, { year_month, locked }).then(unwrap<WorkScheduleDoc>),
  /** 근무표 발표 알림 — 전 직원 푸시 */
  notify: (year_month: string) =>
    apiClient.post(`${BASE}/notify`, { year_month }).then(unwrap<{ tokens: number; recipients?: number; sent: number; failed: number }>),
  /** 개인별 한 줄 설명 생성 — 저장 후 호출, AI 실패 시 서버가 템플릿으로 대체 */
  explain: (month: string, people: {
    staff_id: string; name: string; team?: string | null
    hours: number; base: number; d: number; n: number
    annual: number; daehyu: number; comp: number; extra: number; carry?: number | null
  }[]) => apiClient.post(`${BASE}/explain`, { month, people }).then(unwrap<{ count: number; ai: boolean }>),
  /** 내 근무표 — 전 직원 */
  mine: (month: string) =>
    apiClient.get(`${BASE}/mine`, { params: { month } }).then(unwrap<MySchedule>),
  /** 전역 설정 — 정산 시작월·회전 기준일 */
  config: () => apiClient.get(`${BASE}/config`).then(unwrap<{
    settle_start: string; rotation_anchor: string
    /** 설정에서 고친 코드별 시간 — 비어 있으면 기본값 */
    code_hours?: Record<string, number>
    /** 고칠 수 있는 코드와 기본값 */
    code_hours_default?: Record<string, number>
    /** 시점 설정 — [{from:'2026-09', hours:{N:10}}] */
    code_hours_rules?: { from: string; hours: Record<string, number> }[]
  }>),
  saveConfig: (b: {
    settle_start?: string; rotation_anchor?: string
    /** {'N': 10} — 기본값과 같은 값은 서버가 알아서 지운다 */
    code_hours?: Record<string, number>
    /** [{from:'2026-09', hours:{N:10}}] — 그 달부터 적용 */
    code_hours_rules?: { from: string; hours: Record<string, number> }[]
  }) => apiClient.put(`${BASE}/config`, b).then(unwrap<{
    settle_start: string; rotation_anchor: string
    code_hours?: Record<string, number>
    code_hours_rules?: { from: string; hours: Record<string, number> }[]
  }>),
  versions: (month: string) =>
    apiClient.get(`${BASE}/versions`, { params: { month } }).then(unwrap<ScheduleVersion[]>),
  version: (id: string) =>
    apiClient.get(`${BASE}/versions/${id}`).then(unwrap<ScheduleVersionFull>),
  /** 해당 월 공휴일 { 'YYYY-MM-DD': { name, kind } } */
  holidays: (month: string) =>
    apiClient.get(`${BASE}/holidays`, { params: { month } }).then(unwrap<Record<string, HolidayInfo>>),
}
