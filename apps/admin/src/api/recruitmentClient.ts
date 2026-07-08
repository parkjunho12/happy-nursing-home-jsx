import { apiClient } from './client'

const BASE = '/api/v1/admin/recruitment'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type PostStatus = '모집중' | '마감'
export type AppStatus = '접수' | '검토중' | '면접예정' | '합격' | '불합격'

export interface RecruitmentPost {
  id: string
  title: string
  category?: string | null
  employment_type?: string | null
  work_time?: string | null
  salary?: string | null
  description?: string | null
  status: PostStatus
  is_public: boolean
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export interface RecruitmentApplication {
  id: string
  recruitment_post_id?: string | null
  category?: string | null
  name: string
  birth?: string | null
  phone: string
  email?: string | null
  experience?: string | null
  introduction?: string | null
  privacy_agreed: boolean
  status: AppStatus
  admin_memo?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type PostInput = Partial<Omit<RecruitmentPost, 'id' | 'created_at' | 'updated_at'>>

export const recruitmentAPI = {
  // 공고
  posts: () => apiClient.get(`${BASE}/posts`).then(unwrap<RecruitmentPost[]>),
  createPost: (body: PostInput) => apiClient.post(`${BASE}/posts`, body).then(unwrap<RecruitmentPost>),
  updatePost: (id: string, body: PostInput) => apiClient.patch(`${BASE}/posts/${id}`, body).then(unwrap<RecruitmentPost>),
  deletePost: (id: string) => apiClient.delete(`${BASE}/posts/${id}`).then(r => r.data),
  // 지원자
  applications: (params?: { status?: string; post_id?: string }) =>
    apiClient.get(`${BASE}/applications`, { params: params ?? {} })
      .then(unwrap<{ items: RecruitmentApplication[]; counts: Record<string, number> }>),
  getApplication: (id: string) => apiClient.get(`${BASE}/applications/${id}`).then(unwrap<RecruitmentApplication>),
  updateApplication: (id: string, body: { status?: string; admin_memo?: string }) =>
    apiClient.patch(`${BASE}/applications/${id}`, body).then(unwrap<RecruitmentApplication>),

  // 면접 일정
  interviews: (params?: { start_date?: string; end_date?: string; notify?: string }) =>
    apiClient.get(`${BASE}/interviews`, { params: params ?? {} }).then(unwrap<Interview[]>),
  createInterview: (body: InterviewInput) => apiClient.post(`${BASE}/interviews`, body).then(unwrap<Interview>),
  updateInterview: (id: string, body: Partial<InterviewInput> & { status?: string; result?: string; notified?: boolean; memo?: string }) =>
    apiClient.patch(`${BASE}/interviews/${id}`, body).then(unwrap<Interview>),
  deleteInterview: (id: string) => apiClient.delete(`${BASE}/interviews/${id}`).then(r => r.data),
}

export type IvStatus = 'scheduled' | 'done' | 'canceled' | 'no_show'
export type IvResult = 'pass' | 'fail' | 'hold'
export interface Interview {
  id: string
  application_id?: string | null
  name: string
  phone?: string | null
  category?: string | null
  interview_at?: string | null
  location?: string | null
  note?: string | null
  status: IvStatus
  result?: IvResult | null
  notified: boolean
  notified_at?: string | null
  notify_due?: string | null
  memo?: string | null
  message: string
  created_at?: string | null
}
export interface InterviewInput {
  application_id?: string | null
  name: string
  phone?: string | null
  category?: string | null
  interview_at: string
  location?: string | null
  note?: string | null
}
