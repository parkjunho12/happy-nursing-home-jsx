import DateField from '@/components/ui/DateField'
import StickyToolbar from '../../components/common/StickyToolbar'
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  User,
  RotateCcw,
  Plus, Zap,
  CalendarDays,
} from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/api/client'
import ChecklistDetailModal from '@/components/eval/ChecklistDetailModal'
import ChecklistFormModal from '@/components/eval/ChecklistFormModal'
import ChecklistCalendarModal from '@/components/eval/ChecklistCalendarModal'
import type { ChecklistItem } from '@/utils/period'
import {
  FREQUENCY_LABELS,
  FREQUENCY_COLORS,
  RECURRING,
  EVENT_FREQS,
  getCurrentPeriodKey,
  getPeriodEnd,
  cfgFromItem,
  todayKST,
} from '@/utils/period'

type Deco = { item: ChecklistItem; done: boolean; daysLeft: number | null; dueStr: string | null; inProgress: boolean; startedBy?: string }

const SECTION_DEFS: { key: 'overdue' | 'week' | 'upcoming' | 'done'; label: string; cls: string }[] = [
  { key: 'overdue',  label: '기한 지남', cls: 'text-red-600' },
  { key: 'week',     label: '이번 주',   cls: 'text-orange-600' },
  { key: 'upcoming', label: '예정',      cls: 'text-gray-500' },
  { key: 'done',     label: '완료',      cls: 'text-green-600' },
]

const ONE_TIME = 'one_time'

function checkDone(item: ChecklistItem, _todayStr: string): boolean {
  const freq = item.frequency

  if (freq === ONE_TIME) {
    if (item.occurrences?.length > 0) {
      return item.occurrences.some(o => o.status === 'completed')
    }
    return item.completed
  }

  if (EVENT_FREQS.includes(freq as any)) return item.completed

  const cfg = cfgFromItem(item)
  if (item.occurrences?.length > 0) {
    const pk = getCurrentPeriodKey(freq as any, cfg)
    const occ = item.occurrences.find(o => o.periodKey === pk)
    if (occ) return occ.status === 'completed'
  }

  const pk = getCurrentPeriodKey(freq as any, cfg)
  return item.completionHistory.some(r => r.periodKey === pk)
}

export default function EvalChecklistPage() {
  const {
    checklists,
    loaded,
    loadAll,
    toggleComplete,
    addChecklist,
    setProgress,
  } = useLtcStore()

  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN' || user?.position === '시설장'   // 시설장도 발행·담당자 지정·전체 팔로우

  const [assigneeOptions, setAssigneeOptions] = useState<
    Array<{ id: string; name: string; position?: string | null }>
  >([])

  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null)
  const [editItem, setEditItem] = useState<ChecklistItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [activeFreq, setActiveFreq] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'done' | 'todo'>('all')
  const [toggling, setToggling] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [savingAssign, setSavingAssign] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)
  const [lastCreated, setLastCreated] = useState<ChecklistItem | null>(null)

  useEffect(() => {
    if (!loaded) loadAll()
  }, [loaded, loadAll])

  useEffect(() => {
    if (!isAdmin) return

    apiClient
      .get('/api/v1/users/assignee-options')
      .then(res => {
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.data ?? []

        setAssigneeOptions(data)
      })
      .catch(err => console.error('assignee-options 로드 실패:', err))
  }, [isAdmin])

  const todayStr = todayKST()

  useEffect(() => {
    if (!selectedItem) return
    const updated = checklists.find(c => c.id === selectedItem.id)
    if (updated) setSelectedItem(updated)
  }, [checklists, selectedItem])

  useEffect(() => {
    if (!editItem) return
    const updated = checklists.find(c => c.id === editItem.id)
    if (updated) setEditItem(updated)
  }, [checklists, editItem])

  const isDone = useCallback(
    (item: ChecklistItem) => checkDone(item, todayStr),
    [todayStr],
  )

  const deadlineOf = useCallback((item: ChecklistItem): Deco => {
    const done = checkDone(item, todayStr)
    const todayMid = new Date(todayStr + 'T00:00:00').getTime()
    const diffDays = (ds: string) => Math.round((new Date(ds + 'T00:00:00').getTime() - todayMid) / 86400000)
    let daysLeft: number | null = null
    let dueStr: string | null = null
    if (item.frequency === ONE_TIME) {
      if (item.dueDate) { dueStr = item.dueDate; daysLeft = diffDays(item.dueDate) }
    } else if (RECURRING.includes(item.frequency as any)) {
      const end = getPeriodEnd(item.frequency as any, new Date(), cfgFromItem(item))
      dueStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      daysLeft = diffDays(dueStr)
    }
    // 과거 주기 미완료(overdue occurrence)를 긴급으로 끌어올림 — 기한 지난 건 최상단
    if (!done && item.occurrences?.length) {
      const od = item.occurrences.filter(o => o.status === 'overdue' && o.dueDate)
      if (od.length) {
        const oldest = od.reduce((a, b) => (a.dueDate <= b.dueDate ? a : b))
        const dl = diffDays(oldest.dueDate)
        if (daysLeft == null || dl < daysLeft) { daysLeft = dl; dueStr = oldest.dueDate }
      }
    }
    // 진행 중(착수) — 미완료 occurrence 중 in_progress 가 있으면 표시
    let inProgress = false
    let startedBy: string | undefined
    if (!done && item.occurrences?.length) {
      const ip = item.occurrences.find(o => (o.status as any) === 'in_progress')
      if (ip) { inProgress = true; startedBy = (ip as any).startedBy }
    }
    return { item, done, daysLeft, dueStr, inProgress, startedBy }
  }, [todayStr])



  const metrics = useMemo(() => {
    let overdue = 0, weekTodo = 0, done = 0, total = 0, todayDue = 0
    checklists.filter(c => c.active && !c.personId).forEach(c => {
      total++
      const d = deadlineOf(c)
      if (d.done) { done++; return }
      if (d.daysLeft != null && d.daysLeft < 0) overdue++
      else if (d.daysLeft === 0) { todayDue++; weekTodo++ }
      else if (d.daysLeft != null && d.daysLeft <= 7) weekTodo++
    })
    return { overdue, weekTodo, done, total, todayDue }
  }, [checklists, deadlineOf])

  const filtered = useMemo(() => {
    return checklists.filter(c => {
      if (!c.active) return false
      // 입소·퇴소·입사 자동 생성(인물 연결) 체크리스트는 여기서 제외 —
      // 수급자 관리 / 직원 관리 카드에서 확인한다.
      if (c.personId) return false

      if (activeFreq !== 'all' && c.frequency !== activeFreq) return false

      const done = isDone(c)

      if (filterStatus === 'done' && !done) return false
      if (filterStatus === 'todo' && done) return false

      if (search) {
        const q = search.toLowerCase()
        const assignee = c.assignee ?? ''
        const personName = c.personName ?? ''

        if (
          !c.title.toLowerCase().includes(q) &&
          !assignee.toLowerCase().includes(q) &&
          !personName.toLowerCase().includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [checklists, activeFreq, filterStatus, search, isDone])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = isDone(a)
      const db = isDone(b)

      if (da !== db) return da ? 1 : -1

      if (!da) {
        if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1
        if (b.riskLevel === 'high' && a.riskLevel !== 'high') return 1
      }

      return 0
    })
  }, [filtered, isDone])

  const groups = useMemo(() => {
    const g: Record<'overdue' | 'week' | 'upcoming' | 'done', Deco[]> = { overdue: [], week: [], upcoming: [], done: [] }
    sorted.forEach(item => {
      const d = deadlineOf(item)
      const key = d.done ? 'done'
        : d.daysLeft == null ? 'upcoming'
        : d.daysLeft < 0 ? 'overdue'
        : d.daysLeft <= 7 ? 'week'
        : 'upcoming'
      g[key].push(d)
    })
    ;(['overdue', 'week', 'upcoming'] as const).forEach(k => g[k].sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)))
    return g
  }, [sorted, deadlineOf])

  // Jira식 인라인 빠른 발행: 제목 입력 → Enter → 즉시 일회성 티켓 발행(기본 기한 7일)
  const handleQuickAdd = async () => {
    const t = quickTitle.trim()
    if (!t || quickAdding) return
    setQuickAdding(true)
    try {
      const due = (() => { const d = new Date(todayKST() + 'T00:00:00'); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] })()
      const created = await addChecklist({
        title: t, description: '', frequency: 'one_time' as any, dueDate: due,
        relatedIndicatorId: '', relatedCategoryId: '', relatedDomainId: '',
        assignee: '', assigned_user_id: user?.id ?? null,
        evidenceRequired: '', storageLocation: '', howTo: '', evalNote: '', riskLevel: 'medium' as any,
        personId: undefined, personName: undefined, personType: 'facility',
        recurWeekday: null, recurWeekOfMonth: null, recurDay: null, recurDueDay: null,
        active: true, memo: '', attachmentName: '', completed: false,
        completionHistory: [], occurrences: [],
      } as any)
      setQuickTitle('')
      setLastCreated(created)
    } catch (e) { console.error(e) } finally { setQuickAdding(false) }
  }

  const handleToggle = async (id: string, desired?: boolean) => {
    setToggling(id)

    try {
      await toggleComplete(id, desired)
    } finally {
      setToggling(null)
    }
  }

  const handleProgress = async (e: React.MouseEvent, id: string, on: boolean) => {
    e.stopPropagation()
    setToggling(id)
    try { await setProgress(id, on) } finally { setToggling(null) }
  }

  const handleAssign = async (itemId: string, userId: string | null) => {
    setSavingAssign(true)

    try {
      await apiClient.patch(`/api/v1/eval/checklists/${itemId}/assign`, {
        assigned_user_id: userId,
      })
      await loadAll()
      setAssigningId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingAssign(false)
    }
  }

  const badgeFor = (done: boolean, daysLeft: number | null) => {
    if (done) return { text: '완료', cls: 'bg-green-100 text-green-700' }
    if (daysLeft == null) return { text: '미완료', cls: 'bg-gray-100 text-gray-500' }
    if (daysLeft < 0) { const o = -daysLeft; return { text: `${o}일 지남`, cls: o >= 14 ? 'bg-red-100 text-red-700' : o >= 7 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600' } }
    if (daysLeft === 0) return { text: '오늘 마감', cls: 'bg-red-100 text-red-700' }
    return { text: `D-${daysLeft}`, cls: daysLeft <= 3 ? 'bg-orange-100 text-orange-700' : daysLeft <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500' }
  }

  const renderRow = (d: Deco) => {
    const { item, done, daysLeft, dueStr, inProgress, startedBy } = d
    const b = badgeFor(done, daysLeft)
    const highRisk = item.riskLevel === 'high' && !done
    return (
      <div key={item.id} className={`rounded-lg border transition-colors hover:bg-gray-50/40 ${done ? 'bg-white border-gray-100 opacity-70' : inProgress ? 'bg-blue-50/40 border-blue-200 border-l-[3px] border-l-blue-400' : highRisk ? 'bg-white border-gray-200 border-l-[3px] border-l-red-400' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3 p-3">
          <button onClick={() => handleToggle(item.id, !checkDone(item, ''))} disabled={toggling === item.id}
            className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center disabled:opacity-50 ${done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-orange'}`}>
            {toggling === item.id ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" /> : done && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
          </button>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedItem(item)}>
            <p className={`text-sm font-semibold leading-snug truncate ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {highRisk && <AlertTriangle size={12} className="inline text-red-400 mr-1 align-[-2px]" />}
              {item.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${FREQUENCY_COLORS[item.frequency as any] ?? 'bg-gray-100 text-gray-600'}`}>{FREQUENCY_LABELS[item.frequency as any] ?? item.frequency}</span>
              {inProgress && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> 진행 중{startedBy ? ` · ${startedBy}` : ''}
                </span>
              )}
              {item.personName ? (
                <span className="text-[10px] font-semibold text-purple-600 flex items-center gap-0.5"><User size={9} />{item.personName}</span>
              ) : item.assignee ? (
                <span className="text-[10px] text-gray-400">{item.assignee}</span>
              ) : null}
              {dueStr && !done && <span className="text-[10px] text-gray-400">기한 {dueStr}</span>}
              {isAdmin && (
                <button type="button" onClick={e => { e.stopPropagation(); setAssigningId(assigningId === item.id ? null : item.id) }}
                  className="text-[10px] text-gray-400 hover:text-primary-orange border border-dashed border-gray-200 hover:border-primary-orange px-1.5 py-0.5 rounded-full">
                  {item.assignee ? '담당자 변경' : '+ 담당자'}
                </button>
              )}
            </div>
          </div>
          {!done && (
            inProgress ? (
              <button onClick={e => handleProgress(e, item.id, false)} disabled={toggling === item.id}
                title="착수 취소" className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50">진행 중</button>
            ) : (
              <button onClick={e => handleProgress(e, item.id, true)} disabled={toggling === item.id}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50">착수</button>
            )
          )}
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${b.cls}`}>{b.text}</span>
          {isAdmin && (
            <button onClick={e => { e.stopPropagation(); setEditItem(item) }} className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100 flex-shrink-0">수정</button>
          )}
        </div>
        {isAdmin && assigningId === item.id && (
          <AssignPanel itemId={item.id} currentUserId={(item as any).assigned_user_id ?? null} options={assigneeOptions} saving={savingAssign} onSave={handleAssign} onClose={() => setAssigningId(null)} />
        )}
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? '평가 체크리스트' : '내 체크리스트'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin
              ? '미완료 반복 업무는 주기 마감일까지 계속 표시됩니다'
              : '나에게 배정된 체크리스트만 표시됩니다'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCalOpen(true)}
            className="flex items-center gap-1.5 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-100 font-semibold"
          >
            <CalendarDays size={14} /> 달력
          </button>
          <button
            onClick={() => setQuickOpen(true)}
            className="flex items-center gap-1.5 text-sm text-white bg-primary-orange rounded-lg px-3 py-1.5 hover:bg-primary-orange/90 font-semibold shadow-sm"
          >
            <Zap size={14} /> 빠른 티켓
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 font-semibold"
          >
            <Plus size={14} /> 상세 추가
          </button>

          <button
            onClick={() => loadAll()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
          >
            <RotateCcw size={14} /> 새로고침
          </button>
        </div>
      </div>

      {/* 오늘 할 일 — 상단 강조(컴팩트) */}
      <button
        onClick={() => setFilterStatus('todo')}
        className="w-full text-left rounded-xl bg-gradient-to-r from-primary-orange to-orange-500 text-white px-4 py-3 shadow-sm active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-sm font-semibold text-orange-50">오늘 할 일</span>
            <span className="text-2xl font-extrabold leading-none">{metrics.overdue + metrics.todayDue}</span>
            <span className="text-sm font-bold">건</span>
          </div>
          <span className="text-xs text-orange-50 truncate flex-1 min-w-0">
            {metrics.overdue + metrics.todayDue > 0
              ? (metrics.overdue > 0 ? `기한 지난 ${metrics.overdue}건 포함` : '오늘 안에 처리해 주세요')
              : '급한 일 없어요 👍'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block w-16 h-1.5 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${metrics.total ? Math.round(metrics.done / metrics.total * 100) : 0}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums">{metrics.done}<span className="text-xs text-orange-100">/{metrics.total}</span></span>
          </div>
        </div>
      </button>

      {/* 요약 스트립 (관리자 상세) */}
      {isAdmin && (
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button onClick={() => setFilterStatus('todo')}
          className={`text-left rounded-xl p-3 sm:p-4 border transition-colors ${metrics.overdue > 0 ? 'bg-red-50 border-red-100 hover:bg-red-100' : 'bg-gray-50 border-gray-100'}`}>
          <p className={`text-[11px] sm:text-xs font-medium ${metrics.overdue > 0 ? 'text-red-500' : 'text-gray-500'}`}>기한 지남</p>
          <p className={`text-xl sm:text-2xl font-bold ${metrics.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{metrics.overdue}</p>
        </button>
        <button onClick={() => setFilterStatus('todo')}
          className="text-left rounded-xl p-3 sm:p-4 border bg-orange-50 border-orange-100 hover:bg-orange-100 transition-colors">
          <p className="text-[11px] sm:text-xs font-medium text-orange-500">이번 주 할 일</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">{metrics.weekTodo}</p>
        </button>
        <div className="rounded-xl p-3 sm:p-4 border bg-gray-50 border-gray-100">
          <p className="text-[11px] sm:text-xs font-medium text-gray-500">완료율</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{metrics.done}<span className="text-sm text-gray-400">/{metrics.total}</span></p>
        </div>
      </div>
      )}

      {/* 필터 바 (스크롤 시 상단 고정) */}
      <StickyToolbar>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="항목·이름·담당자 검색"
            className="w-full pl-9 pr-4 h-9 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40" />
        </div>

        <select value={activeFreq} onChange={e => setActiveFreq(e.target.value)}
          className="h-9 border border-gray-200 rounded-xl text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary-orange/40">
          <option value="all">주기: 전체</option>
          <optgroup label="정기 반복">
            {RECURRING.map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f as any]}</option>)}
          </optgroup>
          <optgroup label="기타">
            <option value={ONE_TIME}>{FREQUENCY_LABELS[ONE_TIME as any]}</option>
            {EVENT_FREQS.map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f as any]}</option>)}
          </optgroup>
        </select>


        <div className="flex border border-gray-200 rounded-xl overflow-hidden h-9">
          {([['todo', '미완료'], ['done', '완료'], ['all', '전체']] as ['todo' | 'done' | 'all', string][]).map(([v, label]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`text-sm px-3 transition-colors ${filterStatus === v ? 'bg-primary-orange text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      </StickyToolbar>

      {/* Jira식 인라인 빠른 발행 */}
      <div className="bg-white rounded-xl border border-dashed border-gray-300 focus-within:border-primary-orange focus-within:ring-2 focus-within:ring-primary-orange/20 transition-colors">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Plus size={16} className="text-gray-400 shrink-0" />
          <input
            value={quickTitle}
            onChange={e => setQuickTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd() }}
            placeholder="할 일을 입력하고 Enter로 바로 발행…"
            disabled={quickAdding}
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-gray-400 disabled:opacity-50"
          />
          {quickAdding
            ? <div className="w-4 h-4 border-2 border-primary-orange border-t-transparent rounded-full animate-spin shrink-0" />
            : <span className="text-[11px] text-gray-300 shrink-0 hidden sm:inline">Enter ↵</span>}
        </div>
        {lastCreated && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-50 bg-orange-50/40 text-xs">
            <CheckCircle2 size={13} className="text-green-500 shrink-0" />
            <span className="text-gray-600 truncate flex-1">‘{lastCreated.title}’ 발행됨 · 기본 기한 7일(일회성)</span>
            {isAdmin && (
              <button onClick={() => { setEditItem(lastCreated); setLastCreated(null) }}
                className="font-semibold text-primary-orange hover:underline shrink-0">주기·담당자 설정 →</button>
            )}
            <button onClick={() => setLastCreated(null)} className="text-gray-300 hover:text-gray-500 shrink-0">✕</button>
          </div>
        )}
      </div>

      {/* 목록 (긴급도별 그룹) */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{isAdmin ? '해당 조건의 항목이 없습니다.' : '나에게 배정된 항목이 없습니다.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {SECTION_DEFS.map(sec => groups[sec.key].length > 0 && (
            <div key={sec.key}>
              {sec.key === 'overdue' ? (
                <div className="flex items-center gap-2 mb-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 shadow-sm">
                  <AlertTriangle size={18} className="text-red-500 shrink-0" />
                  <span className="text-sm font-extrabold text-red-700">긴급 · 기한 지남</span>
                  <span className="text-[11px] text-red-500">지금 바로 처리가 필요해요</span>
                  <span className="ml-auto text-xs font-bold text-white bg-red-500 rounded-full px-2.5 py-0.5">{groups.overdue.length}건</span>
                </div>
              ) : (
                <p className={`text-xs font-semibold mb-1.5 px-0.5 ${sec.cls}`}>{sec.label} · {groups[sec.key].length}</p>
              )}
              <div className="space-y-1.5">
                {groups[sec.key].map(renderRow)}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <ChecklistDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {calOpen && <ChecklistCalendarModal onClose={() => setCalOpen(false)} />}

      {quickOpen && (
        <QuickTicketModal options={assigneeOptions} onClose={() => setQuickOpen(false)} onCreated={() => { setQuickOpen(false); loadAll() }} />
      )}

      {showAddModal && (
        <ChecklistFormModal onClose={() => setShowAddModal(false)} />
      )}

      {editItem && isAdmin && (
        <ChecklistFormModal existing={editItem} onClose={() => setEditItem(null)} />
      )}
    </div>
  )
}

function AssignPanel({
  itemId,
  currentUserId,
  options,
  saving,
  onSave,
  onClose,
}: {
  itemId: string
  currentUserId: string | null
  options: Array<{ id: string; name: string; position?: string | null }>
  saving: boolean
  onSave: (itemId: string, userId: string | null) => Promise<void>
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState<string>(currentUserId ?? '')

  return (
    <div
      className="border-t border-orange-100 bg-orange-50/50 px-4 py-3"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-xs font-semibold text-gray-600 mb-2">담당자 지정</p>

      <div className="flex gap-2">
        <select
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          disabled={saving}
        >
          <option value="">담당자 없음 (해제)</option>
          {options.map(u => (
            <option key={u.id} value={u.id}>
              {u.name}{u.position ? ` (${u.position})` : ''}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(itemId, selectedId || null)}
          className="text-xs font-semibold text-white bg-primary-orange px-3 py-2 rounded-xl hover:bg-primary-orange/90 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50"
        >
          취소
        </button>
      </div>
    </div>
  )
}

/* ── 빠른 티켓(일회성) 발행 ── */
function QuickTicketModal({ options, onClose, onCreated }: {
  options: Array<{ id: string; name: string; position?: string | null }>
  onClose: () => void
  onCreated: () => void
}) {
  const { addChecklist } = useLtcStore()
  const { user } = useAuthStore()
  const today = todayKST()
  const plus = (n: number) => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(plus(7))
  const [assignee, setAssignee] = useState(user?.id ?? '')
  const opts = user && !options.some(o => o.id === user.id)
    ? [{ id: user.id, name: `${user.name ?? '나'} (본인)`, position: (user as any).position ?? null }, ...options]
    : options
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!title.trim()) { setErr('할 일을 입력해주세요.'); return }
    if (!dueDate) { setErr('기한을 선택해주세요.'); return }
    setSaving(true); setErr('')
    try {
      await addChecklist({
        title: title.trim(), description: '', frequency: 'one_time' as any, dueDate,
        relatedIndicatorId: '', relatedCategoryId: '', relatedDomainId: '',
        assignee: '', assigned_user_id: assignee || null,
        evidenceRequired: '', storageLocation: '', howTo: '', evalNote: '', riskLevel: 'medium' as any,
        personId: undefined, personName: undefined, personType: 'facility',
        recurWeekday: null, recurWeekOfMonth: null, recurDay: null, recurDueDay: null,
        active: true, memo: '', attachmentName: '', completed: false,
        completionHistory: [], occurrences: [],
      } as any)
      onCreated()
    } catch (e: any) { setErr(e?.message ?? '발행 실패') } finally { setSaving(false) }
  }

  const chip = (label: string, v: string) => (
    <button type="button" onClick={() => setDueDate(v)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${dueDate === v ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-500 border-gray-200 hover:border-primary-orange/50'}`}>{label}</button>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-primary-orange" />
            <h2 className="font-bold text-gray-900">빠른 티켓 발행</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">할 일 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
              placeholder="예: 소방 점검표 제출"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">기한 *</label>
            <div className="flex items-center gap-1.5 mb-2">
              {chip('오늘', today)}{chip('내일', plus(1))}{chip('3일', plus(3))}{chip('1주', plus(7))}
            </div>
            <DateField value={dueDate} onChange={v => setDueDate(v)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">담당자 (선택)</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40">
              <option value="">미지정</option>
              {opts.map(u => <option key={u.id} value={u.id}>{u.name}{u.position ? ` (${u.position})` : ''}</option>)}
            </select>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-semibold">취소</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-primary-orange text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50">
            {saving ? '발행 중...' : '발행'}
          </button>
        </div>
      </div>
    </div>
  )
}
