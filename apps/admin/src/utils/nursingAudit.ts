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

// ── 인쇄용 압축 요약 ────────────────────────────────────────────────
// 화면의 날짜별 상세는 한 달에 수십 장이 나온다. 인쇄본은 "며칠에 · 어디서 · 누구를 보면 되는지"만
// 한 줄씩 남긴다. 참고(info)는 건수만 세고 줄로 쓰지 않는다.

/** 항목 → 케어포에서 열어볼 위치(메뉴 › 탭 › 칸). 없으면 분야 기본값 */
export const WHERE_BY_ITEM: Record<string, string> = {
  '투약 미기록(●)': '3-1 간호급여 제공기록 › 날짜를 그날로 › 목록 투약 칸이 ● 인 어르신 클릭 › 2.투약관리 탭에서 기록',
  '미작성': '3-1 › 어르신 클릭 › 2.투약관리 탭 › 위쪽 빨간 "미작성" 칸(체크는 있고 제공자 빈 슬롯) › 제공자 선택 후 저장',
  '외출·외박 중 투약기록': '3-1 › 2.투약관리 탭 › 그 슬롯 시간을 외출 전·후 실제 시각으로 (1-5 외출,외박 관리에서 외출 시간 확인)',
  '동일 제공자 동일 시각 다른 생활실': '3-1 › 2.투약관리 탭 › 두 생활실 중 한쪽 시간을 실제 시각으로 (3-9 투약제공 리포트에서 시간·제공자 한눈에 확인)',
  '동일 시각 다른 생활실': '3-9 투약제공 리포트(기준: 투약일) › 시간①~⑧ 열에서 같은 분에 찍힌 생활실 확인',
  '외출기록 없음': '1-5 외출,외박 관리 › 어르신 › 그날 외출 등록 (3-1 › 7.진료기록 탭의 진료일 기준)',
  '외출 목적 불일치': '1-5 외출,외박 관리 › 그날 외출 › 사유·목적지를 진료로 수정',
  '병원 외출인데 진료기록 없음': '3-1 › 어르신 클릭 › 7.진료기록 탭 › 진료일·병의원·진료내용 등록',
  '바이탈 미기록': '3-1-1 통합 간호관리 기록 › 날짜를 그날로 › 어르신 행 혈압·맥박·체온 입력',
  '건강관리 미체크': '3-1-1 통합 간호관리 기록 › 날짜를 그날로 › 어르신 행 "건강관리" 체크 › 기록완료',
  '간호관리 미체크': '3-1-1 통합 간호관리 기록 › 날짜를 그날로 › 어르신 행 "간호관리" 체크(급여계획에 있는 어르신)',
  '주 1회 미제공': '3-1 › 어르신 클릭 › 3.욕창간호 탭 (3-7 욕창간호 제공 리포트에서 주차별 확인)',
  '관리기록 없음': '3-1 › 어르신 클릭 › 5.도뇨관관리 탭 › 그날 관리기록 (도뇨관 뺐으면 3-5 리포트 대상자 정리)',
}

/** 날짜별 표에 쓰는 짧은 위치(메뉴 › 탭). 자세한 칸 안내는 WHERE_BY_ITEM */
export const WHERE_SHORT: Record<string, string> = {
  '투약 미기록(●)': '3-1 목록 투약 ● › 2.투약관리',
  '미작성': '3-1 › 2.투약관리 (미작성 칸)',
  '외출·외박 중 투약기록': '3-1 › 2.투약관리 + 1-5 외출',
  '동일 제공자 동일 시각 다른 생활실': '3-1 › 2.투약관리 (3-9 리포트)',
  '동일 시각 다른 생활실': '3-9 투약제공 리포트',
  '외출기록 없음': '1-5 외출,외박 관리',
  '외출 목적 불일치': '1-5 외출,외박 관리',
  '병원 외출인데 진료기록 없음': '3-1 › 7.진료기록',
  '바이탈 미기록': '3-1-1 통합 간호관리',
  '건강관리 미체크': '3-1-1 통합 간호관리 (건강관리 칸)',
  '간호관리 미체크': '3-1-1 통합 간호관리 (간호관리 칸)',
  '주 1회 미제공': '3-1 › 3.욕창간호',
  '관리기록 없음': '3-1 › 5.도뇨관관리',
}

/** 분야 기본 위치 */
export const WHERE_TO_LOOK: Record<string, string> = {
  '투약': '3-1 › 2.투약관리 탭',
  '진료기록': '3-1 › 7.진료기록 탭 ↔ 1-5 외출,외박 관리',
  '간호일지': '3-1-1 통합 간호관리 기록',
  '욕창간호': '3-1 › 3.욕창간호 탭',
  '도뇨관': '3-1 › 5.도뇨관관리 탭',
  '비위관': '3-1 › 4.비위관관리 탭',
}

export interface PrintLine { area: string; where: string; whereShort: string; item: string; kind: NursingKind; count: number; text: string }
export interface PrintDay { date: string; weekday: string; error: number; check: number; info: number; lines: PrintLine[] }

const shortRoom = (room?: string | null) => (room || '').replace('호', '')
const roomsOf = (s?: string | null) => [...new Set(((s || '').match(/\d{3}호/g) || []).map(r => r.replace('호', '')))].join('·')

/** 한 건을 인쇄 한 줄 안의 토막으로 */
export function printToken(f: NursingFindingLike): string {
  if (f.item === '동일 시각 다른 생활실') return f.time || ''
  if (f.item === '동일 제공자 동일 시각 다른 생활실') return `${f.time || ''} ${f.staff || ''}(${roomsOf(f.evidence)}호)`
  const who = `${f.resident}${f.room ? `(${shortRoom(f.room)})` : ''}`
  if (f.item === '미작성' || f.item === '외출·외박 중 투약기록') return `${who} ${f.time || ''}`.trim()
  return who
}

export function whereOf(f: NursingFindingLike): string {
  const base = WHERE_BY_ITEM[f.item] || WHERE_TO_LOOK[f.area] || f.area
  if (f.item === '미작성' && /외출|외박/.test(f.exception || '')) return base + ' — 외출 시간대라 1-5 외출,외박 관리와 대조, 외출 전·후 실제 시각으로'
  return base
}

/** 날짜 → (위치·항목·종류) 줄 목록. 같은 어르신·시각은 한 번만 쓴다(약품별 중복 제거). */
export function printDigest<T extends NursingFindingLike>(rows: T[], maxTokens = 14): PrintDay[] {
  const days = new Map<string, PrintDay>()
  const lineMap = new Map<string, { line: PrintLine; tokens: string[] }>()
  for (const f of rows) {
    const day = days.get(f.date) ?? { date: f.date, weekday: f.weekday || weekdayOf(f.date), error: 0, check: 0, info: 0, lines: [] }
    day[f.kind] += 1
    days.set(f.date, day)
    if (f.kind === 'info') continue
    const where = whereOf(f)
    const key = `${f.date}|${where}|${f.item}|${f.kind}`
    let cur = lineMap.get(key)
    if (!cur) {
      cur = { line: { area: f.area, where, whereShort: (WHERE_SHORT[f.item] || WHERE_TO_LOOK[f.area] || f.area) + (f.item === '미작성' && /외출|외박/.test(f.exception || '') ? ' + 1-5 외출' : ''), item: f.item, kind: f.kind, count: 0, text: '' }, tokens: [] }
      lineMap.set(key, cur)
      day.lines.push(cur.line)
    }
    cur.line.count += 1
    const tok = printToken(f)
    if (tok && !cur.tokens.includes(tok)) cur.tokens.push(tok)
  }
  for (const { line, tokens } of lineMap.values()) {
    const shown = tokens.slice(0, line.item === '동일 시각 다른 생활실' ? 8 : maxTokens)
    const more = tokens.length - shown.length
    line.text = shown.join(', ') + (more > 0 ? ` 외 ${more}` : '')
    if (line.item === '동일 시각 다른 생활실') line.text = `${line.count}건 (${shown.join('·')}${more > 0 ? ' …' : ''}) — 2·3층이 같은 분에 찍힘, 일괄처리로 시간 복사했는지`
  }
  const rank = (a: string) => { const i = AREA_ORDER.indexOf(a); return i < 0 ? 99 : i }
  for (const d of days.values()) {
    d.lines.sort((a, b) => rank(a.area) - rank(b.area) || (a.kind === b.kind ? b.count - a.count : (a.kind === 'error' ? -1 : 1)))
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface HomeRowLike { date: string; resident: string; room?: string | null; type: string; home_nursing: boolean; [key: string]: any }

/** 가정간호 처치 기록을 어르신 → 구분 → 날짜 목록으로 접는다 (인쇄용) */
export function homeDigest<T extends HomeRowLike>(rows: T[]): { resident: string; room: string; types: { type: string; dates: string[] }[] }[] {
  const map = new Map<string, { resident: string; room: string; types: Map<string, string[]> }>()
  for (const r of rows) {
    if (!r.home_nursing) continue
    const k = `${r.resident}|${r.room || ''}`
    const cur = map.get(k) ?? { resident: r.resident, room: shortRoom(r.room), types: new Map() }
    const arr = cur.types.get(r.type) ?? []
    const md = `${Number(r.date.slice(5, 7))}/${Number(r.date.slice(8, 10))}`
    if (!arr.includes(md)) arr.push(md)
    cur.types.set(r.type, arr)
    map.set(k, cur)
  }
  const order = ['욕창간호', '비위관', '도뇨관']
  return [...map.values()].map(x => ({
    resident: x.resident, room: x.room,
    types: [...x.types.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([type, dates]) => ({ type, dates })),
  })).sort((a, b) => a.resident.localeCompare(b.resident, 'ko'))
}
