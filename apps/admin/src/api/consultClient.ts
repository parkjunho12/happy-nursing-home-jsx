import { apiClient } from './client'

const BASE = '/api/v1/admin/consults'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 상담 한 건. 칸 이름은 utils/consultForm 의 표와 같아야 한다. */
export interface ConsultRow {
  id: string
  consulted_on: string
  consulted_at?: string | null
  counselor?: string | null
  route?: string | null
  method?: string | null
  caller?: string | null

  resident_name?: string | null
  gender?: string | null
  age?: number | null
  height_cm?: string | null
  weight_kg?: string | null
  living?: string | null
  living_note?: string | null

  grade?: string | null
  benefit?: string | null
  copay?: string | null
  grade_note?: string | null

  diagnosis?: string | null
  behavior?: string | null
  sleep?: string | null
  hearing?: string | null
  hearing_aid?: string | null
  vision?: string | null
  glasses?: string | null
  speech?: string | null
  mobility?: string | null
  toileting?: string | null
  eating?: string | null
  diet?: string | null
  health_note?: string | null

  children?: string | null
  guardian_name?: string | null
  guardian_relation?: string | null
  guardian_phone?: string | null
  address?: string | null

  visit_plan?: string | null
  visit_date?: string | null
  checkup?: string | null
  checkup_note?: string | null
  wish_date?: string | null
  notes?: string | null
  guided?: string | null

  /** 부부 상담 — 두 장이 서로를 가리킨다 */
  partner_id?: string | null
  partner?: { id: string; resident_name?: string | null; gender?: string | null; age?: number | null; status?: string } | null
  couple_room?: string | null
  cost_guided?: string | null

  status: string
  followup_on?: string | null
  created_by?: string | null
  created_at?: string | null
  updated_by?: string | null
  updated_at?: string | null
}

export type ConsultPatch = Partial<Omit<ConsultRow,
  'id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'partner' | 'partner_id'>>

export const consultAPI = {
  /** scope: open(진행 중) · done(끝난 것) · all */
  list: (scope: 'open' | 'done' | 'all' = 'open', q?: string) =>
    apiClient.get(BASE, { params: { scope, ...(q ? { q } : {}) } })
      .then(unwrap<{ items: ConsultRow[] }>),
  get: (id: string) => apiClient.get(`${BASE}/${id}`).then(unwrap<ConsultRow>),
  create: (b: ConsultPatch) => apiClient.post(BASE, b).then(unwrap<ConsultRow>),
  update: (id: string, b: ConsultPatch) => apiClient.put(`${BASE}/${id}`, b).then(unwrap<ConsultRow>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(unwrap<{ deleted: string }>),
  /** 배우자 상담을 한 장 더 만들어 묶는다 — 상담 개요·보호자·주소를 옮겨 적는다 */
  addPartner: (id: string) => apiClient.post(`${BASE}/${id}/partner`).then(unwrap<ConsultRow>),
  /** 부부 묶음 풀기 — 두 장은 남는다 */
  unlink: (id: string) => apiClient.post(`${BASE}/${id}/unlink`).then(unwrap<ConsultRow>),
}
