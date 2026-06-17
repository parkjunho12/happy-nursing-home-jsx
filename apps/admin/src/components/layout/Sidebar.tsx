import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, LogOut, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useLtcStore } from '@/store/ltc'
import { getNavConfig } from './navConfig'

interface SidebarProps {
  mobile?: boolean
  onNavigate?: () => void
}

type NavConfig = ReturnType<typeof getNavConfig>
type NavItemType = NavConfig['main'][number] | NavConfig['eval'][number]

const linkBase =
  'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors'
const linkActive = 'bg-primary-orange/10 text-primary-orange'
const linkInactive = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'

function isCaregiverOnly(user: { role?: string | null; position?: string | null } | null) {
  return user?.role === 'STAFF' && user?.position === '요양보호사'
}

export default function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const { logout, user } = useAuthStore()
  const caregiverOnly = isCaregiverOnly(user)

  const [evalOpen, setEvalOpen] = useState(true)

  const residents = useLtcStore(s => s.residents)
  const staffList = useLtcStore(s => s.staffList)
  const checklists = useLtcStore(s => s.checklists)

  const counts = {
    todayTodo: checklists.filter(
      c => c.active && !c.completed && c.frequency === 'daily'
    ).length,
    activeResidents: residents.filter(r => r.status === 'active').length,
    activeStaff: staffList.filter(s => s.status === 'active').length,
  }

  const nav = getNavConfig(user, counts)

  const handleNav = () => {
    onNavigate?.()
  }

  const handleLogout = () => {
    logout()
    handleNav()
  }

  const NavItem = ({ item }: { item: NavItemType }) => (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={handleNav}
      className={({ isActive }) =>
        `${linkBase} ${isActive ? linkActive : linkInactive}`
      }
    >
      <item.icon size={16} className="flex-shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>

      {!!item.badge && (
        <span className="text-[10px] bg-primary-orange/10 text-primary-orange px-1.5 py-0.5 rounded-full font-semibold">
          {item.badge}
        </span>
      )}
    </NavLink>
  )

  return (
    <aside
      className={`
        ${mobile ? 'w-full' : 'w-64'}
        bg-white border-r border-gray-100 flex flex-col h-full
        ${mobile ? '' : 'min-h-screen sticky top-0'}
      `}
    >
      <div className="px-5 py-5 border-b border-gray-50">
        <p className="text-base font-bold text-gray-900">행복한요양원</p>
        <p className="text-xs text-gray-400 mt-0.5">
          녹양역점 관리 시스템
        </p>
      </div>

      <div className="px-5 py-3 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {user?.name || '관리자'}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {user?.position || user?.role || ''}
        </p>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {!caregiverOnly && nav.showDashboard && (
          <NavLink
            to="/"
            end
            onClick={handleNav}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <LayoutDashboard size={16} className="flex-shrink-0" />
            <span>대시보드</span>
          </NavLink>
        )}

        {!caregiverOnly && nav.main.map(item => (
          <NavItem key={item.to} item={item} />
        ))}

        {nav.eval.length > 0 && (
          <div className="pt-2">
            {!caregiverOnly && nav.showDashboard && (
              <button
                type="button"
                onClick={() => setEvalOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest hover:text-gray-600"
              >
                <span>평가 관리</span>
                {evalOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            )}

            {(evalOpen || caregiverOnly || !nav.showDashboard) && (
              <div className="space-y-0.5">
                {nav.eval.map(item => (
                  <NavItem key={item.to} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-gray-50">
        <button
          type="button"
          onClick={handleLogout}
          className={`${linkBase} text-gray-500 hover:bg-red-50 hover:text-red-600 w-full`}
        >
          <LogOut size={16} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}