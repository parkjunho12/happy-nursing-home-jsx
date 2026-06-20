import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  User,
  RotateCcw,
  Plus,
  Clock,
  Filter,
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
  RISK_COLORS,
  RISK_LABELS,
  DOMAIN_COLORS,
  RECURRING,
  EVENT_FREQS,
  getCurrentPeriodKey,
  getPeriodLabel,
  getPeriodEnd,
  todayKST,
} from '@/utils/period'

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

  if (item.occurrences?.length > 0) {
    const pk = getCurrentPeriodKey(freq as any)
    const occ = item.occurrences.find(o => o.periodKey === pk)
    if (occ) return occ.status === 'completed'
  }

  const pk = getCurrentPeriodKey(freq as any)
  return item.completionHistory.some(r => r.periodKey === pk)
}

export default function EvalChecklistPage() {
  const {
    checklists,
    residents,
    staffList,
    domains,
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
  const [personSearch, setPersonSearch] = useState('')
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

  const personOptions = useMemo(() => {
    const options = [
      { id: 'all', label: '전체', type: 'all' },
      { id: 'facility', label: '시설 공통', type: 'facility' },
      ...activeResidents.map(r => ({
        id: r.id,
        label: r.name,
        type: 'resident',
      })),
      ...activeStaff.map(s => ({
        id: s.id,
        label: s.name,
        type: 'staff',
      })),
    ]

    if (!personSearch.trim()) return options

    const q = personSearch.trim().toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [activeResidents, activeStaff, personSearch])

  const stats = useMemo(() => {
    const recurring = checklists.filter(
      c => c.active && RECURRING.includes(c.frequency as any),
    )

    const oneTimePending = checklists.filter(
      c =>
        c.active &&
        c.frequency === ONE_TIME &&
        !isDone(c) &&
        (!c.dueDate || c.dueDate >= todayStr),
    )

    return {
      recurringDone: recurring.filter(c => isDone(c)).length,
      recurringTotal: recurring.length,
      personalDone: checklists.filter(c => c.active && c.personId && isDone(c)).length,
      personalTotal: checklists.filter(c => c.active && c.personId).length,
      highRisk: checklists.filter(c => c.active && !isDone(c) && c.riskLevel === 'high').length,
      totalTodo: checklists.filter(c => c.active && !isDone(c)).length,
      oneTimeTodo: oneTimePending.length,
    }
  }, [checklists, isDone, todayStr])

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

  const handleToggle = async (id: string) => {
    setToggling(id)

    try {
      await toggleComplete(id)
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="정기 업무"
          value={`${stats.recurringDone}/${stats.recurringTotal}`}
          sub="현재 주기 완료"
          color="orange"
        />
        <SummaryCard
          label="개인별 체크리스트"
          value={`${stats.personalDone}/${stats.personalTotal}`}
          sub="수급자·직원 개인"
          color="green"
        />
        <SummaryCard
          label="위험도 높음"
          value={`${stats.highRisk}건`}
          sub="즉시 조치 필요"
          color="red"
        />
        <SummaryCard
          label="전체 미완료"
          value={`${stats.totalTodo}건`}
          sub={stats.oneTimeTodo > 0 ? `일회성 ${stats.oneTimeTodo}건 포함` : '모든 활성 항목'}
          color="gray"
        />
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-xs font-semibold text-gray-400 px-1 flex items-center gap-1">
              <Filter size={12} />
              대상별 보기
            </p>

            {activePerson !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setActivePerson('all')
                  setPersonSearch('')
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                초기화
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-2">
            <select
              value={activePerson}
              onChange={e => setActivePerson(e.target.value)}
              className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
            >
              <option value="all">전체</option>
              <option value="facility">시설 공통</option>

              <optgroup label={`수급자 ${activeResidents.length}명`}>
                {activeResidents.map(r => {
                  const cnt = personCounts[r.id]

                  return (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {cnt ? ` (${cnt.done}/${cnt.total})` : ''}
                    </option>
                  )
                })}
              </optgroup>

              <optgroup label={`직원 ${activeStaff.length}명`}>
                {activeStaff.map(s => {
                  const cnt = personCounts[s.id]

                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {cnt ? ` (${cnt.done}/${cnt.total})` : ''}
                    </option>
                  )
                })}
              </optgroup>
            </select>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={personSearch}
                onChange={e => setPersonSearch(e.target.value)}
                placeholder="어르신/직원 이름 검색"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
              />

              {personSearch && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {personOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">
                      검색 결과가 없습니다.
                    </div>
                  ) : (
                    personOptions.map(o => (
                      <button
                        key={`${o.type}-${o.id}`}
                        type="button"
                        onClick={() => {
                          setActivePerson(o.id)
                          setPersonSearch('')
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex items-center justify-between"
                      >
                        <span>
                          {o.type === 'resident' && '👵 '}
                          {o.type === 'staff' && '👤 '}
                          {o.type === 'facility' && '🏥 '}
                          {o.label}
                        </span>

                        {personCounts[o.id] && (
                          <span className="text-xs text-orange-600 font-semibold">
                            {personCounts[o.id].done}/{personCounts[o.id].total}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <TabBtn active={activeFreq === 'all'} onClick={() => setActiveFreq('all')}>
            전체
          </TabBtn>

          {RECURRING.map(f => (
            <TabBtn key={f} active={activeFreq === f} onClick={() => setActiveFreq(f)}>
              {FREQUENCY_LABELS[f as any]}
            </TabBtn>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 items-center">
          <span className="text-xs text-gray-400 pl-1 flex-shrink-0">기타</span>

          <TabBtn active={activeFreq === ONE_TIME} onClick={() => setActiveFreq(ONE_TIME)} amber>
            일회성{stats.oneTimeTodo > 0 ? ` (${stats.oneTimeTodo})` : ''}
          </TabBtn>

          {EVENT_FREQS.map(f => (
            <TabBtn key={f} active={activeFreq === f} onClick={() => setActiveFreq(f)} event>
              {FREQUENCY_LABELS[f as any]}
            </TabBtn>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="항목명, 이름, 담당자..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-orange/40 bg-white flex-shrink-0"
        >
          <option value="all">전체 상태</option>
          <option value="todo">미완료</option>
          <option value="done">완료</option>
        </select>
      </div>

      <p className="text-xs text-gray-400">{sorted.length}개 항목</p>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {isAdmin ? '해당 조건의 항목이 없습니다.' : '나에게 배정된 항목이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(item => {
            const domain = domains.find(d => d.id === item.relatedDomainId)
            const domainColors = domain
              ? DOMAIN_COLORS[domain.color] ?? DOMAIN_COLORS.teal
              : null
            const done = isDone(item)
            const isOneTime = item.frequency === ONE_TIME

            let periodLabel = ''
            let daysLeft: number | null = null

            if (isOneTime && item.dueDate) {
              periodLabel = `기한 ${item.dueDate}`
              daysLeft = Math.max(
                0,
                Math.ceil(
                  (new Date(item.dueDate + 'T23:59:59').getTime() -
                    new Date(todayStr + 'T00:00:00').getTime()) /
                    86400000,
                ),
              )
            } else if (RECURRING.includes(item.frequency as any)) {
              const pk = getCurrentPeriodKey(item.frequency as any)
              periodLabel = getPeriodLabel(item.frequency as any, pk)
              const end = getPeriodEnd(item.frequency as any)

              daysLeft = Math.max(
                0,
                Math.ceil(
                  (end.getTime() - new Date(todayStr + 'T00:00:00').getTime()) /
                    86400000,
                ),
              )
            }

            const isExpired =
              isOneTime && !!item.dueDate && item.dueDate < todayStr && !done

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border shadow-sm transition-all hover:shadow-md ${
                  done
                    ? 'border-gray-100 opacity-70'
                    : isExpired
                      ? 'border-red-200 bg-red-50/30'
                      : item.riskLevel === 'high'
                        ? 'border-red-200'
                        : item.personId
                          ? 'border-purple-100'
                          : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <button
                    onClick={() => handleToggle(item.id)}
                    disabled={toggling === item.id}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-50 ${
                      done
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 hover:border-primary-orange'
                    }`}
                  >
                    {toggling === item.id ? (
                      <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      done && <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </button>

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {item.personName && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 bg-purple-100 text-purple-700">
                          <User size={9} />
                          {item.personName}
                        </span>
                      )}

                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          FREQUENCY_COLORS[item.frequency as any] ??
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {FREQUENCY_LABELS[item.frequency as any] ?? item.frequency}
                      </span>

                      {domain && domainColors && (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${domainColors.bg} ${domainColors.text}`}
                        >
                          {domain.name}
                        </span>
                      )}

                      {!done && (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[item.riskLevel]}`}
                        >
                          {RISK_LABELS[item.riskLevel]}
                        </span>
                      )}

                      {done && (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                          완료
                        </span>
                      )}

                      {isExpired && (
                        <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                          기한 초과
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-sm font-semibold leading-snug ${
                        done ? 'text-gray-400 line-through' : 'text-gray-800'
                      }`}
                    >
                      {item.title}
                    </p>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {periodLabel && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                          <Clock size={9} />
                          {periodLabel}
                        </span>
                      )}

                      {item.assignee && (
                        <span className="text-[11px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                          👤 {item.assignee}
                        </span>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            setAssigningId(assigningId === item.id ? null : item.id)
                          }}
                          className="text-[11px] text-gray-400 hover:text-primary-orange border border-dashed border-gray-200 hover:border-primary-orange px-1.5 py-0.5 rounded-full transition-colors"
                        >
                          {item.assignee ? '담당자 변경' : '+ 담당자'}
                        </button>
                      )}

                      {daysLeft !== null && !done && !isExpired && (
                        <span
                          className={`text-[11px] font-bold ${
                            daysLeft === 0
                              ? 'text-red-600'
                              : daysLeft <= 3
                                ? 'text-red-500'
                                : daysLeft <= 7
                                  ? 'text-orange-500'
                                  : 'text-gray-400'
                          }`}
                        >
                          {daysLeft === 0 ? '오늘 마감' : `D-${daysLeft}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {item.riskLevel === 'high' && !done && (
                      <AlertTriangle size={15} className="text-red-400" />
                    )}

                    {isAdmin && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setEditItem(item)
                        }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        수정
                      </button>
                    )}
                  </div>
                </div>

                {isAdmin && assigningId === item.id && (
                  <AssignPanel
                    itemId={item.id}
                    currentUserId={(item as any).assigned_user_id ?? null}
                    options={assigneeOptions}
                    saving={savingAssign}
                    onSave={handleAssign}
                    onClose={() => setAssigningId(null)}
                  />
                )}
              </div>
            )
          })}
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

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color: string
}) {
  const bg =
    {
      orange: 'bg-orange-50',
      green: 'bg-green-50',
      red: 'bg-red-50',
      gray: 'bg-gray-50',
    }[color] ?? 'bg-gray-50'

  return (
    <div className={`${bg} rounded-xl p-4 border border-white shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
  event,
  amber,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  event?: boolean
  amber?: boolean
}) {
  const activeClass = amber
    ? 'bg-amber-500 text-white shadow-sm'
    : event
      ? 'bg-teal-600 text-white shadow-sm'
      : 'bg-primary-orange text-white shadow-sm'

  const inactiveClass = amber
    ? 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
    : event
      ? 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-50'
      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
        active ? activeClass : inactiveClass
      }`}
    >
      {children}
    </button>
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