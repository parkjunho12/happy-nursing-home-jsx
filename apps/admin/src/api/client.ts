import axios, { AxiosError, AxiosInstance } from 'axios'
import type {
  User,
  LoginRequest,
  AuthResponse,
  Resident,
  Staff,
  Contact,
  History,
  Review,
  DashboardStats,
  ApiResponse,
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_PREFIX = '/api/v1'

// --------------------
// Token helpers
// --------------------
const TOKEN_KEY = 'access_token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// --------------------
// Axios client
// --------------------
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: attach bearer token
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401
apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      tokenStorage.clear()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// --------------------
// Auth API
// --------------------
export const authAPI = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>(`${API_PREFIX}/auth/login`, data)
    if (res.data?.access_token) tokenStorage.set(res.data.access_token)
    return res.data
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post(`${API_PREFIX}/auth/logout`)
    } finally {
      tokenStorage.clear()
    }
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>(`${API_PREFIX}/auth/me`)
    if ((res.data as any)?.data) return (res.data as any).data as User
    return res.data as unknown as User
  },
}

// --------------------
// Generic helpers
// --------------------
const unwrap = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === 'object' && 'data' in (payload as any)) {
    return (payload as any).data as T
  }
  return payload as T
}

// --------------------
// Residents API
// --------------------
export const residentsAPI = {
  list: async () => {
    const res = await apiClient.get<ApiResponse<Resident[]>>(`${API_PREFIX}/residents`)
    return unwrap(res.data)
  },
  get: async (id: string) => {
    const res = await apiClient.get<ApiResponse<Resident>>(`${API_PREFIX}/residents/${id}`)
    const data = unwrap(res.data)

    if (data.photos) {
      data.photos = data.photos.map((photo: any) => ({
        ...photo,
        image_url: getImageUrl(photo.file_url)
      }))
    }
    
    return data
  },
  create: async (data: Partial<Resident>) => {
    const res = await apiClient.post<ApiResponse<Resident>>(`${API_PREFIX}/residents`, data)
    return unwrap(res.data)
  },
  update: async (id: string, data: Partial<Resident>) => {
    const res = await apiClient.put<ApiResponse<Resident>>(`${API_PREFIX}/residents/${id}`, data)
    return unwrap(res.data)
  },
  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`${API_PREFIX}/residents/${id}`)
    return unwrap(res.data)
  },
}

// --------------------
// Guardians API
// --------------------
export interface Guardian {
  id: string
  resident_id: string
  name: string
  relationship: string
  phone: string
  receive_kakao: boolean
  is_primary: boolean
  created_at: string
  updated_at?: string
}

export interface GuardianCreate {
  name: string
  relationship: string
  phone: string
  receive_kakao?: boolean
  is_primary?: boolean
}

export interface GuardianUpdate {
  name?: string
  relationship?: string
  phone?: string
  receive_kakao?: boolean
  is_primary?: boolean
}

export const guardiansAPI = {
  // 입소자별 보호자 목록
  list: async (residentId: string) => {
    const res = await apiClient.get<ApiResponse<Guardian[]>>(
      `${API_PREFIX}/residents/${residentId}/guardians`
    )
    return unwrap(res.data)
  },

  // 보호자 상세 조회
  get: async (guardianId: string) => {
    const res = await apiClient.get<ApiResponse<Guardian>>(
      `${API_PREFIX}/guardians/${guardianId}`
    )
    return unwrap(res.data)
  },

  // 보호자 생성
  create: async (residentId: string, data: GuardianCreate) => {
    const res = await apiClient.post<ApiResponse<Guardian>>(
      `${API_PREFIX}/residents/${residentId}/guardians`,
      data
    )
    return unwrap(res.data)
  },

  // 보호자 수정
  update: async (guardianId: string, data: GuardianUpdate) => {
    const res = await apiClient.put<ApiResponse<Guardian>>(
      `${API_PREFIX}/guardians/${guardianId}`,
      data
    )
    return unwrap(res.data)
  },

  // 보호자 삭제
  delete: async (guardianId: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(
      `${API_PREFIX}/guardians/${guardianId}`
    )
    return unwrap(res.data)
  },

  // 카카오톡 수신 토글
  toggleKakao: async (guardianId: string) => {
    const res = await apiClient.post<ApiResponse<Guardian>>(
      `${API_PREFIX}/guardians/${guardianId}/toggle-kakao`
    )
    return unwrap(res.data)
  },

  // 주 보호자 설정
  setPrimary: async (guardianId: string) => {
    const res = await apiClient.post<ApiResponse<Guardian>>(
      `${API_PREFIX}/guardians/${guardianId}/set-primary`
    )
    return unwrap(res.data)
  },
}

// --------------------
// Photos API
// --------------------
export interface Photo {
  id: string
  resident_id: string
  file_name: string
  file_url: string
  image_url: string
  uploaded_at: string
}

export const photosAPI = {
  // 사진 업로드 (multipart/form-data)
  upload: async (residentId: string, files: File[]) => {
    const formData = new FormData()
    formData.append('resident_id', residentId)
    
    files.forEach(file => {
      formData.append('files', file)
    })

    const res = await apiClient.post<ApiResponse<Photo[]>>(
      `${API_PREFIX}/photos/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    const data = unwrap(res.data)

    return data.map(photo => ({
      ...photo,
      image_url: getImageUrl(photo.file_url)
    }))
  },

  // 사진 삭제
  delete: async (photoId: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(
      `${API_PREFIX}/photos/${photoId}`
    )
    return unwrap(res.data)
  },
}

// --------------------
// Messages API
// --------------------
export interface MessageSendRequest {
  resident_id: string
  guardian_ids: string[]
  message_content: string
  photo_urls?: string[]
}

export interface MessageLog {
  id: string
  resident_id: string
  guardian_id: string
  message_content: string
  photo_urls: string[]
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  error_message?: string
  sent_at: string
  resident_name?: string
  guardian_name?: string
  guardian_phone?: string
}

export interface MessageSendResult {
  guardian_id: string
  success: boolean
  log_id?: string
  error?: string
}

export const messagesAPI = {
  // 메시지 발송
  send: async (data: MessageSendRequest) => {
    const res = await apiClient.post<ApiResponse<{ results: MessageSendResult[] }>>(
      `${API_PREFIX}/messages/send`,
      data
    )
    return unwrap(res.data)
  },

  // 발송 로그 조회
  logs: async (residentId?: string, limit = 50) => {
    const params: any = { limit }
    if (residentId) params.resident_id = residentId

    const res = await apiClient.get<ApiResponse<MessageLog[]>>(
      `${API_PREFIX}/messages/logs`,
      { params }
    )
    return unwrap(res.data)
  },
}

// --------------------
// Staff API
// --------------------
export const staffAPI = {
  list: async () => {
    const res = await apiClient.get<ApiResponse<Staff[]>>(`${API_PREFIX}/staff`)
    return unwrap(res.data)
  },
  get: async (id: string) => {
    const res = await apiClient.get<ApiResponse<Staff>>(`${API_PREFIX}/staff/${id}`)
    return unwrap(res.data)
  },
  create: async (data: Partial<Staff>) => {
    const res = await apiClient.post<ApiResponse<Staff>>(`${API_PREFIX}/staff`, data)
    return unwrap(res.data)
  },
  update: async (id: string, data: Partial<Staff>) => {
    const res = await apiClient.put<ApiResponse<Staff>>(`${API_PREFIX}/staff/${id}`, data)
    return unwrap(res.data)
  },
  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`${API_PREFIX}/staff/${id}`)
    return unwrap(res.data)
  },
}

// --------------------
// Contacts API
// --------------------
export const contactsAPI = {
  list: async () => {
    const res = await apiClient.get<ApiResponse<Contact[]>>(`${API_PREFIX}/contacts`)
    return unwrap(res.data)
  },
  get: async (id: string) => {
    const res = await apiClient.get<ApiResponse<Contact>>(`${API_PREFIX}/contacts/${id}`)
    return unwrap(res.data)
  },
  reply: async (id: string, reply: string) => {
    const res = await apiClient.put<ApiResponse<Contact>>(`${API_PREFIX}/contacts/${id}/reply`, { reply })
    return unwrap(res.data)
  },
  updateStatus: async (id: string, status: Contact['status']) => {
    const res = await apiClient.put<ApiResponse<Contact>>(`${API_PREFIX}/contacts/${id}/status`, { status })
    return unwrap(res.data)
  },
  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`${API_PREFIX}/contacts/${id}`)
    return unwrap(res.data)
  },
}

// --------------------
// History API
// --------------------
export const historyAPI = {
  list: async () => {
    const res = await apiClient.get<ApiResponse<History[]>>(`${API_PREFIX}/history`)
    return unwrap(res.data)
  },
  get: async (id: string) => {
    const res = await apiClient.get<ApiResponse<History>>(`${API_PREFIX}/history/${id}`)
    return unwrap(res.data)
  },
  create: async (data: Partial<History>) => {
    const res = await apiClient.post<ApiResponse<History>>(`${API_PREFIX}/history`, data)
    return unwrap(res.data)
  },
  update: async (id: string, data: Partial<History>) => {
    const res = await apiClient.put<ApiResponse<History>>(`${API_PREFIX}/history/${id}`, data)
    return unwrap(res.data)
  },
  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`${API_PREFIX}/history/${id}`)
    return unwrap(res.data)
  },
  publish: async (id: string) => {
    const res = await apiClient.post<ApiResponse<History>>(`${API_PREFIX}/history/${id}/publish`)
    return unwrap(res.data)
  },
  unpublish: async (id: string) => {
    const res = await apiClient.post<ApiResponse<History>>(`${API_PREFIX}/history/${id}/unpublish`)
    return unwrap(res.data)
  },
}

// --------------------
// Reviews API
// --------------------
export const reviewsAPI = {
  list: async () => {
    const res = await apiClient.get<ApiResponse<Review[]>>(`${API_PREFIX}/reviews`)
    return unwrap(res.data)
  },
  approve: async (id: string) => {
    const res = await apiClient.post<ApiResponse<Review>>(`${API_PREFIX}/reviews/${id}/approve`)
    return unwrap(res.data)
  },
  reject: async (id: string) => {
    const res = await apiClient.post<ApiResponse<Review>>(`${API_PREFIX}/reviews/${id}/reject`)
    return unwrap(res.data)
  },
  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`${API_PREFIX}/reviews/${id}`)
    return unwrap(res.data)
  },
}

// --------------------
// Dashboard API
// --------------------
export const dashboardAPI = {
  stats: async () => {
    const res = await apiClient.get<ApiResponse<DashboardStats>>(`${API_PREFIX}/dashboard/stats`)
    return unwrap(res.data)
  },
}

// --------------------
// Track API
// --------------------
export interface TrackStatsResponse {
  total_clicks: number
  suspicious_clicks: number
  unique_ips: number
  suspicious_rate: number
}

export interface TrackEvent {
  id: string
  ip_hash: string
  event_type: string
  is_suspicious: boolean
  created_at: string
}

export interface SuspiciousIP {
  ip_hash: string
  click_count: number
  last_click: string
}

export const trackAPI = {
  click: async (eventType: string) => {
    const res = await apiClient.post(`${API_PREFIX}/track/click`, null, {
      params: { event_type: eventType },
    })
    return res.data
  },

  stats: async (days = 7): Promise<TrackStatsResponse> => {
    const res = await apiClient.get<TrackStatsResponse>(`${API_PREFIX}/track/stats`, {
      params: { days },
    })
    return res.data
  },

  all: async (days = 7): Promise<TrackEvent[]> => {
    const res = await apiClient.get<TrackEvent[]>(`${API_PREFIX}/track/all`, {
      params: { days },
    })
    return res.data
  },

  suspicious: async (days = 7): Promise<SuspiciousIP[]> => {
    const res = await apiClient.get<SuspiciousIP[]>(`${API_PREFIX}/track/suspicious`, {
      params: { days },
    })
    return res.data
  },
}

const getImageUrl = (url?: string) => {
  if (!url) return ''

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`
  }

  return `${API_BASE_URL}/${url}`
}