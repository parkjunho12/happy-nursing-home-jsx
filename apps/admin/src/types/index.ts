// User & Auth
export interface User {
    id: string
    email: string
    name: string
    role: 'ADMIN' | 'STAFF'
    createdAt: string
  }
  
  export interface LoginRequest {
    email: string
    password: string
  }
  
  export interface AuthResponse {
    access_token: string
    token_type: string
    user: User
  }
  
 // Resident 타입 추가/수정
export interface Resident {
  id: string
  name: string
  birth_date: string  // ISO date string
  gender: 'MALE' | 'FEMALE'
  admission_date: string  // ISO date string
  room_number: string
  grade: string  // "1", "2", "3", "4", "5"
  emergency_contact: string
  emergency_phone: string
  status: 'ACTIVE' | 'DISCHARGED' | 'HOSPITALIZED'
  notes?: string
  created_at: string
  updated_at?: string
  
  // 관계 데이터 (백엔드에서 추가)
  guardians?: Guardian[]
  photos?: Photo[]
  _count?: {
    guardians: number
    photos: number
  }
}
  
  // Staff (직원)
  export interface Staff {
    id: string
    name: string
    role: string
    department: string
    phone: string
    email?: string
    hireDate: string
    status: 'ACTIVE' | 'INACTIVE'
    createdAt: string
  }
  
  // Contact (상담)
  export interface Contact {
    id: string
    ticket_id: string
    name: string
    phone: string
    email?: string
    inquiry_type: string
    message: string
    privacy_agreed: boolean
    status: 'PENDING' | 'REPLIED' | 'CLOSED'
    reply?: string
    replied_at?: string
    replied_by?: string
    created_at: string
    updated_at?: string

    // AI 분석 결과 (관리자만 조회 가능)
    ai_summary?: string
    ai_category?: '입소' | '요금' | '면회' | '의료간호' | '프로그램' | '기타'
    ai_urgency?: 'HIGH' | 'MEDIUM' | 'LOW'
    ai_next_actions?: string[]
    ai_model?: string
    ai_created_at?: string

    has_ai_analysis: boolean
  }
  
  // History (히스토리)
  export interface History {
    id: string
    title: string
    slug: string
    category: 'PROGRAM' | 'EVENT' | 'NEWS' | 'VOLUNTEER'
    content: string
    excerpt: string
    isPublished: boolean
    publishedAt?: string
    viewCount: number
    tags: string[]
    createdAt: string
    updatedAt: string
    image_url: string
  }
  
  // Review (후기)
  export interface Review {
    id: string
    author: string
    residentName?: string; 
    rating: number
    content: string
    isApproved: boolean
    approvedAt?: string
    approvedBy?: string
    createdAt: string
  }
  
  // Dashboard Stats
  export interface DashboardStats {
    totalResidents: number
    activeResidents: number
    totalStaff: number
    pendingContacts: number
    todayAdmissions: number
    monthlyAdmissions: number
  }
  
  // API Response
  export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    error?: string
  }
  
  // Pagination
  export interface PaginationParams {
    page?: number
    limit?: number
    sortBy?: string
    order?: 'asc' | 'desc'
  }
  
  export interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    limit: number
    totalPages: number
  }

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
  
  export interface Photo {
    id: string
    resident_id: string
    file_name: string
    file_url: string
    uploaded_at: string
  }

// Message 관련
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

