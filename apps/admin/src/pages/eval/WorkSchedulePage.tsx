import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Save, Eraser, Loader2, CalendarDays, Wand2, Users, AlertTriangle, History, Sparkles, CheckCircle2 } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { workScheduleAPI, type ScheduleData, type ScheduleRow, type HolidayInfo } from '@/api/workScheduleClient'
import { calcBase, DAILY_HOURS } from '@/utils/baseHours'
import ScheduleHistoryModal from '@/components/schedule/ScheduleHistoryModal'
import { planDayShift, interleaveByPosition } from '@/utils/dayShiftPlan'
import { planMembersMonths, type MonthContext, type MemberMonthPlan } from '@/utils/shiftBalance'
import { calcBase as calcBaseFor } from '@/utils/baseHours'
import { SHIFT_CODES, CODE_MAP, hoursOf, extraHoursOf, countAsOf, meta, isAutoManaged, splitTimeRange, shortOf, TEAMS, DAY_TEAM, DEFAULT_TEAM_OFFSET, ROTATION, rotationFor, rotationPreview } from '@/utils/shiftCodes'
import { auditSchedule, type Issue } from '@/utils/scheduleAudit'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const todayISO = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }


/** 직종 표시 순서 — 편성표 양식과 동일 */
const POS_ORDER = ['시설장', '사회복지사', '간호사', '간호조무사', '요양보호사', '조리원', '위생원', '사무원']
/** 시간 정산을 시작하는 달 — 이 달부터 잔고를 쌓아 이월한다 */
const SETTLE_START = '2026-07'

/** 교대(주주야야휴휴)를 도는 직종 — 나머지는 모두 주간 근무다 */
const SHIFT_POSITION = '요양보호사'
const canJoinTeam = (pos?: string | null) => (pos ?? '').includes(SHIFT_POSITION)

const posRank = (p?: string | null) => { const i = POS_ORDER.indexOf(p ?? ''); return i < 0 ? POS_ORDER.length : i }

/** 조별 색 띠 — 표에서 조 경계를 눈으로 잡기 위한 것 */
const TEAM_BAND: Record<string, string> = {
  'A조': 'bg-rose-400', 'B조': 'bg-sky-400', 'C조': 'bg-emerald-400',
  'D조': 'bg-violet-400', 'E조': 'bg-amber-400', 'F조': 'bg-teal-400', '주간': 'bg-gray-300',
}

export default function WorkSchedulePage() {
  const { staffList, loaded, loadAll } = useLtcStore()
  const [ym, setYm] = useState(thisMonth())
  const [data, setData] = useState<ScheduleData>({})
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [baseHours, setBaseHours] = useState('')
  const [baseDays, setBaseDays] = useState('')
  const [asOf, setAsOf] = useState(todayISO())
  const [brush, setBrush] = useState<string>('D')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)
  const [teamOpen, setTeamOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(true)
  const [histOpen, setHistOpen] = useState(false)
  const [building, setBuilding] = useState(false)
  // 인쇄는 '집계 열 없이'가 기본이다. 총시간·초과휴 같은 숫자가 벽에 붙으면
  // '왜 저 사람은 나보다 많지?' 같은 오해가 생긴다.
  // 브라우저 인쇄(Ctrl+P)로 바로 뽑아도 빠지도록 CSS로 처리하고,
  // 결재·보관이 필요할 때만 '관리용' 버튼으로 되살린다.
  const [fullPrint, setFullPrint] = useState(false)
  const [wantPrint, setWantPrint] = useState(false)
  const [rowsFrom, setRowsFrom] = useState<string | null>(null)
  // 남은 잔고를 수당으로 줄 때 얼마인지 — 시설마다 달라 입력받는다
  const [wage, setWage] = useState<string>(() => localStorage.getItem('ws.wage') ?? '')
  const [rate, setRate] = useState<string>(() => localStorage.getItem('ws.rate') ?? '1.5')
  useEffect(() => { localStorage.setItem('ws.wage', wage) }, [wage])
  useEffect(() => { localStorage.setItem('ws.rate', rate) }, [rate])
  const [lastPlans, setLastPlans] = useState<MemberMonthPlan[]>([])
  const [minStaff, setMinStaff] = useState(4)          // 하루 최소 근무 인원
  const [focus, setFocus] = useState<{ staffId?: string; day?: number } | null>(null)
  const [sel, setSel] = useState<{ si: number; di: number } | null>(null)   // 키보드 선택 칸
  const [holidays, setHolidays] = useState<Record<string, HolidayInfo>>({})
  const [autoBase, setAutoBase] = useState(true)          // 기준시간 자동 계산
  const [exclLabor, setExclLabor] = useState(true)        // 근로자의 날을 근무일에서 제외
  const [offsets, setOffsets] = useState<Record<string, number>>(DEFAULT_TEAM_OFFSET)
  const painting = useRef(false)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  /**
   * 월을 바꿀 때마다 요청에 번호를 매긴다.
   *
   * 번호가 없으면 이런 일이 생긴다: 7월을 불러오는 중에 8월로 넘기면 두 요청이 함께 뜨고,
   * 7월 응답이 늦게 도착하면 8월 화면 위에 7월 데이터가 덮어써진다.
   * 제목만 8월이고 표는 7월인 상태가 되어, 그대로 인쇄하면 7월 근무표가 나온다.
   */
  const loadSeq = useRef(0)

  useEffect(() => {
    const seq = ++loadSeq.current
    setLoading(true)
    workScheduleAPI.get(ym)
      .then(doc => {
        if (seq !== loadSeq.current) return          // 더 최신 요청이 있으면 이 응답은 버린다
        setData(doc.data || {}); setRows(doc.rows || [])
        setRowsFrom(doc.rows_from ?? null)
        // 저장된 기준시간이 있으면 그 값을 쓰고(수동), 없으면 자동 계산에 맡긴다.
        // 예전에는 여기서 '160'을 넣어 자동 계산값을 덮어썼다.
        const saved = doc.base_hours && doc.base_hours.trim()
        setAutoBase(!saved)
        if (saved) { setBaseHours(doc.base_hours!); setBaseDays(doc.base_days || '') }
        setAsOf(doc.as_of || todayISO())
        setOffsets({ ...DEFAULT_TEAM_OFFSET, ...(doc.team_offsets || {}) })
        setUpdatedBy(doc.updated_by ?? null); setDirty(false)
      })
      .catch(() => {
        if (seq !== loadSeq.current) return
        setData({}); setRows([]); setUpdatedBy(null)
      })
      .finally(() => { if (seq === loadSeq.current) setLoading(false) })
  }, [ym])

  const holSeq = useRef(0)
  useEffect(() => {
    const seq = ++holSeq.current
    workScheduleAPI.holidays(ym)
      .then(h => { if (seq === holSeq.current) setHolidays(h) })
      .catch(() => { if (seq === holSeq.current) setHolidays({}) })
  }, [ym])

  useEffect(() => {
    const after = () => setFullPrint(false)
    window.addEventListener('afterprint', after)
    return () => window.removeEventListener('afterprint', after)
  }, [])

  /**
   * 인쇄는 '화면이 실제로 그려진 뒤'에 띄운다.
   *
   * 주의: 여기서 setWantPrint(false)를 먼저 부르면 의존성이 바뀌어 정리 함수가 돌고,
   * 예약해 둔 requestAnimationFrame이 취소되어 인쇄가 안 되거나 이전 화면이 찍힌다.
   * 그래서 상태 초기화는 print()를 부른 다음에 한다.
   * 또 월을 막 바꿔 아직 불러오는 중이면 빈 표나 지난달 화면이 찍히므로 기다린다.
   */
  useEffect(() => {
    if (!wantPrint || loading) return
    const id = requestAnimationFrame(() => {
      window.print()
      setWantPrint(false)
    })
    return () => cancelAnimationFrame(id)
  }, [wantPrint, fullPrint, loading, ym])

  const printAs = (full: boolean) => {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 저장한 내용이 아닌 현재 화면 그대로 인쇄됩니다.\n계속할까요?')) return
    setFullPrint(full); setWantPrint(true)
  }

  useEffect(() => {
    const up = () => { painting.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const [y, m] = ym.split('-').map(Number)
  const days = useMemo(() => {
    const n = new Date(y, m, 0).getDate()
    return Array.from({ length: n }, (_, i) => ({ day: i + 1, dow: new Date(y, m - 1, i + 1).getDay() }))
  }, [y, m])

  const todayCol = useMemo(() => {
    const t = new Date()
    return (t.getFullYear() === y && t.getMonth() + 1 === m) ? t.getDate() : -1
  }, [y, m])

  const iso = (day: number) => `${ym}-${String(day).padStart(2, '0')}`
  /** 토요일=파랑, 일요일·공휴일=빨강 */
  const dayTone = (day: number, dow: number) => {
    const h = holidays[iso(day)]
    if (h && h.kind === 'paid') return 'paid'      // 근로자의 날 — 빨간날은 아니지만 쉬는 날
    if (dow === 0 || h) return 'red'
    if (dow === 6) return 'blue'
    return 'none' as const
  }

  /** 월 기준시간 = (토·일·공휴일 제외 일수) × 8시간 */
  const base = useMemo(() => calcBase(ym, holidays, exclLabor), [ym, holidays, exclLabor])
  useEffect(() => {
    if (!autoBase || loading) return          // 불러오기가 끝난 뒤에만 반영
    setBaseHours(String(base.hours)); setBaseDays(String(base.workdays))
  }, [autoBase, loading, base.hours, base.workdays])

  const rowMap = useMemo(() => new Map(rows.map(r => [r.staff_id, r])), [rows])

  /** 표에 실을 직원 — 저장된 행 정보(직종·조)를 얹어 정렬 */
  const staff = useMemo(() => staffList
    .filter(s => s.status === 'active')
    .map(s => {
      const r = rowMap.get(s.id)
      return { ...s, team: r?.team ?? '', note: r?.note ?? '', pos: r?.position ?? s.position ?? '' }
    })
    .sort((a, b) =>
      posRank(a.pos) - posRank(b.pos) ||
      (a.team ?? '').localeCompare(b.team ?? '') ||
      a.name.localeCompare(b.name)),
    [staffList, rowMap])

  const setCell = (sid: string, day: number, code: string) => {
    setData(prev => {
      const row = { ...(prev[sid] ?? {}) }
      if (!code) delete row[String(day)]; else row[String(day)] = code
      return { ...prev, [sid]: row }
    })
    setDirty(true)
  }
  const patchRow = (sid: string, p: Partial<ScheduleRow>) => {
    setRows(prev => {
      const i = prev.findIndex(r => r.staff_id === sid)
      if (i < 0) return [...prev, { staff_id: sid, ...p }]
      return prev.map((r, ri) => ri === i ? { ...r, ...p } : r)
    })
    setDirty(true)
  }

  /** 주주야야휴휴 자동 편성 — 조가 지정된 직원만 채운다 */
  const autoRotate = (overwrite: boolean) => {
    const targets = staff.filter(s => canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? ''))
    if (targets.length === 0) { alert('먼저 요양보호사에게 조를 지정해주세요.\n(요양보호사만 교대조를 돌 수 있습니다)'); return }
    let filled = 0
    setData(prev => {
      const next = { ...prev }
      targets.forEach(s => {
        const row = { ...(next[s.id] ?? {}) }
        days.forEach(({ day }) => {
          if (!overwrite && !isAutoManaged(row[String(day)])) return   // 연차·병가만 보존
          const code = rotationFor(s.team, day, offsets)
          if (code) row[String(day)] = code
          else delete row[String(day)]                 // 휴휴 자리는 공란으로 비운다
          filled++
        })
        next[s.id] = row
      })
      return next
    })
    setDirty(true)
    alert(`${targets.length}명 · ${filled}칸을 주주야야휴휴로 채웠습니다.\n${overwrite ? '기존 입력을 덮어썼습니다.' : '이미 입력된 칸은 그대로 두었습니다.'}`)
  }

  /**
   * 근무표 한 번에 만들기 — 교대조는 주주야야휴휴, 주간 직원은 기준일수에 맞춰 톱니처럼.
   * 이미 입력된 칸(연차·대휴 등)은 건드리지 않는다.
   */
  /** 정산 시작월부터 이번 달까지의 월 정보 — 잔고를 이어받기 위해 필요 */
  const buildContexts = async (): Promise<{ ctxs: MonthContext[]; saved: Record<string, ScheduleData> }> => {
    const [sy, sm] = SETTLE_START.split('-').map(Number)
    const [ey, em] = ym.split('-').map(Number)
    const list: MonthContext[] = []
    const saved: Record<string, ScheduleData> = {}
    let y = sy, mo = sm
    while (y < ey || (y === ey && mo <= em)) {
      const key = `${y}-${String(mo).padStart(2, '0')}`
      let hs: Record<string, { name: string; kind: string }> = {}
      if (key === ym) hs = holidays
      else {
        // 지난달은 공휴일과 '저장된 근무표'를 함께 가져온다 — 손으로 고친 내용까지 반영하려고
        try { hs = await workScheduleAPI.holidays(key) } catch { hs = {} }
        try { const doc = await workScheduleAPI.get(key); if (doc.data && Object.keys(doc.data).length) saved[key] = doc.data } catch { /* 없으면 시뮬레이션 */ }
      }
      const total = new Date(y, mo, 0).getDate()
      list.push({
        ym: key,
        days: Array.from({ length: total }, (_, i) => ({
          day: i + 1, iso: `${key}-${String(i + 1).padStart(2, '0')}`,
        })),
        baseHours: calcBaseFor(key, hs, exclLabor).hours,
        // 유급휴일(근로자의 날)은 관공서 공휴일이 아니라 대휴 대상에서 제외
        holidays: new Set(Object.entries(hs).filter(([, v]) => v.kind !== 'paid').map(([d]) => d)),
      })
      mo++; if (mo > 12) { mo = 1; y++ }
    }
    return { ctxs: list, saved }
  }

  const autoBuild = async () => {
    const shiftStaff = staff.filter(s => canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? ''))
    const dayStaff = staff.filter(s => !(canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? '')))
    if (shiftStaff.length === 0 && dayStaff.length === 0) { alert('편성할 직원이 없습니다.'); return }

    const target = Number(baseDays) || base.workdays
    const keep = data                       // 기존 입력 보존 판단용
    let shiftCells = 0, dayCells = 0

    // 주간 직원은 직종별로 묶어 순번을 고르게 흩뿌린 뒤 한 번에 편성
    const groups: Record<string, string[]> = {}
    dayStaff.forEach(s => { (groups[s.pos || '기타'] ||= []).push(s.id) })
    const ordered = interleaveByPosition(groups)
    const { plan } = planDayShift({ days: days.map(d => d.day), staffIds: ordered, workDays: target })

    // 교대조 — 정산 시작월부터 이어서 계산해 이번 달 몫을 가져온다
    setBuilding(true)
    const plans: Record<string, MemberMonthPlan> = {}   // staffId → 이번 달 계획
    try {
      const { ctxs, saved } = await buildContexts()
      const teams = Array.from(new Set(shiftStaff.map(s => s.team!).filter(Boolean)))
      teams.forEach(t => {
        const mem = shiftStaff.filter(s => s.team === t)
          .map(s => ({ id: s.id, name: s.name, hireDate: s.hireDate, resignDate: s.resignDate }))
        const series = planMembersMonths(ctxs, t, offsets, mem, saved)
        const cur = series[series.length - 1] ?? []
        cur.forEach(p => { plans[p.memberId] = p })
      })
    } catch (e: any) {
      setBuilding(false); alert(e?.message ?? '정산 계산에 실패했습니다.'); return
    }
    setBuilding(false)
    setLastPlans(Object.values(plans))

    setData(prev => {
      const next = { ...prev }
      shiftStaff.forEach(s => {
        const row = { ...(next[s.id] ?? {}) }
        const mine = plans[s.id]?.codes ?? {}
        days.forEach(({ day }) => {
          // 연차·병가처럼 사람이 넣은 값만 남기고, 정산 결과(D·N·대휴·초과휴)는 다시 만든다
          if (!isAutoManaged(keep[s.id]?.[String(day)])) return
          const code = mine[String(day)]
          if (code) { row[String(day)] = code; shiftCells++ } else delete row[String(day)]
        })
        next[s.id] = row
      })
      dayStaff.forEach(s => {
        const row = { ...(next[s.id] ?? {}) }
        days.forEach(({ day }) => {
          if (!isAutoManaged(keep[s.id]?.[String(day)])) return
          const code = plan[s.id]?.[String(day)]
          if (code) { row[String(day)] = code; dayCells++ } else delete row[String(day)]
        })
        next[s.id] = row
      })
      return next
    })
    setDirty(true)
    const summary = Object.values(plans).map(p =>
      `   ${p.name ?? ''}(${p.team}): ${p.workedHours}h / 기준 ${p.baseHours}h` +
      (p.extraHours > 0 ? ` · 추가근무 ${p.extraHours}h` : '') +
      (p.compDays > 0 ? ` · 초과휴 ${p.compDays}일` : '') +
      ` · 이월 ${p.closing >= 0 ? '+' : ''}${p.closing}h`
    ).join('\n')
    alert(
      `근무표를 만들었습니다.\n\n` +
      `· 교대조 ${shiftStaff.length}명 — 주주야야휴휴 ${shiftCells}칸\n${summary}\n\n` +
      `· 주간 ${dayStaff.length}명 — 1인 ${target}일(${target * DAILY_HOURS}시간) ${dayCells}칸\n\n` +
      `연차·반차·병가·경조사는 그대로 두고 나머지는 새로 계산했습니다.\n아래 점검 결과를 확인한 뒤 저장하세요.`
    )
  }

  /** 직원별 집계 — 총시간 = Σ 근무시간, 갯수는 D/N 칸 수 */
  const calc = (sid: string) => {
    const row = data[sid] ?? {}
    let hours = 0, extra = 0, d = 0, n = 0, annual = 0, off = 0, comp = 0
    days.forEach(({ day }) => {
      const v = row[String(day)]
      if (!v) return
      hours += hoursOf(v)          // 정규 코드 시간만 총시간에 넣는다
      extra += extraHoursOf(v)     // 시간을 직접 적은 칸은 '추가근무'로 분리
      const c = countAsOf(v); if (c === 'D') d++; else if (c === 'N') n++
      const mt = CODE_MAP[v]
      if (mt?.annual) annual++
      if (mt?.offday) off++
      if (mt?.comp) comp++
    })
    const h = Math.round(hours * 10) / 10
    const e = Math.round(extra * 10) / 10
    // 총시간은 추가근무까지 더한 값 — 기준시간과 비교할 때 쓰는 숫자
    return { hours: h, extra: e, total: Math.round((h + e) * 10) / 10, d, n, annual, off, comp }
  }

  /** 일별 근무 인원 (특이사항 행) */
  const dayCount = (day: number) =>
    staff.reduce((acc, s) => acc + (countAsOf(data[s.id]?.[String(day)]) ? 1 : 0), 0)

  const issues: Issue[] = useMemo(() => auditSchedule({
    days, staff: staff.map(s => ({ id: s.id, name: s.name, team: s.team, pos: s.pos })), data,
    baseHours: Number(baseHours) || 160, minStaffPerDay: minStaff,
    maxNightStreak: 2, maxWorkStreak: 5, hoursTolerance: 16,
  }), [days, staff, data, baseHours, minStaff])
  const danger = issues.filter(i => i.level === 'danger').length

  /** 키보드로 편성 — 실무자는 마우스보다 키보드가 빠르다 */
  const onKey = (e: React.KeyboardEvent) => {
    if (!sel) return
    const { si, di } = sel
    const move = (ds: number, dd: number) => {
      e.preventDefault()
      setSel({ si: Math.min(staff.length - 1, Math.max(0, si + ds)), di: Math.min(days.length - 1, Math.max(0, di + dd)) })
    }
    if (e.key === 'ArrowUp') return move(-1, 0)
    if (e.key === 'ArrowDown') return move(1, 0)
    if (e.key === 'ArrowLeft') return move(0, -1)
    if (e.key === 'ArrowRight' || e.key === 'Tab') return move(0, 1)
    const KEY: Record<string, string> = { d: 'D', n: 'N', h: '休', o: '대휴', c: '초과휴', a: 'AD', p: 'PD', b: '반' }
    const code = KEY[e.key.toLowerCase()]
    if (code) { e.preventDefault(); setCell(staff[si].id, days[di].day, code); setSel({ si, di: Math.min(days.length - 1, di + 1) }) }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); setCell(staff[si].id, days[di].day, '') }
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = staff.map((s, i) => ({ staff_id: s.id, position: s.pos, team: s.team, order: i, note: s.note }))
      const doc = await workScheduleAPI.save({ year_month: ym, data, rows: payload, base_hours: baseHours, base_days: baseDays, as_of: asOf, team_offsets: offsets })
      setUpdatedBy(doc.updated_by ?? null); setDirty(false)
    } catch (e: any) { alert(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  const th = 'border border-gray-300 px-1 py-1 text-[10px] font-bold text-gray-600 bg-gray-50 whitespace-nowrap'
  const td = 'border border-gray-200 px-1 py-0.5 text-[11px] text-center whitespace-nowrap'

  return (
    <div className={`p-4 md:p-6 max-w-full ${fullPrint ? 'ws-full' : ''}`}>
      {/* 화면용 도구 — 인쇄 시 숨김 */}
      <div className="print:hidden">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-indigo-600" /></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">근무 편성표</h1>
              <p className="text-xs text-gray-400">{updatedBy ? `최근 저장 ${updatedBy}` : '저장 기록 없음'}{dirty && <span className="text-amber-600 font-semibold"> · 저장 안 됨</span>}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setTeamOpen(v => !v)} className={`inline-flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-semibold ${teamOpen ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Users className="w-4 h-4" /> 조 편성
            </button>
            <button onClick={autoBuild} disabled={building} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm">
              {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 근무표 자동 생성
            </button>
            <button onClick={() => autoRotate(false)} title="교대조만 다시 채웁니다"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-50">
              <Wand2 className="w-4 h-4" /> 교대조만
            </button>
            <button onClick={() => setHistOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              <History className="w-4 h-4" /> 저장 이력
            </button>
            <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => printAs(false)} title="시간 집계를 빼고 근무만 크게 — 벽에 붙이는 용도"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Printer className="w-4 h-4" /> 게시용 인쇄
              </button>
              <button onClick={() => printAs(true)} title="총시간·대휴·초과휴까지 — 결재·보관용"
                className="px-3 py-2.5 text-sm font-semibold text-gray-500 border-l border-gray-200 hover:bg-gray-50">
                관리용
              </button>
            </div>
            <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setYm(shiftMonth(ym, -1))} className="px-2 py-2 hover:bg-gray-50"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
            <span className="px-3 text-sm font-bold text-gray-800">{y}년 {m}월</span>
            <button onClick={() => setYm(shiftMonth(ym, 1))} className="px-2 py-2 hover:bg-gray-50"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
          </div>
          <label className="text-xs text-gray-500">작성 기준일
            <input type="date" value={asOf} onChange={e => { setAsOf(e.target.value); setDirty(true) }} className="ml-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg" />
          </label>
        </div>

        {/* 월 기준시간 — 토·일·공휴일을 뺀 날수 × 8시간 */}
        <div className="mb-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-700">{m}월 기준</span>
            <span className="text-lg font-extrabold text-gray-900">{baseHours}<span className="text-xs font-bold text-gray-400">시간</span></span>
            <span className="text-sm font-bold text-gray-500">/ {baseDays}<span className="text-xs font-bold text-gray-400">일</span></span>
            <span className="text-[11px] text-gray-400">
              = {base.total}일 − 주말 {base.weekend}일 − 공휴일 {base.holiday}일
              {exclLabor && base.paid > 0 && ` − 유급휴일 ${base.paid}일`}
              {' '}= {base.workdays}일 × {DAILY_HOURS}시간
            </span>
            <label className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer">
              <input type="checkbox" checked={autoBase} onChange={e => { setAutoBase(e.target.checked); setDirty(true) }} className="accent-indigo-600" />
              자동 계산
            </label>
            {base.paid > 0 && (
              <label className="inline-flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer" title="근로자의 날은 관공서 공휴일이 아니지만 유급휴일입니다">
                <input type="checkbox" checked={exclLabor} onChange={e => { setExclLabor(e.target.checked); setDirty(true) }} className="accent-violet-600" />
                근로자의 날 제외
              </label>
            )}
          </div>
          {!autoBase && (
            <div className="flex items-center gap-2 mt-2">
              <label className="text-[11px] text-gray-500">기준시간
                <input value={baseHours} onChange={e => { setBaseHours(e.target.value); setDirty(true) }} className="ml-1 w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
              </label>
              <label className="text-[11px] text-gray-500">기준일수
                <input value={baseDays} onChange={e => { setBaseDays(e.target.value); setDirty(true) }} className="ml-1 w-14 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
              </label>
              <span className="text-[11px] text-amber-600">자동 계산값은 {base.hours}시간 / {base.workdays}일입니다</span>
            </div>
          )}
        </div>

        {/* 근무 코드 팔레트 */}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-400 mr-1">칠할 근무</span>
          {SHIFT_CODES.map(c => (
            <button key={c.code} onClick={() => setBrush(c.code)} title={`${c.label}${c.time ? ` · ${c.time}` : ''}${c.hours ? ` · ${c.hours}시간` : ''}`}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${brush === c.code ? c.cls + ' ring-2 ring-offset-1 ring-gray-300' : 'bg-white border-gray-200 text-gray-500'}`}>
              {c.code}
            </button>
          ))}
          <button onClick={() => setBrush('')} className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border ${brush === '' ? 'bg-gray-200 text-gray-700 ring-2 ring-offset-1 ring-gray-300' : 'bg-white border-gray-200 text-gray-400'}`}>
            <Eraser className="w-3 h-3" /> 지우기
          </button>
          <span className="text-[11px] text-gray-400 ml-2">칸을 누르거나 끌면 칠해집니다 · 두 번 누르면 직접 입력 · 선택 후 <b>D N H O C</b> 키와 방향키로도 편성됩니다</span>
        </div>

        {teamOpen && (
          <div className="mb-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
            <p className="text-xs font-bold text-indigo-800 mb-2">조 편성 — <b>요양보호사</b>만 교대조를 지정할 수 있고, 나머지 직종은 주간 근무입니다</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {staff.map(s => {
                const shiftable = canJoinTeam(s.pos)
                return (
                  <div key={s.id} className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                    <span className="text-xs font-semibold text-gray-700 flex-1 truncate" title={s.pos ?? ''}>{s.name}</span>
                    {shiftable ? (
                      <select value={s.team ?? ''} onChange={e => patchRow(s.id, { position: s.pos, team: e.target.value })}
                        className="text-[11px] border border-gray-200 rounded px-1 py-1">
                        <option value="">-</option>
                        {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value={DAY_TEAM}>{DAY_TEAM}</option>
                      </select>
                    ) : (
                      <span className="text-[11px] text-gray-400 px-1 py-1" title={`${s.pos || '이 직종'}은 교대를 돌지 않습니다`}>주간</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 border-t border-indigo-100 pt-2.5">
              <p className="text-[11px] font-bold text-indigo-800 mb-1.5">
                조별 시작 패턴 <span className="font-normal text-indigo-500">— 1일이 무슨 근무로 시작할지 정합니다 (주주야야휴휴 {ROTATION.length}일 주기 · 휴휴는 공란)</span>
              </p>
              <div className="space-y-1">
                {TEAMS.filter(t => staff.some(s => canJoinTeam(s.pos) && s.team === t)).map(t => {
                  const used = staff.filter(s => canJoinTeam(s.pos) && s.team === t).length
                  return (
                    <div key={t} className="flex items-center gap-2 flex-wrap bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                      <span className={`w-1.5 h-4 rounded-sm ${TEAM_BAND[t] ?? 'bg-gray-300'}`} />
                      <span className="text-xs font-bold text-gray-700 w-9">{t}</span>
                      <span className="text-[10px] text-gray-400 w-9">{used}명</span>
                      <div className="flex gap-0.5">
                        {rotationPreview(t, offsets).map((c, i) => (
                          <span key={i} title={c ? undefined : '근무 없음(공란)'}
                            className={`w-6 text-center text-[10px] font-bold py-0.5 rounded ${c ? (meta(c)?.cls ?? 'bg-gray-100') : 'bg-gray-50 text-gray-300'}`}>
                            {c || '·'}
                          </span>
                        ))}
                      </div>
                      <button type="button" onClick={() => { setOffsets(p => ({ ...p, [t]: (((p[t] ?? 0) + 5) % 6) })); setDirty(true) }}
                        className="text-[11px] font-bold text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-50">◀</button>
                      <button type="button" onClick={() => { setOffsets(p => ({ ...p, [t]: (((p[t] ?? 0) + 1) % 6) })); setDirty(true) }}
                        className="text-[11px] font-bold text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-50">▶</button>
                      {(() => {
                        const dup = TEAMS.filter(o => o !== t && staff.some(s => canJoinTeam(s.pos) && s.team === o) && (offsets[o] ?? 0) === (offsets[t] ?? 0))
                        return dup.length > 0
                          ? <span className="text-[10px] font-bold text-amber-600">{dup.join('·')}와 같은 주기</span>
                          : null
                      })()}
                    </div>
                  )
                })}
                {!staff.some(s => canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? '')) && (
                  <p className="text-[11px] text-gray-400">위에서 요양보호사에게 조를 지정하면 시작 패턴을 조정할 수 있습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {rowsFrom && (
          <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2 flex items-center gap-2 flex-wrap">
            <Users size={13} className="text-teal-600 shrink-0" />
            <span className="text-[12px] text-teal-800">
              <b>{rowsFrom.replace('-', '년 ')}월</b> 조 편성을 그대로 가져왔습니다 — 바꿀 게 없으면 그대로 쓰시면 됩니다.
            </span>
            <button onClick={() => setRowsFrom(null)} className="ml-auto text-[11px] text-teal-600 hover:underline">확인</button>
          </div>
        )}

        {/* 교대조 정산 결과 — 왜 이 근무가 나왔는지 근거를 남긴다 */}
        {lastPlans.length > 0 && (
          <div className="mb-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 print:hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={13} className="text-indigo-600" />
              <span className="text-xs font-bold text-indigo-800">교대조 근무시간 맞추기 <span className="font-normal text-indigo-500">(입사일 기준 개인별)</span></span>
              <span className="text-[11px] text-indigo-500">{SETTLE_START.replace('-', '년 ')}월부터 이월 계산</span>
              <button onClick={() => setLastPlans([])} className="ml-auto text-[11px] text-gray-400 hover:text-gray-600">닫기</button>
            </div>
            <div className="overflow-x-auto">
              <table className="text-[11px] w-full min-w-[520px]">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left font-semibold py-1">이름</th>
                    <th className="font-semibold">조</th>
                    <th className="font-semibold">회전</th>
                    <th className="font-semibold">대휴</th>
                    <th className="font-semibold">이월<br /><span className="font-normal text-[10px]">지난달까지</span></th>
                    <th className="font-semibold">추가<br />근무</th>
                    <th className="font-semibold">갚음<br /><span className="font-normal text-[10px]">휴가·단축</span></th>
                    <th className="font-semibold">추가근무</th>
                    <th className="font-semibold">실근무</th>
                    <th className="font-semibold">기준</th>
                    <th className="font-semibold">못 갚은<br />추가근무</th>
                    <th className="font-semibold">예상 수당</th>
                  </tr>
                </thead>
                <tbody>
                  {lastPlans.map(p => (
                    <tr key={p.memberId} className="border-t border-indigo-100/70">
                      <td className="py-1 font-bold text-gray-700">
                        {p.name}
                        {p.activeDays < p.monthDays && (
                          <span className="ml-1 text-[10px] font-normal text-amber-600">재직 {p.activeDays}/{p.monthDays}일</span>
                        )}
                      </td>
                      <td className="text-center text-gray-500">{p.team}</td>
                      <td className="text-center text-gray-500">{p.rotationHours}h</td>
                      <td className="text-center text-amber-700">{p.daehyuDays || '-'}{p.daehyuDays ? '일' : ''}</td>
                      <td className={`text-center font-semibold ${p.opening > 0 ? 'text-amber-700' : 'text-gray-300'}`}>
                        {p.opening > 0 ? `${p.opening}h` : '-'}
                      </td>
                      <td className="text-center text-sky-700">{p.extraHours > 0 ? `${p.extraHours}h` : '-'}</td>
                      <td className="text-center text-violet-700">
                        {p.paidBack > 0
                          ? <>{p.compDays > 0 && `${p.compDays}일`}{p.compDays > 0 && p.shortenHours > 0 && '+'}{p.shortenHours > 0 && `${p.shortenHours}h단축`}</>
                          : '-'}
                      </td>
                      <td className="text-center text-violet-700">{p.extraHours > 0 ? `${p.extraHours}h` : '-'}</td>
                      <td className={`text-center font-bold ${Math.abs(p.workedHours - p.baseHours) > 8 ? 'text-red-600' : 'text-gray-800'}`}>{p.workedHours}h</td>
                      <td className="text-center text-gray-500">{p.baseHours}h</td>
                      <td className={`text-center font-semibold ${p.closing === 0 ? 'text-gray-400' : 'text-emerald-700'}`}>
                        {p.closing > 0 ? `${p.closing}h` : '0'}
                      </td>
                      <td className="text-center text-gray-600">
                        {p.closing > 0 && Number(wage) > 0
                          ? `${Math.round(p.closing * Number(wage) * (Number(rate) || 1)).toLocaleString()}원`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-indigo-100">
              <span className="text-[11px] font-bold text-indigo-800">못 갚은 추가근무를 수당으로</span>
              <label className="text-[11px] text-gray-500">시급
                <input value={wage} onChange={e => setWage(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="10320" className="ml-1 w-20 px-2 py-1 text-[12px] border border-gray-200 rounded-lg text-right" />원
              </label>
              <label className="text-[11px] text-gray-500">가산율
                <input value={rate} onChange={e => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="ml-1 w-12 px-2 py-1 text-[12px] border border-gray-200 rounded-lg text-right" />배
              </label>
              {Number(wage) > 0 && (() => {
                const owed = lastPlans.reduce((a, p) => a + Math.max(0, p.closing), 0)
                return (
                  <span className="text-[11.5px] font-bold text-indigo-800">
                    합계 {Math.round(owed * 10) / 10}시간 · 약 {Math.round(owed * Number(wage) * (Number(rate) || 1)).toLocaleString()}원
                  </span>
                )
              })()}
              <span className="text-[11px] text-gray-400">연장근로 가산은 통상임금의 50%(1.5배)가 일반적입니다 — 시설 기준에 맞게 조정하세요.</span>
            </div>
            <p className="text-[11px] text-indigo-600 mt-1.5">
              공휴일에 근무하면 <b>대체휴무</b>로 다른 날 쉬고, 그만큼 줄어든 시간은 <b>추가근무</b>(0850~)로 채웁니다.
              쉬는 날 나와서 일한 추가근무는 쌓아 두었다가, 기준시간을 넘는 여유가 생기면
              <b>초과근무 휴가</b>(하루)나 <b>근무 단축</b>(0850~1600 등)으로 갚습니다.
              연말까지 못 갚은 시간은 위의 <b>예상 수당</b>으로 지급하시면 됩니다.
            </p>
          </div>
        )}

        {/* 점검 — 확정 전에 문제를 자동으로 훑는다 */}
        <div className={`mb-3 rounded-2xl border ${danger > 0 ? 'border-red-200 bg-red-50/60' : issues.length > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
          <button onClick={() => setAuditOpen(v => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
            {issues.length === 0
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              : <AlertTriangle className={`w-4 h-4 shrink-0 ${danger > 0 ? 'text-red-600' : 'text-amber-600'}`} />}
            <span className="text-sm font-bold text-gray-800">
              {issues.length === 0 ? '점검 통과 — 확정해도 됩니다'
                : `점검 ${issues.length}건`}
            </span>
            {danger > 0 && <span className="text-[10px] font-extrabold bg-red-600 text-white px-1.5 py-0.5 rounded-full">위험 {danger}</span>}
            <label className="ml-auto text-[11px] text-gray-500 flex items-center gap-1" onClick={e => e.stopPropagation()}>
              하루 최소 인원
              <input type="number" min={0} value={minStaff} onChange={e => setMinStaff(Number(e.target.value) || 0)}
                className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center" />
            </label>
            <span className="text-[11px] text-gray-400">{auditOpen ? '접기 ▴' : '펼치기 ▾'}</span>
          </button>
          {auditOpen && issues.length > 0 && (
            <ul className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-1">
              {issues.map(i => (
                <li key={i.id}>
                  <button onClick={() => setFocus({ staffId: i.staffId, day: i.day })}
                    className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 bg-white/80 border hover:bg-white ${i.level === 'danger' ? 'border-red-200' : 'border-amber-200'}`}>
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${i.level === 'danger' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-gray-800">{i.title}</span>
                      <span className="block text-[11px] text-gray-500">{i.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 인쇄 머리말 — 결재란은 인쇄물에만 */}
      <div className="hidden print:flex items-start justify-between mb-1">
        <div />
        <table className="print-approve">
          <tbody>
            <tr>
              <td rowSpan={2} className="pa-label">결<br />재</td>
              <td className="pa-role">담당</td><td className="pa-role">팀장</td><td className="pa-role">시설장</td>
            </tr>
            <tr><td className="pa-sign" /><td className="pa-sign" /><td className="pa-sign" /></tr>
          </tbody>
        </table>
      </div>

      {/* 편성표 본체 */}
      <h2 className="text-center text-base md:text-lg font-bold text-gray-900 mb-2 print:mb-1">
        행복한 요양원 <span className="text-teal-700">{y}년 {m}월</span> 근무 편성표
        <span className="block text-xs font-semibold text-gray-500 print:text-[9pt] print:mt-0.5">
          작성 기준 {asOf ? `${Number(asOf.slice(5, 7))}월 ${Number(asOf.slice(8, 10))}일` : '-'}
          <span className="hidden print:inline"> · 월 기준 {baseHours}시간 / {baseDays}일</span>
        </span>
      </h2>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
      ) : (
        <div className="ws-wrap overflow-x-auto border border-gray-200 rounded-xl bg-white outline-none" tabIndex={0} onKeyDown={onKey}>
          <table className="ws-table border-collapse" style={{ minWidth: 1400 }}>
            <colgroup>
              <col className="c-pos" /><col className="c-team" /><col className="c-name" />
              {days.map(({ day }) => <col key={day} />)}
              <col className="c-agg c-sum" /><col className="c-agg c-cnt" /><col className="c-agg c-cnt" />
              <col className="c-agg c-off" /><col className="c-agg c-off" /><col className="c-agg c-comp" />
              <col className="c-agg c-ext" /><col className="c-agg c-memo" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${th} sticky left-0 z-20`}>직종</th>
                <th className={th}>조</th>
                <th className={`${th} sticky left-0 z-20`}>성명</th>
                {days.map(({ day, dow }) => {
                  const t = dayTone(day, dow)
                  return (
                    <th key={day} style={{ minWidth: 30 }} title={holidays[iso(day)]?.name ?? ''}
                      className={`${th} ${day === todayCol ? 'bg-indigo-100 text-indigo-800' : t === 'red' ? 'bg-red-50 text-red-600' : t === 'blue' ? 'bg-blue-50 text-blue-600' : ''}`}>
                      {day}
                    </th>
                  )
                })}
                <th className={`${th} ws-agg`} title="한 달 동안 일한 시간 전부 (추가근무 포함)">총시간<br /><span className="font-normal text-gray-400">(추가근무 포함)</span></th>
                <th className={`${th} ws-agg`}>D</th>
                <th className={`${th} ws-agg`}>N</th>
                <th className={`${th} ws-agg`}>연차</th>
                <th className={`${th} ws-agg`} title="공휴일에 근무해서 대신 쉬는 날">대체<br />휴무</th>
                <th className={`${th} ws-agg`} title="초과근무한 시간만큼 쉬는 날">초과근무<br />휴가</th>
                <th className={`${th} ws-agg`} title="모자란 시간을 채우려고 더 나온 근무">추가<br />근무</th>
                <th className={`${th} ws-agg`}>비고</th>
              </tr>
              <tr>
                <th className={th} colSpan={3}>{baseHours}시간 / {baseDays}일 기준</th>
                {days.map(({ day, dow }) => {
                  const t = dayTone(day, dow)
                  const h = holidays[iso(day)]?.name
                  return (
                    <th key={day} title={h ?? ''}
                      className={`${th} ${t === 'red' ? 'bg-red-50 text-red-600' : t === 'blue' ? 'bg-blue-50 text-blue-600' : t === 'paid' ? 'bg-violet-50 text-violet-600' : 'text-gray-400'}`}>
                      {h ? (t === 'paid' ? '유급' : '공') : DOW[dow]}
                    </th>
                  )
                })}
                <th className={`${th} ws-agg`} colSpan={8} />
              </tr>
            </thead>
            <tbody>
              {staff.map(s => {
                const c = calc(s.id)
                const bh = Number(baseHours) || 0
                const short = bh > 0 && c.total < bh        // 미달 — 급여가 깎이는 쪽이라 빨갛게
                const over = bh > 0 && c.total > bh
                return (
                  <tr key={s.id} className={`hover:bg-indigo-50/20 ${focus?.staffId === s.id ? 'bg-amber-50' : ''}`}>
                    <td className={`${td} sticky left-0 z-10 bg-white font-semibold text-gray-600 relative`}>
                      {s.team && TEAM_BAND[s.team] && <span className={`absolute left-0 top-0 bottom-0 w-1 ${TEAM_BAND[s.team]}`} />}
                      {s.pos || '-'}
                    </td>
                    <td className={`${td} text-gray-500`}>{s.team || ''}</td>
                    <td className={`${td} ws-name sticky left-0 z-10 bg-white font-bold text-gray-800`}>{s.name}</td>
                    {days.map(({ day, dow }, di) => {
                      const v = data[s.id]?.[String(day)] ?? ''
                      const mt = meta(v)
                      const si = staff.findIndex(x => x.id === s.id)
                      const picked = sel?.si === si && sel?.di === di
                      const lit = focus?.day === day || (focus?.staffId === s.id && focus?.day === undefined)
                      return (
                        <td key={day}
                          onMouseDown={() => { painting.current = true; setSel({ si, di }); setCell(s.id, day, brush) }}
                          onMouseEnter={() => { if (painting.current) setCell(s.id, day, brush) }}
                          onDoubleClick={() => {
                            const t = prompt(`${s.name} · ${m}월 ${day}일 근무 (예: D, N, 대휴, 0850 1600)`, v)
                            if (t !== null) setCell(s.id, day, t.trim())
                          }}
                          title={mt ? `${mt.label}${mt.time ? ` ${mt.time}` : ''}` : v}
                          data-code={v}
                          className={`${td} ws-cell cursor-pointer select-none ${mt ? mt.cls : v ? 'bg-yellow-50 text-gray-700 text-[9px] leading-tight' : dayTone(day, dow) === 'red' ? 'bg-red-50/70' : dayTone(day, dow) === 'blue' ? 'bg-blue-50/70' : dayTone(day, dow) === 'paid' ? 'bg-violet-50/60' : ''} ${day === todayCol ? 'ring-1 ring-inset ring-indigo-200' : ''} ${lit ? 'outline outline-2 outline-amber-400' : ''} ${picked ? 'ring-2 ring-inset ring-gray-800' : ''}`}>
                          {(() => {
                            const tr = splitTimeRange(v)
                            // 시간대는 좁은 칸에 한 줄로 안 들어가 잘린다 → 시작/끝을 두 줄로
                            if (tr) return <span className="ws-time">{tr[0]}<br />{tr[1]}</span>
                            return <span className="ws-code">{shortOf(v)}</span>
                          })()}
                        </td>
                      )
                    })}
                    <td className={`${td} ws-agg font-bold ${short ? 'text-red-600' : over ? 'text-amber-600' : 'text-gray-800'}`}
                      title={c.extra > 0 ? `정규 ${c.hours}h + 추가근무 ${c.extra}h = ${c.total}h (기준 ${bh}h)` : `${c.total}h (기준 ${bh}h)`}>
                      {c.total}
                      {short && <span className="block text-[9px] font-extrabold text-red-600">{Math.round((c.total - bh) * 10) / 10}h</span>}
                      <span className="ws-bar block mt-0.5 h-1 w-10 mx-auto rounded-full bg-gray-100 overflow-hidden">
                        <span className={`block h-full ${short ? 'bg-red-500' : over ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${bh > 0 ? Math.min(100, (c.total / bh) * 100) : 0}%` }} />
                      </span>
                    </td>
                    <td className={`${td} ws-agg text-gray-600`}>{c.d || ''}</td>
                    <td className={`${td} ws-agg text-gray-600`}>{c.n || ''}</td>
                    <td className={`${td} ws-agg text-emerald-700`}>{c.annual || ''}</td>
                    <td className={`${td} ws-agg text-amber-700`}>{c.off || ''}</td>
                    <td className={`${td} ws-agg text-violet-700`}>{c.comp || ''}</td>
                    <td className={`${td} ws-agg text-sky-700`}>{c.extra || ''}</td>
                    <td className={`${td} ws-agg text-gray-400 text-[10px]`}>{s.note}</td>
                  </tr>
                )
              })}
              <tr className="ws-row-sum bg-gray-50">
                <td className={`${td} font-bold text-gray-600 sticky left-0 z-10 bg-gray-50`} colSpan={3}>특이사항 (근무 인원)</td>
                {days.map(({ day }) => {
                  const n = dayCount(day)
                  return (
                    <td key={day}
                      className={`${td} font-bold ${n === 0 ? 'bg-red-100 text-red-700' : n < minStaff ? 'bg-amber-100 text-amber-800' : 'text-gray-700'} ${focus?.day === day ? 'outline outline-2 outline-amber-400' : ''}`}>
                      {n || '0'}
                    </td>
                  )
                })}
                <td className={`${td} ws-agg`} colSpan={8} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 범례 */}
      <div className="ws-legend mt-2 flex items-center gap-2.5 flex-wrap print-legend">
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200" /> 토요일</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> 일요일·공휴일</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500"><span className="w-3 h-3 rounded bg-violet-50 border border-violet-200" /> 유급휴일(근로자의 날)</span>
        <span className="text-gray-200">|</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
          <span className="w-3 h-3 rounded bg-red-500" /> 총시간 기준 미달
        </span>
        <span className="text-gray-200">|</span>
        {SHIFT_CODES.map(c => (
          <span key={c.code} className="inline-flex items-center gap-1 text-[11px] text-gray-500" title={c.note ?? ''}>
            <span className={`px-1.5 py-0.5 rounded font-bold ${c.cls}`}>{c.code}</span>
            {c.label}
            {c.time && <span className="text-gray-400">{c.time}</span>}
            {c.note && <span className="text-gray-400">— {c.note}</span>}
          </span>
        ))}
      </div>

      {histOpen && (
        <ScheduleHistoryModal
          month={ym}
          onClose={() => setHistOpen(false)}
          onLoad={v => {
            // 화면에만 적용 — 저장을 눌러야 확정된다
            setData(v.data || {}); setRows(v.rows || [])
            if (v.base_hours) { setAutoBase(false); setBaseHours(v.base_hours); setBaseDays(v.base_days || '') }
            if (v.as_of) setAsOf(v.as_of)
            setOffsets({ ...DEFAULT_TEAM_OFFSET, ...(v.team_offsets || {}) })
            setDirty(true)
          }}
        />
      )}

      <style>{`
        /* ── 인쇄 ────────────────────────────────────────────────
           게시용은 벽에 붙여 여러 명이 멀리서 보는 문서다.
           총시간·초과휴 같은 숫자는 '왜 저 사람은 나보다 많지?'라는 오해를 부르므로
           빼고, 대신 근무 칸과 이름을 크게 키운다. 관리·결재용은 집계까지 모두 넣는다. */
        .print-approve, .print-approve td { border: 0.4mm solid #000; border-collapse: collapse; }
        /* 화면에서도 시간대는 두 줄로 (칸이 좁아 잘리는 건 마찬가지) */
        .ws-time { display: block; line-height: 1.05; font-size: 9px; font-variant-numeric: tabular-nums; }
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          html, body { background: #fff !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }

          .ws-wrap { overflow: visible !important; border: 0 !important; border-radius: 0 !important; }
          .ws-table { width: 100% !important; min-width: 0 !important; table-layout: fixed; }
          .ws-table th, .ws-table td {
            border: 0.15mm solid #666 !important;
            padding: 0.5mm 0 !important; line-height: 1.2 !important;
            overflow: hidden; white-space: nowrap; text-align: center;
            vertical-align: middle;
          }
          /* 시간대 칸만 두 줄 허용 — 한 줄로는 절반이 잘린다 */
          .ws-table .ws-time {
            display: block; white-space: normal; line-height: 1.05 !important;
            font-variant-numeric: tabular-nums; letter-spacing: -0.2pt;
          }
          .ws-table thead th { background: #e9e9e9 !important; font-weight: 700; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .ws-table .sticky { position: static !important; }
          .ws-bar { display: none !important; }
          .ws-row-sum td { background: #e4e4e4 !important; font-weight: 700; }
          .ws-table tbody tr:nth-child(even) td { background-color: #fafafa; }

          /* 고정열 폭 */
          .ws-table col.c-pos { width: 14mm; }
          .ws-table col.c-team { width: 7mm; }
          .ws-table col.c-name { width: 20mm; }

          /* ① 기본 — 집계 열은 통째로 빼고 근무만 크게.
             Ctrl+P로 바로 인쇄해도 동일하게 적용된다.
             행 높이를 8mm로 잡아 시간대 두 줄(6.5pt×2≈4.8mm)이 눌리지 않게 한다. */
          .ws-agg { display: none !important; }
          .ws-table col.c-agg { width: 0 !important; }
          .ws-table th, .ws-table td { font-size: 8.5pt !important; padding: 1mm 0.3mm !important; }
          .ws-table tbody td { height: 8mm; }
          .ws-name { font-size: 11pt !important; font-weight: 800 !important; letter-spacing: -0.2pt; }
          .ws-time { font-size: 6.5pt !important; }


          /* ② 관리·결재용 — '관리용' 버튼으로 뽑을 때만 집계 열을 되살린다 */
          .ws-full .ws-agg { display: table-cell !important; }
          .ws-full .ws-table th, .ws-full .ws-table td { font-size: 6pt !important; padding: 0.5mm 0.2mm !important; }
          .ws-full .ws-table tbody td { height: 5.5mm; }
          .ws-full .ws-name { font-size: 7.5pt !important; font-weight: 700 !important; }
          .ws-full .ws-time { font-size: 5pt !important; }
          .ws-full .ws-table col.c-sum  { width: 13mm !important; }
          .ws-full .ws-table col.c-cnt  { width: 6mm !important; }
          .ws-full .ws-table col.c-off  { width: 7mm !important; }
          .ws-full .ws-table col.c-comp { width: 8mm !important; }
          .ws-full .ws-table col.c-ext  { width: 9mm !important; }
          .ws-full .ws-table col.c-memo { width: 10mm !important; }

          /* 범례 — 표 아래 한 줄 */
          .print-legend { font-size: 8pt !important; gap: 3mm !important; margin-top: 2mm !important; }
          .print-legend .text-gray-200 { display: none; }

          /* 결재란 */
          .print-approve { font-size: 8pt; }
          .print-approve .pa-label { width: 7mm; text-align: center; font-weight: 700; padding: 0 0.5mm; }
          .print-approve .pa-role  { width: 18mm; height: 4.5mm; text-align: center; background: #f0f0f0; }
          .print-approve .pa-sign  { height: 12mm; }
        }
      `}</style>
    </div>
  )
}
