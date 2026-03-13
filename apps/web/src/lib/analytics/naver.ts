/**
 * 네이버 애널리틱스 전환 추적 유틸리티
 * 
 * 사용 가능한 전환 타입:
 * - lead: 상담 신청 완료
 * - schedule: 방문 예약 완료
 * - custom001: 전화 클릭
 * - custom002: 카카오 상담 클릭
 * - custom003: 길찾기 클릭
 */

// 네이버 애널리틱스 Account ID
const NAVER_ACCOUNT_ID = 's_53d5b4f75c34'

// 전환 타입 정의
export type ConversionType = 
  | 'lead'           // 상담 신청 완료
  | 'schedule'       // 방문 예약 완료
  | 'custom001'      // 전화 클릭
  | 'custom002'      // 카카오 상담 클릭
  | 'custom003'      // 길찾기 클릭
  | 'custom004'      // 입소 문의 버튼 클릭

// Window 타입 확장
declare global {
  interface Window {
    wcs?: any
    wcs_add?: any
    _nasa?: any
  }
}

/**
 * 네이버 전환 추적 함수
 * @param type 전환 타입
 */
export function trackNaverConversion(type: ConversionType) {
  try {
    if (typeof window === 'undefined') return
    
    if (!window.wcs) {
      console.warn('네이버 애널리틱스가 로드되지 않았습니다')
      return
    }

    if (!window.wcs_add) {
      window.wcs_add = {}
    }

    window.wcs_add['wa'] = NAVER_ACCOUNT_ID

    const _conv = {
      type: type,
    }

    window.wcs.trans(_conv)
    
    console.log(`[네이버 전환 추적] ${type} 이벤트 전송 완료`)
  } catch (error) {
    console.error('[네이버 전환 추적 오류]', error)
  }
}

/**
 * 상담 신청 완료 (lead)
 */
export function trackLead() {
  trackNaverConversion('lead')
}

/**
 * 방문 예약 완료 (schedule)
 */
export function trackSchedule() {
  trackNaverConversion('schedule')
}

/**
 * 전화 클릭 (custom001)
 */
export function trackPhoneClick() {
  trackNaverConversion('custom001')
}

/**
 * 카카오 상담 클릭 (custom002)
 */
export function trackKakaoClick() {
  trackNaverConversion('custom002')
}

/**
 * 길찾기 클릭 (custom003)
 */
export function trackDirectionsClick() {
  trackNaverConversion('custom003')
}

/**
 * 입소 문의 버튼 클릭 (custom004)
 */
export function trackInquiryClick() {
  trackNaverConversion('custom004')
}