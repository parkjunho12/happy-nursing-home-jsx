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
/** 프로그램 사진 한 장 — R2 에 저장된다 */
export interface ProgramPhoto {
  id: string
  month: string; day: number; title: string; grp?: string | null
  file_url: string; thumbnail_url?: string | null
  media_type: 'photo' | 'video'
  file_size?: number | null
  caption?: string | null
  taken_at?: string | null      // 찍은 시각 (EXIF → 파일 수정시각 순)
  uploaded_by?: string | null
  created_at?: string | null
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
  /* ── 프로그램 사진 (R2 저장) ── */
  photos: (month: string) =>
    apiClient.get(`${BASE}/photos`, { params: { month } }).then(unwrap<ProgramPhoto[]>),
  /** 날짜·프로그램을 비우면 사진에 박힌 찍은 시각으로 서버가 날짜를 정한다 */
  uploadPhotos: (b: { month: string; day?: number | null; title?: string | null
                      grp?: string | null; caption?: string | null; files: File[] }) => {
    const f = new FormData()
    f.append('month', b.month)
    if (b.day) f.append('day', String(b.day))
    if (b.title) f.append('title', b.title)
    if (b.grp) f.append('grp', b.grp)
    if (b.caption) f.append('caption', b.caption)
    // EXIF 가 없는 사진(캡처·다운로드본)을 위한 보조 — 파일 순서대로 보낸다
    f.append('taken_ms', b.files.map(x => x.lastModified || '').join(','))
    b.files.forEach(x => f.append('files', x))
    return apiClient.post(`${BASE}/photos`, f, { headers: { 'Content-Type': undefined as any } })
      .then(unwrap<{ uploaded: ProgramPhoto[]; failed: string[] }>)
  },
  updatePhoto: (id: string, b: { day?: number; title?: string; grp?: string; caption?: string }) =>
    apiClient.patch(`${BASE}/photos/${id}`, b).then(unwrap<ProgramPhoto>),
  deletePhoto: (id: string) => apiClient.delete(`${BASE}/photos/${id}`).then(r => r.data),
  /** 그날(또는 그 달) 사진을 zip 하나로.
   *  로그인 상태로 받아야 하므로 주소를 새 창으로 여는 대신 파일을 받아 저장한다. */
  downloadPhotos: async (month: string, day?: number) => {
    const r = await apiClient.get(`${BASE}/photos/download`, {
      params: { month, ...(day ? { day } : {}) }, responseType: 'blob',
    })
    const cd = String(r.headers['content-disposition'] ?? '')
    const m = /filename\*=UTF-8''([^;]+)/.exec(cd)
    const name = m ? decodeURIComponent(m[1]) : `${month}_프로그램사진.zip`
    const url = URL.createObjectURL(r.data as Blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
    return Number(r.headers['x-photo-count'] ?? 0)
  },

  /** 여러 장 한 번에 — 한 장씩 지우면 스무 장에 스무 번을 눌러야 한다 */
  deletePhotos: (ids: string[]) =>
    apiClient.post(`${BASE}/photos/delete`, { ids }).then(unwrap<{ deleted: number }>),

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
