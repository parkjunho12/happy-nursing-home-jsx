import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, UserCog, MessageSquare, FileText,
  Star, Settings, LogOut, ClipboardList, CalendarDays,
  UserRound, ShieldCheck, ChevronDown, ChevronRight,
  Sparkles, FileSearch, Image as ImageIcon, Users,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useLtcStore } from '@/store/ltc'
import { useState } from 'react'

const Sidebar = () => {
  const { logout, user } = useAuthStore()
  const [evalOpen, setEvalOpen] = useState(true)
  const residents  = useLtcStore(s => s.residents)
  const staffList  = useLtcStore(s => s.staffList)
  const checklists = useLtcStore(s => s.checklists)

  const isAdmin = user?.role === 'ADMIN'

  const activeResidents = residents.filter(r => r.status === 'active').length
  const activeStaff     = staffList.filter(s => s.status === 'active').length
  const todayTodo       = checklists.filter(c => c.active && !c.completed && c.frequency === 'daily').length

  // ── ADMIN 전용 메인 메뉴 (상담 관리는 공통이므로 제외)
  const adminMainNav = [
    { to: '/history',                  icon: FileText,        label: '블로그' },
    { to: '/reviews',                  icon: Star,            label: '후기 관리' },
    { to: '/analytics/page-views',     icon: LayoutDashboard, label: '페이지뷰 통계' },
    { to: '/analytics/suspicious-ips', icon: ShieldCheck,     label: '의심 IP 통계' },
    { to: '/settings',                 icon: Settings,        label: '설정' },
  ]

  // ── ADMIN 전용 평가 메뉴
  const adminEvalNav = [
    { to: '/eval/checklist',    icon: ClipboardList, label: '체크리스트',      badge: todayTodo > 0 ? `${todayTodo}` : undefined },
    { to: '/eval/calendar',     icon: CalendarDays,  label: '평가 캘린더' },
    { to: '/eval/residents',    icon: UserRound,     label: '수급자 관리',     badge: activeResidents > 0 ? `${activeResidents}명` : undefined },
    { to: '/eval/staff',        icon: UserCog,       label: '직원 관리(평가)', badge: activeStaff > 0 ? `${activeStaff}명` : undefined },
    { to: '/eval/users',        icon: Users,         label: '직원 계정 관리' },
    { to: '/eval/record-audit', icon: FileSearch,    label: '제공기록지 검수' },
    { to: '/eval/albums',       icon: ImageIcon,     label: '보호자 앨범' },
    { to: '/eval/ai-review',    icon: Sparkles,      label: 'AI 체크리스트 검토' },
  ]

  const isSocialWorker = user?.position === '사회복지사'

  // ── STAFF 전용 평가 메뉴 (role 기반 기본 + position 기반 추가)
  const staffEvalNav = [
    { to: '/eval/checklist',    icon: ClipboardList, label: '체크리스트', badge: todayTodo > 0 ? `${todayTodo}` : undefined },
    { to: '/eval/calendar',     icon: CalendarDays,  label: '평가 캘린더' },
    // 사회복지사: 수급자 관리 + 직원 관리(평가)
    ...(isSocialWorker ? [
      { to: '/eval/residents', icon: UserRound, label: '수급자 관리', badge: activeResidents > 0 ? `${activeResidents}명` : undefined },
      { to: '/eval/staff',     icon: UserCog,   label: '직원 관리(평가)', badge: activeStaff > 0 ? `${activeStaff}명` : undefined },
    ] : []),
    { to: '/eval/record-audit', icon: FileSearch, label: '제공기록지 검수' },  // 모든 STAFF
    { to: '/eval/albums',       icon: ImageIcon,  label: '보호자 앨범' },
  ]

  const evalNav = isAdmin ? adminEvalNav : staffEvalNav

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
      isActive ? 'bg-primary-orange text-white' : 'text-gray-700 hover:bg-gray-100'
    }`

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      {/* 로고 */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-orange to-primary-green rounded-lg flex items-center justify-center">
            <span className="text-xl">🏥</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">행복한요양원</h1>
            <p className="text-xs text-gray-500">
              {user?.role === 'ADMIN' ? '관리자' : '직원'}
              {user?.position ? ` · ${user.position}` : ''}
            </p>
          </div>
        </div>
        {isAdmin && (activeResidents > 0 || activeStaff > 0) && (
          <div className="flex gap-1.5 mt-3">
            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">입소 {activeResidents}명</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">직원 {activeStaff}명</span>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* 대시보드 — 공통 */}
        <NavLink to="/" end className={navLinkClass}>
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">대시보드</span>
        </NavLink>

        {/* 상담 관리 — ADMIN + STAFF 공통 */}
        <NavLink to="/contacts" className={navLinkClass}>
          <MessageSquare className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">상담 관리</span>
        </NavLink>

        {/* ADMIN 전용 일반 메뉴 */}
        {isAdmin && adminMainNav.map(item => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        {/* 평가 관리 섹션 */}
        <div className="pt-3">
          <button
            onClick={() => setEvalOpen(!evalOpen)}
            className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
          >
            <span>📋 평가 관리</span>
            {evalOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
          </button>
          {evalOpen && (
            <div className="mt-0.5 space-y-0.5">
              {evalNav.map(item => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* 사용자 정보 + 로그아웃 */}
      <div className="p-3 border-t border-gray-200 space-y-1">
        {user && (
          <div className="px-4 py-2 text-xs text-gray-400">
            <p className="font-medium text-gray-600 truncate">{user.name}</p>
            <p className="truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">로그아웃</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
