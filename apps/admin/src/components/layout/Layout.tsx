import { useState, useRef, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileHeader from './MobileHeader'
import MobileDrawer from './MobileDrawer'
import MobileTabBar from './MobileTabBar'
import BackToTop from '../common/BackToTop'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { registerStaffPush } from '@/api/staffPushClient'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  /**
   * 화면 크기에 따라 하나만 그린다.
   *
   * 예전에는 데스크톱용·모바일용 <Outlet />을 둘 다 두고 CSS로 감췄는데,
   * 그러면 같은 페이지가 두 번 마운트되어 상태가 각각 따로 논다.
   * (근무표에서 데스크톱 쪽만 8월로 넘겨도 감춰진 모바일 쪽은 7월에 머물러 있고,
   *  인쇄 시 그쪽이 잡히면 7월 근무표가 찍혔다. API도 매번 두 번씩 불렀다.)
   */
  const isMobile = useIsMobile()

  // 직원앱(WebView)이면 FCM 토큰 등록 (토큰 준비 지연 대비 1회 재시도)
  useEffect(() => {
    registerStaffPush()
    const t = setTimeout(registerStaffPush, 2000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? (
        /* ── Mobile (md 미만) ── */
        <div>
          <MobileHeader onMenuClick={() => setMobileOpen(true)} />
          <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
          <main className="pt-16 px-3 pb-24 overflow-x-clip">
            <Outlet />
          </main>
          <MobileTabBar onMore={() => setMobileOpen(true)} />
          {/* 하단 탭바(56px) 위로 올림 */}
          <BackToTop bottomClass="bottom-20" />
        </div>
      ) : (
        /* ── Desktop (md 이상) ── */
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main ref={mainRef} className="flex-1 p-6 overflow-x-hidden overflow-y-auto">
            <Outlet />
          </main>
          <BackToTop containerRef={mainRef} />
        </div>
      )}
    </div>
  )
}
