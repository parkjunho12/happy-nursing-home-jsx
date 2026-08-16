import { apiClient } from './client'

function unwrap<T>(res: any): T {
  const d = res?.data
  return (d && typeof d === 'object' && 'data' in d ? d.data : d) as T
}

const BASE = '/api/v1/admin/operations'

export interface OpPeriod { start: string; end: string; note?: string | null; recorded_at?: string | null }
export interface OpContract {
  id: string; section: string; category: string; vendor?: string | null
  grp?: string | null
  contact?: string | null; amount_note?: string | null
  start_date?: string | null; end_date?: string | null; pay_day?: string | null
  periods?: OpPeriod[]
  memo?: string | null; active: boolean; sort: number
  /** 납부 대장에 올라와 있는지 (서버 계산) */
  on_ledger?: boolean
  /** 매달 돈이 나가는 구분인지 — 업체·점검은 참고용이라 false */
  payable?: boolean
}
export interface OpPayItem {
  id: string; section: string; category: string; vendor?: string | null
  method?: string | null; grp?: string | null; sort: number; active: boolean
  contract_id?: string | null
}
export interface OpPayment { id: string; amount: number; paid_on?: string | null; note?: string | null }
export type OpPaymentsMap = Record<string, Record<string, OpPayment[]>>

export const operationsAPI = {
  contracts: () => apiClient.get(`${BASE}/contracts`).then(unwrap<OpContract[]>),
  createContract: (b: Partial<OpContract>) => apiClient.post(`${BASE}/contracts`, b).then(unwrap<OpContract>),
  updateContract: (id: string, b: Partial<OpContract>) => apiClient.put(`${BASE}/contracts/${id}`, b).then(unwrap<OpContract>),
  deleteContract: (id: string) => apiClient.delete(`${BASE}/contracts/${id}`).then(r => r.data),

  /** 계약 대장에는 있는데 납부 대장에 없는 계약들 */
  missingPayItems: () => apiClient.get(`${BASE}/missing-pay-items`).then(unwrap<OpContract[]>),
  /** 빠진 계약을 한 번에 납부 대장에 올린다 */
  syncPayItems: () => apiClient.post(`${BASE}/sync-pay-items`, {})
    .then(unwrap<{ added: number; created: number; linked: number; names: string[] }>),

  payItems: () => apiClient.get(`${BASE}/pay-items`).then(unwrap<OpPayItem[]>),
  createPayItem: (b: Partial<OpPayItem>) => apiClient.post(`${BASE}/pay-items`, b).then(unwrap<OpPayItem>),
  updatePayItem: (id: string, b: Partial<OpPayItem>) => apiClient.put(`${BASE}/pay-items/${id}`, b).then(unwrap<OpPayItem>),
  deletePayItem: (id: string) => apiClient.delete(`${BASE}/pay-items/${id}`).then(r => r.data),

  payments: (year: number) => apiClient.get(`${BASE}/payments`, { params: { year } }).then(unwrap<OpPaymentsMap>),
  createPayment: (b: { item_id: string; year_month: string; amount: number; paid_on?: string; note?: string }) =>
    apiClient.post(`${BASE}/payments`, b).then(unwrap<{ id: string }>),
  updatePayment: (id: string, b: { amount?: number; paid_on?: string; note?: string }) =>
    apiClient.put(`${BASE}/payments/${id}`, b).then(unwrap<{ id: string }>),
  deletePayment: (id: string) => apiClient.delete(`${BASE}/payments/${id}`).then(r => r.data),

  seed: () => apiClient.post(`${BASE}/seed`).then(unwrap<{ contracts: number; items: number; payments: number }>),

  expenseMatrix: (year: number) =>
    apiClient.get(`${BASE}/expense-matrix`, { params: { year } }).then(unwrap<ExpenseMatrixRow[]>),
  expenseCandidates: (year: number) =>
    apiClient.get(`${BASE}/expense-candidates`, { params: { year } }).then(unwrap<ExpenseCandidate[]>),
  importExpense: (b: { expense_id: string; item_id: string; year_month?: string; paid_on?: string }) =>
    apiClient.post(`${BASE}/import-expense`, b).then(unwrap<{ id: string }>),
}

export interface ExpenseMatrixRow {
  category: string
  months: Record<string, { amount: number; count: number }>
  total: number
}
export interface ExpenseCandidate {
  id: string; title: string; amount: number; vendor?: string | null
  category: string; payment_method?: string | null
  year_month: string; paid_on: string; paid: boolean; requester?: string | null
}
