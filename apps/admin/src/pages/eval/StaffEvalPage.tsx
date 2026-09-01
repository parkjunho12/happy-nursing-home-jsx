import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Check, Trash2, ShieldAlert, Search, Settings2 } from 'lucide-react'
import { staffEvalAPI, type EvalPage, type EvalRow } from '@/api/staffEvalClient'
import { currentPeriod, periodLabel, shiftPeriod } from '@/utils/evalPeriod'
import StaffEvalSettings from '@/components/eval/StaffEvalSettings'

/**
 * 직원 평가(인사고과) — 관리자만.
 *
 * 반기마다 한 번, 공통 6항목을 5점으로 매기고 총평을 적는다.
 *
 * 한 화면에서 다 끝나게 만든다. 사람을 골라 들어갔다 나오기를 21번 반복하면
 * 아무도 끝까지 못 한다. 왼쪽에서 사람을 고르고 오른쪽에서 바로 매긴다.
 *
 * 저장은 사람이 누를 때만 한다. 인사 기록이라, 라디오를 잘못 눌렀다가
 * 그대로 남는 일이 없어야 한다.
 */
export default function StaffEvalPage() {
  const [period, setPeriod] = useState(currentPeriod())
  const [data, setData] = useState<EvalPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [pick, setPick] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 편집 중인 값 — 저장 전까지 화면에만 있다
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    staffEvalAPI.list(period)
      .then(d => {
        setData(d)
        setPick(p => (p && d.rows.some(r => r.staff_id === p)) ? p : (d.rows[0]?.staff_id ?? null))
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }
  useEffect(load, [period])

  const row: EvalRow | undefined = useMemo(
    () => data?.rows.find(r => r.staff_id === pick), [data, pick])

  // 사람이나 기간이 바뀌면 저장된 값으로 되돌린다
  useEffect(() => {
    setScores(row?.evaluation?.scores ?? {})
    setComment(row?.evaluation?.comment ?? '')
    setSavedAt(null)
  }, [pick, period, data])

  // 이미 매긴 평가가 있으면 그때의 항목·배점으로 그린다. 설정이 바뀌었다고
  // 지난 평가를 새 항목으로 다시 그리면, 매기지 않은 항목이 생기고 점수가
  // 사라진 것처럼 보인다. 새로 저장할 때 새 잣대로 넘어간다.
  const ev = row?.evaluation
  const items = ev?.items ?? data?.items ?? []
  const max = ev?.max_score ?? data?.max_score ?? 5
  const full = ev?.full_marks ?? data?.full_marks ?? 30
  // 설정이 바뀐 뒤 지난 평가를 열면 알려준다 — 저장하면 새 항목으로 바뀐다
  const staleForm = !!ev && !!data &&
    (ev.max_score !== data.max_score ||
     JSON.stringify(ev.items.map(i => i.key)) !== JSON.stringify(data.items.map(i => i.key)))
  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  const filled = Object.keys(scores).length
  const done = filled === items.length && items.length > 0

  const dirty = useMemo(() => {
    const s0 = row?.evaluation?.scores ?? {}
    const c0 = row?.evaluation?.comment ?? ''
    return JSON.stringify(s0) !== JSON.stringify(scores) || c0 !== comment
  }, [row, scores, comment])

  const save = async () => {
    if (!pick) return
    setSaving(true)
    try {
      await staffEvalAPI.save(pick, period, { scores, comment })
      setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '저장하지 못했습니다')
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!pick || !row?.evaluation) return
    if (!confirm(`${row.name} 님의 ${periodLabel(period)} 평가를 지울까요?`)) return
    try { await staffEvalAPI.remove(pick, period); load() }
    catch { alert('지우지 못했습니다') }
  }

  const shown = useMemo(() => {
    const k = q.trim()
    if (!k) return data?.rows ?? []
    return (data?.rows ?? []).filter(r =>
      r.name.includes(k) || (r.position ?? '').includes(k))
  }, [data, q])

  const 매긴사람 = (data?.rows ?? []).filter(r => r.evaluation && r.evaluation.filled === r.evaluation.item_count).length

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">직원 평가</h1>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
          <ShieldAlert size={12} /> 관리자 전용
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        인사 기록입니다. 본인과 동료에게는 보이지 않습니다.
      </p>

      {/* 기간 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
          <button onClick={() => setPeriod(p => shiftPeriod(p, -1))}
            className="px-2 py-2 hover:bg-gray-50" aria-label="이전 반기">
            <ChevronLeft className="w-4 h-4 text-gray-500" /></button>
          <span className="px-3 text-sm font-bold text-gray-800">{periodLabel(period)}</span>
          <button onClick={() => setPeriod(p => shiftPeriod(p, 1))}
            className="px-2 py-2 hover:bg-gray-50" aria-label="다음 반기">
            <ChevronRight className="w-4 h-4 text-gray-500" /></button>
        </div>
        {!loading && data && (
          <span className="text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            {매긴사람} / {data.rows.length}명 완료
          </span>
        )}
        <button onClick={() => setSettingsOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <Settings2 size={14} /> 항목·배점 설정
        </button>
      </div>

      {settingsOpen && (
        <StaffEvalSettings onClose={() => setSettingsOpen(false)} onSaved={load} />
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : !data ? (
        <p className="text-sm text-gray-400 py-20 text-center">불러오지 못했습니다.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {/* 왼쪽 — 사람 목록 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름·직종"
                  className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>
            <div className="max-h-[62vh] overflow-auto">
              {shown.map(r => {
                const ev = r.evaluation
                const ok = ev && ev.filled === ev.item_count
                return (
                  <button key={r.staff_id} onClick={() => setPick(r.staff_id)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-50 flex items-center gap-2 transition-colors ${
                      pick === r.staff_id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-800 truncate">{r.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{r.position || '-'}</p>
                    </div>
                    {/* 다 매긴 사람만 점수를 보여준다. 반쯤 매긴 합계는 오해를 부른다 */}
                    {ok ? (
                      <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        {ev!.total}
                      </span>
                    ) : ev ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">쓰는 중</span>
                    ) : (
                      <span className="text-[10px] text-gray-300">-</span>
                    )}
                  </button>
                )
              })}
              {shown.length === 0 && <p className="text-xs text-gray-400 text-center py-8">해당하는 직원이 없습니다.</p>}
            </div>
          </div>

          {/* 오른쪽 — 평가표 */}
          {!row ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
              왼쪽에서 직원을 골라주세요.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-baseline gap-2 mb-4 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{row.name}</h2>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  {row.position || '직종 미지정'}
                </span>
                <span className="text-[11px] text-gray-400">입사 {row.hire_date || '-'}</span>
                <span className="text-[11px] text-gray-400 ml-auto">{periodLabel(period)}</span>
              </div>

              {staleForm && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                  이 평가는 <b>예전 항목·배점</b>으로 매긴 것입니다. 그대로 보여드립니다 —
                  저장하면 지금 설정({data!.items.length}항목 · {data!.max_score}점 만점)으로 바뀝니다.
                </p>
              )}

              <div className="space-y-1">
                {items.map(it => (
                  <div key={it.key} className="flex items-center gap-3 py-2 border-b border-gray-50">
                    <p className="text-[13px] text-gray-700 flex-1 min-w-0">{it.label}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
                        <button key={n} type="button"
                          onClick={() => setScores(s => ({ ...s, [it.key]: n }))}
                          aria-label={`${it.label} ${n}점`}
                          className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                            scores[it.key] === n
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-indigo-300'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-gray-500">합계</span>
                <span className={`text-xl font-extrabold ${done ? 'text-gray-900' : 'text-gray-300'}`}>
                  {total}
                </span>
                <span className="text-xs text-gray-400">/ {full}</span>
                {/* 다 안 매겼으면 합계를 믿지 말라고 적어 둔다 */}
                {!done && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    {items.length - filled}항목 남음
                  </span>
                )}
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">총평</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                  placeholder="점수로 담기지 않는 것을 적어주세요."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>

              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <button onClick={save} disabled={saving || !dirty}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  저장
                </button>
                {dirty && <span className="text-[11px] text-amber-600 font-semibold">저장하지 않은 변경이 있습니다</span>}
                {!dirty && savedAt && <span className="text-[11px] text-emerald-600 font-semibold">{savedAt} 저장됨</span>}
                {row.evaluation?.evaluator_name && !dirty && (
                  <span className="text-[11px] text-gray-400">평가자 {row.evaluation.evaluator_name}</span>
                )}
                {row.evaluation && (
                  <button onClick={remove}
                    className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-gray-400 text-xs hover:text-red-600 hover:border-red-200">
                    <Trash2 size={13} /> 평가 지우기
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
