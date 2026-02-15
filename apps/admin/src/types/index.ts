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
  
  // Resident (입소자)
  export interface Resident {
    id: string
    name: string
    birthDate: string
    gender: 'MALE' | 'FEMALE'
    admissionDate: string
    roomNumber: string
    grade: '1' | '2' | '3' | '4' | '5'
    emergencyContact: string
    emergencyPhone: string
    status: 'ACTIVE' | 'DISCHARGED' | 'HOSPITALIZED'
    notes?: string
    createdAt: string
    updatedAt: string
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