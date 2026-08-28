import { apiClient } from './client'

const BASE = '/api/v1/admin/therapy'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 조의 성격 — 부르는 방식이 다르다 */
export type GroupKind = 'gather' | 'visit'

export const KIND_META: Record<GroupKind, { label: string; hint: string }> = {
  gather: { label: '나오는 조', hint: '프로그램실로 모이는 분들 — 방송으로 부릅니다' },
  visit:  { label: '찾아가는 조', hint: '누워 계셔서 방으로 찾아가는 분들 — 방송하지 않습니다' },
}

export interface TherapyMember {
  resident_id: string
  name: string
  floor?: string | null
  room?: string | null
  status?: string | null
}

export interface TherapyGroup {
  id: string
  name: string
  floor?: string | null
  kind: GroupKind
  note?: string | null
  color?: string | null
  sort: number
  active: boolean
  members: TherapyMember[]
  count: number
}

export interface TherapySlot {
  id: string
  weekday: number          // 0=월 … 6=일
  start_time: string
  end_time?: string | null
  group_id: string
  place?: string | null
  activity?: string | null
  broadcast: boolean
  notify: boolean
  lead_min: number
  active: boolean
}

export interface TherapyOverview {
  groups: TherapyGroup[]
  unassigned: TherapyMember[]
  slots: TherapySlot[]
}

/** 0=월 … 6=일 — 파이썬 weekday 와 같은 순서로 둔다(변환 실수를 줄인다) */
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 자동 편성 — 수급자에 이미 있는 인지·여가·신체 그룹(A/B/C)으로 조를 짠다 */
export type ComposeAxis = 'physical' | 'cognitive' | 'leisure'

export const AXIS_META: Record<ComposeAxis, string> = {
  physical: '신체', cognitive: '인지', leisure: '여가',
}

export interface ComposePlanGroup {
  name: string
  floor?: string | null
  group: string
  exists: boolean
  count: number
  members: { resident_id: string; name: string; room?: string | null }[]
}

export interface ComposePlan {
  axis: ComposeAxis
  axis_label: string
  by_floor: boolean
  groups: ComposePlanGroup[]
  skipped: { resident_id: string; name: string; floor?: string | null }[]
  group_count: number
  assigned: number
  moving: number
  dry_run: boolean
}

export const therapyAPI = {
  overview: () => apiClient.get(BASE).then(unwrap<TherapyOverview>),

  createGroup: (b: Partial<TherapyGroup> & { name: string }) =>
    apiClient.post(`${BASE}/groups`, b).then(unwrap<TherapyGroup>),
  updateGroup: (id: string, b: Partial<TherapyGroup>) =>
    apiClient.patch(`${BASE}/groups/${id}`, b).then(unwrap<{ id: string }>),
  deleteGroup: (id: string) =>
    apiClient.delete(`${BASE}/groups/${id}`).then(unwrap<{ id: string }>),

  /** 명단을 통째로 바꾼다 — 다른 조에 있던 분은 그쪽에서 옮겨온다 */
  setMembers: (id: string, resident_ids: string[]) =>
    apiClient.put(`${BASE}/groups/${id}/members`, { resident_ids })
      .then(unwrap<{ group_id: string; count: number }>),

  /** 미리보기(dry_run=true)로 먼저 보여주고, 확인받은 뒤 저장한다 */
  autoCompose: (axis: ComposeAxis, by_floor: boolean, dry_run: boolean) =>
    apiClient.post(`${BASE}/auto-compose`, { axis, by_floor, dry_run })
      .then(unwrap<ComposePlan>),

  createSlot: (b: Partial<TherapySlot> & { weekday: number; start_time: string; group_id: string }) =>
    apiClient.post(`${BASE}/slots`, b).then(unwrap<TherapySlot>),
  updateSlot: (id: string, b: Partial<TherapySlot>) =>
    apiClient.patch(`${BASE}/slots/${id}`, b).then(unwrap<TherapySlot>),
  deleteSlot: (id: string) =>
    apiClient.delete(`${BASE}/slots/${id}`).then(unwrap<{ id: string }>),
}
