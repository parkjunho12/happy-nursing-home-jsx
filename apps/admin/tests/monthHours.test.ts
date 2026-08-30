import { test } from 'node:test'
import assert from 'node:assert/strict'
import { monthTotals, hourStatus, hourDiff } from '../src/utils/monthHours'

/**
 * 총시간은 세 곳에서 쓰인다 — 편성 화면, 전체 보기 화면, 엑셀.
 * 계산이 한곳에 있어야 세 숫자가 같다. 여기서 그 한곳을 붙잡아 둔다.
 */
const days = Array.from({ length: 31 }, (_, i) => i + 1)

test('정규 코드의 시간을 더한다', () => {
  const t = monthTotals({ '1': 'D', '2': 'D', '3': 'D' }, days)
  assert.ok(t.hours > 0, '시간이 잡혀야 한다')
  assert.equal(t.d, 3, '주간 3일')
  assert.equal(t.extra, 0)
  assert.equal(t.total, t.hours, '추가근무가 없으면 총시간 = 정규시간')
})

test('직접 적은 시간대는 추가근무로 따로 세되, 그날은 근무한 날이다', () => {
  const t = monthTotals({ '1': '0850 1600' }, days)
  assert.equal(t.hours, 0, '정규 코드 시간에는 넣지 않는다')
  assert.ok(t.extra > 0, '추가근무로 잡혀야 한다')
  assert.equal(t.total, t.extra, '총시간에는 포함된다')
  // 초과근무 상환으로 일찍 퇴근할 뿐, 그날 어르신 곁에 있는 사람이다.
  // 인원 계산에서 빼면 그날 몇 명이 있었는지가 틀어진다.
  assert.equal(t.d, 1, '주간 근무 인원에는 든다')
})

test('연차·휴무를 센다', () => {
  const t = monthTotals({ '1': '休', '2': '休' }, days)
  assert.equal(t.annual + t.off, 2)
})

test('빈 표는 0 — 터지지 않는다', () => {
  for (const v of [undefined, null, {}]) {
    const t = monthTotals(v as any, days)
    assert.equal(t.total, 0)
    assert.equal(t.d, 0)
  }
})

test('그 달에 없는 날짜는 세지 않는다', () => {
  // 2월 표에 31일 칸이 남아 있어도 28일까지만 센다
  const feb = Array.from({ length: 28 }, (_, i) => i + 1)
  const codes: Record<string, string> = { '28': 'D', '31': 'D' }
  const t = monthTotals(codes, feb)
  assert.equal(t.d, 1, '31일은 2월에 없다')
})

test('기준시간과 견주기 — 미달·초과·같음', () => {
  assert.equal(hourStatus(150, 160), 'short')
  assert.equal(hourStatus(170, 160), 'over')
  assert.equal(hourStatus(160, 160), 'ok')
})

test('기준이 없으면 판단하지 않는다 — 모르면서 정상이라 하면 안 된다', () => {
  for (const b of [0, null, undefined, NaN]) {
    assert.equal(hourStatus(150, b as any), 'unknown', `기준=${String(b)}`)
    assert.equal(hourDiff(150, b as any), null)
  }
})

test('기준 대비 차이', () => {
  assert.equal(hourDiff(150, 160), -10)
  assert.equal(hourDiff(168.5, 160), 8.5)
  assert.equal(hourDiff(160, 160), 0)
})
