import { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  RotateCcw, UserPlus, UserMinus, LogIn, LogOut, Users, Clock, Check,
} from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import type { ChecklistOccurrence } from '@/store/ltc'
import ChecklistDetailModal from '@/components/eval/ChecklistDetailModal'
import type { ChecklistItem } from '@/utils/period'
import { EVENT_FREQS, FREQUENCY_LABELS, FREQUENCY_COLORS, shouldShowOnDate, isPeriodCompleted, getPeriodKey, todayKST, todayDateKST, daysFromToday } from '@/utils/period'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths,
} from 'date-fns'
import { ko } from 'date-fns/locale'

// ── 인물 이벤트 메타 ───────────────────────────────────────────────────────
type PersonEventType = 'admission' | 'discharge' | 'hire' | 'resign'
interface PersonEvent { type: PersonEventType; name: string; id: string; personCategory: 'resident' | 'staff' }

const PERSON_EVENT_META: Record<PersonEventType, { label:string; icon:React.ElementType; dot:string; bg:string; border:string; text:string; badgeBg:string }> = {
  admission: { label:'입소', icon:LogIn,     dot:'bg-teal-500',   bg:'bg-teal-50',   border:'border-teal-200',  text:'text-teal-700',   badgeBg:'bg-teal-100 text-teal-700' },
  discharge: { label:'퇴소', icon:LogOut,    dot:'bg-gray-400',   bg:'bg-gray-50',   border:'border-gray-200',  text:'text-gray-600',   badgeBg:'bg-gray-100 text-gray-600' },
  hire:      { label:'입사', icon:UserPlus,  dot:'bg-indigo-500', bg:'bg-indigo-50', border:'border-indigo-200', text:'text-indigo-700', badgeBg:'bg-indigo-100 text-indigo-700' },
  resign:    { label:'퇴사', icon:UserMinus, dot:'bg-orange-400', bg:'bg-orange-50', border:'border-orange-200', text:'text-orange-700', badgeBg:'bg-orange-100 text-orange-700' },
}

type ViewTab = 'checklist' | 'people' | 'all'

const GROUP_TONE: Record<string, { dot: string; text: string; border: string }> = {
  red:    { dot: 'bg-red-500',    text: 'text-red-600',    border: 'border-red-100' },
  orange: { dot: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-100' },
  amber:  { dot: 'bg-amber-500',  text: 'text-amber-600',  border: 'border-amber-100' },
  blue:   { dot: 'bg-blue-500',   text: 'text-blue-600',   border: 'border-blue-100' },
  gray:   { dot: 'bg-gray-300',   text: 'text-gray-500',   border: 'border-gray-100' },
  green:  { dot: 'bg-green-500',  text: 'text-green-600',  border: 'border-green-100' },
}

// '2026-07-18' → '7.18(토)'
const fmtDue = (iso: string) => {
  try {
    const d = new Date(iso + 'T00:00:00')
    return `${d.getMonth() + 1}.${d.getDate()}(${['일','월','화','수','목','금','토'][d.getDay()]})`
  } catch { return iso }
}

export default function EvalCalendarPage() {
  const {
    checklists: allChecklists, occurrences: allOccurrences,
    residents, staffList, loaded, loadAll, completeOccurrence, uncompleteOccurrence, toggleComplete,
  } = useLtcStore()

  // 입소·퇴소·입사 자동 생성(인물 연결) 체크리스트는 평가 캘린더에서 제외한다.
  // → 수급자 관리 / 직원 관리에서 해당 인물을 클릭해 확인한다.
  const checklists = useMemo(() => allChecklists.filter(c => !c.personId), [allChecklists])
  const personItemIds = useMemo(
    () => new Set(allChecklists.filter(c => c.personId).map(c => c.id)),
    [allChecklists])
  const occurrences = useMemo(
    () => allOccurrences.filter(o => !personItemIds.has(o.checklistItemId)),
    [allOccurrences, personItemIds])
  const [currentDate, setCurrentDate] = useState(todayDateKST())
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(todayDateKST())
  const [toggling, setToggling] = useState<string | null>(null)
  const [viewTab, setViewTab] = useState<ViewTab>('all')
  const [urgentFilter, setUrgentFilter] = useState<'todo' | 'overdue' | 'done'>('todo')

  useEffect(() => { loadAll() }, [loadAll])

  const hasOccurrences = occurrences.length > 0

  // ── 아이템 맵 (id → item) ────────────────────────────────────────────
  const itemMap = useMemo(() =>
    new Map(checklists.map(c => [c.id, c])),
  [checklists])

  // ── 캘린더 날짜 범위 ────────────────────────────────────────────────
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  // ── 날짜별 occurrence 맵 ─────────────────────────────────────────────
  // occurrence 기반: 미완료는 due_date까지 매일, 완료는 completed_date에만
  const occsByDay = useMemo(() => {
    const map = new Map<string, { occ: ChecklistOccurrence; item: ChecklistItem | undefined }[]>()
    const today = todayKST()

    if (!hasOccurrences) return map

    occurrences.forEach(occ => {
      const item = itemMap.get(occ.checklistItemId)
      if (!item?.active) return

      if (occ.status === 'completed') {
        // 완료: completed_date 날짜에만 표시
        const key = occ.completedDate || occ.dueDate
        if (key) {
          const arr = map.get(key) ?? []; arr.push({ occ, item }); map.set(key, arr)
        }
      } else {
        // 미완료(pending/overdue): scheduled_date ~ min(due_date, 오늘) 매일 표시
        const start = occ.scheduledDate
        const end   = occ.dueDate <= today ? occ.dueDate : today
        // 이번 달에만 표시 (성능)
        const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
        const monthEnd   = format(endOfMonth(currentDate),   'yyyy-MM-dd')
        const s = start > monthStart ? start : monthStart
        const e = end   < monthEnd   ? end   : monthEnd
        if (s > e) return
        // 날짜 문자열 직접 증가 (timezone 문제 회피)
        let cur = s
        while (cur <= e) {
          const arr = map.get(cur) ?? []; arr.push({ occ, item }); map.set(cur, arr)
          const d = new Date(cur + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)
          cur = d.toISOString().split('T')[0]
        }
      }
    })
    return map
  }, [occurrences, itemMap, hasOccurrences, currentDate])

  // ── 구 방식 fallback: occurrence 없을 때 ────────────────────────────
  const legacyByDay = useMemo(() => {
    if (hasOccurrences) return new Map<string, { item: ChecklistItem; done: boolean; isEvent: boolean }[]>()
    const map = new Map<string, { item: ChecklistItem; done: boolean; isEvent: boolean }[]>()
    days.forEach(day => {
      const key = format(day, 'yyyy-MM-dd')
      const entries: { item: ChecklistItem; done: boolean; isEvent: boolean }[] = []
      checklists.forEach(item => {
        if (shouldShowOnDate(item, day)) {
          const isEvent = EVENT_FREQS.includes(item.frequency as any)
          const done = isEvent ? item.completed : isPeriodCompleted(item, getPeriodKey(item.frequency as any, day))
          entries.push({ item, done, isEvent })
        }
      })
      if (entries.length) map.set(key, entries)
    })
    return map
  }, [checklists, days, hasOccurrences])

  // ── 상단 요약 (지남 / 오늘 할 일 / 이번 주 마감) ──────────────────────
  const summary = useMemo(() => {
    const today = todayKST()
    const weekEnd = format(endOfWeek(todayDateKST(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const overdue = new Set<string>(), todayTodo = new Set<string>(), weekDue = new Set<string>()
    if (hasOccurrences) {
      occurrences.forEach(o => {
        const item = itemMap.get(o.checklistItemId)
        if (!item?.active || o.status === 'completed') return
        if (o.status === 'overdue' || o.dueDate < today) overdue.add(o.checklistItemId)
        if (o.scheduledDate <= today && o.dueDate >= today) todayTodo.add(o.checklistItemId)
        if (o.dueDate >= today && o.dueDate <= weekEnd) weekDue.add(o.checklistItemId)
      })
    }
    return { overdue: overdue.size, todayTodo: todayTodo.size, weekDue: weekDue.size }
  }, [occurrences, itemMap, hasOccurrences])

  // ── 마감 임박순 목록 (항목별 가장 임박한 occurrence) ────────────────
  const upcoming = useMemo(() => {
    type UpRow = { occ: ChecklistOccurrence; item: ReturnType<typeof itemMap.get>; daysLeft: number }
    if (!hasOccurrences) return [] as UpRow[]
    const byItem = new Map<string, ChecklistOccurrence>()
    occurrences.forEach(o => {
      const item = itemMap.get(o.checklistItemId)
      if (!item?.active) return
      if (urgentFilter === 'todo'    && o.status === 'completed') return
      if (urgentFilter === 'overdue' && o.status !== 'overdue')   return
      if (urgentFilter === 'done'    && o.status !== 'completed') return
      const cur = byItem.get(o.checklistItemId)
      if (!cur) { byItem.set(o.checklistItemId, o); return }
      if (urgentFilter === 'done') {
        // 완료: 가장 최근 완료
        if ((o.completedDate || o.dueDate) > (cur.completedDate || cur.dueDate)) byItem.set(o.checklistItemId, o)
      } else {
        // 미완료/지남: 가장 임박(=가장 이른 마감)
        if (o.dueDate < cur.dueDate) byItem.set(o.checklistItemId, o)
      }
    })
    const rows = [...byItem.values()].map(o => ({
      occ: o,
      item: itemMap.get(o.checklistItemId),
      daysLeft: daysFromToday(o.dueDate),
    }))
    rows.sort((a, b) =>
      urgentFilter === 'done'
        ? (b.occ.completedDate || b.occ.dueDate).localeCompare(a.occ.completedDate || a.occ.dueDate)
        : a.occ.dueDate.localeCompare(b.occ.dueDate),   // 오름차순 = 임박/지난 순
    )
    return rows
  }, [occurrences, itemMap, hasOccurrences, urgentFilter])

  // ── 마감 임박순: 긴급도 구간별 그룹핑 (스캔 가능하게) ──────────────
  const upcomingGroups = useMemo(() => {
    if (urgentFilter === 'done') {
      return upcoming.length ? [{ key: 'done', label: '완료', tone: 'green', rows: upcoming }] : []
    }
    const buckets: Record<string, typeof upcoming> = { over: [], today: [], soon: [], week: [], later: [] }
    upcoming.forEach(u => {
      const d = u.daysLeft
      if (d < 0) buckets.over.push(u)
      else if (d === 0) buckets.today.push(u)
      else if (d <= 3) buckets.soon.push(u)
      else if (d <= 7) buckets.week.push(u)
      else buckets.later.push(u)
    })
    return ([
      { key: 'over',  label: '기한 지남',   tone: 'red',    rows: buckets.over },
      { key: 'today', label: '오늘 마감',   tone: 'orange', rows: buckets.today },
      { key: 'soon',  label: '3일 내',      tone: 'amber',  rows: buckets.soon },
      { key: 'week',  label: '이번 주',     tone: 'blue',   rows: buckets.week },
      { key: 'later', label: '여유 있음',   tone: 'gray',   rows: buckets.later },
    ] as const).filter(g => g.rows.length > 0)
  }, [upcoming, urgentFilter])

  const urgentCounts = useMemo(() => {
    const todoSet = new Set<string>(), overdueSet = new Set<string>(), doneSet = new Set<string>()
    if (hasOccurrences) occurrences.forEach(o => {
      const item = itemMap.get(o.checklistItemId)
      if (!item?.active) return
      if (o.status === 'completed') doneSet.add(o.checklistItemId)
      else { todoSet.add(o.checklistItemId); if (o.status === 'overdue') overdueSet.add(o.checklistItemId) }
    })
    return { todo: todoSet.size, overdue: overdueSet.size, done: doneSet.size }
  }, [occurrences, itemMap, hasOccurrences])

  // ── 날짜별 인물 이벤트 ──────────────────────────────────────────────
  const personEventsByDay = useMemo(() => {
    const map = new Map<string, PersonEvent[]>()
    const push = (dateStr: string | undefined, ev: PersonEvent) => {
      if (!dateStr) return
      const arr = map.get(dateStr) ?? []; arr.push(ev); map.set(dateStr, arr)
    }
    residents.forEach(r => {
      push(r.admissionDate, { type:'admission', name:r.name, id:r.id, personCategory:'resident' })
      if (r.dischargeDate) push(r.dischargeDate, { type:'discharge', name:r.name, id:r.id, personCategory:'resident' })
    })
    staffList.forEach(s => {
      push(s.hireDate, { type:'hire', name:s.name, id:s.id, personCategory:'staff' })
      if (s.resignDate) push(s.resignDate, { type:'resign', name:s.name, id:s.id, personCategory:'staff' })
    })
    return map
  }, [residents, staffList])

  // ── 이번 달 인물 이벤트 배너 ────────────────────────────────────────
  const monthPersonEvents = useMemo(() => {
    const result: { date: string; events: PersonEvent[] }[] = []
    days.filter(d => isSameMonth(d, currentDate)).forEach(day => {
      const key = format(day, 'yyyy-MM-dd')
      const events = personEventsByDay.get(key)
      if (events?.length) result.push({ date: key, events })
    })
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [days, currentDate, personEventsByDay])

  // ── 선택한 날 데이터 ────────────────────────────────────────────────
  const selectedDayKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null

  // occurrence 기반 당일 항목
  const dayOccs = useMemo(() => {
    if (!selectedDayKey) return { recurring: [], event: [] }
    const all = occsByDay.get(selectedDayKey) ?? []
    return {
      recurring: all.filter(e => !['on_admission','on_discharge','on_hire','on_resign'].includes(e.occ.frequency)),
      event:     all.filter(e =>  ['on_admission','on_discharge','on_hire','on_resign'].includes(e.occ.frequency)),
    }
  }, [selectedDayKey, occsByDay])

  // 구 방식 fallback 당일 항목
  const dayLegacy = useMemo(() => {
    if (!selectedDayKey || hasOccurrences) return { recurring: [], event: [] }
    const all = legacyByDay.get(selectedDayKey) ?? []
    return {
      recurring: all.filter(e => !e.isEvent),
      event:     all.filter(e =>  e.isEvent),
    }
  }, [selectedDayKey, legacyByDay, hasOccurrences])

  const dayPersonEvents = selectedDayKey ? (personEventsByDay.get(selectedDayKey) ?? []) : []

  // ── 완료 토글 ───────────────────────────────────────────────────────
  const handleToggleOcc = async (occ: ChecklistOccurrence) => {
    setToggling(occ.id)
    try {
      if (occ.status === 'completed') {
        await uncompleteOccurrence(occ.id)
      } else {
        const today = new Date().toISOString().split('T')[0]
        await completeOccurrence(occ.id, today)
      }
    } finally { setToggling(null) }
  }

  const handleToggleLegacy = async (id: string) => {
    setToggling(id)
    try { await toggleComplete(id) } finally { setToggling(null) }
  }

  if (!loaded) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-orange border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">평가 캘린더</h1>
          <p className="text-sm text-gray-500 mt-0.5">체크리스트 · 입소/퇴소 · 입사/퇴사 일정을 한눈에</p>
        </div>
        <button onClick={() => loadAll()} className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <RotateCcw size={14}/> 새로고침
        </button>
      </div>

      {/* 상단 요약 스트립 */}
      {hasOccurrences && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={() => setUrgentFilter('overdue')}
            className={`text-left rounded-xl p-3 sm:p-4 border transition-colors ${
              summary.overdue > 0 ? 'bg-red-50 border-red-100 hover:bg-red-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
            }`}>
            <p className={`text-[11px] sm:text-xs font-medium ${summary.overdue > 0 ? 'text-red-500' : 'text-gray-500'}`}>기한 지남</p>
            <p className={`text-xl sm:text-2xl font-bold ${summary.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{summary.overdue}</p>
          </button>
          <button
            onClick={() => setUrgentFilter('todo')}
            className="text-left rounded-xl p-3 sm:p-4 border bg-orange-50 border-orange-100 hover:bg-orange-100 transition-colors">
            <p className="text-[11px] sm:text-xs font-medium text-orange-500">오늘 할 일</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-600">{summary.todayTodo}</p>
          </button>
          <div className="rounded-xl p-3 sm:p-4 border bg-gray-50 border-gray-100">
            <p className="text-[11px] sm:text-xs font-medium text-gray-500">이번 주 마감</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-700">{summary.weekDue}</p>
          </div>
        </div>
      )}

      {/* 이번 달 인물 이벤트 배너 */}
      {monthPersonEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
            <Users size={13}/>이번 달 인물 일정 ({monthPersonEvents.reduce((s,d)=>s+d.events.length,0)}건)
          </p>
          <div className="flex flex-wrap gap-2">
            {monthPersonEvents.map(({ date, events }) =>
              events.map((ev, i) => {
                const meta = PERSON_EVENT_META[ev.type]
                const Icon = meta.icon
                return (
                  <button key={`${date}-${i}`}
                    onClick={() => { setSelectedDay(new Date(date + 'T00:00:00')); setCurrentDate(new Date(date + 'T00:00:00')) }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${meta.bg} ${meta.border} ${meta.text} hover:opacity-80`}>
                    <Icon size={12}/>
                    <span>{parseInt(date.slice(8))}일</span>
                    <span className="font-bold">{ev.name}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${meta.badgeBg}`}>{meta.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* 달력 + 마감 임박순 (2단) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 items-start">
      {/* 캘린더 그리드 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft size={15}/></button>
          <div className="text-center">
            <h2 className="text-base font-bold text-gray-900">{format(currentDate, 'yyyy년 M월', { locale: ko })}</h2>
            <div className="flex items-center gap-3 mt-1 justify-center">
              {(Object.entries(PERSON_EVENT_META) as [PersonEventType, typeof PERSON_EVENT_META[PersonEventType]][]).map(([type, meta]) => (
                <span key={type} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${meta.dot} inline-block`}/>{meta.label}
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronRight size={15}/></button>
        </div>

        <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-gray-50/50 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>지남</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>할 일</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>완료</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block"/>개인 이벤트</span>
        </div>

        <div className="grid grid-cols-7 border-b bg-gray-50">
          {['일','월','화','수','목','금','토'].map((d,i) => (
            <div key={d} className={`py-2 text-center text-xs font-semibold ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-500'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const key = format(day, 'yyyy-MM-dd')
            const isCurrent  = isSameMonth(day, currentDate)
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const personEvs  = personEventsByDay.get(key) ?? []

            // occurrence 기반 or 구 방식
            let todoCount = 0, doneCount = 0, eventTodo = 0, hasUrgent = false, hasOverdue = false
            if (hasOccurrences) {
              const all = occsByDay.get(key) ?? []
              const recurring = all.filter(e => !['on_admission','on_discharge','on_hire','on_resign'].includes(e.occ.frequency))
              const events    = all.filter(e =>  ['on_admission','on_discharge','on_hire','on_resign'].includes(e.occ.frequency))
              doneCount  = recurring.filter(e => e.occ.status === 'completed').length
              todoCount  = recurring.filter(e => e.occ.status !== 'completed').length
              eventTodo  = events.filter(e => e.occ.status !== 'completed').length
              hasUrgent  = all.some(e => e.occ.status !== 'completed' && e.item?.riskLevel === 'high')
              hasOverdue = all.some(e => e.occ.status === 'overdue')
            } else {
              const all = legacyByDay.get(key) ?? []
              doneCount = all.filter(e => !e.isEvent && e.done).length
              todoCount = all.filter(e => !e.isEvent && !e.done).length
              eventTodo = all.filter(e => e.isEvent && !e.done).length
              hasUrgent = all.some(e => !e.done && e.item.riskLevel === 'high')
            }

            return (
              <div key={key}
                onClick={() => isCurrent && setSelectedDay(isSameDay(day, selectedDay!) ? null : day)}
                className={`min-h-[72px] p-1.5 border-r border-b border-gray-50 transition-colors
                  ${!isCurrent?'bg-gray-50/50 text-gray-300':'cursor-pointer hover:bg-orange-50/30'}
                  ${isSelected?'bg-orange-50 ring-2 ring-inset ring-primary-orange':''}
                  ${idx%7===6?'border-r-0':''}`}>
                <div className={`text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-0.5 mx-auto ${
                  isToday(day)?'bg-primary-orange text-white':idx%7===0?'text-red-400':idx%7===6?'text-blue-400':'text-gray-700'
                }`}>{format(day, 'd')}</div>
                {isCurrent && (todoCount > 0 || doneCount > 0 || eventTodo > 0 || personEvs.length > 0) && (
                  <div className="flex flex-col items-center gap-0.5">
                    {todoCount > 0 && (
                      <span className={`text-[10px] leading-none font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                        (hasUrgent || hasOverdue) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {(hasUrgent || hasOverdue) && <AlertTriangle size={8}/>}{todoCount}
                      </span>
                    )}
                    {doneCount > 0 && (
                      <span className="text-[10px] leading-none font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-0.5">
                        <CheckCircle2 size={8}/>{doneCount}
                      </span>
                    )}
                    {eventTodo > 0 && (
                      <span className="text-[10px] leading-none font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{eventTodo}</span>
                    )}
                    {personEvs.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                        {personEvs.slice(0,3).map((ev,i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${PERSON_EVENT_META[ev.type].dot} inline-block`}/>)}
                        {personEvs.length > 3 && <span className="text-[8px] text-gray-400">+{personEvs.length-3}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 마감 임박순 목록 */}
      {hasOccurrences && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-primary-orange" />
              <h2 className="text-sm font-bold text-gray-900">마감 임박순</h2>
              <span className="text-xs text-gray-400">{upcoming.length}건</span>
            </div>
            <div className="flex gap-1">
              {([
                ['todo',    '미완료',    urgentCounts.todo],
                ['overdue', '기한 지남', urgentCounts.overdue],
                ['done',    '완료',      urgentCounts.done],
              ] as ['todo'|'overdue'|'done', string, number][]).map(([f, label, cnt]) => (
                <button key={f} onClick={() => setUrgentFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    urgentFilter===f ? 'bg-primary-orange text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {label} <span className={urgentFilter===f ? 'text-white/80' : 'text-gray-400'}>{cnt}</span>
                </button>
              ))}
            </div>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {urgentFilter === 'overdue' ? '기한 지난 업무가 없습니다' : urgentFilter === 'done' ? '완료한 업무가 없습니다' : '처리할 업무가 없습니다'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {urgentFilter === 'todo' ? '모든 업무를 마감 전에 처리했습니다 👍' : '다른 탭을 확인해 보세요.'}
              </p>
            </div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto">
              {upcomingGroups.map(g => (
                <div key={g.key}>
                  <div className={`sticky top-0 z-10 flex items-center gap-2 px-4 py-2 border-b backdrop-blur bg-white/90 ${GROUP_TONE[g.tone].border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${GROUP_TONE[g.tone].dot}`} />
                    <span className={`text-xs font-bold ${GROUP_TONE[g.tone].text}`}>{g.label}</span>
                    <span className="text-[11px] font-semibold text-gray-400">{g.rows.length}건</span>
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    {g.rows.map(({ occ, item, daysLeft }) => (
                      <UpcomingRow key={occ.id} occ={occ} item={item} daysLeft={daysLeft} toggling={toggling}
                        onToggle={() => handleToggleOcc(occ)} onDetail={() => item && setSelectedItem(item)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      {/* 선택한 날 상세 */}
      {selectedDay && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-gray-800">{format(selectedDay, 'M월 d일 (EEE)', { locale: ko })}</h3>
            <div className="flex gap-1">
              {([
                ['all',       '전체'],
                ['people',    `인물 (${dayPersonEvents.length})`],
                ['checklist', `체크 (${hasOccurrences ? dayOccs.recurring.length + dayOccs.event.length : dayLegacy.recurring.length + dayLegacy.event.length})`],
              ] as [ViewTab, string][]).map(([tab, label]) => (
                <button key={tab} onClick={() => setViewTab(tab)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${viewTab===tab?'bg-primary-orange text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* 인물 이벤트 */}
            {(viewTab==='all'||viewTab==='people') && dayPersonEvents.length > 0 && (
              <div className="space-y-2">
                {viewTab==='all' && <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Users size={12}/>인물 일정</p>}
                {dayPersonEvents.map((ev, i) => {
                  const meta = PERSON_EVENT_META[ev.type]
                  const Icon = meta.icon
                  return (
                    <div key={i} className={`rounded-xl border p-3.5 ${meta.bg} ${meta.border}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.badgeBg}`}><Icon size={16}/></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-bold ${meta.text}`}>{ev.name}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badgeBg}`}>{meta.label}</span>
                            <span className="text-xs text-gray-400">{ev.personCategory==='resident'?'수급자':'직원'}</span>
                          </div>
                          <p className={`text-xs mt-1 ${meta.text} opacity-70`}>
                            {ev.type==='admission'&&'입소 관련 체크리스트 12건이 자동 생성되었습니다.'}
                            {ev.type==='discharge'&&'퇴소 처리 체크리스트를 확인하세요.'}
                            {ev.type==='hire'     &&'입사 관련 체크리스트 2건이 자동 생성되었습니다.'}
                            {ev.type==='resign'   &&'퇴사 처리가 완료되었습니다.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {viewTab==='people' && dayPersonEvents.length===0 && <p className="text-sm text-gray-400 text-center py-8">이 날의 인물 일정이 없습니다.</p>}

            {/* 구분선 */}
            {viewTab==='all' && dayPersonEvents.length > 0 && (
              (hasOccurrences ? dayOccs.recurring.length + dayOccs.event.length : dayLegacy.recurring.length + dayLegacy.event.length) > 0
            ) && (
              <div className="border-t border-dashed border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5"><CheckCircle2 size={12}/>체크리스트</p>
              </div>
            )}

            {/* 이벤트성 체크리스트 */}
            {(viewTab==='all'||viewTab==='checklist') && (hasOccurrences ? dayOccs.event : dayLegacy.event).length > 0 && (
              <div className="space-y-1.5">
                {viewTab==='all' && (
                  <p className="text-xs font-semibold text-purple-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"/>개인 이벤트 체크리스트
                    <span className="text-gray-400 font-normal">— 완료 전까지 매일 표시</span>
                  </p>
                )}
                {hasOccurrences
                  ? dayOccs.event.map(({ occ, item }) => (
                    <OccurrenceRow key={occ.id} occ={occ} item={item} toggling={toggling}
                      onToggle={() => handleToggleOcc(occ)} onDetail={() => item && setSelectedItem(item)}/>
                  ))
                  : dayLegacy.event.map(({ item, done }) => (
                    <LegacyRow key={item.id} item={item} done={done} toggling={toggling}
                      onToggle={() => handleToggleLegacy(item.id)} onDetail={() => setSelectedItem(item)}/>
                  ))
                }
              </div>
            )}

            {/* 구분선 (이벤트→반복) */}
            {viewTab==='all'
              && (hasOccurrences ? dayOccs.event : dayLegacy.event).length > 0
              && (hasOccurrences ? dayOccs.recurring : dayLegacy.recurring).length > 0
              && (
              <div className="border-t border-dashed border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><CheckCircle2 size={12}/>정기 반복 체크리스트</p>
              </div>
            )}

            {/* 반복 체크리스트 */}
            {(viewTab==='all'||viewTab==='checklist') && (hasOccurrences ? dayOccs.recurring : dayLegacy.recurring).length > 0 && (
              <div className="space-y-2">
                {hasOccurrences
                  ? dayOccs.recurring.map(({ occ, item }) => (
                    <OccurrenceRow key={occ.id} occ={occ} item={item} toggling={toggling}
                      onToggle={() => handleToggleOcc(occ)} onDetail={() => item && setSelectedItem(item)}/>
                  ))
                  : dayLegacy.recurring.map(({ item, done }) => (
                    <LegacyRow key={item.id} item={item} done={done} toggling={toggling}
                      onToggle={() => handleToggleLegacy(item.id)} onDetail={() => setSelectedItem(item)}/>
                  ))
                }
              </div>
            )}

            {/* 빈 상태 */}
            {viewTab==='checklist'
              && (hasOccurrences ? dayOccs.recurring.length + dayOccs.event.length : dayLegacy.recurring.length + dayLegacy.event.length) === 0
              && <p className="text-sm text-gray-400 text-center py-8">이 날의 체크리스트가 없습니다.</p>}
            {viewTab==='all'
              && dayPersonEvents.length===0
              && (hasOccurrences ? dayOccs.recurring.length + dayOccs.event.length : dayLegacy.recurring.length + dayLegacy.event.length) === 0
              && <p className="text-sm text-gray-400 text-center py-8">이 날의 일정이 없습니다.</p>}
          </div>
        </div>
      )}

      {selectedItem && <ChecklistDetailModal item={selectedItem} onClose={() => setSelectedItem(null)}/>}
    </div>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────

function OccurrenceRow({ occ, item, toggling, onToggle, onDetail }: {
  occ: ChecklistOccurrence
  item: ChecklistItem | undefined
  toggling: string | null
  onToggle: () => void
  onDetail: () => void
}) {
  const done = occ.status === 'completed'
  const isOverdue  = occ.status === 'overdue'
  const isOneTime  = occ.frequency === 'one_time'
  const daysOverdue = isOverdue ? Math.max(0, -daysFromToday(occ.dueDate)) : 0
  const daysLeft = (!done && !isOverdue && isOneTime && occ.dueDate)
    ? Math.max(0, daysFromToday(occ.dueDate))
    : null

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
      done        ? 'bg-green-50 border-green-100 hover:bg-green-100' :
      item?.riskLevel==='high' ? 'bg-red-50 border-red-100 hover:bg-red-100' :
      isOverdue   ? 'bg-orange-50 border-orange-100 hover:bg-orange-100' :
      'bg-gray-50 border-gray-100 hover:bg-gray-100'
    }`}>
      <button onClick={e => { e.stopPropagation(); onToggle() }} disabled={toggling===occ.id}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center disabled:opacity-50 ${
          done?'bg-green-500 border-green-500':'border-gray-300 hover:border-primary-orange'
        }`}>
        {done && <div className="w-2 h-2 bg-white rounded-full"/>}
      </button>
      <div className="flex-1 min-w-0" onClick={onDetail}>
        <p className={`text-sm font-semibold truncate ${done?'line-through text-gray-400':'text-gray-800'}`}>
          {item?.title ?? '(삭제된 항목)'}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${FREQUENCY_COLORS[occ.frequency as any]}`}>
            {FREQUENCY_LABELS[occ.frequency as any]}
          </span>
          {item?.personName && <span className="text-[10px] font-semibold text-purple-600">👤 {item.personName}</span>}
          {item?.assignee && !item.personName && <span className="text-[10px] text-gray-400">{item.assignee}</span>}
          {done && occ.completedDate && <span className="text-[10px] text-green-600">{occ.completedDate} 완료</span>}
          {isOverdue && daysOverdue > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              daysOverdue>=14?'bg-red-100 text-red-600':daysOverdue>=7?'bg-orange-100 text-orange-600':'bg-gray-100 text-gray-500'
            }`}>{daysOverdue}일째 미완료</span>
          )}
          {daysLeft !== null && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              daysLeft===0?'bg-red-100 text-red-600':daysLeft<=3?'bg-orange-100 text-orange-600':'bg-amber-100 text-amber-700'
            }`}>{daysLeft===0?'오늘 마감':`D-${daysLeft}`}</span>
          )}
        </div>
      </div>
      {!done && item?.riskLevel==='high' && <AlertTriangle size={13} className="text-red-400 flex-shrink-0"/>}
      {done && <CheckCircle2 size={13} className="text-green-500 flex-shrink-0"/>}
    </div>
  )
}

function LegacyRow({ item, done, toggling, onToggle, onDetail }: {
  item: ChecklistItem; done: boolean; toggling: string | null; onToggle: ()=>void; onDetail: ()=>void
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
      done?'bg-green-50 border-green-100 hover:bg-green-100':
      item.riskLevel==='high'?'bg-red-50 border-red-100 hover:bg-red-100':
      'bg-gray-50 border-gray-100 hover:bg-gray-100'
    }`}>
      <button onClick={e=>{e.stopPropagation();onToggle()}} disabled={toggling===item.id}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center disabled:opacity-50 ${done?'bg-green-500 border-green-500':'border-gray-300 hover:border-primary-orange'}`}>
        {done && <div className="w-2 h-2 bg-white rounded-full"/>}
      </button>
      <div className="flex-1 min-w-0" onClick={onDetail}>
        <p className={`text-sm font-semibold truncate ${done?'line-through text-gray-400':'text-gray-800'}`}>{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${FREQUENCY_COLORS[item.frequency as any]}`}>{FREQUENCY_LABELS[item.frequency as any]}</span>
          {item.personName && <span className="text-[10px] text-gray-400">👤 {item.personName}</span>}
          {item.assignee && !item.personName && <span className="text-[10px] text-gray-400">{item.assignee}</span>}
        </div>
      </div>
      {!done && item.riskLevel==='high' && <AlertTriangle size={13} className="text-red-400 flex-shrink-0"/>}
      {done && <CheckCircle2 size={13} className="text-green-500 flex-shrink-0"/>}
    </div>
  )
}


function UpcomingRow({ occ, item, daysLeft, toggling, onToggle, onDetail }: {
  occ: ChecklistOccurrence
  item: ChecklistItem | undefined
  daysLeft: number
  toggling: string | null
  onToggle: () => void
  onDetail: () => void
}) {
  const done      = occ.status === 'completed'
  const isOverdue = occ.status === 'overdue'

  // D-day 칩 (색상만이 아니라 텍스트로도 상태를 알 수 있게)
  let chip: { top: string; bot: string; cls: string }
  if (done) {
    chip = { top: '완료', bot: occ.completedDate ? fmtDue(occ.completedDate) : '', cls: 'bg-green-100 text-green-700' }
  } else if (isOverdue || daysLeft < 0) {
    const over = Math.max(1, -daysLeft)
    chip = { top: `+${over}일`, bot: '지남', cls: over >= 7 ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600' }
  } else if (daysLeft === 0) {
    chip = { top: '오늘', bot: '마감', cls: 'bg-orange-500 text-white' }
  } else {
    chip = { top: `D-${daysLeft}`, bot: fmtDue(occ.dueDate), cls: daysLeft <= 3 ? 'bg-amber-100 text-amber-700' : daysLeft <= 7 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500' }
  }

  return (
    <div className={`group flex items-stretch gap-2.5 p-2.5 rounded-xl border transition-all ${
      done ? 'bg-white border-gray-100 opacity-70' :
      isOverdue || daysLeft < 0 ? 'bg-white border-red-100 hover:border-red-200 hover:shadow-sm' :
      daysLeft === 0 ? 'bg-white border-orange-100 hover:border-orange-200 hover:shadow-sm' :
      'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
    }`}>
      {/* D-day 칩 — 가장 중요한 정보를 선행 배치 */}
      <div className={`w-14 shrink-0 rounded-lg flex flex-col items-center justify-center py-1 ${chip.cls}`}>
        <span className="text-[11px] font-extrabold leading-tight">{chip.top}</span>
        {chip.bot && <span className="text-[9px] font-semibold opacity-80 leading-tight">{chip.bot}</span>}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-w-0 cursor-pointer py-0.5" onClick={onDetail}>
        <div className="flex items-center gap-1.5">
          {!done && item?.riskLevel === 'high' && <AlertTriangle size={12} className="text-red-500 shrink-0"/>}
          <p className={`text-sm font-semibold truncate ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {item?.title ?? '(삭제된 항목)'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${FREQUENCY_COLORS[occ.frequency as any] ?? 'bg-gray-100 text-gray-600'}`}>
            {FREQUENCY_LABELS[occ.frequency as any] ?? occ.frequency}
          </span>
          {!done && <span className="text-[10px] text-gray-400">마감 {fmtDue(occ.dueDate)}</span>}
          {item?.personName && <span className="text-[10px] font-semibold text-purple-600">👤 {item.personName}</span>}
          {item?.assignee && !item.personName && <span className="text-[10px] text-gray-400">{item.assignee}</span>}
        </div>
      </div>

      {/* 완료 토글 — 큰 탭 영역 */}
      <button onClick={e => { e.stopPropagation(); onToggle() }} disabled={toggling===occ.id}
        title={done ? '완료 취소' : '완료 처리'}
        className={`w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
          done ? 'bg-green-500 text-white hover:bg-green-600'
               : 'bg-gray-50 text-gray-300 hover:bg-primary-orange hover:text-white border border-gray-100'
        }`}>
        <Check size={16} strokeWidth={3} />
      </button>
    </div>
  )
}
