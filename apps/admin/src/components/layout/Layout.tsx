import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileHeader from './MobileHeader'
import MobileDrawer from './MobileDrawer'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Desktop (md 이상) ── */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile (md 미만) ── */}
      <div className="md:hidden">
        <MobileHeader onMenuClick={() => setMobileOpen(true)} />
        <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="pt-16 px-3 pb-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
