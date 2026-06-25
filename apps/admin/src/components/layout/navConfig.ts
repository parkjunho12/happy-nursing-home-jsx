import {
  LayoutDashboard, UserCog, MessageSquare, FileText,
  Star, Settings, ClipboardList, CalendarDays,
  UserRound, ShieldCheck, Sparkles, FileSearch,
  Image as ImageIcon, Users, BookOpen, PenLine, Megaphone, HeartHandshake, Briefcase,
  type LucideIcon,
} from 'lucide-react'

export interface NavUser {
  role?: string | null
  position?: string | null
}

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  badge?: string
}

export interface NavConfig {
  showDashboard: boolean
  main: NavItem[]
  eval: NavItem[]
}

export function getNavConfig(
  user: NavUser | null,
  counts: {
    todayTodo?: number
    activeResidents?: number
    activeStaff?: number
  } = {},
): NavConfig {
  const isAdmin = user?.role === 'ADMIN'
  const isSocialWorker = user?.position === '사회복지사'
  const isManager = user?.position === '대표' || user?.position === '이사'
  const isCaregiverOnly =
    user?.role === 'STAFF' && user?.position === '요양보호사'

  const {
    todayTodo = 0,
    activeResidents = 0,
    activeStaff = 0,
  } = counts

  if (isCaregiverOnly) {
    return {
      showDashboard: false,
      main: [],
      eval: [
        {
          to: '/eval/checklist',
          icon: ClipboardList,
          label: '체크리스트',
          badge: todayTodo > 0 ? `${todayTodo}` : undefined,
        },
        { to: '/eval/calendar', icon: CalendarDays, label: '체크 캘린더' },
        { to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범 관리' },
      ],
    }
  }

  if (isAdmin) {
    return {
      showDashboard: true,
      main: [
        { to: '/contacts', icon: MessageSquare, label: '상담 관리' },
        { to: '/history', icon: FileText, label: '블로그' },
        { to: '/reviews', icon: Star, label: '후기 관리' },
        { to: '/analytics/page-views', icon: LayoutDashboard, label: '페이지뷰 통계' },
        { to: '/analytics/suspicious-ips', icon: ShieldCheck, label: '의심 IP 통계' },
        { to: '/naver-ads', icon: Megaphone, label: '네이버 광고 관리' },
        { to: '/volunteers', icon: HeartHandshake, label: '자원봉사 관리' },
        { to: '/recruitment', icon: Briefcase, label: '채용 관리' },
        { to: '/settings', icon: Settings, label: '설정' },
      ],
      eval: [
        {
          to: '/eval/checklist',
          icon: ClipboardList,
          label: '체크리스트',
          badge: todayTodo > 0 ? `${todayTodo}` : undefined,
        },
        { to: '/eval/calendar', icon: CalendarDays, label: '평가 캘린더' },
        {
          to: '/eval/residents',
          icon: UserRound,
          label: '수급자 관리',
          badge: activeResidents > 0 ? `${activeResidents}명` : undefined,
        },
        {
          to: '/eval/staff',
          icon: UserCog,
          label: '직원 관리(평가)',
          badge: activeStaff > 0 ? `${activeStaff}명` : undefined,
        },
        { to: '/eval/users', icon: Users, label: '직원 계정 관리' },
        { to: '/eval/record-audit', icon: FileSearch, label: '제공기록지 검수' },
        { to: '/eval/record-guide', icon: BookOpen, label: '검수 기준' },
        { to: '/eval/blog-ai-writer', icon: PenLine, label: '블로그 AI 작성' },
        { to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범' },
        { to: '/eval/ai-review', icon: Sparkles, label: 'AI 체크리스트 검토' },
      ],
    }
  }

  return {
    showDashboard: true,
    main: [
      { to: '/contacts', icon: MessageSquare, label: '상담 관리' },
      ...(isSocialWorker
        ? [
            { to: '/volunteers', icon: HeartHandshake, label: '자원봉사 관리' },
            { to: '/recruitment', icon: Briefcase, label: '채용 관리' },
          ]
        : []),
    ],
    eval: [
      {
        to: '/eval/checklist',
        icon: ClipboardList,
        label: '체크리스트',
        badge: todayTodo > 0 ? `${todayTodo}` : undefined,
      },
      { to: '/eval/calendar', icon: CalendarDays, label: '평가 캘린더' },
      ...(isSocialWorker
        ? [
            {
              to: '/eval/residents',
              icon: UserRound,
              label: '수급자 관리',
              badge: activeResidents > 0 ? `${activeResidents}명` : undefined,
            },
            {
              to: '/eval/staff',
              icon: UserCog,
              label: '직원 관리(평가)',
              badge: activeStaff > 0 ? `${activeStaff}명` : undefined,
            },
          ]
        : []),
      { to: '/eval/record-audit', icon: FileSearch, label: '제공기록지 검수' },
      { to: '/eval/record-guide', icon: BookOpen, label: '검수 기준' },
      ...(isSocialWorker || isManager
        ? [{ to: '/eval/blog-ai-writer', icon: PenLine, label: '블로그 AI 작성' }]
        : []),
      { to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범' },
    ],
  }
}