import { test } from 'node:test'
import assert from 'node:assert/strict'
import { birthdaysInRange } from '../src/utils/birthdays'

const P = (id: string, name: string, birthDate: string, status = 'active') =>
  ({ id, name, birthDate, status })

test('생일이 보이는 달에 나타나고 만 나이가 맞는다', () => {
  const out = birthdaysInRange([P('1', '김순자', '1939-07-15')], '2026-07-01', '2026-07-31', 'resident')
  assert.equal(out.length, 1)
  assert.equal(out[0].dateKey, '2026-07-15')
  assert.equal(out[0].age, 87)
})

test('다른 달에는 나타나지 않는다', () => {
  const out = birthdaysInRange([P('1', '김순자', '1939-07-15')], '2026-08-01', '2026-08-31', 'resident')
  assert.equal(out.length, 0)
})

test('연말~연초 주간 뷰 — 두 해에 걸친 기간에서 각각 계산된다', () => {
  const out = birthdaysInRange(
    [P('1', 'A', '1950-12-30'), P('2', 'B', '1960-01-02')],
    '2026-12-28', '2027-01-03', 'staff')
  assert.deepEqual(out.map(b => b.dateKey), ['2026-12-30', '2027-01-02'])
  assert.equal(out[0].age, 76)
  assert.equal(out[1].age, 67)
})

test('2월 29일생 — 평년에는 2월 28일에 표시', () => {
  const leap = birthdaysInRange([P('1', 'C', '1944-02-29')], '2028-02-01', '2028-02-29', 'resident')
  assert.equal(leap[0].dateKey, '2028-02-29')      // 윤년엔 제 날
  const common = birthdaysInRange([P('1', 'C', '1944-02-29')], '2026-02-01', '2026-02-28', 'resident')
  assert.equal(common[0].dateKey, '2026-02-28')    // 평년엔 하루 앞
})

test('퇴소·퇴사자와 생년월일 없는 사람은 제외', () => {
  const out = birthdaysInRange([
    P('1', '퇴소자', '1940-07-10', 'discharged'),
    { id: '2', name: '생일없음', birthDate: '', status: 'active' },
    P('3', '재원자', '1941-07-11'),
  ], '2026-07-01', '2026-07-31', 'resident')
  assert.deepEqual(out.map(b => b.name), ['재원자'])
})
