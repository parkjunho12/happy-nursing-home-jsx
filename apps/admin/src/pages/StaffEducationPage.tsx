import { useEffect, useMemo, useState } from 'react'
import {
  GraduationCap, Check, Loader2, Plus, Pencil, Trash2, X, Download,
  AlertTriangle, Camera, ChevronDown, ChevronRight, Filter,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useIsMobile } from '@/hooks/useMediaQuery'
import DateField from '@/components/ui/DateField'
import {
  educationAPI, DIVISION_STYLE, ORG_STYLE,
  type Education, type EduSummary, type Division,
} from '@/api/educationClient'

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const DIVISIONS: Division[] = ['평가', '법정', '기타']

const fmt = (iso?: string | null) => {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${+m}.${+d}`
}

/** 등록·수정 권한: ADMIN · 사회복지사 · 시설장 (백엔드와 동일 규칙) */
const canWrite = (u: { role?: string | null; position?: string | null } | null) =>
  u?.role === 'ADMIN' || u?.position === '사회복지사' || u?.position === '시설장'

export default function StaffEducationPage() {
  const user = useAuthStore(s => s.user)
  const isMobile = useIsMobile()
  const writable = canWrite(user)

  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<Education[]>([])
  const [sum, setSum] = useState<EduSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<Education | null | undefined>(undefined)
  const [err, setErr] = useState('')

  // 필터
  const [div, setDiv] = useState<Division | 'all'>('all')
  const [onlyTodo, setOnlyTodo] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

  const load = async (y = year) => {
    setLoading(true); setErr('')
    try {
      const [list, s] = await Promise.all([educationAPI.list(y), educationAPI.summary(y)])
      setRows(list); setSum(s)
    } catch (e: any) { setErr(e?.message ?? '불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load(year) }, [year])

  // 완료 토글 — 서버 응답을 진실로 삼는다
  const toggle = async (e: Education) => {
    setBusy(e.id); setErr('')
    try {
      const saved = await educationAPI.update(e.id, { done: !e.done })
      setRows(prev => prev.map(r => r.id === e.id ? saved : r))
      educationAPI.summary(year).then(setSum).catch(() => {})
    } catch (x: any) { setErr(x?.message ?? '저장 실패') }
    finally { setBusy(null) }
  }

  const seed = async () => {
    if (!confirm(`${year}년 연간 교육계획을 불러올까요?\n이미 등록된 교육은 그대로 두고, 빠진 것만 추가합니다.`)) return
    setBusy('seed')
    try {
      const r: any = await educationAPI.seed(year)
      alert(r?.message ?? '완료')
      await load(year)
    } catch (e: any) { setErr(e?.message ?? '계획 불러오기 실패') }
    finally { setBusy(null) }
  }

  const filtered = useMemo(() => rows.filter(r =>
    (div === 'all' || r.division === div) && (!onlyTodo || !r.done)
  ), [rows, div, onlyTodo])

  const byMonth = useMemo(() => {
    const m = new Map<number, Education[]>()
    filtered.forEach(r => { m.set(r.month, [...(m.get(r.month) ?? []), r]) })
    return MONTHS.filter(mm => m.has(mm)).map(mm => ({ month: mm, items: m.get(mm)! }))
  }, [filtered])

  const thisMonth = new Date().getMonth() + 1

  return (
    <div className="space-y-4 md:space-y-5">
      {/* ── 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="text-primary-orange shrink-0" size={24} />
            직원 의무교육
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            법정의무교육 · 평가지표 교육 연간 계획과 실시 기록
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="px-3 py-2 text-sm font-semibold border border-gray-200 rounded-xl bg-white">
            {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).sort().map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          {writable && (
            <>
              <button onClick={seed} disabled={busy === 'seed'}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {busy === 'seed' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span className="hidden md:inline">계획 불러오기</span>
              </button>
              <button onClick={() => setEditing(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl bg-primary-orange text-white hover:brightness-95">
                <Plus size={15} /> 교육 추가
              </button>
            </>
          )}
        </div>
      </div>

      {err && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{err}</p>
      )}

      {/* ── 진행률 요약 */}
      {sum && sum.total > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5">
          <div className="flex items-end justify-between mb-2.5">
            <div>
              <p className="text-xs text-gray-400 font-medium">{year}년 이수 현황</p>
              <p className="text-2xl font-extrabold text-gray-900 leading-tight">
                {sum.done}<span className="text-base font-bold text-gray-400"> / {sum.total}건</span>
              </p>
            </div>
            <span className={`text-2xl font-extrabold ${sum.rate === 100 ? 'text-green-600' : 'text-primary-orange'}`}>
              {sum.rate}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-2.5 rounded-full transition-all ${sum.rate === 100 ? 'bg-green-500' : 'bg-primary-orange'}`}
              style={{ width: `${sum.rate}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {DIVISIONS.map(d => {
              const v = sum.by_division?.[d]
              if (!v || v.total === 0) return null
              const rate = Math.round(v.done / v.total * 100)
              return (
                <button key={d} onClick={() => setDiv(div === d ? 'all' : d)}
                  className={`rounded-xl border px-2.5 py-2 text-left transition-all ${DIVISION_STYLE[d].cls} ${div === d ? 'ring-2 ring-offset-1 ring-gray-300' : 'opacity-90 hover:opacity-100'}`}>
                  <p className="text-[10px] font-bold opacity-70">{DIVISION_STYLE[d].label}</p>
                  <p className="text-sm font-extrabold">{v.done}/{v.total}<span className="text-[10px] font-bold opacity-60 ml-1">{rate}%</span></p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 필터 */}
      {rows.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={13} className="text-gray-400" />
          <button onClick={() => setDiv('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${div === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}>
            전체 {rows.length}
          </button>
          {DIVISIONS.map(d => {
            const n = rows.filter(r => r.division === d).length
            if (!n) return null
            return (
              <button key={d} onClick={() => setDiv(d)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${div === d ? DIVISION_STYLE[d].cls + ' ring-1 ring-gray-300' : 'bg-white text-gray-500 border-gray-200'}`}>
                {DIVISION_STYLE[d].label} {n}
              </button>
            )
          })}
          <button onClick={() => setOnlyTodo(v => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ml-auto ${onlyTodo ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-500 border-gray-200'}`}>
            미실시만
          </button>
        </div>
      )}

      {/* ── 본문 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <GraduationCap size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-600">{year}년 교육 계획이 없습니다</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">연간 계획표를 불러와 시작하세요.</p>
          {writable && (
            <button onClick={seed} disabled={busy === 'seed'}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-xl bg-primary-orange text-white disabled:opacity-50">
              {busy === 'seed' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {year}년 계획 불러오기
            </button>
          )}
        </div>
      ) : byMonth.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">조건에 맞는 교육이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {byMonth.map(({ month, items }) => {
            const done = items.filter(i => i.done).length
            const all = done === items.length
            const isNow = month === thisMonth
            const open = !collapsed[month]
            return (
              <section key={month}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isNow ? 'border-primary-orange/40 ring-1 ring-primary-orange/20' : 'border-gray-100'}`}>
                <button onClick={() => setCollapsed(c => ({ ...c, [month]: open }))}
                  className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  {open ? <ChevronDown size={15} className="text-gray-300 shrink-0" /> : <ChevronRight size={15} className="text-gray-300 shrink-0" />}
                  <h2 className="text-sm font-extrabold text-gray-900">{month}월</h2>
                  {isNow && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-orange text-white">이번 달</span>}
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${all ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {done}/{items.length}
                  </span>
                </button>

                {open && (
                  <div className="divide-y divide-gray-50 border-t border-gray-50">
                    {items.map(e => (
                      <EduRow key={e.id} e={e} isMobile={isMobile} writable={writable}
                        busy={busy === e.id}
                        onToggle={() => toggle(e)}
                        onEdit={() => setEditing(e)} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {editing !== undefined && (
        <EduModal
          edu={editing} year={year}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load(year) }}
        />
      )}
    </div>
  )
}

/* ── 교육 1건 행 ───────────────────────────────────────────────── */
function EduRow({ e, isMobile, writable, busy, onToggle, onEdit }: {
  e: Education; isMobile: boolean; writable: boolean; busy: boolean
  onToggle: () => void; onEdit: () => void
}) {
  const ds = DIVISION_STYLE[e.division] ?? DIVISION_STYLE.기타
  return (
    <div className={`flex items-start gap-2.5 px-3 md:px-4 py-3 transition-colors ${e.done ? 'bg-green-50/30' : 'hover:bg-orange-50/20'}`}>
      {/* 완료 토글 — 터치 44px */}
      <button onClick={onToggle} disabled={busy || !writable}
        aria-label={e.done ? '실시 취소' : '실시 완료'}
        title={writable ? (e.done ? '실시 취소' : '실시 완료로 표시') : '기록 권한이 없습니다'}
        className="w-11 h-11 md:w-9 md:h-9 -ml-1 md:ml-0 shrink-0 flex items-center justify-center rounded-xl disabled:cursor-default">
        <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
          e.done ? 'bg-green-500 border-green-500 text-white'
            : writable ? 'border-gray-300 hover:border-primary-orange' : 'border-gray-200'}`}>
          {busy ? <Loader2 size={12} className="animate-spin text-gray-400" />
            : e.done ? <Check size={14} strokeWidth={3} /> : null}
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${ds.cls}`}>
            {e.eval_no || ds.label}
          </span>
          {e.org && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${ORG_STYLE(e.org)}`}>
              {e.org}
            </span>
          )}
          {e.done && e.done_date && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 shrink-0">
              {fmt(e.done_date)} 실시
            </span>
          )}
          {!e.done && e.plan_date && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 shrink-0">
              {fmt(e.plan_date)} 예정
            </span>
          )}
        </div>

        <p className={`text-sm font-semibold mt-1 ${e.done ? 'text-gray-500' : 'text-gray-900'}`}>
          {e.title}
        </p>
        {e.topic && <p className="text-[11px] text-gray-400 mt-0.5">{e.topic}</p>}

        {/* 필수 기록사항 — 놓치면 평가에서 감점되는 부분이라 눈에 띄게 */}
        {e.requirement && !e.done && (
          <p className="mt-1.5 inline-flex items-start gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
            <Camera size={11} className="mt-0.5 shrink-0" />
            {e.requirement}
          </p>
        )}
        {e.done && (e.attendee_count || e.instructor || e.material) && (
          <p className="text-[11px] text-gray-400 mt-1">
            {[e.instructor && `교육자 ${e.instructor}`,
              e.attendee_count && `참석 ${e.attendee_count}명`,
              e.material].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {writable && (
        <button onClick={onEdit} aria-label="기록 수정"
          className="w-11 h-11 md:w-8 md:h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100">
          <Pencil size={isMobile ? 15 : 13} />
        </button>
      )}
    </div>
  )
}

/* ── 등록·기록 모달 ────────────────────────────────────────────── */
function EduModal({ edu, year, onClose, onSaved }: {
  edu: Education | null; year: number; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!edu
  const [f, setF] = useState({
    month: edu?.month ?? new Date().getMonth() + 1,
    division: (edu?.division ?? '평가') as Division,
    eval_no: edu?.eval_no ?? '',
    topic: edu?.topic ?? '',
    title: edu?.title ?? '',
    org: edu?.org ?? '자체-복지',
    requirement: edu?.requirement ?? '',
    plan_date: edu?.plan_date ?? '',
    done: edu?.done ?? false,
    done_date: edu?.done_date ?? '',
    instructor: edu?.instructor ?? '',
    attendee_count: edu?.attendee_count?.toString() ?? '',
    attendees: edu?.attendees ?? '',
    material: edu?.material ?? '',
    memo: edu?.memo ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }))

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange/40'
  const lbl = 'text-xs font-semibold text-gray-500 mb-1 block'

  const save = async () => {
    if (!f.title.trim()) { setErr('교육명을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const body = {
        year, month: f.month, division: f.division,
        eval_no: f.eval_no || null, topic: f.topic || null,
        title: f.title.trim(), org: f.org || null, requirement: f.requirement || null,
        plan_date: f.plan_date || null,
        done: f.done, done_date: f.done_date || null,
        instructor: f.instructor || null,
        attendee_count: f.attendee_count ? Number(f.attendee_count) : null,
        attendees: f.attendees || null, material: f.material || null, memo: f.memo || null,
      }
      if (isEdit) await educationAPI.update(edu!.id, body)
      else await educationAPI.create(body)
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') }
    finally { setSaving(false) }
  }

  const del = async () => {
    if (!edu || !confirm('이 교육을 계획에서 삭제할까요? 실시 기록도 함께 지워집니다.')) return
    setSaving(true)
    try { await educationAPI.remove(edu.id); onSaved() }
    catch (e: any) { setErr(e?.message ?? '삭제 실패'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 md:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[92vh] md:max-h-[88vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-gray-900">{isEdit ? '교육 기록' : '교육 추가'}</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          {/* 계획 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>월</label>
              <select value={f.month} onChange={e => set('month', +e.target.value)} className={inp}>
                {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>구분</label>
              <select value={f.division} onChange={e => set('division', e.target.value)} className={inp}>
                {DIVISIONS.map(d => <option key={d} value={d}>{DIVISION_STYLE[d].label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>평가지표 번호</label>
              <input value={f.eval_no} onChange={e => set('eval_no', e.target.value)} className={inp} placeholder="예: 평가19번" />
            </div>
            <div>
              <label className={lbl}>교육기관</label>
              <input value={f.org} onChange={e => set('org', e.target.value)} className={inp} placeholder="자체-복지 / GSEEK" />
            </div>
          </div>

          <div>
            <label className={lbl}>교육명 *</label>
            <input value={f.title} onChange={e => set('title', e.target.value)} className={inp} autoFocus
              placeholder="예: 노인인권 및 학대예방교육" />
          </div>
          <div>
            <label className={lbl}>분류</label>
            <input value={f.topic} onChange={e => set('topic', e.target.value)} className={inp} placeholder="예: 노인인권보호지침" />
          </div>
          <div>
            <label className={lbl}>필수 기록사항</label>
            <input value={f.requirement} onChange={e => set('requirement', e.target.value)} className={inp}
              placeholder="예: 모든 직원 사진 + 서명 / 교육일자 필수" />
          </div>
          <div>
            <label className={lbl}>예정일 <span className="font-normal text-gray-400">(일정 캘린더에 표시됩니다)</span></label>
            <DateField value={f.plan_date} onChange={v => set('plan_date', v)} />
          </div>

          {/* 실시 기록 */}
          <div className="pt-3 border-t border-gray-100">
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 bg-gray-50/70 cursor-pointer">
              <input type="checkbox" checked={f.done}
                onChange={e => {
                  const v = e.target.checked
                  set('done', v)
                  if (v && !f.done_date) set('done_date', new Date().toISOString().slice(0, 10))
                }}
                className="accent-green-500 w-4 h-4" />
              <span className="text-sm font-bold text-gray-700">실시 완료</span>
            </label>
          </div>

          {f.done && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>실시일 *</label>
                  <DateField value={f.done_date} onChange={v => set('done_date', v)} />
                </div>
                <div>
                  <label className={lbl}>참석 인원</label>
                  <input type="number" value={f.attendee_count} onChange={e => set('attendee_count', e.target.value)}
                    className={inp} placeholder="명" />
                </div>
              </div>
              <div>
                <label className={lbl}>교육자</label>
                <input value={f.instructor} onChange={e => set('instructor', e.target.value)} className={inp} placeholder="예: 사회복지사 김○○" />
              </div>
              <div>
                <label className={lbl}>참석자 명단</label>
                <textarea rows={2} value={f.attendees} onChange={e => set('attendees', e.target.value)}
                  className={`${inp} resize-none`} placeholder="참석자 이름을 쉼표로 구분해 입력" />
              </div>
              <div>
                <label className={lbl}>교육자료 · 사진 보관 위치</label>
                <input value={f.material} onChange={e => set('material', e.target.value)} className={inp}
                  placeholder="예: 구글드라이브 2026교육/7월 인권교육" />
              </div>

              {f.requirement && (
                <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  필수 기록사항: {f.requirement}
                </p>
              )}
            </>
          )}

          <div>
            <label className={lbl}>메모</label>
            <textarea rows={2} value={f.memo} onChange={e => set('memo', e.target.value)} className={`${inp} resize-none`} />
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t shrink-0">
          {isEdit && (
            <button onClick={del} disabled={saving}
              className="w-11 h-11 shrink-0 rounded-xl border border-red-100 text-red-400 hover:bg-red-50 flex items-center justify-center disabled:opacity-50">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-semibold">취소</button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-primary-orange hover:brightness-95 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
