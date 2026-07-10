import { useState, useRef, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileHeader from './MobileHeader'
import MobileDrawer from './MobileDrawer'
import MobileTabBar from './MobileTabBar'
import BackToTop from '../common/BackToTop'
import { registerStaffPush } from '@/api/staffPushClient'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // 직원앱(WebView)이면 FCM 토큰 등록 (토큰 준비 지연 대비 1회 재시도)
  useEffect(() => {
    registerStaffPush()
    const t = setTimeout(registerStaffPush, 2000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Desktop (md 이상) ── */}
      <div className="hidden md:flex h-screen overflow-hidden">
        <Sidebar />
        <main ref={mainRef} className="flex-1 p-6 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
        <BackToTop containerRef={mainRef} />
      </div>

      {/* ── Mobile (md 미만) ── */}
      <div className="md:hidden">
        <MobileHeader onMenuClick={() => setMobileOpen(true)} />
        <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="pt-16 px-3 pb-24 overflow-x-clip">
          <Outlet />
        </main>
        <MobileTabBar onMore={() => setMobileOpen(true)} />
        {/* 하단 탭바(56px) 위로 올림 */}
        <BackToTop bottomClass="bottom-20" />
      </div>
    </div>
  )
}
