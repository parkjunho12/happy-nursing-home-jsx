import { apiClient } from './client'

const BASE = '/api/v1/admin/handover'
const ORIGIN = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type Urgency = 'high' | 'medium' | 'low'
export interface HandoverEntry {
  date: string; time: string; resident: string; content: string; writer: string
  vitals: string; category: string; urgency: Urgency; confidence: string
}
export interface HandoverAlert { resident: string; issue: string; action: string }
export interface SuggestedChecklist {
  title: string; frequency: string; person_name: string; reason: string
  due_days?: number; due_date?: string; due_label?: string
}
export interface HandoverReportBody {
  entries: HandoverEntry[]; summary: string; key_points: string[]
  alerts: HandoverAlert[]; suggested_checklists: SuggestedChecklist[]
  unreadable_notes: string; model?: string | null; error?: string
}
export interface HandoverRecord {
  id: string; images: string[]; report: HandoverReportBody
  model?: string | null; author?: string | null; created_at?: string | null
}
export interface AccessRow { id: string; name: string; position?: string | null; role: string; always: boolean; granted: boolean }

export const handoverImageUrl = (u?: string | null) => (!u ? null : u.startsWith('http') ? u : `${ORIGIN}${u}`)

export const handoverAPI = {
  analyze: (files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('images', f))
    return apiClient.post(`${BASE}/analyze`, fd, {
      headers: { 'Content-Type': undefined as any }, timeout: 240000,
    }).then(unwrap<HandoverRecord>)
  },
  history: () => apiClient.get(`${BASE}/history`).then(unwrap<HandoverRecord[]>),
  detail: (id: string) => apiClient.get(`${BASE}/history/${id}`).then(unwrap<HandoverRecord>),
  remove: (id: string) => apiClient.delete(`${BASE}/history/${id}`).then(r => r.data),
  push: (id: string) => apiClient.post(`${BASE}/history/${id}/push`).then(unwrap<{ tokens: number; recipients: number; sent: number; failed: number }>),
  createChecklists: (id: string, items: { title: string; frequency: string; person_name?: string | null; due_date?: string | null }[]) =>
    apiClient.post(`${BASE}/history/${id}/checklists`, items).then(r => r.data),
  accessList: () => apiClient.get(`${BASE}/access`).then(unwrap<AccessRow[]>),
  setAccess: (userId: string, granted: boolean) =>
    apiClient.patch(`${BASE}/access/${userId}`, { granted }).then(r => r.data),
}
