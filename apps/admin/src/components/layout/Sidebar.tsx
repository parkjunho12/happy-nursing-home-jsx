import { NavLink } from 'react-router-dom'
import { LayoutDashboard, LogOut, BookOpen, Compass } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useLtcStore } from '@/store/ltc'
import { todayKST, isItemDone } from '@/utils/period'
import { getNavConfig, MOBILE_HIDDEN, type NavItem as NavItemT } from './navConfig'

interface SidebarProps {
  mobile?: boolean
  onNavigate?: () => void
}

const linkBase =
  'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors'
const linkActive = 'bg-primary-orange/10 text-primary-orange'
const linkInactive = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'

export default function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const { logout, user } = useAuthStore()

  const residents = useLtcStore(s => s.residents)
  const staffList = useLtcStore(s => s.staffList)
  const checklists = useLtcStore(s => s.checklists)
  const occurrences = useLtcStore(s => s.occurrences)

  // 오늘 해야 하는 '일일' 업무 중 미완료 — occurrence(주기) 기준. 없으면 주기 인식 폴백.
  const todayStr = todayKST()
  const todayTodo = occurrences.length > 0
    ? new Set(
        occurrences
          .filter(o =>
            (o.status === 'pending' || o.status === 'overdue') &&
            o.frequency === 'daily' &&
            o.scheduledDate <= todayStr && o.dueDate >= todayStr)
          .map(o => o.checklistItemId)
      ).size
    : checklists.filter(c => c.active && c.frequency === 'daily' && !isItemDone(c)).length

  const counts = {
    todayTodo,
    activeResidents: residents.filter(r => r.status === 'active').length,
    activeStaff: staffList.filter(s => s.status === 'active').length,
  }

  const nav = getNavConfig(user, counts)
  // 모바일 드로어에서는 PC 전용(넓은 표·인쇄) 메뉴를 걷어낸다
  const sections = nav.sections
    .map(sec => mobile ? { ...sec, items: sec.items.filter(i => !MOBILE_HIDDEN.has(i.to)) } : sec)
    .filter(s => s.items.length > 0)

  const handleNav = () => onNavigate?.()
  const handleLogout = () => { logout(); handleNav() }

  const NavItem = ({ item }: { item: NavItemT }) => (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={handleNav}
      className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
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
        ${mobile ? 'w-full h-full' : 'w-64 h-screen'}
        bg-white border-r border-gray-100 flex flex-col
      `}
    >
      <div className="px-5 py-5 border-b border-gray-50 flex items-center gap-3">
        <img src="/logo.png" alt="행복한요양원 로고" className="w-10 h-10 object-contain shrink-0" />
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 leading-tight">행복한요양원</p>
          <p className="text-xs text-gray-400 mt-0.5">녹양역점 관리 시스템</p>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800 truncate">{user?.name || '관리자'}</p>
        <p className="text-xs text-gray-400 truncate">{user?.position || user?.role || ''}</p>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {nav.showDashboard && (
          <NavLink
            to="/"
            end
            onClick={handleNav}
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <LayoutDashboard size={16} className="flex-shrink-0" />
            <span>대시보드</span>
          </NavLink>
        )}

        {sections.map((sec, i) => {
          const showDivider = nav.showDashboard || i > 0
          return (
            <div key={sec.label} className={showDivider ? 'mt-3 pt-3 border-t border-gray-100' : ''}>
              <p className="px-3 pb-1 text-[11px] font-bold text-gray-400 tracking-wider">{sec.label}</p>
              <div className="space-y-0.5">
                {sec.items.map(item => <NavItem key={item.to} item={item} />)}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="px-3 py-2 border-t border-gray-50 space-y-0.5">
        <NavLink
          to="/work-guide"
          onClick={handleNav}
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <Compass size={16} className="flex-shrink-0" />
          <span>내 업무 가이드</span>
        </NavLink>
        <NavLink
          to="/guide"
          onClick={handleNav}
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <BookOpen size={16} className="flex-shrink-0" />
          <span>이용 안내</span>
        </NavLink>
      </div>

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
