import { apiClient } from './client'

const BASE = '/api/v1/admin/notices'
const ORIGIN = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')
const formHeaders = { headers: { 'Content-Type': undefined as any } }

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
  public: boolean            // true=로그인 없이 링크로 열람 가능(공개 공지)
  image_url?: string | null
  content_images?: string[] | null
  author_name?: string | null
  created_at?: string | null
}
export interface NoticeInput {
  title?: string
  content?: string | null
  level?: NoticeLevel
  pinned?: boolean
  active?: boolean
  public?: boolean          // 공개(로그인 불필요) 여부
  image_url?: string | null // 공유 카드·상세 이미지 경로
  content_images?: string[] | null // 본문 갤러리 이미지 경로 배열
  push?: boolean            // 등록 시 직원앱 푸시 발송 (기본 true)
}
/** 푸시 발송 결과 */
export interface PushResult {
  tokens: number
  recipients: number
  sent: number
  failed: number
  error?: string
}
export type CreatedNotice = InternalNotice & { push?: PushResult | null }

export const NOTICE_LEVEL: Record<NoticeLevel, { label: string; cls: string; dot: string }> = {
  info:      { label: '안내', cls: 'bg-gray-50 text-gray-600 border-gray-200',       dot: 'bg-gray-400' },
  important: { label: '중요', cls: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-500' },
  urgent:    { label: '긴급', cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
}

export const noticeAPI = {
  list: (limit = 20) => apiClient.get(BASE, { params: { limit } }).then(unwrap<InternalNotice[]>),
  create: (b: NoticeInput) => apiClient.post(BASE, b).then(unwrap<CreatedNotice>),
  update: (id: string, b: NoticeInput) => apiClient.patch(`${BASE}/${id}`, b).then(unwrap<InternalNotice>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
  push: (id: string) => apiClient.post(`${BASE}/${id}/push`).then(unwrap<PushResult>),
  uploadImage: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return apiClient.post(`${BASE}/upload-image`, fd, formHeaders).then(unwrap<{ url: string }>)
  },
}

/** 저장 경로(/uploads/..)를 절대 URL로 — 없으면 null */
export const noticeImageUrl = (u?: string | null) => (!u ? null : u.startsWith('http') ? u : `${ORIGIN}${u}`)
