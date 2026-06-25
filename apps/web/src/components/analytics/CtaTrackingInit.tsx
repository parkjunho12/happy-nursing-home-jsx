'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initAdTracking, resetAdSessionOnDirectEntry, trackCtaEvent } from '@/lib/analytics/naverAdTracking'

/** 광고 유입 판별 + 세션 저장 + 전역 전화/카카오 클릭 추적. */
export default function CtaTrackingInit() {
  const pathname = usePathname()
  // full page load 1회: 직접/외부 재진입이면 이전 광고세션 초기화
  useEffect(() => { resetAdSessionOnDirectEntry() }, [])
  useEffect(() => { initAdTracking() }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const a = target?.closest?.('a') as HTMLAnchorElement | null
      if (!a) return
      if (a.getAttribute('data-cta-tracked')) return // 명시 TrackedCTA에서 이미 처리

      const href = (a.getAttribute('href') || '').toLowerCase()
      if (!href) return

      const label = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      const componentName = a.getAttribute('data-cta-component') || 'InlineCTA'
      const sectionName =
        a.closest('[data-cta-section]')?.getAttribute('data-cta-section') || 'Page'

      if (href.startsWith('tel:')) {
        trackCtaEvent('phone_click', { componentName, sectionName, buttonLabel: label, destination: a.getAttribute('href') || href })
        return
      }
      if (
        href.includes('open.kakao.com') ||
        href.includes('pf.kakao.com') ||
        href.includes('qr.kakao.com') ||
        href.includes('kakao.com/o/')
      ) {
        trackCtaEvent('kakao_click', { componentName, sectionName, buttonLabel: label, destination: 'kakao' })
      }
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  return null
}
