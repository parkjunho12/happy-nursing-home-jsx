import { test } from 'node:test'
import assert from 'node:assert/strict'
import { printHasCaregiver, printHasAnyOf } from '../src/utils/printRows'

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
