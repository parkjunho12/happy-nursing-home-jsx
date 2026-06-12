import { useState, useMemo, useEffect } from 'react'
import { Search, AlertTriangle, CheckCircle2, User, RotateCcw, Plus } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import ChecklistDetailModal from '@/components/eval/ChecklistDetailModal'
import ChecklistFormModal from '@/components/eval/ChecklistFormModal'
import type { ChecklistItem } from '@/utils/period'
import {
  FREQUENCY_LABELS, FREQUENCY_COLORS, RISK_COLORS, RISK_LABELS, DOMAIN_COLORS,
  RECURRING, EVENT_FREQS, isItemDone, getCurrentPeriodKey, getPeriodLabel, getPeriodEnd,
} from '@/utils/period'

type FreqTab = string

export default function EvalChecklistPage() {
  const { checklists, residents, staffList, domains, loaded, loadAll, toggleComplete } = useLtcStore()
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeFreq, setActiveFreq] = useState<FreqTab>('all')
  const [activeDomain] = useState('all')
  const [activePerson, setActivePerson] = useState('all')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'done' | 'todo'>('all')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  const activeResidents = residents.filter(r => r.status === 'active')
  const activeStaff     = staffList.filter(s => s.status === 'active')

  const personCounts = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {}
    checklists.filter(c => c.active && c.personId).forEach(c => {
      const pid = c.personId!
      if (!map[pid]) map[pid] = { total: 0, done: 0 }
      map[pid].total++
      if (isItemDone(c)) map[pid].done++
    })
    return map
  }, [checklists])

  const filtered = useMemo(() => checklists.filter(c => {
    if (!c.active) return false
    if (activeFreq !== 'all' && c.frequency !== activeFreq) return false
    if (activeDomain !== 'all' && c.relatedDomainId !== activeDomain) return false
    if (activePerson === 'facility') { if (c.personId) return false }
    else if (activePerson !== 'all') { if (c.personId !== activePerson) return false }
    const done = isItemDone(c)
    if (filterStatus === 'done' && !done) return false
    if (filterStatus === 'todo' && done) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.title.toLowerCase().includes(q) && !c.assignee.toLowerCase().includes(q) && !(c.personName?.toLowerCase().includes(q))) return false
    }
    return true
  }), [checklists, activeFreq, activeDomain, activePerson, filterStatus, search])

  const recurring = checklists.filter(c => c.active && RECURRING.includes(c.frequency as any))
  const stats = {
    recurringDone:  recurring.filter(c => isItemDone(c)).length,
    recurringTotal: recurring.length,
    personalDone:   checklists.filter(c => c.active && c.personId && isItemDone(c)).length,
    personalTotal:  checklists.filter(c => c.active && c.personId).length,
    highRisk:       checklists.filter(c => c.active && !isItemDone(c) && c.riskLevel === 'high').length,
    totalTodo:      checklists.filter(c => c.active && !isItemDone(c)).length,
  }

  const handleToggle = async (id: string) => {
    setToggling(id)
    try { await toggleComplete(id) } finally { setToggling(null) }
  }

  if (!loaded) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-sm text-gray-500">불러오는 중...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">평가 체크리스트</h1>
          <p className="text-sm text-gray-500 mt-0.5">미완료 반복 업무는 주기 마감일까지 계속 표시됩니다</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 text-sm text-white bg-primary-orange rounded-lg px-3 py-1.5 hover:bg-primary-orange/90 font-semibold shadow-sm">
            <Plus size={14}/> 항목 추가
          </button>
          <button onClick={() => loadAll()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            <RotateCcw size={14}/> 새로고침
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="정기 업무" value={`${stats.recurringDone}/${stats.recurringTotal}`} sub="현재 주기 완료" color="orange"/>
        <SummaryCard label="개인별 체크리스트" value={`${stats.personalDone}/${stats.personalTotal}`} sub="수급자·직원 개인" color="green"/>
        <SummaryCard label="위험도 높음" value={`${stats.highRisk}건`} sub="즉시 조치 필요" color="red"/>
        <SummaryCard label="전체 미완료" value={`${stats.totalTodo}건`} sub="모든 활성 항목" color="gray"/>
      </div>

      {/* 대상별 탭 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 mb-2 px-1">대상별 보기</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <PersonTab active={activePerson==='all'}      onClick={() => setActivePerson('all')}      label="전체" />
          <PersonTab active={activePerson==='facility'} onClick={() => setActivePerson('facility')} label="시설 공통" color="orange" />
          {activeResidents.map(r => {
            const cnt = personCounts[r.id]
            return <PersonTab key={r.id} active={activePerson===r.id} onClick={() => setActivePerson(r.id)}
              label={r.name} color="purple" badge={cnt ? `${cnt.done}/${cnt.total}` : undefined} allDone={cnt?.done===cnt?.total} />
          })}
          {activeStaff.map(s => {
            const cnt = personCounts[s.id]
            return <PersonTab key={s.id} active={activePerson===s.id} onClick={() => setActivePerson(s.id)}
              label={s.name} color="blue" badge={cnt ? `${cnt.done}/${cnt.total}` : undefined} allDone={cnt?.done===cnt?.total} />
          })}
        </div>
      </div>

      {/* 주기 탭 */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <TabBtn active={activeFreq==='all'} onClick={() => setActiveFreq('all')}>전체</TabBtn>
          {RECURRING.map(f => <TabBtn key={f} active={activeFreq===f} onClick={() => setActiveFreq(f)}>{FREQUENCY_LABELS[f as any]}</TabBtn>)}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 items-center">
          <span className="text-xs text-gray-400 pl-1 flex-shrink-0">사건별</span>
          {EVENT_FREQS.map(f => <TabBtn key={f} active={activeFreq===f} onClick={() => setActiveFreq(f)} event>{FREQUENCY_LABELS[f as any]}</TabBtn>)}
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

      <p className="text-xs text-gray-400">{filtered.length}개 항목</p>

      {/* 체크리스트 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">해당 조건의 항목이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const domain = domains.find(d => d.id === item.relatedDomainId)
            const domainColors = domain ? (DOMAIN_COLORS[domain.color] ?? DOMAIN_COLORS.teal) : null
            const done = isItemDone(item)
            const periodKey   = RECURRING.includes(item.frequency as any) ? getCurrentPeriodKey(item.frequency as any) : ''
            const periodLabel = periodKey ? getPeriodLabel(item.frequency as any, periodKey) : ''
            const periodEnd   = RECURRING.includes(item.frequency as any) ? getPeriodEnd(item.frequency as any) : null
            const daysLeft    = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : null

            return (
              <div key={item.id}
                className={`bg-white rounded-xl border shadow-sm transition-all hover:shadow-md ${
                  done ? 'border-gray-100 opacity-70' :
                  item.riskLevel==='high' ? 'border-red-200' :
                  item.personId ? 'border-purple-100' : 'border-gray-200'
                }`}>
                <div className="flex items-start gap-3 p-4">
                  {/* 체크 버튼 */}
                  <button
                    onClick={() => handleToggle(item.id)}
                    disabled={toggling===item.id}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-50 ${
                      done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-orange'
                    }`}>
                    {done && <div className="w-2 h-2 bg-white rounded-full"/>}
                  </button>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedItem(item)}>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {item.personName && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 bg-purple-100 text-purple-700">
                          <User size={9}/>{item.personName}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FREQUENCY_COLORS[item.frequency as any]}`}>
                        {FREQUENCY_LABELS[item.frequency as any]}
                      </span>
                      {domain && domainColors && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${domainColors.bg} ${domainColors.text}`}>{domain.name}</span>
                      )}
                      {!done && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[item.riskLevel]}`}>{RISK_LABELS[item.riskLevel]}</span>
                      )}
                      {done && <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">완료</span>}
                    </div>
                    <p className={`text-sm font-semibold leading-snug ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {periodLabel && <span className="text-[11px] text-gray-400">📅 {periodLabel}</span>}
                      {item.assignee && <span className="text-[11px] text-gray-400">👤 {item.assignee}</span>}
                      {daysLeft !== null && !done && (
                        <span className={`text-[11px] font-bold ${daysLeft<=3?'text-red-500':daysLeft<=7?'text-orange-500':'text-gray-400'}`}>D-{daysLeft}</span>
                      )}
                    </div>
                  </div>
                  {item.riskLevel==='high' && !done && <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-1"/>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedItem && <ChecklistDetailModal item={selectedItem} onClose={() => setSelectedItem(null)}/>}
      {showAddModal && <ChecklistFormModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label:string; value:string; sub:string; color:string }) {
  const bg = { orange:'bg-orange-50', green:'bg-green-50', red:'bg-red-50', gray:'bg-gray-50' }[color]||'bg-gray-50'
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
        <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active?'bg-white/30 text-white':allDone?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function TabBtn({ active, onClick, children }: { active:boolean; onClick:()=>void; children:React.ReactNode; event?:boolean }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
        active ? 'bg-primary-orange text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}>
      {children}
    </button>
  )
}

