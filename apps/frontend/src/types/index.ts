// 공통 타입 정의
export interface Service {
    id: string
    icon: string
    title: string
    description: string
  }
  
  export interface Differentiator {
    id: string
    icon: string
    title: string
    description: string
    color?: 'orange' | 'green' | 'brown'
  }
  
  export interface Review {
    id: string
    author: string
    date: string
    rating: number
    content: string
    verified?: boolean
  }
  
  export interface GalleryItem {
    id: string
    src: string
    alt: string
    title?: string
    category?: 'exterior' | 'room' | 'dining' | 'program' | 'garden'
  }
  
  export interface ContactFormData {
    name: string
    phone: string
    email?: string
    inquiryType: InquiryType
    message: string
    privacyAgreed: boolean
    attachments?: File[]
  }
  
  export type InquiryType = 
    | '입소상담' 
    | '비용문의' 
    | '시설견학' 
    | '프로그램문의' 
    | '기타'
  
  export interface QuickContactItem {
    id: string
    icon: string
    title: string
    description: string
    action: string
    href: string
    type: 'tel' | 'link' | 'kakao'
  }
  
  export interface TrustIndicator {
    id: string
    value: string
    label: string
    unit?: string
  }
  
  export interface NavigationItem {
    id: string
    label: string
    href: string
    children?: NavigationItem[]
  }
  
  export interface APIResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    errors?: Record<string, string>
  }
  
  export interface ContactSubmissionResponse {
    ticketId: string
    estimatedResponseTime: string
  }
  
  // 폼 검증 에러 타입
  export interface FormErrors {
    [key: string]: string | undefined
  }
  
  // 메타데이터 타입
  export interface PageMetadata {
    title: string
    description: string
    keywords?: string
    ogImage?: string
  }