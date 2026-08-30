import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortScheduleStaff } from '../src/components/schedule/shared'

/**
 * 근무표에서 요양보호사는 2층 · 3층 순으로 나와야 한다.
 * 층으로 나눠 보려면 층이 조(A·B·C)보다 앞서야 한다.
 */
const cg = (name: string, floor: string, team = '', hireDate = '2020-01-01') =>
  ({ name, pos: '요양보호사', floor, team, hireDate })

const order = (list: any[]) => sortScheduleStaff(list).map(x => x.name)

test('요양보호사가 층 순으로 나온다', () => {
  const r = order([
    cg('삼층가', '3층', 'A조'), cg('이층가', '2층', 'B조'),
    cg('사층가', '4층', 'A조'), cg('이층나', '2층', 'A조'),
  ])
  assert.deepEqual(r.map(n => n.slice(0, 2)), ['이층', '이층', '삼층', '사층'])
})

test('같은 층 안에서는 조 순서(A→B→C)', () => {
  assert.deepEqual(order([
    cg('나', '2층', 'B조'), cg('다', '2층', 'C조'), cg('가', '2층', 'A조'),
  ]), ['가', '나', '다'])
})

test('10층이 2층보다 뒤 — 글자 비교면 앞으로 온다', () => {
  assert.deepEqual(order([
    cg('십층', '10층', 'A조'), cg('이층', '2층', 'A조'), cg('삼층', '3층', 'A조'),
  ]), ['이층', '삼층', '십층'])
})

test('층이 없는 요양보호사는 맨 뒤 — 배정 안 된 사람이 2층 위로 오면 안 된다', () => {
  const r = order([
    cg('미배정', '', 'A조'), cg('이층', '2층', 'A조'), cg('삼층', '3층', 'A조'),
  ])
  assert.deepEqual(r, ['이층', '삼층', '미배정'])
})

test('층이 없는 직종의 순서는 바뀌지 않는다', () => {
  const r = order([
    { name: '요보', pos: '요양보호사', floor: '2층', team: 'A조', hireDate: '2020-01-01' },
    { name: '간호', pos: '간호사', floor: '', team: '', hireDate: '2019-01-01' },
    { name: '시설장', pos: '시설장', floor: '', team: '', hireDate: '2018-01-01' },
    { name: '사복', pos: '사회복지사', floor: '', team: '', hireDate: '2019-06-01' },
  ])
  // 직종 순서(시설장 → 사회복지사 → 간호사 → 요양보호사)가 그대로
  assert.deepEqual(r, ['시설장', '사복', '간호', '요보'])
})

test('직종이 층보다 먼저다 — 3층 요보가 간호사 위로 오지 않는다', () => {
  const r = order([
    cg('삼층요보', '3층', 'A조'),
    { name: '간호', pos: '간호사', floor: '', team: '', hireDate: '2019-01-01' },
  ])
  assert.deepEqual(r, ['간호', '삼층요보'])
})

test('층·조가 같으면 입사 빠른 순, 그다음 이름', () => {
  assert.deepEqual(order([
    cg('나중', '2층', 'A조', '2022-01-01'),
    cg('먼저', '2층', 'A조', '2019-01-01'),
  ]), ['먼저', '나중'])
})

test('원본 배열을 건드리지 않는다', () => {
  const src = [cg('삼', '3층'), cg('이', '2층')]
  const before = src.map(x => x.name)
  sortScheduleStaff(src)
  assert.deepEqual(src.map(x => x.name), before)
})
