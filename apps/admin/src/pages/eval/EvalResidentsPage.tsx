import StickyToolbar from '../../components/common/StickyToolbar'
import RoomPicker from '@/components/eval/RoomPicker'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { UserPlus, LogOut, Edit2, AlertTriangle, RotateCcw, Trash2, BedDouble, Loader2 } from 'lucide-react'
import DateField from '@/components/ui/DateField'
import CertificationEditor from '@/components/eval/CertificationEditor'
import { genderLabel, genderAvatarClass } from '@/utils/gender'
import { validateResidentForm } from '@/utils/residentForm'
import { endFromStart, type Certification } from '@/utils/cert'
import { autoDocEvents } from '@/utils/docEvents'
import { useLtcStore } from '@/store/ltc'
import type { LtcResident } from '@/store/ltc'
import type { ChecklistItem } from '@/utils/period'
import { calcAge, isItemDone } from '@/utils/period'
import { adminAlbumAPI } from '@/api/albumClient'
import { residentDocAPI } from '@/api/residentDocClient'

type Tab = 'active' | 'pending' | 'discharged' | 'all'

export default function EvalResidentsPage() {
  const { residents, checklists, loaded, loadAll, deleteResident } = useLtcStore()
  const [tab, setTab] = useState<Tab>('active')
  const [quickOpen, setQuickOpen] = useState(false)
  const [floorF, setFloorF] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const navigate = useNavigate()
  const [showDischarge, setShowDischarge] = useState<string | null>(null)
  const [addGuardianFor, setAddGuardianFor] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { loadAll() }, [loadAll])

  const handleDeleteResident = async (r: LtcResident) => {
    if (!confirm(`'${r.name}' 수급자를 완전히 삭제할까요?\n\n개인 체크리스트·수행기록·서류현황이 함께 삭제되며 되돌릴 수 없습니다.`)) return
    try { await deleteResident(r.id) } catch (e: any) { alert(e?.message ?? '삭제 실패') }
  }

  const floors = Array.from(new Set(residents.map(r => r.floor).filter(Boolean))).sort() as string[]
  const filtered = residents
    .filter(r => tab === 'all' ? true : r.status === tab)
    .filter(r => !floorF || r.floor === floorF)
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
          <button onClick={()=>setQuickOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-sm font-bold hover:bg-amber-100">
            입소 예정자 간단 등록
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
        {(['active','pending','discharged','all'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab===t?'bg-primary-orange text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t==='active'?`입소 중 (${residents.filter(r=>r.status==='active').length})`:t==='pending'?`입소 예정 (${residents.filter(r=>r.status==='pending').length})`:t==='discharged'?`퇴소 (${residents.filter(r=>r.status==='discharged').length})`:`전체 (${residents.length})`}
          </button>
        ))}
        {floors.length > 0 && (
          <select value={floorF} onChange={e => setFloorF(e.target.value)}
            className="ml-1 px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-orange/40">
            <option value="">전체 층</option>
            {floors.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
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
              onDetail={() => navigate(`/eval/residents/${r.id}`)}
              onEdit={() => setEditingId(r.id)}
              onDischarge={() => setShowDischarge(r.id)}
              onDelete={() => handleDeleteResident(r)}
              checklists={resCls[r.id]??[]}
              onAddGuardian={() => setAddGuardianFor({ id: r.id, name: r.name })} />
          ))}
        </div>
      )}

      {showAdd       && <ResidentForm onClose={() => setShowAdd(false)} />}
      {editingId     && <ResidentForm existing={residents.find(r=>r.id===editingId)} onClose={() => setEditingId(null)} />}
      {showDischarge && <DischargeModal residentId={showDischarge} onClose={() => setShowDischarge(null)} />}
      {quickOpen && <QuickPendingModal onClose={()=>setQuickOpen(false)} />}
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

function ResidentCard({ r, onEdit, onDischarge, onDelete, onDetail, checklists, onAddGuardian }: {
  r: LtcResident; onEdit:()=>void; onDischarge:()=>void; onDelete:()=>void; onDetail:()=>void;
  checklists: ChecklistItem[]; onAddGuardian:()=>void;
}) {
  // 케어팀(간호팀장·물리/작업치료사)은 열람·체크 중심 — 삭제는 숨긴다
  const canDelete = useAuthStore(st => st.user?.role === 'ADMIN' || ['사회복지사', '시설장', '대표', '이사'].includes(st.user?.position ?? ''))
  // 호실은 목록에서 바로 바꾼다 — 수정 모달을 열고 저장까지 갈 일이 아니다
  const updateResident = useLtcStore(st => st.updateResident)
  const [pickOpen, setPickOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const assignRoom = async (floor: string, room: string, force?: boolean) => {
    setPickOpen(false); setSaving(true)
    try {
      await updateResident(r.id, { floor, room, ...(force ? { allowOverCapacity: true } : {}) } as any)
    } catch (e: any) {
      // 정원 초과(409)만은 되돌아가지 않고 그 자리에서 확인받고 강행한다 (직접 입력한 호실 포함)
      const detail = e?.response?.data?.detail
      if (e?.response?.status === 409 && confirm(`${detail}\n\n그래도 이 방으로 배정할까요?`)) {
        try { await updateResident(r.id, { floor, room, allowOverCapacity: true } as any) }
        catch (e2: any) { alert(e2?.response?.data?.detail ?? e2?.message ?? '호실 저장에 실패했습니다.') }
      } else if (e?.response?.status !== 409) {
        alert(detail ?? e?.message ?? '호실 저장에 실패했습니다.')
      }
    } finally { setSaving(false) }
  }
  const age = calcAge(r.birthDate)
  const done = checklists.filter(c => isItemDone(c)).length
  const total = checklists.length
  const hasHigh = checklists.some(c => !isItemDone(c) && c.riskLevel === 'high')

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${r.status==='discharged'?'opacity-60 border-gray-100':r.status==='pending'?'border-amber-200 bg-amber-50/30':hasHigh?'border-red-200':'border-gray-200'}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={onDetail} title="상세 페이지 열기">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${genderAvatarClass(r.gender)}`}>
          {r.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{r.name}</span>
            {r.status === 'pending' && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
                {r.admissionDate ? `${Number(r.admissionDate.slice(5, 7))}/${Number(r.admissionDate.slice(8, 10))} 입소 예정` : '입소 예정'}
              </span>
            )}
            <span className="text-xs text-gray-500">{genderLabel(r.gender)} · {age}세</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status==='active'?'bg-green-100 text-green-700':r.status==='pending'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}`}>
              {r.status==='active'?'입소 중':r.status==='pending'?'입소 예정':'퇴소'}
            </span>
            {/* 호실 — 눌러서 바로 변경 (상세 열기와 겹치지 않게 전파 차단) */}
            {r.status !== 'discharged' && (
              <button onClick={e => { e.stopPropagation(); setPickOpen(true) }} disabled={saving}
                title="눌러서 호실 바로 변경"
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                  r.floor || r.room
                    ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                    : 'bg-white text-gray-400 border-dashed border-gray-300 hover:border-teal-300 hover:text-teal-600'}`}>
                {saving ? <Loader2 size={11} className="animate-spin" /> : <BedDouble size={11} />}
                {r.floor || r.room ? `${r.floor}${r.room ? ` ${r.room}호` : ''}` : '호실 미지정'}
              </button>
            )}
            {r.tubeFeeding && <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded">경관식</span>}
            {(r as any).positioning && <span className="text-[9px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1 py-0.5 rounded">체위변경</span>}
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
          {(r.status==='active' || r.status==='pending') && (
            <>
              <button onClick={e=>{e.stopPropagation();onDetail()}}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-xl hover:bg-gray-50">
                상세
              </button>
              <button onClick={e=>{e.stopPropagation();onAddGuardian()}}
                className="flex items-center gap-1 text-xs font-medium text-teal-600 border border-teal-200 px-2.5 py-1.5 rounded-xl hover:bg-teal-50">
                🌸 보호자
              </button>
              <button onClick={e=>{e.stopPropagation();onEdit()}} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Edit2 size={14}/></button>
              {r.status==='active' && (
                <button onClick={e=>{e.stopPropagation();onDischarge()}} className="flex items-center gap-1 text-xs font-medium text-red-500 border border-red-200 px-2.5 py-1.5 rounded-xl hover:bg-red-50"><LogOut size={12}/>퇴소</button>
              )}
              {canDelete && (
                <button onClick={e=>{e.stopPropagation();onDelete()}} title="수급자 삭제" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={14}/></button>
              )}
            </>
          )}
        </div>
      </div>

      {pickOpen && (
        <RoomPicker current={{ floor: r.floor, room: (r as any).room }}
          onClose={() => setPickOpen(false)}
          onPick={(f, room, force) => assignRoom(f, room, force)} />
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

export function ResidentForm({ existing, onClose }: { existing?: LtcResident; onClose:()=>void }) {
  const { addResident, updateResident } = useLtcStore()
  const today = new Date().toISOString().split('T')[0]
  const [roomPickOpen, setRoomPickOpen] = useState(false)
  const [overCap, setOverCap] = useState(false)   // 만실 방을 확인하고 고른 경우
  const [form, setForm] = useState({ name:existing?.name??'', birthDate:existing?.birthDate??'1930-01-01', gender:existing?.gender??'female', admissionDate:existing?.admissionDate??today, admissionTime:(existing as any)?.admissionTime??'', careGradeStartDate:existing?.careGradeStartDate??today, floor:existing?.floor??'', room:(existing as any)?.room??'', memo:existing?.memo??'', religion:existing?.religion??'', groupCognitive:existing?.groupCognitive??'', groupLeisure:existing?.groupLeisure??'', groupPhysical:existing?.groupPhysical??'', tubeFeeding:existing?.tubeFeeding??false, positioning:(existing as any)?.positioning??false })
  const [flags, setFlags] = useState({ basicMedical: false, restraint: false, pressureSore: false, positioning: false })
  const [certs, setCerts] = useState<Certification[]>([
    { grade:'3', cert_no:'', start: today, end: endFromStart(today, 2), benefits:[{ type:'시설', from: today }] },
  ])
  const [loading, setLoading] = useState(false)
  // ── 수정 모드: 서류현황의 인정서 로드 + 이미 생성된 대상자 구분 감지 ──
  const [docId, setDocId] = useState<string | null>(null)
  const [certsReady, setCertsReady] = useState(!existing)
  const checklists = useLtcStore(st => st.checklists)
  const addResidentFlagChecklists = useLtcStore(st => st.addResidentFlagChecklists)
  const existingFlags = useMemo(() => {
    if (!existing) return {} as Record<string, boolean>
    const mine = checklists.filter(c => c.personId === existing.id)
    const has = (frag: string) => mine.some(c => c.title.includes(frag))
    return {
      basicMedical: has('[기초의료]'),
      restraint: has('[신체제재]'),
      positioning: has('체위변경 표 침실 부착'),
      pressureSore: has('[욕창]'),
    } as Record<string, boolean>
  }, [existing, checklists])
  // 수정 모드에서는 기존 구분을 켠 상태로 시작 — 끄면 저장 시 해당 체크리스트를 삭제한다
  useEffect(() => {
    if (existing) setFlags(f => ({ ...f, ...existingFlags } as any))
  }, [existing, existingFlags])  // eslint-disable-line react-hooks/exhaustive-deps
  // 플래그별 체크리스트 판별 — 생성 템플릿 제목과 1:1
  const FLAG_MATCH: Record<string, (t: string) => boolean> = {
    basicMedical: t => t.includes('[기초의료]'),
    restraint: t => t.includes('[신체제재]'),
    positioning: t => ['욕창방지 도구 체크', '체위변경 표 침실 부착', '체위변경 기록지 작성 및 확인'].some(x => t.includes(x)),
    pressureSore: t => t.includes('[욕창]'),
  }
  useEffect(() => {
    if (!existing) return
    residentDocAPI.list(true).then(rows => {
      const d = rows.find(x => x.resident_id === existing.id)
      if (d) { setDocId(d.id); if ((d.certifications ?? []).length) setCerts(d.certifications as Certification[]) }
    }).catch(() => {}).finally(() => setCertsReady(true))
  }, [existing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // 조용히 끝내지 않는다 — 왜 안 되는지 말한다. 자세한 사정은 utils/residentForm.ts
    const problem = validateResidentForm(form, { isEdit: !!existing })
    if (problem) { alert(problem); return }
    setLoading(true)
    const certifications = certs.filter(c=>c.start||c.end||(c.benefits??[]).length)
    const careGradeStartDate = certs[0]?.start || form.careGradeStartDate || today
    const auto = autoDocEvents(certifications, form.admissionDate)
    try {
      if(existing) {
        await updateResident(existing.id, (overCap ? { ...form, allowOverCapacity: true } : form) as any)
        if (docId && certsReady) await residentDocAPI.update(docId, { certifications }).catch(() => alert('인정서 저장에 실패했습니다 — 서류현황에서 다시 시도해주세요.'))
        const newFlags = Object.fromEntries(Object.entries(flags).filter(([k, v]) => v && !existingFlags[k]))
        if (Object.keys(newFlags).length) {
          const n = await addResidentFlagChecklists(existing.id, newFlags).catch(() => 0)
          if (n > 0) alert(`대상자 구분 체크리스트 ${n}건이 추가되었습니다.`)
        }
        // 해제된 구분 → 해당 체크리스트 삭제 (완료 기록 포함)
        const offFlags = Object.keys(existingFlags).filter(k => existingFlags[k] && !(flags as any)[k])
        if (offFlags.length) {
          const targets = checklists.filter(c => c.personId === existing.id
            && offFlags.some(k => FLAG_MATCH[k]?.(c.title)))
          if (targets.length && confirm(`해제한 대상자 구분의 체크리스트 ${targets.length}건을 삭제할까요?\n완료된 항목·기록도 함께 지워지며 되돌릴 수 없습니다.`)) {
            for (const c of targets) await useLtcStore.getState().deleteChecklist(c.id).catch(() => {})
            alert(`체크리스트 ${targets.length}건을 삭제했습니다.`)
          }
        }
      }
      else await addResident({...form, careGradeStartDate, certifications, contract_lines:auto.contract, plan_lines:auto.plan, eval_lines:auto.eval, status:'active', intakeFlags: flags, allowOverCapacity: overCap} as any)
      onClose()
    }
    catch (err: any) { alert(err?.response?.data?.detail ?? '저장에 실패했습니다.') }
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
          {!existing && <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">✨ 등록 시 입소 (서류/준비) 체크리스트가 자동 생성됩니다 — 아래 <b>대상자 구분</b>에 따라 항목이 늘어나요.</div>}
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">성명 *</label><input required className={ic} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="홍길동"/></div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              생년월일 {existing
                ? <span className="font-normal text-gray-400">(비어 있어도 저장됩니다)</span>
                : '*'}
            </label>
            <BirthDateSelect value={form.birthDate} onChange={v=>setForm({...form,birthDate:v})}/>
            {form.birthDate && <p className="text-xs text-gray-400 mt-1">만 {calcAge(form.birthDate)}세</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">성별</label>
            <select className={ic} value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}>
              {/* 빈 값도 실제로 있는 상태다(간단 등록). 항목이 없으면 화면은 '여',
                  값은 '' 로 어긋난다 — 고른 적 없는 값이 저장된 것처럼 보인다. */}
              <option value="">미정</option>
              <option value="female">여</option>
              <option value="male">남</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">생활 층 · 호실 <span className="font-normal text-gray-400">(선택)</span></label>
            <button type="button" onClick={() => setRoomPickOpen(true)}
              className={`${ic} text-left flex items-center justify-between hover:border-teal-300`}>
              <span className={form.floor || form.room ? 'text-gray-800 font-semibold' : 'text-gray-400'}>
                {form.floor || form.room ? `${form.floor}${form.room ? ` ${form.room}호` : ''}` : '미지정 — 눌러서 빈 침대 고르기'}
              </span>
              <span className="text-[10px] text-teal-600 font-bold">침대 보기</span>
            </button>
            {roomPickOpen && (
              <RoomPicker current={{ floor: form.floor, room: form.room }}
                onClose={() => setRoomPickOpen(false)}
                onPick={(f, r, force) => {
                  setForm(p => ({ ...p, floor: f, room: r }))
                  setOverCap(!!force)
                  setRoomPickOpen(false)
                }} />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">종교 · 프로그램 그룹 <span className="font-normal text-gray-400">(선택 — 프로그램 분류에 사용)</span></label>
            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <p className="text-[10px] font-bold text-gray-400 mb-0.5 text-center">종교</p>
                <select className={ic} value={form.religion} onChange={e=>setForm({...form,religion:e.target.value})}>
                  <option value="">없음</option>
                  {['기독교','천주교','불교','원불교','무교','기타'].map(r0=><option key={r0} value={r0}>{r0}</option>)}
                </select>
              </div>
              {([['groupCognitive','인지','text-violet-600'],['groupLeisure','여가','text-sky-600'],['groupPhysical','신체','text-emerald-600']] as const).map(([k,label,cls])=>(
                <div key={k}>
                  <p className={`text-[10px] font-bold mb-0.5 text-center ${cls}`}>{label} 그룹</p>
                  <select className={ic} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}>
                    <option value="">없음</option>
                    {['A','B','C'].map(g=><option key={g} value={g}>{g}그룹</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={()=>setForm({...form,tubeFeeding:!form.tubeFeeding})}
            className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${form.tubeFeeding ? 'bg-rose-50 border-rose-300 text-rose-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            <span className="font-bold">{form.tubeFeeding ? '✓ ' : ''}경관식(비위관) 어르신</span>
            <span className="block text-[10px] opacity-70 mt-0.5">체크하면 식수 정산에서 자동으로 제외됩니다</span>
          </button>
          <button type="button" onClick={()=>setForm({...form,positioning:!form.positioning})}
            className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${form.positioning ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            <span className="font-bold">{form.positioning ? '✓ ' : ''}체위변경 대상자</span>
            <span className="block text-[10px] opacity-70 mt-0.5">와상·욕창 위험으로 2시간마다 자세를 바꿔 드려야 하는 어르신 · 체위변경 안내방송 명단에 들어갑니다</span>
          </button>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">입소일 *</label>
            {form.admissionDate > new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) && (
              <p className="text-[11px] text-amber-600 mb-1">입소일이 미래라 <b>입소 예정자</b>로 등록됩니다 — 입소일이 되면 자동으로 현원 전환 · 일정 캘린더에도 「입소」로 표시</p>
            )}<DateField className={ic} value={form.admissionDate} onChange={v=>setForm({...form,admissionDate:v})} clearable={false}/>
            {form.admissionDate > new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[11px] font-semibold text-gray-500 shrink-0">예정 시간</span>
                <button type="button" onClick={()=>setForm({...form,admissionTime:''})}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${!form.admissionTime ? 'bg-amber-100 text-amber-700 border-amber-300' : 'text-gray-400 border-gray-200'}`}>미정</button>
                <select value={form.admissionTime} onChange={e=>setForm({...form,admissionTime:e.target.value})}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
                  <option value="">시간 선택 (미정)</option>
                  {Array.from({length:20},(_,i)=>{const h=Math.floor(i/2)+9;const m=i%2===0?'00':'30';return `${String(h).padStart(2,'0')}:${m}`}).map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}</div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">장기요양인정서 <span className="text-gray-400 font-normal">— 등급·유효기간(2/3/4년)·급여(재가↔시설)</span></label>
            {certsReady ? <CertificationEditor value={certs} onChange={setCerts} />
              : <p className="text-xs text-gray-400 py-2">인정서 불러오는 중...</p>}
            <p className="text-xs text-gray-400 mt-1">{existing ? '저장하면 어르신 서류현황의 인정서가 함께 수정됩니다.' : '등록 시 어르신 서류현황에 자동 반영됩니다. (종료 90일 전 갱신 알림)'}</p>
            {existing && !docId && certsReady && <p className="text-[10px] text-amber-600 mt-0.5">⚠ 서류현황 기록이 없어 인정서는 저장되지 않습니다 — 서류현황에서 먼저 등록해주세요.</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">대상자 구분 <span className="font-normal text-gray-400">— {existing ? '새로 체크하고 저장하면 해당 체크리스트가 추가됩니다' : '해당하면 전용 체크리스트가 함께 생성됩니다'}</span></label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ['basicMedical', '기초 · 의료 대상자', '이용신청서·의뢰서 2건'],
                ['restraint', '신체 제재 대상자', '신체제재 등록·서명 등 5건'],
                ['positioning', '체위변경(다음날 업무)', '욕창방지 도구·체위변경 3건'],
                ['pressureSore', '욕창 대상자', '욕창 간호 기록 등 2건'],
              ] as const).map(([k, label, hint]) => {
                const already = !!existingFlags[k]
                const on = (flags as any)[k]
                const willRemove = already && !on
                const willAdd = !already && on
                return (
                  <button key={k} type="button"
                    onClick={() => setFlags(f => ({ ...f, [k]: !(f as any)[k] }))}
                    className={`text-left px-3 py-2 rounded-xl border text-xs transition-colors ${
                      willRemove ? 'bg-red-50 border-red-300 text-red-600'
                      : on ? 'bg-teal-50 border-teal-300 text-teal-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <span className="font-bold">{on ? '✓ ' : ''}{label}</span>
                    <span className="block text-[10px] opacity-70 mt-0.5">
                      {willRemove ? '저장 시 관련 체크리스트 삭제' : willAdd ? '저장 시 체크리스트 생성' : already ? '적용 중 — 끄면 체크리스트 삭제' : hint}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
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
  const [time, setTime] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try { await dischargeResident(residentId, date, time || undefined); onClose() } finally { setLoading(false) }
  }

  if (!r) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b"><h2 className="font-bold text-gray-900">퇴소 처리 — {r.name}</h2></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">퇴소 처리 시 「[희망이음] 퇴소 보고」·「[롱텀케어] 퇴소 등록」 체크리스트가 자동 생성되며(기한: 퇴소일+7일), 미완료 입소 체크리스트는 비활성화됩니다.</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">퇴소일 *</label><DateField className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40" value={date} onChange={v=>setDate(v)} clearable={false}/></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">퇴소 시간</label>
              <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"/>
              <p className="text-[10px] text-gray-400 mt-1">기록하면 퇴소일 식수가 이 시각 이전 끼니까지만 계산됩니다</p>
            </div>
          </div>
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


/** 입소 예정자 간단 등록 — 성함·예정일이면 끝. 나머지는 입소 확정 후 수정에서 채운다. */
function QuickPendingModal({ onClose }: { onClose: () => void }) {
  const { addResident } = useLtcStore()
  const week = new Date(Date.now() + 8 * 86400e3).toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [date, setDate] = useState(week)
  const [time, setTime] = useState('')   // 입소 예정 시간 — ''이면 미정
  const [gender, setGender] = useState('')   // ''이면 미정 — 나중에 수정에서 채운다
  const [floor, setFloor] = useState('')
  const [room, setRoom] = useState('')
  const [memo, setMemo] = useState('')
  const [pickOpen, setPickOpen] = useState(false)
  const [overCap, setOverCap] = useState(false)   // 만실 방을 확인하고 고른 경우
  const [saving, setSaving] = useState(false)
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

  const submit = async () => {
    if (!name.trim()) { alert('성함을 입력해주세요.'); return }
    if (!date || date <= today) { alert('입소 예정일은 내일 이후여야 합니다.'); return }
    setSaving(true)
    try {
      await addResident({
        name: name.trim(), admissionDate: date, admissionTime: time, careGradeStartDate: date,
        birthDate: '', gender, floor, room, memo,
        status: 'pending', allowOverCapacity: overCap,
      } as any)
      onClose()
      alert(`${name.trim()} 어르신을 입소 예정자로 등록했습니다.\n입소일(${date})이 되면 자동으로 현원이 됩니다.\n생년월일 등 상세 정보는 확정 후 수정에서 채워주세요.`)
    } catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '등록 실패') }
    finally { setSaving(false) }
  }

  const ic = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200'
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900">입소 예정자 간단 등록</h3>
        <p className="text-xs text-gray-400 -mt-2">성함과 예정일만 있으면 됩니다 — 상세 정보는 입소 확정 후에</p>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">성함 *</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} className={ic} placeholder="예: 홍길동" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            성별 <span className="font-normal text-gray-400">(선택 — 나중에 수정에서 채워도 됩니다)</span>
          </label>
          {/* 예전에는 이 칸이 아예 없어서 무조건 빈 값으로 저장됐고,
              목록이 빈 값을 '남' 으로 그려서 전부 남자로 보였다. */}
          <div className="flex gap-1.5">
            {([['female', '여'], ['male', '남'], ['', '미정']] as const).map(([v, label]) => (
              <button key={label} type="button" onClick={() => setGender(v)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                  gender === v
                    ? (v === 'female' ? 'bg-pink-100 text-pink-700 border-pink-300'
                      : v === 'male' ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-gray-100 text-gray-600 border-gray-300')
                    : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">입소 예정일 *</label>
          <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)} className={ic} />
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[11px] font-semibold text-gray-500 shrink-0">예정 시간</span>
            <button type="button" onClick={() => setTime('')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${!time ? 'bg-amber-100 text-amber-700 border-amber-300' : 'text-gray-400 border-gray-200'}`}>미정</button>
            <select value={time} onChange={e => setTime(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
              <option value="">시간 선택 (미정)</option>
              {Array.from({ length: 20 }, (_, i) => { const h = Math.floor(i / 2) + 9; const m = i % 2 === 0 ? '00' : '30'; return `${String(h).padStart(2, '0')}:${m}` }).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">일정 캘린더에 「입소」 일정으로 자동 등록됩니다 — 미정이면 그날 맨 위에 표시</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">방 미리 잡기 <span className="font-normal text-gray-400">(선택)</span></label>
          <button type="button" onClick={() => setPickOpen(true)}
            className={`${ic} text-left ${floor || room ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
            {floor || room ? `${floor}${room ? ` ${room}호` : ''}` : '눌러서 빈 침대 보기'}
          </button>
          {pickOpen && (
            <RoomPicker current={{ floor, room }} onClose={() => setPickOpen(false)}
              onPick={(f, r, force) => { setFloor(f); setRoom(r); setOverCap(!!force); setPickOpen(false) }} />
          )}
        </div>
        <input value={memo} onChange={e => setMemo(e.target.value)} className={ic} placeholder="메모 (선택 — 보호자 연락처 등)" />
        <button onClick={submit} disabled={saving}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50">
          {saving ? '등록 중…' : '예정자로 등록'}
        </button>
      </div>
    </div>
  )
}
