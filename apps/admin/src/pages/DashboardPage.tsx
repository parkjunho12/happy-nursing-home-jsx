import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserCog, MessageSquare, TrendingUp, Calendar,
  AlertTriangle, CheckCircle2, Clock, ChevronRight,
  LogIn, LogOut, UserPlus, UserMinus, ClipboardList,
  Receipt, Image as ImageIcon, Inbox, Megaphone, Loader2, Check , CalendarClock, ArrowLeftRight
} from 'lucide-react'
import { dashboardAPI, apiClient } from '@/api/client'
import { expenseAPI } from '@/api/expenseClient'
import { leaveAPI, swapAPI } from '@/api/leaveClient'
import { visitAPI } from '@/api/visitClient'
import { cardKeyAPI } from '@/api/cardKeyClient'
import { newsAPI, type FacilityNews } from '@/api/newsClient'
import { useLtcStore } from '@/store/ltc'
import { useAuthStore } from '@/store/auth'
import NoticeBoard from '@/components/dashboard/NoticeBoard'
import HandoverTodayCard from '@/components/dashboard/HandoverTodayCard'
import UpcomingDocs from '@/components/dashboard/UpcomingDocs'
import UpcomingSchedule from '@/components/dashboard/UpcomingSchedule'
import ResidentTrendChart from '@/components/dashboard/ResidentTrendChart'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { getNavConfig } from '@/components/layout/navConfig'
import type { DashboardStats } from '@/types'
import { RECURRING, FREQUENCY_LABELS, getPeriodEnd, todayKST, todayDateKST, getCurrentPeriodKey, daysFromToday } from '@/utils/period'

// ── 타입 ──────────────────────────────────────────────────────────────────
interface TodayTask {
  occId: string
  itemId: string
  title: string
  frequency: string
  riskLevel: string
  personName?: string
  assignee?: string
  isEvent: boolean
  daysOverdue: number   // 0 = 오늘 기한, 양수 = n일 지남
  isOneTime?: boolean
  daysLeft?: number      // one_time: 기한까지 남은 일수
  inProgress?: boolean   // 착수(진행 중)
  startedBy?: string
}

const todayStr = todayKST()

export default function DashboardPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // ── 대시보드 위젯 노출 = 그 사람이 실제로 가진 메뉴 기준
  //    사이드바와 같은 getNavConfig 를 쓰므로 메뉴/대시보드가 어긋날 수 없다.
  const { user: authUser } = useAuthStore()
  const allowed = useMemo(() => {
    const cfg = getNavConfig(authUser ?? null)
    const set = new Set<string>()
    cfg.sections.forEach(sec => sec.items.forEach(it => set.add(it.to)))
    return set
  }, [authUser])
  const can = (route: string) => allowed.has(route)
  const canResidents = can('/eval/residents')
  const canStaffList = can('/eval/staff')
  const canChecklist = can('/eval/checklist')
  const [siteStats, setSiteStats] = useState<DashboardStats | null>(null)
  const [loadingSite, setLoadingSite] = useState(true)
  const [pending, setPending] = useState<{ expense: number; album: number; leave: number; swap: number; visit: number; refund: number }>({ expense: 0, album: 0, leave: 0, swap: 0, visit: 0, refund: 0 })
  const [recentNews, setRecentNews] = useState<FacilityNews[]>([])

  const { checklists, occurrences, residents, staffList, loaded, loadAll, toggleComplete, completeOccurrence } = useLtcStore()

  useEffect(() => { if (canResidents || canStaffList || can('/contacts')) loadSiteStats() }, [canResidents, canStaffList])
  useEffect(() => { loadPending() }, [])
  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  const loadSiteStats = async () => {
    try {
      setLoadingSite(true)
      const res = await dashboardAPI.stats()
      setSiteStats(res || null)
    } catch (e) { console.error(e) }
    finally { setLoadingSite(false) }
  }

  // 크로스 기능 '처리 대기' 카운트 — 권한 없으면 0으로 폴백(대시보드에 영향 없음)
  const canApproveLeave = authUser?.role === 'ADMIN' || authUser?.position === '시설장'
  const canVisit = authUser?.role === 'ADMIN' || ['시설장', '사회복지사'].includes(authUser?.position ?? '')
  const loadPending = async () => {
    const [exp, alb, news, lv, sw, vs, rf] = await Promise.all([
      can('/expense')
        ? expenseAPI.list({}).then(r => r.filter(x => x.status === 'pending' || x.status === 'manager_approved').length).catch(() => 0) : Promise.resolve(0),
      can('/eval/albums')
        ? apiClient.get('/api/v1/admin/pending-media').then((r: any) => (r.data?.data ?? []).length).catch(() => 0) : Promise.resolve(0),
      can('/facility-news')
        ? newsAPI.list().then(rows => rows.filter(n => n.is_published).slice(0, 3)).catch(() => [] as FacilityNews[]) : Promise.resolve([] as FacilityNews[]),
      canApproveLeave
        ? leaveAPI.list(undefined, 'pending').then(r => r.length).catch(() => 0) : Promise.resolve(0),
      canApproveLeave
        ? swapAPI.list('pending').then(r => r.length).catch(() => 0) : Promise.resolve(0),
      canVisit
        ? visitAPI.list('pending').then(r => r.length).catch(() => 0) : Promise.resolve(0),
      can('/staff-hr')
        // 카드는 반납받았는데 보증금을 아직 안 돌려준 건 — 잊기 쉬운 돈 문제라 대시보드로 끌어올린다
        ? cardKeyAPI.list().then(rows => rows.filter(r => r.returned && r.deposit_date && !r.refunded).length).catch(() => 0)
        : Promise.resolve(0),
    ])
    setPending({ expense: exp, album: alb, leave: lv, swap: sw, visit: vs, refund: rf })
    setRecentNews(news)
  }

  // ── occurrence 기반: 오늘 해야 할 것 ────────────────────────────────────
  // pending/overdue 중 due_date <= 오늘인 occurrence = 해야 하는데 안 한 것
  const { todayTasks, urgentTasks, eventPendingTasks } = useMemo(() => {
    // occurrence가 아직 없으면 (sync 전) checklists fallback
    const hasOccurrences = occurrences.length > 0

    const todayT: TodayTask[] = []
    const urgentT: TodayTask[] = []
    const eventT: TodayTask[] = []

    if (hasOccurrences) {
      // ── 새 방식: occurrence 기반 ──────────────────────────────────────
      const itemMap = new Map(checklists.map(c => [c.id, c]))

      // 같은 아이템 중 dueDate 가장 큰(최신) occurrence만 사용
      const latestOccMap = new Map<string, typeof occurrences[0]>()
      occurrences
        .filter(o => {
          if (o.status !== 'pending' && o.status !== 'overdue' && o.status !== 'in_progress') return false
          if (o.frequency === 'one_time') return o.dueDate >= todayStr
          if (o.status === 'overdue') return true
          return o.scheduledDate <= todayStr && o.dueDate >= todayStr
        })
        .forEach(o => {
          const existing = latestOccMap.get(o.checklistItemId)
          if (!existing || o.dueDate > existing.dueDate)
            latestOccMap.set(o.checklistItemId, o)
        })

      Array.from(latestOccMap.values()).forEach(o => {
          const item = itemMap.get(o.checklistItemId)
          if (!item || !item.active) return

          const isEvent = ['on_admission', 'on_discharge', 'on_hire'].includes(o.frequency)
          const daysOverdue = Math.max(0, -daysFromToday(o.dueDate))

          // one_time: 기한까지 남은 일수 계산
          const daysLeft = o.frequency === 'one_time' && o.dueDate
            ? Math.max(0, daysFromToday(o.dueDate))
            : undefined

          const task: TodayTask = {
            occId: o.id,
            itemId: item.id,
            title: item.title,
            frequency: item.frequency,
            riskLevel: item.riskLevel,
            personName: item.personName,
            assignee: item.assignee,
            isEvent,
            daysOverdue,
            isOneTime: o.frequency === 'one_time',
            daysLeft,
            inProgress: o.status === 'in_progress',
            startedBy: o.startedBy,
          }

          if (isEvent) {
            eventT.push(task)
          } else {
            todayT.push(task)
            if (item.riskLevel === 'high') urgentT.push(task)
          }
        })

    } else {
      // ── 구 방식 fallback: occurrence sync 전 ──────────────────────────
      const today = todayDateKST()
      checklists
        .filter(c => c.active)
        .forEach(c => {
          const isEvent = ['on_admission', 'on_discharge', 'on_hire'].includes(c.frequency)
          const done = isEvent
            ? c.completed
            : c.completionHistory.some(r => {
                const key = c.frequency === 'daily' ? todayStr
                  : c.frequency === 'monthly' ? `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
                  : ''
                return key ? r.periodKey === key : false
              })

          if (done) return

          const task: TodayTask = {
            occId: '',
            itemId: c.id,
            title: c.title,
            frequency: c.frequency,
            riskLevel: c.riskLevel,
            personName: c.personName,
            assignee: c.assignee,
            isEvent,
            daysOverdue: 0,
          }
          if (isEvent) eventT.push(task)
          else {
            todayT.push(task)
            if (c.riskLevel === 'high') urgentT.push(task)
          }
        })
    }

    return {
      todayTasks:        todayT.sort((a, b) => (b.riskLevel==='high'?1:0)-(a.riskLevel==='high'?1:0)),
      urgentTasks:       urgentT,
      eventPendingTasks: eventT.sort((a, b) => b.daysOverdue - a.daysOverdue),
    }
  }, [occurrences, checklists])

  // 일일 vs 비일일(주별+월별+...) 분리
  const dailyTasks    = todayTasks.filter(t => t.frequency === 'daily')
  const nonDailyTasks = todayTasks.filter(t => t.frequency !== 'daily')

  // ── occurrence 기반: 주기별 완료 현황 ────────────────────────────────────
  const periodProgress = useMemo(() => {
    const hasOccurrences = occurrences.length > 0

    return RECURRING.map(freq => {
      if (hasOccurrences) {
        // 현재 진행 중인 주기: scheduledDate <= 오늘 <= dueDate
        // 같은 아이템에 여러 occurrence가 있으면 dueDate가 가장 큰(최신 주기) 것만 사용
        const candidateMap = new Map<string, typeof occurrences[0]>()
        occurrences
          .filter(o =>
            o.frequency === freq &&
            o.scheduledDate <= todayStr &&
            o.dueDate >= todayStr &&
            checklists.find(c => c.id === o.checklistItemId)?.active
          )
          .forEach(o => {
            const existing = candidateMap.get(o.checklistItemId)
            if (!existing || o.dueDate > existing.dueDate)
              candidateMap.set(o.checklistItemId, o)
          })

        let total = 0, done = 0
        candidateMap.forEach(o => {
          total++
          if (o.status === 'completed') done++
        })

        const end = getPeriodEnd(freq as any)
        const daysLeft = Math.max(0, daysFromToday(end.toISOString().split('T')[0]))
        return { freq, total, done, daysLeft, rate: total ? Math.round(done / total * 100) : 0 }

      } else {
        // fallback: checklists 기반
        const items = checklists.filter(c => c.active && c.frequency === freq)
        const key = freq === 'daily'   ? todayStr
          : getCurrentPeriodKey(freq as any) !== todayStr ? getCurrentPeriodKey(freq as any) : todayStr
        const done = items.filter(c => c.completionHistory.some(r => r.periodKey === key)).length
        const end = getPeriodEnd(freq as any)
        const daysLeft = Math.max(0, daysFromToday(end.toISOString().split('T')[0]))
        return { freq, total: items.length, done, daysLeft, rate: items.length ? Math.round(done/items.length*100) : 0 }
      }
    }).filter(p => p.total > 0)
  }, [occurrences, checklists])

  // ── 오늘 인물 이벤트 ────────────────────────────────────────────────────
  const todayPersonEvents = useMemo(() => {
    const events: { type: string; name: string; category: string }[] = []
    residents.forEach(r => {
      if (r.admissionDate === todayStr) events.push({ type: 'admission', name: r.name, category: '수급자' })
      if (r.dischargeDate === todayStr) events.push({ type: 'discharge', name: r.name, category: '수급자' })
    })
    staffList.forEach(s => {
      if (s.hireDate   === todayStr) events.push({ type: 'hire',   name: s.name, category: '직원' })
      if (s.resignDate === todayStr) events.push({ type: 'resign', name: s.name, category: '직원' })
    })
    return events
  }, [residents, staffList])

  // ── 집계 ───────────────────────────────────────────────────────────────
  const activeResidents = residents.filter(r => r.status === 'active').length
  const activeStaff     = staffList.filter(s => s.status === 'active').length

  // 요양보호사 배치기준(2.1:1) — ADMIN·시설장 전용
  const isManagerView = authUser?.role === 'ADMIN' || authUser?.position === '시설장'
  const CAREGIVER_RATIO = 2.1
  const staffing = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const now = new Date(), y = now.getFullYear(), m = now.getMonth()
    let total = 0, days = 0
    for (let d = new Date(y, m, 1); d <= now; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const cnt = residents.filter(r => {
        if (!r.admissionDate || r.admissionDate > iso) return false
        if (r.dischargeDate) return r.dischargeDate >= iso
        return r.status !== 'discharged'   // 퇴소인데 퇴소일 미기재 → 재원으로 세지 않음
      }).length
      total += cnt; days++
    }
    const avg = days ? total / days : activeResidents
    const isCg = (p?: string) => { const q = (p ?? '').replace(/\s/g, ''); return q === '요양보호사' || q === '요양팀장' || q === '요양보호원' || q.includes('요양보호') }
    const tISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const onLeaveNow = (st: any) => (st.leaves ?? []).some((l: any) => l.start && l.start <= tISO && (!l.end || l.end >= tISO))
    const caregivers = staffList.filter(s => s.status === 'active' && isCg(s.position) && !onLeaveNow(s)).length
    const requiredExact = avg / CAREGIVER_RATIO
    const requiredMin = Math.ceil(requiredExact - 1e-9)
    const shortfall = Math.max(0, requiredMin - caregivers)
    return { avg, caregivers, requiredExact, requiredMin, shortfall }
  }, [residents, staffList, activeResidents])
  // 주기별 완료 현황의 분모 → 반복(RECURRING) 항목만. 입소·퇴소·입사·일회성 티켓 제외
  const totalActive     = checklists.filter(c => c.active && (RECURRING as readonly string[]).includes(c.frequency)).length
  const totalDone       = occurrences.length > 0
    ? occurrences.filter(o =>
        o.status === 'completed' &&
        !['on_admission', 'on_discharge', 'on_hire'].includes(o.frequency) &&
        o.scheduledDate <= todayStr && o.dueDate >= todayStr).length
    : 0

  const [toggling, setToggling] = useState<string | null>(null)

  const handleToggle = async (occId: string, itemId: string) => {
    setToggling(occId || itemId)
    try {
      if (occId) await completeOccurrence(occId, todayStr)
      else await toggleComplete(itemId)
    } finally { setToggling(null) }
  }

  const greetHour = parseInt(new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', hour:'numeric', hour12:false }).format(new Date()))
  const greet = greetHour < 12 ? '좋은 아침입니다' : greetHour < 18 ? '안녕하세요' : '수고 많으셨습니다'

  // ── 처리 대기 항목 (결재·확인)
  const pendingItems = [
    { show: can('/expense') && pending.expense > 0, label: '지출결의 승인 대기', value: pending.expense, unit: '건', to: '/expense', icon: Receipt, tone: 'emerald' as const },
    { show: can('/eval/albums') && pending.album > 0, label: '앨범 사진 승인 대기', value: pending.album, unit: '장', to: '/eval/albums', icon: ImageIcon, tone: 'blue' as const },
    { show: can('/contacts') && (siteStats?.pendingContacts ?? 0) > 0, label: '대기 중인 상담', value: siteStats?.pendingContacts ?? 0, unit: '건', to: '/contacts', icon: MessageSquare, tone: 'orange' as const },
    { show: canApproveLeave && pending.leave > 0, label: '휴무 신청 승인 대기', value: pending.leave, unit: '건', to: '/work-schedule', icon: CalendarClock, tone: 'emerald' as const },
    { show: canApproveLeave && pending.swap > 0, label: '근무 맞교대 승인 대기', value: pending.swap, unit: '건', to: '/work-schedule', icon: ArrowLeftRight, tone: 'blue' as const },
    { show: canVisit && pending.visit > 0, label: '면회 예약 확인 대기', value: pending.visit, unit: '건', to: '/schedule', icon: CalendarClock, tone: 'orange' as const },
    { show: can('/staff-hr') && pending.refund > 0, label: '카드키 보증금 이체 대기', value: pending.refund, unit: '건', to: '/staff-hr', icon: Receipt, tone: 'emerald' as const },
  ].filter(i => i.show)

  const runningTasks = todayTasks.filter(t => t.inProgress).slice(0, 2)

  /* ══════════════════ 섹션 정의 (모바일/데스크톱 공통, 순서만 분기) ══════════════════ */

  // 인사말 — 모바일은 압축
  const secGreeting = (
    <div className="flex items-start justify-between flex-wrap gap-2 md:gap-3">
      <div className="min-w-0">
        <p className="text-[11px] md:text-sm text-gray-400 font-medium">
          {new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mt-0.5">{greet} 👋</h1>
        <p className="hidden md:block text-sm text-gray-500 mt-0.5">행복한요양원 오늘의 현황입니다</p>
      </div>
      {todayPersonEvents.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {todayPersonEvents.map((ev, i) => (
            <span key={i} className={`flex items-center gap-1.5 text-[11px] md:text-xs font-semibold px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border ${
              ev.type==='admission' ? 'bg-teal-50 text-teal-700 border-teal-200' :
              ev.type==='discharge' ? 'bg-gray-100 text-gray-600 border-gray-200' :
              ev.type==='hire'      ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
              'bg-orange-50 text-orange-700 border-orange-200'
            }`}>
              {ev.type==='admission' && <LogIn size={11}/>}
              {ev.type==='discharge' && <LogOut size={11}/>}
              {ev.type==='hire'      && <UserPlus size={11}/>}
              {ev.type==='resign'    && <UserMinus size={11}/>}
              {ev.name} {ev.category} {ev.type==='admission'?'입소':ev.type==='discharge'?'퇴소':ev.type==='hire'?'입사':'퇴사'}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  // 현황 뱃지 — 모바일 2×2 그리드 / 데스크톱 한 줄
  const secBadges = (
    <div className="grid grid-cols-2 gap-1.5 md:flex md:items-center md:flex-wrap">
      {canChecklist && <StatBadge label="오늘 미완료" value={todayTasks.length}
        tone={urgentTasks.length > 0 ? 'red' : todayTasks.length > 0 ? 'orange' : 'green'}
        extra={urgentTasks.length > 0 ? `위험 ${urgentTasks.length}` : undefined}
        icon={<ClipboardList size={12}/>} onClick={() => navigate('/eval/checklist')}/>}
      {canResidents && <StatBadge label="입소 수급자" value={activeResidents} unit="명" tone="teal"
        extra={siteStats ? `전체 ${siteStats.totalResidents}` : undefined}
        icon={<Users size={12}/>} onClick={() => navigate('/eval/residents')}/>}
      {canStaffList && <StatBadge label="재직 직원" value={activeStaff} unit="명" tone="indigo"
        extra={loadingSite ? undefined : `전체 ${siteStats?.totalStaff ?? 0}`}
        icon={<UserCog size={12}/>} onClick={() => navigate('/eval/staff')}/>}
      {canResidents && <StatBadge label="이번 달 입소" value={siteStats?.monthlyAdmissions ?? 0} unit="명" tone="purple"
        icon={<UserPlus size={12}/>} onClick={() => navigate('/eval/residents')}/>}
    </div>
  )

  // 다가오는 일정 — 모바일은 4건(엄지 한 스크롤 내 유지), 데스크톱 6건
  const secSchedule = can('/schedule') ? <UpcomingSchedule limit={isMobile ? 4 : 6} days={45} /> : null

  // 처리 대기 — 모바일은 비었을 때 렌더하지 않음(빈 카드로 화면 낭비 방지)
  const hasPendingScope = can('/expense') || can('/eval/albums') || can('/contacts') || canApproveLeave || canVisit
  const secPending = (!hasPendingScope || (isMobile && pendingItems.length === 0)) ? null : (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Inbox size={15} className="text-gray-500" />
        <h2 className="text-sm font-bold text-gray-700">처리 대기</h2>
        {pendingItems.length > 0 && <span className="text-xs font-bold text-white bg-gray-800 rounded-full px-2 py-0.5">{pendingItems.reduce((a, b) => a + b.value, 0)}</span>}
      </div>
      {pendingItems.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm text-gray-400 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-400" /> 지금 결재·확인할 대기 항목이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {pendingItems.map(it => <ActionCard key={it.to} {...it} onClick={() => navigate(it.to)} />)}
        </div>
      )}
    </section>
  )

  // 진행 중인 업무 (착수 건만, 최대 2건)
  const secRunning = (!canChecklist || runningTasks.length === 0) ? null : (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          진행 중인 업무
          <span className="text-[11px] font-semibold text-gray-400">{todayTasks.filter(t => t.inProgress).length}건</span>
        </h2>
        <button onClick={() => navigate('/eval/checklist')} className="text-[11px] font-semibold text-gray-400 hover:text-gray-700">
          체크리스트 ›
        </button>
      </div>

      {runningTasks.map(t => {
        const overdue = t.daysOverdue > 0
        const high = t.riskLevel === 'high'
        return (
          <div key={t.occId || t.itemId}
            className={`flex items-center gap-3 p-3 md:p-3.5 rounded-2xl border shadow-sm bg-white transition-colors ${
              overdue ? 'border-red-200' : 'border-blue-200'
            }`}>
            <button onClick={() => handleToggle(t.occId, t.itemId)} disabled={toggling === (t.occId || t.itemId)}
              title="완료 처리" aria-label="완료 처리"
              className="w-11 h-11 md:w-9 md:h-9 shrink-0 rounded-xl border border-blue-100 bg-blue-50 text-blue-400 hover:bg-primary-orange hover:text-white hover:border-primary-orange flex items-center justify-center transition-colors disabled:opacity-50">
              {toggling === (t.occId || t.itemId) ? <Loader2 size={15} className="animate-spin"/> : <Check size={16} strokeWidth={3}/>}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {high && <AlertTriangle size={13} className="text-red-500 shrink-0"/>}
                <p className="text-sm font-bold text-gray-900 truncate">{t.title}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">진행 중</span>
                {t.startedBy && <span className="text-[10px] text-blue-500 font-semibold">{t.startedBy} 착수</span>}
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {FREQUENCY_LABELS[t.frequency as keyof typeof FREQUENCY_LABELS] ?? t.frequency}
                </span>
                {overdue && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">{t.daysOverdue}일 지남</span>}
                {!overdue && t.isOneTime && t.daysLeft != null && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.daysLeft <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.daysLeft === 0 ? '오늘 마감' : `D-${t.daysLeft}`}
                  </span>
                )}
                {t.personName && <span className="text-[10px] font-semibold text-purple-600">👤 {t.personName}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )

  const secNotices = <NoticeBoard />
  const secDocs = can('/resident-docs') ? <UpcomingDocs /> : null

  // 일일 업무 체크 — 모바일 최우선 액션
  const secDaily = !canChecklist ? null : (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={15} className="text-primary-orange shrink-0"/>
          <h2 className="text-sm font-bold text-gray-800 shrink-0">일일 업무 체크</h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
            dailyTasks.length===0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {dailyTasks.length===0 ? '✓ 완료' : `${dailyTasks.length}건`}
          </span>
        </div>
        <button onClick={() => navigate('/eval/checklist')} className="text-xs text-gray-400 hover:text-primary-orange flex items-center gap-0.5 shrink-0">
          전체보기<ChevronRight size={13}/>
        </button>
      </div>
      {dailyTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 md:py-10">
          <CheckCircle2 size={32} className="mb-2 text-green-400"/>
          <p className="text-sm font-medium text-green-600">일일 업무 모두 완료!</p>
          {totalDone > 0 && <p className="text-xs text-gray-400 mt-1">오늘 완료 {totalDone}건</p>}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {dailyTasks.slice(0, 5).map(task => (
            <DailyTaskRow
              key={task.occId || task.itemId}
              task={task}
              toggling={toggling}
              onToggle={() => handleToggle(task.occId, task.itemId)}
              onClick={() => navigate('/eval/checklist')}
            />
          ))}
          {dailyTasks.length > 5 && (
            <button onClick={() => navigate('/eval/checklist')}
              className="w-full py-3 text-xs text-center text-gray-400 hover:text-primary-orange hover:bg-orange-50 transition-colors">
              +{dailyTasks.length - 5}건 더 보기
            </button>
          )}
        </div>
      )}
    </section>
  )

  // 정기 업무
  const secPeriodic = (!canChecklist || nonDailyTasks.length === 0) ? null : (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp size={15} className="text-indigo-500 shrink-0"/>
          <h2 className="text-sm font-bold text-gray-800 truncate">진행 중인 정기 업무</h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shrink-0">
            {nonDailyTasks.length}건
          </span>
        </div>
        <button onClick={() => navigate('/eval/checklist')} className="text-xs text-gray-400 hover:text-indigo-500 flex items-center gap-0.5 shrink-0">
          전체보기<ChevronRight size={13}/>
        </button>
      </div>
      <div className="p-3 md:p-4">
        {(['weekly','monthly','quarterly','half-yearly','yearly'] as const).map(freq => {
          const tasks = nonDailyTasks.filter(t => t.frequency === freq)
          if (tasks.length === 0) return null
          const label = FREQUENCY_LABELS[freq]
          const hasUrgent = tasks.some(t => t.riskLevel === 'high')
          return (
            <button key={freq} onClick={() => navigate('/eval/checklist')}
              className={`w-full flex items-center gap-2.5 md:gap-3 px-3 md:px-4 py-3 rounded-xl mb-2 text-left transition-colors hover:brightness-95 ${
                hasUrgent ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'
              }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${
                hasUrgent ? 'bg-red-100' : 'bg-indigo-100'
              }`}>
                {freq==='weekly'?'주':freq==='monthly'?'월':freq==='quarterly'?'분':freq==='half-yearly'?'반':'연'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {tasks.map(t => t.title).slice(0, 2).join(', ')}
                  {tasks.length > 2 ? ` 외 ${tasks.length - 2}건` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  hasUrgent ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {tasks.length}건
                </span>
                {hasUrgent && <span className="text-[10px] text-red-500 font-medium">⚠ 위험</span>}
              </div>
              <ChevronRight size={14} className="text-gray-300 flex-shrink-0"/>
            </button>
          )
        })}
      </div>
    </section>
  )

  // 이벤트 미완료 누적
  const secEvents = (!canChecklist || eventPendingTasks.length === 0) ? null : (
    <section className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 border-b border-purple-50 bg-purple-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={14} className="text-purple-500 shrink-0"/>
          <h2 className="text-sm font-bold text-gray-800 truncate">입소·입사 관련 미완료</h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
            {eventPendingTasks.length}건
          </span>
        </div>
        <button onClick={() => navigate('/eval/checklist')} className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-0.5 shrink-0">
          전체보기<ChevronRight size={13}/>
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {eventPendingTasks.slice(0, 5).map(task => (
          <EventTaskRow key={task.occId || task.itemId} task={task} onClick={() => navigate('/eval/checklist')}/>
        ))}
        {eventPendingTasks.length > 5 && (
          <button onClick={() => navigate('/eval/checklist')}
            className="w-full py-3 text-xs text-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors">
            +{eventPendingTasks.length - 5}건 더 보기
          </button>
        )}
      </div>
    </section>
  )

  // 최근 시설소식
  const secNews = (!can('/facility-news') || recentNews.length === 0) ? null : (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Megaphone size={14} className="text-orange-500"/>
          <h2 className="text-sm font-bold text-gray-800">최근 시설소식</h2>
        </div>
        <button onClick={() => navigate('/facility-news')} className="text-xs text-gray-400 hover:text-orange-600 flex items-center gap-0.5">전체보기<ChevronRight size={13}/></button>
      </div>
      <div className="space-y-1.5">
        {recentNews.map(n => {
          const dt = n.published_at || n.created_at
          const ds = dt ? (() => { const d = new Date(dt); return `${d.getMonth()+1}.${d.getDate()}` })() : ''
          return (
            <button key={n.id} onClick={() => navigate('/facility-news')} className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg hover:bg-gray-50 text-left">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">{n.category}</span>
              <span className="text-sm text-gray-700 truncate flex-1">{n.title}</span>
              <span className="text-[11px] text-gray-400 shrink-0">{ds}</span>
            </button>
          )
        })}
      </div>
    </section>
  )

  // 주기별 완료 현황
  const secProgress = !canChecklist ? null : (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} className="text-primary-orange"/>
        <h2 className="text-sm font-bold text-gray-800">주기별 완료 현황</h2>
      </div>
      {periodProgress.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">체크리스트가 없습니다</p>
      ) : (
        <div className="space-y-2.5">
          {periodProgress.map(p => {
            const urgent = p.rate < 100 && p.daysLeft <= 3
            return (
              <div key={p.freq}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">{FREQUENCY_LABELS[p.freq]}</span>
                  <div className="flex items-center gap-1.5">
                    {urgent && p.done < p.total && p.daysLeft > 0 && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">D-{p.daysLeft}</span>
                    )}
                    {p.done < p.total && p.daysLeft === 0 && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">오늘 마감</span>
                    )}
                    <span className={`text-xs font-bold ${p.done===p.total?'text-green-600':urgent?'text-red-500':'text-orange-500'}`}>
                      {p.done}/{p.total}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-2 rounded-full transition-all ${p.done===p.total?'bg-green-500':urgent?'bg-red-400':'bg-primary-orange'}`}
                    style={{ width:`${p.rate}%` }}/>
                </div>
              </div>
            )
          })}
          <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">전체 활성 항목</span>
            <span className="text-xs font-bold text-gray-700">{totalActive}건</span>
          </div>
        </div>
      )}
    </section>
  )

  // 운영 현황
  const secOps = !(canResidents || canStaffList) ? null : (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-primary-orange"/>
        <h2 className="text-sm font-bold text-gray-800">운영 현황</h2>
      </div>
      {loadingSite ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-primary-orange border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : siteStats ? (
        <div className="grid grid-cols-2 gap-x-4 md:grid-cols-1 md:gap-x-0 md:space-y-2">
          <SiteStatRow label="전체 입소자"     value={siteStats.totalResidents}  unit="명"/>
          <SiteStatRow label="활동 중 입소자"  value={siteStats.activeResidents}  unit="명" highlight/>
          <SiteStatRow label="재직 직원"       value={siteStats.totalStaff}       unit="명"/>
          <SiteStatRow label="대기 상담"       value={siteStats.pendingContacts}  unit="건" alert={siteStats.pendingContacts > 0}/>
          <SiteStatRow label="오늘 입소"       value={siteStats.todayAdmissions}  unit="명"/>
          <SiteStatRow label="이번 달 입소"    value={siteStats.monthlyAdmissions} unit="명"/>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-4">불러올 수 없습니다</p>
      )}
    </section>
  )

  // 요양보호사 인력배치 요약 (ADMIN·시설장)
  const secStaffing = !isManagerView ? null : (
    <button onClick={() => navigate('/staffing')}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-indigo-200 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0"><UserCog size={18} className="text-indigo-600"/></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">요양보호사 인력배치 (2.1:1)</p>
          <p className="text-[11px] text-gray-400 truncate">월 평균 입소자 {staffing.avg.toFixed(1)}명 기준 · 예상값</p>
        </div>
        <span className="hidden md:inline text-xs font-semibold text-indigo-600 whitespace-nowrap">시뮬레이터 &rsaquo;</span>
        <ChevronRight size={16} className="md:hidden text-gray-300 shrink-0"/>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-2 md:flex md:justify-end md:gap-6">
        <div className="md:text-center">
          <p className="text-[11px] text-gray-400">현재 / 필요</p>
          <p className="text-lg font-extrabold text-gray-800">{staffing.caregivers} / {staffing.requiredMin}<span className="text-xs font-bold text-gray-400">명</span></p>
        </div>
        <div className="md:text-center">
          <p className="text-[11px] text-gray-400">추가 필요</p>
          <p className={`text-lg font-extrabold ${staffing.shortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>{staffing.shortfall}<span className="text-xs font-bold text-gray-400">명</span></p>
        </div>
      </div>
      {staffing.shortfall > 0 && <p className="text-[11px] text-red-500 mt-2">⚠ 현재 입소자 기준 요양보호사 {staffing.shortfall}명이 부족합니다. 입소·채용 전 시뮬레이터로 확인하세요.</p>}
    </button>
  )

  const secChart = canResidents ? <ResidentTrendChart residents={residents} months={isMobile ? 6 : 12} /> : null
  // 오늘자 인수인계 업로드가 있을 때만 렌더(권한 없으면 자동 숨김)
  const secHandover = <HandoverTodayCard />

  /* ══════════════════ 모바일 레이아웃 (< md) ══════════════════
     인사말 → 현황 → 다가오는 일정(4건) → 진행 중 → 처리 대기 → 내부 공지 → 어르신 서류
     → 일일 업무 체크 → 정기/이벤트 → 인력배치 → 추이 → 참고지표 */
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        {secGreeting}
        {secBadges}
        {secHandover}
        {secSchedule}
        {secRunning}
        {secPending}
        {secNotices}
        {secDocs}
        {secDaily}
        {secPeriodic}
        {secEvents}
        {secStaffing}
        {secChart}
        {secNews}
        {secProgress}
        {secOps}
      </div>
    )
  }

  /* ══════════════════ 데스크톱 레이아웃 (≥ md) ══════════════════ */
  return (
    <div className="space-y-6">
      {secGreeting}
      {secBadges}
      {secHandover}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">{secSchedule}</div>
        <div className="lg:col-span-1">{secPending}</div>
      </div>

      {secRunning}
      {secDocs}

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {secDaily}
          {secPeriodic}
          {secEvents}
        </div>
        <div className="lg:col-span-2 space-y-4">
          {secNotices}
          {secNews}
          {secProgress}
          {secOps}
        </div>
      </div>

      {secStaffing}
      {secChart}
    </div>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────

function ActionCard({ label, value, unit, icon: Icon, tone, onClick }: {
  label: string; value: number; unit: string
  icon: React.ElementType; tone: 'emerald' | 'blue' | 'orange'
  onClick?: () => void; show?: boolean; to?: string
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all p-4 text-left w-full">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tones[tone] ?? 'bg-gray-50 text-gray-500'}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-700 truncate">{label}</p>
        <p className="text-xl font-extrabold text-gray-900 leading-tight">{value}<span className="text-sm font-bold text-gray-400 ml-0.5">{unit}</span></p>
      </div>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </button>
  )
}


/* 초압축 현황 뱃지 — 한 줄에 나열 */
function StatBadge({ label, value, unit, extra, tone, icon, onClick }: {
  label: string; value: number; unit?: string; extra?: string
  tone: 'red' | 'orange' | 'green' | 'teal' | 'indigo' | 'purple'
  icon: React.ReactNode; onClick?: () => void
}) {
  const T = {
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    teal:   'bg-teal-50 border-teal-200 text-teal-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  }[tone]
  return (
    <button onClick={onClick}
      className={`w-full md:w-auto inline-flex items-center gap-1.5 pl-2 pr-2.5 py-2 md:py-1.5 rounded-xl border text-xs transition-all hover:shadow-sm ${T}`}>
      <span className="opacity-70 shrink-0">{icon}</span>
      <span className="font-semibold opacity-80 truncate">{label}</span>
      <span className="font-extrabold text-sm ml-auto md:ml-0 shrink-0">{value}{unit}</span>
      {extra && <span className="hidden md:inline text-[10px] font-semibold opacity-60 border-l border-current/20 pl-1.5 ml-0.5 shrink-0">{extra}</span>}
    </button>
  )
}


function DailyTaskRow({ task, toggling, onToggle, onClick }: {
  task: TodayTask; toggling: string | null; onToggle: ()=>void; onClick: ()=>void
}) {
  const isBusy = toggling === (task.occId || task.itemId)
  return (
    <div className="flex items-center gap-1 md:gap-3 px-2 md:px-5 py-1.5 md:py-3 hover:bg-orange-50/30 transition-colors">
      {/* 토글 버튼 — 시각 20px, 터치영역 44px (WCAG 2.5.8 / HIG 44pt) */}
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        disabled={isBusy}
        aria-label="완료 처리"
        className="w-11 h-11 md:w-9 md:h-9 -ml-1 md:ml-0 shrink-0 flex items-center justify-center rounded-full active:bg-orange-100 transition-colors disabled:opacity-50">
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          isBusy ? 'border-primary-orange' : 'border-gray-300 hover:border-primary-orange hover:bg-orange-50'
        }`}>
          {isBusy && <div className="w-2.5 h-2.5 border border-primary-orange border-t-transparent rounded-full animate-spin"/>}
        </span>
      </button>
      {/* 내용 */}
      <div className="flex-1 min-w-0 cursor-pointer py-1.5 md:py-0" onClick={onClick}>
        <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.personName && <span className="text-[10px] text-purple-500 font-medium">👤 {task.personName}</span>}
          {task.assignee && !task.personName && <span className="text-[10px] text-gray-400">{task.assignee}</span>}
          {task.daysOverdue > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              task.daysOverdue>=7 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
            }`}>{task.daysOverdue}일 지남</span>
          )}
        </div>
      </div>
      {task.riskLevel==='high' && <AlertTriangle size={13} className="text-red-400 flex-shrink-0"/>}
    </div>
  )
}


function EventTaskRow({ task, onClick }: { task: TodayTask; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full min-h-[44px] flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-purple-50/40 text-left transition-colors">
      <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0"/>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400">{FREQUENCY_LABELS[task.frequency] ?? task.frequency}</span>
          {task.personName && <span className="text-[10px] text-purple-500 font-medium">👤 {task.personName}</span>}
        </div>
      </div>
      {task.daysOverdue > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
          task.daysOverdue>=14 ? 'bg-red-100 text-red-600' : task.daysOverdue>=7 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
        }`}>{task.daysOverdue}일째</span>
      )}
    </button>
  )
}

function SiteStatRow({ label, value, unit, highlight, alert }: {
  label:string; value:number; unit:string; highlight?:boolean; alert?:boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5 md:py-1 border-b border-gray-50 md:border-0 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${alert?'text-orange-500':highlight?'text-primary-orange':'text-gray-800'}`}>
        {value}<span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
      </span>
    </div>
  )
}
