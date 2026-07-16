import { useEffect, useState, useCallback, useMemo } from 'react'
import { ClipboardList, Plus, X, Trash2, Loader2, Check, BookOpen, RefreshCw } from 'lucide-react'
import DateField from '@/components/ui/DateField'
import { residentDocAPI, type ResidentDoc, type DocInput } from '../../api/residentDocClient'
import CertificationEditor from '@/components/eval/CertificationEditor'
import DocEventsEditor from '@/components/eval/DocEventsEditor'
import { currentCert, certState, renewalDue, gradeLabel, benefitLabel } from '@/utils/cert'
import { type DocEvent, type DocType, KINDS, kindMeta, asEvent, fmtYMD, fmtMD, autoDocEvents } from '@/utils/docEvents'
import { useLtcStore, type LtcResident } from '@/store/ltc'

const fmtD = (s?: string | null) => {
  if (!s) return ''
  const p = s.split('-')
  return p.length === 3 ? `${p[0].slice(2)}.${p[1]}.${p[2]}` : s
}
const plus6 = (s?: string | null) => {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return ''
  let ny = y, nm = m + 6
  if (nm > 12) { ny += Math.floor((nm - 1) / 12); nm = ((nm - 1) % 12) + 1 }
  const dim = new Date(ny, nm, 0).getDate()
  return fmtMD(`${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`)
}

const SOP = `▶ 서류(인정서, 개장기) 사진찍어 복지톡에 업로드
▶ 보호자께 갱신 서류 도착 문자 알림
▶ 서류 복사 후 복사본은 어르신 개인 파일에 철하기
▶ 원본은 출입구 앞 파일에 넣기(보호자 오시면 드리기)
▶ 계약서 준비 후 출입구 앞 파일에(내용 전부 미리 작성, 보호자 서명만)
▶ 케어포 등급 및 본인부담률 수정 / 구글 현황표 수정
* 갱신기준일자에 맞춰 급여제공계획서 작성 후 보호자 서명받아 철하기
* 갱신기준일자에 맞춰 급여제공평가 등 각종 평가 작성
* 국민건강보험공단에 갱신 등록`
const SMS = `안녕하세요. 행복한요양원 복지팀 000입니다. 어르신 인정서 갱신서류가 우편으로 도착했습니다. 원 방문 시 계약 서류 작성 부탁드립니다 ^^`

export default function ResidentDocsPage() {
  const [rows, setRows] = useState<ResidentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ResidentDoc | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [showDischarged, setShowDischarged] = useState(false)
  const [search, setSearch] = useState('')
  const [fee, setFee] = useState('')
  const [quick, setQuick] = useState<'all' | 'cert' | 'month'>('all')
  const [sopOpen, setSopOpen] = useState(false)
  const { residents, loaded: ltcLoaded, loadAll } = useLtcStore()
  useEffect(() => { if (!ltcLoaded) loadAll() }, [ltcLoaded, loadAll])
  const [exp, setExp] = useState<Set<string>>(new Set())
  const toggleExp = (k: string) => setExp(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await residentDocAPI.list(showDischarged)) } finally { setLoading(false) }
  }, [showDischarged])
  useEffect(() => { load() }, [load])

  const rankById = useMemo(() => new Map(rows.map((r, i) => [r.id, i + 1])), [rows])
  const nowMonth = new Date().getMonth() + 1
  const docInfo = (r: ResidentDoc) => {
    const cur = currentCert(r.certifications ?? [])
    const st = certState(cur)
    const rm = r.base_date ? (() => { const m = Number(r.base_date!.split('-')[1]); return m ? [m, ((m - 1 + 6) % 12) + 1] : [] })() : []
    return { cur, st, renew: rm.includes(nowMonth) }
  }
  const summary = useMemo(() => {
    let cert = 0, month = 0
    rows.forEach(r => { const i = docInfo(r); if (i.st.status === 'expired' || i.st.status === 'renew') cert++; if (i.renew) month++ })
    return { total: rows.length, cert, month }
  }, [rows])
  const filtered = useMemo(() => rows.filter(r => {
    if (search && !(r.name ?? '').includes(search)) return false
    if (fee && !(r.grade ?? '').includes(fee)) return false
    const i = docInfo(r)
    if (quick === 'cert' && !(i.st.status === 'expired' || i.st.status === 'renew')) return false
    if (quick === 'month' && !i.renew) return false
    return true
  }), [rows, search, fee, quick])

  const th = 'px-2.5 py-2 text-[11px] font-bold text-gray-500 whitespace-nowrap text-center border-b border-gray-200'
  const td = 'px-2.5 py-2 text-xs align-top border-b border-gray-50'

  const DocCell = ({ id, type, items, admission }: { id: string; type: DocType; items?: DocEvent[]; admission?: string | null }) => {
    const evs = (items ?? []).map(asEvent).filter(e => e.date || e.memo).filter(e => !admission || !e.date || e.date >= admission)
    if (!evs.length) return <span className="text-gray-300">-</span>
    const byDate = (a: DocEvent, b: DocEvent) => (a.date || '9999').localeCompare(b.date || '9999')
    const sorted = [...evs].sort(byDate)
    // 입소일부터 시간순으로 가까운 5개까지 노출 (입소 포함)
    const visible = sorted.slice(0, 5)
    const history = sorted.slice(5)
    const key = `${id}|${type}`, open = exp.has(key)
    const row = (e: DocEvent, rk: string, dim = false) => {
      const meta = kindMeta(type, e.kind) ?? KINDS[type][0]
      return (
        <div key={rk} className="whitespace-nowrap flex items-center gap-1">
          {e.done
            ? <Check className="w-3 h-3 shrink-0 text-green-600" strokeWidth={3} />
            : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot} ${dim ? 'opacity-40' : ''}`} />}
          <span className={`font-semibold ${e.done ? 'line-through text-gray-400' : dim ? 'text-gray-400' : meta.text}`}>
            {e.date ? fmtYMD(e.date) : '미정'}
          </span>
          {e.memo && <span className="text-[11px] text-gray-400 truncate max-w-[7rem]">· {e.memo}</span>}
        </div>
      )
    }
    return (
      <div className="space-y-0.5">
        {visible.length ? visible.map((e, i) => row(e, `v${i}`)) : <span className="text-[11px] text-gray-300">예정 없음</span>}
        {history.length > 0 && (open ? (
          <>
            <div className="border-t border-dashed border-gray-100 my-0.5" />
            {history.map((e, i) => row(e, `h${i}`, true))}
            <button onClick={() => toggleExp(key)} className="text-[10px] text-indigo-500">접기 ▴</button>
          </>
        ) : (
          <button onClick={() => toggleExp(key)} className="text-[10px] text-indigo-500">그 외 {history.length}건 ▾</button>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-teal-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">어르신 서류 현황</h1>
            <p className="text-xs text-gray-400">인정서·계약서·급여제공계획서·평가 일시를 관리합니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSopOpen(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <BookOpen className="w-4 h-4" /> 서류 절차 안내
          </button>
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-sm">
            <Plus className="w-4 h-4" /> 어르신 추가
          </button>
        </div>
      </div>

      {sopOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 text-sm">
          <p className="font-bold text-amber-800 mb-1.5">★ 인정서·개장기 갱신 서류 도착 시 처리 순서 ★</p>
          <pre className="whitespace-pre-wrap text-[13px] text-amber-800 leading-relaxed font-sans">{SOP}</pre>
          <p className="font-bold text-amber-800 mt-3 mb-1">보호자 안내 문자 예시</p>
          <div className="bg-white rounded-lg p-2.5 text-[13px] text-gray-600">{SMS}</div>
        </div>
      )}

      {/* 요약 알림 — 클릭하면 필터 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <button onClick={() => setQuick('all')}
          className={`rounded-xl p-3 text-left border transition-colors ${quick === 'all' ? 'bg-teal-50 border-teal-300' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
          <p className="text-[11px] font-semibold text-gray-500">전체 어르신</p>
          <p className="text-xl font-extrabold text-gray-900">{summary.total}<span className="text-sm font-bold text-gray-400">명</span></p>
        </button>
        <button onClick={() => setQuick(quick === 'cert' ? 'all' : 'cert')}
          className={`rounded-xl p-3 text-left border transition-colors ${quick === 'cert' ? 'bg-amber-100 border-amber-300' : summary.cert > 0 ? 'bg-amber-50 border-amber-100 hover:border-amber-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[11px] font-semibold text-amber-600">갱신 대상 (종료 90일↓)</p>
          <p className={`text-xl font-extrabold ${summary.cert > 0 ? 'text-amber-700' : 'text-gray-300'}`}>{summary.cert}<span className="text-sm font-bold text-gray-400">명</span></p>
        </button>
        <button onClick={() => setQuick(quick === 'month' ? 'all' : 'month')}
          className={`rounded-xl p-3 text-left border transition-colors ${quick === 'month' ? 'bg-blue-100 border-blue-300' : summary.month > 0 ? 'bg-blue-50 border-blue-100 hover:border-blue-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[11px] font-semibold text-blue-600">이번 달 갱신 기준일</p>
          <p className={`text-xl font-extrabold ${summary.month > 0 ? 'text-blue-700' : 'text-gray-300'}`}>{summary.month}<span className="text-sm font-bold text-gray-400">명</span></p>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="어르신 성함 검색"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200 w-40" />
        <select value={fee} onChange={e => setFee(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200">
          <option value="">전체 급여</option>
          <option value="시설">시설</option>
          <option value="재가">재가</option>
          <option value="등급외">등급외</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer ml-1">
          <input type="checkbox" checked={showDischarged} onChange={e => setShowDischarged(e.target.checked)} className="accent-teal-600" /> 퇴소 포함
        </label>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} / {rows.length}명 · 가나다순</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-gray-50/90">
                <th className={`${th} sticky left-0 z-20 bg-gray-50 text-left border-r border-gray-200 min-w-[110px]`}>어르신</th>
                <th className={th}>입소일</th>
                <th className={`${th} text-left`}>인정서 기간</th>
                <th className={th}>등급/급여</th>
                <th className={th}>기준일</th>
                <th className={`${th} text-left`}>계약서 일시</th>
                <th className={`${th} text-left`}>계획서 일시</th>
                <th className={`${th} text-left`}>결과평가 일시</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={`group hover:bg-teal-50/20 ${r.active === false ? 'opacity-50' : ''}`}>
                  <td className={`${td} sticky left-0 z-10 bg-white group-hover:bg-teal-50/40 border-r border-gray-100 whitespace-nowrap`}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] text-gray-300">{rankById.get(r.id)}</span>
                      <span className="text-sm font-bold text-gray-800">{r.name || '-'}</span>
                      {r.active === false && <span className="text-[9px] font-bold text-white bg-gray-400 px-1 py-0.5 rounded">퇴소</span>}
                    </div>
                  </td>
                  <td className={`${td} text-gray-500 text-center whitespace-nowrap`}>{fmtD(r.admission_date)}</td>
                  <td className={`${td} text-gray-500`}>
                    {r.certifications && r.certifications.length > 0 ? (() => {
                      const certs = r.certifications!
                      // 추가된(현재) 인정서 = 편집기의 '· 현재'(마지막 항목) — 항상 보이게, 나머지는 더보기
                      const cur = certs[certs.length - 1]
                      const others = certs.filter(c => c !== cur)
                      const st = certState(cur)
                      const badge = st.status === 'expired' ? { t: '만료 지남', c: 'bg-red-100 text-red-600' }
                        : st.status === 'renew' ? { t: `갱신대상 D-${Math.max(0, st.daysToEnd ?? 0)}`, c: 'bg-amber-100 text-amber-700' } : null
                      const key = `${r.id}|cert`, open = exp.has(key)
                      const line = (c: typeof cur) => `${gradeLabel(c)}${benefitLabel(c) ? ' · ' + benefitLabel(c) : ''}`
                      return (
                        <button onClick={() => toggleExp(key)} className="text-left">
                          {open ? (
                            <div className="space-y-0.5">
                              {[cur, ...others].map((c, i) => (
                                <div key={i} className={`whitespace-nowrap ${c === cur ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>
                                  <span className="text-teal-600">{line(c)}</span> {fmtD(c.start) || '?'}~{fmtD(c.end) || '진행'}
                                  {c === cur && <span className="text-[10px] text-primary-orange ml-1">· 현재</span>}
                                </div>
                              ))}
                              <span className="text-[10px] text-indigo-500">접기 ▴</span>
                            </div>
                          ) : (
                            <div className="whitespace-nowrap">
                              <span className="font-semibold text-gray-700"><span className="text-teal-600">{line(cur)}</span> {fmtD(cur.start) || '?'}~{fmtD(cur.end) || '진행'}</span>
                              {others.length > 0 && <span className="text-[10px] text-indigo-500 ml-1">외 {others.length}건 ▾</span>}
                            </div>
                          )}
                          {cur.end && <div className="text-[10px] text-gray-400 mt-0.5">갱신기준 {renewalDue(cur.end)}</div>}
                          {badge && <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.c}`}>{badge.t}</span>}
                        </button>
                      )
                    })() : <span className="text-gray-300">-</span>}
                  </td>
                  <td className={`${td} text-gray-600 text-center whitespace-pre-line`}>{r.grade || '-'}</td>
                  <td className={`${td} text-center whitespace-nowrap ${docInfo(r).renew ? 'bg-blue-50' : ''}`}>
                    {r.base_date ? (
                      <span className="text-gray-700 font-semibold">
                        {fmtMD(r.base_date)}
                        <span className="block text-[10px] text-gray-400 font-normal">(6개월 {plus6(r.base_date)})</span>
                        {docInfo(r).renew && <span className="inline-block text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full mt-0.5">이번 달</span>}
                      </span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className={`${td} text-gray-500`}><DocCell id={r.id} type="contract" items={r.contract_lines} admission={r.admission_date} /></td>
                  <td className={`${td} text-gray-500`}><DocCell id={r.id} type="plan" items={r.plan_lines} admission={r.admission_date} /></td>
                  <td className={`${td} text-gray-500`}><DocCell id={r.id} type="eval" items={r.eval_lines} admission={r.admission_date} /></td>
                  <td className={`${td} text-center`}>
                    <button onClick={() => setEditing(r)} className="text-[11px] text-gray-400 hover:text-teal-600 px-1.5 py-0.5 rounded hover:bg-teal-50">수정</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-sm text-gray-400">{rows.length === 0 ? '등록된 어르신이 없습니다.' : '조건에 맞는 어르신이 없습니다.'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">💡 계약서·계획서·평가 칸을 클릭하면 전체 이력이 펼쳐집니다. 기준일 옆 (6개월 …)은 반기 갱신 기준일입니다.</p>

      {(addOpen || editing) && (
        <DocFormModal editing={editing} residents={residents} docByResident={new Map(rows.filter(r => r.resident_id).map(r => [r.resident_id as string, r]))} onClose={() => { setAddOpen(false); setEditing(null) }} onSaved={() => { setAddOpen(false); setEditing(null); load() }} />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>{children}</div>
}

function DocFormModal({ editing, residents = [], docByResident = new Map<string, ResidentDoc>(), onClose, onSaved }: { editing: ResidentDoc | null; residents?: LtcResident[]; docByResident?: Map<string, ResidentDoc>; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing
  const [f, setF] = useState<DocInput>({
    resident_id: editing?.resident_id ?? null, name: editing?.name ?? '', admission_date: editing?.admission_date ?? '', floor: editing?.floor ?? '2층',
    certifications: editing?.certifications ? editing.certifications.map(c => ({ ...c, benefits: (c.benefits ?? []).map(b => ({ ...b })) })) : [],
    contract_lines: editing?.contract_lines ?? [], plan_lines: editing?.plan_lines ?? [], eval_lines: editing?.eval_lines ?? [],
    memo: editing?.memo ?? '', active: editing?.active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200'

  const submit = async () => {
    if (!f.name?.trim()) { setErr('어르신 성함을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      if (isEdit) await residentDocAPI.update(editing!.id, f); else await residentDocAPI.create(f)
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }
  const autoFill = () => {
    const a = autoDocEvents(f.certifications ?? [], f.admission_date)
    // 기존 일시는 모두 지우고 현재/추가된 인정서 기준으로 새로 생성
    setF(p => ({ ...p, contract_lines: a.contract, plan_lines: a.plan, eval_lines: a.eval }))
  }
  const del = async () => { if (!isEdit || !confirm('이 기록을 삭제할까요?')) return; setSaving(true); try { await residentDocAPI.remove(editing!.id); onSaved() } finally { setSaving(false) } }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900">{isEdit ? '어르신 서류 수정' : '어르신 추가'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {!isEdit && (() => {
            const actives = residents.filter(r => r.status === 'active')
            if (actives.length === 0) return null
            const picked = actives.find(x => x.id === f.resident_id)
            const pickedDoc = picked ? docByResident.get(picked.id) : undefined
            const certCount = pickedDoc?.certifications?.length ?? 0
            return (
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                <label className="text-xs font-semibold text-teal-700 mb-1 block">기존 수급자에서 불러오기</label>
                <select className={inp} value={f.resident_id ?? ''} onChange={e => {
                  const r = actives.find(x => x.id === e.target.value)
                  if (!r) { setF(p => ({ ...p, resident_id: null })); return }
                  const doc = docByResident.get(r.id)
                  const certs = doc?.certifications ? doc.certifications.map(c => ({ ...c, benefits: (c.benefits ?? []).map(b => ({ ...b })) })) : undefined
                  setF(p => ({
                    ...p, resident_id: r.id, name: r.name, admission_date: r.admissionDate,
                    base_date: doc?.base_date || r.careGradeStartDate,
                    ...(certs ? { certifications: certs } : {}),
                  }))
                }}>
                  <option value="">직접 입력</option>
                  {actives.map(r => {
                    const cnt = docByResident.get(r.id)?.certifications?.length ?? 0
                    return <option key={r.id} value={r.id}>{r.name} (입소 {r.admissionDate || '-'}){docByResident.has(r.id) ? ` · 등록됨${cnt ? ` (인정서 ${cnt}건)` : ''}` : ''}</option>
                  })}
                </select>
                {pickedDoc
                  ? <p className="text-[11px] text-amber-600 mt-1">⚠ 이미 서류가 등록된 수급자입니다{certCount ? ` — 인정서 갱신 이력 ${certCount}건을 함께 불러왔습니다` : ''}. 기존 기록 수정 권장.</p>
                  : <p className="text-[11px] text-teal-500 mt-1">선택하면 성함·입소일·인정서 이력이 자동으로 채워지고 수급자와 연동됩니다.</p>}
              </div>
            )
          })()}
          <div className="grid grid-cols-2 gap-2">
            <Field label="성함 *"><input value={f.name ?? ''} onChange={e => setF({ ...f, name: e.target.value })} className={inp} autoFocus /></Field>
            <Field label="입소일"><DateField value={f.admission_date} onChange={v => setF({ ...f, admission_date: v })} className={inp} /></Field>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">장기요양인정서 <span className="text-gray-400 font-normal">— 등급·유효기간(2/3/4년)·급여(재가↔시설). 종료 90일 전 갱신</span></label>
            <CertificationEditor value={f.certifications ?? []} onChange={cs => setF({ ...f, certifications: cs })} />
          </div>
          <button type="button" onClick={autoFill} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100">
            <RefreshCw className="w-3.5 h-3.5" /> 인정서 기준으로 일시 자동 생성 <span className="font-normal text-teal-500">(변화만 수동 추가)</span>
          </button>
          <Field label="계약서 일시"><DocEventsEditor type="contract" value={f.contract_lines} onChange={v => setF({ ...f, contract_lines: v })} defaultAddKind="변경" addLabel="+ 변경(변화) 추가" /></Field>
          <Field label="급여제공계획서 일시"><DocEventsEditor type="plan" value={f.plan_lines} onChange={v => setF({ ...f, plan_lines: v })} defaultAddKind="변화" addLabel="+ 변화 추가" /></Field>
          <Field label="결과평가 일시"><DocEventsEditor type="eval" value={f.eval_lines} onChange={v => setF({ ...f, eval_lines: v })} defaultAddKind="변화" addLabel="+ 변화 추가" /></Field>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">상태</span>
            <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
              {([['재실', true], ['퇴소', false]] as const).map(([t, v]) => (
                <button key={t} type="button" onClick={() => setF({ ...f, active: v })} className={`px-3 py-1 rounded-md text-xs font-semibold ${!!f.active === v ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-400'}`}>{t}</button>
              ))}
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {isEdit && <button onClick={del} disabled={saving} className="mr-auto px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />삭제</button>}
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
