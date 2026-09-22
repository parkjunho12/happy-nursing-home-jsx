import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, LogOut, BookOpen, Compass, Search, Star, X, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useLtcStore } from '@/store/ltc'
import { todayKST, isItemDone } from '@/utils/period'
import { getNavConfig, MOBILE_HIDDEN, type NavItem as NavItemT } from './navConfig'
import { moveDown, moveUp, parseFavs, removeFav, toggleFav } from '@/utils/favOrder'

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
  // 메뉴 검색 + 즐겨찾기 (localStorage에 기억)
  const [menuQ, setMenuQ] = useState('')
  const [favs, setFavs] = useState<string[]>(() => parseFavs(localStorage.getItem('nav-favs')))
  const saveFavs = (n: string[]) => {
    localStorage.setItem('nav-favs', JSON.stringify(n))
    setFavs(n)
  }
  const onStar = (to: string) => saveFavs(toggleFav(favs, to))

  /**
   * 차례 바꾸기 — 즐겨찾기를 길게 누르면 들어간다.
   *
   * 별을 누른 순서대로만 쌓이다 보니, 날마다 여는 메뉴가 세 번째에 있고
   * 어쩌다 한 번 쓰는 것이 맨 위에 있는 일이 생긴다.
   *
   * 끌어서 옮기지 않고 ▲▼ 로 한 칸씩 움직인다. 사이드바가 좁고 목록이
   * 스크롤 안에 들어 있어서, 끌기는 손가락으로도 마우스로도 자꾸 빗나간다.
   * 대여섯 개짜리 목록에서는 한 칸씩 누르는 쪽이 더 빠르고 안 틀린다.
   */
  const [sorting, setSorting] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 길게 눌러 차례 바꾸기로 들어간 뒤, 손을 떼면서 그 메뉴로 넘어가면 안 된다
  const longPressed = useRef(false)

  // 누르기 시작한 자리 — 여기서 손가락이 움직이면 '길게 누르기' 가 아니라 스크롤이다
  const pressAt = useRef<{ x: number; y: number } | null>(null)
  const startPress = (e: React.PointerEvent) => {
    longPressed.current = false
    pressAt.current = { x: e.clientX, y: e.clientY }
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      setSorting(true)
      // 폰에서 '눌린 것이 맞나' 를 손끝으로 알려준다
      try { navigator.vibrate?.(15) } catch { /* 안 되는 기기도 있다 */ }
    }, 500)
  }
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
    pressAt.current = null
  }
  /** 목록을 넘기려고 손가락을 끄는 중이면 길게 누르기로 보지 않는다 */
  const movePress = (e: React.PointerEvent) => {
    const p = pressAt.current
    if (!p) return
    if (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10) cancelPress()
  }
  useEffect(() => () => cancelPress(), [])
  // 차례를 바꾸는 중에 Esc 로 빠져나온다
  useEffect(() => {
    if (!sorting) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSorting(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [sorting])
  // 모바일 드로어에서는 PC 전용(넓은 표·인쇄) 메뉴를 걷어낸다
  const sections = nav.sections
    .map(sec => mobile ? { ...sec, items: sec.items.filter(i => !MOBILE_HIDDEN.has(i.to)) } : sec)
    .filter(s => s.items.length > 0)

  const handleNav = () => onNavigate?.()
  const handleLogout = () => { logout(); handleNav() }

  const NavItem = ({ item, fav }: { item: NavItemT; fav?: boolean }) => (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      // 즐겨찾기만 길게 눌러 차례를 바꾼다. 다른 메뉴는 그냥 링크다.
      onPointerDown={fav ? startPress : undefined}
      onPointerUp={fav ? cancelPress : undefined}
      onPointerMove={fav ? movePress : undefined}
      onPointerLeave={fav ? cancelPress : undefined}
      onPointerCancel={fav ? cancelPress : undefined}
      onContextMenu={fav ? (e => e.preventDefault()) : undefined}
      onClick={e => {
        // 길게 눌러 방금 차례 바꾸기로 들어갔다면, 손을 떼는 것이 이동이 되면 안 된다
        if (longPressed.current) { e.preventDefault(); longPressed.current = false; return }
        handleNav()
      }}
      className={({ isActive }) => `group ${linkBase} ${fav ? 'select-none' : ''} ${isActive ? linkActive : linkInactive}`}
    >
      <item.icon size={16} className="flex-shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {!!item.badge && (
        <span className="text-[10px] bg-primary-orange/10 text-primary-orange px-1.5 py-0.5 rounded-full font-semibold">
          {item.badge}
        </span>
      )}
      <span role="button" tabIndex={-1}
        onClick={e => { e.preventDefault(); e.stopPropagation(); onStar(item.to) }}
        title={favs.includes(item.to) ? '즐겨찾기 해제' : '즐겨찾기 — 맨 위에 고정'}
        className={`shrink-0 p-0.5 rounded transition-opacity ${favs.includes(item.to) ? 'text-amber-400' : 'text-gray-200 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}>
        <Star size={13} fill={favs.includes(item.to) ? 'currentColor' : 'none'} />
      </span>
    </NavLink>
  )

  // 전체 항목 평탄화 — 검색·즐겨찾기용
  const allItems = useMemo(() => sections.flatMap(sec => sec.items), [sections])
  const favItems = favs.map(to => allItems.find(i => i.to === to)).filter(Boolean) as NavItemT[]
  const searched = menuQ ? allItems.filter(i => i.label.toLowerCase().includes(menuQ.toLowerCase())) : null

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
        {/* 메뉴 검색 */}
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={menuQ} onChange={e => setMenuQ(e.target.value)} placeholder="메뉴 검색"
            className="w-full pl-8 pr-7 py-2 text-sm border border-gray-100 bg-gray-50/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange/30 focus:bg-white" />
          {menuQ && (
            <button onClick={() => setMenuQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={13} /></button>
          )}
        </div>

        {searched ? (
          /* 검색 결과 — 섹션 무시하고 평탄 목록 */
          <div className="space-y-0.5">
            {searched.map(item => <NavItem key={item.to} item={item} />)}
            {searched.length === 0 && <p className="px-3 py-4 text-xs text-gray-300 text-center">‘{menuQ}’ 메뉴 없음</p>}
          </div>
        ) : (
        <>
        {/* 즐겨찾기 — 맨 위 고정. 길게 누르면 차례를 바꾼다. */}
        {favItems.length > 0 && (
          <div className="mb-2 pb-2 border-b border-amber-100">
            <p className="px-3 pb-1 text-[11px] font-bold text-amber-500 tracking-wider flex items-center gap-1">
              <Star size={10} fill="currentColor" /> 즐겨찾기
              {sorting ? (
                <button onClick={() => setSorting(false)}
                  className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold">
                  <Check size={10} /> 완료
                </button>
              ) : (
                favItems.length > 1 && (
                  <span className="ml-auto text-[10px] font-normal text-gray-300">길게 눌러 차례 바꾸기</span>
                )
              )}
            </p>
            <div className="space-y-0.5">
              {sorting
                ? favItems.map((item, i) => (
                    <div key={`sort-${item.to}`}
                      className={`${linkBase} gap-1.5 pr-1 bg-amber-50 border border-amber-200 select-none`}>
                      <item.icon size={15} className="flex-shrink-0 text-amber-600" />
                      <span className="flex-1 min-w-0 truncate text-gray-800">{item.label}</span>
                      <button onClick={() => saveFavs(moveUp(favs, item.to))} disabled={i === 0}
                        title="위로" aria-label={`${item.label} 위로`}
                        className="p-0.5 rounded-md text-amber-600 hover:bg-amber-100 disabled:opacity-25">
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => saveFavs(moveDown(favs, item.to))} disabled={i === favItems.length - 1}
                        title="아래로" aria-label={`${item.label} 아래로`}
                        className="p-0.5 rounded-md text-amber-600 hover:bg-amber-100 disabled:opacity-25">
                        <ChevronDown size={14} />
                      </button>
                      <button onClick={() => saveFavs(removeFav(favs, item.to))}
                        title="즐겨찾기에서 빼기" aria-label={`${item.label} 즐겨찾기에서 빼기`}
                        className="p-0.5 rounded-md text-gray-300 hover:text-rose-600 hover:bg-rose-50">
                        <X size={13} />
                      </button>
                    </div>
                  ))
                : favItems.map(item => <NavItem key={`fav-${item.to}`} item={item} fav />)}
            </div>
          </div>
        )}
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
        </>
        )}
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
      <p className="px-4 pb-2 text-[9px] text-gray-300 select-all">빌드 {typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev'}</p>
    </aside>
  )
}
