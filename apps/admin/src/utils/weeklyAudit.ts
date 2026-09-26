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
    // 실행 환경 시간대(CI 는 UTC)와 무관하게 날짜 문자열만으로 요일을 센다
    const wd = '일월화수목금토'[new Date(`${d}T12:00:00Z`).getUTCDay()]
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

export type StaffSortKey = 'default' | 'error' | 'blank_owner' | 'shared' | 'check' | 'total' | 'mentions' | 'error_rate'

/**
 * 선생님별 표 정렬. 'default' 는 rankStaff 순서(오류+공란+공동). 그 외 열은 숫자 내림/오름차순.
 * 오류율이 없는 분(작성 0회, null)은 어느 방향이든 맨 아래로 보낸다 — 0% 와 '없음' 은 다르다.
 */
export function sortStaffRows<T extends WeeklyAuditStaffRowLike>(rows: T[], key: StaffSortKey, dir: 'asc' | 'desc' = 'desc'): T[] {
  if (key === 'default') return rankStaff(rows)
  const val = (r: T): number | null => {
    const v = (r as Record<string, unknown>)[key]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  return [...rows].sort((a, b) => {
    const va = val(a), vb = val(b)
    if (va === null && vb === null) return a.staff.localeCompare(b.staff, 'ko')
    if (va === null) return 1
    if (vb === null) return -1
    const diff = dir === 'desc' ? vb - va : va - vb
    if (diff !== 0) return diff
    return a.staff.localeCompare(b.staff, 'ko')
  })
}

// ── 인쇄본 (간호기록 점검과 같은 방식) ──────────────────────────────
// 인쇄는 두 판이다: ① 선생님별(표 + 선생님마다 무엇을 몇 건 틀렸는지) ② 날짜별 확인 목록(며칠·어디서·누구).

/** 분야 → 케어포에서 열어볼 위치(메뉴 › 화면 › 칸) */
export const WEEKLY_WHERE: Record<string, string> = {
  '신체활동': '2-1 요양급여 제공기록 › 어르신 › 그 날짜 열 › 신체활동지원 칸(체크·횟수)',
  '인지관리': '2-1 요양급여 제공기록 › 그 날짜 열 › 인지관리지원·의사소통도움 칸',
  '기능회복훈련': '2-1 요양급여 제공기록 › 그 날짜 열 › 기능회복훈련 신체·기본·일상 세 칸 체크',
  '목욕': '2-1 요양급여 제공기록 › 목욕도움·머리감기 칸 (2-3 목욕관리)',
  '식사': '2-1-1 통합식사도움기록 › 날짜를 그날로 › 어르신 행 끼니 체크·시간·식사량·조치사항',
  '화장실이용': '2-1 › 그 날짜 화장실이용하기 칸 클릭 › 기저귀 모달(시각·대소변·교체C/확인R·소변량·담당자)',
  '집중배설관찰': '2-2 집중배설관찰 › 어르신 › 시간별 행(소변·대변·기저귀 교환·작성자)',
  '체위변경': '2-1 › 그 날짜 체위변경 칸 클릭(와상) › 2시간 간격 12회·제공자 (2-7 체위변경 리포트로 한눈에)',
  '작성자': '2-1 요양급여 제공기록 › 그 날짜 열 › 작성자(신체·인지) 지정 후 저장',
}

/** 날짜별 표용 짧은 위치 */
export const WEEKLY_WHERE_SHORT: Record<string, string> = {
  '신체활동': '2-1 신체활동지원 칸',
  '인지관리': '2-1 인지관리·의사소통 칸',
  '기능회복훈련': '2-1 기능회복훈련 칸',
  '목욕': '2-1 목욕·머리감기 칸',
  '식사': '2-1-1 통합식사도움기록',
  '화장실이용': '2-1 화장실이용 모달',
  '집중배설관찰': '2-2 집중배설관찰',
  '체위변경': '2-1 체위변경 모달 (2-7)',
  '작성자': '2-1 작성자 칸',
}

/** "1회 / 기준 3회" → "1/3회" 처럼 문제를 한 토막으로 */
export function shortIssue(issue?: string | null): string {
  const s = (issue || '').trim()
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d+)회 \/ 기준 (\d+)회/))) return `${m[1]}/${m[2]}회`
  if (/^미체크/.test(s)) { const mm = s.match(/^미체크:\s*([^(]+)/); return mm ? '미체크 ' + mm[1].trim().replace(/훈련/g, '').replace(/\s*,\s*/g, '·') : '미체크' }
  if (/^확인\(C\) 기록 0회/.test(s)) return '확인0회'
  if ((m = s.match(/^교체\(R\) (\d+)회/))) return `교체${m[1]}회`
  if ((m = s.match(/^소변 체크된 교체 (\d+)회/))) return `소변교체${m[1]}회`
  if ((m = s.match(/^체위변경 (\d+)회/))) return `${m[1]}회`
  if ((m = s.match(/간격 (\d+)시간 \(([^)]+)\)/))) return `간격${m[1]}h ${m[2]}`
  if ((m = s.match(/^(아침|점심|저녁|간식)[^ ]* 미체크/))) return `${m[1]} 미체크`
  if ((m = s.match(/^(아침|점심|저녁)\([\d:]+\) 외출·외박 중 미식사/))) return `${m[1]} 외출중 미식사·조치없음`
  if ((m = s.match(/^소변량 합계 ([\d,]+mL)/))) return `소변량 ${m[1]}`
  if (/^소변량 기록 없음/.test(s)) return '소변량 없음'
  if (/시각 기록 0건/.test(s)) return '시각 0건'
  return s.length > 18 ? s.slice(0, 18) + '…' : s
}

export interface WeeklyPrintLine { area: string; where: string; item: string; kind: 'error' | 'blank' | 'check'; count: number; text: string }
export interface WeeklyPrintDay { date: string; weekday: string; error: number; blank: number; check: number; lines: WeeklyPrintLine[] }

const AREA_RANK = ['신체활동', '인지관리', '기능회복훈련', '목욕', '식사', '화장실이용', '집중배설관찰', '체위변경', '작성자']

/** 한 건 → "어르신(호실) 문제·작성자" 토막. 공란은 후보를 붙인다 */
export function weeklyPrintToken(f: WeeklyAuditFindingLike): string {
  const who = `${f.resident}${f.room ? `(${String(f.room).replace('호', '')})` : ''}`
  const issue = shortIssue((f as any).issue)
  const staff = f.kind === 'blank'
    ? ((f.owner_candidates ?? []).length ? `후보 ${(f.owner_candidates ?? []).join('·')}` : '작성자 없음')
    : (f.staff || '')
  const time = (f as any).time ? ` ${(f as any).time}` : ''
  return [who + time, issue, staff].filter(Boolean).join(' ')
}

/** 날짜 → (위치·항목·종류) 줄. 같은 토막은 한 번만 */
export function weeklyPrintDigest<T extends WeeklyAuditFindingLike>(rows: T[], maxTokens = 16): WeeklyPrintDay[] {
  const days = new Map<string, WeeklyPrintDay>()
  const lines = new Map<string, { line: WeeklyPrintLine; tokens: string[] }>()
  for (const f of rows) {
    const day = days.get(f.date) ?? { date: f.date, weekday: f.weekday || '', error: 0, blank: 0, check: 0, lines: [] }
    day[f.kind] += 1
    days.set(f.date, day)
    const item = String((f as any).item || '')
    const key = `${f.date}|${f.area}|${item}|${f.kind}`
    let cur = lines.get(key)
    if (!cur) {
      cur = { line: { area: f.area, where: WEEKLY_WHERE_SHORT[f.area] || f.area, item, kind: f.kind, count: 0, text: '' }, tokens: [] }
      lines.set(key, cur); day.lines.push(cur.line)
    }
    cur.line.count += 1
    const tok = weeklyPrintToken(f)
    if (tok && !cur.tokens.includes(tok)) cur.tokens.push(tok)
  }
  for (const { line, tokens } of lines.values()) {
    const shown = tokens.slice(0, maxTokens)
    line.text = shown.join(', ') + (tokens.length > shown.length ? ` 외 ${tokens.length - shown.length}` : '')
  }
  const rank = (a: string) => { const i = AREA_RANK.indexOf(a); return i < 0 ? 99 : i }
  const kindRank = { error: 0, blank: 1, check: 2 }
  for (const d of days.values()) d.lines.sort((a, b) => rank(a.area) - rank(b.area) || kindRank[a.kind] - kindRank[b.kind] || b.count - a.count)
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface StaffBreakdownRow { staff: string; error: number; blank_owner: number; check: number; items: { label: string; count: number }[] }

/** 선생님별 인쇄용: 선생님마다 무엇(분야·항목)을 몇 건 틀렸는지. 공란은 후보 전원에게 붙는다 */
export function staffBreakdown<T extends WeeklyAuditFindingLike>(rows: T[]): StaffBreakdownRow[] {
  const map = new Map<string, StaffBreakdownRow & { _items: Map<string, number> }>()
  const get = (name: string) => { let r = map.get(name); if (!r) { r = { staff: name, error: 0, blank_owner: 0, check: 0, items: [], _items: new Map() }; map.set(name, r) } return r }
  for (const f of rows) {
    const label = `${f.area} · ${(f as any).item || ''}`
    if (f.kind === 'blank') {
      for (const n of f.owner_candidates ?? []) { const r = get(n); r.blank_owner += 1; r._items.set(label + '(공란)', (r._items.get(label + '(공란)') || 0) + 1) }
      continue
    }
    if (!f.staff) continue
    const r = get(f.staff)
    if (f.kind === 'error') r.error += 1; else r.check += 1
    if (f.kind === 'error') r._items.set(label, (r._items.get(label) || 0) + 1)
  }
  return [...map.values()].map(r => ({
    staff: r.staff, error: r.error, blank_owner: r.blank_owner, check: r.check,
    items: [...r._items.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
  })).sort((a, b) => (b.error + b.blank_owner) - (a.error + a.blank_owner) || a.staff.localeCompare(b.staff, 'ko'))
}
