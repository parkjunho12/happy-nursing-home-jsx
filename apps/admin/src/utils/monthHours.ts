import { CODE_MAP, countAsOf, hoursOf, extraHoursOf } from './shiftCodes'

/**
 * 한 달 근무 합계.
 *
 * 편성 화면과 보기 화면이 같은 숫자를 보여야 한다. 두 곳에 따로 적어두면
 * 언젠가 어긋나고, 그때 어느 쪽이 맞는지 아무도 모른다. 그래서 한곳에 둔다.
 *
 * 엑셀도 이 값을 쓴다 — 다만 엑셀은 백엔드가 만든다. 파이썬에 같은 계산을
 * 다시 쓰면 그것도 언젠가 갈라지므로, 저장할 때 이 결과를 함께 담아 보내고
 * 엑셀은 그걸 읽기만 한다.
 */
export interface MonthTotals {
  /** 정규 코드(D·N·AD…)의 시간 */
  hours: number
  /** '0850 1600' 처럼 직접 적은 시간대 — 추가근무로 따로 센다 */
  extra: number
  /** 기준시간과 비교할 때 쓰는 숫자 (정규 + 추가) */
  total: number
  d: number
  n: number
  annual: number
  off: number
  comp: number
}

export function monthTotals(
  codes: Record<string, string> | undefined | null,
  days: number[],
): MonthTotals {
  const row = codes ?? {}
  let hours = 0, extra = 0, d = 0, n = 0, annual = 0, off = 0, comp = 0
  for (const day of days) {
    const v = row[String(day)]
    if (!v) continue
    hours += hoursOf(v)
    extra += extraHoursOf(v)
    const c = countAsOf(v)
    if (c === 'D') d++
    else if (c === 'N') n++
    const mt = CODE_MAP[v]
    if (mt?.annual) annual++
    if (mt?.offday) off++
    if (mt?.comp) comp++
  }
  const h = Math.round(hours * 10) / 10
  const e = Math.round(extra * 10) / 10
  return { hours: h, extra: e, total: Math.round((h + e) * 10) / 10, d, n, annual, off, comp }
}

/**
 * 기준시간과 견주었을 때 어떤 상태인가.
 *
 * 미달은 급여가 깎이는 쪽이라 더 급하다. 초과는 수당 문제이고.
 * 기준이 없으면 판단하지 않는다 — 모르면서 '정상' 이라고 하면 안 된다.
 */
export type HourStatus = 'short' | 'over' | 'ok' | 'unknown'

export function hourStatus(total: number, baseHours?: number | null): HourStatus {
  const b = Number(baseHours) || 0
  if (b <= 0) return 'unknown'
  if (total < b) return 'short'
  if (total > b) return 'over'
  return 'ok'
}

/** 기준 대비 몇 시간 모자라거나 넘는지 (기준이 없으면 null) */
export function hourDiff(total: number, baseHours?: number | null): number | null {
  const b = Number(baseHours) || 0
  if (b <= 0) return null
  return Math.round((total - b) * 10) / 10
}
