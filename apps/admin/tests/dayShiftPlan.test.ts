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
