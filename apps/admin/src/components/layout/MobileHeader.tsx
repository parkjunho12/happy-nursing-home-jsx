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

      <div className="flex flex-col items-center">
        <span className="text-sm font-bold text-gray-900">행복한요양원</span>
        {user?.name && (
          <span className="text-[10px] text-gray-400">{user.name} · {user.position || user.role}</span>
        )}
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
