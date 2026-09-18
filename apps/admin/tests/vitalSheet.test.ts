import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSheetRooms, chunkSheetRooms, sheetCutoff, sheetDateLine } from '../src/utils/vitalSheet'

/* 간호팀 엑셀을 그대로 옮긴 표다. 호실마다 정원만큼 줄이 있어야 새로 오신
   분을 손으로 적어 넣을 자리가 있고, 아무도 안 계신 방도 줄은 남아야 한다. */

const ROOMS = [
  { room: '201', capacity: 4 }, { room: '202', capacity: 4 }, { room: '210', capacity: 2 },
]
const R = (name: string, room: string, floor = '2층', adm?: string) =>
  ({ name, floor, room, admission_date: adm ?? '2025-01-01' })

test('정원만큼 줄 — 4인실에 두 분이면 네 줄, 빈 방도 네 줄', () => {
  const out = buildSheetRooms('2층', [R('가', '201'), R('나', '201')], ROOMS, '2026-09-30')
  assert.deepEqual(out.map(r => [r.room, r.rows, r.names]), [
    ['201', 4, ['가', '나']], ['202', 4, []], ['210', 2, []],
  ])
})

test('정원보다 많이 계시면 그 수만큼 — 넘친 분이 빠지면 안 된다', () => {
  const out = buildSheetRooms('2층', [R('가', '210'), R('나', '210'), R('다', '210')], ROOMS, '2026-09-30')
  assert.equal(out.find(r => r.room === '210')!.rows, 3)
})

test('설정에 없는 방은 뒤에 번호순, 호실 없는 분은 맨 뒤', () => {
  const out = buildSheetRooms('2층', [R('가', '205'), R('나', '203'), R('다', '')], ROOMS, '2026-09-30')
  assert.deepEqual(out.map(r => r.room), ['201', '202', '210', '203', '205', ''])
  assert.deepEqual(out[out.length - 1].names, ["다"])
})

test('다른 층·입소 예정은 뺀다', () => {
  const out = buildSheetRooms('2층', [
    R('가', '201'), R('나', '201', '3층'), R('다', '201', '2층', '2026-10-05'),
  ], ROOMS, '2026-09-30')
  assert.deepEqual(out[0].names, ['가'])
})

test('한 장에 못 담으면 방 단위로 고르게 나눈다', () => {
  const rooms = Array.from({ length: 10 }, (_, i) => ({ room: `${201 + i}`, names: [], rows: 4 }))
  const pages = chunkSheetRooms(rooms, 24)
  assert.equal(pages.length, 2)
  assert.deepEqual(pages.map(p => p.reduce((s, r) => s + r.rows, 0)), [20, 20])
  assert.equal(chunkSheetRooms(rooms, 40).length, 1)
})

test('일을 비우면 그 달 말일까지 오시는 분을 넣는다', () => {
  assert.equal(sheetCutoff('2026-09', ''), '2026-09-30')
  assert.equal(sheetCutoff('2026-02', ''), '2026-02-28')
  assert.equal(sheetCutoff('2026-09', '5'), '2026-09-05')
})

test('날짜 줄 — 일을 비우면 손으로 적을 자리를 남긴다', () => {
  assert.equal(sheetDateLine('2026-09', '18').replace(/ /g, ' '), '2026.  9.  18.')
  assert.match(sheetDateLine('2026-09', ''), /^2026\.  9\.   +\.$/)
})
