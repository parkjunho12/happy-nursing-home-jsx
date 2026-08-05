import { apiClient } from './client'

const BASE = '/api/v1/admin/expense'
const ORIGIN = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

// multipart 전송: Content-Type을 undefined로 두면 브라우저가 boundary 포함해 자동 지정
const formHeaders = { headers: { 'Content-Type': undefined as any } }

export type ExpenseStatus = 'pending' | 'manager_approved' | 'approved' | 'rejected'

export interface ExpenseAttachment {
  id: string
  file_name: string
  file_url: string
  content_type?: string | null
  file_size?: number | null
  is_image: boolean
}
export interface ExpenseRequest {
  id: string
  title: string
  amount: number
  vendor?: string | null
  category: string
  payment_method?: string | null
  deposit_account?: string | null
  withdraw_account?: string | null
  paid_at?: string | null
  paid_by?: string | null
  purchased_at?: string | null
  memo?: string | null
  status: ExpenseStatus
  reject_reason?: string | null
  requester_id?: string | null
  requester_name?: string | null
  approver_name?: string | null
  approved_at?: string | null
  manager_name?: string | null
  manager_approved_at?: string | null
  created_at?: string | null
  attachments: ExpenseAttachment[]
  can_approve: boolean
  can_edit: boolean
  is_mine: boolean
}
export interface ExpenseMeta {
  categories: string[]
  payment_methods: string[]
  deposit_accounts?: string[]
  withdraw_accounts?: string[]
  is_approver: boolean
}
export interface ExpenseSummary {
  year: number
  month: number
  approved_total: number
  unpaid_total?: number
  unpaid_count?: number
  by_withdraw_account?: { account: string; amount: number }[]
  approved_count: number
  pending_total: number
  pending_count: number
  rejected_count: number
  by_category: { category: string; amount: number }[]
}

export const expenseAPI = {
  meta: () => apiClient.get(`${BASE}/meta`).then(unwrap<ExpenseMeta>),
  list: (params?: { status?: string; category?: string; start_date?: string; end_date?: string; mine?: boolean }) =>
    apiClient.get(`${BASE}/requests`, { params: params ?? {} }).then(unwrap<ExpenseRequest[]>),
  get: (id: string) => apiClient.get(`${BASE}/requests/${id}`).then(unwrap<ExpenseRequest>),
  create: (fd: FormData) => apiClient.post(`${BASE}/requests`, fd, formHeaders).then(unwrap<ExpenseRequest>),
  update: (id: string, fd: FormData) => apiClient.patch(`${BASE}/requests/${id}`, fd, formHeaders).then(unwrap<ExpenseRequest>),
  approve: (id: string) => apiClient.post(`${BASE}/requests/${id}/approve`).then(unwrap<ExpenseRequest>),
  accounts: () => apiClient.get(`${BASE}/accounts`).then(unwrap<{ withdraw: string[]; deposit: string[] }>),
  saveAccounts: (b: { withdraw_accounts?: string[]; deposit_accounts?: string[] }) =>
    apiClient.put(`${BASE}/accounts`, b).then(unwrap<{ withdraw: string[]; deposit: string[] }>),
  markPaid: (id: string, paid = true) => {
    const fd = new FormData(); fd.append('paid', String(paid))
    return apiClient.post(`${BASE}/requests/${id}/paid`, fd).then(unwrap<any>)
  },
  reject: (id: string, reason: string) => {
    const fd = new FormData(); fd.append('reason', reason)
    return apiClient.post(`${BASE}/requests/${id}/reject`, fd, formHeaders).then(unwrap<ExpenseRequest>)
  },
  remove: (id: string) => apiClient.delete(`${BASE}/requests/${id}`).then(r => r.data),
  summary: (year: number, month: number) =>
    apiClient.get(`${BASE}/summary`, { params: { year, month } }).then(unwrap<ExpenseSummary>),
  fileUrl: (u: string) => (u?.startsWith('http') ? u : `${ORIGIN}${u}`),
}

export const won = (n: number) => `₩${new Intl.NumberFormat('ko-KR').format(n || 0)}`
