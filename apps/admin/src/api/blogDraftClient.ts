import { apiClient } from './client'

const BASE = '/api/v1/admin/blog-drafts'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 본문 한 덩어리. 순서대로 이어 붙이면 그대로 네이버에 올라갈 글이 된다. */
export interface Block {
  type: 'intro' | 'heading' | 'paragraph' | 'photo' | 'caption' | 'outro'
  text?: string
  /** 사진 블록에서만 찬다 */
  photo_id?: string
}

/**
 * draft 검토 대기 · approved 검토 완료 · held 보류(사유 있음)
 * queued 발행 대기 · publishing 발행 중(Mac 의 발행기가 가져감) · published 발행됨
 * publish_failed 발행 실패(사유 있음 · 네이버 확인 뒤 다시 발행)
 */
export type DraftStatus =
  | 'draft' | 'approved' | 'held'
  | 'queued' | 'publishing' | 'published' | 'publish_failed'

export interface BlogDraft {
  id: string
  run_key?: string | null
  status: DraftStatus
  title?: string | null
  title_alts: string[]
  blocks: Block[]
  hashtags: string[]
  topic?: string | null
  activity_dates: string[]
  source_note: string
  /** pass · review · incomplete — 기존 글과 겹치는지 */
  dup_status: string
  dup_report: any
  model?: string | null
  cost_usd?: number | null
  input_tokens?: number | null
  output_tokens?: number | null
  hold_reason?: string | null
  created_by?: string | null
  approved_by?: string | null
  approved_at?: string | null
  created_at?: string | null
  /** 붙여넣을 본문 — 서버가 만들어 준다 */
  body: string
  /** 글 끝에 붙는 시설 안내 */
  facility: string

  // 발행
  publish_requested_by?: string | null
  publish_requested_at?: string | null
  publish_worker?: string | null
  publish_lease_until?: string | null
  publish_attempts: number
  publish_error?: string | null
  publish_session?: string | null
  published_url?: string | null
  published_log_no?: string | null
  published_at?: string | null
  /** 발행기가 올라간 글을 실제로 열어 확인했는가 */
  published_verified: boolean
}

export interface BlogPhoto {
  id: string
  /** program 프로그램 관리 · album 보호자 앨범 */
  source: string
  source_id: string
  taken_on?: string | null
  program_title?: string | null
  publicity: 'unknown' | 'allowed' | 'denied'
  publicity_by?: string | null
  mask_status: 'none' | 'masked' | 'no_face' | 'failed'
  mask_url?: string | null
  mask_detector?: string | null
  mask_reason?: string | null
  faces: number
  reviewed_by?: string | null
  reviewed_at?: string | null
  sensitive: boolean
  usable: boolean
}

export interface PublisherInfo {
  worker: string
  /** 마지막 신호 시각(ISO) */
  at: string
  aside_version?: string
  naver_blog_id?: string
  host?: string
}

export const blogDraftAPI = {
  list: (status?: string) =>
    apiClient.get(BASE, { params: status ? { status } : {} }).then(unwrap<BlogDraft[]>),
  pendingCount: () =>
    apiClient.get(`${BASE}/pending-count`)
      .then(unwrap<{ drafts: number; photos_unconfirmed: number; publish_failed: number }>),
  /** 지금 한 편 만든다 — 예약이 도는 길과 같다.
   *  자료가 모자라면 created:false 와 사유가 온다(오류가 아니다). */
  generate: () =>
    apiClient.post(`${BASE}/generate`)
      .then(unwrap<{ created: boolean; reason?: string; draft?: BlogDraft }>),
  setStatus: (id: string, status: 'approved' | 'held' | 'draft', hold_reason?: string) =>
    apiClient.post(`${BASE}/${id}/status`, { status, hold_reason }).then(unwrap<BlogDraft>),
  edit: (id: string, b: { title?: string; blocks?: Block[]; hashtags?: string[] }) =>
    apiClient.patch(`${BASE}/${id}`, b).then(unwrap<BlogDraft>),

  /** 검토가 끝난 글을 발행 줄에 세운다. Mac 의 발행기가 가져가 Aside 로 네이버에 올린다. */
  publish: (id: string) =>
    apiClient.post(`${BASE}/${id}/publish`).then(unwrap<BlogDraft>),
  /** 발행 대기 중인 글을 줄에서 뺀다(발행기가 이미 가져간 것은 못 뺀다) */
  cancelPublish: (id: string) =>
    apiClient.post(`${BASE}/${id}/publish/cancel`).then(unwrap<BlogDraft>),
  /** 발행기가 살아 있는가 */
  publishers: () =>
    apiClient.get(`${BASE}/publishers`)
      .then(unwrap<{ configured: boolean; publishers: PublisherInfo[] }>),

  photos: (state?: 'unconfirmed') =>
    apiClient.get(`${BASE}/photos`, { params: state ? { state } : {} }).then(unwrap<BlogPhoto[]>),
  setPhoto: (id: string, b: { publicity?: string; reviewed?: boolean
                              sensitive?: boolean; note?: string }) =>
    apiClient.patch(`${BASE}/photos/${id}`, b).then(unwrap<BlogPhoto>),

  histories: () => apiClient.get(`${BASE}/histories`).then(unwrap<any[]>),
  addHistory: (b: { log_no: string; url: string; title?: string; body?: string
                    published_on?: string; topic?: string }) =>
    apiClient.post(`${BASE}/histories`, b).then(unwrap<{ id: string }>),
}
