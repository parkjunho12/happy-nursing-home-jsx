/**
 * 네이버 광고 유입 CTA 추적 (focused)
 * - 광고 유입(utm_source=naver / utm_medium=cpc / n_media=naver / n_query 존재)만 추적
 * - 최초 유입 정보를 sessionStorage에 저장(다른 페이지로 이동해도 유지)
 * - 개인정보는 전송하지 않음 (지표/UTM/네이버 파라미터만)
 */
import { resolveApiBase } from '@/lib/api-client'

const SS_AD = 'naver_ad_session_v2'
const AD_TTL_MS = 12 * 60 * 60 * 1000 // 12시간
const SS_SID = 'cta_session_id_v1'
const isDev = process.env.NODE_ENV !== 'production'

export type CtaEventType =
  | 'phone_click'
  | 'consultation_click'
  | 'consultation_submit'
  | 'kakao_click'

export interface AdInfo {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  naver_query?: string | null
  naver_campaign_id?: string | null
  naver_adgroup_id?: string | null
  naver_keyword_id?: string | null
  naver_ad_id?: string | null
  naver_keyword?: string | null
  naver_rank?: string | null
  naver_media?: string | null
  naver_match_type?: string | null
  naver_campaign_type?: string | null
}

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* noop */ }
  return 'sid-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

function parseAdParams(search: string): AdInfo | null {
  const p = new URLSearchParams(search)
  const utm_source = p.get('utm_source')
  const utm_medium = p.get('utm_medium')
  const n_media = p.get('n_media')
  const n_query = p.get('n_query')
  const isAd =
    (utm_source && utm_source.toLowerCase() === 'naver') ||
    (utm_medium && utm_medium.toLowerCase() === 'cpc') ||
    (n_media && n_media.toLowerCase() === 'naver') ||
    !!n_query
  if (!isAd) return null
  return {
    utm_source,
    utm_medium,
    utm_campaign: p.get('utm_campaign'),
    utm_term: p.get('utm_term'),
    utm_content: p.get('utm_content'),
    naver_query: n_query,
    naver_campaign_id: p.get('n_campaign') || p.get('n_campaign_id'),
    naver_adgroup_id: p.get('n_ad_group') || p.get('n_adgroup_id'),
    naver_keyword_id: p.get('n_keyword_id'),
    naver_ad_id: p.get('n_ad') || p.get('n_ad_id'),
    naver_keyword: p.get('n_keyword'),
    naver_rank: p.get('n_rank'),
    naver_media: n_media,
    naver_match_type: p.get('n_match'),
    naver_campaign_type: p.get('n_campaign_type'),
  }
}

/** 진입 시 호출: 세션ID 생성 + 광고 유입 정보 최초 저장 */
export function initAdTracking(): void {
  if (typeof window === 'undefined') return
  try {
    if (!sessionStorage.getItem(SS_SID)) sessionStorage.setItem(SS_SID, uuid())
    if (!sessionStorage.getItem(SS_AD)) {
      const info = parseAdParams(window.location.search)
      if (info) {
        sessionStorage.setItem(SS_AD, JSON.stringify({ info, ts: Date.now() }))
        if (isDev) console.log('[CTA_TRACKING] ad_session=true', info)
      }
    }
  } catch { /* noop */ }
}

/**
 * 직접 입력 / 외부(검색·SNS) 재진입 처리.
 * - 이번 페이지 로드에 광고 파라미터가 없고
 * - referrer 가 우리 사이트가 아니면(직접 주소 입력 등)
 * 이전에 남아있던 광고세션을 무효화한다.
 * (광고로 들어온 뒤 사이트 내부 이동은 same-origin referrer 라 광고로 유지됨)
 * full page load 시 1회만 호출할 것(SPA 라우트 변경에서는 호출 금지).
 */
export function resetAdSessionOnDirectEntry(): void {
  if (typeof window === 'undefined') return
  try {
    if (parseAdParams(window.location.search)) return // 이번 로드가 광고 유입 → 유지
    const ref = document.referrer || ''
    let sameOrigin = false
    if (ref) {
      try { sameOrigin = new URL(ref).origin === window.location.origin } catch { sameOrigin = false }
    }
    if (!sameOrigin) {
      sessionStorage.removeItem(SS_AD)
      if (isDev) console.log('[CTA_TRACKING] direct/external entry → ad_session reset')
    }
  } catch { /* noop */ }
}

export function getAdSession(): AdInfo | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SS_AD)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { info: AdInfo; ts: number }
    if (!parsed || !parsed.info) return null
    if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > AD_TTL_MS) {
      sessionStorage.removeItem(SS_AD)
      return null
    }
    return parsed.info
  } catch {
    return null
  }
}

export function isAdSession(): boolean {
  return !!getAdSession()
}

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let s = sessionStorage.getItem(SS_SID)
    if (!s) { s = uuid(); sessionStorage.setItem(SS_SID, s) }
    return s
  } catch { return '' }
}

function deviceType(): 'mobile' | 'tablet' | 'desktop' {
  const u = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase()
  if (u.includes('ipad') || u.includes('tablet')) return 'tablet'
  if (u.includes('mobi') || u.includes('android') || u.includes('iphone')) return 'mobile'
  return 'desktop'
}

interface CtaMeta {
  componentName?: string
  sectionName?: string
  buttonLabel?: string
  destination?: string
}

function send(payload: Record<string, unknown>): void {
  const url = `${resolveApiBase()}/api/v1/public/marketing/cta-event`
  try {
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      if (ok) return
    }
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  } catch { /* 전송 실패해도 사용자 동작은 계속됨 */ }
}

/**
 * CTA 이벤트 전송. 광고 유입 세션일 때만 전송한다(force=true 면 강제 — 테스트용).
 */
export function trackCtaEvent(eventType: CtaEventType, meta: CtaMeta = {}): void {
  if (typeof window === 'undefined') return
  // 모든 사용자 수집(광고 유입 정보는 있으면 함께 전송). 광고/비광고 구분은 어드민 필터에서 처리.
  const ad = getAdSession()

  const payload: Record<string, unknown> = {
    event_type: eventType,
    page_path: window.location.pathname,
    page_title: typeof document !== 'undefined' ? document.title : null,
    component_name: meta.componentName ?? null,
    section_name: meta.sectionName ?? null,
    button_label: meta.buttonLabel ?? null,
    destination: meta.destination ?? null,
    ...(ad || {}),
    session_id: getSessionId(),
    device_type: deviceType(),
  }
  if (isDev) {
    console.log(`[CTA_TRACKING] event=${eventType} ad_session=${!!ad} page=${payload.page_path} component=${meta.componentName ?? '-'} section=${meta.sectionName ?? '-'}`)
  }
  send(payload)
}
