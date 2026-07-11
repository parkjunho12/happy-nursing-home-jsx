import { apiClient } from './client'

const BASE = '/api/v1/admin/card-keys'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface CardKey {
  id: string
  seq: number
  card_number?: string | null
  holder?: string | null
  staff_id?: string | null
  deposit_date?: string | null
  deposit_method?: string | null
  deposit_amount?: string | null
  returned?: boolean
  return_date?: string | null
  returner?: string | null
  memo?: string | null
}
export interface CardInput {
  card_number?: string | null
  holder?: string | null
  staff_id?: string | null
  deposit_date?: string | null
  deposit_method?: string | null
  deposit_amount?: string | null
  returned?: boolean
  return_date?: string | null
  returner?: string | null
  memo?: string | null
}

export const cardKeyAPI = {
  list: () => apiClient.get(`${BASE}/records`).then(unwrap<CardKey[]>),
  create: (b: CardInput) => apiClient.post(`${BASE}/records`, b).then(unwrap<CardKey>),
  update: (id: string, b: CardInput) => apiClient.patch(`${BASE}/records/${id}`, b).then(unwrap<CardKey>),
  remove: (id: string) => apiClient.delete(`${BASE}/records/${id}`).then(r => r.data),
}
