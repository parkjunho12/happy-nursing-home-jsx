import { test } from 'node:test'
import assert from 'node:assert/strict'
import { absencePeriod, absenceLabel } from '../src/utils/dietAbsence'
test('미복귀 기록은 귀원시각을 만들어내지 않는다', () => {
  assert.equal(absencePeriod({start_date:'2026-09-10',start_time:'07:40'}), '2026-09-10 07:40 ~ 복귀 미처리')
})
test('복귀 기간과 시각은 원기록 그대로 표시한다', () => {
  assert.equal(absencePeriod({start_date:'2026-08-31',start_time:'18:30',end_date:'2026-09-02',end_time:'09:10'}), '2026-08-31 18:30 ~ 2026-09-02 09:10')
})
test('없는 시간을 추정하지 않는다', () => {
  assert.equal(absencePeriod({start_date:'2026-09-10',end_date:'2026-09-11'}), '2026-09-10 ~ 2026-09-11')
})

test('상태 배지에 출처 접두어를 붙이지 않는다', () => {
  assert.equal(absenceLabel('외박중'), '외박중')
  assert.equal(absenceLabel('외박예정'), '외박예정')
})
test('복귀한 어르신은 복귀완료로 표시한다', () => {
  assert.equal(absenceLabel('외박·복귀'), '복귀완료')
})
