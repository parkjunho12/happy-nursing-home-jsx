import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCog,
  MessageSquare,
  FileText,
  Star,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'

const Sidebar = () => {
  const { logout } = useAuthStore()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '대시보드' },
    { to: '/residents', icon: Users, label: '입소자 관리' },
    { to: '/staff', icon: UserCog, label: '직원 관리' },
    { to: '/contacts', icon: MessageSquare, label: '상담 관리' },
    { to: '/history', icon: FileText, label: '블로그' },
    { to: '/reviews', icon: Star, label: '후기 관리' },
    { to: '/settings', icon: Settings, label: '설정' },
  ]

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-orange to-primary-green rounded-lg flex items-center justify-center">
            <span className="text-xl">🏥</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">행복한요양원</h1>
            <p className="text-xs text-gray-500">관리자</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-orange text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">로그아웃</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar