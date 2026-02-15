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
  // ✅ 쿠키 인증이 "진짜"일 때만 true (현재 백엔드는 JWT 반환이라 불필요)
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
      // ✅ 토큰 제거 (무한 루프 방지)
    //   tokenStorage.clear()

    //   // ✅ 원하는 UX: 로그인 페이지로
    //   if (window.location.pathname !== '/login') {
    //     window.location.href = '/login'
    //   }
    }
    return Promise.reject(error)
  }
)

// --------------------
// Auth API
// --------------------
export const authAPI = {
  // ✅ FastAPI LoginRequest(email/password)와 계약 맞춤: JSON
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>(`${API_PREFIX}/auth/login`, data)

    // ✅ access_token 저장
    if (res.data?.access_token) tokenStorage.set(res.data.access_token)

    return res.data
  },

  logout: async (): Promise<void> => {
    // 서버는 stateless라 의미가 약하지만 호출은 유지
    try {
      await apiClient.post(`${API_PREFIX}/auth/logout`)
    } finally {
      tokenStorage.clear()
    }
  },

  // ⚠️ 백엔드 /me가 {success:true, data:{...}}면 아래처럼 파싱
  me: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>(`${API_PREFIX}/auth/me`)

    // 케이스1) ApiResponse<User> = { success, data }
    if ((res.data as any)?.data) return (res.data as any).data as User

    // 케이스2) 그냥 User를 바로 주는 경우
    return res.data as unknown as User
  },
}

// --------------------
// Generic helpers (선택)
// --------------------
const unwrap = <T>(payload: ApiResponse<T> | T): T => {
  // ApiResponse<T> 형태면 data를 꺼냄
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
    return unwrap(res.data)
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
