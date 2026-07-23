import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planDayShift, interleaveByPosition } from '../src/utils/dayShiftPlan'

test('주간 편성 — 전원이 정확히 기준일수만큼 근무한다', () => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const { plan } = planDayShift({ days, staffIds: ids, workDays: 20 })
  for (const id of ids) assert.equal(Object.keys(plan[id]).length, 20, id)
})

test('주간 편성 — 일별 근무 인원 편차가 1명 이내 (톱니바퀴)', () => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const { perDay } = planDayShift({ days, staffIds: ids, workDays: 20 })
  const vals = days.map(d => perDay[d])
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1)
})

test('비례 분산 — 같은 직종이 순번에서 몰리지 않는다', () => {
  const order = interleaveByPosition({ 시설장: ['s1'], 요양보호사: ['y1', 'y2', 'y3', 'y4'] })
  // 요양보호사 4명이 연속으로 붙어 있으면 안 된다
  let maxRun = 0, run = 0
  for (const id of order) {
    run = id.startsWith('y') ? run + 1 : 0
    maxRun = Math.max(maxRun, run)
  }
  assert.ok(maxRun <= 2, order.join(','))
})

test('희망휴무 — 낸 날은 반드시 쉬고, 근무일수는 그대로 정확하다', () => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const { plan, perDay } = planDayShift({
    days, staffIds: ids, workDays: 20,
    preferRest: { a: [5, 12, 26], d: [12], g: [1, 31] },
  })
  // 희망일에 근무가 배정되면 제도의 의미가 없다
  for (const d of [5, 12, 26]) assert.equal(plan['a'][String(d)], undefined, `a의 희망일 ${d}`)
  assert.equal(plan['d']['12'], undefined)
  for (const d of [1, 31]) assert.equal(plan['g'][String(d)], undefined)
  // 그래도 전원 근무일수는 정확히 20일
  for (const id of ids) assert.equal(Object.keys(plan[id]).length, 20, id)
  // 같은 날 여러 명이 희망해도(12일: a와 d) 일별 인원 붕괴는 1명 이내로 흡수
  const vals = days.map(d => perDay[d])
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 2)
})

test('희망휴무가 휴무 정원을 넘는 요청이어도 초과분은 무시되지 않고 정원 안에서 흡수', () => {
  const days = Array.from({ length: 30 }, (_, i) => i + 1)
  const { plan } = planDayShift({
    days, staffIds: ['a', 'b'], workDays: 21,
    preferRest: { a: [1, 2, 3, 4, 5, 6, 7, 8, 9] },   // 휴무 9일 = 정원과 동일
  })
  assert.equal(Object.keys(plan['a']).length, 21)
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.equal(plan['a'][String(d)], undefined)
})
