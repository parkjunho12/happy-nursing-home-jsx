import { apiClient } from './client'

const BASE = '/api/v1/admin/pension'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface PensionRow {
  staff_id: string
  name: string
  position?: string | null
  hire_date?: string | null
  status?: string | null
  wage?: number | null
  suggest_wage?: number | null   // 직전 달 임금 제안 (이번 달 미입력 시)
  accrued?: number | null
  deposited?: number | null
  deposit_date?: string | null
  memo?: string | null
  cum_accrued: number
  cum_deposited: number
}

export const pensionAPI = {
  month: (month: string) =>
    apiClient.get(BASE, { params: { month } }).then(unwrap<{ month: string; rows: PensionRow[] }>),
  save: (month: string, staffId: string, b: {
    wage?: number | null; accrued?: number | null; deposited?: number | null
    deposit_date?: string | null; memo?: string | null
  }) => apiClient.put(`${BASE}/${month}/${staffId}`, b).then(unwrap<any>),
}
