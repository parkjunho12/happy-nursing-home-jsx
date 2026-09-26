/** 간호기록 점검 화면 순수 helper — 기간 계산·필터·그룹핑만 한다(판정 로직 없음). */

export type NursingKind = 'error' | 'check' | 'info'

export interface NursingFindingLike {
  date: string
  weekday?: string | null
  resident: string
  area: string
  item: string
  kind: NursingKind
  staff?: string | null
  room?: string | null
  [key: string]: any
}

export const KIND_LABEL: Record<NursingKind, string> = { error: '오류', check: '확인', info: '참고' }

/** 화면 분야 순서 — 사용자가 적어준 점검 순서를 따른다 */
export const AREA_ORDER = ['투약', '진료기록', '간호일지', '욕창간호', '도뇨관', '비위관']

const WD = '일월화수목금토'
export function weekdayOf(d: string): string {
  // 실행 환경 시간대(CI 는 UTC)와 무관하게 날짜 문자열만으로 요일을 센다
  return WD[new Date(`${d}T12:00:00Z`).getUTCDay()]
}

function pad(n: number): string { return String(n).padStart(2, '0') }

export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T12:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/** 그 날짜가 속한 주의 월요일 */
export function mondayOf(d: string): string {
  const wd = new Date(`${d}T12:00:00Z`).getUTCDay()   // 0=일
  return addDays(d, -((wd + 6) % 7))
}

/** "2026-09" → 그 달과 겹치는 월~일 주 목록(최신 우선) */
export function weeksOfMonth(month: string): { start: string; end: string; label: string }[] {
  const [y, m] = month.split('-').map(Number)
  const first = `${y}-${pad(m)}-01`
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const out: { start: string; end: string; label: string }[] = []
  for (let s = mondayOf(first); s <= last; s = addDays(s, 7)) {
    const e = addDays(s, 6)
    out.push({ start: s, end: e, label: formatRange(s, e) })
  }
  return out.reverse()
}

/** "2026-09-14" · "2026-09-20" → "9/14(월) ~ 9/20(일)" */
export function formatRange(a: string, b: string): string {
  const one = (d: string) => { const [, m, dd] = d.split('-'); return `${Number(m)}/${Number(dd)}(${weekdayOf(d)})` }
  if (!a || !b) return ''
  return `${one(a)} ~ ${one(b)}`
}

/** "2026-09" → "2026년 9월" */
export function formatMonth(month: string): string {
  if (!month) return ''
  const [y, m] = month.split('-')
  return `${y}년 ${Number(m)}월`
}

export interface NursingFilter { resident?: string; area?: string; item?: string; kind?: string; staff?: string; q?: string }

export function filterFindings<T extends NursingFindingLike>(rows: T[], f: NursingFilter): T[] {
  const q = (f.q || '').trim().toLowerCase()
  return rows.filter(r => {
    if (f.resident && r.resident !== f.resident && !(Array.isArray(r.residents) && r.residents.includes(f.resident))) return false
    if (f.area && r.area !== f.area) return false
    if (f.item && r.item !== f.item) return false
    if (f.kind && r.kind !== f.kind) return false
    if (f.staff && r.staff !== f.staff) return false
    if (q) {
      const hay = [r.resident, r.room, r.area, r.item, r.issue, r.staff, r.evidence, r.exception, r.time].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export interface DateGroup<T> { date: string; weekday: string; items: T[] }

/** 날짜 오름차순 그룹 */
export function groupByDate<T extends NursingFindingLike>(rows: T[]): DateGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const r of rows) { const a = map.get(r.date) ?? []; a.push(r); map.set(r.date, a) }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => ({ date, weekday: items[0]?.weekday || weekdayOf(date), items }))
}

/** 분야 → 항목 → 종류별 건수 (요약표용). 분야는 AREA_ORDER 순, 나머지는 뒤에 이름순 */
export function itemMatrix<T extends NursingFindingLike>(rows: T[]): { area: string; item: string; error: number; check: number; info: number; total: number }[] {
  const map = new Map<string, { area: string; item: string; error: number; check: number; info: number; total: number }>()
  for (const r of rows) {
    const k = `${r.area}|${r.item}`
    const cur = map.get(k) ?? { area: r.area, item: r.item, error: 0, check: 0, info: 0, total: 0 }
    cur[r.kind] += 1; cur.total += 1
    map.set(k, cur)
  }
  const rank = (a: string) => { const i = AREA_ORDER.indexOf(a); return i < 0 ? 99 : i }
  return [...map.values()].sort((a, b) => rank(a.area) - rank(b.area) || a.area.localeCompare(b.area, 'ko') || b.error - a.error || b.total - a.total)
}
