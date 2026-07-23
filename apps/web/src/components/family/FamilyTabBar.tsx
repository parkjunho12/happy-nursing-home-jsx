'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Images, Megaphone, CalendarHeart } from 'lucide-react'

const TABS = [
  { href: '/family/albums', label: '앨범', icon: Images },
  { href: '/family/visit', label: '면회 예약', icon: CalendarHeart },
  { href: '/family/news', label: '시설소식', icon: Megaphone },
]

export default function FamilyTabBar() {
  const path = usePathname()
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-orange-100 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-lg mx-auto flex">
        {TABS.map(t => {
          const active = path === t.href || path.startsWith(t.href + '/')
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 transition-colors ${active ? 'text-orange-600' : 'text-gray-400'}`}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[11px] font-semibold">{t.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
