/**
 * 평가 관리 API 클라이언트
 * 기존 apps/admin/src/api/client.ts의 apiClient(axios)를 재사용
 * 응답 형식: { success: true, data: ... } (ApiResponse 래퍼)
 */
import { apiClient } from '@/api/client'

// ── 응답 언래핑 헬퍼 ──────────────────────────────────────────
function unwrap<T>(res: any): T {
  if (res?.data?.data !== undefined) return res.data.data as T
  if (res?.data !== undefined) return res.data as T
  return res as T
}

// ── 체크리스트 ────────────────────────────────────────────────
export const evalChecklistAPI = {
  list: async (params?: { frequency?: string; person_id?: string; active_only?: boolean }) => {
    const p: Record<string, string> = {}
    if (params?.frequency)              p.frequency   = params.frequency
    if (params?.person_id)              p.person_id   = params.person_id
    if (params?.active_only === false)  p.active_only = 'false'
    const res = await apiClient.get('/api/v1/eval/checklists', { params: p })
    return unwrap<any[]>(res)
  },
  get: async (id: string) => {
    const res = await apiClient.get(`/api/v1/eval/checklists/${id}`)
    return unwrap<any>(res)
  },
  create: async (d: any) => {
    const res = await apiClient.post('/api/v1/eval/checklists', d)
    return unwrap<any>(res)
  },
  createBulk: async (items: any[]) => {
    const res = await apiClient.post('/api/v1/eval/checklists/bulk', items)
    return unwrap<any[]>(res)
  },
  update: async (id: string, d: any) => {
    const res = await apiClient.patch(`/api/v1/eval/checklists/${id}`, d)
    return unwrap<any>(res)
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/eval/checklists/${id}`)
    return unwrap<any>(res)
  },
  toggle: async (id: string, d: {
    memo?: string
    attachment_name?: string
    completed?: boolean
  } = {}) => {
    const res = await apiClient.post(`/api/v1/eval/checklists/${id}/toggle`, d)
    return unwrap<any>(res)
  },
  setProgress: async (id: string, in_progress: boolean) => {
    const res = await apiClient.post(`/api/v1/eval/checklists/${id}/progress`, { in_progress })
    return unwrap<any>(res)
  },
}

// ── 평가용 수급자 ─────────────────────────────────────────────
export const evalResidentsAPI = {
  list: async () => {
    const res = await apiClient.get('/api/v1/eval/residents')
    return unwrap<any[]>(res)
  },
  get: async (id: string) => {
    const res = await apiClient.get(`/api/v1/eval/residents/${id}`)
    return unwrap<any>(res)
  },
  create: async (d: any) => {
    const res = await apiClient.post('/api/v1/eval/residents', d)
    return unwrap<any>(res)
  },
  update: async (id: string, d: any) => {
    const res = await apiClient.patch(`/api/v1/eval/residents/${id}`, d)
    return unwrap<any>(res)
  },
  discharge: async (id: string, discharge_date: string) => {
    const res = await apiClient.post(`/api/v1/eval/residents/${id}/discharge`, { discharge_date })
    return unwrap<any>(res)
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/eval/residents/${id}`)
    return unwrap<any>(res)
  },
}

// ── 평가용 직원 ───────────────────────────────────────────────
export const evalStaffAPI = {
  list: async () => {
    const res = await apiClient.get('/api/v1/eval/staff')
    return unwrap<any[]>(res)
  },
  get: async (id: string) => {
    const res = await apiClient.get(`/api/v1/eval/staff/${id}`)
    return unwrap<any>(res)
  },
  create: async (d: any) => {
    const res = await apiClient.post('/api/v1/eval/staff', d)
    return unwrap<any>(res)
  },
  update: async (id: string, d: any) => {
    const res = await apiClient.patch(`/api/v1/eval/staff/${id}`, d)
    return unwrap<any>(res)
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/eval/staff/${id}`)
    return unwrap<any>(res)
  },
  unresign: async (id: string) => {
    const res = await apiClient.post(`/api/v1/eval/staff/${id}/unresign`)
    return unwrap<any>(res)
  },
  resign: async (id: string, resign_date: string) => {
    const res = await apiClient.post(`/api/v1/eval/staff/${id}/resign`, { resign_date })
    return unwrap<any>(res)
  },
}

// ── 평가 지표 ─────────────────────────────────────────────────
export const evalIndicatorsAPI = {
  domains: async () => {
    const res = await apiClient.get('/api/v1/eval/domains')
    return unwrap<any[]>(res)
  },
  categories: async () => {
    const res = await apiClient.get('/api/v1/eval/categories')
    return unwrap<any[]>(res)
  },
  indicators: async () => {
    const res = await apiClient.get('/api/v1/eval/indicators')
    return unwrap<any[]>(res)
  },
}

// ── 평가 설정 ─────────────────────────────────────────────────
export const evalSettingsAPI = {
  get: async () => {
    const res = await apiClient.get('/api/v1/eval/settings')
    return unwrap<any>(res)
  },
  update: async (d: any) => {
    const res = await apiClient.patch('/api/v1/eval/settings', d)
    return unwrap<any>(res)
  },
}

// ── 평가 대시보드 ─────────────────────────────────────────────
export const evalDashboardAPI = {
  stats: async () => {
    const res = await apiClient.get('/api/v1/eval/dashboard/stats')
    return unwrap<any>(res)
  },
}

// ── 평가 가이드라인 문서 (.md) ─────────────────────────────────
export const evalGuidelineAPI = {
  list: async () => {
    const res = await apiClient.get('/api/v1/eval/guidelines')
    return unwrap<any[]>(res)
  },
  get: async (id: string) => {
    const res = await apiClient.get(`/api/v1/eval/guidelines/${id}`)
    return unwrap<any>(res)
  },
  // .md 파일 업로드 (multipart)
  upload: async (file: File, title?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (title) form.append('title', title)
    const res = await apiClient.post('/api/v1/eval/guidelines/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return unwrap<any>(res)
  },
  // 텍스트 직접 등록 (붙여넣기)
  create: async (d: { title: string; filename?: string; content: string }) => {
    const res = await apiClient.post('/api/v1/eval/guidelines', d)
    return unwrap<any>(res)
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/eval/guidelines/${id}`)
    return unwrap<any>(res)
  },
}

// ── AI 체크리스트 검토 ─────────────────────────────────────────
export const evalAIReviewAPI = {
  run: async (d: { guideline_id: string; domain_id?: string; person_id?: string }) => {
    const res = await apiClient.post('/api/v1/eval/ai-review', d)
    return unwrap<any>(res)
  },
  history: async () => {
    const res = await apiClient.get('/api/v1/eval/ai-reviews')
    return unwrap<any[]>(res)
  },
  get: async (id: number) => {
    const res = await apiClient.get(`/api/v1/eval/ai-reviews/${id}`)
    return unwrap<any>(res)
  },
  delete: async (id: number) => {
    const res = await apiClient.delete(`/api/v1/eval/ai-reviews/${id}`)
    return unwrap<any>(res)
  },
}

// ── Occurrence API ─────────────────────────────────────────────
export const occurrenceAPI = {
  /** 앱 로드 시 1회: 현재 주기 생성 + 만료 처리 */
  sync: async () => {
    const res = await apiClient.post('/api/v1/eval/occurrences/sync', {})
    return unwrap<{ created: number; overdue: number }>(res)
  },

  /** 전체 조회 (필터 지원) */
  list: async (params?: {
    checklist_item_id?: string
    period_key?: string
    status?: 'pending' | 'completed' | 'overdue'
    due_from?: string
    due_to?: string
    person_id?: string
    domain_id?: string
  }) => {
    const res = await apiClient.get('/api/v1/eval/occurrences', { params })
    return unwrap<any[]>(res)
  },

  /** 오늘 해야 할 것 (과거 미완료 포함) */
  today: async () => {
    const res = await apiClient.get('/api/v1/eval/occurrences/today')
    return unwrap<any[]>(res)
  },

  /** 월별 캘린더 */
  calendar: async (year: number, month: number) => {
    const res = await apiClient.get('/api/v1/eval/occurrences/calendar', {
      params: { year, month },
    })
    return unwrap<Record<string, any[]>>(res)
  },

  get: async (id: string) => {
    const res = await apiClient.get(`/api/v1/eval/occurrences/${id}`)
    return unwrap<any>(res)
  },

  complete: async (id: string, d: { completed_date: string; memo?: string; attachment_name?: string }) => {
    const res = await apiClient.post(`/api/v1/eval/occurrences/${id}/complete`, d)
    return unwrap<any>(res)
  },

  uncomplete: async (id: string) => {
    const res = await apiClient.post(`/api/v1/eval/occurrences/${id}/uncomplete`, {})
    return unwrap<any>(res)
  },

  /** 특정 아이템의 현재 주기 occurrence 즉시 생성 */
  ensure: async (itemId: string) => {
    const res = await apiClient.post(`/api/v1/eval/occurrences/ensure/${itemId}`, {})
    return unwrap<any>(res)
  },
}
