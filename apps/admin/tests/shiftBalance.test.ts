/**
 * 교대조 정산 테스트 — 급여와 직결되는 로직이라 가장 중요하다.
 * 사용자와 합의한 규칙:
 *  1) 월 기준시간 미달은 어떤 경우에도 없어야 한다
 *  2) 대휴는 이월된 추가근무(빚)를 대신 갚지 못한다
 *  3) 초과휴·근무단축은 누적 추가근무를 갚는 수단이다
 *  4) 조원끼리 대휴·초과휴·추가근무가 같은 날 겹치면 안 된다
 *  5) 입사일이 다르면 잔고도 따로 — 입사월 기준시간은 재직일수로 안분
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planMembersMonths, settleFromSaved, type MonthContext, type ShiftMember } from '../src/utils/shiftBalance'
import { rotationOn } from '../src/utils/shiftCodes'

const HOL = new Set([
  '2026-07-17', '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25',
])

function ctxOf(y: number, m: number): MonthContext {
  const total = new Date(y, m, 0).getDate()
  const key = `${y}-${String(m).padStart(2, '0')}`
  let wd = 0
  for (let d = 1; d <= total; d++) {
    const dt = new Date(y, m - 1, d)
    const iso = `${key}-${String(d).padStart(2, '0')}`
    if (dt.getDay() !== 0 && dt.getDay() !== 6 && !HOL.has(iso)) wd++
  }
  return {
    ym: key,
    days: Array.from({ length: total }, (_, i) => ({ day: i + 1, iso: `${key}-${String(i + 1).padStart(2, '0')}` })),
    baseHours: wd * 8,
    holidays: HOL,
  }
}

const CTXS = [7, 8, 9, 10, 11, 12].map(m => ctxOf(2026, m))
const MEMBERS: ShiftMember[] = [
  { id: 'a', name: '김원녀' }, { id: 'b', name: '이해옥' }, { id: 'c', name: '최진흥' },
]

test('규칙1 — 7~12월 어느 달도 기준시간 미달이 없다', () => {
  const series = planMembersMonths(CTXS, 'B조', undefined, MEMBERS)
  for (const month of series) for (const p of month) {
    assert.ok(p.workedHours >= p.baseHours, `${p.ym} ${p.name}: ${p.workedHours} < ${p.baseHours}`)
  }
})

test('규칙2 — 이월(미상환)은 매월 정확히 이어진다', () => {
  const series = planMembersMonths(CTXS, 'B조', undefined, MEMBERS)
  for (let i = 1; i < series.length; i++) {
    for (const p of series[i]) {
      const prev = series[i - 1].find(x => x.memberId === p.memberId)!
      assert.equal(p.opening, prev.closing, `${p.ym} ${p.name}`)
    }
  }
})

test('규칙3 — 갚은 시간(휴가+단축)은 미상환 잔고와 정확히 맞물린다', () => {
  const series = planMembersMonths(CTXS, 'B조', undefined, MEMBERS)
  for (const month of series) for (const p of month) {
    const expected = Math.round((p.opening + p.extraHours - p.paidBack) * 10) / 10
    assert.equal(p.closing, Math.max(0, expected), `${p.ym} ${p.name}`)
  }
})

test('규칙4 — 조원끼리 대휴·초과휴·추가근무가 같은 날 겹치지 않는다', () => {
  const series = planMembersMonths(CTXS, 'B조', undefined, MEMBERS)
  for (const month of series) {
    const daehyu = new Map<string, number>()
    const extra = new Map<string, number>()
    for (const p of month) {
      for (const [d, c] of Object.entries(p.codes)) {
        if (c === '대휴' || c === '초과휴') daehyu.set(d, (daehyu.get(d) ?? 0) + 1)
        else if (/\d{3,4}~\d{3,4}/.test(c)) extra.set(d, (extra.get(d) ?? 0) + 1)
      }
    }
    for (const [d, n] of daehyu) assert.ok(n <= 1, `${month[0]?.ym} ${d}일 휴무 ${n}명 겹침`)
    for (const [d, n] of extra) assert.ok(n <= 1, `${month[0]?.ym} ${d}일 추가근무 ${n}명 겹침`)
  }
})

test('규칙5 — 중도 입사자: 입사 전 0, 입사월은 재직일수로 안분', () => {
  const mem: ShiftMember[] = [...MEMBERS, { id: 'n', name: '신입', hireDate: '2026-09-14' }]
  const series = planMembersMonths(CTXS, 'B조', undefined, mem)
  const july = series[0].find(p => p.memberId === 'n')!
  const sept = series[2].find(p => p.memberId === 'n')!
  assert.equal(july.workedHours, 0)
  assert.equal(july.closing, 0)
  assert.ok(sept.baseHours < ctxOf(2026, 9).baseHours, '입사월 기준시간이 안분되지 않음')
  assert.ok(sept.workedHours >= sept.baseHours)
})

test('저장본 정산 — 손으로 고친 지난달이 이월에 반영된다 (재시뮬레이션 금지)', () => {
  const july = CTXS[0]
  // 7월 저장본: 회전 그대로 + 쉬는 날 하나에 0850~1600(6h) 추가근무
  const row: Record<string, string> = {}
  let restDay = 0
  july.days.forEach(({ day, iso }) => {
    const c = rotationOn('B조', iso)
    if (c) row[String(day)] = c
    else if (!restDay) restDay = day
  })
  row[String(restDay)] = '0850~1600'
  const { extra, paidBack } = settleFromSaved(july, 'B조', undefined, row)
  assert.equal(extra, 6)
  assert.equal(paidBack, 0)

  // 이 저장본을 넣으면 8월 이월이 6h가 된다 (시뮬레이션이면 14h)
  const series = planMembersMonths(CTXS.slice(0, 2), 'B조', undefined, [MEMBERS[0]],
    { '2026-07': { a: row } })
  assert.equal(series[1][0].opening, 6)
})

test('저장본 정산 — D를 줄인 날(0850~1600)과 초과휴는 갚음으로 계산된다', () => {
  const aug = CTXS[1]
  const row: Record<string, string> = {}
  let dDay = 0, dDay2 = 0
  aug.days.forEach(({ day, iso }) => {
    const c = rotationOn('B조', iso)
    if (c) row[String(day)] = c
    if (c === 'D' && !dDay) dDay = day
    else if (c === 'D' && !dDay2) dDay2 = day
  })
  row[String(dDay)] = '초과휴'          // 8h 갚음
  row[String(dDay2)] = '0850~1600'      // D 8h → 6h, 2h 갚음
  const { paidBack } = settleFromSaved(aug, 'B조', undefined, row)
  assert.equal(paidBack, 10)
})

test('연차는 정산 중립 — 쉬는 날의 休가 추가근무 빚이 되지 않는다', () => {
  const aug = CTXS[1]
  const row: Record<string, string> = {}
  let restDay = 0
  aug.days.forEach(({ day, iso }) => {
    const c = rotationOn('B조', iso)
    if (c) row[String(day)] = c
    else if (!restDay) restDay = day
  })
  row[String(restDay)] = '休'            // 쉬는 날에 연차 표기 (실무에서 종종 나온다)
  const { extra, paidBack } = settleFromSaved(aug, 'B조', undefined, row)
  assert.equal(extra, 0)                 // 연차가 빚으로 잡히면 안 된다
  assert.equal(paidBack, 0)
})

test('토·일과 겹친 공휴일 근무는 대휴를 만들지 않는다', () => {
  // 2026-08-15(토)·2026-08-17(월) 둘 다 공휴일로 등록되어 있다(HOL).
  // 회전상 15일(토)과 17일(월)에 모두 근무한 조합이 있어도,
  // 대휴 수는 '평일 공휴일 근무 수'와 같아야 한다.
  const series = planMembersMonths([ctxOf(2026, 8)], 'B조', undefined, MEMBERS)
  for (const p of series[0]) {
    // 이 사람이 실제 근무한 공휴일 중 평일인 날만 센다
    let weekdayHolWork = 0
    for (const [d, c] of Object.entries(p.codes)) {
      const iso = `2026-08-${String(d).padStart(2, '0')}`
      const dow = new Date(iso).getDay()
      const worked = c === 'D' || c === 'M' || c === 'N'
      if (worked && HOL.has(iso) && dow !== 0 && dow !== 6) weekdayHolWork++
    }
    assert.equal(p.daehyuDays, weekdayHolWork,
      `${p.name}: 대휴 ${p.daehyuDays} ≠ 평일 공휴일 근무 ${weekdayHolWork}`)
  }
})
