// 주기 관련 유틸리티

export type Frequency =
  | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'
  | 'on_admission' | 'on_discharge' | 'on_hire'

export const RECURRING: Frequency[] = ['daily','weekly','monthly','quarterly','half-yearly','yearly']
export const EVENT_FREQS: Frequency[] = ['on_admission','on_discharge','on_hire']

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: '일일', weekly: '주별', monthly: '월별', quarterly: '분기별',
  'half-yearly': '반기별', yearly: '연별',
  on_admission: '입소 시', on_discharge: '퇴소 시', on_hire: '입사 시',
}

export const FREQUENCY_COLORS: Record<string, string> = {
  daily:        'bg-blue-100 text-blue-800',
  weekly:       'bg-green-100 text-green-800',
  monthly:      'bg-purple-100 text-purple-800',
  quarterly:    'bg-orange-100 text-orange-800',
  'half-yearly':'bg-pink-100 text-pink-800',
  yearly:       'bg-red-100 text-red-800',
  on_admission: 'bg-teal-100 text-teal-800',
  on_discharge: 'bg-gray-200 text-gray-700',
  on_hire:      'bg-indigo-100 text-indigo-800',
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

export function getPeriodKey(freq: Frequency, date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth()
  switch (freq) {
    case 'daily':       return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
    case 'weekly': {
      const jan1 = new Date(y, 0, 1)
      const week = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
      return `${y}-W${String(week).padStart(2, '0')}`
    }
    case 'monthly':     return `${y}-${String(m + 1).padStart(2, '0')}`
    case 'quarterly':   return `${y}-Q${Math.floor(m / 3) + 1}`
    case 'half-yearly': return m < 6 ? `${y}-H1` : `${y}-H2`
    case 'yearly':      return `${y}`
    default:            return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
  }
}

export function getCurrentPeriodKey(freq: Frequency): string {
  return getPeriodKey(freq, todayDateKST())
}

export function getPeriodLabel(freq: Frequency, key: string): string {
  if (freq === 'daily')       return key
  if (freq === 'weekly')      return key.replace('-W', '년 ') + '주차'
  if (freq === 'monthly')     { const [y,m] = key.split('-'); return `${y}년 ${Number(m)}월` }
  if (freq === 'quarterly')   return key.replace('-Q', '년 ') + '분기'
  if (freq === 'half-yearly') return key.replace('-H1', '년 상반기').replace('-H2', '년 하반기')
  if (freq === 'yearly')      return `${key}년`
  return key
}

export function getPeriodEnd(freq: Frequency, date: Date = new Date()): Date {
  const y = date.getFullYear()
  const m = date.getMonth()
  switch (freq) {
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
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
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
  status: 'pending' | 'completed' | 'overdue'
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
  personId?: string
  personName?: string
  personType?: string
  templateId?: string
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
  const periodKey = getPeriodKey(item.frequency as Frequency, date)
  const done = item.completionHistory.some(r => r.periodKey === periodKey)
  if (done) {
    const rec = item.completionHistory.find(r => r.periodKey === periodKey)!
    return rec.completedDate === new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
  }
  return isDateInActivePeriod(item.frequency as Frequency, date)
}

function isDateInActivePeriod(freq: Frequency, date: Date): boolean {
  const today = todayDateKST()
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  if (d > today) return false
  switch (freq) {
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
