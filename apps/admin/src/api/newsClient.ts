import { apiClient } from './client'

const BASE = '/api/v1/admin/news'
const ORIGIN = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')
const formHeaders = { headers: { 'Content-Type': undefined as any } }

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export const NEWS_CATEGORIES = ['일반', '행사', '면회', '건강', '식단', '봉사', '긴급', '기타'] as const
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]

export interface FacilityNews {
  id: string
  category: string
  title: string
  summary?: string | null
  content?: string | null
  image_url?: string | null
  is_pinned: boolean
  is_published: boolean
  author_name?: string | null
  published_at?: string | null
  created_at?: string | null
}

export const newsAPI = {
  list: () => apiClient.get(BASE).then(unwrap<FacilityNews[]>),
  create: (fd: FormData) => apiClient.post(BASE, fd, formHeaders).then(unwrap<FacilityNews>),
  update: (id: string, fd: FormData) => apiClient.patch(`${BASE}/${id}`, fd, formHeaders).then(unwrap<FacilityNews>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
  notify: (id: string) => apiClient.post(`${BASE}/${id}/notify`).then(r => r.data),
  imageUrl: (u?: string | null) => (!u ? null : u.startsWith('http') ? u : `${ORIGIN}${u}`),
}
