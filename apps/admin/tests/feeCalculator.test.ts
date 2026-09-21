import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RATES,
  calculateFee,
  daysInMonth,
  defaultInputs,
  extraCap,
  floorPoints,
  floorWon,
  validateInputs,
  type FeeInputs,
} from '../src/utils/feeCalculator'

/**
 * 계획 계산기는 "확인된 것만 더하고, 확인 안 된 건 0"이 원칙이다.
 * 여기 숫자들은 모두 공개 단가와 가공의 인원으로 만든 것이며
 * 특정 시설의 실제 청구·정산 금액이 아니다.
 */
function mk(over: Partial<FeeInputs> = {}, month = '2026-05'): FeeInputs {
  return { ...defaultInputs(month), ...over }
}

/** node-shims에 assert.throws가 없어 직접 잡는다 */
function throwsMatching(fn: () => unknown, re: RegExp): void {
  let message = ''
  let threw = false
  try {
    fn()
  } catch (e) {
    threw = true
    message = e instanceof Error ? e.message : String(e)
  }
  assert.ok(threw, '예외가 나야 한다')
  assert.match(message, re)
}

/* ------------------------------------------------------------------ */
/* 단가·일수                                                            */
/* ------------------------------------------------------------------ */

test('2026 단가표', () => {
  assert.deepEqual([...RATES.enhanced], [93070, 86340, 81540])
  assert.deepEqual([...RATES.standard], [88520, 82120, 77540])
})

test('daysInMonth: 2026년 각 달과 잘못된 입력', () => {
  assert.equal(daysInMonth('2026-01'), 31)
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2026-04'), 30)
  assert.equal(daysInMonth('2026-12'), 31)
  assert.equal(daysInMonth('2024-02'), 29, '윤년 계산 자체는 순수 함수')
  assert.ok(Number.isNaN(daysInMonth('2026-13')))
  assert.ok(Number.isNaN(daysInMonth('2026-5')))
  assert.ok(Number.isNaN(daysInMonth('abc')))
})

test('수가 = 단가 × 인원 × 일수 (31일·30일·28일)', () => {
  const r31 = calculateFee(mk({ counts: [1, 0, 0] }, '2026-05'))
  assert.equal(r31.base, 93070 * 31)
  const r30 = calculateFee(mk({ counts: [0, 1, 0] }, '2026-04'))
  assert.equal(r30.base, 86340 * 30)
  const r28 = calculateFee(mk({ counts: [0, 0, 1] }, '2026-02'))
  assert.equal(r28.base, 81540 * 28)
  const std = calculateFee(mk({ tier: 'standard', counts: [1, 1, 1] }, '2026-05'))
  assert.equal(std.base, (88520 + 82120 + 77540) * 31)
})

test('일수는 해당 달을 넘길 수 없다 (29·30·31 경계)', () => {
  assert.ok(validateInputs(mk({ days: 29 }, '2026-02')).some((e) => e.startsWith('days')))
  assert.equal(validateInputs(mk({ days: 28 }, '2026-02')).length, 0)
  assert.ok(validateInputs(mk({ days: 31 }, '2026-04')).some((e) => e.startsWith('days')))
  assert.equal(validateInputs(mk({ days: 30 }, '2026-04')).length, 0)
  assert.equal(validateInputs(mk({ days: 31 }, '2026-05')).length, 0)
  assert.ok(
    validateInputs(mk({ noncoveredDays: 31 }, '2026-06')).some((e) =>
      e.startsWith('noncoveredDays'),
    ),
  )
})

test('청구 일수가 달보다 짧으면 수가가 비례해서 줄고 경고가 붙는다', () => {
  const r = calculateFee(mk({ counts: [1, 0, 0], days: 15 }))
  assert.equal(r.base, 93070 * 15)
  assert.ok(r.warnings.some((w) => w.includes('청구 일수 15일')))
})

/* ------------------------------------------------------------------ */
/* 기본값·0                                                             */
/* ------------------------------------------------------------------ */

test('defaultInputs: 인원·인력·인건비 0, 식비 4000×3 간식 750×2, 정원 0, 2.1:1 이상', () => {
  const d = defaultInputs('2026-04')
  assert.equal(d.month, '2026-04')
  assert.equal(d.tier, 'enhanced')
  assert.deepEqual(d.counts, [0, 0, 0])
  assert.equal(d.days, 30)
  assert.equal(d.noncoveredDays, 30)
  assert.equal(d.averageResidents, 0)
  assert.equal(d.capacity, 0)
  assert.equal(d.mealPrice, 4000)
  assert.equal(d.mealsPerDay, 3)
  assert.equal(d.snackPrice, 750)
  assert.equal(d.snacksPerDay, 2)
  assert.equal(d.programConfirmed, false)
  assert.equal(d.staffingConfirmed, false)
  assert.equal(d.nightConfirmed, false)
  assert.equal(d.temporaryConfirmed, false)
  assert.equal(d.payroll, 0)
  assert.equal(d.laborBasis, 0)
  assert.equal(validateInputs(d).length, 0, '기본값은 그대로 검증을 통과해야 한다')
})

test('defaultInputs: 잘못된 달이면 일수 0으로 두고 검증에서 걸린다', () => {
  const d = defaultInputs('nope')
  assert.equal(d.days, 0)
  assert.ok(validateInputs(d).some((e) => e.startsWith('month')))
})

test('전부 0이면 모든 금액이 0이고 경고만 남는다', () => {
  const r = calculateFee(mk())
  assert.equal(r.residents, 0)
  assert.equal(r.base, 0)
  assert.equal(r.copay, 0)
  assert.equal(r.insurer, 0)
  assert.equal(r.noncovered, 0)
  assert.equal(r.bonus, 0)
  assert.equal(r.total, 0)
  assert.equal(r.insuranceTotal, 0)
  assert.equal(r.requiredCaregiversRaw, 0)
  assert.equal(r.requiredCaregiversPlan, 0)
  assert.equal(r.laborMinimum, 0)
  assert.equal(r.operatingBalance, 0)
  assert.equal(r.hireBonus, 0)
  assert.ok(r.warnings.some((w) => w.includes('0명')))
  assert.ok(r.warnings.some((w) => w.includes('평균 현원(가산 분모) 0')))
  assert.ok(r.warnings.some((w) => w.includes('정원 미입력')))
})

/* ------------------------------------------------------------------ */
/* 본인부담·비급여                                                       */
/* ------------------------------------------------------------------ */

test('본인부담금은 Math.round, 공단분 = 수가 − 본인부담', () => {
  const base = 93070 * 31
  const r20 = calculateFee(mk({ counts: [1, 0, 0], copayRate: 0.2 }))
  assert.equal(r20.copay, Math.round(base * 0.2))
  assert.equal(r20.insurer, base - r20.copay)
  const r12 = calculateFee(mk({ counts: [1, 0, 0], copayRate: 0.12 }))
  assert.equal(r12.copay, 346220, '346220.4 → 346220')
  const r8 = calculateFee(mk({ counts: [1, 0, 0], copayRate: 0.08 }))
  assert.equal(r8.copay, 230814, '230813.6 → 230814')
  const r0 = calculateFee(mk({ counts: [1, 0, 0], copayRate: 0 }))
  assert.equal(r0.copay, 0)
  assert.equal(r0.insurer, base)
})

test('비급여 = 인원 × 일수 × (식비×끼니 + 간식×횟수)', () => {
  const r = calculateFee(mk({ counts: [1, 0, 0] }))
  assert.equal(r.noncovered, 31 * (4000 * 3 + 750 * 2))
  const r2 = calculateFee(mk({ counts: [2, 1, 0], noncoveredDays: 10, snackPrice: 0 }))
  assert.equal(r2.noncovered, 3 * 10 * 12000)
})

/* ------------------------------------------------------------------ */
/* 가산 한도·점수                                                        */
/* ------------------------------------------------------------------ */

test('extraCap: 10/30/50/70/90 경계', () => {
  assert.equal(extraCap(0), 1.4)
  assert.equal(extraCap(9), 1.4)
  assert.equal(extraCap(10), 2.6)
  assert.equal(extraCap(29), 2.6)
  assert.equal(extraCap(30), 4.0)
  assert.equal(extraCap(49), 4.0)
  assert.equal(extraCap(50), 5.2)
  assert.equal(extraCap(69), 5.2)
  assert.equal(extraCap(70), 6.6)
  assert.equal(extraCap(89), 6.6)
  assert.equal(extraCap(90), 7.8)
  assert.equal(extraCap(500), 7.8)
})

test('floorPoints / floorWon: 내림이되 부동소수 오차는 삼킨다', () => {
  assert.equal(floorPoints(3 * 0.6), 1.8)
  assert.equal(floorPoints(1.999), 1.99)
  assert.equal(floorPoints(1.2 + 2.8), 4)
  assert.equal(floorWon(1384881.6), 1384880)
  assert.equal(floorWon(2922640), 2922640)
  assert.equal(floorWon(9), 0)
})

test('인력추가배치 가산 = 기준금액(80%) × 점수 / 평균현원, 10원 내림', () => {
  const r = calculateFee(
    mk({
      counts: [10, 10, 10],
      days: 30,
      averageResidents: 30,
      staffingConfirmed: true,
      extraSocial: 1,
    }),
  )
  const base = (93070 + 86340 + 81540) * 10 * 30
  assert.equal(r.base, base)
  assert.equal(r.bonusBase, base * 0.8)
  assert.equal(r.extraPoints, 1.4)
  assert.equal(r.extraBonus, Math.floor((base * 0.8 * 1.4) / 30 / 10) * 10)
  assert.equal(r.bonus, r.extraBonus)
})

test('가산금 10원 내림', () => {
  const r = calculateFee(
    mk({ counts: [1, 0, 0], averageResidents: 1, registeredNurses: 1, staffingConfirmed: true }),
  )
  // 2885170 × 0.8 × 0.6 = 1384881.6 → 1384880
  assert.equal(r.nurseBonus, 1384880)
})

test('인력추가배치 점수는 인정 한도로 잘린다 (9명 → 1.4점)', () => {
  const r = calculateFee(
    mk({ counts: [9, 0, 0], averageResidents: 9, staffingConfirmed: true, extraSocial: 2 }),
  )
  assert.equal(r.extraPoints, 1.4)
  assert.ok(r.warnings.some((w) => w.includes('한도')))
})

test('간호사 가산(제59조): 1인 0.6점, 50인 이상은 기관당 +0.2 (인당 0.8 아님)', () => {
  const r49 = calculateFee(
    mk({ counts: [49, 0, 0], averageResidents: 49, registeredNurses: 1, staffingConfirmed: true }),
  )
  assert.equal(r49.nursePoints, 0.6)
  const r50 = calculateFee(
    mk({ counts: [50, 0, 0], averageResidents: 50, registeredNurses: 1, staffingConfirmed: true }),
  )
  assert.equal(r50.nursePoints, 0.8, '0.6 + 기관 0.2')
  assert.ok(r50.warnings.some((w) => w.includes('기관당 0.2점')))
  const r50x2 = calculateFee(
    mk({ counts: [50, 0, 0], averageResidents: 50, registeredNurses: 2, staffingConfirmed: true }),
  )
  assert.equal(r50x2.nursePoints, 1.4, '2×0.6 + 0.2 = 1.4 (2×0.8 = 1.6 아님)')
  const r50none = calculateFee(
    mk({ counts: [50, 0, 0], averageResidents: 50, registeredNurses: 0, staffingConfirmed: true }),
  )
  assert.equal(r50none.nursePoints, 0, '간호사가 없으면 기관 0.2도 없다')
  const r3 = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, registeredNurses: 3, staffingConfirmed: true }),
  )
  assert.equal(r3.nursePoints, 1.8, '3 × 0.6 = 1.8 (1.7999… 아님)')
  const r90x3 = calculateFee(
    mk({ counts: [90, 0, 0], averageResidents: 90, registeredNurses: 3, staffingConfirmed: true }),
  )
  assert.equal(r90x3.nursePoints, 2, '3×0.6 + 0.2')
})

test('간호사 가산은 인력추가배치 한도 밖이고 서로 섞이지 않는다', () => {
  const r = calculateFee(
    mk({
      counts: [9, 0, 0],
      averageResidents: 9,
      staffingConfirmed: true,
      extraSocial: 1,
      registeredNurses: 2,
    }),
  )
  assert.equal(r.extraPoints, 1.4)
  assert.equal(r.nursePoints, 1.2)
  assert.equal(r.bonus, r.extraBonus + r.nurseBonus)
})

test('한시 가산은 확인된 점수 그대로, 한도 밖', () => {
  const r = calculateFee(
    mk({
      counts: [9, 0, 0],
      averageResidents: 9,
      staffingConfirmed: true,
      extraSocial: 1,
      temporaryPoints: 1.3,
      temporaryConfirmed: true,
    }),
  )
  assert.equal(r.extraPoints, 1.4)
  assert.equal(r.temporaryPoints, 1.3)
  assert.ok(r.temporaryBonus > 0)
  assert.equal(r.bonus, r.extraBonus + r.temporaryBonus)
})

test('맞춤형 프로그램 가산 0.25 / 0.5', () => {
  const half = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, programPoints: 0.5, programConfirmed: true }),
  )
  assert.equal(half.programPoints, 0.5)
  assert.equal(half.programBonus, floorWon((half.bonusBase * 0.5) / 20))
  const quarter = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, programPoints: 0.25, programConfirmed: true }),
  )
  assert.equal(quarter.programPoints, 0.25)
  assert.ok(quarter.programBonus < half.programBonus)
})

/* ------------------------------------------------------------------ */
/* 확인 게이트                                                           */
/* ------------------------------------------------------------------ */

test('확인 안 된 가산은 전부 0 (staffing / night / program / temporary)', () => {
  const r = calculateFee(
    mk({
      counts: [20, 0, 0],
      averageResidents: 20,
      extraSocial: 1,
      registeredNurses: 1,
      nightStaff: 1,
      dayStaff: 2,
      programPoints: 0.5,
      temporaryPoints: 1.3,
    }),
  )
  assert.equal(r.extraPoints, 0)
  assert.equal(r.nursePoints, 0)
  assert.equal(r.nightPoints, 0)
  assert.equal(r.programPoints, 0)
  assert.equal(r.temporaryPoints, 0)
  assert.equal(r.bonus, 0)
  assert.equal(r.total, r.base + r.noncovered)
  assert.ok(r.warnings.some((w) => w.includes('staffingConfirmed')))
  assert.ok(r.warnings.some((w) => w.includes('nightConfirmed')))
  assert.ok(r.warnings.some((w) => w.includes('programConfirmed')))
  assert.ok(r.warnings.some((w) => w.includes('temporaryConfirmed')))
})

test('확인하면 같은 입력으로 가산이 붙는다', () => {
  const r = calculateFee(
    mk({
      counts: [20, 0, 0],
      averageResidents: 20,
      extraSocial: 1,
      registeredNurses: 1,
      nightStaff: 1,
      dayStaff: 2,
      programPoints: 0.5,
      temporaryPoints: 1.3,
      staffingConfirmed: true,
      nightConfirmed: true,
      programConfirmed: true,
      temporaryConfirmed: true,
    }),
  )
  assert.ok(r.extraBonus > 0)
  assert.ok(r.nurseBonus > 0)
  assert.ok(r.nightBonus > 0)
  assert.ok(r.programBonus > 0)
  assert.ok(r.temporaryBonus > 0)
  assert.equal(
    r.bonus,
    r.extraBonus + r.nurseBonus + r.nightBonus + r.programBonus + r.temporaryBonus,
  )
})

test('평균 현원 0이면 점수가 있어도 가산금은 0', () => {
  const r = calculateFee(
    mk({
      counts: [10, 10, 10],
      averageResidents: 0,
      staffingConfirmed: true,
      extraSocial: 1,
      registeredNurses: 1,
      nightConfirmed: true,
      nightStaff: 1,
      programConfirmed: true,
      programPoints: 0.5,
      temporaryConfirmed: true,
      temporaryPoints: 1,
    }),
  )
  assert.equal(r.extraBonus, 0)
  assert.equal(r.nurseBonus, 0)
  assert.equal(r.nightBonus, 0)
  assert.equal(r.programBonus, 0)
  assert.equal(r.temporaryBonus, 0)
  assert.equal(r.bonus, 0)
  assert.equal(r.hireBonus, 0)
  assert.ok(r.warnings.some((w) => w.includes('평균 현원(가산 분모) 0')))
})

test('인원 합계와 평균 현원이 다르면 경고, 분모는 평균 현원', () => {
  const r = calculateFee(
    mk({ counts: [10, 0, 0], averageResidents: 12, staffingConfirmed: true, extraSocial: 1 }),
  )
  assert.ok(r.warnings.some((w) => w.includes('다릅니다')))
  assert.equal(r.extraBonus, floorWon((r.bonusBase * 1.4) / 12))
})

/* ------------------------------------------------------------------ */
/* 야간 배치                                                             */
/* ------------------------------------------------------------------ */

test('야간: 확인 + 1명 이상이면 기관당 0.9점', () => {
  const r = calculateFee(
    mk({ counts: [40, 0, 0], averageResidents: 40, nightStaff: 1, dayStaff: 6, nightConfirmed: true }),
  )
  assert.equal(r.nightPoints, 0.9, '1인당 40명 > 20명이라 강화 아님')
  assert.ok(r.warnings.some((w) => w.includes('야간직원배치강화 조건 미충족')))
  assert.ok(r.warnings.some((w) => w.includes('자유 수익 아님')))
})

test('야간: 야간 0명이면 0점', () => {
  const r = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, nightStaff: 0, dayStaff: 4, nightConfirmed: true }),
  )
  assert.equal(r.nightPoints, 0)
  assert.equal(r.nightBonus, 0)
})

test('야간 강화: 1인당 20명 이하 AND 주간 ≥ 야간×2 (20명 이상)', () => {
  const ok = calculateFee(
    mk({ counts: [40, 0, 0], averageResidents: 40, nightStaff: 2, dayStaff: 4, nightConfirmed: true }),
  )
  assert.equal(ok.nightPoints, 1.8)
  assert.ok(!ok.warnings.some((w) => w.includes('야간직원배치강화 조건 미충족')))

  const dayShort = calculateFee(
    mk({ counts: [40, 0, 0], averageResidents: 40, nightStaff: 2, dayStaff: 3, nightConfirmed: true }),
  )
  assert.equal(dayShort.nightPoints, 0.9, '주간 3 < 4 → 기관당 0.9')

  const ratioOver = calculateFee(
    mk({ counts: [41, 0, 0], averageResidents: 41, nightStaff: 2, dayStaff: 6, nightConfirmed: true }),
  )
  assert.equal(ratioOver.nightPoints, 0.9, '41/2 = 20.5 > 20')

  const exactly20 = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, nightStaff: 1, dayStaff: 2, nightConfirmed: true }),
  )
  assert.equal(exactly20.nightPoints, 0.9, '강화 1명 × 0.9')
  assert.ok(!exactly20.warnings.some((w) => w.includes('야간직원배치강화 조건 미충족')))

  const twentyNeedsDouble = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, nightStaff: 2, dayStaff: 2, nightConfirmed: true }),
  )
  assert.equal(twentyNeedsDouble.nightPoints, 0.9, '20명은 동수 불가 → 기관당')
})

test('야간 강화: 20명 미만은 주간 동수도 인정', () => {
  const r = calculateFee(
    mk({ counts: [19, 0, 0], averageResidents: 19, nightStaff: 2, dayStaff: 2, nightConfirmed: true }),
  )
  assert.equal(r.nightPoints, 1.8)
  assert.ok(!r.warnings.some((w) => w.includes('야간직원배치강화 조건 미충족')))
})

test('야간·주간 인원은 공단 산정 FTE라 소수를 받는다', () => {
  const r = calculateFee(
    mk({ counts: [30, 0, 0], averageResidents: 30, nightStaff: 1.5, dayStaff: 3, nightConfirmed: true }),
  )
  assert.equal(r.nightPoints, 1.35, '30/1.5 = 20 ≤ 20, 주간 3 ≥ 3 → 1.5 × 0.9')
  const short = calculateFee(
    mk({ counts: [30, 0, 0], averageResidents: 30, nightStaff: 1.5, dayStaff: 2.99, nightConfirmed: true }),
  )
  assert.equal(short.nightPoints, 0.9)
})

test('야간 가산도 평균 현원 0이면 0원', () => {
  const r = calculateFee(
    mk({ counts: [0, 0, 0], averageResidents: 0, nightStaff: 1, dayStaff: 2, nightConfirmed: true }),
  )
  assert.equal(r.nightPoints, 0.9, '점수는 기관당 0.9')
  assert.equal(r.nightBonus, 0)
})

/* ------------------------------------------------------------------ */
/* 합계·이중 계산 방지                                                     */
/* ------------------------------------------------------------------ */

test('총액 항등식: total = insuranceTotal + copay + noncovered', () => {
  const r = calculateFee(
    mk({
      counts: [10, 8, 6],
      averageResidents: 24,
      copayRate: 0.15,
      staffingConfirmed: true,
      extraSocial: 1,
      registeredNurses: 1,
      nightStaff: 1,
      dayStaff: 4,
      nightConfirmed: true,
      programPoints: 0.25,
      programConfirmed: true,
    }),
  )
  assert.equal(r.total, r.base + r.bonus + r.noncovered)
  assert.equal(r.insuranceTotal, r.insurer + r.bonus)
  assert.equal(r.insuranceTotal + r.copay + r.noncovered, r.total)
  assert.equal(r.insurer + r.copay, r.base)
})

test('간호사 수는 인력추가배치 점수에 들어가지 않는다 (이중 계산 방지)', () => {
  const r = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: true, registeredNurses: 2 }),
  )
  assert.equal(r.extraPoints, 0)
  assert.equal(r.extraBonus, 0)
  assert.equal(r.nursePoints, 1.2)
})

test('가산 기준금액은 비급여를 포함하지 않는다', () => {
  const r = calculateFee(mk({ counts: [5, 0, 0], averageResidents: 5 }))
  assert.equal(r.bonusBase, r.base * 0.8)
  assert.ok(r.noncovered > 0)
})

/* ------------------------------------------------------------------ */
/* 채용 시나리오(한계 가산)                                                */
/* ------------------------------------------------------------------ */

test('사회복지사 1인 추가: 한도 안이면 1.4점만큼 증가', () => {
  const r = calculateFee(
    mk({ counts: [10, 10, 10], days: 30, averageResidents: 30, staffingConfirmed: true, hireCost: 3000000 }),
  )
  assert.equal(r.hireBonus, floorWon((r.bonusBase * 1.4) / 30))
  assert.equal(r.hireNet, r.hireBonus - 3000000)
})

test('사회복지사 1인 추가: 한도에 걸리면 잘린 증분만', () => {
  const r = calculateFee(
    mk({ counts: [10, 10, 10], days: 30, averageResidents: 30, staffingConfirmed: true, extraSocial: 2 }),
  )
  // 2.8 → 4.2 이지만 한도 4.0
  const before = floorWon((r.bonusBase * 2.8) / 30)
  const after = floorWon((r.bonusBase * 4.0) / 30)
  assert.equal(r.extraBonus, before)
  assert.equal(r.hireBonus, after - before)
  assert.ok(r.hireBonus < floorWon((r.bonusBase * 1.4) / 30))
})

test('사회복지사 1인 추가: 이미 한도면 증분 0 + 경고', () => {
  const r = calculateFee(
    mk({ counts: [10, 10, 10], days: 30, averageResidents: 30, staffingConfirmed: true, extraSocial: 3, hireCost: 100 }),
  )
  assert.equal(r.extraPoints, 4.0)
  assert.equal(r.hireBonus, 0)
  assert.equal(r.hireNet, -100)
  assert.ok(r.warnings.some((w) => w.includes('한도 도달')))
})

test('채용 증분에 간호사 가산을 끼워 넣지 않는다', () => {
  const a = calculateFee(mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: true }))
  const b = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: true, registeredNurses: 2 }),
  )
  assert.equal(a.hireBonus, b.hireBonus)
})

test('채용 증분은 기존 가산을 다시 세지 않는다 (미확인 상태라도 증분만)', () => {
  const confirmed = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: true, extraSocial: 1 }),
  )
  const unconfirmed = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: false, extraSocial: 1 }),
  )
  assert.equal(unconfirmed.extraBonus, 0)
  assert.equal(unconfirmed.hireBonus, confirmed.hireBonus, '증분은 게이트와 무관하게 같다')
  assert.ok(unconfirmed.warnings.some((w) => w.includes('채용 시나리오')))
})

/* ------------------------------------------------------------------ */
/* 인력·인건비·운영 수지                                                    */
/* ------------------------------------------------------------------ */

test('요양보호사 계획 인원 = 입소자/2.1 올림 (계획용)', () => {
  const r21 = calculateFee(mk({ counts: [21, 0, 0], averageResidents: 21 }))
  assert.equal(r21.requiredCaregiversRaw, 10)
  assert.equal(r21.requiredCaregiversPlan, 10)
  const r22 = calculateFee(mk({ counts: [22, 0, 0], averageResidents: 22 }))
  assert.ok(Math.abs(r22.requiredCaregiversRaw - 22 / 2.1) < 1e-9)
  assert.equal(r22.requiredCaregiversPlan, 11)
  assert.ok(r22.warnings.some((w) => w.includes('법정 배치 판정 아님')))
})

test('제48조 산식 참고값: 반올림, 0.5 미만이면 1명, 입소자 0이면 0', () => {
  const r21 = calculateFee(mk({ counts: [21, 0, 0], averageResidents: 21 }))
  assert.equal(r21.requiredCaregiversLegal, 10)
  const r22 = calculateFee(mk({ counts: [22, 0, 0], averageResidents: 22 }))
  assert.equal(r22.requiredCaregiversLegal, 10, '10.48 → 10 (계획값은 11)')
  assert.equal(r22.requiredCaregiversPlan, 11)
  assert.ok(r22.warnings.some((w) => w.includes('제48조 산식 참고값 10명')))
  const r53 = calculateFee(mk({ counts: [53, 0, 0], averageResidents: 53 }))
  assert.equal(r53.requiredCaregiversLegal, 25, '25.24 → 25')
  assert.equal(r53.requiredCaregiversPlan, 26)
  const r1 = calculateFee(mk({ counts: [1, 0, 0], averageResidents: 1 }))
  assert.equal(r1.requiredCaregiversLegal, 1, '0.48 → 기본 1명')
  const r0 = calculateFee(mk())
  assert.equal(r0.requiredCaregiversLegal, 0)
  const fallback = calculateFee(mk({ counts: [21, 0, 0], averageResidents: 0 }))
  assert.equal(fallback.requiredCaregiversLegal, 10, '평균 현원 없으면 인원 합계로')
})

test('요양보호사 계획 인원은 인원 합계와 평균 현원 중 큰 쪽', () => {
  const r = calculateFee(mk({ counts: [25, 0, 0], averageResidents: 21, caregiverFte: 10 }))
  assert.equal(r.requiredCaregiversPlan, 12)
  assert.equal(r.caregiverGap, -2)
  assert.ok(r.warnings.some((w) => w.includes('2명 부족')))
  const r2 = calculateFee(mk({ counts: [10, 0, 0], averageResidents: 25, caregiverFte: 12 }))
  assert.equal(r2.requiredCaregiversPlan, 12)
  assert.equal(r2.caregiverGap, 0)
})

test('인건비 최소액: 기준액 없으면 (수가+가산)×0.626 근사 추정, 있으면 기준액×0.626', () => {
  const est = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: true, extraSocial: 1, payroll: 30000000 }),
  )
  assert.equal(est.laborBasisUsed, est.base + est.bonus)
  assert.equal(est.laborMinimum, Math.round((est.base + est.bonus) * 0.626))
  assert.equal(est.laborGap, 30000000 - est.laborMinimum)
  assert.ok(est.warnings.some((w) => w.includes('인건비 기준액 미입력')))
  assert.ok(est.warnings.some((w) => w.includes('장기근속 장려금')))

  const given = calculateFee(mk({ counts: [20, 0, 0], averageResidents: 20, laborBasis: 50000000 }))
  assert.equal(given.laborBasisUsed, 50000000)
  assert.equal(given.laborMinimum, Math.round(50000000 * 0.626))
  assert.ok(given.warnings.some((w) => w.includes('법정 준수 판정 아님')))
})

test('인건비 추정 기준액은 맞춤형(제62조)·한시(제56조의2) 가산을 뻐고, 간호사·야간 가산은 넣는다', () => {
  const r = calculateFee(
    mk({
      counts: [20, 0, 0],
      averageResidents: 20,
      staffingConfirmed: true,
      extraSocial: 1,
      registeredNurses: 1,
      nightStaff: 1,
      dayStaff: 2,
      nightConfirmed: true,
      programPoints: 0.5,
      programConfirmed: true,
      temporaryPoints: 1.3,
      temporaryConfirmed: true,
    }),
  )
  assert.ok(r.programBonus > 0)
  assert.ok(r.temporaryBonus > 0)
  assert.equal(
    r.laborBasisUsed,
    r.base + r.extraBonus + r.nurseBonus + r.nightBonus,
  )
  assert.equal(r.laborBasisUsed, r.base + r.bonus - r.programBonus - r.temporaryBonus)
  assert.equal(r.laborMinimum, Math.round(r.laborBasisUsed * 0.626))
})

test('운영 수지 = 총수입 − 인건비 − 기타지출', () => {
  const r = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, payroll: 40000000, otherCosts: 5000000 }),
  )
  assert.equal(r.operatingBalance, r.total - 40000000 - 5000000)
  assert.ok(!r.warnings.some((w) => w.includes('인건비 지출 미입력')))
  const noPayroll = calculateFee(mk({ counts: [20, 0, 0], averageResidents: 20 }))
  assert.ok(noPayroll.warnings.some((w) => w.includes('인건비 지출 미입력')))
})

test('정원 초과·단가 선택 경고', () => {
  const r = calculateFee(mk({ counts: [30, 0, 0], averageResidents: 30, capacity: 29 }))
  assert.ok(r.warnings.some((w) => w.includes('정원 29명을 넘습니다')))
  assert.ok(r.warnings.some((w) => w.includes('인력 기준 충족 여부는 확인하지 않습니다')))
  const s = calculateFee(mk({ tier: 'standard', counts: [1, 0, 0], averageResidents: 1 }))
  assert.ok(s.warnings.some((w) => w.includes('2.1:1 미만')))
})

test('인력추가배치 인원은 공단 산정 인원이어야 한다는 경고(제51조)', () => {
  const r = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: true, extraTherapy: 1 }),
  )
  assert.ok(r.warnings.some((w) => w.includes('제51조')))
  assert.equal(r.extraPoints, 1.4)
  const nursing = calculateFee(
    mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: true, extraNursing: 1 }),
  )
  assert.equal(nursing.extraPoints, 1.2)
  const none = calculateFee(mk({ counts: [20, 0, 0], averageResidents: 20, staffingConfirmed: true }))
  assert.ok(!none.warnings.some((w) => w.includes('제51조')))
})

/* ------------------------------------------------------------------ */
/* 검증                                                                */
/* ------------------------------------------------------------------ */

test('validateInputs: 정상 입력은 빈 배열', () => {
  assert.deepEqual(
    validateInputs(
      mk({
        counts: [10, 8, 6],
        averageResidents: 24,
        capacity: 29,
        copayRate: 0.12,
        extraSocial: 1,
        registeredNurses: 1,
        nightStaff: 1.5,
        dayStaff: 4.25,
        programPoints: 0.25,
        temporaryPoints: 1.3,
        caregiverFte: 12.5,
        payroll: 40000000,
      }),
    ),
    [],
  )
})

test('validateInputs: 인정 입소자수·가산 인원은 정수, 주간·야간 인원은 소수 허용', () => {
  assert.ok(
    validateInputs(mk({ averageResidents: 12.5 })).some((e) => e.startsWith('averageResidents')),
    '제47조 월별 입소자수는 반올림한 정수',
  )
  assert.ok(validateInputs(mk({ extraSocial: 0.5 })).some((e) => e.startsWith('extraSocial')))
  assert.ok(validateInputs(mk({ extraNursing: 1.5 })).some((e) => e.startsWith('extraNursing')))
  assert.ok(validateInputs(mk({ extraTherapy: 0.25 })).some((e) => e.startsWith('extraTherapy')))
  assert.ok(validateInputs(mk({ registeredNurses: 1.5 })).some((e) => e.startsWith('registeredNurses')))
  assert.equal(validateInputs(mk({ nightStaff: 1.5 })).length, 0)
  assert.equal(validateInputs(mk({ dayStaff: 2.01 })).length, 0)
  assert.ok(validateInputs(mk({ extraSocial: 51 })).some((e) => e.startsWith('extraSocial')))
  assert.ok(validateInputs(mk({ nightStaff: 101 })).some((e) => e.startsWith('nightStaff')))
  assert.ok(validateInputs(mk({ dayStaff: 201 })).some((e) => e.startsWith('dayStaff')))
})

test('validateInputs: NaN·Infinity·음수 거부', () => {
  assert.ok(validateInputs(mk({ payroll: NaN })).some((e) => e.startsWith('payroll')))
  assert.ok(validateInputs(mk({ mealPrice: Infinity })).some((e) => e.startsWith('mealPrice')))
  assert.ok(validateInputs(mk({ otherCosts: -1 })).some((e) => e.startsWith('otherCosts')))
  assert.ok(validateInputs(mk({ days: -1 })).some((e) => e.startsWith('days')))
  assert.ok(validateInputs(mk({ counts: [1, NaN, 0] })).some((e) => e.startsWith('counts[1]')))
  assert.ok(validateInputs(mk({ counts: [-1, 0, 0] })).some((e) => e.startsWith('counts[0]')))
  assert.ok(
    validateInputs(mk({ averageResidents: 'x' as unknown as number })).some((e) =>
      e.startsWith('averageResidents'),
    ),
  )
})

test('validateInputs: 등급 인원은 정수 3칸', () => {
  assert.ok(validateInputs(mk({ counts: [1, 2] })).some((e) => e.startsWith('counts')))
  assert.ok(validateInputs(mk({ counts: [1, 2, 3, 4] })).some((e) => e.startsWith('counts')))
  assert.ok(validateInputs(mk({ counts: [1.5, 0, 0] })).some((e) => e.startsWith('counts[0]')))
  assert.ok(
    validateInputs(mk({ counts: undefined as unknown as number[] })).some((e) =>
      e.startsWith('counts'),
    ),
  )
})

test('validateInputs: 2026년만 지원, 형식·범위 오류', () => {
  assert.ok(validateInputs(mk({}, '2025-12')).some((e) => e.includes('2026')))
  assert.ok(validateInputs(mk({}, '2027-01')).some((e) => e.includes('2026')))
  assert.ok(validateInputs(mk({}, '2026-13')).some((e) => e.startsWith('month')))
  assert.ok(validateInputs(mk({}, '2026-00')).some((e) => e.startsWith('month')))
  assert.ok(validateInputs(mk({}, '2026/05')).some((e) => e.startsWith('month')))
  assert.ok(validateInputs(mk({ month: 5 as unknown as string })).some((e) => e.startsWith('month')))
})

test('validateInputs: 비율·점수·구분·불리언', () => {
  assert.ok(validateInputs(mk({ copayRate: 0.25 })).some((e) => e.startsWith('copayRate')))
  assert.ok(validateInputs(mk({ copayRate: -0.1 })).some((e) => e.startsWith('copayRate')))
  assert.equal(validateInputs(mk({ copayRate: 0.15 })).length, 0, '가중 평균이라 중간값 허용')
  assert.ok(validateInputs(mk({ programPoints: 0.3 })).some((e) => e.startsWith('programPoints')))
  assert.ok(validateInputs(mk({ programPoints: 1 })).some((e) => e.startsWith('programPoints')))
  assert.ok(validateInputs(mk({ tier: 'x' as FeeInputs['tier'] })).some((e) => e.startsWith('tier')))
  assert.ok(
    validateInputs(mk({ staffingConfirmed: 'yes' as unknown as boolean })).some((e) =>
      e.startsWith('staffingConfirmed'),
    ),
  )
  assert.ok(validateInputs(mk({ mealsPerDay: 6 })).some((e) => e.startsWith('mealsPerDay')))
  assert.ok(validateInputs(mk({ temporaryPoints: 21 })).some((e) => e.startsWith('temporaryPoints')))
  assert.ok(validateInputs(mk({ capacity: 1001 })).some((e) => e.startsWith('capacity')))
})

test('calculateFee는 검증 오류를 던진다', () => {
  throwsMatching(() => calculateFee(mk({ payroll: NaN })), /payroll/)
  throwsMatching(() => calculateFee(mk({}, '2025-05')), /2026/)
  throwsMatching(() => calculateFee(mk({ days: 30 }, '2026-02')), /days/)
  throwsMatching(() => calculateFee(mk({ counts: [1, 2] })), /counts/)
})
