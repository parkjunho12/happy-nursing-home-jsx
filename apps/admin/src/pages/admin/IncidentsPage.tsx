import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, Loader2, Sparkles, Phone, X, Pencil, Trash2 } from 'lucide-react'
import { incidentAPI, INCIDENT_TYPES, SEVERITIES, type Incident, type IncidentInput, type HandoverCandidate, type IncidentType } from '@/api/incidentClient'
import { useLtcStore } from '@/store/ltc'

/**
 * 낙상·사고 보고서 — 인수인계 메모로 흩어지던 사고를 정식 기록으로.
 *
 * 데이터 관점의 목적 두 가지:
 * ① 재발 파악 — 같은 어르신에게 사고가 반복되면 눈에 띄어야 한다 (상단 요약)
 * ② 분쟁 예방 — 보호자에게 언제·어떻게 알렸는지가 사고와 한 건에 묶여야 한다
 */
const TYPE_CLS: Record<string, string> = {
  낙상: 'bg-red-50 text-red-600 border-red-200',
  '상처·욕창': 'bg-orange-50 text-orange-700 border-orange-200',
  투약: 'bg-violet-50 text-violet-700 border-violet-200',
  발열: 'bg-amber-50 text-amber-700 border-amber-200',
  식사: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  행동: 'bg-sky-50 text-sky-700 border-sky-200',
  기타: 'bg-gray-50 text-gray-600 border-gray-200',
}
const SEV_CLS: Record<string, string> = {
  경미: 'text-gray-500', 중등: 'text-amber-600 font-bold', 심각: 'text-red-600 font-extrabold',
}

const fmtD = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${w})`
}

const EMPTY: IncidentInput = { type: '낙상', occurred_date: '', severity: '경미', guardian_notified: false, status: 'open' }

export default function IncidentsPage() {
  const { residents, loaded, loadAll } = useLtcStore()
  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  const year = new Date().getFullYear()
  const [rows, setRows] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id?: string; form: IncidentInput } | null>(null)
  const [candOpen, setCandOpen] = useState(false)
  const [cands, setCands] = useState<HandoverCandidate[] | null>(null)

  const load = () => {
    setLoading(true)
    incidentAPI.list(year).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openCandidates = async () => {
    setCandOpen(true); setCands(null)
    try { setCands(await incidentAPI.candidates(7)) } catch { setCands([]) }
  }

  // ── 상단 요약: 이번 달 건수·유형, 반복 사고 어르신(연간 2건 이상) ──
  const stats = useMemo(() => {
    const ym = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const month = rows.filter(r => r.occurred_date.startsWith(ym))
    const byType: Record<string, number> = {}
    month.forEach(r => { byType[r.type] = (byType[r.type] ?? 0) + 1 })
    const byResident: Record<string, number> = {}
    rows.forEach(r => { if (r.resident_name) byResident[r.resident_name] = (byResident[r.resident_name] ?? 0) + 1 })
    const repeat = Object.entries(byResident).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const unnotified = rows.filter(r => !r.guardian_notified && r.status === 'open').length
    return { monthTotal: month.length, byType, repeat, unnotified }
  }, [rows, year])

  const save = async () => {
    if (!editing) return
    const f = editing.form
    if (!f.occurred_date) { alert('발생일을 입력해주세요.'); return }
    try {
      if (editing.id) await incidentAPI.update(editing.id, f)
      else await incidentAPI.create(f)
      setEditing(null); load()
    } catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '저장 실패') }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl'

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <AlertTriangle size={20} className="text-red-500" />
        <h1 className="text-xl font-bold text-gray-900">낙상·사고 보고서</h1>
        <div className="ml-auto flex gap-1.5">
          <button onClick={openCandidates}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100">
            <Sparkles size={14} /> 인수인계에서 가져오기
          </button>
          <button onClick={() => setEditing({ form: { ...EMPTY, occurred_date: new Date().toISOString().slice(0, 10) } })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
            <Plus size={14} /> 보고서 작성
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">사고와 보호자 안내 이력을 한 건에 묶어 남깁니다 — 평가·분쟁 대비 기록</p>

      {/* 요약 스트립 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-2xl bg-white border border-gray-100 p-3">
          <p className="text-[11px] text-gray-400">이번 달 사고</p>
          <p className="text-xl font-extrabold text-gray-800">{stats.monthTotal}<span className="text-xs font-bold text-gray-400">건</span></p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 p-3">
          <p className="text-[11px] text-gray-400">이번 달 유형</p>
          <p className="text-xs font-semibold text-gray-600 mt-1 leading-relaxed">
            {Object.entries(stats.byType).map(([t, n]) => `${t} ${n}`).join(' · ') || '없음'}
          </p>
        </div>
        <div className={`rounded-2xl border p-3 ${stats.repeat.length ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[11px] text-gray-400">올해 2건 이상 (재발 주의)</p>
          <p className="text-xs font-bold text-amber-700 mt-1 leading-relaxed">
            {stats.repeat.map(([n, c]) => `${n} ${c}건`).join(' · ') || '없음'}
          </p>
        </div>
        <div className={`rounded-2xl border p-3 ${stats.unnotified ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className="text-[11px] text-gray-400">보호자 미안내 (진행 중)</p>
          <p className={`text-xl font-extrabold ${stats.unnotified ? 'text-red-600' : 'text-gray-800'}`}>{stats.unnotified}<span className="text-xs font-bold text-gray-400">건</span></p>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm">올해 등록된 사고 보고서가 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-800">{fmtD(r.occurred_date)}{r.occurred_time ? ` ${r.occurred_time}` : ''}</span>
                <span className="text-sm font-bold text-gray-700">{r.resident_name ?? '-'}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_CLS[r.type]}`}>{r.type}</span>
                <span className={`text-xs ${SEV_CLS[r.severity] ?? ''}`}>{r.severity}</span>
                {r.source === 'handover' && <span className="text-[10px] font-bold text-violet-500 bg-violet-50 border border-violet-100 rounded px-1.5 py-0.5">인수인계</span>}
                {r.guardian_notified
                  ? <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-0.5"><Phone size={10} /> 보호자 안내됨</span>
                  : <span className="text-[10px] font-extrabold text-red-500 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">보호자 미안내</span>}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${r.status === 'open' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {r.status === 'open' ? '관찰 중' : '종결'}
                </span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setEditing({ id: r.id, form: { ...r } })} className="p-1.5 text-gray-300 hover:text-gray-600"><Pencil size={14} /></button>
                  <button onClick={async () => { if (confirm('이 보고서를 삭제할까요?')) { try { await incidentAPI.remove(r.id); load() } catch (e: any) { alert(e?.response?.data?.detail ?? '삭제 권한이 없습니다.') } } }}
                    className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
              {r.description && <p className="text-xs text-gray-600 mt-1.5">{r.description}</p>}
              {r.action && <p className="text-xs text-gray-500 mt-1"><b className="text-gray-400">즉시 조치</b> · {r.action}</p>}
              {r.guardian_notified && (
                <p className="text-xs text-emerald-700 mt-1">
                  <b className="text-emerald-500">보호자 안내</b> · {r.guardian_method ?? ''}
                  {r.guardian_notified_at ? ` · ${new Date(r.guardian_notified_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                  {r.guardian_note ? ` — ${r.guardian_note}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 인수인계 후보 */}
      {candOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setCandOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={15} className="text-violet-500" />
              <h2 className="text-sm font-bold text-gray-800">인수인계 AI가 잡은 사고 후보 (최근 7일)</h2>
              <button onClick={() => setCandOpen(false)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <p className="text-xs text-gray-400 mb-3">누르면 내용이 채워진 보고서가 열립니다. 이미 등록한 항목은 안 보여요.</p>
            {cands === null ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={16} /></div>
            ) : cands.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">새로 등록할 후보가 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {cands.map(c => (
                  <li key={c.handover_ref}>
                    <button onClick={() => {
                      setCandOpen(false)
                      setEditing({ form: { ...EMPTY, type: c.suggested_type as IncidentType, occurred_date: c.date ?? new Date().toISOString().slice(0, 10), occurred_time: c.time?.slice(0, 5) || undefined, resident_id: c.resident_id ?? undefined, resident_name: c.resident_name ?? undefined, description: c.note, handover_ref: c.handover_ref } })
                    }} className="w-full text-left rounded-xl border border-violet-100 bg-violet-50/40 hover:bg-violet-50 p-2.5">
                      <span className="text-xs font-bold text-gray-700">{c.date} {c.time} · {c.resident_name ?? '?'}</span>
                      <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_CLS[c.suggested_type]}`}>{c.suggested_type}</span>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.note}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 작성·수정 모달 */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-4 space-y-2.5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">{editing.id ? '보고서 수정' : '사고 보고서 작성'}</h2>
              <button onClick={() => setEditing(null)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={editing.form.resident_id ?? ''} className={inp}
                onChange={e => {
                  const res = residents.find(x => x.id === e.target.value)
                  setEditing(p => p && { ...p, form: { ...p.form, resident_id: e.target.value || undefined, resident_name: res?.name ?? p.form.resident_name } })
                }}>
                <option value="">어르신 선택</option>
                {residents.filter(r => r.status === 'active').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select value={editing.form.type} className={inp}
                onChange={e => setEditing(p => p && { ...p, form: { ...p.form, type: e.target.value as IncidentType } })}>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="date" value={editing.form.occurred_date} className={inp}
                onChange={e => setEditing(p => p && { ...p, form: { ...p.form, occurred_date: e.target.value } })} />
              <input type="time" value={editing.form.occurred_time ?? ''} className={inp}
                onChange={e => setEditing(p => p && { ...p, form: { ...p.form, occurred_time: e.target.value || undefined } })} />
              <select value={editing.form.severity ?? '경미'} className={inp}
                onChange={e => setEditing(p => p && { ...p, form: { ...p.form, severity: e.target.value } })}>
                {SEVERITIES.map(sv => <option key={sv} value={sv}>{sv}</option>)}
              </select>
            </div>
            <input value={editing.form.location ?? ''} placeholder="장소 (예: 207호, 복도)" className={inp}
              onChange={e => setEditing(p => p && { ...p, form: { ...p.form, location: e.target.value } })} />
            <textarea value={editing.form.description ?? ''} placeholder="무슨 일이 있었나" rows={3} className={inp}
              onChange={e => setEditing(p => p && { ...p, form: { ...p.form, description: e.target.value } })} />
            <textarea value={editing.form.action ?? ''} placeholder="즉시 조치 (활력징후 확인, 병원 이송 등)" rows={2} className={inp}
              onChange={e => setEditing(p => p && { ...p, form: { ...p.form, action: e.target.value } })} />
            <textarea value={editing.form.follow_up ?? ''} placeholder="후속 조치·경과 (선택)" rows={2} className={inp}
              onChange={e => setEditing(p => p && { ...p, form: { ...p.form, follow_up: e.target.value } })} />

            {/* 보호자 안내 — 분쟁 예방의 핵심이라 눈에 띄게 */}
            <div className={`rounded-xl border p-3 ${editing.form.guardian_notified ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/40'}`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!editing.form.guardian_notified} className="w-4 h-4 accent-emerald-600"
                  onChange={e => setEditing(p => p && { ...p, form: { ...p.form, guardian_notified: e.target.checked } })} />
                <span className="text-sm font-bold text-gray-700">보호자에게 안내했습니다</span>
                {!editing.form.guardian_notified && <span className="text-[10px] font-bold text-red-500">미안내 상태로 저장됩니다</span>}
              </label>
              {editing.form.guardian_notified && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <select value={editing.form.guardian_method ?? '전화'} className={inp}
                    onChange={e => setEditing(p => p && { ...p, form: { ...p.form, guardian_method: e.target.value } })}>
                    {['전화', '문자', '면회', '기타'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input value={editing.form.guardian_note ?? ''} placeholder="안내 내용·보호자 반응" className={`${inp} col-span-2`}
                    onChange={e => setEditing(p => p && { ...p, form: { ...p.form, guardian_note: e.target.value } })} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select value={editing.form.status ?? 'open'} className={`${inp} w-32`}
                onChange={e => setEditing(p => p && { ...p, form: { ...p.form, status: e.target.value as 'open' | 'closed' } })}>
                <option value="open">관찰 중</option>
                <option value="closed">종결</option>
              </select>
              <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
