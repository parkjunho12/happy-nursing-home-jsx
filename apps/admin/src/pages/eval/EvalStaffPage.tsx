import StickyToolbar from '../../components/common/StickyToolbar'
import { useState, useMemo, useEffect } from 'react'
import { UserPlus, UserMinus, Edit2, ChevronDown, ChevronUp, AlertTriangle, RotateCcw } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import type { LtcStaff } from '@/store/ltc'
import type { ChecklistItem } from '@/utils/period'
import { calcAge, isItemDone } from '@/utils/period'
import ChecklistDetailModal from '@/components/eval/ChecklistDetailModal'

type Tab = 'active' | 'resigned' | 'all'

export default function EvalStaffPage() {
  const { staffList, checklists, loaded, loadAll } = useLtcStore()
  const [tab, setTab] = useState<Tab>('active')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showResign, setShowResign] = useState<string | null>(null)
  const [selectedCl, setSelectedCl] = useState<ChecklistItem | null>(null)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  const filtered = staffList.filter(s => tab==='all' ? true : tab==='active' ? s.status==='active' : s.status==='resigned')

  const staffCls = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {}
    checklists.filter(c => c.personType === 'staff' && c.active).forEach(c => {
      if (!c.personId) return
      if (!map[c.personId]) map[c.personId] = []
      map[c.personId].push(c)
    })
    return map
  }, [checklists])

  const totalCls = Object.values(staffCls).reduce((s, a) => s + a.length, 0)
  const doneCls  = Object.values(staffCls).reduce((s, a) => s + a.filter(c => isItemDone(c)).length, 0)

  if (!loaded) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-orange border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">직원 관리 <span className="text-sm font-normal text-gray-400">(평가)</span></h1>
          <p className="text-sm text-gray-500 mt-0.5">입사·퇴사 및 개인별 체크리스트 관리</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadAll()} className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50"><RotateCcw size={14}/></button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary-orange text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 shadow-sm">
            <UserPlus size={15}/>입사 등록
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-orange-50 rounded-xl p-4 border border-white shadow-sm">
          <p className="text-xs text-gray-500 mb-1">재직 중</p>
          <p className="text-2xl font-bold text-gray-900">{staffList.filter(s=>s.status==='active').length}명</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-white shadow-sm">
          <p className="text-xs text-gray-500 mb-1">퇴사</p>
          <p className="text-2xl font-bold text-gray-900">{staffList.filter(s=>s.status==='resigned').length}명</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-white shadow-sm">
          <p className="text-xs text-gray-500 mb-1">입사 체크리스트</p>
          <p className="text-2xl font-bold text-gray-900">{doneCls}/{totalCls}</p>
        </div>
      </div>

      {/* 탭 (상단 고정) */}
      <StickyToolbar>
      <div className="flex gap-1.5">
        {(['active','resigned','all'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab===t?'bg-primary-orange text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t==='active'?`재직 중 (${staffList.filter(s=>s.status==='active').length})`:t==='resigned'?`퇴사 (${staffList.filter(s=>s.status==='resigned').length})`:`전체 (${staffList.length})`}
          </button>
        ))}
      </div>
      </StickyToolbar>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-sm">등록된 직원이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(s => (
            <StaffCard key={s.id} s={s}
              expanded={expandedId===s.id}
              onExpand={() => setExpandedId(expandedId===s.id ? null : s.id)}
              onEdit={() => setEditingId(s.id)}
              onResign={() => setShowResign(s.id)}
              checklists={staffCls[s.id]??[]}
              onClClick={setSelectedCl} />
          ))}
        </div>
      )}

      {showAdd     && <StaffForm onClose={() => setShowAdd(false)} />}
      {editingId   && <StaffForm existing={staffList.find(s=>s.id===editingId)} onClose={() => setEditingId(null)} />}
      {showResign  && <ResignModal staffId={showResign} onClose={() => setShowResign(null)} />}
      {selectedCl  && <ChecklistDetailModal item={selectedCl} onClose={() => setSelectedCl(null)} />}
    </div>
  )
}

function StaffCard({ s, expanded, onExpand, onEdit, onResign, checklists, onClClick }: {
  s: LtcStaff; expanded:boolean; onExpand:()=>void; onEdit:()=>void; onResign:()=>void;
  checklists: ChecklistItem[]; onClClick:(c:ChecklistItem)=>void;
}) {
  const age = calcAge(s.birthDate)
  const done = checklists.filter(c => isItemDone(c)).length
  const total = checklists.length
  const workYears = (() => {
    const h = new Date(s.hireDate); const e = s.resignDate ? new Date(s.resignDate) : new Date()
    const y = e.getFullYear() - h.getFullYear(); const mo = e.getMonth() - h.getMonth()
    return y > 0 ? `${y}년 ${mo>=0?mo:12+mo}개월` : `${Math.max(0,Math.abs(mo))}개월`
  })()

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${s.status==='resigned'?'opacity-60 border-gray-100':'border-gray-200'}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={onExpand}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${s.gender==='female'?'bg-pink-100 text-pink-700':'bg-blue-100 text-blue-700'}`}>
          {s.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{s.name}</span>
            <span className="text-xs text-gray-500">{s.gender==='female'?'여':'남'} · {age}세</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{s.status==='active'?'재직 중':'퇴사'}</span>
            {s.memo && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{s.memo}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{s.birthDate} · 입사 {s.hireDate} · 근속 {workYears}{s.resignDate&&` · 퇴사 ${s.resignDate}`}</p>
        </div>
        {total > 0 && (
          <div className="flex-shrink-0 text-right mr-1">
            <span className={`text-sm font-bold ${done===total?'text-green-600':'text-orange-500'}`}>{done}/{total}</span>
            <div className="w-14 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div className={`h-1.5 rounded-full ${done===total?'bg-green-500':'bg-primary-orange'}`} style={{width:`${total?(done/total)*100:0}%`}}/>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          {s.status==='active' && (
            <>
              <button onClick={e=>{e.stopPropagation();onEdit()}} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Edit2 size={14}/></button>
              <button onClick={e=>{e.stopPropagation();onResign()}} className="flex items-center gap-1 text-xs font-medium text-orange-500 border border-orange-200 px-2.5 py-1.5 rounded-xl hover:bg-orange-50"><UserMinus size={12}/>퇴사</button>
            </>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
        </div>
      </div>

      {expanded && total > 0 && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600">입사 체크리스트 ({total}건)</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${done===total?'bg-green-100 text-green-700':'bg-orange-100 text-orange-600'}`}>
              {done===total?'✓ 완료':`${total-done}건 미완료`}
            </span>
          </div>
          <div className="space-y-1.5">
            {checklists.map(cl => (
              <div key={cl.id} onClick={() => onClClick(cl)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${isItemDone(cl)?'bg-green-50 border-green-100 hover:bg-green-100':cl.riskLevel==='high'?'bg-red-50 border-red-100 hover:bg-red-100':'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isItemDone(cl)?'bg-green-500 border-green-500':'border-gray-300'}`}>
                  {isItemDone(cl) && <div className="w-1.5 h-1.5 bg-white rounded-full"/>}
                </div>
                <p className={`text-xs font-semibold flex-1 truncate ${isItemDone(cl)?'line-through text-gray-400':'text-gray-800'}`}>{cl.title.replace(`[${s.name}] `,'')}</p>
                {cl.riskLevel==='high' && !isItemDone(cl) && <AlertTriangle size={11} className="text-red-400 flex-shrink-0"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"

function StaffForm({ existing, onClose }: { existing?: LtcStaff; onClose:()=>void }) {
  const { addStaff, updateStaff } = useLtcStore()
  const [form, setForm] = useState({ name:existing?.name??'', birthDate:existing?.birthDate??'', gender:existing?.gender??'female', hireDate:existing?.hireDate??new Date().toISOString().split('T')[0], memo:existing?.memo??'' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if(!form.name||!form.birthDate) return
    setLoading(true)
    try { if(existing) await updateStaff(existing.id, form); else await addStaff({...form,status:'active'}); onClose() }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{existing?'직원 정보 수정':'직원 입사 등록'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!existing && <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">✨ 등록 시 입사 관련 체크리스트 <strong>2건</strong>이 자동 생성됩니다.</div>}
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">성명 *</label><input required className={ic} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="홍길동"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">생년월일 *</label><input required type="date" className={ic} value={form.birthDate} onChange={e=>setForm({...form,birthDate:e.target.value})}/></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">성별</label>
              <select className={ic} value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="female">여</option><option value="male">남</option></select>
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">입사일 *</label><input required type="date" className={ic} value={form.hireDate} onChange={e=>setForm({...form,hireDate:e.target.value})}/></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">직종·메모</label><input className={ic} value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} placeholder="예: 요양보호사, 간호사"/></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-primary-orange text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50">{loading?'처리 중...':existing?'수정':'입사 등록'}</button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm">취소</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ResignModal({ staffId, onClose }: { staffId:string; onClose:()=>void }) {
  const { staffList, resignStaff } = useLtcStore()
  const s = staffList.find(x=>x.id===staffId)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try { await resignStaff(staffId, date); onClose() } finally { setLoading(false) }
  }

  if (!s) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b"><h2 className="font-bold text-gray-900">퇴사 처리 — {s.name}</h2></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">퇴사일 *</label><input required type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">{loading?'처리 중...':'퇴사 처리'}</button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm">취소</button>
          </div>
        </form>
      </div>
    </div>
  )
}
