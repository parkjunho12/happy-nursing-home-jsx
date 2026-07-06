import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  User,
  RotateCcw,
  Plus,
} from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/api/client'
import ChecklistDetailModal from '@/components/eval/ChecklistDetailModal'
import ChecklistFormModal from '@/components/eval/ChecklistFormModal'
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

type Deco = { item: ChecklistItem; done: boolean; daysLeft: number | null; dueStr: string | null }

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
    residents,
    staffList,
    loaded,
    loadAll,
    toggleComplete,
  } = useLtcStore()

  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [assigneeOptions, setAssigneeOptions] = useState<
    Array<{ id: string; name: string; position?: string | null }>
  >([])

  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null)
  const [editItem, setEditItem] = useState<ChecklistItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeFreq, setActiveFreq] = useState<string>('all')
  const [activePerson, setActivePerson] = useState('all')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'done' | 'todo'>('all')
  const [toggling, setToggling] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [savingAssign, setSavingAssign] = useState(false)

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
    return { item, done, daysLeft, dueStr }
  }, [todayStr])

  const activeResidents = residents.filter(r => r.status === 'active')
  const activeStaff = staffList.filter(s => s.status === 'active')

  const personCounts = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {}

    checklists
      .filter(c => c.active && c.personId)
      .forEach(c => {
        const pid = c.personId!
        if (!map[pid]) map[pid] = { total: 0, done: 0 }
        map[pid].total += 1
        if (isDone(c)) map[pid].done += 1
      })

    return map
  }, [checklists, isDone])


  const metrics = useMemo(() => {
    let overdue = 0, weekTodo = 0, done = 0, total = 0
    checklists.filter(c => c.active).forEach(c => {
      total++
      const d = deadlineOf(c)
      if (d.done) { done++; return }
      if (d.daysLeft != null && d.daysLeft < 0) overdue++
      else if (d.daysLeft != null && d.daysLeft <= 7) weekTodo++
    })
    return { overdue, weekTodo, done, total }
  }, [checklists, deadlineOf])

  const filtered = useMemo(() => {
    return checklists.filter(c => {
      if (!c.active) return false

      if (activeFreq !== 'all' && c.frequency !== activeFreq) return false

      if (activePerson === 'facility') {
        if (c.personId) return false
      } else if (activePerson !== 'all') {
        if (c.personId !== activePerson) return false
      }

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
  }, [checklists, activeFreq, activePerson, filterStatus, search, isDone])

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

  const handleToggle = async (id: string, desired?: boolean) => {
    setToggling(id)

    try {
      await toggleComplete(id, desired)
    } finally {
      setToggling(null)
    }
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
    const { item, done, daysLeft, dueStr } = d
    const b = badgeFor(done, daysLeft)
    const highRisk = item.riskLevel === 'high' && !done
    return (
      <div key={item.id} className={`bg-white rounded-lg border transition-colors hover:bg-gray-50/40 ${done ? 'border-gray-100 opacity-70' : highRisk ? 'border-gray-200 border-l-[3px] border-l-red-400' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3 p-3">
          <button onClick={() => handleToggle(item.id, !checkDone(item, ''))} disabled={toggling === item.id}
            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center disabled:opacity-50 ${done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-orange'}`}>
            {toggling === item.id ? <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin" /> : done && <div className="w-2 h-2 bg-white rounded-full" />}
          </button>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedItem(item)}>
            <p className={`text-sm font-semibold leading-snug truncate ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {highRisk && <AlertTriangle size={12} className="inline text-red-400 mr-1 align-[-2px]" />}
              {item.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${FREQUENCY_COLORS[item.frequency as any] ?? 'bg-gray-100 text-gray-600'}`}>{FREQUENCY_LABELS[item.frequency as any] ?? item.frequency}</span>
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
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-sm text-white bg-primary-orange rounded-lg px-3 py-1.5 hover:bg-primary-orange/90 font-semibold shadow-sm"
          >
            <Plus size={14} /> 항목 추가
          </button>

          <button
            onClick={() => loadAll()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
          >
            <RotateCcw size={14} /> 새로고침
          </button>
        </div>
      </div>

      {/* 요약 스트립 */}
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

      {/* 필터 바 */}
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

        {isAdmin && (
          <select value={activePerson} onChange={e => setActivePerson(e.target.value)}
            className="h-9 border border-gray-200 rounded-xl text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary-orange/40">
            <option value="all">대상: 전체</option>
            <option value="facility">시설 공통</option>
            <optgroup label={`수급자 ${activeResidents.length}명`}>
              {activeResidents.map(r => { const c = personCounts[r.id]; return <option key={r.id} value={r.id}>{r.name}{c ? ` (${c.done}/${c.total})` : ''}</option> })}
            </optgroup>
            <optgroup label={`직원 ${activeStaff.length}명`}>
              {activeStaff.map(st => { const c = personCounts[st.id]; return <option key={st.id} value={st.id}>{st.name}{c ? ` (${c.done}/${c.total})` : ''}</option> })}
            </optgroup>
          </select>
        )}

        <div className="flex border border-gray-200 rounded-xl overflow-hidden h-9">
          {([['todo', '미완료'], ['done', '완료'], ['all', '전체']] as ['todo' | 'done' | 'all', string][]).map(([v, label]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`text-sm px-3 transition-colors ${filterStatus === v ? 'bg-primary-orange text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
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