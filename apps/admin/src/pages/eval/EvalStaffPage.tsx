import DateField from '@/components/ui/DateField'
import StickyToolbar from '../../components/common/StickyToolbar'
import { useState, useMemo, useEffect } from 'react'
import { UserPlus, UserMinus, Edit2, ChevronDown, ChevronUp, AlertTriangle, RotateCcw, CalendarOff, X, Trash2 } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import type { LtcStaff } from '@/store/ltc'
import type { ChecklistItem } from '@/utils/period'
import { calcAge, isItemDone, daysFromToday } from '@/utils/period'
import ChecklistDetailModal from '@/components/eval/ChecklistDetailModal'
import { STAFF_POSITIONS } from '@/constants/positions'

type Tab = 'active' | 'pending' | 'resigned' | 'all'

const todayISO = () => new Date().toISOString().split('T')[0]
export const isOnLeave = (s: LtcStaff, on = todayISO()) =>
  (s.leaves ?? []).some(l => l.start && l.start <= on && (!l.end || l.end >= on))

export default function EvalStaffPage() {
  const { staffList, checklists, loaded, loadAll } = useLtcStore()
  const [tab, setTab] = useState<Tab>('active')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showResign, setShowResign] = useState<string | null>(null)
  const [selectedCl, setSelectedCl] = useState<ChecklistItem | null>(null)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [leaveFor, setLeaveFor] = useState<string | null>(null)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  const positions = useMemo(() => Array.from(new Set(staffList.map(s => s.position).filter(Boolean))) as string[], [staffList])
  const filtered = useMemo(() => staffList
    .filter(s => tab==='all' ? true : s.status===tab)
    .filter(s => !search || s.name.includes(search) || (s.position ?? '').includes(search))
    .filter(s => !posFilter || s.position === posFilter)
    .sort((a, b) => (a.hireDate || '9999').localeCompare(b.hireDate || '9999')),
    [staffList, tab, search, posFilter])

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
          <p className="text-2xl font-bold text-gray-900">{staffList.filter(s=>s.status==='active').length}명
            {staffList.some(s=>s.status==='pending') && (
              <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full align-middle">
                +입사 예정 {staffList.filter(s=>s.status==='pending').length}
              </span>
            )}
          </p>
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
      <div className="flex flex-wrap items-center gap-1.5">
        {(['active','pending','resigned','all'] as Tab[]).map(t => {
          const cnt = t==='all' ? staffList.length : staffList.filter(s=>s.status===t).length
          if (t==='pending' && cnt===0 && tab!=='pending') return null
          const label = t==='active'?'재직 중':t==='pending'?'입사 예정':t==='resigned'?'퇴사':'전체'
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab===t?'bg-primary-orange text-white':t==='pending'?'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {label} ({cnt})
            </button>
          )
        })}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름·직종 검색"
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange/40 w-36" />
        <select value={posFilter} onChange={e=>setPosFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange/40">
          <option value="">전체 직종</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">입사일 빠른순</span>
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
              onLeave={() => setLeaveFor(s.id)}
              onDelete={async () => {
                const label = s.status==='pending' ? '입사 예정을 취소하고 완전히 삭제' : '기록을 완전히 삭제'
                if (!confirm(`${s.name} 님의 ${label}할까요?\n체크리스트·근로계약 기록도 함께 지워지며 되돌릴 수 없습니다.`)) return
                try { await useLtcStore.getState().deleteStaff(s.id) }
                catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '삭제 실패') }
              }}
              checklists={staffCls[s.id]??[]}
              onClClick={setSelectedCl} />
          ))}
        </div>
      )}

      {showAdd     && <StaffForm onClose={() => setShowAdd(false)} />}
      {editingId   && <StaffForm existing={staffList.find(s=>s.id===editingId)} onClose={() => setEditingId(null)} />}
      {leaveFor    && <LeaveModal staffId={leaveFor} onClose={() => setLeaveFor(null)} />}
      {showResign  && <ResignModal staffId={showResign} onClose={() => setShowResign(null)} />}
      {selectedCl  && <ChecklistDetailModal item={selectedCl} onClose={() => setSelectedCl(null)} />}
    </div>
  )
}

function StaffCard({ s, expanded, onExpand, onEdit, onResign, onLeave, onDelete, checklists, onClClick }: {
  s: LtcStaff; expanded:boolean; onExpand:()=>void; onEdit:()=>void; onResign:()=>void; onLeave:()=>void; onDelete:()=>void;
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
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.status==='active'?'bg-green-100 text-green-700':s.status==='pending'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}`}>{s.status==='active'?'재직 중':s.status==='pending'?'입사 예정':'퇴사'}</span>
            {isOnLeave(s) && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">휴직 중</span>}
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
              <button onClick={e=>{e.stopPropagation();onLeave()}} className="flex items-center gap-1 text-xs font-medium text-amber-600 border border-amber-200 px-2.5 py-1.5 rounded-xl hover:bg-amber-50"><CalendarOff size={12}/>휴직</button>
              <button onClick={e=>{e.stopPropagation();onResign()}} className="flex items-center gap-1 text-xs font-medium text-orange-500 border border-orange-200 px-2.5 py-1.5 rounded-xl hover:bg-orange-50"><UserMinus size={12}/>퇴사</button>
            </>
          )}
          {s.status==='pending' && (
            <button onClick={e=>{e.stopPropagation();onEdit()}} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Edit2 size={14}/></button>
          )}
          {s.status!=='active' && (
            <button onClick={e=>{e.stopPropagation();onDelete()}}
              title={s.status==='pending' ? '입사 취소 — 완전 삭제' : '기록 완전 삭제'}
              className="flex items-center gap-1 text-xs font-medium text-red-500 border border-red-200 px-2.5 py-1.5 rounded-xl hover:bg-red-50"><Trash2 size={12}/>삭제</button>
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
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isItemDone(cl)?'line-through text-gray-400':'text-gray-800'}`}>{cl.title.replace(`[${s.name}] `,'')}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">입사</span>
                    {cl.dueDate && (() => {
                      const dd = daysFromToday(cl.dueDate)
                      const done = isItemDone(cl)
                      return (
                        <span className={`text-[10px] font-semibold ${done?'text-gray-300':dd<0?'text-red-500':dd<=7?'text-amber-600':'text-gray-400'}`}>
                          기한 {cl.dueDate.slice(2).replace(/-/g,'.')}{!done && (dd<0?` (${-dd}일 지남)`:dd===0?' (오늘)':` (D-${dd})`)}
                        </span>
                      )
                    })()}
                  </div>
                </div>
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
  const [form, setForm] = useState({ name:existing?.name??'', birthDate:existing?.birthDate??'', gender:existing?.gender??'female', hireDate:existing?.hireDate??new Date().toISOString().split('T')[0], position:(existing as any)?.position??'요양보호사', residentNo:(existing as any)?.residentNo??'', address:(existing as any)?.address??'', addressDetail:(existing as any)?.addressDetail??'', phone:(existing as any)?.phone??'', licenseDate:(existing as any)?.licenseDate??'', licenseNo:(existing as any)?.licenseNo??'', bankAccount:(existing as any)?.bankAccount??'', memo:existing?.memo??'' })
  const [loading, setLoading] = useState(false)
  const openPostcode = () => {
    const run = () => new (window as any).daum.Postcode({
      oncomplete: (data: any) => setForm(f => ({ ...f, address: data.roadAddress || data.jibunAddress || data.address || '' })),
    }).open()
    if ((window as any).daum?.Postcode) { run(); return }
    const ID = 'daum-postcode-sdk'
    const exist = document.getElementById(ID) as HTMLScriptElement | null
    if (exist) { exist.addEventListener('load', run); return }
    const sc = document.createElement('script')
    sc.id = ID
    sc.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    sc.onload = run
    document.body.appendChild(sc)
  }

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
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">생년월일 *</label><DateField className={ic} value={form.birthDate} onChange={v=>setForm({...form,birthDate:v})} clearable={false}/></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">성별</label>
              <select className={ic} value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="female">여</option><option value="male">남</option></select>
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">입사일 *</label>
            {form.hireDate > new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) && (
              <p className="text-[11px] text-amber-600 mb-1">입사일이 미래라 <b>입사 예정</b>으로 등록됩니다 — 입사일이 되면 자동으로 재직 전환, 취소되면 목록에서 삭제하시면 돼요</p>
            )}
            <DateField className={ic} value={form.hireDate} onChange={v=>setForm({...form,hireDate:v})} clearable={false}/></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">직종 *</label>
            <select className={ic} value={form.position} onChange={e=>setForm({...form,position:e.target.value})}>
              <option value="">직종 선택</option>
              {/* 목록에 없는 옛 표기는 그대로 보여줘 수정 중에 값이 날아가지 않게 */}
              {form.position && !(STAFF_POSITIONS as readonly string[]).includes(form.position) && (
                <option value={form.position}>{form.position}</option>
              )}
              {STAFF_POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">주민번호</label><input className={ic} value={form.residentNo} onChange={e=>setForm({...form,residentNo:e.target.value})} placeholder="000000-0000000"/></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">연락처</label><input className={ic} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="010-0000-0000"/></div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">주소</label>
            <div className="flex gap-2">
              <input className={ic+" flex-1"} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="주소 검색을 눌러 선택"/>
              <button type="button" onClick={openPostcode} className="shrink-0 px-3 py-2 text-sm font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 whitespace-nowrap">주소 검색</button>
            </div>
            <input className={ic+" mt-2"} value={form.addressDetail} onChange={e=>setForm({...form,addressDetail:e.target.value})} placeholder="상세주소 (동/호수 등)"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">자격증 발급일</label><DateField className={ic} value={form.licenseDate} onChange={v=>setForm({...form,licenseDate:v})}/></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">자격증 No</label><input className={ic} value={form.licenseNo} onChange={e=>setForm({...form,licenseNo:e.target.value})} placeholder="자격증 번호"/></div>
          </div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">통장번호</label><input className={ic} value={form.bankAccount} onChange={e=>setForm({...form,bankAccount:e.target.value})} placeholder="은행 · 계좌번호"/></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">메모</label><input className={ic} value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} placeholder="예: 1등급 전담, 야간 근무"/></div>
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
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">퇴사일 *</label><DateField className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40" value={date} onChange={v=>setDate(v)} clearable={false}/></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">{loading?'처리 중...':'퇴사 처리'}</button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm">취소</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 휴직 관리 (기간별) ──────────────────────────────────────
function LeaveModal({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const { staffList, updateStaff } = useLtcStore()
  const s = staffList.find(x => x.id === staffId)
  const [rows, setRows] = useState<{ start?: string | null; end?: string | null; reason?: string | null }[]>(
    (s?.leaves ?? []).map(l => ({ ...l }))
  )
  const [saving, setSaving] = useState(false)
  const inp = 'px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200'

  if (!s) return null
  const patch = (i: number, p: any) => setRows(a => a.map((x, xi) => xi === i ? { ...x, ...p } : x))
  const add = () => setRows(a => [...a, { start: new Date().toISOString().split('T')[0], end: '', reason: '' }])
  const rm = (i: number) => setRows(a => a.filter((_, xi) => xi !== i))

  const save = async () => {
    setSaving(true)
    try {
      const leaves = rows.filter(r => r.start).map(r => ({ start: r.start, end: r.end || null, reason: r.reason || null }))
      await updateStaff(staffId, { leaves } as any)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">휴직 관리 — {s.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            휴직 기간은 <b>인력배치 시뮬레이터의 근무시간에서 자동 제외</b>됩니다. 복직일이 미정이면 종료일을 비워두세요(해당 월 말까지 휴직으로 계산).
          </div>
          {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-4">등록된 휴직 기간이 없습니다.</p>}
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 border border-gray-100 rounded-xl p-2">
              <DateField value={r.start} onChange={v => patch(i, { start: v })} className={inp} wrapperClassName="flex-1 min-w-[8rem]" placeholder="휴직 시작일" clearable={false} />
              <span className="text-gray-400">~</span>
              <DateField value={r.end} onChange={v => patch(i, { end: v })} className={inp} wrapperClassName="flex-1 min-w-[8rem]" placeholder="복직일(미정 가능)" />
              <input value={r.reason ?? ''} onChange={e => patch(i, { reason: e.target.value })} placeholder="사유(선택)" className={`${inp} flex-1 min-w-[7rem]`} />
              <button type="button" onClick={() => rm(i)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={add} className="text-xs font-semibold text-amber-600 hover:underline">+ 휴직 기간 추가</button>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t">
          <button onClick={save} disabled={saving} className="flex-1 bg-amber-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm">취소</button>
        </div>
      </div>
    </div>
  )
}
