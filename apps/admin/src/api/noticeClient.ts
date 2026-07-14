import { apiClient } from './client'

const BASE = '/api/v1/admin/notices'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type NoticeLevel = 'info' | 'important' | 'urgent'

export interface InternalNotice {
  id: string
  title: string
  content?: string | null
  level: NoticeLevel
  pinned: boolean
  active: boolean
  author_name?: string | null
  created_at?: string | null
}
export interface NoticeInput {
  title?: string
  content?: string | null
  level?: NoticeLevel
  pinned?: boolean
  active?: boolean
}

export const NOTICE_LEVEL: Record<NoticeLevel, { label: string; cls: string; dot: string }> = {
  info:      { label: '안내', cls: 'bg-gray-50 text-gray-600 border-gray-200',       dot: 'bg-gray-400' },
  important: { label: '중요', cls: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-500' },
  urgent:    { label: '긴급', cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
}

export const noticeAPI = {
  list: (limit = 20) => apiClient.get(BASE, { params: { limit } }).then(unwrap<InternalNotice[]>),
  create: (b: NoticeInput) => apiClient.post(BASE, b).then(unwrap<InternalNotice>),
  update: (id: string, b: NoticeInput) => apiClient.patch(`${BASE}/${id}`, b).then(unwrap<InternalNotice>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
}
