/**
 * 주간 직원 자동 편성 — 같은 직종끼리 휴무를 톱니바퀴처럼 엇갈리게 배치한다.
 *
 * 요양원은 365일 돌아가므로 주간 직원도 주말에 근무하고 평일에 쉰다.
 * 한 사람이 몰아서 쉬거나 같은 직종이 같은 날 함께 쉬면 그날 구멍이 나므로,
 * ① 각자 기준일수만큼 정확히 근무하고 ② 매일 쉬는 인원이 고르도록 나눈다.
 */

export interface DayPlanInput {
  days: number[]          // 편성할 일자 (1..31)
  staffIds: string[]      // 편성 순서 (앞뒤로 가까울수록 휴무일도 가까워진다)
  workDays: number        // 1인당 근무일수 (= 월 기준일수)
  /** 승인된 희망휴무 — staffId → 쉬고 싶은 일자들. 휴무 배정에서 이 날을 먼저 쓴다 */
  preferRest?: Record<string, number[]>
}

/**
 * 직종별 인원을 순번 위에 고르게 흩뿌린다.
 * 같은 직종을 몰아 두면 그 직종만 같은 날 몰려 쉬게 되므로,
 * 각자 '그룹 내 상대 위치'로 줄을 세워 서로 멀어지게 한다.
 * (실제 8월 인원으로 비교했을 때 주간 요양보호사 최소 근무가 1명 → 2명으로 늘었다)
 */
export function interleaveByPosition(groups: Record<string, string[]>): string[] {
  const keyed: { k: number; g: number; id: string }[] = []
  Object.values(groups).forEach((members, gi) => {
    members.forEach((id, j) => keyed.push({ k: (j + 0.5) / members.length, g: gi, id }))
  })
  keyed.sort((a, b) => a.k - b.k || a.g - b.g)
  return keyed.map(x => x.id)
}

export interface DayPlanResult {
  /** staffId → { day: 'D' } — 쉬는 날은 키가 없다 */
  plan: Record<string, Record<string, string>>
  /** 일자별 근무 인원 */
  perDay: Record<number, number>
}

export function planDayShift({ days, staffIds, workDays, preferRest }: DayPlanInput): DayPlanResult {
  const N = days.length
  const G = staffIds.length
  const plan: Record<string, Record<string, string>> = {}
  const perDay: Record<number, number> = {}
  if (N === 0 || G === 0) return { plan, perDay }

  const work = Math.max(0, Math.min(N, workDays))
  const rest = N - work                     // 1인당 쉬는 날 수
  staffIds.forEach(id => { plan[id] = {} })

  // 남은 휴무 수 — 많이 남은 사람부터 쉬게 해 한쪽에 몰리지 않게 한다
  const left = staffIds.map(() => rest)
  const totalRest = rest * G
  let assigned = 0
  let cursor = 0                            // 톱니: 매일 시작 지점을 옮겨 같은 사람만 쉬지 않게

  // 희망휴무는 시작 전에 '예약'한다.
  // 돌면서 소진하면(첫 구현) 월 후반 희망일에 도달할 즈음 휴무 정원이 이미
  // 스태거로 다 쓰여, 정작 낸 날에 근무가 배정됐다 — 테스트가 잡아준 버그.
  const daySet = new Set(days)
  const reserved = staffIds.map((id, i) => {
    const want = (preferRest?.[id] ?? []).filter(d => daySet.has(d)).slice(0, rest)
    left[i] -= want.length                 // 예약분만큼 스태거 몫을 미리 줄인다
    return new Set(want)
  })

  days.forEach((day, di) => {
    // 오늘까지 배정되어야 할 누적 휴무 수 (고르게 펴기)
    const target = Math.round((totalRest * (di + 1)) / N)
    let todayRest = Math.max(0, target - assigned)

    const restingToday: number[] = []
    // ① 예약된 희망휴무 먼저 — 정원과 무관하게 보장
    staffIds.forEach((_, i) => {
      if (reserved[i].has(day)) {
        restingToday.push(i)
        assigned++
        todayRest--
      }
    })
    // ② 남은 정원은 기존 톱니 순번대로
    let tried = 0
    while (todayRest > 0 && tried < G) {
      const i = (cursor + tried) % G
      tried++
      if (left[i] <= 0 || restingToday.includes(i)) continue
      restingToday.push(i)
      left[i]--
      assigned++
      todayRest--
    }
    cursor = (cursor + Math.max(1, restingToday.length)) % G

    let working = 0
    staffIds.forEach((id, i) => {
      if (restingToday.includes(i)) return   // 쉬는 날은 비워둔다
      plan[id][String(day)] = 'D'
      working++
    })
    perDay[day] = working
  })

  // 남은 휴무가 있으면(반올림 오차) 뒤에서부터 근무일을 덜어 정확히 맞춘다
  staffIds.forEach((id, i) => {
    let need = left[i]
    for (let k = days.length - 1; k >= 0 && need > 0; k--) {
      const d = String(days[k])
      if (plan[id][d]) { delete plan[id][d]; perDay[days[k]]--; need-- }
    }
  })

  return { plan, perDay }
}
