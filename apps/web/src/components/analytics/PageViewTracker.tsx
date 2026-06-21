'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * 페이지뷰 자동 추적
 * (반복 방문자 도움말 팝업은 제거됨 — 추적만 수행)
 */
export default function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const trackPageView = async () => {
      const pageName = pathname === '/' ? 'home' : pathname.replace(/^\//, '').replace(/\//g, '_')
      try {
        await fetch(
          `${API_URL}/api/v1/track/click?event_type=page_view_${pageName}`,
          { method: 'POST' }
        )
      } catch (error) {
        console.error('[PageView] tracking failed:', error)
      }
    }

    trackPageView()
  }, [pathname])

  return null
}
