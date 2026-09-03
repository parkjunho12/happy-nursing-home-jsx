import { apiClient } from './client'

const BASE = '/api/v1/admin/emergency-bell'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface Bell {
  id: string
  floor: string
  no: number
  room: string
  kind: string
  note?: string | null
  resident_name?: string | null
  status?: string | null
  is_wc: boolean
  updated_at?: string | null
  updated_by?: string | null
}

export interface BellResident { name: string; floor: string; room: string }

export interface BellPage {
  floors: string[]
  rows: Bell[]
  /** 이름을 직접 치지 않고 고르게 하려고 함께 내려받는다 */
  residents: BellResident[]
  /** 이 사람이 이름을 고칠 수 있는가 — 서버에서도 다시 막는다 */
  can_edit: boolean
}

export const bellAPI = {
  list: (floor?: string) =>
    apiClient.get(BASE, { params: floor ? { floor } : {} }).then(unwrap<BellPage>),
  saveMany: (items: { id: string; resident_name: string; status: string }[]) =>
    apiClient.put(BASE, { items })
      .then(unwrap<{ saved: number; failed: { id: string; reason: string }[] }>),
}
