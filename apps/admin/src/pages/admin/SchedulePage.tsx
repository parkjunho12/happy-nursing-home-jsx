import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, X, Trash2, MapPin,
  Phone, Clock, Briefcase, Loader2, Grid3x3, Columns3, List, UserPlus,
} from 'lucide-react'
import {
  scheduleAPI, SCHEDULE_CATEGORIES, type ScheduleEvent, type EventInput, type LifecycleEvent,
} from '../../api/scheduleClient'
import { recruitmentAPI, type Interview } from '../../api/recruitmentClient'

/* ── helpers ── */
const pad2 = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const hmOf = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x }

/* 카테고리 색상 */
type CatKey = '방문상담' | '외부방문' | '회의' | '행사' | '기타' | '면접' | '입소' | '입사'
const CAT: Record<CatKey, { dot: string; chip: string; bar: string }> = {
  방문상담: { dot: 'bg-blue-500',   chip: 'bg-blue-50 text-blue-700 border-blue-200',       bar: 'border-l-blue-500 bg-blue-50' },
  외부방문: { dot: 'bg-teal-500',   chip: 'bg-teal-50 text-teal-700 border-teal-200',       bar: 'border-l-teal-500 bg-teal-50' },
  회의:    { dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: 'border-l-indigo-500 bg-indigo-50' },
  행사:    { dot: 'bg-pink-500',   chip: 'bg-pink-50 text-pink-700 border-pink-200',       bar: 'border-l-pink-500 bg-pink-50' },
  기타:    { dot: 'bg-gray-400',   chip: 'bg-gray-50 text-gray-600 border-gray-200',       bar: 'border-l-gray-400 bg-gray-50' },
  면접:    { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'border-l-violet-500 bg-violet-50' },
  입소:    { dot: 'bg-rose-500',   chip: 'bg-rose-50 text-rose-600 border-rose-200',       bar: 'border-l-rose-500 bg-rose-50' },
  입사:    { dot: 'bg-cyan-500',   chip: 'bg-cyan-50 text-cyan-700 border-cyan-200',       bar: 'border-l-cyan-500 bg-cyan-50' },
}
const ALL_CATS: CatKey[] = ['방문상담', '외부방문', '회의', '행사', '기타', '면접', '입소', '입사']

/* 통합 이벤트 */
type UEvent = {
  key: string
  kind: 'event' | 'interview' | 'lifecycle'
  category: CatKey
  title: string
  start?: string | null
  dateKey: string
  time: string
  location?: string | null
  contactName?: string | null
  contactPhone?: string | null
  memo?: string | null
  raw: ScheduleEvent | Interview
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export default function SchedulePage() {
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month')
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [lifecycles, setLifecycles] = useState<LifecycleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Set<CatKey>>(new Set(ALL_CATS))
  const [addOpen, setAddOpen] = useState(false)
  const [addDate, setAddDate] = useState<string | null>(null)
  const [detail, setDetail] = useState<UEvent | null>(null)

  const y = cursor.getFullYear(), m = cursor.getMonth()

  const range = useMemo(() => {
    if (view === 'week') {
      const s = startOfWeek(cursor)
      const e = new Date(s); e.setDate(e.getDate() + 6)
      return { start: s, end: e }
    }
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) }
  }, [view, cursor, y, m])
  const rangeStart = ymd(range.start), rangeEnd = ymd(range.end)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ev, iv, lc] = await Promise.all([
        scheduleAPI.events({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as ScheduleEvent[]),
        recruitmentAPI.interviews({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as Interview[]),
        scheduleAPI.lifecycle({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as LifecycleEvent[]),
      ])
      setEvents(ev); setInterviews(iv); setLifecycles(lc)
    } finally { setLoading(false) }
  }, [rangeStart, rangeEnd])
  useEffect(() => { load() }, [load])

  const unified: UEvent[] = useMemo(() => {
    const out: UEvent[] = []
    for (const e of events) {
      const cat = (SCHEDULE_CATEGORIES as readonly string[]).includes(e.category) ? (e.category as CatKey) : '기타'
      if (!e.start_at) continue
      out.push({
        key: `e-${e.id}`, kind: 'event', category: cat, title: e.title,
        start: e.start_at, dateKey: ymd(new Date(e.start_at)), time: hmOf(e.start_at),
        location: e.location, contactName: e.contact_name, contactPhone: e.contact_phone,
        memo: e.memo, raw: e,
      })
    }
    for (const iv of interviews) {
      if (!iv.interview_at) continue
      out.push({
        key: `i-${iv.id}`, kind: 'interview', category: '면접',
        title: `면접 · ${iv.name}${iv.category ? ` (${iv.category})` : ''}`,
        start: iv.interview_at, dateKey: ymd(new Date(iv.interview_at)), time: hmOf(iv.interview_at),
        location: iv.location, contactName: iv.name, contactPhone: iv.phone, memo: iv.note, raw: iv,
      })
    }
    for (const l of lifecycles) {
      if (!l.date) continue
      const cat: CatKey = l.kind === 'admission' ? '입소' : '입사'
      const label = l.kind === 'admission' ? '입소' : '입사'
      out.push({
        key: `l-${l.kind}-${l.id}`, kind: 'lifecycle', category: cat,
        title: `${label} · ${l.name}`,
        start: `${l.date}T00:00`, dateKey: l.date, time: '',
        location: null, contactName: l.name, contactPhone: null, memo: null, raw: l as any,
      })
    }
    return out.sort((a, b) => (a.start! < b.start! ? -1 : 1))
  }, [events, interviews, lifecycles])

  const shown = useMemo(() => unified.filter(u => active.has(u.category)), [unified, active])

  const byDay = useMemo(() => {
    const map: Record<string, UEvent[]> = {}
    for (const u of shown) (map[u.dateKey] ??= []).push(u)
    return map
  }, [shown])

  const catCounts = useMemo(() => {
    const c = {} as Record<CatKey, number>
    for (const u of unified) c[u.category] = (c[u.category] ?? 0) + 1
    return c
  }, [unified])

  /* 월 그리드 */
  const firstDow = new Date(y, m, 1).getDay()
  const daysIn = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysIn }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  /* 주 그리드 */
  const weekDays = useMemo(() => {
    const s = startOfWeek(cursor)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d })
  }, [cursor])

  /* 아젠다 그룹 */
  const groups = useMemo(() => {
    const map = new Map<string, UEvent[]>()
    for (const u of shown) { if (!map.has(u.dateKey)) map.set(u.dateKey, []); map.get(u.dateKey)!.push(u) }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [shown])

  const todayKey = ymd(new Date())
  const tomorrowKey = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d) })()
  const relBadge = (dk: string) => (dk === todayKey ? '오늘' : dk === tomorrowKey ? '내일' : null)

  const go = (dir: number) => setCursor(prev => {
    const d = new Date(prev)
    if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    return d
  })
  const goToday = () => setCursor(new Date())

  const title = view === 'week'
    ? `${range.start.getMonth() + 1}.${range.start.getDate()} ~ ${range.end.getMonth() + 1}.${range.end.getDate()}`
    : `${y}년 ${m + 1}월`

  const toggleCat = (c: CatKey) => setActive(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })
  const openAdd = (dateKey?: string) => { setAddDate(dateKey ?? null); setAddOpen(true) }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">일정 캘린더</h1>
            <p className="text-xs text-gray-400">방문상담 · 외부방문 · 회의 · 행사 · 면접을 한눈에</p>
          </div>
        </div>
        <button onClick={() => openAdd()} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> 일정 추가
        </button>
      </div>

      {/* 컨트롤 바: 뷰 토글 + 네비 */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="inline-flex bg-gray-100 rounded-xl p-1">
          {([['month', '월', Grid3x3], ['week', '주', Columns3], ['agenda', '목록', List]] as const).map(([v, label, Icon]) => (
            <button key={v} onClick={() => setView(v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${view === v ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => go(-1)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
          <div className="text-base font-bold text-gray-900 min-w-[8rem] text-center flex items-center justify-center gap-2">
            {title}
            {loading && <Loader2 className="w-4 h-4 animate-spin text-violet-400" />}
          </div>
          <button onClick={() => go(1)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
          <button onClick={goToday} className="ml-1 px-3 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 rounded-lg border border-violet-100">오늘</button>
        </div>
      </div>

      {/* 범례/필터 (건수 포함) */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {ALL_CATS.map(c => {
          const on = active.has(c)
          const n = catCounts[c] ?? 0
          return (
            <button key={c} onClick={() => toggleCat(c)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${on ? CAT[c].chip : 'bg-white text-gray-300 border-gray-100'}`}>
              <span className={`w-2 h-2 rounded-full ${on ? CAT[c].dot : 'bg-gray-200'}`} />
              {c}{n > 0 && <span className="opacity-70">{n}</span>}
            </button>
          )
        })}
      </div>

      {/* ── 월 뷰 ── */}
      {view === 'month' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
            {WEEK.map((w, i) => (
              <div key={w} className={`py-2.5 text-center text-xs font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dow = i % 7
              const weekendBg = dow === 0 || dow === 6
              if (day === null) return <div key={i} className={`min-h-[116px] border-b border-r border-gray-50 ${weekendBg ? 'bg-gray-50/40' : 'bg-gray-50/20'}`} />
              const dk = ymd(new Date(y, m, day))
              const items = byDay[dk] ?? []
              const isToday = dk === todayKey
              return (
                <div key={i} onClick={() => openAdd(dk)}
                  className={`group min-h-[116px] border-b border-r border-gray-50 p-1.5 transition-colors cursor-pointer flex flex-col gap-1 ${isToday ? 'bg-violet-50/60' : weekendBg ? 'bg-gray-50/30 hover:bg-violet-50/30' : 'hover:bg-violet-50/30'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? 'w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-500'}`}>{day}</span>
                    <Plus className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {items.slice(0, 3).map(u => (
                      <button key={u.key} onClick={(e) => { e.stopPropagation(); setDetail(u) }}
                        className={`flex items-center gap-1 text-left text-[11px] leading-tight px-1.5 py-1 rounded-md border-l-2 ${CAT[u.category].bar} hover:brightness-95 transition`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CAT[u.category].dot}`} />
                        <span className="font-bold shrink-0">{u.time}</span>
                        <span className="truncate">{u.title}</span>
                      </button>
                    ))}
                    {items.length > 3 && (
                      <button onClick={(e) => { e.stopPropagation(); setCursor(new Date(y, m, day)); setView('agenda') }}
                        className="text-[10px] font-semibold text-violet-500 hover:text-violet-700 pl-1 text-left">+{items.length - 3}건 더보기</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 주 뷰 ── */}
      {view === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const dk = ymd(d)
            const items = byDay[dk] ?? []
            const isToday = dk === todayKey
            return (
              <div key={i} className={`rounded-xl border overflow-hidden flex flex-col ${isToday ? 'border-violet-300 bg-violet-50/40' : 'border-gray-100 bg-white'}`}>
                <button onClick={() => openAdd(dk)} className={`px-2 py-2 text-center border-b hover:bg-violet-50/50 ${isToday ? 'border-violet-200' : 'border-gray-50'}`}>
                  <div className={`text-[11px] font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{WEEK[i]}</div>
                  <div className={`text-sm font-bold ${isToday ? 'text-violet-700' : 'text-gray-700'}`}>{d.getDate()}</div>
                </button>
                <div className="p-1.5 flex flex-col gap-1 min-h-[240px]">
                  {items.map(u => (
                    <button key={u.key} onClick={() => setDetail(u)}
                      className={`text-left text-[11px] leading-tight px-1.5 py-1.5 rounded-md border-l-2 ${CAT[u.category].bar} hover:brightness-95`}>
                      <div className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CAT[u.category].dot}`} /><span className="font-bold">{u.time}</span></div>
                      <div className="truncate mt-0.5 font-medium text-gray-700">{u.title}</div>
                    </button>
                  ))}
                  {items.length === 0 && <div className="text-[10px] text-gray-300 text-center pt-3">·</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 목록(아젠다) 뷰 ── */}
      {view === 'agenda' && (
        <div className="space-y-4">
          {groups.map(([dk, items]) => {
            const d = new Date(dk + 'T00:00:00')
            const rb = relBadge(dk)
            const dow = d.getDay()
            return (
              <div key={dk}>
                <div className="flex items-center gap-2 mb-1.5 py-1">
                  <span className="text-sm font-bold text-gray-800">{d.getMonth() + 1}월 {d.getDate()}일</span>
                  <span className={`text-xs font-semibold ${dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-400'}`}>({WEEK[dow]})</span>
                  {rb && <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{rb}</span>}
                  <span className="text-xs text-gray-300 ml-auto">{items.length}건</span>
                </div>
                <div className="space-y-1.5">
                  {items.map(u => (
                    <button key={u.key} onClick={() => setDetail(u)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-l-4 ${CAT[u.category].bar} border border-gray-100 hover:shadow-sm transition-all text-left`}>
                      <div className="text-sm font-bold text-gray-600 w-14 shrink-0">{u.time}</div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${CAT[u.category].chip}`}>{u.category}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{u.title}</p>
                        {u.location && <p className="text-xs text-gray-400 truncate">📍 {u.location}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {!loading && groups.length === 0 && (
            <div className="text-center py-16 text-sm text-gray-400">이 기간에 등록된 일정이 없습니다.</div>
          )}
        </div>
      )}

      {addOpen && <AddModal presetDate={addDate} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load() }} />}
      {detail && <DetailModal ev={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); load() }} onGoRecruit={() => navigate('/recruitment')} />}
    </div>
  )
}

/* ── 시간 유틸 ── */
// 00:00 ~ 23:30, 30분 단위 슬롯
const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, k) => {
  const h = Math.floor(k / 2), mm = k % 2 === 0 ? '00' : '30'
  return `${pad2(h)}:${mm}`
})
const timeLabel = (t: string) => {
  const [h, mm] = t.split(':').map(Number)
  const ap = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ap} ${h12}:${pad2(mm)}`
}
const QUICK_TIMES = ['09:00', '10:00', '11:00', '13:30', '14:00', '15:00', '16:00']
const DURATIONS: { label: string; min: number | null }[] = [
  { label: '지정 안 함', min: null },
  { label: '30분', min: 30 },
  { label: '1시간', min: 60 },
  { label: '1시간 30분', min: 90 },
  { label: '2시간', min: 120 },
  { label: '반나절', min: 240 },
]
const addMinutes = (dateStr: string, time: string, min: number) => {
  const [h, mm] = time.split(':').map(Number)
  const d = new Date(`${dateStr}T${pad2(h)}:${pad2(mm)}:00`)
  d.setMinutes(d.getMinutes() + min)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const dayAfter = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d) }

/* ── 추가 모달 ── */
function AddModal({ presetDate, onClose, onSaved }: { presetDate: string | null; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState<string>('방문상담')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => presetDate ?? ymd(new Date()))
  const [time, setTime] = useState('10:00')
  const [durMin, setDurMin] = useState<number | null>(60)
  const [location, setLocation] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const start_at = `${date}T${time}`
  const endPreview = durMin ? addMinutes(date, time, durMin) : null
  const endTimeStr = endPreview ? endPreview.slice(11, 16) : null

  const dateChips = [
    { label: '오늘', v: dayAfter(0) },
    { label: '내일', v: dayAfter(1) },
    { label: '모레', v: dayAfter(2) },
  ]

  const submit = async () => {
    if (!title.trim()) { setErr('제목을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const body: EventInput = {
        category, title: title.trim(), start_at,
        end_at: endPreview, location: location || null,
        contact_name: contactName || null, contact_phone: contactPhone || null, memo: memo || null,
      }
      await scheduleAPI.createEvent(body)
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  return (
    <Modal title="일정 추가" onClose={onClose}>
      <div className="space-y-4">
        {/* 분류 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">분류</label>
          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${category === c ? (CAT as any)[c].chip : 'bg-white text-gray-400 border-gray-200'}`}>{c}</button>
            ))}
          </div>
        </div>

        <Field label="제목"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 김OO 어르신 방문상담" className="inp" autoFocus /></Field>

        {/* 날짜 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">날짜</label>
          <div className="flex items-center gap-1.5 mb-2">
            {dateChips.map(c => (
              <button key={c.label} onClick={() => setDate(c.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${date === c.v ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300'}`}>{c.label}</button>
            ))}
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="inp" />
        </div>

        {/* 시작 시간 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">시작 시간</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_TIMES.map(t => (
              <button key={t} onClick={() => setTime(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${time === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300'}`}>{t}</button>
            ))}
          </div>
          <select value={time} onChange={e => setTime(e.target.value)} className="inp">
            {TIME_SLOTS.map(t => <option key={t} value={t}>{timeLabel(t)}</option>)}
          </select>
        </div>

        {/* 소요 시간 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
            소요 시간{endTimeStr && <span className="ml-1.5 text-violet-600 font-bold">→ {timeLabel(endTimeStr)} 종료</span>}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map(d => (
              <button key={d.label} onClick={() => setDurMin(d.min)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${durMin === d.min ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300'}`}>{d.label}</button>
            ))}
          </div>
        </div>

        <Field label="장소 (선택)"><input value={location} onChange={e => setLocation(e.target.value)} placeholder="예: 시설 1층 상담실" className="inp" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="연락처 이름 (선택)"><input value={contactName} onChange={e => setContactName(e.target.value)} className="inp" /></Field>
          <Field label="연락처 전화 (선택)"><input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="010-0000-0000" className="inp" /></Field>
        </div>
        <Field label="메모 (선택)"><textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className="inp resize-none" /></Field>
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}저장
        </button>
      </ModalFooter>
    </Modal>
  )
}

/* ── 상세 모달 ── */
function DetailModal({ ev, onClose, onChanged, onGoRecruit }: { ev: UEvent; onClose: () => void; onChanged: () => void; onGoRecruit: () => void }) {
  const [busy, setBusy] = useState(false)
  const isEvent = ev.kind === 'event'
  const isInterview = ev.kind === 'interview'

  const del = async () => {
    if (!isEvent) return
    if (!confirm('이 일정을 삭제할까요?')) return
    setBusy(true)
    try { await scheduleAPI.deleteEvent((ev.raw as ScheduleEvent).id); onChanged() } finally { setBusy(false) }
  }

  return (
    <Modal title="일정 상세" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${CAT[ev.category].chip}`}>{ev.category}</span>
          <p className="text-base font-bold text-gray-900">{ev.title}</p>
        </div>
        <div className="space-y-1.5 text-sm text-gray-600">
          <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> {ev.dateKey}{ev.time ? ` ${ev.time}` : ""}</p>
          {ev.location && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> {ev.location}</p>}
          {ev.contactPhone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> {ev.contactName ? `${ev.contactName} · ` : ''}{ev.contactPhone}</p>}
          {ev.memo && <p className="text-gray-500 bg-gray-50 rounded-lg p-2.5 whitespace-pre-wrap">{ev.memo}</p>}
        </div>
        {isInterview && (
          <div className="bg-violet-50 rounded-lg p-3 text-xs text-violet-700 flex items-start gap-2">
            <Briefcase className="w-4 h-4 shrink-0 mt-0.5" />
            <span>채용 면접 일정입니다. 상태·결과·통보 관리는 채용 관리에서 진행하세요.</span>
          </div>
        )}
        {ev.kind === 'lifecycle' && (
          <div className={`rounded-lg p-3 text-xs flex items-start gap-2 ${ev.category === '입소' ? 'bg-rose-50 text-rose-600' : 'bg-cyan-50 text-cyan-700'}`}>
            <UserPlus className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{ev.category === '입소' ? '수급자 입소일입니다. 입소 정보는 수급자 관리에서 관리됩니다.' : '직원 입사일입니다. 입사 정보는 직원 관리에서 관리됩니다.'}</span>
          </div>
        )}
      </div>
      <ModalFooter>
        {isEvent && (
          <button onClick={del} disabled={busy} className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50">
            <Trash2 className="w-4 h-4" /> 삭제
          </button>
        )}
        {isInterview && (
          <button onClick={onGoRecruit} className="px-4 py-2 text-sm font-semibold text-violet-600 hover:bg-violet-50 rounded-lg inline-flex items-center gap-1.5">
            <Briefcase className="w-4 h-4" /> 채용 관리에서 열기
          </button>
        )}
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-lg">닫기</button>
      </ModalFooter>
    </Modal>
  )
}

/* ── 공용 UI ── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100">{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>{children}</div>
}
