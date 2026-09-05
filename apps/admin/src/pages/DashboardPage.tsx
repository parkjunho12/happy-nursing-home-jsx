import { useEffect, useState, useMemo } from 'react'
import MyDayCard from '@/components/dashboard/MyDayCard'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserCog, MessageSquare, TrendingUp, Calendar,
  AlertTriangle, CheckCircle2, Clock, ChevronRight,
  LogIn, LogOut, UserPlus, UserMinus, ClipboardList,
  Receipt, Image as ImageIcon, Inbox, Megaphone, Loader2, Check , CalendarClock, ArrowLeftRight, CalendarCheck} from 'lucide-react'
import { dashboardAPI, apiClient } from '@/api/client'
import { adminRoutineAPI, type RoutineItem, type RoutineMonth } from '@/api/adminRoutineClient'
import { expenseAPI } from '@/api/expenseClient'
import { scheduleAPI } from '@/api/scheduleClient'
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
import { RECURRING, FREQUENCY_LABELS, getPeriodEnd, todayKST, todayDateKST, getCurrentPeriodKey, daysFromToday , isItemDone } from '@/utils/period'

// ── 타입 ──────────────────────────────────────────────────────────────────
interface TodayTask {
  occId: string
  itemId: string
  title: string
  frequency: string
  riskLevel: string
  personName?: string
  personId?: string
  personType?: string
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
  const [pending, setPending] = useState<{ expense: number; album: number; leave: number; swap: number; visit: number; refund: number; returning: number }>({ expense: 0, album: 0, leave: 0, swap: 0, visit: 0, refund: 0, returning: 0 })
  const [expiringContracts, setExpiringContracts] = useState(0)
  const [recentNews, setRecentNews] = useState<FacilityNews[]>([])

  const { checklists, occurrences, residents, staffList, loadAll, toggleComplete, completeOccurrence } = useLtcStore()

  useEffect(() => { if (canResidents || canStaffList || can('/contacts')) loadSiteStats() }, [canResidents, canStaffList])
  useEffect(() => { loadPending() }, [])
  // 갱신 임박 계약 (45일 이내) — 운영·계약 권한자만
  useEffect(() => {
    if (authUser?.role !== 'ADMIN') return
    import('@/api/operationsClient').then(({ operationsAPI }) =>
      operationsAPI.contracts().then(list => {
        const n = list.filter(c => {
          if (!c.active || c.section === '업체' || !c.end_date) return false
          const m = String(c.end_date).match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
          if (!m) return false
          const d = Math.round((new Date(+m[1], +m[2] - 1, +m[3]).getTime() - Date.now()) / 86400000)
          return d <= 45
        }).length
        setExpiringContracts(n)
      }).catch(() => {}))
  }, [authUser])
  useEffect(() => { loadAll() }, [loadAll])

  const loadSiteStats = async () => {
    try {
      setLoadingSite(true)
      const res = await dashboardAPI.stats()
      setSiteStats(res || null)
    } catch (e) { console.error(e) }
    finally { setLoadingSite(false) }
  }

  // 크로스 기능 '처리 대기' 카운트 — 권한 없으면 0으로 폴백(대시보드에 영향 없음)
  // 월간 업무 — 매달 반복되는 신고·납부·보고. 대시보드에는 급한 5건만 낸다.
  const [routine, setRoutine] = useState<RoutineMonth | null>(null)
  const [loadingRoutine, setLoadingRoutine] = useState(true)
  const [routineBusy, setRoutineBusy] = useState<string | null>(null)
  const showRoutine = allowed.has('/monthly-routines')
  useEffect(() => {
    if (!showRoutine) { setLoadingRoutine(false); return }
    const ym = new Date().toISOString().slice(0, 7)
    adminRoutineAPI.month(ym)
      .then(setRoutine).catch(() => setRoutine(null))
      .finally(() => setLoadingRoutine(false))
  }, [showRoutine])

  const routineLeft = useMemo(() => (routine?.items ?? []).filter(i => !i.done), [routine])
  const routineOverdue = routineLeft.filter(i => i.overdue).length
  /** 급한 순 5건 — 지난 것 먼저, 그 다음 날짜가 가까운 순.
   *  다 끝냈으면 그날 한 것을 보여준다(빈 칸보다 낫다). */
  const routineCards = useMemo(() => {
    const left = [...routineLeft].sort((a, b) =>
      Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date))
    if (left.length > 0) return left.slice(0, 5)
    return [...(routine?.items ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  }, [routineLeft, routine])
  const routineRest = Math.max(0, (routineLeft.length || routine?.total || 0) - routineCards.length)
  const routineDday = (date: string) => {
    const today = routine?.today ?? new Date().toISOString().slice(0, 10)
    return Math.max(0, Math.round(
      (new Date(date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000))
  }
  /** 대시보드에서 바로 체크 — 그 줄만 고친다(목록을 다시 불러오면 화면이 튄다) */
  const toggleRoutine = async (it: RoutineItem) => {
    const next = !it.done
    const patch = (done: boolean) => setRoutine(d => {
      if (!d) return d
      const items = d.items.map(x =>
        x.id !== it.id ? x : { ...x, done, overdue: !done && x.date < d.today })
      return { ...d, items, done_count: items.filter(x => x.done).length }
    })
    setRoutineBusy(it.id); patch(next)
    try { await adminRoutineAPI.setDone(it.id, { month: it.date.slice(0, 7), done: next }) }
    catch (e: any) { patch(it.done); alert(e?.message ?? '저장 실패') }
    finally { setRoutineBusy(null) }
  }

  const isAdmin = authUser?.role === 'ADMIN'
  // 요양보호사는 앱을 열자마자 '오늘 무슨 근무 · 무슨 일과 · 누구를 맡는가' 를
  // 봐야 한다. 그 아래에 있는 것들은 오늘 손이 가는 일이 아니다.
  const isCaregiver = authUser?.role !== 'ADMIN'
    && ['요양보호사', '요양팀장'].includes(authUser?.position ?? '')
  const canApproveLeave = authUser?.role === 'ADMIN' || authUser?.position === '시설장'
  const canVisit = authUser?.role === 'ADMIN' || ['시설장', '사회복지사'].includes(authUser?.position ?? '')
  const loadPending = async () => {
    const [exp, alb, news, lv, sw, vs, rf, rt] = await Promise.all([
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
      // 귀원 미기록 — 시작일이 지난 외출·외박·외래 중 실제 귀원이 안 적힌 건
      can('/schedule')
        ? (() => {
            const now2 = new Date(Date.now() + 9 * 3600e3)
            const start = new Date(now2); start.setDate(start.getDate() - 14)
            return scheduleAPI.events({ start_date: start.toISOString().slice(0, 10), end_date: now2.toISOString().slice(0, 10) })
              .then(rows => rows.filter((e: any) => ['외출', '외박', '외래·병원'].includes(e.category)
                && e.status !== 'canceled' && !e.returned_at
                && (e.start_at ?? '').slice(0, 10) <= now2.toISOString().slice(0, 10)).length)
              .catch(() => 0)
          })()
        : Promise.resolve(0),
    ])
    setPending({ expense: exp, album: alb, leave: lv, swap: sw, visit: vs, refund: rf, returning: rt })
    setRecentNews(news)
  }

  // ── occurrence 기반: 오늘 해야 할 것 ────────────────────────────────────
  // pending/overdue 중 due_date <= 오늘인 occurrence = 해야 하는데 안 한 것
  const { todayTasks, urgentTasks, admissionTasks, hireTasks } = useMemo(() => {
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

          const isEvent = ['on_admission', 'on_discharge', 'on_hire', 'on_resign'].includes(o.frequency)
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
            personId: item.personId,
            personType: item.personType,
            assignee: item.assignee,
            isEvent,
            daysOverdue,
            isOneTime: o.frequency === 'one_time',
            daysLeft,
            inProgress: o.status === 'in_progress',
            startedBy: o.startedBy,
          }

          if (!isEvent) {   // 이벤트(입소·입사)는 아래에서 상세 페이지와 동일 기준으로 따로 계산
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
          const isEvent = ['on_admission', 'on_discharge', 'on_hire', 'on_resign'].includes(c.frequency)
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
            personId: c.personId,
            personType: c.personType,
            assignee: c.assignee,
            isEvent,
            daysOverdue: 0,
          }
          if (!isEvent) {
            todayT.push(task)
            if (c.riskLevel === 'high') urgentT.push(task)
          }
        })
    }

    // ── 이벤트(입소·퇴소·입사) 미완료 — 수급자 상세 페이지와 완전히 같은 기준(isItemDone) ──
    checklists
      .filter(c => c.active && ['on_admission', 'on_discharge', 'on_hire', 'on_resign'].includes(c.frequency))
      .filter(c => !isItemDone(c))
      .forEach(c => {
        eventT.push({
          occId: '', itemId: c.id, title: c.title, frequency: c.frequency,
          riskLevel: c.riskLevel, personName: c.personName,
          personId: c.personId, personType: c.personType,
          assignee: c.assignee, isEvent: true,
          daysOverdue: c.dueDate ? Math.max(0, -daysFromToday(c.dueDate)) : 0,
        })
      })

    const sorted = eventT.sort((a, b) => b.daysOverdue - a.daysOverdue)
    return {
      todayTasks:        todayT.sort((a, b) => (b.riskLevel==='high'?1:0)-(a.riskLevel==='high'?1:0)),
      urgentTasks:       urgentT,
      admissionTasks:    sorted.filter(t => t.frequency !== 'on_hire' && t.frequency !== 'on_resign'),
      hireTasks:         sorted.filter(t => t.frequency === 'on_hire' || t.frequency === 'on_resign'),
    }
  }, [occurrences, checklists])


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

  const [toggling, setToggling] = useState<string | null>(null)

  // 나에게 할당된 업무 — 지연 먼저, 그다음 D-day 가까운 순 (최대 6개)
  const myTasks = useMemo(() => {
    if (!authUser?.id) return [] as (TodayTask & { dueDate: string })[]
    const itemMap = new Map(checklists.map(c => [c.id, c]))
    const latest = new Map<string, typeof occurrences[0]>()
    occurrences
      .filter(o => o.status === 'pending' || o.status === 'overdue' || o.status === 'in_progress')
      .filter(o => o.frequency === 'one_time' || o.status === 'overdue' || (o.scheduledDate <= todayStr && o.dueDate >= todayStr))
      .forEach(o => {
        const ex = latest.get(o.checklistItemId)
        if (!ex || o.dueDate > ex.dueDate) latest.set(o.checklistItemId, o)
      })
    const out: (TodayTask & { dueDate: string })[] = []
    latest.forEach(o => {
      const item = itemMap.get(o.checklistItemId)
      if (!item || !item.active) return
      if ((item as any).assigned_user_id !== authUser.id) return
      out.push({
        occId: o.id, itemId: item.id, title: item.title, frequency: item.frequency,
        riskLevel: item.riskLevel, personName: item.personName,
        personId: item.personId, personType: item.personType,
        assignee: item.assignee, isEvent: false,
        daysOverdue: Math.max(0, -daysFromToday(o.dueDate)),
        inProgress: o.status === 'in_progress',
        dueDate: o.dueDate,
      })
    })
    return out
      .sort((a, b) => (b.daysOverdue - a.daysOverdue) || a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6)
  }, [checklists, occurrences, authUser?.id, todayStr])

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
    { show: can('/schedule') && pending.returning > 0, label: '귀원 기록 대기 (외출·외박·외래)', value: pending.returning, unit: '건', to: '/schedule', icon: CalendarClock, tone: 'orange' as const },
    { show: can('/staff-hr') && pending.refund > 0, label: '카드키 보증금 이체 대기', value: pending.refund, unit: '건', to: '/staff-hr', icon: Receipt, tone: 'emerald' as const },
    { show: expiringContracts > 0, label: '갱신 임박 계약 (45일 이내)', value: expiringContracts, unit: '건', to: '/operations', icon: Receipt, tone: 'orange' as const },
  ].filter(i => i.show)

  const runningTasks = todayTasks.filter(t => t.inProgress).slice(0, 2)

  /* ══════════════════ 섹션 정의 (모바일/데스크톱 공통, 순서만 분기) ══════════════════ */

  // 인사말 — 모바일은 압축
  // 내 하루 — 요양보호사에게만. 다른 직종에게는 담당 어르신이 없어 빈 칸이 된다.
  const secMyDay = isCaregiver ? <MyDayCard /> : null

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
  // 나에게 할당된 업무 체크 — 지연 우선, D-day 오름차순 6개
  const secMine = !canChecklist ? null : (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={15} className="text-primary-orange shrink-0"/>
          <h2 className="text-sm font-bold text-gray-800 shrink-0">나에게 할당된 업무</h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
            myTasks.length === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {myTasks.length === 0 ? '✓ 완료' : `${myTasks.length}건`}
          </span>
        </div>
        <button onClick={() => navigate('/eval/checklist')} className="text-xs text-gray-400 hover:text-primary-orange flex items-center gap-0.5 shrink-0">
          전체보기<ChevronRight size={13}/>
        </button>
      </div>
      {myTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 md:py-10">
          <CheckCircle2 size={32} className="mb-2 text-green-400"/>
          <p className="text-sm font-medium text-green-600">내 담당 업무 모두 완료!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {myTasks.map(task => (
            <div key={task.occId || task.itemId} className="flex items-center gap-1 md:gap-3 px-2 md:px-4 py-1.5 md:py-2.5 hover:bg-orange-50/30 transition-colors">
              <button onClick={() => handleToggle(task.occId, task.itemId)} disabled={toggling === (task.occId || task.itemId)}
                aria-label="완료 처리"
                className="w-11 h-11 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full active:bg-orange-100 disabled:opacity-50">
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  toggling === (task.occId || task.itemId) ? 'border-primary-orange' : 'border-gray-300 hover:border-primary-orange hover:bg-orange-50'}`}>
                  {toggling === (task.occId || task.itemId) && <div className="w-2.5 h-2.5 border border-primary-orange border-t-transparent rounded-full animate-spin"/>}
                </span>
              </button>
              <div className="flex-1 min-w-0 cursor-pointer py-1"
                onClick={() => {
                  if (task.personType === 'resident' && task.personId) navigate(`/eval/residents/${task.personId}`)
                  else if (task.personType === 'staff' && task.personId) navigate(`/eval/staff/${task.personId}`)
                  else navigate('/eval/checklist')
                }}>
                <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">{FREQUENCY_LABELS[task.frequency] ?? task.frequency}</span>
                  {task.personName && <span className="text-[10px] text-purple-500 font-medium">👤 {task.personName}</span>}
                </div>
              </div>
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                task.daysOverdue > 0 ? 'bg-red-100 text-red-600'
                : daysFromToday(task.dueDate) === 0 ? 'bg-amber-100 text-amber-700'
                : daysFromToday(task.dueDate) <= 3 ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                {task.daysOverdue > 0 ? `지연 ${task.daysOverdue}일` : daysFromToday(task.dueDate) === 0 ? '오늘까지' : `D-${daysFromToday(task.dueDate)}`}
              </span>
              <ChevronRight size={13} className="text-gray-300 shrink-0"/>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  // 이벤트 미완료 — 입소(어르신)와 입사(직원)를 나눠서
  const canHire = authUser?.role === 'ADMIN' || ['대표', '이사', '시설장'].includes(authUser?.position ?? '')
  const eventSection = (tasks: TodayTask[], title: string, tone: 'purple' | 'sky') => {
    const T = tone === 'purple'
      ? { border: 'border-purple-100', headBd: 'border-purple-50', headBg: 'bg-purple-50/50', icon: 'text-purple-500', badge: 'bg-purple-100 text-purple-700', hover: 'hover:text-purple-600 hover:bg-purple-50' }
      : { border: 'border-sky-100', headBd: 'border-sky-50', headBg: 'bg-sky-50/50', icon: 'text-sky-500', badge: 'bg-sky-100 text-sky-700', hover: 'hover:text-sky-600 hover:bg-sky-50' }
    return (
      <section className={`bg-white rounded-2xl border ${T.border} shadow-sm overflow-hidden`}>
        <div className={`flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 border-b ${T.headBd} ${T.headBg}`}>
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={14} className={`${T.icon} shrink-0`}/>
            <h2 className="text-sm font-bold text-gray-800 truncate">{title}</h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${T.badge} shrink-0`}>
              {new Set(tasks.map(t => t.personId ?? t.personName)).size}명 · {tasks.length}건
            </span>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {(() => {
            // 사람별로 묶는다 — 한 어르신(직원)당 카드 하나, 최대 5장
            const byPerson = new Map<string, { name: string; tasks: TodayTask[] }>()
            tasks.forEach(t => {
              const key = t.personId ?? t.personName ?? '미지정'
              if (!byPerson.has(key)) byPerson.set(key, { name: t.personName ?? '이름 미상', tasks: [] })
              byPerson.get(key)!.tasks.push(t)
            })
            const groups = [...byPerson.entries()]
              .map(([key, g]) => ({
                key, name: g.name, count: g.tasks.length,
                worst: Math.max(...g.tasks.map(t => t.daysOverdue)),
                high: g.tasks.some(t => t.riskLevel === 'high'),
                sample: g.tasks[0],
              }))
              .sort((a, b) => b.worst - a.worst || b.count - a.count)
            const shown = groups.slice(0, 5)
            const rest = groups.length - shown.length
            return (
              <>
                {shown.map(g => (
                  <button key={g.key}
                    onClick={() => {
                      const t = g.sample
                      if (t.personType === 'resident' && t.personId) navigate(`/eval/residents/${t.personId}`)
                      else if (t.personType === 'staff' && t.personId) navigate(`/eval/staff/${t.personId}`)
                      else if (t.personType === 'staff') navigate('/eval/staff')
                      else navigate('/eval/checklist')
                    }}
                    className="w-full min-h-[44px] flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-gray-50 text-left transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${tone === 'purple' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>
                      {g.name[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {g.name}
                        {g.high && <AlertTriangle size={11} className="inline ml-1 text-red-400 align-[-1px]" />}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{g.sample.title.replace(`[${g.name}] `, '')}{g.count > 1 ? ` 외 ${g.count - 1}건` : ''}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${T.badge}`}>{g.count}건</span>
                    {g.worst > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        g.worst >= 14 ? 'bg-red-100 text-red-600' : g.worst >= 7 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                      }`}>{g.worst}일째</span>
                    )}
                    <ChevronRight size={13} className="text-gray-300 shrink-0" />
                  </button>
                ))}
                {rest > 0 && (
                  <button onClick={() => navigate(tasks[0]?.personType === 'staff' ? '/eval/staff' : '/eval/residents')}
                    className={`w-full py-3 text-xs text-center text-gray-400 transition-colors ${T.hover}`}>
                    +{rest}명 더 보기
                  </button>
                )}
              </>
            )
          })()}
        </div>
      </section>
    )
  }
  const secAdmission = (!canChecklist || admissionTasks.length === 0) ? null
    : eventSection(admissionTasks, '입소 관련 미완료', 'purple')
  const secHire = (!canChecklist || !canHire || hireTasks.length === 0) ? null
    : eventSection(hireTasks, '입사 관련 미완료', 'sky')

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

  // 월간 업무 (ADMIN 전용) — 매달 같은 날 반복되는 신고·납부·보고
  const secRoutine = !allowed.has('/monthly-routines') ? null : (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarCheck size={14} className="text-primary-orange shrink-0" />
          <h2 className="text-sm font-bold text-gray-800">이번 달 업무</h2>
          {routine && routine.total > 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
              routineOverdue > 0 ? 'bg-red-100 text-red-600'
                : routineLeft.length === 0 ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600'}`}>
              {routineLeft.length === 0 ? '다 했어요'
                : routineOverdue > 0 ? `지난 것 ${routineOverdue}건` : `${routineLeft.length}건 남음`}
            </span>
          )}
        </div>
        <button onClick={() => navigate('/monthly-routines')}
          className="text-xs text-gray-400 hover:text-primary-orange shrink-0">전체</button>
      </div>

      {loadingRoutine ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : routineCards.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">
          {routine && routine.total > 0
            ? '이번 달 업무를 모두 마쳤습니다'
            : '등록된 월간 업무가 없습니다'}
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {routineCards.map(it => (
            <div key={it.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors">
              <button onClick={() => toggleRoutine(it)} disabled={routineBusy === it.id}
                title={it.done ? '완료 취소' : '완료로 표시'}
                className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                  it.done ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-gray-300 hover:border-primary-orange'} disabled:opacity-40`}>
                {it.done && <Check size={12} strokeWidth={3} />}
              </button>
              <button onClick={() => navigate('/monthly-routines')}
                className="flex-1 min-w-0 text-left">
                <p className={`text-sm font-semibold truncate ${it.done ? 'text-gray-300 line-through' : 'text-gray-800'}`}>
                  {it.title}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {Number(it.date.slice(8, 10))}일 · {it.category}
                </p>
              </button>
              {!it.done && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  it.overdue ? 'bg-red-100 text-red-600'
                    : it.date === routine?.today ? 'bg-orange-100 text-orange-600'
                    : 'bg-gray-100 text-gray-500'}`}>
                  {it.overdue ? '지남' : it.date === routine?.today ? '오늘' : `D-${routineDday(it.date)}`}
                </span>
              )}
            </div>
          ))}
          {routineRest > 0 && (
            <button onClick={() => navigate('/monthly-routines')}
              className="w-full py-2.5 text-xs text-center text-gray-400 hover:text-primary-orange hover:bg-gray-50 transition-colors">
              나머지 {routineRest}건 더 보기
            </button>
          )}
        </div>
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
        {secMyDay}
        {secBadges}
        {secHandover}
        {secSchedule}
        {secRunning}
        {secPending}
        {secNotices}
        {secDocs}
        {secMine}
        {secAdmission}
          {secHire}
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
      {secMyDay}
      {secBadges}
      {secHandover}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">{secSchedule}</div>
        <div className="lg:col-span-1">{secPending}</div>
      </div>

      {secRunning}

      {/* ADMIN 은 '내가 오늘 할 일'이 먼저 보여야 한다.
          서류 현황(계획서·계약서)은 어르신별 진행 상황이라 그 아래로 내린다. */}
      {isAdmin && (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">{secMine}</div>
          <div className="lg:col-span-2">{secRoutine}</div>
        </div>
      )}

      {secDocs}

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {!isAdmin && secMine}
          {secAdmission}
          {secHire}
        </div>
        <div className="lg:col-span-2 space-y-4">
          {!isAdmin && secRoutine}
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
