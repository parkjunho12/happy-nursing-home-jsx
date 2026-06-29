import { Menu, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

interface Props { onMenuClick: () => void }

export default function MobileHeader({ onMenuClick }: Props) {
  const { user, logout } = useAuthStore()

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
        aria-label="메뉴 열기"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <img src="/logo.png" alt="로고" className="w-7 h-7 object-contain shrink-0" />
        <div className="flex flex-col items-start min-w-0">
          <span className="text-sm font-bold text-gray-900 leading-tight">행복한요양원</span>
          {user?.name && (
            <span className="text-[10px] text-gray-400 truncate">{user.name} · {user.position || user.role}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => logout()}
        className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
        aria-label="로그아웃"
      >
        <LogOut className="w-4 h-4 text-gray-600" />
      </button>
    </header>
  )
}
