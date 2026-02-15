import { Bell, User } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

const Header = () => {
  const { user } = useAuthStore()

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <div className="flex-1">
        {/* Search or breadcrumb can go here */}
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User Menu */}
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-orange to-primary-green rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-gray-900">{user?.name || '관리자'}</p>
            <p className="text-xs text-gray-500">{user?.role || 'ADMIN'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header