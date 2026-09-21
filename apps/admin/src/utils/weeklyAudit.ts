/** 주간 기록지 점검 화면에서 쓰는 순수 helper — 필터·정렬·그룹핑만 한다. */

export interface WeeklyAuditFindingLike {
  date: string
  weekday?: string | null
  resident: string
  area: string
  staff?: string | null
  owner_candidates?: string[]
  kind: 'error' | 'blank' | 'check'
  [key: string]: any
}

export interface WeeklyAuditStaffRowLike {
  staff: string
  error: number
  blank_owner: number
  shared?: number
  [key: string]: any
}

/** 종류 배지 라벨 */
export const KIND_LABEL: Record<'error' | 'blank' | 'check', string> = {
  error: '오류',
  blank: '공란',
  check: '확인',
}

/** "2026-09-14" · "2026-09-20" → "9/14(월) ~ 9/20(일)" */
export function formatRange(weekStart: string, weekEnd: string): string {
  const one = (d: string) => {
    const [, m, dd] = d.split('-')
    const wd = '일월화수목금토'[new Date(`${d}T00:00:00+09:00`).getDay()]
    return `${Number(m)}/${Number(dd)}(${wd})`
  }
  if (!weekStart || !weekEnd) return ''
  return `${one(weekStart)} ~ ${one(weekEnd)}`
}

export interface WeeklyAuditFilter {
  staff?: string
  resident?: string
  area?: string
  kind?: string
  q?: string
}

/** 선생님(작성자 또는 공란 책임후보) / 어르신 / 분야 / 종류 / 검색어로 거른다. */
export function filterFindings<T extends WeeklyAuditFindingLike>(
  findings: T[],
  filter: WeeklyAuditFilter,
): T[] {
  const { staff, resident, area, kind, q } = filter
  const query = (q ?? '').trim().toLowerCase()
  return findings.filter(f => {
    if (staff) {
      const matchesStaff = f.staff === staff || (f.owner_candidates ?? []).includes(staff)
      if (!matchesStaff) return false
    }
    if (resident && f.resident !== resident) return false
    if (area && f.area !== area) return false
    if (kind && f.kind !== kind) return false
    if (query) {
      const haystack = [
        f.resident, f.area, (f as any).item, (f as any).issue, f.staff,
        ...(f.owner_candidates ?? []),
      ].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

export interface DateGroup<T> {
  date: string
  weekday: string
  items: T[]
}

/** 날짜별로 묶고 날짜 오름차순으로 정렬한다. */
export function groupByDate<T extends WeeklyAuditFindingLike>(findings: T[]): DateGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const f of findings) {
    const list = map.get(f.date)
    if (list) list.push(f)
    else map.set(f.date, [f])
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, items]) => ({
      date,
      weekday: items[0]?.weekday ?? '',
      items,
    }))
}

/** 오류+공란+공동 내림차순, 같으면 이름순 — 서버가 이미 이 순서로 주지만 화면에서도 보장한다. */
export function rankStaff<T extends WeeklyAuditStaffRowLike>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const diff = (b.error + b.blank_owner + (b.shared ?? 0)) - (a.error + a.blank_owner + (a.shared ?? 0))
    if (diff !== 0) return diff
    return a.staff.localeCompare(b.staff, 'ko')
  })
}
