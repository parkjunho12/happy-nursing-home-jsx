/**
 * src/lib/api-client.ts
 * Public Website API Client (Next.js)
 */

export const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') as string) ||
  'https://api.xn--p80bu1t60gba47bg6abm347gsla.com'

/** ===== Types ===== */
export interface ContactFormData {
  name: string
  phone: string
  email?: string
  inquiry_type: string
  message: string
  privacyAgreed: boolean
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  errors?: any
}

export interface ContactSubmissionResponse {
  id?: string
  ticket_id?: string
  estimatedResponseTime?: string
}

/** ===== Request helper ===== */
type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: any // object면 JSON으로 자동 직렬화
  unwrapData?: boolean // 응답이 {success,data}가 아닐 때 data만 뽑을지
  throwOnError?: boolean // true면 success:false 대신 throw
  timeoutMs?: number // fetch 타임아웃
}

function normalizeUrl(endpoint: string) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_BASE_URL}${path}`
}

function mergeHeaders(base?: HeadersInit, extra?: HeadersInit): Headers {
  const h = new Headers(base || {})
  if (extra) {
    new Headers(extra).forEach((v, k) => h.set(k, v))
  }
  return h
}

function parseFastApiError(json: any, status: number): string {
  // FastAPI: {detail: "..."} or {detail: [{msg, loc, ...}, ...]}
  const detail = json?.detail
  if (!detail) return json?.message || `Request failed (${status})`

  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    return first?.msg || json?.message || `Request failed (${status})`
  }
  return json?.message || `Request failed (${status})`
}

async function safeJson(res: Response): Promise<any> {
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()

  if (!text) return null

  // content-type이 json이 아니어도 JSON일 수 있으니 시도
  if (ct.includes('application/json') || ct.includes('+json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  return null
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const url = normalizeUrl(endpoint)

  // timeout 지원
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 15000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // 사용자가 signal을 넣었으면 함께 반영
  const signals: AbortSignal[] = []
  if (options.signal) signals.push(options.signal)
  signals.push(controller.signal)

  const signal = signals.length === 1
    ? signals[0]
    : AbortSignal.any(signals as any) // TS libdom 최신이면 가능. 아니면 아래 주석 버전 사용.
  // ⚠️ AbortSignal.any 미지원 환경이면:
  // const signal = controller.signal

  try {
    const headers = mergeHeaders(
      {
        Accept: 'application/json',
      },
      options.headers
    )

    let body: BodyInit | undefined = undefined
    let method = (options.method || 'GET').toUpperCase()

    // body가 object면 JSON 자동 직렬화
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        body = options.body
        // FormData면 Content-Type 브라우저가 설정하므로 제거
        headers.delete('Content-Type')
      } else if (typeof options.body === 'string') {
        body = options.body
        if (!headers.get('Content-Type')) headers.set('Content-Type', 'application/json')
      } else {
        body = JSON.stringify(options.body)
        if (!headers.get('Content-Type')) headers.set('Content-Type', 'application/json')
      }
    }

    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
      method,
      headers,
      body,
      signal,
    })

    const json = await safeJson(res)

    if (!res.ok) {
      const message = parseFastApiError(json, res.status)
      const payload: ApiResponse<T> = {
        success: false,
        message,
        errors: json?.errors ?? json?.detail,
        data: json?.data,
      }
      if (options.throwOnError) {
        const err = new Error(message) as any
        err.status = res.status
        err.response = json
        throw err
      }
      return payload
    }

    // 이미 {success,data,message}면 그대로
    if (json && typeof json.success === 'boolean') return json as ApiResponse<T>

    // 아니면 감싸기
    const data = options.unwrapData ? (json?.data ?? json) : (json?.data ?? json)
    return {
      success: true,
      data: data as T,
      message: json?.message,
    }
  } catch (err: any) {
    // abort timeout / 외부 abort
    if (err?.name === 'AbortError') {
      const payload: ApiResponse<T> = { success: false, message: '요청 시간이 초과되었습니다. 다시 시도해주세요.' }
      if (options.throwOnError) throw err
      return payload
    }

    console.error('API request error:', err)
    const payload: ApiResponse<T> = { success: false, message: err?.message || '네트워크 오류가 발생했습니다. 다시 시도해주세요.' }
    if (options.throwOnError) throw err
    return payload
  } finally {
    clearTimeout(timer)
  }
}

/** ===== Public API functions ===== */

// ✅ FastAPI(ContactFormRequest) 스키마에 맞춘 payload 변환
type ContactFormPayload = {
  name: string
  phone: string
  email?: string | null
  inquiry_type: string
  message: string
  privacy_agreed: boolean
  timestamp?: string
}

function toContactPayload(data: ContactFormData): ContactFormPayload {
  return {
    name: data.name,
    phone: data.phone,
    email: data.email ? data.email : null,
    inquiry_type: data.inquiry_type,
    message: data.message,
    privacy_agreed: data.privacyAgreed,
    timestamp: new Date().toISOString(),
  }
}

/** 상담 신청 제출 */
export async function submitContactForm(
  data: ContactFormData,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<ApiResponse<ContactSubmissionResponse>> {
  return request<ContactSubmissionResponse>('/api/v1/public/contact', {
    method: 'POST',
    body: toContactPayload(data),
    signal: options?.signal,
    timeoutMs: options?.timeoutMs,
  })
}

/** 공개된 히스토리 게시물 목록 */
export async function getPublishedHistory(): Promise<ApiResponse> {
  return request('/api/v1/public/history', { timeoutMs: 15000 })
}

/** 히스토리 게시물 상세 */
export async function getHistoryPost(slug: string): Promise<ApiResponse> {
  return request(`/api/v1/public/history/${encodeURIComponent(slug)}`, { timeoutMs: 15000 })
}

/** 승인된 후기 목록 */
export async function getApprovedReviews(): Promise<ApiResponse> {
  return request('/api/v1/public/reviews', { timeoutMs: 15000 })
}

/** 공개 정보 (시설 정보 등) */
export async function getPublicInfo(): Promise<ApiResponse> {
  return request('/api/v1/public/info', { timeoutMs: 15000 })
}

/** 서비스 목록 */
export async function getServices(): Promise<ApiResponse> {
  return request('/api/v1/public/services', { timeoutMs: 15000 })
}

/** 차별화 요소 목록 */
export async function getDifferentiators(): Promise<ApiResponse> {
  return request('/api/v1/public/differentiators', { timeoutMs: 15000 })
}

/** ===== Analytics helpers ===== */
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
  }
}

export function trackEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: eventName, ...params })
    return
  }
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params || {})
  }
}

export function trackPhoneClick(source: string): void {
  trackEvent('phone_click', { source })
}

export function trackFormSubmit(formName: string, success: boolean): void {
  trackEvent('form_submit', { formName, success })
}

export function trackSocialClick(platform: string, action: string): void {
  trackEvent('social_click', { platform, action })
}

export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined') return
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  if (!gaId || typeof window.gtag !== 'function') return

  window.gtag('config', gaId, {
    page_path: path,
    page_title: title,
  })
}
