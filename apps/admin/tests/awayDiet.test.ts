import { test } from 'node:test'
import assert from 'node:assert/strict'

/* 외박 판정은 백엔드(app/services/away.py)가 한다. 화면은 그 결과를 그릴 뿐이다.
   다만 '언제 빼고 언제 세는지' 는 주방 숫자와 직결되어 양쪽이 같아야 하므로,
   여기서도 같은 사례를 적어 둔다 — 규칙을 한쪽만 고치면 이 파일이 먼저 눈에 띈다.

   9/20 18:00 출발 → 9/23 12:00 귀원 인 경우
     9/19  자리 비움 아님
     9/20  외박중(떠나는 날)  — 주방 숫자에 든다 (아침·점심 드심)
     9/21  외박중            — 주방 숫자에서 뺀다
     9/22  외박중            — 주방 숫자에서 뺀다
     9/23  외박중(돌아오는 날) — 주방 숫자에 든다 (저녁 드심)
     9/24  자리 비움 아님
*/
const CASES: [string, boolean, boolean][] = [
  // [날짜, 자리 비움인가, 주방 숫자에서 빼는가]
  ['2026-09-19', false, false],
  ['2026-09-20', true, false],
  ['2026-09-21', true, true],
  ['2026-09-22', true, true],
  ['2026-09-23', true, false],
  ['2026-09-24', false, false],
]

const START = '2026-09-20', END = '2026-09-23'
const isAway = (d: string) => START <= d && d <= END
const isFullDay = (d: string) => START < d && d < END

test('외박 기간 판정 — 떠나는 날과 돌아오는 날도 외박중이다', () => {
  for (const [d, away] of CASES) assert.equal(isAway(d), away, d)
})

test('주방 숫자에서는 가운데 날만 뺀다', () => {
  for (const [d, , full] of CASES) assert.equal(isFullDay(d), full, d)
})

test('빼는 날이 외박 기간보다 좁다 — 반대면 그 이틀치가 틀린다', () => {
  const away = CASES.filter(c => c[1]).length
  const full = CASES.filter(c => c[2]).length
  assert.ok(full < away, '떠나는 날·돌아오는 날까지 빼면 안 된다')
  assert.equal(away - full, 2, '경계 이틀만 차이 나야 한다')
})


/* 날짜 더하기 — Date 로 옮겼다가 되돌리면 표준시 때문에 하루가 밀린다.
   실제로 외박 등록에서 '내일' 을 기본값으로 넣었는데 오늘이 나왔다. */
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

test('내일은 내일이다 — 한국 자정이 전날 UTC 여도', () => {
  assert.equal(addDays('2026-09-21', 1), '2026-09-22')
  assert.equal(addDays('2026-09-30', 1), '2026-10-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2026-09-21', 0), '2026-09-21')
})
