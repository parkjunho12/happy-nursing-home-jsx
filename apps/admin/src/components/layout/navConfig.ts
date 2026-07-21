import {
  LayoutDashboard, UserCog, MessageSquare, FileText,
  Star, Settings, ClipboardList, ClipboardCheck, CalendarDays,
  UserRound, ShieldCheck, Sparkles, FileSearch,
  Image as ImageIcon, Users, BookOpen, PenLine, Megaphone, Bell, CalendarClock, HeartHandshake, Briefcase, Soup, Receipt, GraduationCap,
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

export interface NavSection {
  label: string
  items: NavItem[]
}

export interface NavConfig {
  showDashboard: boolean
  sections: NavSection[]
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
  const isAlbumOnly = user?.position === '앨범담당'
  const isFacilityHead = user?.role !== 'ADMIN' && user?.position === '시설장'

  const {
    todayTodo = 0,
    activeResidents = 0,
    activeStaff = 0,
  } = counts

  const checklistItem: NavItem = {
    to: '/eval/checklist',
    icon: ClipboardList,
    label: '체크리스트',
    badge: todayTodo > 0 ? `${todayTodo}` : undefined,
  }

  // 앨범담당 — 앨범만
  if (isAlbumOnly) {
    return {
      showDashboard: false,
      sections: [
        { label: '앨범', items: [{ to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범 관리' }] },
        { label: '교육', items: [{ to: '/education', icon: GraduationCap, label: '직원 교육' }] },
      ],
    }
  }

  // 요양보호사 — 업무 · 앨범 (지출결의 없음)
  if (isCaregiverOnly) {
    return {
      showDashboard: true,
      sections: [
        {
          label: '업무',
          items: [
            checklistItem,
            { to: '/eval/calendar', icon: CalendarDays, label: '체크 캘린더' },
            { to: '/schedule', icon: CalendarDays, label: '일정 캘린더' },
            { to: '/my-schedule', icon: CalendarDays, label: '내 근무표' },
            { to: '/education', icon: GraduationCap, label: '직원 교육' },
          ],
        },
        { label: '앨범', items: [{ to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범 관리' }] },
      ],
    }
  }

  // ADMIN — 전체 섹션
  if (isAdmin) {
    return {
      showDashboard: true,
      sections: [
        {
          label: '운영',
          items: [
            { to: '/contacts', icon: MessageSquare, label: '상담 관리' },
            { to: '/eval/residents', icon: UserRound, label: '수급자 관리', badge: activeResidents > 0 ? `${activeResidents}명` : undefined },
            { to: '/resident-docs', icon: ClipboardList, label: '어르신 서류현황' },
            { to: '/eval/staff', icon: UserCog, label: '직원 관리', badge: activeStaff > 0 ? `${activeStaff}명` : undefined },
            { to: '/staff-hr', icon: FileText, label: '직원 상세' },
            { to: '/staffing', icon: Users, label: '인력배치 시뮬레이터' },
            { to: '/schedule', icon: CalendarDays, label: '일정 캘린더' },
            { to: '/my-schedule', icon: CalendarDays, label: '내 근무표' },
            { to: '/work-schedule', icon: CalendarClock, label: '근무표' },
            { to: '/handover', icon: ClipboardCheck, label: '인수인계 AI' },
            { to: '/facility-news', icon: Megaphone, label: '시설소식' },
            { to: '/notices', icon: Bell, label: '내부 공지 관리' },
            { to: '/volunteers', icon: HeartHandshake, label: '자원봉사 관리' },
            { to: '/recruitment', icon: Briefcase, label: '채용 관리' },
            { to: '/enteral', icon: Soup, label: '경관식 관리' },
          ],
        },
        {
          label: '평가',
          items: [
            checklistItem,
            { to: '/eval/calendar', icon: CalendarDays, label: '평가 캘린더' },
            { to: '/education', icon: GraduationCap, label: '직원 교육' },
            { to: '/eval/workload', icon: ClipboardCheck, label: '담당자별 현황' },
            { to: '/eval/record-audit', icon: FileSearch, label: '제공기록지 검수' },
            { to: '/eval/record-guide', icon: BookOpen, label: '검수 기준' },
            { to: '/eval/ai-review', icon: Sparkles, label: 'AI 체크리스트 검토' },
          ],
        },
        {
          label: '앨범',
          items: [{ to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범' }],
        },
        {
          label: '회계',
          items: [{ to: '/expense', icon: Receipt, label: '지출결의' }],
        },
        {
          label: '마케팅',
          items: [
            { to: '/history', icon: FileText, label: '블로그' },
            { to: '/eval/blog-ai-writer', icon: PenLine, label: '블로그 AI 작성' },
            { to: '/reviews', icon: Star, label: '후기 관리' },
            { to: '/naver-ads', icon: Megaphone, label: '네이버 광고 관리' },
            { to: '/analytics/page-views', icon: LayoutDashboard, label: '페이지뷰 통계' },
            { to: '/analytics/suspicious-ips', icon: ShieldCheck, label: '의심 IP 통계' },
          ],
        },
        {
          label: '시스템',
          items: [
            { to: '/eval/users', icon: Users, label: '직원 계정 관리' },
            { to: '/settings', icon: Settings, label: '설정' },
          ],
        },
      ],
    }
  }

  // 시설장(직원 겸직) — 관리자급 메뉴, 단 네이버 광고 제외 / 지출결의 승인권은 백엔드에서 차단
  if (isFacilityHead) {
    return {
      showDashboard: true,
      sections: [
        {
          label: '운영',
          items: [
            { to: '/contacts', icon: MessageSquare, label: '상담 관리' },
            { to: '/eval/residents', icon: UserRound, label: '수급자 관리', badge: activeResidents > 0 ? `${activeResidents}명` : undefined },
            { to: '/resident-docs', icon: ClipboardList, label: '어르신 서류현황' },
            { to: '/eval/staff', icon: UserCog, label: '직원 관리', badge: activeStaff > 0 ? `${activeStaff}명` : undefined },
            { to: '/staff-hr', icon: FileText, label: '직원 상세' },
            { to: '/staffing', icon: Users, label: '인력배치 시뮬레이터' },
            { to: '/schedule', icon: CalendarDays, label: '일정 캘린더' },
            { to: '/my-schedule', icon: CalendarDays, label: '내 근무표' },
            { to: '/work-schedule', icon: CalendarClock, label: '근무표' },
            { to: '/handover', icon: ClipboardCheck, label: '인수인계 AI' },
            { to: '/facility-news', icon: Megaphone, label: '시설소식' },
            { to: '/notices', icon: Bell, label: '내부 공지 관리' },
            { to: '/volunteers', icon: HeartHandshake, label: '자원봉사 관리' },
            { to: '/recruitment', icon: Briefcase, label: '채용 관리' },
            { to: '/enteral', icon: Soup, label: '경관식 관리' },
          ],
        },
        {
          label: '평가',
          items: [
            checklistItem,
            { to: '/eval/calendar', icon: CalendarDays, label: '평가 캘린더' },
            { to: '/education', icon: GraduationCap, label: '직원 교육' },
            { to: '/eval/workload', icon: ClipboardCheck, label: '담당자별 현황' },
            { to: '/eval/record-audit', icon: FileSearch, label: '제공기록지 검수' },
            { to: '/eval/record-guide', icon: BookOpen, label: '검수 기준' },
            { to: '/eval/ai-review', icon: Sparkles, label: 'AI 체크리스트 검토' },
          ],
        },
        { label: '앨범', items: [{ to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범' }] },
        { label: '회계', items: [{ to: '/expense', icon: Receipt, label: '지출결의' }] },
        {
          label: '마케팅',
          items: [
            { to: '/history', icon: FileText, label: '블로그' },
            { to: '/eval/blog-ai-writer', icon: PenLine, label: '블로그 AI 작성' },
            { to: '/reviews', icon: Star, label: '후기 관리' },
            { to: '/analytics/page-views', icon: LayoutDashboard, label: '페이지뷰 통계' },
            { to: '/analytics/suspicious-ips', icon: ShieldCheck, label: '의심 IP 통계' },
          ],
        },
        {
          label: '시스템',
          items: [
            { to: '/eval/users', icon: Users, label: '직원 계정 관리' },
            { to: '/settings', icon: Settings, label: '설정' },
          ],
        },
      ],
    }
  }

  // 일반 직원 (사회복지사·간호조무사·이사·대표·시설장 등)
  const canEnteral = ['사회복지사', '간호조무사', '이사', '대표', '시설장'].includes(user?.position ?? '')
  const operItems: NavItem[] = [
    { to: '/contacts', icon: MessageSquare, label: '상담 관리' },
    { to: '/schedule', icon: CalendarDays, label: '일정 캘린더' },
    { to: '/my-schedule', icon: CalendarDays, label: '내 근무표' },
  ]
  if (isSocialWorker) operItems.push(
    { to: '/notices', icon: Bell, label: '내부 공지 관리' },
    { to: '/facility-news', icon: Megaphone, label: '시설소식' },
    { to: '/volunteers', icon: HeartHandshake, label: '자원봉사 관리' },
  )
  if (isManager) operItems.push(
    { to: '/eval/staff', icon: UserCog, label: '직원 관리', badge: activeStaff > 0 ? `${activeStaff}명` : undefined },
    { to: '/staff-hr', icon: FileText, label: '직원 상세' },
  )
  if (canEnteral) operItems.push({ to: '/enteral', icon: Soup, label: '경관식 관리' })
  const canHandover = ['사회복지사', '간호사', '간호조무사', '시설장'].includes(user?.position ?? '')
  if (canHandover) operItems.push({ to: '/handover', icon: ClipboardCheck, label: '인수인계 AI' })

  const evalItems: NavItem[] = [
    checklistItem,
    { to: '/eval/calendar', icon: CalendarDays, label: '평가 캘린더' },
    { to: '/education', icon: GraduationCap, label: '직원 교육' },
  ]
  if (isSocialWorker) {
    evalItems.push(
      { to: '/eval/residents', icon: UserRound, label: '수급자 관리', badge: activeResidents > 0 ? `${activeResidents}명` : undefined },
      { to: '/resident-docs', icon: ClipboardList, label: '어르신 서류현황' },
    )
  }
  evalItems.push(
    { to: '/eval/record-audit', icon: FileSearch, label: '제공기록지 검수' },
    { to: '/eval/record-guide', icon: BookOpen, label: '검수 기준' },
  )

  const marketingItems: NavItem[] = []
  if (isSocialWorker || isManager) marketingItems.push({ to: '/eval/blog-ai-writer', icon: PenLine, label: '블로그 AI 작성' })

  const sections: NavSection[] = [
    { label: '운영', items: operItems },
    { label: '평가', items: evalItems },
    { label: '앨범', items: [{ to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범' }] },
    { label: '회계', items: [{ to: '/expense', icon: Receipt, label: '지출결의' }] },
    { label: '마케팅', items: marketingItems },
  ]

  return { showDashboard: true, sections }
}

// 모바일 하단 탭 — 권한별 자주 쓰는 기능 1탭 접근 (마지막 "전체" 버튼은 컴포넌트에서 추가)
export function getMobileTabs(user: NavUser | null): NavItem[] {
  const pos = user?.position ?? ''
  if (pos === '앨범담당') {
    return [{ to: '/eval/albums', icon: ImageIcon, label: '보호자 앨범' }]
  }
  const isCaregiver = user?.role === 'STAFF' && pos === '요양보호사'
  if (isCaregiver) {
    return [
      { to: '/eval/checklist', icon: ClipboardList, label: '체크리스트' },
      { to: '/my-schedule',    icon: CalendarDays,  label: '내 근무' },
      { to: '/schedule',       icon: CalendarDays,  label: '일정' },
      { to: '/eval/albums',    icon: ImageIcon,     label: '앨범' },
    ]
  }
  // ADMIN · 일반 직원 공통
  return [
    { to: '/',               icon: LayoutDashboard, label: '홈' },
    { to: '/eval/checklist', icon: ClipboardList,   label: '체크리스트' },
    { to: '/schedule',       icon: CalendarDays,    label: '일정' },
    { to: '/eval/albums',    icon: ImageIcon,       label: '앨범' },
  ]
}
