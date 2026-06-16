import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search, AlertTriangle, CheckCircle2, User, RotateCcw,
  Plus, Clock, Users, X,
} from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { useAuthStore } from '@/store/auth'
import { checklistAssignAPI, staffAccountAPI, type StaffUser } from '@/api/staffAccountClient'
import ChecklistDetailModal from '@/components/eval/ChecklistDetailModal'
import ChecklistFormModal from '@/components/eval/ChecklistFormModal'
import type { ChecklistItem } from '@/utils/period'
import {
  FREQUENCY_LABELS, FREQUENCY_COLORS, RISK_COLORS, RISK_LABELS, DOMAIN_COLORS,
  RECURRING, EVENT_FREQS, getCurrentPeriodKey, getPeriodLabel, getPeriodEnd, todayKST,
} from '@/utils/period'

const ONE_TIME = 'one_time'

function checkDone(item: ChecklistItem, _todayStr: string): boolean {
  const freq = item.frequency
  if (freq === ONE_TIME) {
    if (item.occurrences?.length > 0) return item.occurrences.some(o => o.status === 'completed')
    return item.completed
  }
  if (EVENT_FREQS.includes(freq as any)) return item.completed
  if (item.occurrences?.length > 0) {
    const pk = getCurrentPeriodKey(freq as any)
    const occ = item.occurrences.find(o => o.periodKey === pk)
    if (occ) return occ.status === 'completed'
  }
  const pk = getCurrentPeriodKey(freq as any)
  return item.completionHistory.some(r => r.periodKey === pk)
}

export default function EvalChecklistPage() {
  const { checklists, residents, staffList, domains, loaded, loadAll, toggleComplete } = useLtcStore()
  const { user } = useAuthStore()

  const role     = String(user?.role     ?? '').toUpperCase()
  const position = String((user as any)?.position ?? '')
  const isAdmin  = role === 'ADMIN' || role === 'MANAGER' ||
    position === '대표' || position === '시설장' || position === '사무국장'

  // ── state ──────────────────────────────────────────────────────────────
  const [myTaskItemIds, setMyTaskItemIds] = useState<Set<string>>(new Set())
  const [tasksLoaded,   setTasksLoaded]   = useState(false)
  const [selectedItem,  setSelectedItem]  = useState<ChecklistItem | null>(null)
  const [editItem,      setEditItem]      = useState<ChecklistItem | null>(null)
  const [showAddModal,  setShowAddModal]  = useState(false)
  const [activeFreq,    setActiveFreq]    = useState<string>('all')
  const [activePerson,  setActivePerson]  = useState('all')
  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState<'all' | 'done' | 'todo'>('all')
  const [toggling,      setToggling]      = useState<string | null>(null)

  // 담당자 지정
  const [assigningItem,  setAssigningItem]  = useState<string | null>(null)
  const [staffUsers,     setStaffUsers]     = useState<StaffUser[]>([])
  const [savingAssign,   setSavingAssign]   = useState(false)

  // ── effects ────────────────────────────────────────────────────────────
  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  // 직원 목록 (담당자 지정 드롭다운용)
  useEffect(() => {
    if (!isAdmin) return
    staffAccountAPI.list()
      .then(list => setStaffUsers(list.filter(u => u.is_active)))
      .catch(() => {})
  }, [isAdmin])

  // STAFF: 내 담당 항목만 로드
  useEffect(() => {
    if (isAdmin) { setTasksLoaded(true); return }
    setTasksLoaded(false)
    checklistAssignAPI.myTasks()
      .then(tasks => {
        const ids = tasks.map((t: any) =>
          t.item_id ?? t.itemId ?? t.checklist_item_id ?? t.checklistItemId ?? t.id
        ).filter(Boolean)
        setMyTaskItemIds(new Set(ids))
        setTasksLoaded(true)
      })
      .catch(() => { setMyTaskItemIds(new Set()); setTasksLoaded(true) })
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

  // ── memos ─────────────────────────────────────────────────────────────
  const isDone = useCallback((item: ChecklistItem) => checkDone(item, todayStr), [todayStr])

  const visibleChecklists = useMemo(() => {
    if (isAdmin) return checklists
    if (!tasksLoaded) return []
    return checklists.filter(c => myTaskItemIds.has(c.id))
  }, [checklists, isAdmin, tasksLoaded, myTaskItemIds])

  const activeResidents = residents.filter(r => r.status === 'active')
  const activeStaff     = staffList.filter(s => s.status === 'active')

  const personCounts = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {}
    visibleChecklists.filter(c => c.active && c.personId).forEach(c => {
      const pid = c.personId!
      if (!map[pid]) map[pid] = { total: 0, done: 0 }
      map[pid].total += 1
      if (isDone(c)) map[pid].done += 1
    })
    return map
  }, [visibleChecklists, isDone])

  const stats = useMemo(() => {
    const recurring = visibleChecklists.filter(c => c.active && RECURRING.includes(c.frequency as any))
    const oneTimePending = visibleChecklists.filter(c =>
      c.active && c.frequency === ONE_TIME && !isDone(c) && (!c.dueDate || c.dueDate >= todayStr)
    )
    return {
      recurringDone:  recurring.filter(c => isDone(c)).length,
      recurringTotal: recurring.length,
      personalDone:   visibleChecklists.filter(c => c.active && c.personId && isDone(c)).length,
      personalTotal:  visibleChecklists.filter(c => c.active && c.personId).length,
      highRisk:       visibleChecklists.filter(c => c.active && !isDone(c) && c.riskLevel === 'high').length,
      totalTodo:      visibleChecklists.filter(c => c.active && !isDone(c)).length,
      oneTimeTodo:    oneTimePending.length,
    }
  }, [visibleChecklists, isDone, todayStr])

  const filtered = useMemo(() => visibleChecklists.filter(c => {
    if (!c.active) return false
    if (activeFreq !== 'all' && c.frequency !== activeFreq) return false
    if (isAdmin) {
      if (activePerson === 'facility') { if (c.personId) return false }
      else if (activePerson !== 'all') { if (c.personId !== activePerson) return false }
    }
    const done = isDone(c)
    if (filterStatus === 'done' && !done) return false
    if (filterStatus === 'todo' && done) return false
    if (search) {
      const q = search.toLowerCase()
      const assigneeText = (c.assignee ?? '') + ' ' +
        ((c as any).assignees ?? []).map((a: any) => `${a.name ?? ''} ${a.position ?? ''}`).join(' ')
      if (!c.title.toLowerCase().includes(q) && !assigneeText.toLowerCase().includes(q) &&
          !(c.personName?.toLowerCase().includes(q))) return false
    }
    return true
  }), [visibleChecklists, activeFreq, activePerson, filterStatus, search, isDone, isAdmin])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const da = isDone(a), db = isDone(b)
    if (da !== db) return da ? 1 : -1
    if (!da) {
      if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1
      if (b.riskLevel === 'high' && a.riskLevel !== 'high') return 1
    }
    return 0
  }), [filtered, isDone])

  // ── handlers ──────────────────────────────────────────────────────────
  const handleToggle = async (id: string) => {
    setToggling(id)
    try { await toggleComplete(id); await loadAll() }
    finally { setToggling(null) }
  }

  const handleSetAssignees = async (itemId: string, userIds: string[]) => {
    setSavingAssign(true)
    try {
      await checklistAssignAPI.setAssignees(itemId, userIds)
      await loadAll()
      setAssigningItem(null)
    } catch (e) { console.error(e) }
    finally { setSavingAssign(false) }
  }

  const getAssigneeLabel = (item: ChecklistItem) => {
    const assignees = (item as any).assignees as Array<{ user_id: string; name: string; position?: string }> | undefined
    if (assignees && assignees.length > 0)
      return assignees.map(a => a.position ? `${a.name}(${a.position})` : a.name).join(', ')
    return item.assignee
  }

  // ── 로딩 가드 (모든 Hook 이후) ─────────────────────────────────────────
  if (!loaded) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-sm text-gray-500">불러오는 중...</p>
      </div>
    </div>
  )

  if (!isAdmin && !tasksLoaded) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary-orange border-t-transparent rounded-full animate-spin mr-2"/>
      <span className="text-sm text-gray-500">내 담당 항목 불러오는 중...</span>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? '평가 체크리스트' : '내 체크리스트'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? '미완료 반복 업무는 주기 마감일까지 계속 표시됩니다' : '나에게 배정된 체크리스트만 표시됩니다'}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 text-sm text-white bg-primary-orange rounded-lg px-3 py-1.5 hover:bg-primary-orange/90 font-semibold shadow-sm">
              <Plus size={14}/> 항목 추가
            </button>
          )}
          <button onClick={() => loadAll()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            <RotateCcw size={14}/> 새로고침
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="정기 업무"       value={`${stats.recurringDone}/${stats.recurringTotal}`} sub="현재 주기 완료" color="orange"/>
        <SummaryCard label="개인별 체크리스트" value={`${stats.personalDone}/${stats.personalTotal}`}  sub="수급자·직원 개인" color="green"/>
        <SummaryCard label="위험도 높음"      value={`${stats.highRisk}건`}  sub="즉시 조치 필요" color="red"/>
        <SummaryCard label="전체 미완료"      value={`${stats.totalTodo}건`} sub={stats.oneTimeTodo > 0 ? `일회성 ${stats.oneTimeTodo}건 포함` : '활성 항목 기준'} color="gray"/>
      </div>

      {/* 대상별 탭 (ADMIN만) */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 mb-2 px-1">대상별 보기</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <PersonTab active={activePerson === 'all'}      onClick={() => setActivePerson('all')}      label="전체"/>
            <PersonTab active={activePerson === 'facility'} onClick={() => setActivePerson('facility')} label="시설 공통" color="orange"/>
            {activeResidents.map(r => {
              const cnt = personCounts[r.id]
              return <PersonTab key={r.id} active={activePerson === r.id} onClick={() => setActivePerson(r.id)}
                label={r.name} color="purple" badge={cnt ? `${cnt.done}/${cnt.total}` : undefined} allDone={cnt?.done === cnt?.total}/>
            })}
            {activeStaff.map(s => {
              const cnt = personCounts[s.id]
              return <PersonTab key={s.id} active={activePerson === s.id} onClick={() => setActivePerson(s.id)}
                label={s.name} color="blue" badge={cnt ? `${cnt.done}/${cnt.total}` : undefined} allDone={cnt?.done === cnt?.total}/>
            })}
          </div>
        </div>
      )}

      {/* 주기 탭 */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <TabBtn active={activeFreq === 'all'} onClick={() => setActiveFreq('all')}>전체</TabBtn>
          {RECURRING.map(f => (
            <TabBtn key={f} active={activeFreq === f} onClick={() => setActiveFreq(f)}>{FREQUENCY_LABELS[f as any]}</TabBtn>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 items-center">
          <span className="text-xs text-gray-400 pl-1 flex-shrink-0">기타</span>
          <TabBtn active={activeFreq === ONE_TIME} onClick={() => setActiveFreq(ONE_TIME)} amber>
            일회성{stats.oneTimeTodo > 0 ? ` (${stats.oneTimeTodo})` : ''}
          </TabBtn>
          {EVENT_FREQS.map(f => (
            <TabBtn key={f} active={activeFreq === f} onClick={() => setActiveFreq(f)} event>{FREQUENCY_LABELS[f as any]}</TabBtn>
          ))}
        </div>
      </div>

      {/* 검색 & 필터 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="항목명, 이름, 담당자..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"/>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-orange/40 bg-white flex-shrink-0">
          <option value="all">전체 상태</option>
          <option value="todo">미완료</option>
          <option value="done">완료</option>
        </select>
      </div>

      <p className="text-xs text-gray-400">{sorted.length}개 항목</p>

      {/* 체크리스트 목록 */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">
            {isAdmin ? '해당 조건의 항목이 없습니다.' : '나에게 배정된 체크리스트가 없습니다.'}
          </p>
          {!isAdmin && (
            <p className="text-xs text-gray-300 mt-1">관리자에게 담당자 지정을 요청하세요.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(item => {
            const domain = domains.find(d => d.id === item.relatedDomainId)
            const domainColors = domain ? DOMAIN_COLORS[domain.color] ?? DOMAIN_COLORS.teal : null
            const done = isDone(item)
            const isOneTime = item.frequency === ONE_TIME
            let periodLabel = '', daysLeft: number | null = null

            if (isOneTime && item.dueDate) {
              periodLabel = `기한 ${item.dueDate}`
              daysLeft = Math.max(0, Math.ceil(
                (new Date(item.dueDate + 'T23:59:59').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000
              ))
            } else if (RECURRING.includes(item.frequency as any)) {
              const pk = getCurrentPeriodKey(item.frequency as any)
              periodLabel = getPeriodLabel(item.frequency as any, pk)
              const end = getPeriodEnd(item.frequency as any)
              daysLeft = Math.max(0, Math.ceil((end.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000))
            }

            const isExpired = isOneTime && !!item.dueDate && item.dueDate < todayStr && !done
            const assigneeLabel = getAssigneeLabel(item)
            const itemAssignees = ((item as any).assignees ?? []) as Array<{user_id:string;name:string;position?:string}>
            const isAssigning = assigningItem === item.id

            return (
              <div key={item.id}
                className={`bg-white rounded-xl border shadow-sm transition-all ${
                  done ? 'border-gray-100 opacity-70' :
                  isExpired ? 'border-red-200 bg-red-50/30' :
                  item.riskLevel === 'high' ? 'border-red-200' :
                  item.personId ? 'border-purple-100' : 'border-gray-200'
                }`}>
                <div className="flex items-start gap-3 p-4">
                  {/* 완료 토글 */}
                  <button onClick={() => handleToggle(item.id)} disabled={toggling === item.id}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-50 ${
                      done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-orange'
                    }`}>
                    {toggling === item.id
                      ? <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin"/>
                      : done && <div className="w-2 h-2 bg-white rounded-full"/>}
                  </button>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedItem(item)}>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {item.personName && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 bg-purple-100 text-purple-700">
                          <User size={9}/>{item.personName}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FREQUENCY_COLORS[item.frequency as any] ?? 'bg-gray-100 text-gray-600'}`}>
                        {FREQUENCY_LABELS[item.frequency as any] ?? item.frequency}
                      </span>
                      {domain && domainColors && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${domainColors.bg} ${domainColors.text}`}>{domain.name}</span>
                      )}
                      {!done && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[item.riskLevel]}`}>{RISK_LABELS[item.riskLevel]}</span>}
                      {done && <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">완료</span>}
                      {isExpired && <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">기한 초과</span>}
                    </div>

                    <p className={`text-sm font-semibold leading-snug ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {item.title}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {periodLabel && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                          <Clock size={9}/>{periodLabel}
                        </span>
                      )}

                      {/* 담당자 뱃지 */}
                      {assigneeLabel && (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                          <Users size={9}/>{assigneeLabel}
                        </span>
                      )}

                      {/* 담당자 지정 버튼 (ADMIN만) */}
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); setAssigningItem(isAssigning ? null : item.id) }}
                          className={`inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${
                            isAssigning
                              ? 'bg-orange-100 text-orange-700 border-orange-300'
                              : 'text-gray-400 hover:text-primary-orange border-dashed border-gray-200 hover:border-primary-orange hover:bg-orange-50'
                          }`}
                        >
                          <Users size={9}/>
                          {assigneeLabel ? '담당자 변경' : '+ 담당자 지정'}
                        </button>
                      )}

                      {daysLeft !== null && !done && !isExpired && (
                        <span className={`text-[11px] font-bold ${
                          daysLeft === 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-red-500' :
                          daysLeft <= 7 ? 'text-orange-500' : 'text-gray-400'
                        }`}>
                          {daysLeft === 0 ? '오늘 마감' : `D-${daysLeft}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 우측 액션 */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {item.riskLevel === 'high' && !done && <AlertTriangle size={15} className="text-red-400"/>}
                    {isAdmin && (
                      <button onClick={e => { e.stopPropagation(); setEditItem(item) }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors">
                        수정
                      </button>
                    )}
                  </div>
                </div>

                {/* 담당자 지정 인라인 패널 */}
                {isAdmin && isAssigning && (
                  <AssigneePanel
                    itemId={item.id}
                    currentAssignees={itemAssignees}
                    staffUsers={staffUsers}
                    saving={savingAssign}
                    onSave={handleSetAssignees}
                    onClose={() => setAssigningItem(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedItem && <ChecklistDetailModal item={selectedItem} onClose={() => setSelectedItem(null)}/>}
      {showAddModal && isAdmin && <ChecklistFormModal onClose={() => setShowAddModal(false)}/>}
      {editItem && isAdmin && <ChecklistFormModal existing={editItem} onClose={() => setEditItem(null)}/>}
    </div>
  )
}

// ── 담당자 지정 인라인 패널 ───────────────────────────────────────────────────
function AssigneePanel({ itemId, currentAssignees, staffUsers, saving, onSave, onClose }: {
  itemId: string
  currentAssignees: Array<{ user_id: string; name: string; position?: string }>
  staffUsers: StaffUser[]
  saving: boolean
  onSave: (itemId: string, userIds: string[]) => Promise<void>
  onClose: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(currentAssignees.map(a => a.user_id))

  const toggle = (uid: string) =>
    setSelectedIds(ids => ids.includes(uid) ? ids.filter(i => i !== uid) : [...ids, uid])

  // 직책 그룹별 정렬
  const grouped = staffUsers.reduce((acc, u) => {
    const key = u.position || '기타'
    if (!acc[key]) acc[key] = []
    acc[key].push(u)
    return acc
  }, {} as Record<string, StaffUser[]>)

  return (
    <div className="border-t border-orange-100 bg-orange-50/40 px-4 pb-4 pt-3"
      onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
          <Users size={12} className="text-primary-orange"/>
          담당자 지정
        </p>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={14}/>
        </button>
      </div>

      {/* 선택된 담당자 뱃지 */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {selectedIds.map(uid => {
            const u = staffUsers.find(s => s.id === uid)
            if (!u) return null
            return (
              <span key={uid}
                className="flex items-center gap-1 bg-orange-100 text-orange-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                {u.name}{u.position && <span className="text-orange-500">({u.position})</span>}
                <button type="button" onClick={() => toggle(uid)} className="hover:text-red-600 ml-0.5">
                  <X size={9}/>
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* 직원 선택 목록 */}
      <div className="max-h-52 overflow-y-auto bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {staffUsers.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">직원 계정이 없습니다</p>
        ) : Object.entries(grouped).map(([pos, users]) => (
          <div key={pos}>
            <p className="text-[10px] font-bold text-gray-400 px-3 py-1.5 bg-gray-50">{pos}</p>
            {users.map(u => {
              const selected = selectedIds.includes(u.id)
              return (
                <button type="button" key={u.id} onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${selected ? 'bg-orange-50' : ''}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selected ? 'bg-primary-orange border-primary-orange' : 'border-gray-300'
                  }`}>
                    {selected && <div className="w-2 h-2 bg-white rounded-sm"/>}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800">{u.name}</span>
                    {u.position && <span className="text-[11px] text-gray-400 ml-1.5">{u.position}</span>}
                  </div>
                  {selected && <span className="ml-auto text-[10px] text-primary-orange font-bold">✓</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => onSave(itemId, selectedIds)}
          disabled={saving}
          className="flex-1 bg-primary-orange text-white text-xs font-bold py-2 rounded-xl hover:bg-primary-orange/90 disabled:opacity-50">
          {saving ? '저장 중...' : `담당자 저장 (${selectedIds.length}명)`}
        </button>
        <button
          type="button"
          onClick={() => { setSelectedIds([]); onSave(itemId, []) }}
          disabled={saving}
          className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50">
          전체 해제
        </button>
      </div>
    </div>
  )
}

// ── 서브 컴포넌트들 ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }: { label:string; value:string; sub:string; color:string }) {
  const bg = { orange:'bg-orange-50', green:'bg-green-50', red:'bg-red-50', gray:'bg-gray-50' }[color] ?? 'bg-gray-50'
  return (
    <div className={`${bg} rounded-xl p-4 border border-white shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

function PersonTab({ active, onClick, label, color='gray', badge, allDone }: {
  active:boolean; onClick:()=>void; label:string; color?:string; badge?:string; allDone?:boolean
}) {
  const base: Record<string,string> = { gray:'border-gray-200 text-gray-600 hover:bg-gray-50', orange:'border-orange-200 text-orange-700 hover:bg-orange-50', purple:'border-purple-200 text-purple-700 hover:bg-purple-50', blue:'border-blue-200 text-blue-700 hover:bg-blue-50' }
  const act:  Record<string,string> = { gray:'bg-gray-700 border-gray-700 text-white', orange:'bg-primary-orange border-primary-orange text-white', purple:'bg-purple-600 border-purple-600 text-white', blue:'bg-blue-600 border-blue-600 text-white' }
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors flex-shrink-0 bg-white ${active ? act[color] : base[color]}`}>
      <User size={11}/>{label}
      {badge && (
        <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/30 text-white' : allDone ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function TabBtn({ active, onClick, children, event, amber }: {
  active:boolean; onClick:()=>void; children:React.ReactNode; event?:boolean; amber?:boolean
}) {
  const activeClass = amber ? 'bg-amber-500 text-white shadow-sm' : event ? 'bg-teal-600 text-white shadow-sm' : 'bg-primary-orange text-white shadow-sm'
  const inactiveClass = amber ? 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50' : event ? 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-50' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${active ? activeClass : inactiveClass}`}>
      {children}
    </button>
  )
}
