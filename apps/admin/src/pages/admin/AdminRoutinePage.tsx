import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2, Check, AlertTriangle, X, ShieldCheck } from 'lucide-react'
import {
  adminRoutineAPI, ROUTINE_CATEGORIES, type RoutineItem, type RoutineMonth,
} from '@/api/adminRoutineClient'

/* ── helpers ── */
const pad2 = (n: number) => String(n).padStart(2, '0')
const monthKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const dayLabel = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}/${d}(${WEEK[new Date(y, m - 1, d).getDay()]})`
}

/* 분류 색 — 캘린더 칩과 같은 톤 */
const CAT: Record<string, string> = {
  '신고·납부': 'bg-rose-50 text-rose-700 border-rose-200',
  급여:       'bg-amber-50 text-amber-700 border-amber-200',
  보고:       'bg-blue-50 text-blue-700 border-blue-200',
  점검:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  기타:       'bg-gray-50 text-gray-600 border-gray-200',
}
const catClass = (c: string) => CAT[c] ?? CAT.기타

export default function AdminRoutinePage() {
  const [cursor, setCursor] = useState(() => new Date())
  const [data, setData] = useState<RoutineMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)   // 토글 중인 업무 id
  const [editing, setEditing] = useState<RoutineItem | null | undefined>(undefined)  // null = 새로 추가

  const month = monthKey(cursor)
  const isThisMonth = month === monthKey(new Date())

  /** silent=true 면 스피너를 띄우지 않는다.
   *  목록을 스피너로 갈아끼우면 화면이 통째로 다시 그려져 보던 자리를 잃는다.
   *  달을 바꿀 때만 스피너가 필요하다. */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { setData(await adminRoutineAPI.month(month)) }
    catch { if (!silent) setData(null) }
    finally { if (!silent) setLoading(false) }
  }, [month])
  useEffect(() => { load() }, [load])

  const items = data?.items ?? []
  const remain = items.filter(i => !i.done)
  const overdue = remain.filter(i => i.overdue)
  const pct = items.length ? Math.round((items.length - remain.length) / items.length * 100) : 0

  // 날짜별 묶음 — "쭉 나오는 리스트"의 기본 정렬은 날짜순
  const groups = useMemo(() => {
    const map = new Map<string, RoutineItem[]>()
    for (const i of items) {
      if (!map.has(i.date)) map.set(i.date, [])
      map.get(i.date)!.push(i)
    }
    return [...map.entries()]
  }, [items])

  /** 체크 하나를 바꿀 때는 그 줄만 고친다.
   *  다시 불러오면 목록이 사라졌다 그려지면서 보던 자리가 맨 위로 올라간다.
   *  실패하면 원래대로 되돌린다 — 안 되돌리면 화면과 서버가 어긋난 채 남는다. */
  const patchItem = (id: string, next: boolean, extra: Partial<RoutineItem> = {}) =>
    setData(d => {
      if (!d) return d
      const items = d.items.map(x =>
        x.id !== id ? x : { ...x, done: next, overdue: !next && x.date < d.today, ...extra })
      return { ...d, items, done_count: items.filter(x => x.done).length }
    })

  const toggle = async (it: RoutineItem) => {
    const next = !it.done
    setBusy(it.id)
    patchItem(it.id, next)                    // 먼저 화면을 바꾼다 — 누른 순간 반응하게
    try {
      const r = await adminRoutineAPI.setDone(it.id, { month, done: next })
      // 완료 시각·완료자는 서버가 정한다
      patchItem(it.id, r.done, { done_date: r.done_date ?? null, done_by: r.done_by ?? null })
    } catch (e: any) {
      patchItem(it.id, it.done, { done_date: it.done_date, done_by: it.done_by })
      alert(e?.message ?? '저장 실패')
    } finally { setBusy(null) }
  }

  const remove = async (it: RoutineItem) => {
    if (!confirm(`"${it.title}"을(를) 삭제할까요?\n매달 반복 등록이 사라지고, 지난 완료 기록도 함께 지워집니다.`)) return
    try { await adminRoutineAPI.remove(it.id); load(true) }
    catch (e: any) { alert(e?.message ?? '삭제 실패') }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-orange/10 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-primary-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
              월간 업무
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-zinc-100 text-zinc-700 border-zinc-300">
                <ShieldCheck className="w-3 h-3" /> 나만 보임
              </span>
            </h1>
            <p className="text-xs text-gray-400">
              매달 반복되는 <b>내 일</b>을 한 번만 등록해두면, 달마다 이 목록으로 돌아옵니다.
              다른 사람에게는 보이지 않습니다.
            </p>
          </div>
        </div>
        <button onClick={() => setEditing(null)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-orange text-white text-sm font-bold hover:opacity-90">
          <Plus className="w-4 h-4" /> 업무 추가
        </button>
      </div>

      {/* 월 이동 + 진행률 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-base font-bold text-gray-900 min-w-[7.5rem] text-center">
              {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
            </span>
            <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight className="w-5 h-5" /></button>
            {!isThisMonth && (
              <button onClick={() => setCursor(new Date())}
                className="ml-1 px-2.5 py-1 rounded-lg text-xs font-bold text-primary-orange bg-primary-orange/10">이번 달</button>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-gray-900">{items.length - remain.length}<span className="text-gray-400 font-medium"> / {items.length} 완료</span></span>
            {overdue.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-rose-600">
                <AlertTriangle className="w-3.5 h-3.5" /> 기한 지남 {overdue.length}건
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-primary-orange transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 px-6 text-center">
          <CalendarCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">아직 등록한 월간 업무가 없습니다.</p>
          <p className="text-xs text-gray-400 mb-5">매달 같은 날 반복되는 일을 등록해두세요.</p>
          <button onClick={() => setEditing(null)}
            className="px-4 py-2 rounded-xl bg-primary-orange text-white text-sm font-bold">업무 추가</button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([date, list]) => {
            const isPast = !!data && date < data.today
            const isToday = !!data && date === data.today
            return (
              <div key={date} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className={`px-4 py-2 text-xs font-bold border-b flex items-center gap-2 ${
                  isToday ? 'bg-primary-orange/10 text-primary-orange border-primary-orange/20'
                  : isPast ? 'bg-gray-50 text-gray-400 border-gray-100'
                  : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                  {dayLabel(date)}
                  {isToday && <span className="px-1.5 py-0.5 rounded bg-primary-orange text-white text-[10px]">오늘</span>}
                </div>
                <ul className="divide-y divide-gray-50">
                  {list.map(it => (
                    <li key={it.id} className={`flex items-start gap-3 px-4 py-3 ${it.done ? 'bg-gray-50/50' : ''}`}>
                      {/* 완료 체크 — 이번 달 기록만 바뀌고 다음 달엔 다시 미완료 */}
                      <button onClick={() => toggle(it)} disabled={busy === it.id}
                        className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                          it.done ? 'bg-emerald-500 border-emerald-500 text-white'
                          : it.overdue ? 'border-rose-300 hover:border-rose-500'
                          : 'border-gray-300 hover:border-primary-orange'}`}>
                        {busy === it.id ? <Loader2 className="w-3 h-3 animate-spin" />
                          : it.done ? <Check className="w-3.5 h-3.5" /> : null}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${catClass(it.category)}`}>
                            {it.category}
                          </span>
                          <span className={`text-sm font-semibold ${it.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {it.title}
                          </span>
                          {!it.done && it.overdue && (
                            <span className="text-[10px] font-bold text-rose-600">기한 지남</span>
                          )}
                        </div>
                        {it.memo && <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap">{it.memo}</p>}
                        {it.done && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            {it.done_date} 완료{it.done_by ? ` · ${it.done_by}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEditing(it)} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100">
                          <Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove(it)} className="p-1.5 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50">
                          <Trash2 className="w-4 h-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {editing !== undefined && (
        <RoutineModal editing={editing} onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load(true) }} />
      )}
    </div>
  )
}

/* ── 추가·수정 모달 ── */
function RoutineModal({ editing, onClose, onSaved }: {
  editing: RoutineItem | null; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!editing
  const [title, setTitle] = useState(editing?.title ?? '')
  const [day, setDay] = useState(editing?.day ?? 1)
  const [category, setCategory] = useState<string>(editing?.category ?? '기타')
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!title.trim()) { setErr('업무명을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const body = { title: title.trim(), day, category, memo: memo.trim() || null }
      if (isEdit) await adminRoutineAPI.update(editing!.id, body)
      else await adminRoutineAPI.create(body)
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">{isEdit ? '월간 업무 수정' : '월간 업무 추가'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">분류</label>
            <div className="flex flex-wrap gap-1.5">
              {ROUTINE_CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    category === c ? catClass(c) : 'bg-white text-gray-400 border-gray-200'}`}>{c}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">업무명</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="예) 원천세 신고·납부"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange/40" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">매월 며칠</label>
            <div className="flex items-center gap-2">
              <select value={day} onChange={e => setDay(Number(e.target.value))}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange/40">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}일{d === 31 ? ' (말일)' : ''}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">
                {day >= 29 ? '그 달에 없는 날이면 말일에 표시돼요.' : '매달 이 날짜에 표시됩니다.'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">메모 <span className="font-normal text-gray-300">(선택)</span></label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
              placeholder="처리 방법·사이트 등"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-orange/40" />
          </div>

          {err && <p className="text-xs text-rose-600">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-500">취소</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary-orange text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
