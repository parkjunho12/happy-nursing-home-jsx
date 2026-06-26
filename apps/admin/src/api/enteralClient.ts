import { apiClient } from './client'

const BASE = '/api/v1/admin/enteral'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type TxType = 'in' | 'out'

export interface EnteralProduct {
  id: string
  name: string
  brand?: string | null
  unit?: string | null
  spec?: string | null
  memo?: string | null
  unit_price?: number | null
  is_active: boolean
  sort_order: number
  stock: number
  created_at?: string | null
}

export interface EnteralTx {
  id: string
  product_id?: string | null
  product_name: string
  tx_type: TxType
  quantity: number
  unit_price?: number | null
  amount?: number
  resident_name?: string | null
  resident_id?: string | null
  tx_date: string
  note?: string | null
  created_by?: string | null
  created_at?: string | null
}

export type ProductInput = Partial<Omit<EnteralProduct, 'id' | 'stock' | 'created_at'>>
export interface TxInput {
  product_id?: string | null
  product_name?: string | null
  tx_type: TxType
  quantity: number
  unit_price?: number | null
  resident_name?: string | null
  resident_id?: string | null
  tx_date?: string | null
  note?: string | null
}

export interface EnteralResident {
  id: string
  name: string
  room_name?: string | null
}

export interface ResidentCost {
  resident_name: string
  qty: number
  amount: number
  products: Array<{ product_name: string; qty: number; amount: number }>
}

export const enteralAPI = {
  products: () => apiClient.get(`${BASE}/products`).then(unwrap<EnteralProduct[]>),
  createProduct: (b: ProductInput) => apiClient.post(`${BASE}/products`, b).then(unwrap<EnteralProduct>),
  updateProduct: (id: string, b: ProductInput) => apiClient.patch(`${BASE}/products/${id}`, b).then(unwrap<EnteralProduct>),
  deleteProduct: (id: string) => apiClient.delete(`${BASE}/products/${id}`).then(r => r.data),
  transactions: (params?: { tx_type?: string; product_id?: string; resident?: string; start_date?: string; end_date?: string }) =>
    apiClient.get(`${BASE}/transactions`, { params: params ?? {} })
      .then(unwrap<{ items: EnteralTx[]; summary: { in: number; out: number; in_amount: number; out_amount: number; count: number } }>),
  createTransaction: (b: TxInput) => apiClient.post(`${BASE}/transactions`, b).then(unwrap<EnteralTx>),
  deleteTransaction: (id: string) => apiClient.delete(`${BASE}/transactions/${id}`).then(r => r.data),
  residentCosts: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get(`${BASE}/resident-costs`, { params: params ?? {} })
      .then(unwrap<{ items: ResidentCost[]; total: number; count: number }>),
  residents: () => apiClient.get(`${BASE}/residents`).then(unwrap<EnteralResident[]>),
  exportBlob: (kind: 'transactions' | 'resident-costs' | 'stock', params?: Record<string, string | undefined>) =>
    apiClient.get(`${BASE}/export/${kind}`, { params: params ?? {}, responseType: 'blob' }).then(r => r.data as Blob),
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
