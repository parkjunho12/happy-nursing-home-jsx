import { apiClient } from './client'
import type { NoticeLevel } from './noticeClient'

const BASE = '/api/v1/admin/notice-templates'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface NoticeTemplate {
  id: string
  name: string
  level: NoticeLevel
  title?: string | null
  content?: string | null
  sort_order: number
}
export interface TemplateInput {
  name?: string
  level?: NoticeLevel
  title?: string | null
  content?: string | null
  sort_order?: number
}

export const templateAPI = {
  list: () => apiClient.get(BASE).then(unwrap<NoticeTemplate[]>),
  create: (b: TemplateInput) => apiClient.post(BASE, b).then(unwrap<NoticeTemplate>),
  update: (id: string, b: TemplateInput) => apiClient.patch(`${BASE}/${id}`, b).then(unwrap<NoticeTemplate>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
}
