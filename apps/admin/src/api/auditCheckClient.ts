import { apiClient } from './client'

const BASE = '/api/v1/audit-check'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface AuditRound { id: string; date: string; title?: string | null; created_by?: string | null; total: number; done: number }
export interface AuditItem {
  id: string; section: string; sub?: string | null; title: string
  assignee_name?: string | null
  checked: boolean; checked_by?: string | null; checked_at?: string | null
  note?: string | null
}

export const auditCheckAPI = {
  rounds: () => apiClient.get(`${BASE}/rounds`).then(unwrap<AuditRound[]>),
  createRound: (date: string, title?: string) =>
    apiClient.post(`${BASE}/rounds`, { date, title }).then(unwrap<{ id: string }>),
  removeRound: (id: string) => apiClient.delete(`${BASE}/rounds/${id}`).then(r => r.data),
  items: (roundId: string) => apiClient.get(`${BASE}/rounds/${roundId}/items`).then(unwrap<AuditItem[]>),
  removeItem: (id: string) => apiClient.delete(`${BASE}/items/${id}`).then(r => r.data),
  patch: (id: string, b: { checked?: boolean; assignee_name?: string; note?: string }) =>
    apiClient.patch(`${BASE}/items/${id}`, b).then(unwrap<Partial<AuditItem> & { id: string }>),
}
