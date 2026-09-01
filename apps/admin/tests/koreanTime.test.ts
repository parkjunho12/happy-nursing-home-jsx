import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toKorean, toHHMM, koreanLabel } from '../src/utils/koreanTime'

/* 12시 처리가 이 파일의 존재 이유다.
   오전 12시는 자정(00시), 오후 12시는 정오(12시).
   틀리면 정오 외래 예약이 자정으로 저장된다 — 어르신을 한밤중에 모시고
   나가는 것으로 적히는 셈이다. */

test('자정과 정오', () => {
  assert.deepEqual(toKorean('00:00'), { ampm: '오전', hour12: 12, minute: 0 }, '00시는 오전 12시')
  assert.deepEqual(toKorean('12:00'), { ampm: '오후', hour12: 12, minute: 0 }, '12시는 오후 12시')
  assert.equal(toHHMM({ ampm: '오전', hour12: 12, minute: 0 }), '00:00')
  assert.equal(toHHMM({ ampm: '오후', hour12: 12, minute: 0 }), '12:00')
})

test('오전·오후 경계', () => {
  assert.deepEqual(toKorean('11:50'), { ampm: '오전', hour12: 11, minute: 50 })
  assert.deepEqual(toKorean('12:10'), { ampm: '오후', hour12: 12, minute: 10 })
  assert.deepEqual(toKorean('13:00'), { ampm: '오후', hour12: 1, minute: 0 })
  assert.deepEqual(toKorean('23:50'), { ampm: '오후', hour12: 11, minute: 50 })
})

test('되돌려도 같은 값이어야 한다 (24시간 전부)', () => {
  for (let h = 0; h < 24; h++) {
    for (const mi of [0, 10, 25, 40, 59]) {
      const s = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
      const k = toKorean(s)
      assert.ok(k, `${s} 를 못 읽는다`)
      assert.equal(toHHMM(k!), s, `${s} → 한국식 → 다시 ${s} 가 아니다`)
    }
  }
})

test('말이 안 되는 값은 null — 조용히 고쳐서 엉뚱한 시각을 만들지 않는다', () => {
  for (const v of ['', '24:00', '9:60', '9', 'abc', '99:99', '-1:00']) {
    assert.equal(toKorean(v), null, `${v} 를 받아들였다`)
  }
})

test('화면 문구', () => {
  assert.equal(koreanLabel('14:40'), '오후 2:40')
  assert.equal(koreanLabel('09:05'), '오전 9:05')
  assert.equal(koreanLabel('00:30'), '오전 12:30')
  assert.equal(koreanLabel('12:00'), '오후 12:00')
  assert.equal(koreanLabel('엉뚱'), '엉뚱', '못 읽으면 그대로 둔다')
})
