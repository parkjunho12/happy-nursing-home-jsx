import StickyToolbar from '../../components/common/StickyToolbar'
import { useState, useMemo, useEffect } from 'react'
import { UserPlus, LogOut, Edit2, ChevronDown, ChevronUp, AlertTriangle, RotateCcw } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import type { LtcResident } from '@/store/ltc'
import type { ChecklistItem } from '@/utils/period'
import { calcAge, isItemDone } from '@/utils/period'
import ChecklistDetailModal from '@/components/eval/ChecklistDetailModal'
import { adminAlbumAPI } from '@/api/albumClient'

type Tab = 'active' | 'discharged' | 'all'

export default function EvalResidentsPage() {
  const { residents, checklists, loaded, loadAll } = useLtcStore()
  const [tab, setTab] = useState<Tab>('active')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDischarge, setShowDischarge] = useState<string | null>(null)
  const [selectedCl, setSelectedCl] = useState<ChecklistItem | null>(null)
  const [addGuardianFor, setAddGuardianFor] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  const filtered = residents.filter(r => tab === 'all' ? true : tab === 'active' ? r.status === 'active' : r.status === 'discharged')
  const resCls = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {}
    checklists.filter(c => c.personType === 'resident' && c.active).forEach(c => {
      if (!c.personId) return
      if (!map[c.personId]) map[c.personId] = []
      map[c.personId].push(c)
    })
    return map
  }, [checklists])

  const totalCls  = Object.values(resCls).reduce((s, a) => s + a.length, 0)
  const doneCls   = Object.values(resCls).reduce((s, a) => s + a.filter(c => isItemDone(c)).length, 0)

  if (!loaded) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-orange border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수급자 관리 <span className="text-sm font-normal text-gray-400">(평가)</span></h1>
          <p className="text-sm text-gray-500 mt-0.5">입소·퇴소 및 개인별 체크리스트 관리</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadAll()} className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
            <RotateCcw size={14}/>
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary-orange text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 shadow-sm">
            <UserPlus size={15}/>입소 등록
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-orange-50 rounded-xl p-4 border border-white shadow-sm">
          <p className="text-xs text-gray-500 mb-1">현재 입소</p>
          <p className="text-2xl font-bold text-gray-900">{residents.filter(r=>r.status==='active').length}명</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-white shadow-sm">
          <p className="text-xs text-gray-500 mb-1">퇴소</p>
          <p className="text-2xl font-bold text-gray-900">{residents.filter(r=>r.status==='discharged').length}명</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-white shadow-sm">
          <p className="text-xs text-gray-500 mb-1">개인 체크리스트</p>
          <p className="text-2xl font-bold text-gray-900">{doneCls}/{totalCls}</p>
        </div>
      </div>

      {/* 탭 (상단 고정) */}
      <StickyToolbar>
      <div className="flex gap-1.5">
        {(['active','discharged','all'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab===t?'bg-primary-orange text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t==='active'?`입소 중 (${residents.filter(r=>r.status==='active').length})`:t==='discharged'?`퇴소 (${residents.filter(r=>r.status==='discharged').length})`:`전체 (${residents.length})`}
          </button>
        ))}
      </div>
      </StickyToolbar>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-sm">등록된 수급자가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(r => (
            <ResidentCard key={r.id} r={r}
              expanded={expandedId===r.id}
              onExpand={() => setExpandedId(expandedId===r.id ? null : r.id)}
              onEdit={() => setEditingId(r.id)}
              onDischarge={() => setShowDischarge(r.id)}
              checklists={resCls[r.id]??[]}
              onClClick={setSelectedCl}
              onAddGuardian={() => setAddGuardianFor({ id: r.id, name: r.name })} />
          ))}
        </div>
      )}

      {showAdd       && <ResidentForm onClose={() => setShowAdd(false)} />}
      {editingId     && <ResidentForm existing={residents.find(r=>r.id===editingId)} onClose={() => setEditingId(null)} />}
      {showDischarge && <DischargeModal residentId={showDischarge} onClose={() => setShowDischarge(null)} />}
      {selectedCl    && <ChecklistDetailModal item={selectedCl} onClose={() => setSelectedCl(null)} />}
      {addGuardianFor && (
        <GuardianAddModal
          residentId={addGuardianFor.id}
          residentName={addGuardianFor.name}
          onClose={() => setAddGuardianFor(null)}
        />
      )}
    </div>
  )
}

function ResidentCard({ r, expanded, onExpand, onEdit, onDischarge, checklists, onClClick, onAddGuardian }: {
  r: LtcResident; expanded:boolean; onExpand:()=>void; onEdit:()=>void; onDischarge:()=>void;
  checklists: ChecklistItem[]; onClClick:(c:ChecklistItem)=>void; onAddGuardian:()=>void;
}) {
  const age = calcAge(r.birthDate)
  const done = checklists.filter(c => isItemDone(c)).length
  const total = checklists.length
  const hasHigh = checklists.some(c => !isItemDone(c) && c.riskLevel === 'high')

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${r.status==='discharged'?'opacity-60 border-gray-100':hasHigh?'border-red-200':'border-gray-200'}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={onExpand}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${r.gender==='female'?'bg-pink-100 text-pink-700':'bg-blue-100 text-blue-700'}`}>
          {r.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{r.name}</span>
            <span className="text-xs text-gray-500">{r.gender==='female'?'여':'남'} · {age}세</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
              {r.status==='active'?'입소 중':'퇴소'}
            </span>
            {hasHigh && <AlertTriangle size={13} className="text-red-500"/>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{r.birthDate} · 입소 {r.admissionDate}{r.dischargeDate&&` · 퇴소 ${r.dischargeDate}`}</p>
          {r.memo && <p className="text-xs text-gray-500 mt-0.5 truncate">{r.memo}</p>}
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
          {r.status==='active' && (
            <>
              <button onClick={e=>{e.stopPropagation();onAddGuardian()}}
                className="flex items-center gap-1 text-xs font-medium text-teal-600 border border-teal-200 px-2.5 py-1.5 rounded-xl hover:bg-teal-50">
                🌸 보호자
              </button>
              <button onClick={e=>{e.stopPropagation();onEdit()}} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Edit2 size={14}/></button>
              <button onClick={e=>{e.stopPropagation();onDischarge()}} className="flex items-center gap-1 text-xs font-medium text-red-500 border border-red-200 px-2.5 py-1.5 rounded-xl hover:bg-red-50"><LogOut size={12}/>퇴소</button>
            </>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
        </div>
      </div>

      {expanded && total > 0 && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600">개인 체크리스트 ({total}건)</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${done===total?'bg-green-100 text-green-700':'bg-orange-100 text-orange-600'}`}>
              {done===total?'✓ 완료':`${total-done}건 미완료`}
            </span>
          </div>
          <div className="space-y-1.5">
            {checklists.map(cl => (
              <div key={cl.id} onClick={() => onClClick(cl)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  isItemDone(cl)?'bg-green-50 border-green-100 hover:bg-green-100':
                  cl.riskLevel==='high'?'bg-red-50 border-red-100 hover:bg-red-100':
                  'bg-gray-50 border-gray-100 hover:bg-gray-100'
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isItemDone(cl)?'bg-green-500 border-green-500':'border-gray-300'}`}>
                  {isItemDone(cl) && <div className="w-1.5 h-1.5 bg-white rounded-full"/>}
                </div>
                <p className={`text-xs font-semibold flex-1 truncate ${isItemDone(cl)?'line-through text-gray-400':'text-gray-800'}`}>
                  {cl.title.replace(`[${r.name}] `,'')}
                </p>
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

// 한국식 생년월일 선택 — 년/월/일 드롭다운 (고령 수급자 대응, 1930년 기본)
function BirthDateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const nowY = new Date().getFullYear()
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const [yy, mm, dd] = valid ? value.split('-').map(Number) : [1930, 1, 1]
  const years: number[] = []
  for (let y = nowY; y >= 1915; y--) years.push(y)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const daysInMonth = new Date(yy, mm, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emit = (y: number, m: number, d: number) => {
    const dim = new Date(y, m, 0).getDate()
    const d2 = Math.min(d, dim)
    onChange(`${y}-${String(m).padStart(2, '0')}-${String(d2).padStart(2, '0')}`)
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <select className={ic} value={yy} onChange={e => emit(Number(e.target.value), mm, dd)}>
        {years.map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      <select className={ic} value={mm} onChange={e => emit(yy, Number(e.target.value), dd)}>
        {months.map(m => <option key={m} value={m}>{m}월</option>)}
      </select>
      <select className={ic} value={dd} onChange={e => emit(yy, mm, Number(e.target.value))}>
        {days.map(d => <option key={d} value={d}>{d}일</option>)}
      </select>
    </div>
  )
}

function ResidentForm({ existing, onClose }: { existing?: LtcResident; onClose:()=>void }) {
  const { addResident, updateResident } = useLtcStore()
  const [form, setForm] = useState({ name:existing?.name??'', birthDate:existing?.birthDate??'1930-01-01', gender:existing?.gender??'female', admissionDate:existing?.admissionDate??new Date().toISOString().split('T')[0], careGradeStartDate:existing?.careGradeStartDate??new Date().toISOString().split('T')[0], memo:existing?.memo??'' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if(!form.name||!form.birthDate) return
    setLoading(true)
    try { if(existing) await updateResident(existing.id, form); else await addResident({...form, status:'active'}); onClose() }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{existing?'수급자 정보 수정':'수급자 입소 등록'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!existing && <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">✨ 등록 시 입소 관련 체크리스트 <strong>12건</strong>이 자동 생성됩니다.</div>}
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">성명 *</label><input required className={ic} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="홍길동"/></div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">생년월일 *</label>
            <BirthDateSelect value={form.birthDate} onChange={v=>setForm({...form,birthDate:v})}/>
            {form.birthDate && <p className="text-xs text-gray-400 mt-1">만 {calcAge(form.birthDate)}세</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">성별</label>
            <select className={ic} value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="female">여</option><option value="male">남</option></select>
          </div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">입소일 *</label><input required type="date" className={ic} value={form.admissionDate} onChange={e=>setForm({...form,admissionDate:e.target.value})}/></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">장기요양등급 인정서 시작일 *</label><input required type="date" className={ic} value={form.careGradeStartDate} onChange={e=>setForm({...form,careGradeStartDate:e.target.value})}/><p className="text-xs text-gray-400 mt-1">반기 주기(욕구사정·급여계획 등)의 기준이 됩니다.</p></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">메모</label><textarea className={ic} rows={2} value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} placeholder="예: 1등급, 낙상 고위험"/></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-primary-orange text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50">{loading?'처리 중...':existing?'수정':'입소 등록'}</button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm">취소</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DischargeModal({ residentId, onClose }: { residentId:string; onClose:()=>void }) {
  const { residents, dischargeResident } = useLtcStore()
  const r = residents.find(x=>x.id===residentId)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try { await dischargeResident(residentId, date); onClose() } finally { setLoading(false) }
  }

  if (!r) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b"><h2 className="font-bold text-gray-900">퇴소 처리 — {r.name}</h2></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">퇴소 처리 시 연계기록지 체크리스트가 자동 생성되며, 미완료 입소 체크리스트는 비활성화됩니다.</div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">퇴소일 *</label><input required type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50">{loading?'처리 중...':'퇴소 처리'}</button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm">취소</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 보호자 추가 모달 ─────────────────────────────────────────────────────────
function GuardianAddModal({ residentId, residentName, onClose }: {
  residentId: string; residentName: string; onClose: () => void
}) {
  const [form, setForm] = useState({
    name: '', phone: '', password: '', relation: '보호자',
  })
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState('')

  const submit = async () => {
    if (!form.name || !form.phone || !form.password) {
      setError('이름, 전화번호, 비밀번호를 모두 입력해주세요'); return
    }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('name',        form.name)
      fd.append('phone',       form.phone)
      fd.append('password',    form.password)
      fd.append('resident_id', residentId)
      fd.append('relation',    form.relation)
      await adminAlbumAPI.createGuardian(fd)
      setSuccess(true)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '이미 등록된 전화번호이거나 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* 헤더 */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">보호자 계정 추가</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-semibold text-teal-600">{residentName}</span> 수급자와 연결됩니다
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {success ? (
          /* 성공 화면 */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto text-3xl">✅</div>
            <div>
              <p className="font-bold text-gray-900 text-lg">보호자 등록 완료!</p>
              <p className="text-sm text-gray-500 mt-1">
                <strong>{form.name}</strong>님이 <strong>{residentName}</strong> 수급자의 보호자로 등록되었습니다.
              </p>
            </div>
            <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-left space-y-1.5">
              <p className="text-xs font-bold text-teal-700">📱 보호자 로그인 정보</p>
              <p className="text-xs text-teal-700">전화번호: <strong>{form.phone}</strong></p>
              <p className="text-xs text-teal-700">비밀번호: <strong>{'•'.repeat(form.password.length)}</strong> (설정한 값)</p>
              <p className="text-xs text-teal-600 mt-2">
                홈페이지 → 보호자 앨범에서 로그인할 수 있습니다
              </p>
            </div>
            <button onClick={onClose}
              className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700">
              확인
            </button>
          </div>
        ) : (
          /* 입력 폼 */
          <div className="p-5 space-y-4">
            {/* 수급자 연결 표시 */}
            <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-teal-200 rounded-lg flex items-center justify-center text-sm font-bold text-teal-800">
                {residentName[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-teal-800">{residentName}</p>
                <p className="text-xs text-teal-600">이 수급자와 자동 연결됩니다</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">이름 *</label>
                <input className={ic} value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})} placeholder="홍길동"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">관계</label>
                <select className={ic} value={form.relation}
                  onChange={e => setForm({...form, relation: e.target.value})}>
                  {['보호자','아들','딸','배우자','며느리','사위','손자','손녀','형제/자매','기타'].map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                전화번호 * <span className="text-gray-400 font-normal">(로그인 아이디로 사용됩니다)</span>
              </label>
              <input className={ic} value={form.phone} type="tel"
                onChange={e => setForm({...form, phone: e.target.value})} placeholder="010-0000-0000"/>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                초기 비밀번호 *
              </label>
              <input className={ic} value={form.password} type="password"
                onChange={e => setForm({...form, password: e.target.value})} placeholder="보호자에게 전달할 비밀번호"/>
              <p className="text-xs text-gray-400 mt-1">보호자에게 이 비밀번호를 알려주세요</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                ⚠️ {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={submit} disabled={saving}
                className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                {saving ? '등록 중...' : '🌸 보호자 등록'}
              </button>
              <button onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
