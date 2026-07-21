import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcBase, type HolidayInfo } from '../src/utils/baseHours'

const HOL: Record<string, HolidayInfo> = {
  '2026-05-01': { name: '근로자의 날', kind: 'paid' },
  '2026-05-05': { name: '어린이날', kind: 'public' },
  '2026-05-24': { name: '부처님오신날', kind: 'lunar' },
  '2026-05-25': { name: '대체공휴일', kind: 'substitute' },
  '2026-08-15': { name: '광복절', kind: 'public' },
  '2026-08-17': { name: '대체공휴일', kind: 'substitute' },
}

test('월 기준시간 — 실제 편성표의 160시간/20일(2026-08)을 재현', () => {
  const b = calcBase('2026-08', HOL)
  assert.equal(b.workdays, 20)
  assert.equal(b.hours, 160)
})

test('주말과 겹친 공휴일은 이중 차감하지 않는다 (8/15 토요일 광복절)', () => {
  const b = calcBase('2026-08', HOL)
  assert.equal(b.holiday, 1)   // 8/17 대체공휴일만. 8/15는 주말로만 계산
})

test('근로자의 날 토글 — 제외 144h / 포함 152h (기준시간 덮어쓰기 버그 회귀)', () => {
  assert.equal(calcBase('2026-05', HOL, true).hours, 144)
  assert.equal(calcBase('2026-05', HOL, false).hours, 152)
})

test('공휴일 없는 달 — 2026-11은 168시간 (사용자가 잡아낸 값)', () => {
  assert.equal(calcBase('2026-11', {}).hours, 168)
})
