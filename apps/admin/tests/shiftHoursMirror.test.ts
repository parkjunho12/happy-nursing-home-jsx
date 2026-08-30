import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  hoursOf, extraHoursOf, breakMinutes,
  setCodeHours, codeHoursNow, isCodeHoursOverridden,
} from '../src/utils/shiftCodes'

/**
 * 근무시간 규칙이 백엔드와 같은지 확인한다.
 *
 * 총시간은 이 화면에서 계산해 저장할 때 함께 담고 엑셀은 그 값을 읽는다.
 * 다만 이 기능이 생기기 전에 저장된 달에는 값이 없어, 그때는 백엔드가 직접
 * 계산한다. 그래서 같은 규칙이 두 곳에 있다.
 *
 * 검증표 하나를 두고 양쪽이 그것을 통과하게 한다. 이 파일이 화면 쪽을,
 * backend/tests/test_shift_hours.py 가 백엔드 쪽을 확인한다.
 * 여기(shiftCodes.ts)가 기준이다 — 규칙을 바꿨으면 검증표를 다시 뽑아야
 * 하고, 그러면 백엔드 테스트가 깨져 미러도 함께 고치게 된다.
 */
interface Fixture {
  cases: { input: string; hours: number; extra: number }[]
  breaks: { span: number; brk: number }[]
}

const fx: Fixture = JSON.parse(
  readFileSync(`${process.cwd()}/../../backend/app/data/shift_hours_fixture.json`, 'utf8'))

test('검증표를 읽는다 — 없으면 확인 자체가 안 된 것이다', () => {
  assert.ok(fx.cases.length > 20, `사례가 너무 적다: ${fx.cases.length}`)
  assert.ok(fx.breaks.length > 5)
})

test('코드별 시간이 검증표와 같다', () => {
  for (const c of fx.cases) {
    assert.equal(hoursOf(c.input), c.hours, `hoursOf(${JSON.stringify(c.input)})`)
  }
})

test('직접 적은 시간대 계산이 검증표와 같다', () => {
  for (const c of fx.cases) {
    assert.equal(extraHoursOf(c.input), c.extra, `extraHoursOf(${JSON.stringify(c.input)})`)
  }
})

test('휴게시간 규칙이 검증표와 같다', () => {
  for (const b of fx.breaks) {
    assert.equal(breakMinutes(b.span), b.brk, `breakMinutes(${b.span})`)
  }
})

/**
 * 설정으로 시간을 바꿨을 때도 양쪽이 같아야 한다.
 *
 * 야간을 10시간으로 바꿔두면 화면·엑셀이 모두 10으로 세야 한다. 한쪽만
 * 옛 값으로 세면 근무표와 급여 대장의 숫자가 다르게 나온다.
 */
test('설정으로 바꾼 시간이 계산에 반영된다', () => {
  setCodeHours({ N: 10 })
  assert.equal(hoursOf('N'), 10, '바꾼 값이 쓰여야 한다')
  assert.equal(hoursOf('D'), 8, '안 바꾼 코드는 그대로')
  assert.equal(codeHoursNow()['N'], 10)
  assert.equal(isCodeHoursOverridden('N'), true)
  assert.equal(isCodeHoursOverridden('D'), false)

  setCodeHours({})
  assert.equal(hoursOf('N'), 9, '되돌리면 기본값')
  assert.equal(isCodeHoursOverridden('N'), false)
})

test('말이 안 되는 설정은 무시한다 — 계산이 멈추면 그게 더 나쁘다', () => {
  for (const bad of [
    { 없는코드: 8 }, { N: -1 }, { N: 25 }, { N: NaN }, { N: 'abc' as any },
  ]) {
    setCodeHours(bad as any)
    assert.equal(hoursOf('N'), 9, `무시되어야 한다: ${JSON.stringify(bad)}`)
  }
  setCodeHours({})
})

test('설정을 되돌리면 검증표를 다시 통과한다', () => {
  setCodeHours({ N: 12, D: 3 })
  setCodeHours({})
  for (const c of fx.cases) {
    assert.equal(hoursOf(c.input), c.hours, `hoursOf(${JSON.stringify(c.input)})`)
  }
})
