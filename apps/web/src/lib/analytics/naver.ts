/**
 * 네이버 검색광고 전환 추적 (프리미엄 로그 분석) — 단일 소스.
 *
 * 표준 방식: wcs.cnv(type, value) 로 전환을 만들고 wcs_do(_nasa) 로 전송한다.
 *   - 공통 스크립트(wcslog.js)는 NaverWcs 컴포넌트가 전역 로드한다.
 *   - 'wa' 계정은 네이버 검색광고 > 도구 > 프리미엄 로그 분석에서 발급받은 값.
 *
 * 전환 유형 코드(type): '1' 회원가입 · '2' 신청/예약 · '3' 장바구니 · '4' 구매 · '5' 기타
 *
 * 채널별(상담폼/전화/카톡/길찾기)을 네이버에서 따로 구분하려면 프리미엄 로그 분석에
 * 각 전환 유형을 별도 등록한 뒤 아래 CONVERSION_TYPE 의 코드만 바꾸면 된다.
 * 기본값은 모두 '2'(신청/예약)으로 두어 — 설정이 1개여도 모든 액션이 전환으로 집계되도록 한다.
 */

export const NAVER_WCS_ID =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NAVER_WCS_ID) ||
  's_53d5b4f75c34'

export type ConversionChannel =
  | 'lead'        // 상담 신청 완료
  | 'schedule'    // 방문 예약
  | 'phone'       // 전화 클릭
  | 'kakao'       // 카카오(오픈채팅/채널) 클릭
  | 'directions'  // 길찾기 클릭
  | 'inquiry'     // 입소 문의 버튼

// 채널 → 네이버 전환 유형 코드 (필요 시 콘솔 설정에 맞게 수정)
const CONVERSION_TYPE: Record<ConversionChannel, string> = {
  lead: '2',
  schedule: '2',
  phone: '2',
  kakao: '2',
  directions: '2',
  inquiry: '2',
}

type WcsWindow = Window & {
  wcs?: { cnv?: (type: string, value: string) => string }
  wcs_add?: Record<string, string>
  wcs_do?: (nasa?: Record<string, unknown>) => void
}

// 같은 채널 중복 발사 방지(빠른 더블클릭 등) — 채널별 3초 쿨다운
const _lastFired: Record<string, number> = {}

export function trackNaverConversion(channel: ConversionChannel, value: string = '0'): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (_lastFired[channel] && now - _lastFired[channel] < 3000) return

  const w = window as WcsWindow
  try {
    w.wcs_add = w.wcs_add || {}
    w.wcs_add['wa'] = NAVER_WCS_ID
    if (!w.wcs || typeof w.wcs.cnv !== 'function') return
    const nasa: Record<string, unknown> = {}
    nasa['cnv'] = w.wcs.cnv(CONVERSION_TYPE[channel], value)
    if (typeof w.wcs_do === 'function') w.wcs_do(nasa)
    _lastFired[channel] = now
  } catch {
    /* 전환 추적 실패는 사용자 경험에 영향 주지 않도록 무시 */
  }
}

// 채널별 헬퍼
export const trackLead = () => trackNaverConversion('lead')
export const trackSchedule = () => trackNaverConversion('schedule')
export const trackPhoneClick = () => trackNaverConversion('phone')
export const trackKakaoClick = () => trackNaverConversion('kakao')
export const trackDirectionsClick = () => trackNaverConversion('directions')
export const trackInquiryClick = () => trackNaverConversion('inquiry')
