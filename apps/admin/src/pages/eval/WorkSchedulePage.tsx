import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Save, Eraser, Loader2, CalendarDays, Wand2, Users, History, Sparkles, Inbox, Trash2, FileSpreadsheet, X, Lock, Unlock } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/api/client'
import { workScheduleAPI, type ScheduleData, type ScheduleRow, type HolidayInfo } from '@/api/workScheduleClient'
import { calcBase, DAILY_HOURS } from '@/utils/baseHours'
import ScheduleHistoryModal from '@/components/schedule/ScheduleHistoryModal'
import TeamPanel from '@/components/schedule/TeamPanel'
import SettlementPanel from '@/components/schedule/SettlementPanel'
import AuditPanel from '@/components/schedule/AuditPanel'
import GeneratePickModal from '@/components/schedule/GeneratePickModal'
import AttendanceSheets from '@/components/schedule/AttendanceSheets'
import LeaveInboxPanel from '@/components/schedule/LeaveInboxPanel'
import { leaveAPI, swapAPI, signatureUrl, type LeaveRequest } from '@/api/leaveClient'
import { TEAM_BAND, canJoinTeam, sortScheduleStaff } from '@/components/schedule/shared'
import { planDayShift, interleaveByPosition } from '@/utils/dayShiftPlan'
import { planMembersMonths, type MonthContext, type MemberMonthPlan } from '@/utils/shiftBalance'
import { calcBase as calcBaseFor } from '@/utils/baseHours'
import { SHIFT_CODES, extraHoursOf, countAsOf, meta, isAutoManaged, splitTimeRange, shortOf, TEAMS, DEFAULT_TEAM_OFFSET, rotationFor } from '@/utils/shiftCodes'
import { auditSchedule, type Issue } from '@/utils/scheduleAudit'
import { filterByFloor, countHiddenNoFloor } from '@/utils/floorFilter'
import { withFloorSubtotals } from '@/utils/floorSubtotals'
import { printHasCaregiver, printHasAnyOf } from '@/utils/printRows'
import { monthTotals } from '@/utils/monthHours'
import { buildScheduleRows, canSaveRows } from '@/utils/scheduleRows'
import { useShiftConfig } from '@/store/shiftConfig'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const todayISO = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }



/** 교대(주주야야휴휴)를 도는 직종 — 나머지는 모두 주간 근무다 */



export default function WorkSchedulePage() {
  // 코드별 시간 설정 — 총시간이 이 값으로 계산된다.
  // loadedHours 를 읽어야 설정이 실린 뒤 화면이 다시 그려진다.
  const loadShiftCfg = useShiftConfig(st => st.load)
  const useHoursFor = useShiftConfig(st => st.useFor)
  const loadedHours = useShiftConfig(st => st.hours)
  useEffect(() => { loadShiftCfg() }, [loadShiftCfg])
  const { staffList, residents, loadAll } = useLtcStore()
  const [ym, setYm] = useState(thisMonth())
  // 보고 있는 달의 규칙으로 총시간을 계산한다.
  // 8월 표를 보는데 9월부터 바뀐 값을 쓰면 숫자가 어긋난다.
  useEffect(() => { useHoursFor(ym) }, [ym, useHoursFor])
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
  // 확정 잠금 — 잠긴 달은 아무도 못 고친다. 잠그고 푸는 것은 ADMIN 만.
  const [lock, setLock] = useState<{ locked: boolean; by?: string | null; at?: string | null }>({ locked: false })
  const [locking, setLocking] = useState(false)
  const LOCK_MSG = '확정된 근무표입니다. 고치려면 먼저 잠금을 풀어주세요.'
  // 짜는 것은 시설장도 하지만, 확정 여부는 한 사람이 정해야 한다
  const isAdminUser = useAuthStore(st => st.user)?.role === 'ADMIN'
  const [teamOpen, setTeamOpen] = useState(false)
  // 층은 늘 필요한 정보가 아니다 — 볼 사람만 켠다. 이 브라우저에 기억한다.
  const [showFloor, setShowFloor] = useState(() => localStorage.getItem('ws.floor') === '1')
  useEffect(() => { localStorage.setItem('ws.floor', showFloor ? '1' : '0') }, [showFloor])

  // 층으로 걸러 보기 — ''이면 전체. 이것도 이 브라우저에 기억한다.
  //
  // 보기 전용이다. 저장·검수·자동생성은 언제나 전체 인원을 그대로 쓴다.
  // 걸러둔 채로 저장했다가 사람이 빠지면 그건 근무표가 아니라 사고다.
  const [floorPick, setFloorPick] = useState(() => localStorage.getItem('ws.floorPick') ?? '')
  useEffect(() => { localStorage.setItem('ws.floorPick', floorPick) }, [floorPick])
  const [auditOpen, setAuditOpen] = useState(true)
  const [histOpen, setHistOpen] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)   // 자동 생성 대상 선택
  // 인쇄 대상 선택 — 층별로 나눠 붙이거나 특정 인원만 뽑을 때
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leavePending, setLeavePending] = useState(0)
  useEffect(() => {
    Promise.all([
      leaveAPI.list(undefined, 'pending').catch(() => []),
      swapAPI.list('pending').catch(() => []),
    ]).then(([l, s]) => setLeavePending(l.length + s.length))
  }, [])
  const [printPickOpen, setPrintPickOpen] = useState(false)
  const [printPick, setPrintPick] = useState<Set<string> | null>(null)
  const pendingFull = useRef(false)
  const [building, setBuilding] = useState(false)
  // 인쇄는 '집계 열 없이'가 기본이다. 총시간·초과휴 같은 숫자가 벽에 붙으면
  // '왜 저 사람은 나보다 많지?' 같은 오해가 생긴다.
  // 브라우저 인쇄(Ctrl+P)로 바로 뽑아도 빠지도록 CSS로 처리하고,
  // 결재·보관이 필요할 때만 '관리용' 버튼으로 되살린다.
  const [fullPrint, setFullPrint] = useState(false)
  const [wantPrint, setWantPrint] = useState(false)
  // 근무상황부(출석부) — 사람마다 한 장, 이름 바꿔 복사하던 절차를 없앤다
  const [attPickOpen, setAttPickOpen] = useState(false)
  const [attPick, setAttPick] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (!attPick || loading) return
    const t = requestAnimationFrame(() => {
      window.print()
      setAttPick(null)
    })
    return () => cancelAnimationFrame(t)
  }, [attPick, loading])
  const [rowsFrom, setRowsFrom] = useState<string | null>(null)
  // 남은 잔고를 수당으로 줄 때 얼마인지 — 시설마다 달라 입력받는다
  // 정산 시작월·회전 기준일 — 코드에 박지 않고 설정에서 가져온다 (해가 바뀌어도 화면에서 조정)
  const [settleStart, setSettleStart] = useState('2026-07')
  const [anchor, setAnchor] = useState('2026-08-01')
  useEffect(() => {
    workScheduleAPI.config()
      .then(c => { setSettleStart(c.settle_start); setAnchor(c.rotation_anchor) })
      .catch(() => { /* 설정을 못 읽으면 기본값으로 동작 */ })
  }, [])

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

  useEffect(() => { loadAll() }, [loadAll])

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
        setLock({ locked: !!doc.locked, by: doc.locked_by, at: doc.locked_at })
      })
      .catch(() => {
        if (seq !== loadSeq.current) return
        setData({}); setRows([]); setUpdatedBy(null); setLock({ locked: false })
      })
      .finally(() => { if (seq === loadSeq.current) setLoading(false) })
  }, [ym])

  // ── 휴무 신청을 편성표 위에 얹는다 ────────────────────────────
  // 신청을 따로 열어 보고 다시 표로 돌아오면, 그날 인원이 어떤지 기억해서
  // 판단해야 한다. 표 위에 바로 보여야 '이날은 되겠다/안 되겠다'가 보인다.
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const leaveSeq = useRef(0)
  const loadLeaves = useCallback(() => {
    const seq = ++leaveSeq.current
    Promise.all([
      leaveAPI.list(ym, 'pending').catch(() => [] as LeaveRequest[]),
      leaveAPI.list(ym, 'approved').catch(() => [] as LeaveRequest[]),
    ]).then(([p, a]) => { if (seq === leaveSeq.current) setLeaves([...p, ...a]) })
  }, [ym])
  useEffect(() => { loadLeaves() }, [loadLeaves])

  /** 'staffId:일' → 신청들. 한 사람이 같은 날 두 건일 수는 없지만 방어적으로 배열로 둔다 */
  const leaveAt = useMemo(() => {
    const m = new Map<string, LeaveRequest[]>()
    for (const r of leaves) {
      if (r.date.slice(0, 7) !== ym) continue
      const k = `${r.staff_id}:${Number(r.date.slice(8, 10))}`
      ;(m.get(k) ?? m.set(k, []).get(k)!).push(r)
    }
    return m
  }, [leaves, ym])
  const pendingLeaves = useMemo(
    () => leaves.filter(r => r.status === 'pending' && r.date.slice(0, 7) === ym)
                .sort((a, b) => a.date.localeCompare(b.date)), [leaves, ym])
  // 클릭한 신청 — 표 위에서 바로 승인·반려한다
  const [leavePick, setLeavePick] = useState<LeaveRequest | null>(null)

  const holSeq = useRef(0)
  useEffect(() => {
    const seq = ++holSeq.current
    workScheduleAPI.holidays(ym)
      .then(h => { if (seq === holSeq.current) setHolidays(h) })
      .catch(() => { if (seq === holSeq.current) setHolidays({}) })
  }, [ym])

  useEffect(() => {
    const after = () => { setFullPrint(false); setPrintPick(null) }
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
    pendingFull.current = full
    setPrintPickOpen(true)          // 누구를 인쇄할지 먼저 고른다 (기본 전원)
  }

  const printPicked = (ids: Set<string>) => {
    setPrintPickOpen(false)
    setPrintPick(ids.size === staff.length ? null : ids)   // 전원이면 필터 없음
    setFullPrint(pendingFull.current)
    setWantPrint(true)
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

  /** 표에 실을 직원 — 그달에 실제 재직하는 사람만.
   *  8/3 입사자는 7월 표에 안 나오고, 7월 말 퇴사자는 8월 표에서 빠진다. */
  // 정렬 모드 — 기본(직종·조) 외에 이름·입사순도 바로 바꿔볼 수 있게
  const [sortMode, setSortMode] = useState<'basic' | 'name' | 'hire'>('basic')

  const staff = useMemo(() => {
    const monthStart = `${ym}-01`, monthEnd = `${ym}-31`
    const base = staffList
      .filter(s => {
        const hired = !!s.hireDate && s.hireDate.slice(0, 10) <= monthEnd     // 그달 안에 입사
        const resign = (s.resignDate || '').slice(0, 10)
        if (!hired) return false
        if (resign) return resign >= monthStart                               // 그달까지는 근무
        return s.status === 'active' || s.status === 'pending'                // 입사 예정자도 다음 달 근무표엔 포함
      })
      .map(s => {
        const r = rowMap.get(s.id)
        return { ...s, team: r?.team ?? '', floor: r?.floor ?? '', note: r?.note ?? '', pos: r?.position ?? s.position ?? '' }
      })
    if (sortMode === 'name') return [...base].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    if (sortMode === 'hire') return [...base].sort((a, b) =>
      (a.hireDate || '9999').localeCompare(b.hireDate || '9999') || a.name.localeCompare(b.name, 'ko'))
    return sortScheduleStaff(base)
  }, [staffList, rowMap, ym, sortMode])

  /** 고를 수 있는 층 — 어르신이 실제로 계신 층에서 뽑는다.
   *  없으면 흔히 쓰는 값으로 둔다(수급자를 아직 안 넣은 경우). */
  const floors = useMemo(() => {
    const set = new Set<string>()
    residents.forEach(r => { if (r.floor) set.add(r.floor) })
    rows.forEach(r => { if (r.floor) set.add(r.floor) })
    const list = [...set].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }))
    return list.length ? list : ['2층', '3층', '4층']
  }, [residents, rows])

  /** 표에 보여줄 사람.
   *
   *  층을 고르면 그 층 요양보호사만 남긴다. 간호사·사회복지사처럼 층이
   *  없는 직종은 그대로 둔다 — 층은 요양보호사에게 붙는 개념이고, 층별로
   *  뽑아 붙일 때도 그 사람들은 함께 보여야 한다.
   */
  const shownStaff = useMemo(
    () => filterByFloor(staff, floorPick, canJoinTeam), [staff, floorPick])

  /** 층을 고른 탓에 숨겨진 '층 미지정' 요양보호사 수.
   *  조용히 사라지면 빠진 줄도 모른다. */
  const hiddenNoFloor = useMemo(
    () => countHiddenNoFloor(staff, floorPick, canJoinTeam), [staff, floorPick])


  const setCell = (sid: string, day: number, code: string) => {
    if (lock.locked) return          // 확정된 달은 칠해지지 않는다
    setData(prev => {
      const row = { ...(prev[sid] ?? {}) }
      if (!code) delete row[String(day)]; else row[String(day)] = code
      return { ...prev, [sid]: row }
    })
    setDirty(true)
  }
  const patchRow = (sid: string, p: Partial<ScheduleRow>) => {
    if (lock.locked) return
    setRows(prev => {
      const i = prev.findIndex(r => r.staff_id === sid)
      if (i < 0) return [...prev, { staff_id: sid, ...p }]
      return prev.map((r, ri) => ri === i ? { ...r, ...p } : r)
    })
    setDirty(true)
  }

  /** 주주야야휴휴 자동 편성 — 조가 지정된 직원만 채운다 */
  const autoRotate = (overwrite: boolean) => {
    if (lock.locked) { alert(LOCK_MSG); return }
    const targets = staff.filter(s => canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? ''))
    if (targets.length === 0) { alert('먼저 요양보호사에게 조를 지정해주세요.\n(요양보호사만 교대조를 돌 수 있습니다)'); return }
    let filled = 0
    setData(prev => {
      const next = { ...prev }
      targets.forEach(s => {
        const row = { ...(next[s.id] ?? {}) }
        days.forEach(({ day }) => {
          if (!overwrite && !isAutoManaged(row[String(day)])) return   // 연차·병가만 보존
          // ym·anchor를 넘겨야 달이 바뀌어도 주기가 이어진다 (빼먹으면 매월 1일에 리셋)
          const code = rotationFor(s.team, day, offsets, ym, anchor)
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
    const [sy, sm] = settleStart.split('-').map(Number)
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
        anchor,
        // 유급휴일(근로자의 날)은 관공서 공휴일이 아니라 대휴 대상에서 제외
        holidays: new Set(Object.entries(hs).filter(([, v]) => v.kind !== 'paid').map(([d]) => d)),
      })
      mo++; if (mo > 12) { mo = 1; y++ }
    }
    return { ctxs: list, saved }
  }

  const autoBuild = async (pickedIds: Set<string>) => {
    if (lock.locked) { alert(LOCK_MSG); return }
    // 선택된 사람만 생성 대상 — 뺀 사람(장기 병가, 별도 스케줄 등)의 칸은 전혀 건드리지 않는다
    const pickedStaff = staff.filter(s => pickedIds.has(s.id))
    const shiftStaff = pickedStaff.filter(s => canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? ''))
    const dayStaff = pickedStaff.filter(s => !(canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? '')))
    if (shiftStaff.length === 0 && dayStaff.length === 0) { alert('편성할 직원이 없습니다.'); return }

    const target = Number(baseDays) || base.workdays
    const keep = data                       // 기존 입력 보존 판단용
    let shiftCells = 0, dayCells = 0

    // 주간 직원은 직종별로 묶어 순번을 고르게 흩뿌린 뒤 한 번에 편성
    const groups: Record<string, string[]> = {}
    dayStaff.forEach(s => { (groups[s.pos || '기타'] ||= []).push(s.id) })
    const ordered = interleaveByPosition(groups)

    // 희망휴무 반영 — 승인된 것뿐 아니라 '대기 중' 신청도 미리 반영해 짜본다.
    // 신청이 들어와 있는데 모르고 근무를 박아두면 승인 후 다시 짜야 한다.
    //  · 승인+연차반영: 이미 休로 적혀 있어 보존만 되면 됨
    //  · 그 외(승인·대기): 주간 직원은 그날 휴무 우선 배정, 교대조는 충돌 경고
    let preferRest: Record<string, number[]> = {}
    const hopeConflicts: string[] = []
    let hopeAnnual = 0, hopePending = 0
    try {
      const [approved, pending] = await Promise.all([
        leaveAPI.list(ym, 'approved'), leaveAPI.list(ym, 'pending'),
      ])
      const hopes = [...approved, ...pending].filter(h => h.kind === '희망휴무')
      hopePending = pending.filter(h => h.kind === '희망휴무' || h.kind === '연차').length
      for (const h of hopes) {
        const d = Number(h.date.slice(8, 10))
        if (h.status === 'approved' && h.use_annual) { hopeAnnual++; continue }   // 休로 이미 반영
        if (dayStaff.some(s => s.id === h.staff_id)) {
          (preferRest[h.staff_id] ||= []).push(d)
        } else {
          const sm = shiftStaff.find(s => s.id === h.staff_id)
          if (sm) hopeConflicts.push(`${sm.name} ${d}일${h.status === 'pending' ? '(대기)' : ''}`)
        }
      }
      // 대기 중 '연차' 신청도 그날을 비워둔다 — 승인되면 休가 들어갈 자리
      for (const a of pending.filter(h => h.kind === '연차')) {
        const d = Number(a.date.slice(8, 10))
        if (dayStaff.some(s => s.id === a.staff_id)) (preferRest[a.staff_id] ||= []).push(d)
      }
    } catch { /* 조회 실패 시 희망휴무 없이 진행 */ }

    const { plan } = planDayShift({ days: days.map(d => d.day), staffIds: ordered, workDays: target, preferRest })

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
      `연차·병가·경조사는 그대로 두고 나머지는 새로 계산했습니다.\n아래 점검 결과를 확인한 뒤 저장하세요.` +
      (hopeAnnual > 0 ? `\n\n· 희망휴무(연차 반영) ${hopeAnnual}건은 이미 休로 들어 있어 그대로 두었습니다.` : '') +
      (hopePending > 0 ? `\n\n⏳ 대기 중인 휴무 신청 ${hopePending}건도 미리 비워뒀습니다.\n   승인함에서 승인해야 확정(연차는 休 기록)됩니다 — 반려하면 다시 생성하세요.` : '') +
      (hopeConflicts.length > 0
        ? `\n\n⚠ 교대조 희망휴무 ${hopeConflicts.length}건은 자동 반영되지 않았습니다:\n   ${hopeConflicts.join(', ')}\n   회전(주주야야휴휴)과 겹치니 필요하면 손으로 조정해주세요.`
        : '')
    )
  }

  /** 직원별 집계 — 총시간 = Σ 근무시간, 갯수는 D/N 칸 수 */
  // 계산은 utils/monthHours.ts 한곳에 둔다 — 보기 화면·엑셀이 같은 숫자를 써야 한다
  // loadedHours — 코드별 시간 설정이 실리면 총시간을 다시 계산한다
  const calc = useCallback(
    (sid: string) => monthTotals(data[sid], days.map(d => d.day)),
    [data, days, loadedHours])

  /** 일별 근무 인원 (특이사항 행) */
  /** 일별 근무 인원 — 요양보호사와 그 외(주간 직종)를 나눠 센다.
   *  케어 인력이 몇 명인지가 실제로 중요한 숫자라 합산하면 의미가 흐려진다.
   *  요양보호사 줄은 야간(N)을 빼고 센다 — 낮에 어르신 곁에 몇 명 있는지가 핵심이라,
   *  N까지 섞으면 낮 인력이 실제보다 많아 보인다. */
  const dayCountBy = (day: number, caregiver: boolean) => {
    // 인쇄 대상을 골랐으면 그 인원만 센다 — 표에 없는 사람이 숫자에 섞이면 벽보가 안 맞는다
    const base = printPick ? shownStaff.filter(s => printPick.has(s.id)) : shownStaff
    const pool = base.filter(s => canJoinTeam(s.pos) === caregiver)
    return pool.reduce((acc, s) => {
      const c = countAsOf(data[s.id]?.[String(day)])
      const working = caregiver ? c === 'D' : c !== null   // 요양보호사 줄은 주간 계열만
      return acc + (working ? 1 : 0)
    }, 0)
  }

  /** 그 날 그 층에 나오는 주간 인원. 층을 지정한 사람만 센다.
   *  요양보호사는 주간(D)만, 그 외 직종은 근무가 있으면 나온 것으로 본다. */
  const dayCountFloor = (day: number, floor: string) => {
    const base = printPick ? staff.filter(s => printPick.has(s.id)) : staff
    return base.filter(s => (s.floor || '') === floor).reduce((acc, s) => {
      const c = countAsOf(data[s.id]?.[String(day)])
      const working = canJoinTeam(s.pos) ? c === 'D' : c !== null
      return acc + (working ? 1 : 0)
    }, 0)
  }
  /** 표에 실제로 쓰인 층 — 아무도 배정 안 한 층은 줄을 내지 않는다 */
  const usedFloors = useMemo(() => {
    const set = new Set<string>()
    staff.forEach(s => { if (s.floor) set.add(s.floor) })
    return [...set].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }))
  }, [staff])

  /** 층별 주간·야간 소계 — 전체 근무표 보기와 같은 함수로 묶는다(utils/floorSubtotals).
   *  두 화면이 다른 규칙으로 나뉘면 같은 달을 놓고 숫자가 어긋난다. */
  const bodyRows = useMemo(() => {
    // 가나다·입사순으로 보면 층이 뒤섞인다. 그 목록에 소계를 끼우면 한 층이
    // 여러 토막으로 갈라져 같은 층 소계가 몇 번씩 나온다 — 그럴 바엔 내지 않는다.
    if (sortMode !== 'basic') return shownStaff.map(p => ({ kind: 'person' as const, p }))
    return withFloorSubtotals(shownStaff, canJoinTeam)
  }, [shownStaff, sortMode])

  /** 뽑는 대상에 요양보호사가 있는가.
   *  없으면 요양보호사 줄들을 인쇄에서 뺀다 — 벽보에 0만 늘어선 줄이
   *  붙으면, 읽는 사람은 그날 아무도 안 나온 줄로 읽는다. */
  const printCG = useMemo(
    () => printHasCaregiver(shownStaff, printPick, canJoinTeam), [shownStaff, printPick])
  /** 요양보호사 말고 다른 직종이 뽑혔는가. 반대쪽도 같은 이유로 뺀다 —
   *  요양보호사만 뽑았는데 '그 외 주간 인원 0 0 0 …' 이 따라가면 안 된다. */
  const printOther = useMemo(
    () => printHasCaregiver(shownStaff, printPick, p => !canJoinTeam(p)), [shownStaff, printPick])
  /** 그 층에 뽑힌 사람이 있는가. 2층만 뽑는데 3층 줄이 0으로 따라가면 안 된다. */
  const printFloor = (f: string) =>
    printHasAnyOf(staff.filter(x => (x.floor || '') === f).map(x => x.id), printPick)

  /** 그 날 그 층에서 주간(D)·야간(N)으로 나오는 요양보호사 수.
   *  인쇄 대상을 골랐으면 그 인원만 센다 — 표에 없는 사람이 숫자에 섞이면 벽보가 안 맞는다. */
  const countOn = (ids: string[], day: number, shift: 'D' | 'N') => {
    let n = 0
    for (const id of ids) {
      if (printPick && !printPick.has(id)) continue
      if (countAsOf(data[id]?.[String(day)]) === shift) n++
    }
    return n
  }

  /** 대기 중인 휴무 신청을 '전부 승인했다 치고' 남는 주간 요양보호사 수.
   *  승인 여부를 정하려면 결국 이 숫자를 봐야 한다 — 머릿속으로 빼지 않게 표에 둔다. */
  const dayCountAfterLeave = (day: number) => {
    const base = printPick ? staff.filter(s => printPick.has(s.id)) : staff
    return base.filter(s => canJoinTeam(s.pos)).reduce((acc, s) => {
      if (countAsOf(data[s.id]?.[String(day)]) !== 'D') return acc
      const waiting = leaveAt.get(`${s.id}:${day}`)?.some(r => r.status === 'pending')
      return acc + (waiting ? 0 : 1)
    }, 0)
  }

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
    const KEY: Record<string, string> = { d: 'D', m: 'M', n: 'N', h: '休', o: '대휴', c: '초과휴', a: 'AD', p: 'PD' }
    const code = KEY[e.key.toLowerCase()]
    if (code) { e.preventDefault(); setCell(staff[si].id, days[di].day, code); setSel({ si, di: Math.min(days.length - 1, di + 1) }) }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); setCell(staff[si].id, days[di].day, '') }
  }

  const [explaining, setExplaining] = useState(false)
  /** 개인별 한 줄 설명 생성 — 근무표 확정 후 버튼으로 실행.
   *  정산 숫자는 화면 계산 그대로 보내고, 문장만 AI가 만든다 (실패 시 서버 템플릿). */
  const explain = async () => {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다.\n설명은 "저장된 근무표"에 붙습니다 — 먼저 저장하는 것을 권합니다.\n그래도 지금 화면 기준으로 만들까요?')) return
    const carryOf = new Map(lastPlans.map(pl => [pl.memberId, pl.closing]))
    const people = staff
      .filter(s2 => Object.keys(data[s2.id] ?? {}).length > 0)
      .map(s2 => {
        const c = calc(s2.id)
        return {
          staff_id: s2.id, name: s2.name, team: s2.team,
          hours: Math.round(c.hours + c.extra), base: Number(baseHours) || base.hours,
          d: c.d, n: c.n, annual: c.annual, daehyu: c.off, comp: c.comp,
          extra: Math.round(c.extra), carry: carryOf.get(s2.id) ?? null,
        }
      })
    if (people.length === 0) { alert('설명을 만들 근무 기록이 없습니다.'); return }
    setExplaining(true)
    try {
      const r = await workScheduleAPI.explain(ym, people)
      alert(`${m}월 개인별 설명 ${r.count}명분을 만들었습니다${r.ai ? ' (AI 작성)' : ' (기본 문구)'}.\n직원들의 "내 근무표" 상단에 표시됩니다.`)
    } catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '설명 생성 실패') }
    finally { setExplaining(false) }
  }

  const toggleLock = async () => {
    const next = !lock.locked
    if (dirty && next) { alert('저장하지 않은 변경이 있습니다.\n먼저 저장한 뒤 잠가주세요.'); return }
    if (!confirm(next
      ? `${m}월 근무표를 확정하고 잠급니다.\n\n· 근무 칸을 고칠 수 없습니다\n· 휴가·맞교대 승인도 막힙니다\n\n잠금은 ADMIN만 풀 수 있습니다.`
      : `${m}월 근무표의 잠금을 풉니다.\n확정된 표가 다시 바뀔 수 있습니다.`)) return
    setLocking(true)
    try {
      const doc = await workScheduleAPI.setLock(ym, next)
      setLock({ locked: !!doc.locked, by: doc.locked_by, at: doc.locked_at })
    } catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
    finally { setLocking(false) }
  }

  const save = async () => {
    /**
     * 직원 목록이 아직 없으면 저장하지 않는다.
     *
     * rows 는 staff 에서 만들어진다. 목록이 비어 있으면 payload 가 빈 배열이
     * 되고, 서버는 그걸 그대로 받아 모두의 조·층·순서를 지운다.
     *
     * 닿을 수 없는 길이 아니다 — 기준시간·기준일수 같은 위쪽 입력은 표를
     * 건드리지 않고도 '저장 안 됨' 을 켠다. 목록을 불러오기 전에(또는
     * 불러오기가 실패한 채로) 그 칸만 고치고 저장하면 그대로 날아간다.
     */
    if (!canSaveRows(staff.length)) {
      alert('직원 목록을 아직 불러오지 못했습니다.\n' +
            '이대로 저장하면 조·층 배정이 지워질 수 있어 멈췄습니다.\n' +
            '잠시 후 다시 저장해 주세요.')
      return
    }
    setSaving(true)
    try {
      // 총시간을 함께 담는다. 엑셀은 백엔드가 만드는데, 파이썬에 같은 계산을
      // 다시 쓰면 언젠가 두 숫자가 갈라진다. 여기서 한 번 계산해 보낸다.
      const payload = buildScheduleRows(staff, calc)
      const doc = await workScheduleAPI.save({ year_month: ym, data, rows: payload, base_hours: baseHours, base_days: baseDays, as_of: asOf, team_offsets: offsets })
      setUpdatedBy(doc.updated_by ?? null); setDirty(false)
      setLock({ locked: !!doc.locked, by: doc.locked_by, at: doc.locked_at })

      // 근무표가 나와도 아무도 모르면 소용없다 — 저장 직후 알림을 제안한다.
      // 편집 중간 저장도 있으니 자동 발송은 하지 않고 매번 물어본다.
      if (confirm(`${m}월 근무표를 저장했습니다.\n\n직원들에게 "근무표가 나왔습니다" 알림을 보낼까요?\n(직원앱에서 누르면 본인 근무표가 바로 열립니다)`)) {
        try {
          const r = await workScheduleAPI.notify(ym)
          alert(r.tokens === 0
            ? '직원앱에 등록된 기기가 없어 알림은 발송되지 않았습니다.'
            : `직원 기기 ${r.tokens}대 중 ${r.sent}대에 알림을 보냈습니다.`)
        } catch (e: any) { alert(e?.message ?? '알림 발송 실패 (근무표 저장은 완료됨)') }
      }
    } catch (e: any) { alert(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  const th = 'border border-gray-300 px-1 py-1 text-[10px] font-bold text-gray-600 bg-gray-50 whitespace-nowrap'
  const td = 'border border-gray-200 px-1 py-0.5 text-[11px] text-center whitespace-nowrap'

  return (
    <div className={`p-4 md:p-6 max-w-full ${fullPrint ? 'ws-full' : ''} ${attPick ? 'att-mode' : ''}`}>
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
            <button onClick={() => setLeaveOpen(true)}
              className="relative inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              <Inbox className="w-4 h-4" /> 휴무 신청
              {leavePending > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] font-extrabold bg-amber-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{leavePending}</span>
              )}
            </button>
            {/* 층으로 걸러 보기 — 그 층 요양보호사만 남는다.
                보기만 바꾼다. 저장·검수·자동생성은 늘 전체 인원 그대로다. */}
            {floors.length > 0 && (
              <div className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden print:hidden"
                title={floorPick ? `${floorPick} 만 보는 중 — 저장·자동생성은 전체 인원 그대로입니다` : undefined}>
                <span className="px-2 text-[11px] font-bold text-gray-400 select-none">층</span>
                {[{ v: '', label: '전체' }, ...floors.map(f => ({ v: f, label: f }))].map(o => (
                  <button key={o.v || 'all'} onClick={() => setFloorPick(o.v)}
                    title={o.v ? `${o.v} 요양보호사만 봅니다` : '모든 인원을 봅니다'}
                    className={`px-2.5 py-2.5 text-sm font-semibold border-l border-gray-200 transition-colors ${
                      floorPick === o.v
                        ? 'bg-teal-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowFloor(v => !v)}
              title="요양보호사 담당 층을 표에 보여줍니다 (인쇄에도 나옵니다)"
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-semibold ${showFloor ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {showFloor ? '✓ ' : ''}층 표시
            </button>
            <button onClick={() => setTeamOpen(v => !v)} className={`inline-flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-semibold ${teamOpen ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Users className="w-4 h-4" /> 조 편성
            </button>
            <button onClick={() => setPickOpen(true)} disabled={building} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm">
              {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 근무표 자동 생성
            </button>
            <button onClick={() => autoRotate(false)} title="교대조만 다시 채웁니다"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-50">
              <Wand2 className="w-4 h-4" /> 교대조만
            </button>
            <button onClick={() => setHistOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              <History className="w-4 h-4" /> 저장 이력
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await apiClient.get(`/api/v1/admin/work-schedule/export`, {
                    params: { month: ym }, responseType: 'blob',
                  })
                  const url = URL.createObjectURL(res.data)
                  const a = document.createElement('a')
                  a.href = url
                  const t = new Date()
                  const p2 = (n: number) => String(n).padStart(2, '0')
                  a.download = `${ym.slice(2, 4)}.${ym.slice(5, 7)}월 (${String(t.getFullYear()).slice(2)}.${p2(t.getMonth() + 1)}.${p2(t.getDate())}).xlsx`
                  a.click()
                  setTimeout(() => URL.revokeObjectURL(url), 3000)
                } catch {
                  alert('저장된 근무표가 없거나 다운로드에 실패했습니다. 먼저 「저장」을 해주세요.')
                }
              }}
              title="저장된 최종본을 엑셀로 — 색상·정렬 포함"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-emerald-200 bg-emerald-50 rounded-xl text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              <FileSpreadsheet className="w-4 h-4" /> 엑셀
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
            {/* 정렬 — 기본은 직종·조 순(A·B·C조 → 주간), 필요할 때만 바꾼다 */}
            <div className="inline-flex bg-gray-100 rounded-xl p-0.5">
              {([['basic', '기본'], ['name', '가나다'], ['hire', '입사순']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setSortMode(v)}
                  title={v === 'basic' ? '직종 → 교대조(A·B·C) → 주간 → 층 → 입사순 (층 소계는 이 정렬에서만 나옵니다)' : '층이 뒤섞이므로 층 소계는 나오지 않습니다'}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    sortMode === v ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => {
              if (dirty && !confirm('저장하지 않은 변경이 있습니다. 현재 화면 기준으로 근무상황부를 인쇄합니다.\n계속할까요?')) return
              setAttPickOpen(true)
            }}
              title="사람마다 한 장씩 — 성명·근무형태가 채워진 출석부를 선택 인원만큼 인쇄합니다"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold">
              근무상황부
            </button>
            <button onClick={explain} disabled={explaining}
              title="개인별 '이번 달 내 근무 정리' 한 줄을 만들어 직원 내 근무표에 띄웁니다"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 rounded-xl text-sm font-semibold">
              {explaining ? '생성 중…' : '설명 생성'}
            </button>
            {isAdminUser && (
              <button onClick={toggleLock} disabled={locking}
                title={lock.locked ? '잠금을 풀면 다시 고칠 수 있습니다' : '확정하면 아무도 못 고칩니다'}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-40 ${
                  lock.locked ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                {lock.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                {locking ? '…' : lock.locked ? '잠금 해제' : '확정 잠금'}
              </button>
            )}
            <button onClick={save} disabled={saving || !dirty || lock.locked}
              title={lock.locked ? '확정 잠금 상태라 저장할 수 없습니다' : undefined}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold shadow-sm">
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
          <span className="text-gray-200 mx-0.5">|</span>
          <span className="text-[11px] font-semibold text-gray-400">시간 직접</span>
          {/* 단축·추가근무를 손으로 넣을 때 — 자주 쓰는 시간대는 칠하기만 하면 된다 */}
          {['0850~1400', '0850~1600', '0850~1700'].map(t => (
            <button key={t} onClick={() => setBrush(t)} title={`${extraHoursOf(t)}시간 근무 — D 자리에 칠하면 단축(갚음), 쉬는 날에 칠하면 추가근무`}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${brush === t ? 'bg-violet-100 text-violet-800 border-violet-300 ring-2 ring-offset-1 ring-violet-200' : 'bg-white border-gray-200 text-gray-500'}`}>
              {t.replace('~', '–')}<span className="font-normal text-gray-400"> {extraHoursOf(t)}h</span>
            </button>
          ))}
          <button onClick={() => {
            const t = prompt('근무 시간대 입력 (예: 0850~1500)', '0850~')
            if (t && extraHoursOf(t) > 0) setBrush(t.trim())
            else if (t) alert('형식을 읽지 못했습니다. 0850~1500 처럼 입력해주세요.')
          }} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border ${brush.includes('~') && !['0850~1400','0850~1600','0850~1700'].includes(brush) ? 'bg-violet-100 text-violet-800 border-violet-300 ring-2 ring-offset-1 ring-violet-200' : 'bg-white border-gray-200 text-gray-500'}`}>
            기타 시간…
          </button>
          <button onClick={() => setBrush('')} className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border ${brush === '' ? 'bg-gray-200 text-gray-700 ring-2 ring-offset-1 ring-gray-300' : 'bg-white border-gray-200 text-gray-400'}`}>
            <Eraser className="w-3 h-3" /> 지우기
          </button>
          <button onClick={() => {
            if (lock.locked) { alert(LOCK_MSG); return }
            const filled = Object.values(data).reduce((a, m2) => a + Object.keys(m2 || {}).length, 0)
            if (filled === 0) { alert('지울 근무가 없습니다.'); return }
            if (!confirm(`${Number(ym.slice(5, 7))}월 근무 ${filled}칸을 전부 지울까요?\n(조 편성·비고는 남고, 「저장」을 눌러야 서버에 반영됩니다)`)) return
            setData({})
          }}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border border-red-200 text-red-500 hover:bg-red-50">
            <Trash2 className="w-3 h-3" /> 전체 지우기
          </button>
          <span className="text-[11px] text-gray-400 ml-2">칸을 누르거나 끌면 칠해집니다 · 두 번 누르면 직접 입력 · 선택 후 <b>D M N H O C</b> 키와 방향키로도 편성됩니다</span>
        </div>

        {teamOpen && (
          <TeamPanel
            staff={staff} patchRow={patchRow} offsets={offsets} setOffsets={setOffsets} setDirty={setDirty}
            floors={floors}
            anchor={anchor} setAnchor={setAnchor} settleStart={settleStart} setSettleStart={setSettleStart}
          />
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

        <SettlementPanel plans={lastPlans} onClose={() => setLastPlans([])} settleStart={settleStart}
          wage={wage} setWage={setWage} rate={rate} setRate={setRate} />

        <AuditPanel issues={issues} danger={danger} open={auditOpen} onToggle={() => setAuditOpen(v => !v)}
          minStaff={minStaff} setMinStaff={setMinStaff} onFocus={setFocus} />
      </div>

      {/* 인쇄 머리말 — 결재란은 인쇄물에만 */}
      <div className="hidden print:flex items-start justify-between mb-1">
        <div />
        <table className={`print-approve ${attPick ? 'print:hidden' : ''}`}>
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
      <h2 className={`text-center text-base md:text-lg font-bold text-gray-900 mb-2 print:mb-1 ${attPick ? 'print:hidden' : ''}`}>
        행복한 요양원 <span className="text-teal-700">{y}년 {m}월</span> 근무 편성표
        <span className="block text-xs font-semibold text-gray-500 print:text-[9pt] print:mt-0.5">
          작성 기준 {asOf ? `${Number(asOf.slice(5, 7))}월 ${Number(asOf.slice(8, 10))}일` : '-'}
        </span>
      </h2>

      {attPickOpen && (
        <GeneratePickModal staff={staff} title="근무상황부 인쇄 대상" verb="인쇄" hint="사람마다 A4 한 장 — 성명과 근무형태가 채워져 나옵니다"
          onClose={() => setAttPickOpen(false)}
          onConfirm={ids => { setAttPickOpen(false); setAttPick(ids) }} />
      )}
      {attPick && (
        <AttendanceSheets ym={ym} holidays={holidays}
          staff={staff.filter(s2 => attPick.has(s2.id))} />
      )}

      {lock.locked && (
        <div className="print:hidden rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <p className="text-xs text-amber-800">
            <b>확정된 근무표입니다 — 고칠 수 없습니다.</b>
            {lock.by && <span className="ml-1 font-normal">{lock.by}</span>}
            {lock.at && (
              <span className="ml-1 font-normal text-amber-600">
                {new Date(lock.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span className="block text-[11px] text-amber-600 mt-0.5">
              휴가·맞교대 승인도 함께 막힙니다. 고치려면 위에서 잠금을 풀어주세요{isAdminUser ? '' : ' (ADMIN만 가능)'}.
            </span>
          </p>
        </div>
      )}

      {pendingLeaves.length > 0 && (
        // 표 바로 위에 둔다 — 어느 날인지 짚어 보고 표에서 인원을 확인한 뒤 정한다
        <div className="print:hidden rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-bold text-amber-800 mb-1.5">
            처리 안 한 휴무 신청 {pendingLeaves.length}건
            <span className="ml-1.5 font-normal text-amber-600">
              표에서 주황 모서리(◤)를 누르면 그 자리에서 승인·반려할 수 있어요
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pendingLeaves.map(r => (
              <button key={r.id} onClick={() => setLeavePick(r)}
                onMouseEnter={() => setFocus({ staffId: r.staff_id, day: Number(r.date.slice(8, 10)) })}
                onMouseLeave={() => setFocus(null)}
                className="px-2 py-1 rounded-lg bg-white border border-amber-200 text-xs font-semibold text-gray-700 hover:border-amber-400">
                {Number(r.date.slice(8, 10))}일 · {r.staff_name}
                <span className={`ml-1 font-normal ${r.kind === '연차' ? 'text-emerald-600' : 'text-sky-600'}`}>
                  {r.kind}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {leavePick && (
        <LeaveDecideModal req={leavePick} onClose={() => setLeavePick(null)}
          onDone={() => {
            setLeavePick(null)
            loadLeaves()
            // 승인이 근무표 칸을 바꿨을 수 있다(연차는 休가 들어간다) — 다시 불러온다
            workScheduleAPI.get(ym).then(doc => setData(doc.data || {})).catch(() => {})
            Promise.all([
              leaveAPI.list(undefined, 'pending').catch(() => []),
              swapAPI.list('pending').catch(() => []),
            ]).then(([l, sw]) => setLeavePending(l.length + sw.length))
          }} />
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
      ) : (
        <div className={`ws-wrap overflow-x-auto border border-gray-200 rounded-xl bg-white outline-none ${attPick ? 'print:hidden' : ''}`} tabIndex={0} onKeyDown={onKey}>
          {floorPick && (
            <div className="mb-2 text-[11.5px] text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              <b>{floorPick}</b> 요양보호사만 보고 있습니다 — 층이 없는 직종(간호·사회복지 등)은 그대로 나옵니다.
              {hiddenNoFloor > 0 && (
                <span className="text-amber-700"> · 층을 지정하지 않은 요양보호사 {hiddenNoFloor}명은 숨겨졌습니다.</span>
              )}
              <span className="text-teal-600"> 저장·자동생성은 전체 인원 그대로 됩니다.</span>
            </div>
          )}
          <table className="ws-table border-collapse" style={{ minWidth: 1400 }}>
            <colgroup>
              <col className="c-pos" /><col className="c-team" />{showFloor && <col className="c-floor" />}<col className="c-name" />
              {days.map(({ day }) => <col key={day} />)}
              <col className="c-agg c-sum" /><col className="c-agg c-cnt" /><col className="c-agg c-cnt" />
              <col className="c-agg c-off" /><col className="c-agg c-off" /><col className="c-agg c-comp" />
              <col className="c-agg c-ext" /><col className="c-agg c-memo" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${th} sticky left-0 z-20`}>직종</th>
                <th className={th}>조</th>
                {showFloor && <th className={th}>층</th>}
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
                <th className={th} colSpan={showFloor ? 4 : 3}><span className="print:hidden">{baseHours}시간 / {baseDays}일 기준</span></th>
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
              {bodyRows.map(row => {
                // ── 층 소계 두 줄 — 그 층 요양보호사가 끝나는 자리에 낀다 ──
                if (row.kind === 'subtotal') {
                  const isDay = row.shift === 'D'
                  // 2층만 뽑는데 3층 소계가 0으로 따라 나가면 안 된다 — 층마다 따로 본다
                  const inPrint = printHasAnyOf(row.ids, printPick)
                  return (
                    <tr key={`sub-${row.floor}-${row.shift}`}
                      className={`ws-row-sum ${isDay ? 'bg-sky-50/70' : 'bg-indigo-50/70'} ${inPrint ? '' : 'print:hidden'}`}>
                      <td colSpan={showFloor ? 4 : 3}
                        className={`${td} font-bold sticky left-0 z-10 ${
                          isDay ? 'bg-sky-50 text-sky-800' : 'bg-indigo-50 text-indigo-800'}`}>
                        {row.floor || '층 미지정'} {isDay ? '주간 소계' : '야간 소계'}
                        <span className="font-normal text-gray-400"> (요양보호사)</span>
                      </td>
                      {days.map(({ day }) => {
                        const n = countOn(row.ids, day, row.shift)
                        return (
                          <td key={day}
                            className={`${td} font-bold ${
                              // 0 은 흐리게 — 그 층에 아무도 없는 날이 눈에 띄어야 한다
                              n === 0 ? 'text-gray-300'
                              : isDay ? 'text-sky-800' : 'text-indigo-800'
                            } ${focus?.day === day ? 'outline outline-2 outline-amber-400' : ''}`}>
                            {n}
                          </td>
                        )
                      })}
                      <td className={`${td} ws-agg`} colSpan={8} />
                    </tr>
                  )
                }

                const s = row.p
                const c = calc(s.id)
                const bh = Number(baseHours) || 0
                const short = bh > 0 && c.total < bh        // 미달 — 급여가 깎이는 쪽이라 빨갛게
                const over = bh > 0 && c.total > bh
                return (
                  <tr key={s.id} className={`hover:bg-indigo-50/20 ${focus?.staffId === s.id ? 'bg-amber-50' : ''} ${printPick && !printPick.has(s.id) ? 'print:hidden' : ''}`}>
                    <td className={`${td} sticky left-0 z-10 bg-white font-semibold text-gray-600 relative`}>
                      {s.team && TEAM_BAND[s.team] && <span className={`absolute left-0 top-0 bottom-0 w-1 ${TEAM_BAND[s.team]}`} />}
                      {s.pos || '-'}
                    </td>
                    <td className={`${td} text-gray-500`}>{s.team || ''}</td>
                    {showFloor && (
                      <td className={`${td} text-gray-500 font-semibold`}>{s.floor || ''}</td>
                    )}
                    <td className={`${td} ws-name sticky left-0 z-10 bg-white font-bold text-gray-800 group/nm relative`}>
                      {s.name}
                      <button type="button" tabIndex={-1}
                        onClick={e => {
                          e.stopPropagation()
                          if (lock.locked) { alert(LOCK_MSG); return }
                          const n = Object.keys(data[s.id] ?? {}).length
                          if (n === 0) { alert(`${s.name} 님은 지울 근무가 없습니다.`); return }
                          if (!confirm(`${s.name} 님의 이번 달 근무 ${n}칸을 지울까요?`)) return
                          setData(prev => { const nx = { ...prev }; delete nx[s.id]; return nx })
                        }}
                        title="이 줄 근무 전체 지우기"
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/nm:opacity-100 print:hidden p-0.5 text-gray-300 hover:text-red-500 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                    {days.map(({ day, dow }, di) => {
                      const v = data[s.id]?.[String(day)] ?? ''
                      const mt = meta(v)
                      const si = staff.findIndex(x => x.id === s.id)
                      const picked = sel?.si === si && sel?.di === di
                      const lit = focus?.day === day || (focus?.staffId === s.id && focus?.day === undefined)
                      // 단축 근무: 교대조의 D 자리에 8시간 미만 시간대가 적혀 있으면
                      // 초과근무를 갚느라 일찍 퇴근하는 날이다 — 노랑(추가근무)과 구분한다
                      const isShift = canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? '')
                      const customH = extraHoursOf(v)
                      const shortened = isShift && customH > 0 && customH < DAILY_HOURS
                        && rotationFor(s.team, day, offsets, ym, anchor) === 'D'
                      const req = leaveAt.get(`${s.id}:${day}`)?.[0]
                      return (
                        <td key={day}
                          onMouseDown={() => { painting.current = true; setSel({ si, di }); setCell(s.id, day, brush) }}
                          onMouseEnter={() => { if (painting.current) setCell(s.id, day, brush) }}
                          onDoubleClick={() => {
                            const t = prompt(`${s.name} · ${m}월 ${day}일 근무 (예: D, N, 대휴, 0850 1600)`, v)
                            if (t !== null) setCell(s.id, day, t.trim())
                          }}
                          title={shortened
                            ? `단축 근무 — 초과근무 ${Math.round((DAILY_HOURS - customH) * 10) / 10}시간 갚는 날 (${customH}시간 근무)`
                            : mt ? `${mt.label}${mt.time ? ` ${mt.time}` : ''}` : v}
                          data-code={v}
                          data-shorten={shortened ? '1' : undefined}
                          // 시간을 직접 적은 칸(추가근무). 인쇄에서 진하게 칠하려고 표식을 둔다.
                          // 예전에는 data-code 에 '~' 가 들었는지로 골랐는데, 실제 데이터는
                          // '0930 1230' 처럼 공백을 쓰는 것이 많아 한 번도 안 걸렸다.
                          data-extra={!shortened && splitTimeRange(v) ? '1' : undefined}
                          className={`${td} ws-cell relative cursor-pointer select-none ${mt ? mt.cls : shortened ? 'bg-violet-100 text-violet-900 text-[9px] leading-tight' : v ? 'bg-yellow-50 text-gray-700 text-[9px] leading-tight' : dayTone(day, dow) === 'red' ? 'bg-red-50/70' : dayTone(day, dow) === 'blue' ? 'bg-blue-50/70' : dayTone(day, dow) === 'paid' ? 'bg-violet-50/60' : ''} ${day === todayCol ? 'ring-1 ring-inset ring-indigo-200' : ''} ${lit ? 'outline outline-2 outline-amber-400' : ''} ${picked ? 'ring-2 ring-inset ring-gray-800' : ''}`}>
                          {(() => {
                            const tr = splitTimeRange(v)
                            // 시간대는 좁은 칸에 한 줄로 안 들어가 잘린다 → 시작/끝을 두 줄로
                            if (tr) return <span className="ws-time">{tr[0]}<br />{tr[1]}</span>
                            return <span className="ws-code">{shortOf(v)}</span>
                          })()}
                          {req && (
                            // 신청 표식 — 눌러서 그 자리에서 승인·반려한다.
                            // 칠하기(mousedown)와 겹치지 않게 이벤트를 여기서 끊는다.
                            <button
                              onMouseDown={ev => { ev.stopPropagation(); ev.preventDefault() }}
                              onClick={ev => { ev.stopPropagation(); setLeavePick(req) }}
                              title={`${s.name} · ${m}월 ${day}일 ${req.kind} ${req.status === 'pending' ? '신청 (대기)' : '승인됨'}\n눌러서 처리`}
                              className={`ws-req absolute top-0 right-0 print:hidden ${
                                req.status === 'pending' ? 'ws-req-wait' : 'ws-req-ok'}`} />
                          )}
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
              {/* 요양보호사를 한 명도 안 뽑았으면 인쇄에서 뺀다 */}
              <tr className={`ws-row-sum bg-gray-50 ${printCG ? '' : 'print:hidden'}`}>
                <td className={`${td} font-bold text-gray-600 sticky left-0 z-10 bg-gray-50`} colSpan={showFloor ? 4 : 3}>요양보호사 주간 인원 <span className="font-normal text-gray-400">(야간 제외)</span></td>
                {days.map(({ day }) => {
                  const n = dayCountBy(day, true)
                  return (
                    <td key={day}
                      className={`${td} font-bold ${n === 0 ? 'bg-red-100 text-red-700' : n < minStaff ? 'bg-amber-100 text-amber-800' : 'text-gray-700'} ${focus?.day === day ? 'outline outline-2 outline-amber-400' : ''}`}>
                      {n || '0'}
                    </td>
                  )
                })}
                <td className={`${td} ws-agg`} colSpan={8} />
              </tr>
              {pendingLeaves.length > 0 && (
                // 신청이 있을 때만 낸다. 없으면 윗줄과 같은 숫자라 눈만 어지럽다.
                // 벽에 붙는 문서가 아니라 정하려고 보는 줄이므로 인쇄에서는 뺀다.
                <tr className="ws-row-sum bg-amber-50/70 print:hidden">
                  <td className={`${td} font-bold text-amber-800 sticky left-0 z-10 bg-amber-50`} colSpan={showFloor ? 4 : 3}>
                    신청 다 받아주면 <span className="font-normal text-amber-600">(대기 중 휴무 신청 {pendingLeaves.length}건 뺀 수)</span>
                  </td>
                  {days.map(({ day }) => {
                    const n = dayCountAfterLeave(day)
                    const before = dayCountBy(day, true)
                    const cut = before - n
                    return (
                      <td key={day}
                        title={cut > 0
                          ? `${m}월 ${day}일 — 지금 ${before}명, 신청 ${cut}건 받아주면 ${n}명`
                          : undefined}
                        className={`${td} font-bold ${
                          cut === 0 ? 'text-amber-900/30'
                          : n === 0 ? 'bg-red-200 text-red-800'
                          : n < minStaff ? 'bg-red-100 text-red-700'
                          : 'text-amber-900'} ${focus?.day === day ? 'outline outline-2 outline-amber-400' : ''}`}>
                        {n || '0'}
                      </td>
                    )
                  })}
                  <td className={`${td} ws-agg`} colSpan={8} />
                </tr>
              )}
              <tr className={`ws-row-sum bg-gray-50/60 ${printOther ? '' : 'print:hidden'}`}>
                <td className={`${td} font-semibold text-gray-500 sticky left-0 z-10 bg-gray-50`} colSpan={showFloor ? 4 : 3}>그 외 주간 인원</td>
                {days.map(({ day }) => (
                  <td key={day} className={`${td} text-gray-500`}>{dayCountBy(day, false) || '0'}</td>
                ))}
                <td className={`${td} ws-agg`} colSpan={8} />
              </tr>
              {/* 층별 주간 인원 — 층을 켰을 때만. 간호·사회복지까지 포함한 그 층 전체 인원이다.
                  표 안의 '2층 주간 소계' 는 요양보호사만 세므로 숫자가 다르다 — 라벨로 구분한다. */}
              {showFloor && usedFloors.map(f => (
                <tr key={f} className={`ws-row-sum bg-teal-50/40 ${printFloor(f) ? '' : 'print:hidden'}`}>
                  <td className={`${td} font-semibold text-teal-800 sticky left-0 z-10 bg-teal-50`} colSpan={4}>
                    {f} 주간 인원 <span className="font-normal text-teal-600/70">(전 직종)</span>
                  </td>
                  {days.map(({ day }) => {
                    const n = dayCountFloor(day, f)
                    return (
                      <td key={day}
                        className={`${td} font-bold ${n === 0 ? 'bg-red-100 text-red-700' : 'text-teal-800'} ${focus?.day === day ? 'outline outline-2 outline-amber-400' : ''}`}>
                        {n || '0'}
                      </td>
                    )
                  })}
                  <td className={`${td} ws-agg`} colSpan={8} />
                </tr>
              ))}
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
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500" title="예: 0850~1600 = 6시간 근무, 초과근무 2시간 갚음">
          <span className="w-3 h-3 rounded bg-violet-100 border border-violet-300" /> 단축 근무(초과근무 갚는 날)
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
          <span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-300" /> 추가근무(쉬는 날 나옴)
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

      {pickOpen && (
        <GeneratePickModal
          staff={staff}
          onClose={() => setPickOpen(false)}
          onConfirm={ids => { setPickOpen(false); autoBuild(ids) }}
        />
      )}

      {leaveOpen && (
        <LeaveInboxPanel
          onClose={() => setLeaveOpen(false)}
          onChanged={() => {
            // 승인이 근무표 칸을 바꿨을 수 있다 — 현재 달 다시 불러오고 배지 갱신
            Promise.all([
              leaveAPI.list(undefined, 'pending').catch(() => []),
              swapAPI.list('pending').catch(() => []),
            ]).then(([l, sw]) => setLeavePending(l.length + sw.length))
            workScheduleAPI.get(ym).then(doc => { setData(doc.data || {}) }).catch(() => {})
          }}
        />
      )}

      {printPickOpen && (
        <GeneratePickModal
          staff={staff} title="인쇄할 직원" verb="인쇄"
          hint="뺀 사람은 이번 인쇄물에서만 빠집니다 (화면·데이터는 그대로)"
          onClose={() => setPrintPickOpen(false)}
          onConfirm={printPicked}
        />
      )}

      {histOpen && (
        <ScheduleHistoryModal
          month={ym}
          onClose={() => setHistOpen(false)}
          onLoad={v => {
            if (lock.locked) { alert(LOCK_MSG); return }
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
        /* ── 휴무 신청 표식 ──────────────────────────────────────
           칸 오른쪽 위 모서리를 접은 것처럼 보이는 작은 삼각형.
           칸 글자를 가리지 않으면서 '여기 신청이 있다'를 알린다.
           대기는 주황(처리해야 할 일), 승인은 파랑(이미 정해진 일). */
        .ws-req { width: 0; height: 0; border-style: solid; border-width: 0 7px 7px 0; cursor: pointer; }
        .ws-req-wait { border-color: transparent #f59e0b transparent transparent; }
        .ws-req-ok   { border-color: transparent #0ea5e9 transparent transparent; }
        .ws-req:hover { border-width: 0 10px 10px 0; }

        /* ── 인쇄 ────────────────────────────────────────────────
           게시용은 벽에 붙여 여러 명이 멀리서 보는 문서다.
           총시간·초과휴 같은 숫자는 '왜 저 사람은 나보다 많지?'라는 오해를 부르므로
           빼고, 대신 근무 칸과 이름을 크게 키운다. 관리·결재용은 집계까지 모두 넣는다. */
        .print-approve, .print-approve td { border: 0.4mm solid #000; border-collapse: collapse; }
        /* 근무상황부 — 사람마다 한 장 */
        @media print {
          .att-sheets { display: block !important; }
          /* A4 한 장에 딱 — 고정 높이 플렉스 컬럼, 표가 남는 공간을 전부 차지해
             행 높이가 자동으로 늘어난다 (달 길이와 무관하게 항상 꽉 찬 한 장) */
          /* 컨테이너 패딩·인쇄 헤더 잔여 여백까지 0으로 — att-page 높이만 지면을 차지 */
          .att-mode { padding: 0 !important; }
          .att-mode > *:not(.att-sheets) { display: none !important; }
          .att-page {
            page-break-after: always;
            box-sizing: border-box;
            height: 276mm;            /* 세로 A4 297mm - @page 여백 18mm - 여유 3mm */
            overflow: hidden;
            padding: 2mm 4mm 0;
            display: flex;
            flex-direction: column;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .att-page:last-child { page-break-after: auto; }
          .att-page table { width: auto; }
          .att-table { width: 100% !important; flex: 1 1 auto; height: 100%; }
          /* 일요일·공휴일 빨강 / 토요일 파랑 — 근무표와 같은 색 약속 */
          .att-red  { color: #dc2626 !important; background: #fef2f2 !important; }
          .att-blue { color: #2563eb !important; background: #eff6ff !important; }
        }
        /* 화면에서도 시간대는 두 줄로 (칸이 좁아 잘리는 건 마찬가지) */
        .ws-time { display: block; line-height: 1.05; font-size: 9px; font-variant-numeric: tabular-nums; }
        @media print {
          @page { size: A4 ${attPick ? 'portrait' : 'landscape'}; margin: ${attPick ? '9mm 12mm' : '6mm'}; }
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
          /* 줄무늬는 근무 색(D·N·대휴…)을 덮어써서 짝수 행 색이 안 나왔다 → 인쇄에선 제거.
             대신 의미 있는 칸은 진하게 강제해 흑백 복사에도 살아남게 한다. */
          .ws-table td[data-shorten] { background: #ddd6fe !important; }                       /* 단축 근무(갚는 날) */
          .ws-table td[data-extra] { background: #fde68a !important; }                         /* 추가근무(쉬는 날) */

          /* 화면에서만 뜻이 있는 테두리는 인쇄에서 지운다.
             '오늘 열' 파란 테두리, 고른 칸의 검은 테두리, 눈길 표시 노란 테두리 —
             벽에 붙는 문서에 오늘이 표시될 이유가 없고, 마우스로 눌러 둔 칸이
             그대로 인쇄되면 근무를 잘못 적은 것처럼 보인다.
             (Tailwind 의 ring 은 box-shadow 로 그려진다) */
          .ws-table th, .ws-table td { box-shadow: none !important; outline: none !important; }
          .ws-table td[data-code="대휴"] { background: #fcd34d !important; }
          .ws-table td[data-code="초과휴"] { background: #c4b5fd !important; }
          .ws-table td[data-code="休"], .ws-table td[data-code="반"] { background: #a7f3d0 !important; }

          /* 고정열 폭 */
          .ws-table col.c-pos { width: 14mm; }
          .ws-table col.c-team { width: 7mm; }
          .ws-table col.c-floor { width: 8mm; }
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


/* ── 표 위에서 바로 승인·반려 ───────────────────────────────────
 * 신청함을 따로 열면 그날 인원이 어땠는지 기억해서 판단해야 한다.
 * 표를 띄운 채로 정할 수 있게, 필요한 것만 담은 작은 창으로 둔다.
 */
function LeaveDecideModal({ req, onClose, onDone }: {
  req: LeaveRequest; onClose: () => void; onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const d = Number(req.date.slice(8, 10))
  const mm = Number(req.date.slice(5, 7))
  const w = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(Number(req.date.slice(0, 4)), mm - 1, d).getDay()]

  const decide = async (approve: boolean) => {
    let note: string | undefined
    if (!approve) {
      const t = prompt(`${req.staff_name} · ${mm}월 ${d}일 ${req.kind} 반려 사유 (신청자에게 전달됩니다)`, '')
      if (t === null) return
      note = t.trim() || undefined
    }
    setBusy(true); setErr('')
    try { await leaveAPI.decide(req.id, approve, note); onDone() }
    catch (e: any) { setErr(e?.response?.data?.detail ?? '처리 실패') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-gray-900">휴무 신청</h3>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>

        <p className="text-lg font-black text-gray-900">{req.staff_name}</p>
        <p className="text-sm text-gray-500 mt-0.5">
          {mm}월 {d}일({w}) ·
          <span className={`ml-1 font-bold ${req.kind === '연차' ? 'text-emerald-600' : 'text-sky-600'}`}>
            {req.kind}
          </span>
          {req.kind === '희망휴무' && (
            <span className="ml-1 text-xs text-gray-400">
              {req.use_annual ? '(연차로 반영)' : '(연차 안 씀)'}
            </span>
          )}
        </p>
        {req.reason && <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-xl px-3 py-2">{req.reason}</p>}

        {req.status !== 'pending' ? (
          <p className="text-sm text-gray-500 mt-4 bg-gray-50 rounded-xl px-3 py-3 text-center">
            이미 {req.status === 'approved' ? '승인' : '반려'}된 신청입니다
            {req.decided_by ? ` · ${req.decided_by}` : ''}
          </p>
        ) : (<>
          <p className="text-[11px] text-gray-400 mt-3">
            표에서 그날 인원을 확인하고 정해주세요. 승인하면 신청자에게 알림이 갑니다.
          </p>
          {err && <p className="text-xs text-rose-600 mt-2">{err}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => decide(false)} disabled={busy}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 disabled:opacity-50">
              반려
            </button>
            <button onClick={() => decide(true)} disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              {busy && <Loader2 size={14} className="animate-spin" />} 승인
            </button>
          </div>
        </>)}

        {req.signature_url && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 mb-1">신청자 서명</p>
            <img src={signatureUrl(req.signature_url) ?? ''} alt="서명"
              className="h-12 object-contain" />
          </div>
        )}
      </div>
    </div>
  )
}