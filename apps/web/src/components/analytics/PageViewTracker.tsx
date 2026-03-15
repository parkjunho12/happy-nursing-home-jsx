'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import HelpPopup from '../popup/HelpPopup'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * 페이지뷰 자동 추적 + 반복 방문자 팝업
 */
export default function PageViewTracker() {
  const pathname = usePathname()
  const [showPopup, setShowPopup] = useState(false)
  const [popupPage, setPopupPage] = useState('')

  useEffect(() => {
    const trackPageView = async () => {
      const pageName = pathname === '/' ? 'home' : pathname.replace(/^\//, '').replace(/\//g, '_')
      
      try {
        const response = await fetch(
          `${API_URL}/api/v1/track/click?event_type=page_view_${pageName}`,
          { method: 'POST' }
        )
        
        if (response.ok) {
          const data = await response.json()
          console.log('[PageView] Tracked:', pageName, data)
          
          // 반복 방문 감지 시 팝업 표시
          if (data.show_help_popup && data.page) {
            setPopupPage(data.page)
            setShowPopup(true)
          }
          
          // 개발 모드 로그
          if (process.env.NODE_ENV === 'development') {
            console.log('[PageView]', pathname, {
              visits: '?',
              show_popup: data.show_help_popup
            })
          }
        }
      } catch (error) {
        console.error('[PageView] tracking failed:', error)
      }
    }
    
    trackPageView()
  }, [pathname])

  return (
    <HelpPopup 
      show={showPopup}
      page={popupPage}
      onClose={() => setShowPopup(false)}
    />
  )
}