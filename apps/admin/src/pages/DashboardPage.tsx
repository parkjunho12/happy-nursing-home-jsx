import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserCog, MessageSquare, TrendingUp, Calendar,
  AlertTriangle, CheckCircle2, Clock, ChevronRight,
  LogIn, LogOut, UserPlus, UserMinus, ClipboardList, Sparkles,
} from 'lucide-react'
import { dashboardAPI } from '@/api/client'
import { useLtcStore } from '@/store/ltc'
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
}

const todayStr = todayKST()

export default function DashboardPage() {
  const navigate = useNavigate()
  const [siteStats, setSiteStats] = useState<DashboardStats | null>(null)
  const [loadingSite, setLoadingSite] = useState(true)

  const { checklists, occurrences, residents, staffList, loaded, loadAll } = useLtcStore()

  useEffect(() => { loadSiteStats() }, [])
  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  const loadSiteStats = async () => {
    try {
      setLoadingSite(true)
      const res = await dashboardAPI.stats()
      setSiteStats(res || null)
    } catch (e) { console.error(e) }
    finally { setLoadingSite(false) }
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
          if (o.status !== 'pending' && o.status !== 'overdue') return false
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
  const totalActive     = checklists.filter(c => c.active).length
  const totalDone       = occurrences.length > 0
    ? occurrences.filter(o => o.status === 'completed' && o.scheduledDate <= todayStr && o.dueDate >= todayStr).length
    : 0

  const greetHour = parseInt(new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', hour:'numeric', hour12:false }).format(new Date()))
  const greet = greetHour < 12 ? '좋은 아침입니다' : greetHour < 18 ? '안녕하세요' : '수고 많으셨습니다'

  return (
    <div className="space-y-6">
      {/* ── 인사말 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-400 font-medium">
            {new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">{greet} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">행복한요양원 오늘의 현황입니다</p>
        </div>
        {todayPersonEvents.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {todayPersonEvents.map((ev, i) => (
              <span key={i} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
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

      {/* ── KPI 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="입소 수급자" value={activeResidents}
          sub={siteStats ? `전체 ${siteStats.totalResidents}명` : ''} color="teal"
          icon={<Users size={18}/>} onClick={() => navigate('/eval/residents')}/>
        <KpiCard label="재직 직원" value={activeStaff}
          sub={loadingSite ? '' : `전체 ${siteStats?.totalStaff ?? 0}명`} color="indigo"
          icon={<UserCog size={18}/>} onClick={() => navigate('/eval/staff')}/>
        <KpiCard label="오늘 미완료" value={todayTasks.length}
          sub={urgentTasks.length > 0 ? `위험 ${urgentTasks.length}건 포함` : '정기 반복 업무'}
          color={urgentTasks.length > 0 ? 'red' : 'orange'}
          icon={<ClipboardList size={18}/>} onClick={() => navigate('/eval/checklist')}
          alert={urgentTasks.length > 0}/>
        <KpiCard label="이벤트 미완료" value={eventPendingTasks.length}
          sub="입소·입사 관련 누적" color={eventPendingTasks.length > 0 ? 'purple' : 'gray'}
          icon={<AlertTriangle size={18}/>} onClick={() => navigate('/eval/checklist')}
          alert={eventPendingTasks.some(t => t.daysOverdue >= 7)}/>
      </div>

      {/* ── 메인 2열 */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* 왼쪽 3열 */}
        <div className="lg:col-span-3 space-y-4">

          {/* 오늘 정기 업무 */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-primary-orange"/>
                <h2 className="text-sm font-bold text-gray-800">오늘 해야 할 정기 업무</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  todayTasks.length===0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {todayTasks.length===0 ? '✓ 모두 완료' : `${todayTasks.length}건 남음`}
                </span>
              </div>
              <button onClick={() => navigate('/eval/checklist')} className="text-xs text-gray-400 hover:text-primary-orange flex items-center gap-0.5">
                전체보기<ChevronRight size={13}/>
              </button>
            </div>
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 size={32} className="mb-2 text-green-400"/>
                <p className="text-sm font-medium text-green-600">오늘 정기 업무 모두 완료!</p>
                {totalDone > 0 && <p className="text-xs text-gray-400 mt-1">오늘 완료 {totalDone}건</p>}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {todayTasks.slice(0, 8).map(task => (
                  <TaskRow key={task.occId || task.itemId} task={task} onClick={() => navigate('/eval/checklist')}/>
                ))}
                {todayTasks.length > 8 && (
                  <button onClick={() => navigate('/eval/checklist')}
                    className="w-full py-2.5 text-xs text-center text-gray-400 hover:text-primary-orange hover:bg-orange-50 transition-colors">
                    +{todayTasks.length - 8}건 더 보기
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 이벤트 미완료 누적 */}
          {eventPendingTasks.length > 0 && (
            <section className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-purple-50 bg-purple-50/50">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-purple-500"/>
                  <h2 className="text-sm font-bold text-gray-800">입소·입사 관련 미완료 누적</h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {eventPendingTasks.length}건
                  </span>
                </div>
                <button onClick={() => navigate('/eval/checklist')} className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-0.5">
                  전체보기<ChevronRight size={13}/>
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {eventPendingTasks.slice(0, 5).map(task => (
                  <EventTaskRow key={task.occId || task.itemId} task={task} onClick={() => navigate('/eval/checklist')}/>
                ))}
                {eventPendingTasks.length > 5 && (
                  <button onClick={() => navigate('/eval/checklist')}
                    className="w-full py-2.5 text-xs text-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors">
                    +{eventPendingTasks.length - 5}건 더 보기
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        {/* 오른쪽 2열 */}
        <div className="lg:col-span-2 space-y-4">

          {/* 주기별 완료율 */}
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

          {/* 운영 현황 */}
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
              <div className="space-y-2">
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

          {/* 빠른 이동 */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-sm font-bold text-gray-800 mb-3">빠른 이동</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label:'체크리스트', icon:ClipboardList, to:'/eval/checklist', color:'text-primary-orange' },
                { label:'캘린더',     icon:Calendar,      to:'/eval/calendar',  color:'text-teal-600' },
                { label:'수급자',     icon:Users,         to:'/eval/residents', color:'text-indigo-600' },
                { label:'AI 검토',    icon:Sparkles,      to:'/eval/ai-review', color:'text-purple-600' },
                { label:'상담',       icon:MessageSquare, to:'/contacts',       color:'text-orange-600' },
                { label:'직원',       icon:UserCog,       to:'/eval/staff',     color:'text-pink-600' },
              ].map(item => (
                <button key={item.to} onClick={() => navigate(item.to)}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-left transition-colors">
                  <item.icon size={14} className={item.color}/>
                  <span className="text-xs font-semibold text-gray-700">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon, onClick, alert }: {
  label:string; value:number; sub:string; color:string
  icon:React.ReactNode; onClick?:()=>void; alert?:boolean
}) {
  const colors: Record<string,{bg:string;text:string;ring:string}> = {
    teal:   {bg:'bg-teal-50',   text:'text-teal-600',   ring:'ring-teal-200'},
    indigo: {bg:'bg-indigo-50', text:'text-indigo-600', ring:'ring-indigo-200'},
    orange: {bg:'bg-orange-50', text:'text-orange-600', ring:'ring-orange-200'},
    red:    {bg:'bg-red-50',    text:'text-red-600',    ring:'ring-red-300'},
    purple: {bg:'bg-purple-50', text:'text-purple-600', ring:'ring-purple-200'},
    gray:   {bg:'bg-gray-50',   text:'text-gray-500',   ring:'ring-gray-200'},
  }
  const c = colors[color] ?? colors.gray
  return (
    <button onClick={onClick}
      className={`bg-white rounded-2xl border shadow-sm p-4 text-left hover:shadow-md transition-all w-full ${alert?'border-red-200':'border-gray-100'}`}>
      <div className={`w-9 h-9 ${c.bg} ${c.text} rounded-xl flex items-center justify-center mb-3 ${alert?`ring-2 ${c.ring}`:''}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs font-semibold text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </button>
  )
}

function TaskRow({ task, onClick }: { task: TodayTask; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-orange-50/40 text-left transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        task.riskLevel==='high' ? 'bg-red-500' : task.riskLevel==='medium' ? 'bg-orange-400' : 'bg-gray-300'
      }`}/>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400">{FREQUENCY_LABELS[task.frequency] ?? task.frequency}</span>
          {task.personName && <span className="text-[10px] text-purple-500 font-medium">👤 {task.personName}</span>}
          {task.assignee && !task.personName && <span className="text-[10px] text-gray-400">{task.assignee}</span>}
          {task.daysOverdue > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              task.daysOverdue>=7 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
            }`}>{task.daysOverdue}일 지남</span>
          )}
          {task.isOneTime && task.daysLeft !== undefined && task.daysOverdue === 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${task.daysLeft===0?'bg-red-100 text-red-600':task.daysLeft<=3?'bg-orange-100 text-orange-600':'bg-amber-100 text-amber-700'}`}>{task.daysLeft===0?'오늘 마감':`D-${task.daysLeft}`}</span>
          )}
        </div>
      </div>
      {task.riskLevel==='high' && (
        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">위험</span>
      )}
    </button>
  )
}

function EventTaskRow({ task, onClick }: { task: TodayTask; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-purple-50/40 text-left transition-colors">
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
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${alert?'text-orange-500':highlight?'text-primary-orange':'text-gray-800'}`}>
        {value}<span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
      </span>
    </div>
  )
}
