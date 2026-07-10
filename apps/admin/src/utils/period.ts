// 주기 관련 유틸리티

export type Frequency =
  | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'
  | 'weekly_dow' | 'monthly_day' | 'monthly_nth_dow'
  | 'on_admission' | 'on_discharge' | 'on_hire'
  | 'one_time'

export const RECURRING: Frequency[] = ['daily','weekly','weekly_dow','monthly','monthly_day','monthly_nth_dow','quarterly','half-yearly','yearly']
export const EVENT_FREQS: Frequency[] = ['on_admission','on_discharge','on_hire']

// 저장된 frequency 값의 표기 흔들림(언더스코어/하이픈 등)을 표준값으로 정규화한다.
// 예: 'half_yearly' → 'half-yearly' (이게 안 되면 반기별 필터/라벨에 안 걸림)
const FREQUENCY_ALIASES: Record<string, Frequency> = {
  half_yearly: 'half-yearly',
  halfyearly: 'half-yearly',
  semiannual: 'half-yearly',
  semi_annual: 'half-yearly',
}
export function normalizeFrequency(freq: string | null | undefined): string {
  if (!freq) return freq ?? ''
  const key = String(freq).trim()
  return FREQUENCY_ALIASES[key] ?? FREQUENCY_ALIASES[key.toLowerCase()] ?? key
}

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: '일일', weekly: '주별', monthly: '월별', quarterly: '분기별',
  'half-yearly': '반기별', yearly: '연별',
  weekly_dow: '매주 요일', monthly_day: '매월 지정일', monthly_nth_dow: '매월 N째주',
  on_admission: '입소 시', on_discharge: '퇴소 시', on_hire: '입사 시',
  one_time: '일회성',
}

export const FREQUENCY_COLORS: Record<string, string> = {
  daily:        'bg-blue-100 text-blue-800',
  weekly:       'bg-green-100 text-green-800',
  monthly:      'bg-purple-100 text-purple-800',
  quarterly:    'bg-orange-100 text-orange-800',
  'half-yearly':'bg-pink-100 text-pink-800',
  yearly:       'bg-red-100 text-red-800',
  weekly_dow:   'bg-green-100 text-green-800',
  monthly_day:  'bg-purple-100 text-purple-800',
  monthly_nth_dow: 'bg-purple-100 text-purple-800',
  on_admission: 'bg-teal-100 text-teal-800',
  on_discharge: 'bg-gray-200 text-gray-700',
  on_hire:      'bg-indigo-100 text-indigo-800',
  one_time:     'bg-amber-100 text-amber-800',
}

export const RISK_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-800 border-red-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low:    'bg-green-100 text-green-800 border-green-300',
}
export const RISK_LABELS: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' }

export const DOMAIN_COLORS: Record<string, { bg: string; text: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700' },
}

export interface RecurCfg {
  weekday?: number | null         // 0=일..6=토
  weekOfMonth?: number | null     // 1..5 (5=마지막주)
  day?: number | null             // 1..31 생성일
  dueDay?: number | null          // 1..31 기한일
}

// ChecklistItem(또는 raw)에서 반복 설정 추출
export function cfgFromItem(item: any): RecurCfg {
  if (!item) return {}
  return {
    weekday:     item.recurWeekday     ?? item.recur_weekday      ?? null,
    weekOfMonth: item.recurWeekOfMonth ?? item.recur_week_of_month ?? null,
    day:         item.recurDay         ?? item.recur_day          ?? null,
    dueDay:      item.recurDueDay      ?? item.recur_due_day      ?? null,
  }
}

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function clampDay(y: number, mZeroBased: number, day: number): Date {
  const last = new Date(y, mZeroBased + 1, 0).getDate()
  return new Date(y, mZeroBased, Math.max(1, Math.min(day, last)))
}

// 그 달의 n번째 weekday(0=일..6=토). 해당 주 없으면 마지막 발생일.
export function nthWeekdayOfMonth(y: number, mZeroBased: number, weekday: number, n: number): Date {
  const wd = ((weekday % 7) + 7) % 7
  const first = new Date(y, mZeroBased, 1)
  const firstDow = first.getDay()
  const offset = (wd - firstDow + 7) % 7
  let day = 1 + offset + (Math.max(1, n) - 1) * 7
  const lastDay = new Date(y, mZeroBased + 1, 0).getDate()
  while (day > lastDay) day -= 7
  return new Date(y, mZeroBased, day)
}

export function getPeriodKey(freq: Frequency, date: Date, cfg: RecurCfg = {}): string {
  const y = date.getFullYear()
  const m = date.getMonth()
  switch (freq) {
    case 'weekly_dow': {
      const wd = cfg.weekday == null ? 0 : cfg.weekday
      const sunday = new Date(date); sunday.setDate(date.getDate() - date.getDay()); sunday.setHours(0,0,0,0)
      const target = new Date(sunday); target.setDate(sunday.getDate() + (((wd % 7) + 7) % 7))
      return fmtLocal(target)
    }
    case 'monthly_day':
    case 'monthly_nth_dow':
      return `${y}-${String(m + 1).padStart(2, '0')}`
    case 'daily':       return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
    case 'weekly': {
      // 일요일 시작 기준 (일~토), 백엔드와 동일
      const dayOfWeek = date.getDay()  // 일=0, 월=1, ..., 토=6
      const sunday = new Date(date)
      sunday.setDate(date.getDate() - dayOfWeek)  // 이 주의 일요일
      sunday.setHours(0, 0, 0, 0)
      const jan1   = new Date(sunday.getFullYear(), 0, 1)
      const jan1Dow = jan1.getDay()  // jan1의 요일(일=0)
      const diff = Math.floor((sunday.getTime() - jan1.getTime()) / 86400000)
      const week = Math.floor((diff + jan1Dow) / 7) + 1
      return `${sunday.getFullYear()}-W${String(week).padStart(2, '0')}`
    }
    case 'monthly':     return `${y}-${String(m + 1).padStart(2, '0')}`
    case 'quarterly':   return `${y}-Q${Math.floor(m / 3) + 1}`
    case 'half-yearly': return m < 6 ? `${y}-H1` : `${y}-H2`
    case 'yearly':      return `${y}`
    default:            return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
  }
}

export function getCurrentPeriodKey(freq: Frequency, cfg: RecurCfg = {}): string {
  return getPeriodKey(freq, todayDateKST(), cfg)
}

export function getPeriodLabel(freq: Frequency, key: string, _cfg: RecurCfg = {}): string {
  if (freq === 'daily')       return key
  if (freq === 'weekly_dow')  return key
  if (freq === 'monthly_day' || freq === 'monthly_nth_dow') { const [y,m] = key.split('-'); return `${y}년 ${Number(m)}월` }
  if (freq === 'weekly')      return key.replace('-W', '년 ') + '주차'
  if (freq === 'monthly')     { const [y,m] = key.split('-'); return `${y}년 ${Number(m)}월` }
  if (freq === 'quarterly')   return key.replace('-Q', '년 ') + '분기'
  if (freq === 'half-yearly') return key.replace('-H1', '년 상반기').replace('-H2', '년 하반기')
  if (freq === 'yearly')      return `${key}년`
  return key
}

export function getPeriodEnd(freq: Frequency, date: Date = new Date(), cfg: RecurCfg = {}): Date {
  const y = date.getFullYear()
  const m = date.getMonth()
  switch (freq) {
    case 'weekly_dow': {
      const wd = cfg.weekday == null ? 0 : cfg.weekday
      const sunday = new Date(date); sunday.setDate(date.getDate() - date.getDay())
      const target = new Date(sunday); target.setDate(sunday.getDate() + (((wd % 7) + 7) % 7))
      return target
    }
    case 'monthly_day': {
      const dueDay = cfg.dueDay ?? cfg.day ?? 1
      return clampDay(y, m, dueDay)
    }
    case 'monthly_nth_dow': {
      const wd = cfg.weekday == null ? 1 : cfg.weekday
      const n  = cfg.weekOfMonth ?? 1
      return nthWeekdayOfMonth(y, m, wd, n)
    }
    case 'daily':       return new Date(y, m, date.getDate())
    case 'weekly': {
      const s = getWeekStart(date)
      const e = new Date(s); e.setDate(e.getDate() + 6); return e
    }
    case 'monthly':     return new Date(y, m + 1, 0)
    case 'quarterly':   return new Date(y, Math.floor(m / 3) * 3 + 3, 0)
    case 'half-yearly': return new Date(y, m < 6 ? 6 : 12, 0)
    case 'yearly':      return new Date(y, 11, 31)
    default:            return new Date(y, m, date.getDate())
  }
}

function getWeekStart(date: Date): Date {
  // 일요일 시작 기준 (일~토), 백엔드와 동일
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())  // getDay(): 일=0
  d.setHours(0, 0, 0, 0)
  return d
}

export interface CompletionRecord {
  periodKey: string
  completedDate: string
  memo: string
  attachmentName: string
}

export interface OccurrenceRecord {
  id: string
  checklistItemId: string
  periodKey: string
  frequency: string
  scheduledDate: string
  dueDate: string
  status: 'pending' | 'completed' | 'overdue' | 'in_progress'
  startedBy?: string
  completedDate?: string
  memo: string
  attachmentName: string
}

export interface ChecklistItem {
  id: string
  title: string
  description: string
  frequency: string
  relatedIndicatorId: string
  relatedCategoryId: string
  relatedDomainId: string
  assignee: string
  evidenceRequired: string
  storageLocation: string
  howTo: string
  evalNote: string
  riskLevel: 'low' | 'medium' | 'high'
  active: boolean
  memo: string
  attachmentName: string
  completed: boolean
  completedDate?: string
  completionHistory: CompletionRecord[]
  occurrences: OccurrenceRecord[]   // occurrence 기반 완료 이력 (없으면 [])
  dueDate?: string         // one_time 기한 (YYYY-MM-DD)
  personId?: string
  personName?: string
  personType?: string
  templateId?: string
  recurWeekday?: number | null
  recurWeekOfMonth?: number | null
  recurDay?: number | null
  recurDueDay?: number | null
  createdAt: string
}

export function isPeriodCompleted(item: ChecklistItem, periodKey?: string): boolean {
  if (EVENT_FREQS.includes(item.frequency as Frequency)) return item.completed
  const key = periodKey ?? getCurrentPeriodKey(item.frequency as Frequency)

  // occurrence 우선 — 있으면 occurrence.status 기준
  if (item.occurrences && item.occurrences.length > 0) {
    const occ = item.occurrences.find(o => o.periodKey === key)
    if (occ) return occ.status === 'completed'
  }
  // fallback — completion_history 기준 (occurrence 없을 때)
  return item.completionHistory.some(r => r.periodKey === key)
}

export function isItemDone(item: ChecklistItem): boolean {
  if (EVENT_FREQS.includes(item.frequency as Frequency)) return item.completed
  const key = getCurrentPeriodKey(item.frequency as Frequency)

  // occurrence 우선
  if (item.occurrences && item.occurrences.length > 0) {
    const occ = item.occurrences.find(o => o.periodKey === key)
    if (occ) return occ.status === 'completed'
  }
  // fallback
  return item.completionHistory.some(r => r.periodKey === key)
}

export function shouldShowOnDate(item: ChecklistItem, date: Date): boolean {
  if (!item.active) return false

  const today = todayDateKST()
  const d     = new Date(date); d.setHours(0, 0, 0, 0)

  // ── 이벤트성 (입소/퇴소/입사) ─────────────────────────────────
  // 미완료: createdAt 날짜 ~ 오늘까지 모든 날에 누적 표시
  // 완료:   completedDate 당일에만 표시
  if (EVENT_FREQS.includes(item.frequency as Frequency)) {
    if (item.completed) {
      return (item.completedDate ?? '') === new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
    }
    const created = new Date(item.createdAt); created.setHours(0, 0, 0, 0)
    return d >= created && d <= today
  }

  // ── 반복 주기성 (기존 로직) ───────────────────────────────────
  const cfg = cfgFromItem(item)
  const periodKey = getPeriodKey(item.frequency as Frequency, date, cfg)
  const done = item.completionHistory.some(r => r.periodKey === periodKey)
  if (done) {
    const rec = item.completionHistory.find(r => r.periodKey === periodKey)!
    return rec.completedDate === new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
  }
  return isDateInActivePeriod(item.frequency as Frequency, date, cfg)
}

function isDateInActivePeriod(freq: Frequency, date: Date, cfg: RecurCfg = {}): boolean {
  const today = todayDateKST()
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  if (d > today) return false
  switch (freq) {
    case 'weekly_dow': {
      const end = getPeriodEnd('weekly_dow', date, cfg)
      const s2 = new Date(end); s2.setHours(0,0,0,0)
      return d.getTime() === s2.getTime()
    }
    case 'monthly_day': {
      if (d.getMonth() !== date.getMonth() || d.getFullYear() !== date.getFullYear()) return false
      const startDay = cfg.day ?? 1
      return d.getDate() >= startDay
    }
    case 'monthly_nth_dow': {
      const target = getPeriodEnd('monthly_nth_dow', date, cfg); target.setHours(0,0,0,0)
      return d.getTime() === target.getTime()
    }
    case 'daily':       return true
    case 'weekly': {
      const s = getWeekStart(date); const e = new Date(s); e.setDate(e.getDate() + 6)
      return d >= s && d <= e
    }
    case 'monthly':     return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear()
    case 'quarterly': {
      const q = Math.floor(date.getMonth() / 3)
      return d.getFullYear() === date.getFullYear() && Math.floor(d.getMonth() / 3) === q
    }
    case 'half-yearly': {
      const h = date.getMonth() < 6 ? 0 : 1
      return d.getFullYear() === date.getFullYear() && (d.getMonth() < 6 ? 0 : 1) === h
    }
    case 'yearly':      return d.getFullYear() === date.getFullYear()
    default:            return false
  }
}

export function calcAge(birthDate: string): number {
  const b = new Date(birthDate); const t = new Date()
  let age = t.getFullYear() - b.getFullYear()
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--
  return age
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ── KST(한국 시간) 기준 오늘 날짜 ──────────────────────────────────────────
// new Date().toISOString()은 UTC 기준이라 오전 9시 이전에는 어제 날짜를 반환함.
// 이 함수는 항상 KST 기준 "오늘" 날짜를 YYYY-MM-DD로 반환한다.
/**
 * KST(Asia/Seoul) 기준 오늘 날짜를 YYYY-MM-DD 문자열로 반환.
 * - 브라우저 로컬타임에 관계없이 항상 한국 시간 기준으로 계산.
 * - Intl.DateTimeFormat으로 명시적으로 타임존 지정.
 */
export function todayKST(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
  // sv-SE 로케일은 YYYY-MM-DD 형식을 반환함
}

// KST 기준 오늘 Date 객체 (비교 등에 사용)
export function todayDateKST(): Date {
  return new Date(todayKST() + 'T00:00:00')
}

/**
 * 두 YYYY-MM-DD 문자열 간의 날짜 차이 (target - base, 양수=미래)
 * new Date() 변환 없이 순수 문자열 산술로 계산 → timezone 무관
 */
export function dateDiffDays(baseDateStr: string, targetDateStr: string): number {
  const [by, bm, bd] = baseDateStr.split('-').map(Number)
  const [ty, tm, td] = targetDateStr.split('-').map(Number)
  const base   = Date.UTC(by, bm - 1, bd)
  const target = Date.UTC(ty, tm - 1, td)
  return Math.round((target - base) / 86400000)
}

/**
 * YYYY-MM-DD 문자열을 받아 오늘(KST)로부터 남은 날수 반환
 * 양수 = 미래, 0 = 오늘, 음수 = 과거
 */
export function daysFromToday(dueDateStr: string): number {
  return dateDiffDays(todayKST(), dueDateStr)
}
