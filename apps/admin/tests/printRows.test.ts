import { test } from 'node:test'
import assert from 'node:assert/strict'
import { printHasCaregiver, printHasAnyOf, printFloorRow } from '../src/utils/printRows'

const isCG = (p?: string | null) => (p ?? '').includes('요양보호사')
const STAFF = [
  { id: 'n1', pos: '간호팀장' },
  { id: 'w1', pos: '사회복지사' },
  { id: 'c1', pos: '요양보호사' },
  { id: 'c2', pos: '요양보호사' },
]

/* 벽에 붙는 문서다. 요양보호사를 안 뽑았는데 '요양보호사 주간 인원 0 0 0 …'
   이 함께 나가면, 읽는 사람은 그날 아무도 안 나온 줄로 읽는다. */

test('전원 인쇄(고르지 않음)면 그대로 낸다', () => {
  assert.equal(printHasCaregiver(STAFF, null, isCG), true)
  assert.equal(printHasAnyOf(['c1', 'c2'], null), true)
})

test('요양보호사를 한 명도 안 뽑으면 뺀다', () => {
  const pick = new Set(['n1', 'w1'])
  assert.equal(printHasCaregiver(STAFF, pick, isCG), false)
})

test('한 명이라도 뽑았으면 낸다', () => {
  assert.equal(printHasCaregiver(STAFF, new Set(['n1', 'c2']), isCG), true)
})

test('아무도 안 뽑은 경우도 뺀다', () => {
  assert.equal(printHasCaregiver(STAFF, new Set(), isCG), false)
})

test('층 소계는 층마다 따로 본다 — 2층만 뽑는데 3층 0줄이 따라가면 안 된다', () => {
  const pick = new Set(['a1', 'a2'])          // 2층만 뽑음
  assert.equal(printHasAnyOf(['a1', 'a2'], pick), true, '2층 소계는 나온다')
  assert.equal(printHasAnyOf(['b1', 'b2'], pick), false, '3층 소계는 빠진다')
  assert.equal(printHasAnyOf([], pick), false, '사람이 없는 층은 빠진다')
})

test('명단에 요양보호사가 아예 없으면 뺀다', () => {
  const only = [{ id: 'n1', pos: '간호팀장' }]
  assert.equal(printHasCaregiver(only, null, isCG), false)
})


/* 층별 인원 줄 — 그 층 요양보호사가 인쇄물에 없으면 그 줄의 숫자는 실제
   인원이 아니다. 3층만 뽑았는데 '2층 주간 인원 1' 이 붙으면 읽는 사람은
   2층에 한 명만 있는 것으로 읽는다. 실제로는 대여섯 명이 있다. */

const FLOORS = [
  { id: 'a1', pos: '요양보호사', floor: '2층' },
  { id: 'a2', pos: '요양보호사', floor: '2층' },
  { id: 'n2', pos: '간호팀장', floor: '2층' },
  { id: 'b1', pos: '요양보호사', floor: '3층' },
  { id: 'n3', pos: '간호팀장', floor: '3층' },
  { id: 'x1', pos: '시설장', floor: '' },
]

test('3층만 뽑으면 2층 줄은 빠진다 — 2층 간호팀장이 인쇄물에 있어도', () => {
  const pick = new Set(['b1', 'n3', 'n2', 'x1'])   // 3층 전원 + 2층 간호팀장
  assert.equal(printFloorRow(FLOORS, '3층', pick, isCG), true)
  assert.equal(printFloorRow(FLOORS, '2층', pick, isCG), false,
    '2층 요양보호사가 하나도 없으면 2층 줄은 거짓말이 된다')
})

test('그 층 요양보호사가 한 명이라도 있으면 낸다', () => {
  assert.equal(printFloorRow(FLOORS, '2층', new Set(['a2']), isCG), true)
})

test('전원 인쇄면 다 낸다', () => {
  assert.equal(printFloorRow(FLOORS, '2층', null, isCG), true)
  assert.equal(printFloorRow(FLOORS, '3층', null, isCG), true)
})

test('요양보호사가 없는 층은 그 층 사람이 뽑혔는지로 본다', () => {
  const office = [{ id: 'o1', pos: '사회복지사', floor: '1층' }]
  assert.equal(printFloorRow(office, '1층', new Set(['o1']), isCG), true)
  assert.equal(printFloorRow(office, '1층', new Set(), isCG), false)
})
