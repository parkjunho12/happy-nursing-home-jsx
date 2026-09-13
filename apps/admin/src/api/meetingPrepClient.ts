import { apiClient } from './client'

const BASE = '/api/v1/admin/meeting-prep'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface MeetingPrep {
  id: string
  title: string
  content: string
  source_name?: string | null
  source_text?: string | null   // 상세 조회에서만 내려온다
  model?: string | null
  author_name?: string | null
  created_at?: string | null
}

export const meetingPrepAPI = {
  list: () => apiClient.get(BASE).then(unwrap<MeetingPrep[]>),
  get: (id: string) => apiClient.get(`${BASE}/${id}`).then(unwrap<MeetingPrep>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
  /** 카카오톡 대화 txt → 회의 준비 문서 생성. AI 정리라 타임아웃을 넉넉히 둔다. */
  create: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return apiClient.post(BASE, fd, { headers: { 'Content-Type': undefined as any }, timeout: 200_000 })
      .then(unwrap<MeetingPrep>)
  },
}
