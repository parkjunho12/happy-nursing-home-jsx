// 근무 코드 — 시설에서 쓰는 근무표 범례를 그대로 옮긴 것
// D 09:00~18:00(휴게 1h) = 8시간 / N 18:00~익일09:00(휴게 6h) = 9시간
// 실제 편성표 13명의 총시간을 이 값으로 검산해 전부 일치함을 확인했다.

export interface ShiftCode {
  code: string
  label: string
  time: string          // 표시용 근무 시간대
  hours: number         // 근무시간(집계용)
  cls: string           // 셀 색
  note?: string         // 범례 한 줄 설명 — 처음 보는 분도 뜻을 알 수 있게
  countAs?: 'D' | 'N'   // 갯수 집계 열(D/N)
  annual?: boolean      // 연차 일수로 집계
  offday?: boolean      // 대휴 일수로 집계
  comp?: boolean        // 초과휴무 일수로 집계
  group: '근무' | '휴무'
}

export const SHIFT_CODES: ShiftCode[] = [
  { code: 'D',    label: '주간',    time: '09:00~18:00',      hours: 8,   group: '근무', countAs: 'D', cls: 'bg-sky-100 text-sky-900' },
  { code: 'AD',   label: '오전',    time: '09:00~13:30',      hours: 4,   group: '근무', countAs: 'D', cls: 'bg-sky-50 text-sky-700' },
  { code: 'PD',   label: '오후',    time: '13:30~18:00',      hours: 4,   group: '근무', countAs: 'D', cls: 'bg-sky-50 text-sky-700' },
  { code: 'N',    label: '야간',    time: '18:00~익일 09:00', hours: 9,   group: '근무', countAs: 'N', cls: 'bg-indigo-100 text-indigo-900' },
  { code: 'AD반', label: '오전근무·오후반차', time: '09:00~13:30 근무', hours: 4, group: '근무', countAs: 'D', cls: 'bg-teal-50 text-teal-700' },
  { code: '반PD', label: '오전반차·오후근무', time: '13:30~18:00 근무', hours: 4, group: '근무', countAs: 'D', cls: 'bg-teal-50 text-teal-700' },
  { code: '休',   label: '연차',    time: '', hours: 0, group: '휴무', annual: true, cls: 'bg-emerald-100 text-emerald-800' },
  { code: '반',   label: '반차',    time: '',                 hours: 0,   group: '휴무', annual: true,  cls: 'bg-emerald-50 text-emerald-700' },
  { code: '대휴', label: '대체휴무', time: '', note: '공휴일 근무 대신 쉬는 날',
    hours: 0, group: '휴무', offday: true, cls: 'bg-amber-100 text-amber-800' },
  // 초과근무 휴가 — 법률 용어는 '보상휴가'(근로기준법 제57조)지만
  // 근무표는 현장에서 매일 보는 문서라 이름만 봐도 뜻이 통하는 말을 쓴다.
  { code: '초과휴', label: '초과근무 휴가', time: '',
    hours: 0, group: '휴무', comp: true, cls: 'bg-violet-100 text-violet-800' },
  { code: '◆병', label: '병가',    time: '',                 hours: 0,   group: '휴무', cls: 'bg-rose-100 text-rose-800' },
  { code: '◆',   label: '경조사 휴가', time: '',              hours: 0,   group: '휴무', cls: 'bg-purple-100 text-purple-800' },
]

export const CODE_MAP: Record<string, ShiftCode> = Object.fromEntries(SHIFT_CODES.map(c => [c.code, c]))

/** '0850 1600'처럼 직접 적은 시간대인지 */
const TIME_RE = /^(\d{1,2})[:\s]?(\d{2})\s*[-~\s]\s*(\d{1,2})[:\s]?(\d{2})$/

/** 정규 근무 코드의 시간만 — 직접 입력한 시간대는 별도(extraHoursOf)로 센다 */
export const hoursOf = (raw?: string | null): number => {
  const v = (raw ?? '').trim()
  return v ? (CODE_MAP[v]?.hours ?? 0) : 0
}

/**
 * 직접 적은 시간대('0850 1600')의 근무시간.
 * 실제 편성표에서 이런 칸은 총시간·D갯수에 넣지 않고 '추가근무'로 따로 관리한다.
 * (최진흥·김원녀 행을 이 규칙으로 계산해야 시트의 170시간과 맞는다)
 */
export const extraHoursOf = (raw?: string | null): number => {
  const v = (raw ?? '').trim()
  if (!v || CODE_MAP[v]) return 0
  const m = TIME_RE.exec(v.replace(/\n/g, ' '))
  if (!m) return 0
  const st = Number(m[1]) * 60 + Number(m[2])
  const en = Number(m[3]) * 60 + Number(m[4])
  const mins = (en - st + 1440) % 1440
  return Math.max(0, Math.round(((mins - breakMinutes(mins)) / 60) * 10) / 10)
}

/**
 * 근무폭에 따른 휴게시간(분).
 * 시설 기준은 1시간 10분이며, 이 값으로 계산하면 실제 표기가 정각으로 떨어진다.
 *   0850~1400 → 4시간 · 0850~1600 → 6시간 · 0850~1700 → 7시간
 * 다만 2~4시간짜리 짧은 근무에까지 70분을 빼면 실근무가 비현실적으로 줄어들어,
 * 그 구간은 근로기준법 최소치(4시간 초과 시 30분)를 따른다.
 */
export const FACILITY_BREAK_MIN = 70
export function breakMinutes(spanMinutes: number): number {
  if (spanMinutes >= 300) return FACILITY_BREAK_MIN   // 5시간 이상 — 시설 기준 1시간 10분
  if (spanMinutes > 240) return 30                     // 4시간 초과 — 법정 최소 30분
  return 0                                             // 4시간 이하 — 휴게 없음
}

/**
 * 자동 생성이 다시 만들어도 되는 칸인지.
 * 연차·반차·병가·경조사처럼 사람이 사정을 알고 넣은 값은 덮으면 안 되지만,
 * D·N·대휴·초과휴·추가근무는 정산 결과라서 다시 계산되어야 한다.
 * (이 구분이 없으면 두 번째 자동 생성부터는 아무것도 바뀌지 않는다)
 */
export const MANUAL_ONLY_CODES = ['休', '반', '◆병', '◆', 'AD', 'PD', 'AD반', '반PD']
export const isAutoManaged = (raw?: string | null): boolean => {
  const v = (raw ?? '').trim()
  if (!v) return true
  return !MANUAL_ONLY_CODES.includes(v)
}

/** 직접 입력한 시간대 칸인지 */
export const isCustomTime = (raw?: string | null): boolean => extraHoursOf(raw) > 0

/**
 * 시간대 표기를 두 줄로 나눈다. '0850~1600' → ['0850','1600']
 * 한 칸이 8mm 남짓이라 한 줄로는 절반이 잘린다.
 */
export function splitTimeRange(raw?: string | null): [string, string] | null {
  const v = (raw ?? '').trim()
  if (!isCustomTime(v)) return null
  const m = /^(.+?)\s*[-~\s]\s*(.+)$/.exec(v.replace(/\n/g, ' '))
  return m ? [m[1].trim(), m[2].trim()] : null
}

/** 좁은 칸(인쇄)용 짧은 표기 — 세 글자 코드는 두 글자로 */
export const SHORT_CODE: Record<string, string> = { '초과휴': '초휴', 'AD반': 'AD반', '반PD': '반PD' }
export const shortOf = (raw?: string | null): string => {
  const v = (raw ?? '').trim()
  return SHORT_CODE[v] ?? v
}

export const meta = (raw?: string | null): ShiftCode | null => CODE_MAP[(raw ?? '').trim()] ?? null

/** D/N 갯수 집계 — 정규 코드만 센다 (시간 직접 입력 칸은 제외) */
export const countAsOf = (raw?: string | null): 'D' | 'N' | null =>
  CODE_MAP[(raw ?? '').trim()]?.countAs ?? null

// ── 주주야야휴휴 6일 주기 ─────────────────────────────────
// 실제 8월 편성표에서 각 조의 1일차를 역산한 결과 A=2, B=0, C=4였다.
// 주주야야휴휴 — 뒤의 '휴휴'는 근무가 없는 날일 뿐 연차가 아니므로 공란으로 둔다.
// (休 코드는 연차라서 넣으면 연차 일수가 잘못 늘어난다. 실제 편성표도 이 자리가 비어 있다.)
export const ROTATION = ['D', 'D', 'N', 'N', '', ''] as const

// 주기가 6일이라 서로 겹치지 않는 조는 최대 6개까지 둘 수 있다.
export const TEAMS = ['A조', 'B조', 'C조', 'D조', 'E조', 'F조'] as const
export const DAY_TEAM = '주간'
export type Team = typeof TEAMS[number] | typeof DAY_TEAM | ''

/** 기본 시작 위치 — 실제 8월 편성표에서 역산한 값(A=2, B=0, C=4)을 그대로 둔다 */
export const DEFAULT_TEAM_OFFSET: Record<string, number> = {
  'A조': 2, 'B조': 0, 'C조': 4, 'D조': 1, 'E조': 3, 'F조': 5,
}

/**
 * 회전 기준일 — 이 날을 주기의 0번째로 삼는다.
 * 매월 1일마다 주기를 다시 시작하면 달이 바뀔 때 주주야야휴휴가 끊긴다.
 * (예: 8월은 31일 = 6일 주기로 5바퀴 + 1일이라 9월 1일은 2번째 칸에서 이어져야 한다)
 * 실제 8월 편성표와 맞도록 2026-08-01을 기준으로 잡았다.
 */
export const ROTATION_ANCHOR = '2026-08-01'

/** 기준일로부터 경과일 — anchor를 안 주면 코드 기본값(마이그레이션 시드와 동일) */
export function daysFromAnchor(iso: string, anchor?: string): number {
  const a = new Date(`${anchor || ROTATION_ANCHOR}T00:00:00`)
  const d = new Date(`${iso}T00:00:00`)
  return Math.round((d.getTime() - a.getTime()) / 86400000)
}

/** 날짜(ISO) → 주주야야휴휴 근무 코드. 달이 바뀌어도 주기가 이어진다. */
export function rotationOn(team: string, iso: string, offsets?: Record<string, number>, anchor?: string): string {
  const off = offsets?.[team] ?? DEFAULT_TEAM_OFFSET[team] ?? 0
  const n = daysFromAnchor(iso, anchor) + off
  return ROTATION[((n % 6) + 6) % 6]
}

/** 조·일자 → 근무 코드 (월 정보를 함께 넘겨야 주기가 이어진다) */
export const rotationFor = (team: string, day: number, offsets?: Record<string, number>, ym?: string, anchor?: string): string => {
  if (ym) return rotationOn(team, `${ym}-${String(day).padStart(2, '0')}`, offsets, anchor)
  const off = offsets?.[team] ?? DEFAULT_TEAM_OFFSET[team] ?? 0
  return ROTATION[(((day - 1) + off) % 6 + 6) % 6]
}

/** 해당 조의 6일 주기 미리보기 */
export const rotationPreview = (team: string, offsets?: Record<string, number>): string[] =>
  ROTATION.map((_, i) => {
    const off = offsets?.[team] ?? DEFAULT_TEAM_OFFSET[team] ?? 0
    return ROTATION[(((i + off) % 6) + 6) % 6]
  })

/**
 * 근무시간(h) → '0850~HHMM' 표기.
 * 08:50에 시작해 휴게를 포함한 끝시각을 만든다. 다시 읽었을 때 같은 시간이 나오도록
 * breakMinutes()와 짝이 맞는 구간을 고른다. (4시간 → 0850~1400)
 */
export function timeRangeForHours(hours: number): string {
  const h = Math.max(0.5, Math.round(hours * 2) / 2)     // 30분 단위
  const mins = h * 60
  let span: number
  if (mins + FACILITY_BREAK_MIN >= 300) span = mins + FACILITY_BREAK_MIN
  else if (mins + 30 > 240) span = mins + 30
  else span = mins
  const start = 8 * 60 + 50
  const end = start + span
  const p = (n: number) => String(n).padStart(2, '0')
  return `0850~${p(Math.floor(end / 60) % 24)}${p(end % 60)}`
}
