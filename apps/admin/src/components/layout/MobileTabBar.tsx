import { NavLink, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { getMobileTabs } from './navConfig'

/**
 * 모바일 하단 고정 탭바.
 * - 권한별로 자주 쓰는 기능을 1탭에 노출
 * - 마지막 "전체" 버튼으로 전체 메뉴(드로어) 열기
 * - 터치 영역 56px 이상, 세이프에어리어 대응
 */
export default function MobileTabBar({ onMore }: { onMore: () => void }) {
  const { user } = useAuthStore()
  const tabs = getMobileTabs(user)
  const { pathname } = useLocation()

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : (pathname === to || pathname.startsWith(to + '/'))

  return (
    <nav data-print="off"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-200 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="주요 메뉴"
    >
      <div className="flex items-stretch">
        {tabs.map(t => {
          const Icon = t.icon
          const active = isActive(t.to)
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-primary-orange' : 'text-gray-400 active:text-gray-600'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[11px] font-semibold leading-none">{t.label}</span>
            </NavLink>
          )
        })}
        <button
          onClick={onMore}
          className="flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-gray-400 active:text-gray-600"
          aria-label="전체 메뉴 열기"
        >
          <Menu className="w-[22px] h-[22px]" />
          <span className="text-[11px] font-semibold leading-none">전체</span>
        </button>
      </div>
    </nav>
  )
}
