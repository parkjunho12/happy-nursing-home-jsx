import { apiClient } from './client'

const BASE = '/api/v1/admin/educations'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type Division = '평가' | '법정' | '기타'

export interface Education {
  id: string
  year: number
  month: number
  sort: number
  division: Division
  eval_no?: string | null
  topic?: string | null
  title: string
  org?: string | null
  requirement?: string | null
  done: boolean
  plan_date?: string | null
  done_date?: string | null
  instructor?: string | null
  attendee_count?: number | null
  attendees?: string | null
  material?: string | null
  memo?: string | null
  updated_by_name?: string | null
}

export type EducationInput = Partial<Omit<Education, 'id'>>

export interface EduSummary {
  year: number
  total: number
  done: number
  rate: number
  by_division: Record<Division, { total: number; done: number }>
  by_month: Record<string, { total: number; done: number }>
}

/** 구분 배지 색 */
export const DIVISION_STYLE: Record<Division, { label: string; cls: string }> = {
  평가: { label: '평가지표', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  법정: { label: '법정의무', cls: 'bg-red-50 text-red-700 border-red-200' },
  기타: { label: '기타', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
}

/** 교육기관 배지 색 — 자체교육(우리가 직접 해야 함)과 외부 이수를 시각적으로 분리 */
export const ORG_STYLE = (org?: string | null): string => {
  const o = org ?? ''
  if (o.startsWith('자체')) return 'bg-orange-50 text-orange-700 border-orange-200'
  if (o === 'GSEEK' || o === 'KOHI') return 'bg-sky-50 text-sky-700 border-sky-200'
  if (o === '외부교육') return 'bg-violet-50 text-violet-700 border-violet-200'
  return 'bg-gray-50 text-gray-500 border-gray-200'
}

export const educationAPI = {
  list: (year: number) => apiClient.get(BASE, { params: { year } }).then(unwrap<Education[]>),
  summary: (year: number) => apiClient.get(`${BASE}/summary`, { params: { year } }).then(unwrap<EduSummary>),
  seed: (year: number) => apiClient.post(`${BASE}/seed`, null, { params: { year } }).then(r => r.data),
  create: (b: EducationInput) => apiClient.post(BASE, b).then(unwrap<Education>),
  update: (id: string, b: EducationInput) => apiClient.patch(`${BASE}/${id}`, b).then(unwrap<Education>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
}
