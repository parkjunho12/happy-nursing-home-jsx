import { apiClient } from './client'

const BASE = '/api/v1/admin/handover'
const ORIGIN = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type Urgency = 'high' | 'medium' | 'low'
export type MatchKind = 'exact' | 'masked' | 'fuzzy' | 'confirmed' | 'ambiguous' | 'none'
export interface HandoverEntry {
  date: string; time: string; resident: string; content: string; writer: string
  vitals: string; category: string; urgency: Urgency; confidence: string
  resident_id?: string | null          // 매칭된 수급자 id
  resident_matched?: string | null     // 명단에서 확정된 정식 이름
  match?: MatchKind
  match_score?: number
  match_candidates?: string[]
  match_suggest?: { id: string; name: string; score: number }[]
}
export interface HandoverAlert { resident: string; issue: string; action: string; resident_matched?: string | null; match?: MatchKind }
export interface SuggestedChecklist {
  title: string; frequency: string; person_name: string; reason: string
  due_days?: number; due_date?: string; due_label?: string
}
export interface HandoverReportBody {
  entries: HandoverEntry[]; summary: string; key_points: string[]
  alerts: HandoverAlert[]; suggested_checklists: SuggestedChecklist[]
  unreadable_notes: string; model?: string | null; error?: string
  matching?: { total: number; matched: number; ambiguous: number; unmatched_names: string[]; roster_size: number }
  pipeline?: { gpt_calls: number; claude_calls: number; rows: number; low_confidence?: number; corrections?: number; claude_error?: string; regenerated?: boolean }
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
  regenerate: (id: string) =>
    apiClient.post(`${BASE}/history/${id}/regenerate`, {}, { timeout: 180000 }).then(unwrap<HandoverRecord>),
  confirmMatch: (id: string, entryIndex: number, resident: { id: string; name: string } | null) =>
    apiClient.patch(`${BASE}/history/${id}/match`, {
      entry_index: entryIndex,
      resident_id: resident?.id ?? null,
      resident_name: resident?.name ?? null,
    }).then(unwrap<HandoverRecord>),
  accessList: () => apiClient.get(`${BASE}/access`).then(unwrap<AccessRow[]>),
  setAccess: (userId: string, granted: boolean) =>
    apiClient.patch(`${BASE}/access/${userId}`, { granted }).then(r => r.data),
}
