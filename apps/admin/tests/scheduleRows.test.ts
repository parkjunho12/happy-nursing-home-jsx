import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScheduleRows, canSaveRows } from '../src/utils/scheduleRows'

/**
 * 근무표 저장 rows — 층 배정이 사는 곳.
 *
 * 여기서 한 사람이라도 빠지면 그 사람의 조·층이 조용히 사라지고,
 * 다음 달 승계까지 함께 사라진다.
 */
const T = () => ({ hours: 160, extra: 0, total: 160 })

test('사람이 한 명도 빠지지 않는다', () => {
  const staff = Array.from({ length: 32 }, (_, i) => ({ id: `s${i}`, floor: '2층' }))
  const rows = buildScheduleRows(staff, T)
  assert.equal(rows.length, 32)
  assert.deepEqual(rows.map(r => r.staff_id), staff.map(s => s.id))
})

test('층이 그대로 실린다', () => {
  const rows = buildScheduleRows([
    { id: 'a', floor: '2층', team: 'A', pos: '요양보호사' },
    { id: 'b', floor: '3층', team: 'B', pos: '요양보호사' },
    { id: 'c', floor: '4층', team: 'C', pos: '요양보호사' },
  ], T)
  assert.deepEqual(rows.map(r => r.floor), ['2층', '3층', '4층'])
  assert.deepEqual(rows.map(r => r.team), ['A', 'B', 'C'])
})

test('층이 없으면 빈 문자열 — 키가 사라지면 안 된다', () => {
  for (const f of [undefined, null, '']) {
    const [r] = buildScheduleRows([{ id: 'a', floor: f as any }], T)
    assert.ok('floor' in r, `키가 있어야 한다: ${String(f)}`)
    assert.equal(r.floor, '', '빈 문자열이어야 한다')
  }
})

test('화면 순서가 order 로 남는다 — 정렬을 바꿔 저장해도 표가 뒤섞이지 않게', () => {
  const rows = buildScheduleRows(
    [{ id: 'x' }, { id: 'y' }, { id: 'z' }], T)
  assert.deepEqual(rows.map(r => r.order), [0, 1, 2])
})

test('총시간이 함께 실린다 — 엑셀이 이 값을 읽는다', () => {
  const [r] = buildScheduleRows([{ id: 'a' }],
    () => ({ hours: 152, extra: 8.5, total: 160.5 }))
  assert.equal(r.hours, 152)
  assert.equal(r.extra, 8.5)
  assert.equal(r.total, 160.5)
})

test('직원 목록이 비면 저장을 막는다 — 빈 배열은 모두의 조·층을 지운다', () => {
  assert.equal(canSaveRows(0), false)
  assert.equal(canSaveRows(1), true)
  assert.equal(canSaveRows(32), true)
})

test('빈 목록으로도 rows 를 만들 수는 있다 — 막는 것은 저장 쪽 몫', () => {
  assert.deepEqual(buildScheduleRows([], T), [])
})
