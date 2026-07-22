/**
 * 근무 코드·회전 테스트 — 실제 TS 코드를 그대로 실행한다.
 * (그동안 파이썬으로 로직을 재구현해 검증했는데, 미러가 어긋나면 검증이 무의미했다)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hoursOf, extraHoursOf, timeRangeForHours, breakMinutes, rotationOn, splitTimeRange, shortOf } from '../src/utils/shiftCodes'

test('근무 코드 시간 — 실제 편성표 검산값(D=8h·N=9h)과 일치', () => {
  assert.equal(hoursOf('D'), 8)
  assert.equal(hoursOf('M'), 8)     // 모닝 07:00~16:00 − 휴게 1h
  assert.equal(hoursOf('N'), 9)
  assert.equal(hoursOf('대휴'), 0)      // 공휴일 대체휴무 — 시간 깎임을 추가근무로 채우는 구조
  assert.equal(hoursOf('초과휴'), 0)    // 쌓인 빚을 갚는 날 — 시간을 또 주면 이중 계산
})

test('연차는 유급 — 총시간에 하루 8시간으로 들어간다', () => {
  assert.equal(hoursOf('休'), 8)
  assert.equal(hoursOf('반'), 4)        // 반차는 반일
  assert.equal(hoursOf('AD반'), 8)      // 근무 4h + 반차 4h = 하루치
  assert.equal(hoursOf('반PD'), 8)
})

test('직접 입력 시간대 — 휴게 70분 규칙(0850~1400=4h, 0850~1600=6h)', () => {
  assert.equal(extraHoursOf('0850~1400'), 4)
  assert.equal(extraHoursOf('0850~1600'), 6)
  assert.equal(extraHoursOf('0850~1700'), 7)
  assert.equal(extraHoursOf('0900 1100'), 2)      // 짧은 근무는 휴게 없음
  assert.equal(breakMinutes(310), 70)
  assert.equal(breakMinutes(120), 0)
})

test('추가근무 표기 왕복 — 만든 표기를 되읽으면 같은 시간', () => {
  for (const h of [1, 1.5, 2, 3, 4, 4.5, 5, 6, 7, 7.5]) {
    const r = timeRangeForHours(h)
    assert.equal(extraHoursOf(r), h, `${h}h → ${r}`)
  }
})

test('회전 연속성 — 8/31 다음이 9/1로 이어진다 (매월 리셋 버그 회귀)', () => {
  const seq: string[] = []
  for (const iso of ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03']) {
    seq.push(rotationOn('A조', iso) || '·')
  }
  // 시트에서 역산한 A조 패턴이 월 경계를 넘어 이어져야 한다
  assert.deepEqual(seq, ['D', 'D', 'N', 'N', '·', '·'])
})

test('회전 기준일(anchor)을 바꾸면 패턴이 그만큼 밀린다 — 연도 이관 대비', () => {
  const base = rotationOn('B조', '2026-08-01')
  const shifted = rotationOn('B조', '2026-08-01', undefined, '2026-08-02')  // 기준을 하루 뒤로
  assert.equal(base, 'D')
  assert.equal(shifted, rotationOn('B조', '2026-07-31'))
})

test('인쇄용 표기 — 시간대 두 줄 분리·세 글자 축약', () => {
  assert.deepEqual(splitTimeRange('0850~1600'), ['0850', '1600'])
  assert.equal(splitTimeRange('대휴'), null)
  assert.equal(shortOf('초과휴'), '초휴')
  assert.equal(shortOf('D'), 'D')
})
