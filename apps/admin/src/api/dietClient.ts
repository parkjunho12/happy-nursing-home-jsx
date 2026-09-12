import { apiClient } from './client'

const BASE = '/api/v1/admin/diet'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 한 어르신의 그날 식이 */
export interface DietRow {
  resident_id: string
  name: string
  floor?: string | null
  room?: string | null
  rice?: string | null          // 일반식 · 당뇨식 · 다진식 · 죽 · 미음
  side?: string | null          // 일반찬 · 다진찬 · 갈찬
  tube: boolean                 // 경관식 — 밥·반찬을 고르지 않는다
  /** 이 식이가 시작된 날 */
  since?: string | null
  note?: string | null
  changed_by?: string | null
  /** 아직 아무도 정해 주지 않았다 */
  unset: boolean
  /** 앞으로 바뀔 예정 (예: 내일부터 죽) */
  upcoming?: { date: string; rice?: string | null; side?: string | null; tube: boolean } | null
}

/** 그날 그 끼니에 계신 직원 — 근무표에서 세어 낸다 */
export interface StaffMeal {
  meal: string
  /** 그 끼니 시각 'HH:MM' — 식사 시간 설정에서 온다 */
  time: string
  /** 그 달 근무표가 아직 없으면 false. 그때 counts 는 null */
  has_schedule: boolean
  counts: Record<string, number> | null
  groups: string[]
  /** 이 근무 코드만 센다 (점심은 ['D']) */
  codes: string[]
  /** 세어진 분들 — 숫자의 근거 */
  counted: { name: string; position: string; group: string; code: string }[]
  /** 빠진 분들과 그 까닭 */
  skipped: { name: string; position: string; group: string; code: string; why: string }[]
}

export interface DietToday {
  date: string
  residents: DietRow[]
  counts: Record<string, number>
  rice_types: string[]
  side_types: string[]
  can_edit: boolean
  staff_meal: StaffMeal
}

export interface DietChange {
  id: string
  resident_id: string
  name?: string | null
  effective_date: string
  rice?: string | null
  side?: string | null
  tube: boolean
  note?: string | null
  source: 'manual' | 'import'
  changed_by?: string | null
  created_at?: string | null
  /** 무엇이 무엇으로 바뀌었는지 — 이력 조회에서만 온다 */
  diff?: string[]
}

export interface ImportResult {
  dry_run: boolean
  sheets: number
  rows_read: number
  people_in_file: number
  changes_found: number
  will_add: number
  already_have: number
  unmatched_count: number
  unmatched: string[]
  ambiguous_count: number
  ambiguous: string[]
  first_date: string
  last_date: string
  added?: number
}

export const dietAPI = {
  /** 날짜를 주면 그날로 되감아 본다 */
  today: (date?: string, floor?: string) =>
    apiClient.get(BASE, { params: { ...(date ? { date } : {}), ...(floor ? { floor } : {}) } })
      .then(unwrap<DietToday>),
  set: (residentId: string, b: { rice?: string | null; side?: string | null
                                 tube?: boolean; effective_date?: string; note?: string }) =>
    apiClient.post(`${BASE}/${residentId}`, b).then(unwrap<DietChange>),
  history: (residentId: string) =>
    apiClient.get(`${BASE}/${residentId}/history`).then(unwrap<DietChange[]>),
  log: (limit = 200) =>
    apiClient.get(`${BASE}/log`, { params: { limit } }).then(unwrap<DietChange[]>),
  removeChange: (id: string) =>
    apiClient.delete(`${BASE}/changes/${id}`).then(unwrap<{ deleted: string }>),
  /** dry_run 이 기본 — 무엇이 들어갈지 먼저 보여주고 확인을 받는다 */
  importExcel: (file: File, apply = false) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post(`${BASE}/import?dry_run=${!apply}`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap<ImportResult>)
  },
}
