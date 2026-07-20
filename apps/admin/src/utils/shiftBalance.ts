/**
 * 교대조(주주야야휴휴) 월별 정산.
 *
 * 요양원은 365일 돌아가므로 교대조는 공휴일에도 근무한다.
 * 공휴일에 근무하면 대휴가 생기고, 대휴로 D 하나를 쉬면 그달 시간이 줄어든다.
 * 반대로 주기상 근무일이 많은 달은 기준시간을 넘긴다.
 *
 * 그래서 매달 (실근무 − 기준)을 누적 잔고로 들고 다니며,
 *  · 잔고가 마이너스면 → 부족분만큼 추가근무를 '주주 시작 직전 휴무일'에 넣고
 *  · 잔고가 플러스면 → 추가근무를 넣지 않고 잔고를 깎는다.
 * 이렇게 하면 특정 조만 계속 더 일하거나 덜 일하는 일이 없다.
 */
import { rotationOn, hoursOf, extraHoursOf, timeRangeForHours, CODE_MAP } from './shiftCodes'
import { DAILY_HOURS } from './baseHours'

export interface MonthContext {
  ym: string
  days: { day: number; iso: string }[]
  baseHours: number
  holidays: Set<string>        // 공휴일 ISO (유급휴일 제외)
}

/** 정산 대상 한 명 — 입사일이 다르면 누적 잔고도 달라진다 */
export interface ShiftMember {
  id: string
  name?: string
  hireDate?: string | null     // 'YYYY-MM-DD'
  resignDate?: string | null
}

export interface MemberMonthPlan {
  memberId: string
  name?: string
  ym: string
  team: string
  codes: Record<string, string>   // day → 근무 코드 (이 사람 최종)
  rotationHours: number
  daehyuDays: number              // 공휴일 근무에 대한 대체휴무
  compDays: number                // 초과근무 휴가 (하루 통째로 갚음)
  shortenHours: number            // D를 줄여서 갚은 시간 (0850~1600 등)
  extraHours: number              // 이달 추가근무
  paidBack: number                // 이달 갚은 총 시간 (초과휴 + 단축)
  workedHours: number
  baseHours: number               // 입사·퇴사월은 재직일수만큼 안분한 값
  activeDays: number              // 이달 재직일수
  monthDays: number
  opening: number                 // 지난달까지 못 갚은 추가근무 누적
  closing: number                 // 이달 끝 시점 미상환 누적
}

/** 하루 추가근무 상한 — 한 사람에게 하루 종일 몰아주지 않는다 */
export const MAX_EXTRA_PER_DAY = 7
/** 잔고가 남을 때 한 달에 줄 수 있는 초과근무 휴가 상한 */
export const MAX_COMP_DAYS = 2

/**
 * 서로 겹치지 않게 사람 수만큼 건너뛰며 고른다.
 * 같은 조원이 같은 날 쉬면 그날 인원이 한꺼번에 빠지므로,
 * 조원 i는 i번째 자리에서 시작해 인원 수만큼 띄워 가며 자기 날을 잡는다.
 */
function pickStaggered(
  pool: number[], memberIndex: number, count: number, memberCount: number,
  used: Set<number>, eligible?: (d: number) => boolean,
): number[] {
  const out: number[] = []
  const G = Math.max(1, memberCount)
  const ok = (d: number) => !used.has(d) && (!eligible || eligible(d))
  // 1순위: 자기 자리(i, i+G, i+2G …) — 조원끼리 날짜가 엇갈리도록
  for (let j = 0; out.length < count && memberIndex + j * G < pool.length; j++) {
    const d = pool[memberIndex + j * G]
    if (ok(d)) { out.push(d); used.add(d) }
  }
  // 2순위: 자리가 모자라면(중도 입사 등) 아직 아무도 안 쓴 날에서 채운다
  for (let i = 0; out.length < count && i < pool.length; i++) {
    const d = pool[i]
    if (ok(d)) { out.push(d); used.add(d) }
  }
  return out
}

const inService = (m: ShiftMember, iso: string) => {
  if (m.hireDate && iso < m.hireDate) return false
  if (m.resignDate && iso > m.resignDate) return false
  return true
}

/**
 * 조원 한 달치 편성을 사람별로 만든다.
 *
 * 회전(주주야야휴휴)은 조 공통이지만, 대휴·초과근무 휴가·추가근무는
 * 사람마다 누적 잔고가 달라 양이 다르다. 입사일이 다르면 더욱 그렇다.
 * 그래서 정산은 사람 단위로 하고, 배치할 때만 서로 날짜가 겹치지 않게 흩뿌린다.
 */
export function planMembersMonth(
  ctx: MonthContext,
  team: string,
  offsets: Record<string, number> | undefined,
  members: ShiftMember[],
  openings: Record<string, number>,
): MemberMonthPlan[] {
  const G = Math.max(1, members.length)

  // 조 공통 회전
  const baseCodes: Record<string, string> = {}
  const allWorkDays: number[] = []
  const allRestDays: number[] = []
  ctx.days.forEach(({ day, iso }) => {
    const c = rotationOn(team, iso, offsets)
    if (c) {
      baseCodes[String(day)] = c
      if (c === 'D') allWorkDays.push(day)
    } else allRestDays.push(day)
  })

  // '주주(D D) 시작 직전 휴무일'을 추가근무 우선 후보로
  const preDD = allRestDays.filter(d => {
    const next = ctx.days.find(x => x.day === d + 1)
    return next ? rotationOn(team, next.iso, offsets) === 'D' : false
  })
  const restPool = [...preDD, ...allRestDays.filter(d => !preDD.includes(d))]

  // 조원 전체가 공유하는 '이미 쓴 날' 표시 — 같은 날 두 명이 빠지지 않게 한다
  const usedRest = new Set<number>()
  const usedWork = new Set<number>()

  return members.map((mem, mi) => {
    const myDays = ctx.days.filter(({ iso }) => inService(mem, iso))
    const activeDays = myDays.length
    const monthDays = ctx.days.length

    // 입사·퇴사월은 재직일수만큼 기준시간을 안분한다
    const baseHours = activeDays === monthDays
      ? ctx.baseHours
      : Math.round((ctx.baseHours * activeDays) / monthDays * 2) / 2

    const codes: Record<string, string> = {}
    const workDays: number[] = []
    const holidayWorkDays: number[] = []
    let rotationHours = 0
    let holidayWork = 0
    myDays.forEach(({ day, iso }) => {
      const c = baseCodes[String(day)]
      if (!c) return
      codes[String(day)] = c
      rotationHours += hoursOf(c)
      if (c === 'D') workDays.push(day)
      if (ctx.holidays.has(iso)) { holidayWork++; holidayWorkDays.push(day) }
    })

    const daehyu = holidayWork
    const afterDaehyu = rotationHours - daehyu * DAILY_HOURS

    // ── ① 이달이 기준에 못 미치면 추가근무로 채운다 (기준 미달은 절대 허용 안 함).
    //    대휴로 줄어든 시간도 여기서 메우므로, 지난달까지 쌓인 미상환분을 축내지 않는다.
    let need = Math.round(Math.max(0, baseHours - afterDaehyu) * 2) / 2
    const perDay: number[] = []
    while (need > 0) { const put = Math.min(need, MAX_EXTRA_PER_DAY); perDay.push(put); need -= put }
    const extraHours = perDay.reduce((a, b) => a + b, 0)

    // ── ② 추가근무는 쉬는 날 나와서 일한 것이므로 갚아야 할 시간으로 쌓인다.
    let owed = (openings[mem.id] ?? 0) + extraHours
    let worked = afterDaehyu + extraHours

    // ── ③ 기준시간을 넘는 여유가 있으면 그만큼 갚는다.
    //    하루치(8h)는 초과근무 휴가로, 남는 자투리는 D를 줄여서(0850~1600 등) 갚는다.
    const room = Math.max(0, worked - baseHours)
    let payBack = Math.min(owed, room)
    let compDays = Math.min(Math.floor(payBack / DAILY_HOURS), MAX_COMP_DAYS,
                            Math.max(0, workDays.length - daehyu))
    let shortenHours = Math.round((payBack - compDays * DAILY_HOURS) * 2) / 2
    // 자투리가 D 하루를 다 채우면(=8h) 그냥 휴가로 돌린다
    if (shortenHours >= DAILY_HOURS) { shortenHours = 0 }
    // 남길 근무가 너무 짧으면(1시간 미만) 단축하지 않는다
    if (shortenHours > 0 && DAILY_HOURS - shortenHours < 1) shortenHours = 0
    payBack = compDays * DAILY_HOURS + shortenHours
    owed -= payBack
    worked -= payBack

    // 대휴는 '공휴일 근무 이후'가 앞에 오도록 후보를 줄 세운다
    const daehyuPool = [...workDays].sort((a, b) => {
      const pa = holidayWorkDays.filter(h => h < a).pop()
      const pb = holidayWorkDays.filter(h => h < b).pop()
      const ra = pa === undefined ? 1 : 0
      const rb = pb === undefined ? 1 : 0
      if (ra !== rb) return ra - rb
      if (ra === 0) return (a - pa!) - (b - pb!)
      return a - b
    })

    // 재직 중인 날만 후보로 (중도 입사자는 입사 전 날짜를 쓸 수 없다)
    const serving = (d: number) => myDays.some(x => x.day === d)
    const shortenSlots = shortenHours > 0 ? 1 : 0
    const picked = pickStaggered(daehyuPool, mi, daehyu + compDays + shortenSlots, G, usedWork, serving)
    picked.slice(0, daehyu).forEach(d => { codes[String(d)] = '대휴' })
    picked.slice(daehyu, daehyu + compDays).forEach(d => { codes[String(d)] = '초과휴' })
    // D를 줄여서 갚기 — 8시간짜리 D를 (8 − 갚을시간)만큼만 근무한다
    picked.slice(daehyu + compDays).forEach(d => {
      codes[String(d)] = timeRangeForHours(DAILY_HOURS - shortenHours)
    })
    pickStaggered(restPool, mi, perDay.length, G, usedRest, serving).forEach((d, k) => {
      codes[String(d)] = timeRangeForHours(perDay[k])
    })

    return {
      memberId: mem.id, name: mem.name, ym: ctx.ym, team, codes,
      rotationHours: Math.round(rotationHours * 10) / 10,
      daehyuDays: daehyu, compDays,
      shortenHours: Math.round(shortenHours * 10) / 10,
      extraHours: Math.round(extraHours * 10) / 10,
      paidBack: Math.round(payBack * 10) / 10,
      workedHours: Math.round(worked * 10) / 10,
      baseHours, activeDays, monthDays,
      opening: Math.round((openings[mem.id] ?? 0) * 10) / 10,
      closing: Math.round(owed * 10) / 10,
    }
  })
}

/**
 * 저장된 근무표 한 달치에서 '추가근무'와 '갚은 시간'을 읽어낸다.
 *
 * 지난달을 다시 계산하면 손으로 고친 내용(연차 대체, 수동 추가근무 등)이 사라진다.
 * 실제로 저장된 칸을 근거로 삼아야 이월이 맞는다.
 *  · 회전상 쉬는 날에 들어간 시간대  → 추가근무 (빚이 늘어남)
 *  · 회전상 D인 날의 초과휴          → 하루치(8h)를 갚음
 *  · 회전상 D인 날의 짧은 시간대      → 줄인 만큼 갚음
 */
export function settleFromSaved(
  ctx: MonthContext,
  team: string,
  offsets: Record<string, number> | undefined,
  row: Record<string, string> | undefined,
): { extra: number; paidBack: number } {
  let extra = 0, paidBack = 0
  if (!row) return { extra, paidBack }
  ctx.days.forEach(({ day, iso }) => {
    const v = (row[String(day)] ?? '').trim()
    if (!v) return
    const planned = rotationOn(team, iso, offsets)
    const custom = extraHoursOf(v)              // 직접 적은 시간대면 그 근무시간
    if (planned === 'D') {
      if (v === '초과휴') paidBack += DAILY_HOURS
      else if (custom > 0 && custom < DAILY_HOURS) paidBack += DAILY_HOURS - custom
    } else if (!planned) {                      // 원래 쉬는 날
      if (custom > 0) extra += custom
      else if (CODE_MAP[v]) extra += CODE_MAP[v].hours
    }
  })
  return { extra: Math.round(extra * 10) / 10, paidBack: Math.round(paidBack * 10) / 10 }
}

/**
 * 여러 달을 이어서 — 사람마다 미상환 추가근무가 따로 넘어간다.
 * saved가 있는 달(이미 저장된 지난달)은 저장된 내용 그대로 정산하고,
 * 없는 달(=이번 달)만 새로 편성한다.
 */
export function planMembersMonths(
  contexts: MonthContext[],
  team: string,
  offsets: Record<string, number> | undefined,
  members: ShiftMember[],
  saved: Record<string, Record<string, Record<string, string>>> = {},
): MemberMonthPlan[][] {
  const bal: Record<string, number> = {}
  members.forEach(m => { bal[m.id] = 0 })
  return contexts.map((ctx, i) => {
    const isLast = i === contexts.length - 1
    const savedMonth = saved[ctx.ym]
    // 지난달이고 저장본이 있으면 그걸로 정산만 하고 편성은 건드리지 않는다
    if (!isLast && savedMonth) {
      return members.map(mem => {
        const { extra, paidBack } = settleFromSaved(ctx, team, offsets, savedMonth[mem.id])
        const opening = bal[mem.id] ?? 0
        const closing = Math.max(0, Math.round((opening + extra - paidBack) * 10) / 10)
        bal[mem.id] = closing
        return {
          memberId: mem.id, name: mem.name, ym: ctx.ym, team, codes: savedMonth[mem.id] ?? {},
          rotationHours: 0, daehyuDays: 0, compDays: 0, shortenHours: 0,
          extraHours: extra, paidBack, workedHours: 0,
          baseHours: ctx.baseHours, activeDays: ctx.days.length, monthDays: ctx.days.length,
          opening: Math.round(opening * 10) / 10, closing,
        } as MemberMonthPlan
      })
    }
    const plans = planMembersMonth(ctx, team, offsets, members, bal)
    plans.forEach(p => { bal[p.memberId] = p.closing })
    return plans
  })
}
