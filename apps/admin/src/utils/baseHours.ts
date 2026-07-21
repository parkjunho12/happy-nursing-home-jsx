// 월 기준 근무시간 — 토·일·공휴일을 뺀 날수 × 1일 근무시간
// 실제 편성표의 '160시간 / 20일'(2026년 8월)을 이 규칙으로 재현해 확인했다.
// 구조만 맞으면 되므로 로컬 타입으로 정의한다.
// (API 클라이언트를 끌고 오면 axios까지 딸려와 단독 테스트가 불가능해진다)
export interface HolidayInfo { name: string; kind: string }

export const DAILY_HOURS = 8

export interface BaseCalc {
  total: number        // 그 달의 전체 일수
  weekend: number      // 토·일
  holiday: number      // 공휴일(주말과 겹치지 않는 것만)
  paid: number         // 유급휴일(근로자의 날) — 제외 여부는 선택
  workdays: number     // 기준 근무일수
  hours: number        // 기준 근무시간
}

/**
 * @param excludePaid 근로자의 날을 근무일에서 뺄지 (기본 true — 유급휴일이라 쉬므로)
 */
export function calcBase(
  ym: string,
  holidays: Record<string, HolidayInfo>,
  excludePaid = true,
  dailyHours = DAILY_HOURS,
): BaseCalc {
  const [y, m] = ym.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  let weekend = 0, holiday = 0, paid = 0, workdays = 0
  for (let d = 1; d <= total; d++) {
    const dow = new Date(y, m - 1, d).getDay()
    if (dow === 0 || dow === 6) { weekend++; continue }   // 주말은 공휴일과 중복 계산하지 않는다
    const h = holidays[`${ym}-${String(d).padStart(2, '0')}`]
    if (h && h.kind !== 'paid') { holiday++; continue }
    if (h && h.kind === 'paid') {
      paid++
      if (excludePaid) continue
    }
    workdays++
  }
  return { total, weekend, holiday, paid, workdays, hours: workdays * dailyHours }
}
