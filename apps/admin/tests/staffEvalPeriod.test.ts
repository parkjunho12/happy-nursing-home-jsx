import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentPeriod, periodLabel, shiftPeriod } from '../src/utils/evalPeriod'

/* 반기 계산 — 화면을 열면 이번 반기가 보여야 하고, 앞뒤로 넘길 때 해가
   제대로 넘어가야 한다. 여기가 틀리면 지난 평가를 못 찾거나, 엉뚱한 반기에
   평가를 저장하게 된다. 인사 기록이라 조용히 어긋나면 안 된다. */

test('1~6월은 상반기, 7~12월은 하반기', () => {
  assert.equal(currentPeriod(new Date(2026, 0, 1)), '2026-H1')   // 1월
  assert.equal(currentPeriod(new Date(2026, 5, 30)), '2026-H1')  // 6월 말
  assert.equal(currentPeriod(new Date(2026, 6, 1)), '2026-H2')   // 7월 1일 — 경계
  assert.equal(currentPeriod(new Date(2026, 11, 31)), '2026-H2') // 12월 말
})

test('앞뒤로 넘길 때 해가 넘어간다', () => {
  assert.equal(shiftPeriod('2026-H2', 1), '2027-H1', '하반기 다음은 이듬해 상반기')
  assert.equal(shiftPeriod('2026-H1', -1), '2025-H2', '상반기 이전은 작년 하반기')
  assert.equal(shiftPeriod('2026-H1', 1), '2026-H2')
  assert.equal(shiftPeriod('2026-H2', -1), '2026-H1')
})

test('여러 칸을 한 번에 넘겨도 맞는다', () => {
  assert.equal(shiftPeriod('2026-H1', 4), '2028-H1')
  assert.equal(shiftPeriod('2026-H1', -4), '2024-H1')
  assert.equal(shiftPeriod('2026-H2', 3), '2028-H1')
})

test('이상한 값은 그대로 둔다 — 임의로 고쳐서 엉뚱한 반기로 보내지 않는다', () => {
  assert.equal(shiftPeriod('2026', 1), '2026')
  assert.equal(shiftPeriod('', 1), '')
  assert.equal(periodLabel('2026'), '2026')
})

test('사람이 읽는 이름', () => {
  assert.equal(periodLabel('2026-H1'), '2026년 상반기')
  assert.equal(periodLabel('2026-H2'), '2026년 하반기')
})
