'use client'

import { useEffect } from 'react'
import {
  trackPhoneClick,
  trackKakaoClick,
  trackDirectionsClick,
} from '@/lib/analytics/naver'

/**
 * 전역 전환 추적기.
 * 페이지마다 링크를 수정하지 않고, 문서 전체의 클릭을 위임 처리해
 * 전화(tel:)·카카오(오픈채팅/채널)·길찾기 링크 클릭을 네이버 전환으로 잡는다.
 * (상담 신청 폼 완료는 ContactForm 성공 시점에서 별도 발사)
 */
export default function ConversionTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null
      if (!anchor) return
      const href = (anchor.getAttribute('href') || '').toLowerCase()
      if (!href) return

      if (href.startsWith('tel:')) {
        trackPhoneClick()
        return
      }
      if (
        href.includes('open.kakao.com') ||
        href.includes('pf.kakao.com') ||
        href.includes('qr.kakao.com') ||
        href.includes('kakao.com/o/')
      ) {
        trackKakaoClick()
        return
      }
      // 길찾기(카카오맵/네이버지도) 외부 링크
      if (
        href.includes('map.kakao.com') ||
        href.includes('map.naver.com') ||
        href.includes('place.map.kakao') ||
        href.includes('m.map.naver.com')
      ) {
        trackDirectionsClick()
      }
    }

    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  return null
}
