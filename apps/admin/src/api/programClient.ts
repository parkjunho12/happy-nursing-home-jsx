import { apiClient } from './client'

const BASE = '/api/v1/admin/programs'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface ProgramEntry { slot: '오전' | '오후'; group: string | null; title: string; time?: string | null; kind?: string | null }
export interface ProgramMonthData {
  month: string
  days: Record<string, ProgramEntry[]>
  notes?: string[]
  public_memo?: string
  published: boolean
  updated_by?: string | null
  updated_at?: string | null
}
export interface ProgramTime { time: string; category?: string | null }
export interface ProgramGroup {
  category: string; grade: string; members: string[]
  members_by_floor?: Record<string, string[]>
}
export interface GroupSet {
  based_on: string
  groups: ProgramGroup[]
  religion: { name: string; members: string[] }[]
  updated_by?: string | null
}

const form = (file: File) => {
  const f = new FormData(); f.append('file', file); return f
}

export const programAPI = {
  peekSchedule: (file: File) =>
    apiClient.post(`${BASE}/peek-schedule`, form(file), { headers: { 'Content-Type': undefined as any } })
      .then(unwrap<{ months: string[] }>).then(r => r.months),
  uploadSchedule: (file: File, month?: string, preview?: boolean) => {
    const f = form(file)
    if (month) f.append('month', month)
    if (preview) f.append('preview', 'true')
    return apiClient.post(`${BASE}/upload-schedule`, f, { headers: { 'Content-Type': undefined as any } })
      .then(unwrap<{ month: string; sheet: string; day_count: number; published?: boolean; preview?: boolean; days?: Record<string, ProgramEntry[]>; notes?: string[] }>)
  },
  schedule: (month: string) =>
    apiClient.get(`${BASE}/schedule`, { params: { month } }).then(unwrap<ProgramMonthData | null>),
  publish: (month: string, published: boolean) =>
    apiClient.patch(`${BASE}/schedule/${month}`, { published }).then(unwrap<{ published: boolean }>),
  uploadGroups: (file: File) =>
    apiClient.post(`${BASE}/upload-groups`, form(file), { headers: { 'Content-Type': undefined as any } })
      .then(unwrap<{ based_on: string; group_count: number }>),
  groups: () => apiClient.get(`${BASE}/groups`).then(unwrap<GroupSet | null>),
  saveGroups: (groups: ProgramGroup[], religion: { name: string; members: string[] }[]) =>
    apiClient.put(`${BASE}/groups`, { groups, religion }).then(unwrap<{ group_count: number }>),
  editNotes: (month: string, notes: string[]) =>
    apiClient.patch(`${BASE}/schedule/${month}/notes`, { notes }).then(unwrap<{ notes: string[] }>),
  editPublicMemo: (month: string, memo: string) =>
    apiClient.patch(`${BASE}/schedule/${month}/public-memo`, { memo }).then(unwrap<{ public_memo: string }>),
  editDay: (month: string, day: number, entries: ProgramEntry[]) =>
    apiClient.put(`${BASE}/schedule/${month}/day/${day}`, { entries }).then(unwrap<{ entries: ProgramEntry[] }>),
  times: () => apiClient.get(`${BASE}/times`).then(unwrap<{ times: ProgramTime[] }>).then(r => r.times),
  saveTimes: (times: ProgramTime[]) =>
    apiClient.put(`${BASE}/times`, { times }).then(unwrap<{ times: ProgramTime[] }>).then(r => r.times),
  groupLogs: () =>
    apiClient.get(`${BASE}/group-logs`)
      .then(unwrap<{ id: string; resident_name: string; field: string; before: string | null; after: string | null; changed_by: string | null; at: string | null }[]>),
  logs: (month?: string) =>
    apiClient.get(`${BASE}/logs`, { params: month ? { month } : {} })
      .then(unwrap<{ id: string; month: string; day?: string | null; action: string; summary?: string | null; changed_by?: string | null; at?: string | null }[]>),
}
