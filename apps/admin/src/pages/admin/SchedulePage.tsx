import DateField from '@/components/ui/DateField'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, X, Trash2, MapPin,
  Phone, Clock, Briefcase, Loader2, Grid3x3, Columns3, List, UserPlus, ClipboardList, Pencil } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { birthdaysInRange } from '@/utils/birthdays'
import { ledgerAPI, type LedgerRow } from '@/api/leaveClient'
import { visitAPI } from '@/api/visitClient'
import VisitInboxPanel from '@/components/schedule/VisitInboxPanel'
import { useAuthStore } from '@/store/auth'
import { isKakaoShareEnabled, shareText } from '@/lib/kakaoShare'
import { getNavConfig } from '@/components/layout/navConfig'
import {
  scheduleAPI, SCHEDULE_CATEGORIES, type ScheduleEvent, type EventInput, type LifecycleEvent, type RenewalEvent, type DocCalEvent, type EduCalEvent,
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
type CatKey = '방문상담' | '외부방문' | '회의' | '행사' | '외래·병원' | '면회' | '외출' | '외박' | '갱신' | '퇴소' | '기타' | '면접' | '입소' | '입사' | '재계약' | '계약서' | '계획서' | '평가' | '교육' | '생신' | '생일' | '연차촉진'
const CAT: Record<CatKey, { dot: string; chip: string; bar: string }> = {
  방문상담: { dot: 'bg-blue-500',   chip: 'bg-blue-50 text-blue-700 border-blue-200',       bar: 'border-l-blue-500 bg-blue-50' },
  외부방문: { dot: 'bg-teal-500',   chip: 'bg-teal-50 text-teal-700 border-teal-200',       bar: 'border-l-teal-500 bg-teal-50' },
  회의:    { dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: 'border-l-indigo-500 bg-indigo-50' },
  행사:    { dot: 'bg-pink-500',   chip: 'bg-pink-50 text-pink-700 border-pink-200',       bar: 'border-l-pink-500 bg-pink-50' },
  '외래·병원': { dot: 'bg-purple-500', chip: 'bg-purple-50 text-purple-700 border-purple-200', bar: 'border-l-purple-500 bg-purple-50' },
  면회:    { dot: 'bg-yellow-500', chip: 'bg-yellow-50 text-yellow-700 border-yellow-200',  bar: 'border-l-yellow-500 bg-yellow-50' },
  외출:    { dot: 'bg-green-600',  chip: 'bg-green-50 text-green-700 border-green-200',     bar: 'border-l-green-600 bg-green-50' },
  외박:    { dot: 'bg-green-900',  chip: 'bg-green-100 text-green-900 border-green-300',    bar: 'border-l-green-900 bg-green-100' },
  갱신:    { dot: 'bg-stone-500',  chip: 'bg-stone-100 text-stone-700 border-stone-300',    bar: 'border-l-stone-500 bg-stone-100' },
  퇴소:    { dot: 'bg-slate-500',  chip: 'bg-slate-100 text-slate-600 border-slate-300',    bar: 'border-l-slate-500 bg-slate-100' },
  기타:    { dot: 'bg-gray-400',   chip: 'bg-gray-50 text-gray-600 border-gray-200',       bar: 'border-l-gray-400 bg-gray-50' },
  면접:    { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'border-l-violet-500 bg-violet-50' },
  입소:    { dot: 'bg-rose-500',   chip: 'bg-rose-50 text-rose-600 border-rose-200',       bar: 'border-l-rose-500 bg-rose-50' },
  입사:    { dot: 'bg-cyan-500',   chip: 'bg-cyan-50 text-cyan-700 border-cyan-200',       bar: 'border-l-cyan-500 bg-cyan-50' },
  재계약:  { dot: 'bg-amber-500',  chip: 'bg-amber-50 text-amber-700 border-amber-200',     bar: 'border-l-amber-500 bg-amber-50' },
  계약서:  { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'border-l-emerald-500 bg-emerald-50' },
  계획서:  { dot: 'bg-sky-500',     chip: 'bg-sky-50 text-sky-700 border-sky-200',             bar: 'border-l-sky-500 bg-sky-50' },
  평가:    { dot: 'bg-fuchsia-500', chip: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', bar: 'border-l-fuchsia-500 bg-fuchsia-50' },
  교육:    { dot: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-700 border-orange-200',     bar: 'border-l-orange-500 bg-orange-50' },
  생신:    { dot: 'bg-red-400',     chip: 'bg-red-50 text-red-600 border-red-200',               bar: 'border-l-red-400 bg-red-50' },
  생일:    { dot: 'bg-lime-500',    chip: 'bg-lime-50 text-lime-700 border-lime-200',            bar: 'border-l-lime-500 bg-lime-50' },
  연차촉진: { dot: 'bg-fuchsia-500', chip: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',     bar: 'border-l-fuchsia-500 bg-fuchsia-50' },
}
const ALL_CATS: CatKey[] = ['방문상담', '외부방문', '회의', '행사', '외래·병원', '면회', '외출', '외박', '갱신', '퇴소', '기타', '면접', '입소', '입사', '재계약', '계약서', '계획서', '평가', '교육', '생신', '생일', '연차촉진']

// 카테고리마다 근거가 되는 메뉴가 있다 — 그 메뉴를 못 보는 직종은 캘린더에서도 그 정보를 못 본다.
// null = 일반 일정(캘린더 접근자 전원)
const CAT_ROUTE: Record<CatKey, string | null> = {
  방문상담: null, 외부방문: null, 회의: null, 행사: null, 기타: null,
  '외래·병원': null, 면회: null, 외출: null, 외박: null,   // 어르신 케어와 직결 — 전 직원
  갱신: '/resident-docs', 퇴소: '/eval/residents',
  면접: '/recruitment',
  입소: '/eval/residents', 생신: '/eval/residents',
  입사: '/eval/staff', 생일: '/eval/staff', 재계약: '/staff-hr',
  계약서: '/resident-docs', 계획서: '/resident-docs', 평가: '/resident-docs',
  교육: '/education',
  연차촉진: null,   // 별도 규칙(시설장·ADMIN) — 아래 canPromo로 판정
}

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
// 귀원 시간 선택지 — 30분 단위 (06:00~22:00)
const RETURN_TIMES = Array.from({ length: 33 }, (_, i) => {
  const h = 6 + Math.floor(i / 2), m = i % 2 ? '30' : '00'
  return `${String(h).padStart(2, '0')}:${m}`
})
// 로컬에서 열렸으면 공개 웹도 로컬(next dev, 3000)을 본다 — 카드 이미지·공지 링크 테스트용
const PUBLIC_WEB = (() => {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h) || /^10\./.test(h))
      return `http://${h}:3000`
  }
  return (import.meta.env.VITE_PUBLIC_WEB_URL || 'https://www.xn--p80bu1t60gba47bg6abm347gsla.com').replace(/\/$/, '')
})()

export default function SchedulePage() {
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<'month' | 'week' | 'agenda'>(
    () => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'agenda' : 'month'))
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [lifecycles, setLifecycles] = useState<LifecycleEvent[]>([])
  const [renewals, setRenewals] = useState<RenewalEvent[]>([])
  const [docs, setDocs] = useState<DocCalEvent[]>([])
  const [edus, setEdus] = useState<EduCalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Set<CatKey>>(new Set(ALL_CATS))
  const [addOpen, setAddOpen] = useState(false)
  const [addDate, setAddDate] = useState<string | null>(null)
  const [editEvent, setEditEvent] = useState<ScheduleEvent | null>(null)
  const [detail, setDetail] = useState<UEvent | null>(null)
  // 생일은 서버 조회가 아니라 이미 있는 명단(수급자·직원)의 생년월일에서 계산한다
  const { residents, staffList, loaded: ltcLoaded, loadAll: ltcLoadAll } = useLtcStore()
  useEffect(() => { if (!ltcLoaded) ltcLoadAll() }, [ltcLoaded, ltcLoadAll])

  // 연차촉진 통지 일정 — 시설장·ADMIN만. 놓치면 법적 효력이 사라지므로 캘린더에 박아둔다.
  const { user: authUser } = useAuthStore()
  const canPromo = authUser?.role === 'ADMIN' || authUser?.position === '시설장'
  const [promoRows, setPromoRows] = useState<LedgerRow[]>([])

  // 면회 예약 승인함 — 백엔드 권한(ADMIN·시설장·사회복지사)과 동일 기준
  const canVisit = authUser?.role === 'ADMIN' || ['시설장', '사회복지사'].includes(authUser?.position ?? '')
  const [visitOpen, setVisitOpen] = useState(false)
  const [visitPending, setVisitPending] = useState(0)
  const loadVisitCount = useCallback(() => {
    if (!canVisit) return
    visitAPI.list('pending').then(r => setVisitPending(r.length)).catch(() => {})
  }, [canVisit])
  useEffect(() => { loadVisitCount() }, [loadVisitCount])

  // 직종별 가시 카테고리 — 사이드바 메뉴 접근권과 동일 기준
  // 요양보호사는 고정 5종만: 행사·기타·교육·생신·생일 (상담·회의 같은 운영 일정은 제외)
  const visibleCats = useMemo(() => {
    if (authUser?.role !== 'ADMIN' && authUser?.position === '요양보호사')
      return new Set<CatKey>(['행사', '기타', '교육', '생신', '생일', '외래·병원', '면회', '외출', '외박'])
    // 영양사 — 사회복지사가 보는 범위와 동일하게 (메뉴는 좁아도 캘린더 가시성은 사회복지사 기준)
    const navUser = authUser?.role !== 'ADMIN' && authUser?.position === '영양사'
      ? { ...authUser, position: '사회복지사' } : authUser
    const nav = getNavConfig(navUser)
    const routes = new Set<string>(nav.sections.flatMap(sec => sec.items.map(i => i.to)))
    return new Set<CatKey>(ALL_CATS.filter(c =>
      c === '연차촉진' ? canPromo : (CAT_ROUTE[c] === null || routes.has(CAT_ROUTE[c]!))))
  }, [authUser, canPromo])

  const y = cursor.getFullYear(), m = cursor.getMonth()

  useEffect(() => {
    if (!canPromo) return
    // 1년 미만 입사자의 촉진일은 다음 해에 걸치므로 작년 대장도 함께 본다
    Promise.all([ledgerAPI.get(y).catch(() => null), ledgerAPI.get(y - 1).catch(() => null)])
      .then(([a, b]) => {
        const seen = new Set<string>()
        const rows: LedgerRow[] = []
        for (const res of [a, b]) {
          for (const r of res?.rows ?? []) {
            const k = `${r.staff_id}-${r.promotion?.basis}-${r.promotion?.expire_on}`
            if (r.promotion && !seen.has(k)) { seen.add(k); rows.push(r) }
          }
        }
        setPromoRows(rows)
      })
  }, [canPromo, y])

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
      const [ev, iv, lc, rn, dc, ed] = await Promise.all([
        scheduleAPI.events({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as ScheduleEvent[]),
        recruitmentAPI.interviews({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as Interview[]),
        scheduleAPI.lifecycle({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as LifecycleEvent[]),
        scheduleAPI.renewals({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as RenewalEvent[]),
        scheduleAPI.docEvents({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as DocCalEvent[]),
        scheduleAPI.eduEvents({ start_date: rangeStart, end_date: rangeEnd }).catch(() => [] as EduCalEvent[]),
      ])
      setEvents(ev); setInterviews(iv); setLifecycles(lc); setRenewals(rn); setDocs(dc); setEdus(ed)
    } finally { setLoading(false) }
  }, [rangeStart, rangeEnd])
  useEffect(() => { load() }, [load])

  const unified: UEvent[] = useMemo(() => {
    const out: UEvent[] = []

    // 어르신 생신·직원 생일 — 매년 반복, 시간 없는 종일 항목
    for (const b of birthdaysInRange(residents, rangeStart, rangeEnd, 'resident')) {
      out.push({
        key: b.key, kind: 'lifecycle', category: '생신',
        title: `${b.name} 어르신 생신 (${b.age}세)`,
        start: `${b.dateKey}T00:00`, dateKey: b.dateKey, time: '',
        memo: '생신 축하 준비 — 보호자 연락·생신상', raw: b as any,
      })
    }
    // 연차촉진 — 회계연도(1년 이상)는 하나로 묶고, 1년 미만은 개인별로
    if (canPromo && promoRows.length > 0) {
      const inRange = (d: string) => d >= rangeStart && d <= rangeEnd
      const fiscal = promoRows.filter(r => r.promotion!.basis === 'fiscal' && r.remaining > 0)
      const f = fiscal[0]?.promotion
      if (f && inRange(f.first_notice[0])) {
        out.push({
          key: `promo-f1-${f.first_notice[0]}`, kind: 'lifecycle', category: '연차촉진',
          title: `연차촉진 1차 서면 통지 시작 (1년 이상 ${fiscal.length}명) — ${f.first_notice[1].slice(5).replace('-', '/')}까지`,
          start: `${f.first_notice[0]}T00:00`, dateKey: f.first_notice[0], time: '',
          memo: '근로기준법 61조 — 미사용 연차를 서면으로 개별 촉구 (일괄 공지는 효력 없음)', raw: {} as any,
        })
      }
      if (f && inRange(f.second_deadline)) {
        out.push({
          key: `promo-f2-${f.second_deadline}`, kind: 'lifecycle', category: '연차촉진',
          title: `연차촉진 2차 지정 통보 기한 (1년 이상 ${fiscal.length}명)`,
          start: `${f.second_deadline}T00:00`, dateKey: f.second_deadline, time: '',
          memo: '직원이 사용 시기를 안 정했으면 회사가 사용일을 지정해 서면 통보', raw: {} as any,
        })
      }
      for (const r of promoRows.filter(r => r.promotion!.basis === 'hire')) {
        const p = r.promotion!
        if (inRange(p.first_notice[0])) {
          out.push({
            key: `promo-h1-${r.staff_id}`, kind: 'lifecycle', category: '연차촉진',
            title: `${r.name} 연차촉진 1차 통지 (입사 1년 기준) — ${p.first_notice[1].slice(5).replace('-', '/')}까지`,
            start: `${p.first_notice[0]}T00:00`, dateKey: p.first_notice[0], time: '',
            memo: `1년 미만 월차 — 소멸일 ${p.expire_on}. 서면·개별 촉구`, raw: {} as any,
          })
        }
        if (inRange(p.second_deadline)) {
          out.push({
            key: `promo-h2-${r.staff_id}`, kind: 'lifecycle', category: '연차촉진',
            title: `${r.name} 연차촉진 2차 지정 통보 기한`,
            start: `${p.second_deadline}T00:00`, dateKey: p.second_deadline, time: '',
            memo: `소멸일 ${p.expire_on} — 사용일 지정 서면 통보`, raw: {} as any,
          })
        }
      }
    }

    for (const b of birthdaysInRange(staffList, rangeStart, rangeEnd, 'staff')) {
      out.push({
        key: b.key, kind: 'lifecycle', category: '생일',
        title: `${b.name} 선생님 생일`,
        start: `${b.dateKey}T00:00`, dateKey: b.dateKey, time: '',
        memo: null, raw: b as any,
      })
    }
    for (const e of events) {
      const cat = (SCHEDULE_CATEGORIES as readonly string[]).includes(e.category) ? (e.category as CatKey) : '기타'
      if (!e.start_at) continue
      out.push({
        key: `e-${e.id}`, kind: 'event', category: cat, title: e.title,
        // 규약: 00:00에 저장된 일정은 '시간 미정' — 자정에 시작하는 일정은 현실적으로 없다
        start: e.start_at, dateKey: ymd(new Date(e.start_at)),
        time: hmOf(e.start_at) === '00:00' ? '미정' : hmOf(e.start_at),
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
      const lt = l.kind === 'admission' && l.time ? l.time : ''   // 입소 예정 시간(미정이면 빈 값)
      out.push({
        key: `l-${l.kind}-${l.id}`, kind: 'lifecycle', category: cat,
        title: `${label} · ${l.name}${l.kind === 'admission' && l.status === 'pending' && !l.time ? ' (시간 미정)' : ''}`,
        start: `${l.date}T${lt || '00:00'}`, dateKey: l.date, time: lt,
        location: null, contactName: l.name, contactPhone: null, memo: null, raw: l as any,
      })
    }
    for (const rn of renewals) {
      if (!rn.date) continue
      out.push({
        key: `r-${rn.id}`, kind: 'lifecycle', category: '재계약',
        title: `재계약 · ${rn.name ?? ''}${rn.position ? ` (${rn.position})` : ''}`,
        start: `${rn.date}T00:00`, dateKey: rn.date, time: '',
        location: null, contactName: rn.name ?? null, contactPhone: null, memo: null, raw: rn as any,
      })
    }
    for (const dc of docs) {
      if (!dc.date) continue
      const dcat: CatKey = dc.doc_type === 'contract' ? '계약서' : dc.doc_type === 'plan' ? '계획서' : '평가'
      out.push({
        key: `d-${dc.id}`, kind: 'lifecycle', category: dcat,
        title: `${dc.doc_label} · ${dc.name ?? ''}${dc.kind ? ` (${dc.kind})` : ''}`,
        start: `${dc.date}T00:00`, dateKey: dc.date, time: '',
        location: null, contactName: dc.name ?? null, contactPhone: null, memo: dc.memo ?? null, raw: dc as any,
      })
    }
    for (const ed of edus) {
      if (!ed.date) continue
      out.push({
        key: `edu-${ed.id}`, kind: 'lifecycle', category: '교육',
        title: `${ed.done ? '✓ ' : ''}교육 · ${ed.title}`,
        start: `${ed.date}T00:00`, dateKey: ed.date, time: '',
        location: ed.org ?? null, contactName: null, contactPhone: null,
        memo: ed.eval_no ?? null, raw: ed as any,
      })
    }
    return out.sort((a, b) => (a.start! < b.start! ? -1 : 1))
  }, [events, interviews, lifecycles, renewals, docs, edus, residents, staffList, rangeStart, rangeEnd, canPromo, promoRows])

  const shown = useMemo(() => unified.filter(u => visibleCats.has(u.category) && active.has(u.category)), [unified, active, visibleCats])

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

  const agendaRef = useRef<HTMLDivElement>(null)
  const todayKey = ymd(new Date())
  const firstUpcoming = useMemo(() => groups.find(([dk]) => dk >= todayKey)?.[0], [groups, todayKey])
  useEffect(() => {
    if (view !== 'agenda' || loading || groups.length === 0) return
    const t = setTimeout(() => {
      const root = agendaRef.current
      if (!root) return
      const el = root.querySelector<HTMLElement>(`[data-day="${todayKey}"]`)
        ?? root.querySelector<HTMLElement>('[data-upcoming="1"]')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => clearTimeout(t)
  }, [view, loading, groups, todayKey])
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
          {canVisit && (
            <button onClick={() => setVisitOpen(true)}
              className={`ml-1 relative px-3 py-1.5 text-xs font-semibold rounded-lg border ${visitPending > 0 ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              면회 예약
              {visitPending > 0 && <span className="ml-1 text-[10px] font-extrabold bg-yellow-500 text-white rounded-full px-1.5 py-0.5">{visitPending}</span>}
            </button>
          )}
        </div>
      </div>

      {/* 범례/필터 (건수 포함) — 전체 토글, 더블클릭=이 분류만 */}
      {(() => {
        const cats = ALL_CATS.filter(c => visibleCats.has(c))
        const onCount = cats.filter(c => active.has(c)).length
        const allOn = onCount === cats.length
        return (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <button onClick={() => setActive(allOn ? new Set() : new Set(cats))}
              title={allOn ? '모든 분류 숨기기' : '모든 분류 보기'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                allOn ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
              {allOn ? '전체 끄기' : `전체 켜기${onCount > 0 ? ` (${onCount}/${cats.length})` : ''}`}
            </button>
            <span className="w-px h-5 bg-gray-200 mx-0.5" />
            {cats.map(c => {
              const on = active.has(c)
              const n = catCounts[c] ?? 0
              return (
                <button key={c} onClick={() => toggleCat(c)}
                  onDoubleClick={() => setActive(new Set([c]))}
                  title="클릭: 켜기/끄기 · 더블클릭: 이 분류만 보기"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${on ? CAT[c].chip : 'bg-white text-gray-300 border-gray-100'}`}>
                  <span className={`w-2 h-2 rounded-full ${on ? CAT[c].dot : 'bg-gray-200'}`} />
                  {c}{n > 0 && <span className="opacity-70">{n}</span>}
                </button>
              )
            })}
          </div>
        )
      })()}

      {visitOpen && (
        <VisitInboxPanel onClose={() => setVisitOpen(false)}
          onDecided={() => { loadVisitCount(); load() }} />
      )}

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
        <div className="space-y-4" ref={agendaRef}>
          {groups.map(([dk, items]) => {
            const d = new Date(dk + 'T00:00:00')
            const rb = relBadge(dk)
            const dow = d.getDay()
            return (
              <div key={dk} data-day={dk} data-upcoming={dk === firstUpcoming ? '1' : undefined} className="scroll-mt-24">
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
      {editEvent && <AddModal presetDate={null} editing={editEvent} onClose={() => setEditEvent(null)} onSaved={() => { setEditEvent(null); load() }} />}
      {detail && <DetailModal ev={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); load() }} onGoRecruit={() => navigate('/recruitment')} onEdit={(e) => { setDetail(null); setEditEvent(e) }} />}
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
function AddModal({ presetDate, editing, onClose, onSaved }: { presetDate: string | null; editing?: ScheduleEvent | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing
  const eStart = editing?.start_at ? new Date(editing.start_at) : null
  const [category, setCategory] = useState<string>(editing?.category ?? '방문상담')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(() => (eStart ? ymd(eStart) : presetDate ?? ymd(new Date())))
  // 시간 미정: 00:00으로 저장하는 규약 (연락 대기 중인 방문 상담 등)
  const [noTime, setNoTime] = useState(() => !!eStart && hmOf(editing!.start_at!) === '00:00')
  const [time, setTime] = useState(eStart && hmOf(editing!.start_at!) !== '00:00' ? hmOf(editing!.start_at!) : '10:00')
  const [durMin, setDurMin] = useState<number | null>(() => {
    if (editing?.start_at && editing?.end_at) {
      const d = (new Date(editing.end_at).getTime() - new Date(editing.start_at).getTime()) / 60000
      return d > 0 ? d : null
    }
    return editing ? null : 60
  })
  // 귀원 일시 — 외출은 당일이라 시간만, 외박은 날짜+시간 (end_at에 저장)
  const isOuting = category === '외출' || category === '외박'
  const [returnDate, setReturnDate] = useState(() =>
    editing?.end_at && editing.category === '외박' ? ymd(new Date(editing.end_at)) : '')
  const [returnTime, setReturnTime] = useState(() =>
    editing?.end_at && ['외출', '외박'].includes(editing.category) ? hmOf(editing.end_at) : '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [contactName, setContactName] = useState(editing?.contact_name ?? '')
  const [contactPhone, setContactPhone] = useState(editing?.contact_phone ?? '')
  const [memo, setMemo] = useState(editing?.memo ?? '')
  // 외출·외박/외래 안내는 가족 단톡에 공유하는 경우가 많다 — 공지로도 만들어 카톡 템플릿 공유
  const NOTICE_CATS = ['외출', '외박', '외래·병원', '면회', '외부방문', '행사']
  const noticeCat = NOTICE_CATS.includes(category)
  const hasNotice = !!editing?.notice_id
  const [makeNotice, setMakeNotice] = useState(false)
  useEffect(() => {
    // 분류를 외출·외박/외래로 고르면 기본 켬 (수정 중 + 이미 공지 연결이면 항상 유지)
    setMakeNotice(hasNotice || ['외출', '외박', '외래·병원'].includes(category))
  }, [category, hasNotice])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const start_at = noTime ? `${date}T00:00` : `${date}T${time}`
  const returnAt = category === '외출'
    ? (returnTime ? `${date}T${returnTime}` : null)                          // 외출 = 당일 귀원
    : category === '외박'
      ? (returnDate ? `${returnDate}T${returnTime || '12:00'}` : null)       // 외박 = 다른 날 귀원
      : null
  // 외출·외박은 귀원(지정 안 함이면 없음)만, 그 외 분류는 소요 시간으로 종료 계산
  const endPreview = isOuting ? returnAt : (!noTime && durMin ? addMinutes(date, time, durMin) : null)
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
        make_notice: noticeCat && makeNotice,
      }
      const saved = isEdit ? await scheduleAPI.updateEvent(editing!.id, body)
        : await scheduleAPI.createEvent(body)
      onSaved()
      // 공지가 연결됐으면 바로 카톡 공유 제안 — 등록하고 공유하러 찾아가는 수고를 줄인다
      const nid = (saved as any)?.notice_id
      if (nid && isKakaoShareEnabled() && confirm(isEdit
        ? '연결된 공지도 최신 내용으로 바뀌었습니다. 카카오톡으로 다시 공유할까요?'
        : '공개 공지가 만들어졌습니다. 지금 카카오톡으로 공유할까요?')) {
        try {
          // 텍스트 공유(200자) — 그림 카드보다 단톡방에서 읽기 빠르다. 핵심만 줄줄이.
          const [yy, mm, dd] = date.split('-').map(Number)
          const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(yy, mm - 1, dd).getDay()]
          const lines = [
            `[${category}] ${mm}/${dd}(${w})${noTime ? '' : ` ${time}`}`,
            title.trim(),
          ]
          if (returnAt) {
            if (category === '외출') {
              lines.push(`귀원: 당일 ${returnTime}`)
            } else {
              const [ry, rm, rd] = returnDate.split('-').map(Number)
              const rw = ['일', '월', '화', '수', '목', '금', '토'][new Date(ry, rm - 1, rd).getDay()]
              lines.push(`귀원: ${rm}/${rd}(${rw}) ${returnTime || '12:00'}`)
            }
          }
          if (location) lines.push(`장소: ${location}`)
          if (contactName) lines.push(`연락처: ${contactName}${contactPhone ? ` (${contactPhone})` : ''}`)
          if (memo) lines.push(memo.trim())
          lines.push('— 행복한요양원')
          await shareText(lines.join('\n'), `${PUBLIC_WEB}/notice/${nid}`)
        } catch (e: any) { alert(e?.message ?? '카카오 공유는 모바일 카카오톡에서 시도해주세요.') }
      }
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? '일정 수정' : '일정 추가'} onClose={onClose}>
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

        {noticeCat && (
          <label className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 cursor-pointer">
            <input type="checkbox" checked={makeNotice} onChange={e => setMakeNotice(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-amber-600" disabled={hasNotice} />
            <span className="text-xs text-gray-600 leading-relaxed">
              <b className="text-amber-700">공개 공지로도 등록 — 카카오톡 공유용</b><br />
              {hasNotice
                ? '이 일정에는 이미 공지가 연결돼 있어요. 저장하면 공지도 최신 내용으로 바뀝니다.'
                : '일시·장소가 템플릿에 맞춰 공지로 만들어지고, 링크로 가족 단톡에 공유할 수 있어요. 일정을 나중에 고치면 공지도 같이 바뀝니다.'}
            </span>
          </label>
        )}

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
          <DateField value={date} onChange={v => setDate(v)} className="inp" clearable={false} />
        </div>

        {/* 시작 시간 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-500">시작 시간</label>
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={noTime} onChange={e => setNoTime(e.target.checked)} className="accent-violet-600" />
              시간 미정 <span className="text-[10px] text-gray-400">(정해지면 나중에 수정)</span>
            </label>
          </div>
          {noTime ? (
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
              시간을 정하지 않고 등록합니다 — 달력에는 <b className="text-gray-500">미정</b>으로 표시되고 그날 맨 위에 옵니다.
            </p>
          ) : (<>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_TIMES.map(t => (
              <button key={t} onClick={() => setTime(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${time === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300'}`}>{t}</button>
            ))}
          </div>
          <select value={time} onChange={e => setTime(e.target.value)} className="inp">
            {TIME_SLOTS.map(t => <option key={t} value={t}>{timeLabel(t)}</option>)}
          </select>
          </>)}
        </div>

        {/* 소요 시간 — 시간 미정이면 의미 없음. 외출·외박은 귀원 시간이 그 역할이라 숨긴다 */}
        {!noTime && !isOuting && (
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
        )}

        <Field label="장소 (선택)"><input value={location} onChange={e => setLocation(e.target.value)} placeholder="예: 시설 1층 상담실" className="inp" /></Field>
        {/* 귀원 — 외출은 당일 시간만, 외박은 날짜+시간. 자주 쓰는 시간은 칩으로 바로. */}
        {isOuting && (
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              {category === '외출' ? '귀원 시간 (선택) — 당일 몇 시에 돌아오시는지' : '귀원 일시 (선택) — 언제 돌아오시는지'}
              {returnTime && (category === '외출' || returnDate) && (
                <span className="ml-1.5 text-green-700 font-bold">
                  → {category === '외출' ? '당일' : `${Number(returnDate.slice(5, 7))}/${Number(returnDate.slice(8, 10))}`} {returnTime} 귀원
                </span>
              )}
            </label>
            {category === '외박' && (
              <DateField value={returnDate} onChange={v => setReturnDate(v)} className="inp mb-2" />
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button onClick={() => setReturnTime('')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  !returnTime ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>지정 안 함</button>
              {['11:00', '12:00', '15:00', '17:00', '19:00'].map(t => (
                <button key={t} onClick={() => setReturnTime(returnTime === t ? '' : t)}
                  disabled={category === '외박' && !returnDate}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 ${
                    returnTime === t ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'}`}>{t}</button>
              ))}
            </div>
            <select value={returnTime} onChange={e => setReturnTime(e.target.value)}
              disabled={category === '외박' && !returnDate} className="inp disabled:opacity-40">
              <option value="">다른 시간 선택 (30분 단위)</option>
              {RETURN_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {category === '외박' && !returnDate && (
              <p className="text-[11px] text-amber-600 mt-1">귀원 날짜를 먼저 고르면 시간을 선택할 수 있어요 — 적어두면 공지·카톡에도 안내됩니다.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="연락처 이름 (선택) — 어르신 상태를 잘 아는 분"><input value={contactName} onChange={e => setContactName(e.target.value)} className="inp" /></Field>
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
function DetailModal({ ev, onClose, onChanged, onGoRecruit, onEdit }: { ev: UEvent; onClose: () => void; onChanged: () => void; onGoRecruit: () => void; onEdit: (e: ScheduleEvent) => void }) {
  const [busy, setBusy] = useState(false)
  const isEvent = ev.kind === 'event'
  const isInterview = ev.kind === 'interview'

  // 면접 시간·장소 인라인 편집
  const ivRaw = isInterview ? (ev.raw as Interview) : null
  const [editIv, setEditIv] = useState(false)
  const [ivDate, setIvDate] = useState(ev.dateKey)
  const [ivTime, setIvTime] = useState(ev.time || '10:00')
  const [ivLoc, setIvLoc] = useState(ivRaw?.location ?? '')
  const [ivNote, setIvNote] = useState(ivRaw?.note ?? '')
  const [ivErr, setIvErr] = useState('')

  const del = async () => {
    if (!isEvent) return
    if (!confirm('이 일정을 삭제할까요?')) return
    setBusy(true)
    try { await scheduleAPI.deleteEvent((ev.raw as ScheduleEvent).id); onChanged() } finally { setBusy(false) }
  }

  const saveIv = async () => {
    if (!ivRaw) return
    if (!ivDate || !ivTime) { setIvErr('날짜와 시간을 입력해주세요.'); return }
    setBusy(true); setIvErr('')
    try {
      await recruitmentAPI.updateInterview(ivRaw.id, {
        interview_at: `${ivDate}T${ivTime}:00`,
        location: ivLoc.trim() || null,
        note: ivNote.trim() || null,
      })
      onChanged()
    } catch (e: any) { setIvErr(e?.message ?? '저장 실패'); setBusy(false) }
  }

  return (
    <Modal title={isInterview && editIv ? '면접 일정 수정' : '일정 상세'} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${CAT[ev.category].chip}`}>{ev.category}</span>
          <p className="text-base font-bold text-gray-900">{ev.title}</p>
        </div>

        {isInterview && editIv ? (
          /* ── 면접 시간·장소 수정 폼 ── */
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">면접 날짜</label>
              <DateField value={ivDate} onChange={setIvDate} className="inp" clearable={false} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">면접 시간</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_TIMES.map(t => (
                  <button key={t} onClick={() => setIvTime(t)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${ivTime === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300'}`}>{t}</button>
                ))}
              </div>
              <input type="time" value={ivTime} onChange={e => setIvTime(e.target.value)}
                className="inp w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">장소</label>
              <input value={ivLoc} onChange={e => setIvLoc(e.target.value)}
                className="inp w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="예: 1층 상담실" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">메모</label>
              <textarea rows={2} value={ivNote} onChange={e => setIvNote(e.target.value)}
                className="inp w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />
            </div>
            {ivErr && <p className="text-xs text-red-500">{ivErr}</p>}
            <p className="text-[11px] text-gray-400">지원자 이름·상태·합격 결과 등은 채용 관리에서 수정합니다.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 text-sm text-gray-600">
              <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> {ev.dateKey}{ev.time ? ` ${ev.time}` : ""}</p>
              {ev.location && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> {ev.location}</p>}
              {ev.contactPhone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> {ev.contactName ? `${ev.contactName} · ` : ''}{ev.contactPhone}</p>}
              {ev.memo && <p className="text-gray-500 bg-gray-50 rounded-lg p-2.5 whitespace-pre-wrap">{ev.memo}</p>}
              {/* 등록자 — ADMIN에게만 */}
              {useAuthStore.getState().user?.role === 'ADMIN' && ev.kind === 'event' && (ev.raw as any)?.created_by && (
                <p className="text-[11px] text-gray-400">등록: {(ev.raw as any).created_by}</p>
              )}
            </div>
            {isInterview && (
              <div className="bg-violet-50 rounded-lg p-3 text-xs text-violet-700 flex items-start gap-2">
                <Briefcase className="w-4 h-4 shrink-0 mt-0.5" />
                <span>채용 면접 일정입니다. 시간·장소는 여기서, 상태·결과·통보는 채용 관리에서 관리하세요.</span>
              </div>
            )}
          </>
        )}
        {ev.kind === 'lifecycle' && (
          (['계약서', '계획서', '평가'] as CatKey[]).includes(ev.category) ? (
            <div className="rounded-lg p-3 text-xs flex items-start gap-2 bg-emerald-50 text-emerald-700">
              <ClipboardList className="w-4 h-4 shrink-0 mt-0.5" />
              <span>어르신 {ev.category} 예정일입니다. 어르신 서류현황에서 관리됩니다.</span>
            </div>
          ) : (
          <div className={`rounded-lg p-3 text-xs flex items-start gap-2 ${ev.category === '입소' ? 'bg-rose-50 text-rose-600' : ev.category === '재계약' ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-700'}`}>
            <UserPlus className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{ev.category === '입소' ? '수급자 입소일입니다. 입소 정보는 수급자 관리에서 관리됩니다.'
              : ev.category === '재계약' ? '직원 재계약 예정일입니다. 근로계약·서류에서 관리됩니다.'
              : '직원 입사일입니다. 입사 정보는 직원 관리에서 관리됩니다.'}</span>
          </div>
          )
        )}
      </div>
      <ModalFooter>
        {isEvent && (ev.raw as ScheduleEvent).can_edit && (
          <>
            <button onClick={() => onEdit(ev.raw as ScheduleEvent)} className="px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg inline-flex items-center gap-1.5">
              <Pencil className="w-4 h-4" /> 수정
            </button>
            <button onClick={del} disabled={busy} className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> 삭제
            </button>
          </>
        )}
        {isEvent && !(ev.raw as ScheduleEvent).can_edit && (
          <span className="px-2 text-[11px] text-gray-400">본인이 등록한 일정만 수정·삭제할 수 있습니다</span>
        )}
        {isInterview && editIv && (
          <>
            <button onClick={() => { setEditIv(false); setIvErr('') }} disabled={busy}
              className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50">취소</button>
            <button onClick={saveIv} disabled={busy}
              className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} 저장
            </button>
          </>
        )}
        {isInterview && !editIv && (
          <>
            <button onClick={() => setEditIv(true)} className="px-4 py-2 text-sm font-semibold text-violet-600 hover:bg-violet-50 rounded-lg inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> 시간·장소 수정
            </button>
            <button onClick={onGoRecruit} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg inline-flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" /> 채용 관리
            </button>
          </>
        )}
        {!editIv && (
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-lg">닫기</button>
        )}
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
