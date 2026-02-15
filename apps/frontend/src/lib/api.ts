import { ContactFormData, APIResponse, ContactSubmissionResponse } from '@/types'

/**
 * API 클라이언트
 */
class APIClient {
  private baseURL: string

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || '요청 처리 중 오류가 발생했습니다',
          errors: data.errors,
        }
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      }
    } catch (error) {
      console.error('API Error:', error)
      return {
        success: false,
        message: '네트워크 오류가 발생했습니다. 다시 시도해주세요.',
      }
    }
  }

  /**
   * 상담 신청 제출
   */
  async submitContact(
    data: ContactFormData
  ): Promise<APIResponse<ContactSubmissionResponse>> {
    return this.request<ContactSubmissionResponse>('/contact', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }),
    })
  }

  /**
   * 파일 업로드
   */
  async uploadFile(file: File): Promise<APIResponse<{ url: string }>> {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${this.baseURL}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || '파일 업로드 중 오류가 발생했습니다',
        }
      }

      return {
        success: true,
        data: { url: data.url },
      }
    } catch (error) {
      console.error('Upload Error:', error)
      return {
        success: false,
        message: '파일 업로드에 실패했습니다',
      }
    }
  }

  /**
   * 후기 목록 조회
   */
  async getReviews(params?: {
    page?: number
    limit?: number
    sort?: 'recent' | 'rating'
  }) {
    const queryString = new URLSearchParams(params as any).toString()
    return this.request(`/reviews?${queryString}`)
  }

  /**
   * 시설 견학 예약
   */
  async bookVisit(data: {
    name: string
    phone: string
    preferredDate: string
    preferredTime: string
  }) {
    return this.request('/book-visit', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

// API 클라이언트 인스턴스
export const api = new APIClient()

/**
 * Google Analytics 이벤트 전송
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, any>
): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    ;(window as any).gtag('event', eventName, params)
  }
}

/**
 * 전화 클릭 이벤트 추적
 */
export function trackPhoneClick(source: string): void {
  trackEvent('contact', {
    event_category: 'Phone',
    event_label: source,
  })
}

/**
 * 폼 제출 이벤트 추적
 */
export function trackFormSubmit(formName: string, success: boolean): void {
  trackEvent('form_submit', {
    event_category: 'Contact',
    event_label: formName,
    value: success ? 1 : 0,
  })
}

/**
 * 소셜 미디어 클릭 이벤트 추적
 */
export function trackSocialClick(platform: string, action: string): void {
  trackEvent('social_click', {
    event_category: platform,
    event_label: action,
  })
}

/**
 * 페이지 뷰 추적
 */
export function trackPageView(path: string, title: string): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    ;(window as any).gtag('config', 'G-XXXXXXXXXX', {
      page_path: path,
      page_title: title,
    })
  }
}