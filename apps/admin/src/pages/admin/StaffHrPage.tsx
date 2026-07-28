import DateField from '@/components/ui/DateField'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { FileText, Plus, X, Trash2, Loader2, Check } from 'lucide-react'
import { hrAPI, DOC_FIELDS, type HrRecord, type HrInput, type DocKey } from '../../api/hrClient'
import { useLtcStore, type LtcStaff } from '@/store/ltc'
import { cardKeyAPI, type CardKey, type CardInput } from '../../api/cardKeyClient'
import AnnualLeaveLedger from '@/components/schedule/AnnualLeaveLedger'
import PayslipManager from '@/components/hr/PayslipManager'
import { useAuthStore } from '@/store/auth'
import { STAFF_POSITIONS } from '@/constants/positions'


const fmtD = (s?: string | null) => {
  if (!s) return ''
  const p = s.split('-')
  return p.length === 3 ? `${p[0].slice(2)}.${p[1]}.${p[2]}` : s
}

function docBadge(v: boolean | null | undefined) {
  if (v === true) return { t: '제출', cls: 'bg-green-100 text-green-700 hover:bg-green-200' }
  if (v === false) return { t: '미제출', cls: 'bg-red-100 text-red-600 hover:bg-red-200' }
  return { t: '-', cls: 'bg-gray-50 text-gray-300 hover:bg-gray-100' }
}

export default function StaffHrPage() {
  const [rows, setRows] = useState<HrRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<HrRecord | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [showResigned, setShowResigned] = useState(false)
  const [expandedC, setExpandedC] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'detail' | 'hr' | 'card' | 'leave' | 'pay'>('detail')
  const { user: authUser } = useAuthStore()
  // 급여는 민감 정보 — ADMIN·시설장만 탭 노출 (서버도 동일 기준으로 잠금)
  const canPay = authUser?.role === 'ADMIN' || authUser?.position === '시설장'
  const { staffList, loaded: ltcLoaded, loadAll } = useLtcStore()
  useEffect(() => { if (!ltcLoaded) loadAll() }, [ltcLoaded, loadAll])
  const toggleC = (id: string) => setExpandedC(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await hrAPI.list(showResigned)) } finally { setLoading(false) }
  }, [showResigned])
  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const total = rows.length
    const notWritten = rows.filter(r => !r.contract_written).length
    const complete = rows.filter(r => DOC_FIELDS.every(d => r.docs[d.key] === true)).length
    const missing = rows.reduce((a, r) => a + DOC_FIELDS.filter(d => r.docs[d.key] === false).length, 0)
    return { total, notWritten, complete, missing }
  }, [rows])

  const positions = useMemo(() => [...new Set(rows.map(r => r.position).filter(Boolean))] as string[], [rows])
  const rankById = useMemo(() => new Map(rows.map((r, i) => [r.id, i + 1])), [rows])
  const filtered = useMemo(() => rows.filter(r => {
    if (search && !(r.name ?? '').includes(search)) return false
    if (posFilter && r.position !== posFilter) return false
    if (incompleteOnly) {
      const anyMissing = !r.contract_written || DOC_FIELDS.some(d => r.docs[d.key] !== true)
      if (!anyMissing) return false
    }
    return true
  }), [rows, search, posFilter, incompleteOnly])

  // 서류 셀 클릭: 미입력 → 제출 → 미제출 → 미입력
  const cycleDoc = async (r: HrRecord, key: DocKey) => {
    const cur = r.docs[key]
    const next = cur == null ? true : cur === true ? false : null
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, docs: { ...x.docs, [key]: next } } : x))
    try { await hrAPI.update(r.id, { docs: { [key]: next } }) } catch { load() }
  }
  const toggleWritten = async (r: HrRecord) => {
    const next = !r.contract_written
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, contract_written: next } : x))
    try { await hrAPI.update(r.id, { contract_written: next }) } catch { load() }
  }

  const _pad = (n: number) => String(n).padStart(2, '0')
  const _d = new Date()
  const todayIso = `${_d.getFullYear()}-${_pad(_d.getMonth() + 1)}-${_pad(_d.getDate())}`
  const th = 'px-2.5 py-2 text-[11px] font-bold text-gray-500 whitespace-nowrap text-center border-b border-gray-200'
  const td = 'px-2.5 py-2 text-xs whitespace-nowrap text-center border-b border-gray-50'

  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center"><FileText className="w-5 h-5 text-indigo-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">직원 상세</h1>
            <p className="text-xs text-gray-400">직원 인적·자격·계좌 정보와 근로계약·서류 현황을 관리합니다.</p>
          </div>
        </div>
        {tab === 'hr' && (
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm">
            <Plus className="w-4 h-4" /> 직원 추가
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1.5 mb-4">
        {([['detail', '직원 상세정보'], ['hr', '근로계약·서류'], ['leave', '연차 대장'], ['pay', '급여명세서'], ['card', '카드키 관리']] as const).filter(([k]) => k !== 'pay' || canPay).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === k ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'hr' && (<>
      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <Stat label="총 직원" value={`${stats.total}명`} tone="gray" />
        <Stat label="계약 미작성" value={`${stats.notWritten}명`} tone={stats.notWritten ? 'red' : 'gray'} />
        <Stat label="서류 완비" value={`${stats.complete}명`} tone="green" />
        <Stat label="미제출 서류" value={`${stats.missing}건`} tone={stats.missing ? 'amber' : 'gray'} />
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 검색"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 w-40" />
        <select value={posFilter} onChange={e => setPosFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200">
          <option value="">전체 직종</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer ml-1">
          <input type="checkbox" checked={incompleteOnly} onChange={e => setIncompleteOnly(e.target.checked)} className="accent-indigo-600" />
          미완료만
        </label>
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showResigned} onChange={e => setShowResigned(e.target.checked)} className="accent-gray-500" />
          퇴사 포함
        </label>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} / {rows.length}명</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse min-w-[980px]">
            <thead className="sticky top-0 z-30">
              <tr className="bg-gray-50/90">
                <th className={`${th} sticky left-0 z-20 bg-gray-50 text-left border-r border-gray-200 min-w-[140px]`}>직원</th>
                <th className={th}>입사일</th>
                <th className={`${th} text-left`}>근로계약일자</th>
                <th className={th}>작성</th>
                <th className={th}>재계약일</th>
                {DOC_FIELDS.map(d => <th key={d.key} className={th}>{d.short}</th>)}
                <th className={`${th} min-w-[92px]`}>완료</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const done = DOC_FIELDS.filter(d => r.docs[d.key] === true).length
                return (
                  <tr key={r.id} className={`group hover:bg-indigo-50/20 ${r.active === false ? 'opacity-50' : ''}`}>
                    <td className={`${td} sticky left-0 z-10 bg-white group-hover:bg-indigo-50/40 text-left border-r border-gray-100`}>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-gray-300">{rankById.get(r.id)}</span>
                        <span className="text-sm font-bold text-gray-800">{r.name || '-'}</span>
                        {r.active === false && <span className="text-[9px] font-bold text-white bg-gray-400 px-1 py-0.5 rounded">퇴사</span>}
                      </div>
                      <span className="text-[11px] text-gray-400">{r.position || '-'}</span>
                    </td>
                    <td className={`${td} text-gray-500`}>{r.hire_date || '-'}</td>
                    <td className={`${td} text-left text-gray-500 max-w-[180px]`}>
                      {r.contracts && r.contracts.length > 0 ? (
                        expandedC.has(r.id) ? (
                          <button onClick={() => toggleC(r.id)} className="text-left space-y-0.5">
                            {r.contracts.map((c, i) => (
                              <div key={i} className="whitespace-nowrap">
                                <span className={i === r.contracts!.length - 1 ? 'font-semibold text-gray-700' : ''}>{fmtD(c.start) || '?'} ~ {fmtD(c.end) || '진행'}</span>
                              </div>
                            ))}
                            <span className="text-[10px] text-indigo-500">접기 ▴</span>
                          </button>
                        ) : (() => {
                          const last = r.contracts[r.contracts.length - 1]
                          return (
                            <button onClick={() => toggleC(r.id)} className="text-left whitespace-nowrap">
                              <span className="font-semibold text-gray-700">{fmtD(last.start) || '?'} ~ {fmtD(last.end) || '진행'}</span>
                              {r.contracts.length > 1 && <span className="text-[10px] text-indigo-500 ml-1">외 {r.contracts.length - 1}건 ▾</span>}
                            </button>
                          )
                        })()
                      ) : (r.contract_period || '-')}
                    </td>
                    <td className={td}>
                      <button onClick={() => toggleWritten(r)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.contract_written ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                        {r.contract_written ? '작성' : '미작성'}
                      </button>
                    </td>
                    <td className={td}>
                      {r.renewal_date ? (
                        <span className={r.renewal_date < todayIso ? 'text-red-600 font-bold' : 'text-gray-500'}>
                          {fmtD(r.renewal_date)}{r.renewal_date < todayIso ? ' 지남' : ''}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {DOC_FIELDS.map(d => {
                      const b = docBadge(r.docs[d.key])
                      return (
                        <td key={d.key} className={td}>
                          <button onClick={() => cycleDoc(r, d.key)} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${b.cls}`}>{b.t}</button>
                        </td>
                      )
                    })}
                    <td className={td}>
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${done === DOC_FIELDS.length ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${(done / DOC_FIELDS.length) * 100}%` }} />
                        </div>
                        <span className={`text-[11px] font-bold ${done === DOC_FIELDS.length ? 'text-green-600' : 'text-gray-500'}`}>{done}/{DOC_FIELDS.length}</span>
                      </div>
                    </td>
                    <td className={td}>
                      <button onClick={() => setEditing(r)} className="text-[11px] text-gray-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-indigo-50">수정</button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={DOC_FIELDS.length + 7} className="text-center py-12 text-sm text-gray-400">{rows.length === 0 ? '등록된 직원이 없습니다.' : '조건에 맞는 직원이 없습니다.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">💡 서류 칸을 클릭하면 제출 → 미제출 → 미입력 순으로 바뀝니다. "작성" 배지도 클릭으로 토글됩니다.</p>
      </>)}

      {tab === 'detail' && <StaffDetailTable staff={staffList} />}

      {tab === 'leave' && <AnnualLeaveLedger />}
      {tab === 'pay' && canPay && <PayslipManager />}
      {tab === 'card' && <CardKeyTable />}

      {(addOpen || editing) && (
        <HrFormModal editing={editing}
          onClose={() => { setAddOpen(false); setEditing(null) }}
          onSaved={() => { setAddOpen(false); setEditing(null); load() }} />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'gray' | 'red' | 'green' | 'amber' }) {
  const map = { gray: 'bg-gray-50 text-gray-600', red: 'bg-red-50 text-red-600', green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700' }[tone]
  return <div className={`rounded-xl p-3 ${map}`}><p className="text-[11px] font-semibold opacity-70">{label}</p><p className="text-lg font-extrabold mt-0.5">{value}</p></div>
}

function HrFormModal({ editing, onClose, onSaved }: { editing: HrRecord | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing
  const [f, setF] = useState<HrInput>({
    name: editing?.name ?? '', position: editing?.position ?? '요양보호사',
    hire_date: editing?.hire_date ?? '', contract_period: editing?.contract_period ?? '',
    contract_written: editing?.contract_written ?? true, renewal_date: editing?.renewal_date ?? '',
    note: editing?.note ?? '', doc_note: editing?.doc_note ?? '',
    active: editing?.active ?? true,
    contracts: editing?.contracts ? editing.contracts.map(c => ({ ...c })) : [],
    docs: editing ? { ...editing.docs } : {},
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const setDoc = (k: DocKey, v: boolean | null) => setF(p => ({ ...p, docs: { ...p.docs, [k]: v } }))
  const minusMonth = (iso?: string | null) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return ''
    let ny = y, nm = m - 1
    if (nm < 1) { nm = 12; ny -= 1 }
    const dim = new Date(ny, nm, 0).getDate()
    const nd = Math.min(d, dim)
    return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
  }
  const recalcRenewal = (cs: { start?: string | null; end?: string | null }[]): string | undefined => {
    const ends = cs.map(c => c.end).filter(Boolean) as string[]
    return ends.length ? minusMonth(ends.sort().slice(-1)[0]) : undefined
  }
  const updateContract = (i: number, k: 'start' | 'end', v: string) => setF(p => {
    const cs = [...(p.contracts ?? [])]; cs[i] = { ...cs[i], [k]: v }
    const rn = recalcRenewal(cs)
    return { ...p, contracts: cs, ...(rn !== undefined ? { renewal_date: rn } : {}) }
  })
  const removeContract = (i: number) => setF(p => {
    const cs = (p.contracts ?? []).filter((_, x) => x !== i)
    const rn = recalcRenewal(cs)
    return { ...p, contracts: cs, ...(rn !== undefined ? { renewal_date: rn } : {}) }
  })
  const addContract = () => setF(p => ({ ...p, contracts: [...(p.contracts ?? []), { start: '', end: '' }] }))
  const contractEnd3m = (start?: string | null) => {
    if (!start) return ''
    const [y, m, d] = start.split('-').map(Number)
    if (!y || !m || !d) return ''
    let m2 = m + 3, y2 = y
    if (m2 > 12) { y2 += Math.floor((m2 - 1) / 12); m2 = ((m2 - 1) % 12) + 1 }
    const dim = new Date(y2, m2, 0).getDate()
    const end = new Date(y2, m2 - 1, Math.min(d, dim))
    end.setDate(end.getDate() - 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
  }
  const onHireChange = (v: string) => setF(p => {
    // 신규(수정 아님)이고 계약이 비어 있으면 입사일 기준 3개월 계약 자동
    if (!isEdit && (!p.contracts || p.contracts.length === 0) && v) {
      const end = contractEnd3m(v)
      return { ...p, hire_date: v, contracts: [{ start: v, end }], renewal_date: end ? minusMonth(end) : '' }
    }
    return { ...p, hire_date: v }
  })

  const submit = async () => {
    if (!f.name?.trim()) { setErr('이름을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      if (isEdit) await hrAPI.update(editing!.id, f)
      else await hrAPI.create(f)
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }
  const del = async () => {
    if (!isEdit || !confirm('이 직원 기록을 삭제할까요?')) return
    setSaving(true); try { await hrAPI.remove(editing!.id); onSaved() } finally { setSaving(false) }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900">{isEdit ? '직원 정보 수정' : '직원 추가'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="이름 *"><input value={f.name ?? ''} onChange={e => setF({ ...f, name: e.target.value })} className={inp} autoFocus /></Field>
            <Field label="직종">
              <select value={f.position ?? ''} onChange={e => setF({ ...f, position: e.target.value })} className={inp}>
                <option value="">직종 선택</option>
                {f.position && !(STAFF_POSITIONS as readonly string[]).includes(f.position) && (
                  <option value={f.position}>{f.position}</option>
                )}
                {STAFF_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="입사일"><DateField value={f.hire_date} onChange={v => onHireChange(v)} className={inp} /></Field>
            <Field label="재계약일자 (자동)">
              <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                {f.renewal_date ? fmtD(f.renewal_date) : '계약 기간 추가 시 자동'}
              </div>
            </Field>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">근로계약 기간 <span className="text-gray-400 font-normal">(재계약 시 계속 추가)</span></label>
            <div className="space-y-2">
              {(f.contracts ?? []).map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <DateField value={c.start} onChange={v => updateContract(i, 'start', v)} className={inp} wrapperClassName="flex-1" />
                  <span className="text-gray-400 shrink-0">~</span>
                  <DateField value={c.end} onChange={v => updateContract(i, 'end', v)} className={inp} wrapperClassName="flex-1" />
                  <button type="button" onClick={() => removeContract(i)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={addContract} className="text-xs font-semibold text-indigo-600 hover:underline">+ 근로계약 기간 추가</button>
              <p className="text-[11px] text-gray-400">재계약일은 최근 계약 종료일의 1개월 전으로 자동 계산됩니다.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 items-center">
            <div />
            <label className="flex items-center gap-2 text-sm text-gray-700 mt-5 cursor-pointer">
              <input type="checkbox" checked={!!f.contract_written} onChange={e => setF({ ...f, contract_written: e.target.checked })} className="accent-indigo-600 w-4 h-4" /> 근로계약서 작성 완료
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">재직 상태</span>
            <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
              {([['재직', true], ['퇴사', false]] as const).map(([t, v]) => (
                <button key={t} type="button" onClick={() => setF({ ...f, active: v })}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${!!f.active === v ? (v ? 'bg-white text-indigo-700 shadow-sm' : 'bg-white text-gray-600 shadow-sm') : 'text-gray-400'}`}>{t}</button>
              ))}
            </div>
            <span className="text-[11px] text-gray-400">퇴사 시 표에서 숨겨지고 "퇴사 포함"으로 볼 수 있어요</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">제출 서류</label>
            <div className="grid grid-cols-2 gap-1.5">
              {DOC_FIELDS.map(d => {
                const v = f.docs?.[d.key]
                return (
                  <div key={d.key} className="flex items-center justify-between border border-gray-100 rounded-lg px-2.5 py-1.5">
                    <span className="text-xs text-gray-600">{d.label}</span>
                    <div className="flex gap-1">
                      {([['제출', true, 'green'], ['미제출', false, 'red'], ['-', null, 'gray']] as const).map(([t, val, c]) => (
                        <button key={t} onClick={() => setDoc(d.key, val)}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${v === val ? (c === 'green' ? 'bg-green-500 text-white' : c === 'red' ? 'bg-red-500 text-white' : 'bg-gray-400 text-white') : 'bg-gray-50 text-gray-400'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <Field label="기타 메모"><input value={f.note ?? ''} onChange={e => setF({ ...f, note: e.target.value })} className={inp} /></Field>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {isEdit && <button onClick={del} disabled={saving} className="mr-auto px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />삭제</button>}
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>{children}</div>
}

// ── 직원 상세정보 표 (인적·자격·계좌 분류) ──────────────────────
type StaffSort = 'hire' | 'name' | 'birth' | 'position'
const SORTS: { v: StaffSort; label: string }[] = [
  { v: 'hire', label: '입사일순' },
  { v: 'name', label: '가나다순' },
  { v: 'birth', label: '생년월일순' },
  { v: 'position', label: '직종순' },
]
// 직종 정렬은 지시 체계 순 — 근무표와 같은 기준
const POS_RANK = ['시설장', '간호팀장', '사무국장', '사회복지사', '간호사', '간호조무사', '물리치료사', '요양팀장', '요양보호사', '조리원', '영양사', '위생원', '사무원']
const posRank = (p?: string | null) => { const i = POS_RANK.indexOf(p ?? ''); return i === -1 ? 99 : i }

function StaffDetailTable({ staff }: { staff: LtcStaff[] }) {
  const { updateStaff } = useLtcStore()
  // 메모 인라인 편집 — 클릭해서 바로 적고, 포커스가 빠지면 저장
  const [memoEdit, setMemoEdit] = useState<{ id: string; v: string } | null>(null)
  const saveMemo = async () => {
    if (!memoEdit) return
    const target = staff.find(x => x.id === memoEdit.id)
    if (target && (target.memo ?? '') !== memoEdit.v) {
      try { await updateStaff(memoEdit.id, { memo: memoEdit.v }) }
      catch { alert('메모 저장에 실패했습니다.') }
    }
    setMemoEdit(null)
  }
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<StaffSort>('hire')
  // 월별 인원 파악 — ''=현재(현인원), 'YYYY-MM'=그 달에 재직했던 인원
  const now = new Date()
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [ym, setYm] = useState('')
  const moveYm = (delta: number) => {
    const base = ym || thisYm
    const [y, m] = base.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  // 그 달 재직 = 그 달이 끝나기 전 입사 + (퇴사 없음 또는 그 달 시작 이후 퇴사)
  const employedIn = (s: LtcStaff, month: string) => {
    const end = `${month}-31`, start = `${month}-01`
    const hired = (s.hireDate || '') <= end
    const resign = (s as any).resignDate as string | undefined
    return hired && (!resign || resign >= start)
  }

  const rows = useMemo(() => {
    let list = staff
    if (ym) list = list.filter(s => employedIn(s, ym))          // 과거 달 = 그때 재직자
    else list = list.filter(s => s.status === 'active')          // 현재 = 현인원
    if (q) list = list.filter(s => s.name.includes(q) || (s.position ?? '').includes(q))
    const cmp: Record<StaffSort, (a: LtcStaff, b: LtcStaff) => number> = {
      hire: (a, b) => (a.hireDate || '9999').localeCompare(b.hireDate || '9999'),
      name: (a, b) => a.name.localeCompare(b.name, 'ko'),
      birth: (a, b) => (a.birthDate || '9999').localeCompare(b.birthDate || '9999'),
      position: (a, b) => posRank(a.position) - posRank(b.position) || a.name.localeCompare(b.name, 'ko'),
    }
    return [...list].sort(cmp[sort])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, q, sort, ym])

  const th = 'px-2.5 py-2 text-[11px] font-bold text-gray-500 whitespace-nowrap text-center border-b border-gray-200'
  const gh = 'px-2.5 py-1.5 text-[11px] font-extrabold whitespace-nowrap text-center border-b border-gray-200'
  const td = 'px-2.5 py-2 text-xs whitespace-nowrap text-center border-b border-gray-50 text-gray-600'
  const val = (v?: string | null) => v ? v : <span className="text-gray-300">-</span>

  return (
    <>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* 월별 인원 — ‹ › 로 과거 달의 재직 인원을 본다. 라벨 클릭 = 현인원 */}
        <div className="inline-flex items-center h-9 border border-gray-200 rounded-xl bg-white overflow-hidden">
          <button onClick={() => moveYm(-1)} className="h-full px-2.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50" aria-label="이전 달">‹</button>
          <button onClick={() => setYm(ym ? '' : thisYm)}
            title={ym ? '누르면 현인원 보기' : '누르면 이번 달부터 과거로 이동'}
            className="h-full px-2 min-w-[8.5rem] text-sm font-bold text-gray-700 hover:bg-gray-50">
            {ym ? `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(5, 7))}월 재직` : '현인원'}
            <span className="ml-1.5 text-[11px] font-extrabold text-indigo-600">{rows.length}명</span>
          </button>
          <button onClick={() => moveYm(1)} className="h-full px-2.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50" aria-label="다음 달">›</button>
        </div>

        {/* 정렬 */}
        <div className="inline-flex bg-gray-100 rounded-xl p-0.5">
          {SORTS.map(o => (
            <button key={o.v} onClick={() => setSort(o.v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${sort === o.v ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {o.label}
            </button>
          ))}
        </div>

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름·직종 검색"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 w-36" />
        {ym && <span className="text-[11px] text-gray-400">그 달에 하루라도 재직했던 인원 (퇴사자 포함)</span>}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100 text-sm">직원이 없습니다.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse min-w-[1100px]">
            <thead className="sticky top-0 z-30 bg-white">
              <tr>
                <th className={`${gh} sticky left-0 z-20 bg-indigo-50/60 text-indigo-700 border-r border-gray-200`} colSpan={5}>기본정보</th>
                <th className={`${gh} bg-teal-50/60 text-teal-700`} colSpan={3}>인적사항</th>
                <th className={`${gh} bg-amber-50/60 text-amber-700`} colSpan={3}>자격 · 계좌</th>
                <th className={`${gh} bg-gray-50 text-gray-500`}>메모</th>
              </tr>
              <tr className="bg-gray-50/90">
                <th className={`${th} sticky left-0 z-20 bg-gray-50 text-left border-r border-gray-200 min-w-[120px]`}>성명</th>
                <th className={th}>직종</th>
                <th className={th}>입사일</th>
                <th className={th}>생년월일</th>
                <th className={th}>상태</th>
                <th className={th}>주민번호</th>
                <th className={th}>연락처</th>
                <th className={`${th} text-left min-w-[200px]`}>주소</th>
                <th className={th}>자격증 발급일</th>
                <th className={th}>자격증 No</th>
                <th className={th}>통장번호</th>
                <th className={`${th} text-left min-w-[180px]`}>메모 <span className="font-normal text-gray-300">(클릭해 입력)</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id} className="hover:bg-indigo-50/30">
                  <td className={`${td} sticky left-0 z-10 bg-white text-left border-r border-gray-100 font-bold text-gray-800`}>{s.name}</td>
                  <td className={td}>{val(s.position)}</td>
                  <td className={td}>{fmtD(s.hireDate)}</td>
                  <td className={td}>{fmtD(s.birthDate)}</td>
                  <td className={td}>{s.status === 'active'
                    ? <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">재직</span>
                    : <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">퇴사</span>}</td>
                  <td className={td}>{val(s.residentNo)}</td>
                  <td className={td}>{val(s.phone)}</td>
                  <td className={`${td} text-left whitespace-normal min-w-[200px]`}>
                    {s.address ? <span>{s.address}{s.addressDetail ? <span className="text-gray-400"> {s.addressDetail}</span> : null}</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className={td}>{fmtD(s.licenseDate) || <span className="text-gray-300">-</span>}</td>
                  <td className={td}>{val(s.licenseNo)}</td>
                  <td className={td}>{val(s.bankAccount)}</td>
                  <td className={`${td} text-left whitespace-normal min-w-[180px] cursor-pointer hover:bg-gray-50`}
                    onClick={() => !memoEdit && setMemoEdit({ id: s.id, v: s.memo ?? '' })}>
                    {memoEdit?.id === s.id ? (
                      <input autoFocus value={memoEdit.v}
                        onChange={e => setMemoEdit({ id: s.id, v: e.target.value })}
                        onBlur={saveMemo}
                        onKeyDown={e => { if (e.key === 'Enter') saveMemo(); if (e.key === 'Escape') setMemoEdit(null) }}
                        className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                    ) : (
                      s.memo ? <span className="text-gray-600">{s.memo}</span> : <span className="text-gray-300">메모 추가</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">💡 직원 등록·정보 수정은 <strong>직원 관리</strong>에서 진행합니다.</p>
    </>
  )
}

// ── 카드키 관리 (카드번호·소지자·보증금·반납 현황) ──────────────────
function CardKeyTable() {
  const [rows, setRows] = useState<CardKey[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CardKey | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [showReturned, setShowReturned] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await cardKeyAPI.list()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const inUse = rows.filter(r => !r.returned).length
  const returned = rows.filter(r => r.returned).length
  const filtered = rows.filter(r => showReturned || !r.returned)

  const th = 'px-2.5 py-2 text-[11px] font-bold text-gray-500 whitespace-nowrap text-center border-b border-gray-200'
  const td = 'px-2.5 py-2 text-xs whitespace-nowrap text-center border-b border-gray-50 text-gray-600'
  const val = (v?: string | null) => v ? v : <span className="text-gray-300">-</span>

  // 보증금 상태 — 서류 칸과 같은 3단계 순환: 미입력(회색) → 미납부 → 납부 → 미입력
  // 납부 = 납부일 있음 / 미납부 = 액수 칸에 '미납부' 표식 / 둘 다 없으면 미입력
  const depositState = (c: CardKey): 'paid' | 'unpaid' | 'none' =>
    c.deposit_date ? 'paid' : c.deposit_amount === '미납부' ? 'unpaid' : 'none'
  // 그 줄만 갈아끼운다 — load()로 전체를 다시 그리면 스피너 때문에
  // 화면이 통째로 새로고침되는 것처럼 보인다
  const patchRow = (updated: CardKey) =>
    setRows(rs => rs.map(r => r.id === updated.id ? updated : r))

  const toggleDeposit = async (c: CardKey) => {
    const today = new Date().toISOString().split('T')[0]
    const st = depositState(c)
    const next = st === 'none'
      ? { deposit_date: null, deposit_amount: '미납부' }                    // → 미납부
      : st === 'unpaid'
        ? { deposit_date: today, deposit_amount: '10,000원' }               // → 납부
        : { deposit_date: null, deposit_amount: null }                      // → 미입력
    patchRow({ ...c, ...next } as CardKey)                                  // 낙관적 반영 — 즉시 바뀜
    try { patchRow(await cardKeyAPI.update(c.id, next)) }
    catch { alert('저장 실패 — 다시 시도해주세요'); load() }
  }

  const toggleReturn = async (c: CardKey) => {
    const today = new Date().toISOString().split('T')[0]
    const next = !c.returned
    const body = { returned: next, return_date: next ? (c.return_date || today) : null, returner: next ? (c.returner || c.holder || null) : null }
    patchRow({ ...c, ...body } as CardKey)
    try { patchRow(await cardKeyAPI.update(c.id, body)) }
    catch { alert('저장 실패 — 다시 시도해주세요'); load() }
  }
  const del = async (c: CardKey) => { if (!confirm('이 카드키 기록을 삭제할까요?')) return; await cardKeyAPI.remove(c.id); load() }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <Stat label="총 카드" value={`${rows.length}개`} tone="gray" />
        <Stat label="사용 중" value={`${inUse}개`} tone={inUse ? 'green' : 'gray'} />
        <Stat label="반납" value={`${returned}개`} tone={returned ? 'amber' : 'gray'} />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm">
          <Plus className="w-4 h-4" /> 카드 추가
        </button>
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer ml-1">
          <input type="checkbox" checked={showReturned} onChange={e => setShowReturned(e.target.checked)} className="accent-gray-500" />
          반납 포함
        </label>
        <span className="text-[11px] text-gray-400">💡 보증금 배지: 미입력 → 미납부 → 납부 10,000원 순환 · 반납 배지도 클릭 토글</span>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} / {rows.length}개</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100 text-sm">등록된 카드키가 없습니다.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-30">
              <tr className="bg-gray-50/90">
                <th className={`${th} w-10`}>#</th>
                <th className={th}>카드 번호</th>
                <th className={th}>소지자</th>
                <th className={th}>보증금 납부일</th>
                <th className={th}>방법</th>
                <th className={th}>보증금</th>
                <th className={th}>반납 현황</th>
                <th className={`${th} text-left`}>메모</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={`hover:bg-indigo-50/30 ${c.returned ? 'bg-gray-50/40' : ''}`}>
                  <td className={`${td} text-gray-300`}>{i + 1}</td>
                  <td className={`${td} font-bold text-gray-800`}>{val(c.card_number)}</td>
                  <td className={td}>{val(c.holder)}</td>
                  <td className={td}>{fmtD(c.deposit_date) || <span className="text-gray-300">-</span>}</td>
                  <td className={td}>{val(c.deposit_method)}</td>
                  <td className={td}>
                    {(() => {
                      const st = depositState(c)
                      const meta = st === 'paid'
                        ? { t: `납부 ${c.deposit_amount || ''}`.trim(), cls: 'bg-green-100 text-green-700 hover:bg-green-200' }
                        : st === 'unpaid'
                          ? { t: '미납부', cls: 'bg-red-100 text-red-600 hover:bg-red-200' }
                          : { t: '미입력', cls: 'bg-gray-100 text-gray-400 hover:bg-gray-200' }
                      return (
                        <button type="button"
                          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleDeposit(c) }}
                          title="클릭: 미입력 → 미납부 → 납부 10,000원 → 미입력"
                          className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${meta.cls}`}>
                          {meta.t}
                        </button>
                      )
                    })()}
                  </td>
                  <td className={td}>
                    <button type="button"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleReturn(c) }}
                      title="클릭하면 사용중 ↔ 반납완료"
                      className="flex flex-col items-center mx-auto">
                      {c.returned ? (
                        <>
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-200">반납완료</span>
                          <span className="text-[10px] text-gray-400 mt-0.5">{fmtD(c.return_date)}{c.returner ? ` · ${c.returner}` : ''}</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded hover:bg-green-100">사용중</span>
                      )}
                    </button>
                  </td>
                  <td className={`${td} text-left whitespace-normal max-w-[160px]`}>{val(c.memo)}</td>
                  <td className={td}>
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => toggleReturn(c)} className={`text-[11px] font-semibold px-2 py-1 rounded-lg border ${c.returned ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-amber-200 text-amber-600 hover:bg-amber-50'}`}>{c.returned ? '반납취소' : '반납처리'}</button>
                      <button onClick={() => setEditing(c)} className="text-[11px] text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-50">수정</button>
                      <button onClick={() => del(c)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(addOpen || editing) && (
        <CardFormModal editing={editing} onClose={() => { setAddOpen(false); setEditing(null) }}
          onSaved={() => { setAddOpen(false); setEditing(null); load() }} />
      )}
    </>
  )
}

function CardFormModal({ editing, onClose, onSaved }: { editing: CardKey | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing
  const [f, setF] = useState<CardInput>({
    card_number: editing?.card_number ?? '', holder: editing?.holder ?? '',
    deposit_date: editing?.deposit_date ?? '', deposit_method: editing?.deposit_method ?? '',
    deposit_amount: editing?.deposit_amount ?? '',   // 상태 배지에서 납부 클릭 시 10,000원 자동
    returned: editing?.returned ?? false, return_date: editing?.return_date ?? '', returner: editing?.returner ?? '',
    memo: editing?.memo ?? '',
  })
  const [saving, setSaving] = useState(false)
  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200'

  const submit = async () => {
    setSaving(true)
    try {
      if (isEdit) await cardKeyAPI.update(editing!.id, f); else await cardKeyAPI.create(f)
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900">{isEdit ? '카드키 수정' : '카드키 추가'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="카드 번호"><input value={f.card_number ?? ''} onChange={e => setF({ ...f, card_number: e.target.value })} className={inp} autoFocus /></Field>
            <Field label="소지자"><input value={f.holder ?? ''} onChange={e => setF({ ...f, holder: e.target.value })} className={inp} placeholder="이름" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="보증금 납부일"><DateField value={f.deposit_date} onChange={v => setF({ ...f, deposit_date: v })} className={inp} /></Field>
            <Field label="납부 방법"><input value={f.deposit_method ?? ''} onChange={e => setF({ ...f, deposit_method: e.target.value })} className={inp} placeholder="현금 / 이체 등" /></Field>
          </div>
          <Field label="보증금 액수"><input value={f.deposit_amount ?? ''} onChange={e => setF({ ...f, deposit_amount: e.target.value })} className={inp} placeholder="예: 10,000원" /></Field>
          <div className="border-t border-gray-100 pt-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600">
              <input type="checkbox" checked={!!f.returned} onChange={e => setF({ ...f, returned: e.target.checked })} className="accent-indigo-600" /> 반납 완료
            </label>
            {f.returned && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Field label="반납일"><DateField value={f.return_date} onChange={v => setF({ ...f, return_date: v })} className={inp} /></Field>
                <Field label="반납자"><input value={f.returner ?? ''} onChange={e => setF({ ...f, returner: e.target.value })} className={inp} placeholder="이름" /></Field>
              </div>
            )}
          </div>
          <Field label="메모"><input value={f.memo ?? ''} onChange={e => setF({ ...f, memo: e.target.value })} className={inp} /></Field>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={submit} disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{saving ? '저장 중...' : isEdit ? '수정' : '추가'}</button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm">취소</button>
        </div>
      </div>
    </div>
  )
}
