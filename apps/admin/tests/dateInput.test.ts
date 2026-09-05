import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskDate, digitsToISO } from '../src/utils/dateInput'

/* 생년월일은 나이 계산과 급여·평가로 이어진다.
   조용히 틀린 날짜가 들어가면 그 뒤 숫자가 전부 어긋난다. */

test('숫자만 쳐도 모양이 잡힌다', () => {
  assert.equal(maskDate('19350412'), '1935.04.12')
  assert.equal(maskDate('1935'), '1935')
  assert.equal(maskDate('193504'), '1935.04')
  assert.equal(maskDate('1935.04.12'), '1935.04.12', '점을 같이 쳐도 된다')
  assert.equal(maskDate('1935-04-12'), '1935.04.12', '붙임표도 된다')
  assert.equal(maskDate(''), '')
})

test('아홉 자리 이상은 잘라낸다 — 잘못 눌러도 이상한 값이 안 남는다', () => {
  assert.equal(maskDate('193504123456'), '1935.04.12')
})

test('여덟 자리가 다 차야 값이 된다 — 치는 도중에 값이 튀지 않게', () => {
  assert.equal(digitsToISO('1935'), null)
  assert.equal(digitsToISO('1935041'), null)
  assert.equal(digitsToISO('19350412'), '1935-04-12')
})

test('없는 날은 받지 않는다', () => {
  // Date 는 2월 30일을 3월 2일로 슬쩍 넘긴다. 그대로 두면 생일이 바뀐다.
  assert.equal(digitsToISO('19350230'), null, '2월 30일')
  assert.equal(digitsToISO('19351301'), null, '13월')
  assert.equal(digitsToISO('19350400'), null, '0일')
  assert.equal(digitsToISO('19350431'), null, '4월 31일')
})

test('윤년은 제대로 받는다', () => {
  assert.equal(digitsToISO('19360229'), '1936-02-29', '1936년은 윤년')
  assert.equal(digitsToISO('19350229'), null, '1935년은 평년')
  assert.equal(digitsToISO('19000229'), null, '1900년은 윤년이 아니다')
  assert.equal(digitsToISO('20000229'), '2000-02-29', '2000년은 윤년이다')
})

test('아주 오래된 해는 막는다 — 오타로 0935 를 치는 일이 있다', () => {
  assert.equal(digitsToISO('09350412'), null)
  assert.equal(digitsToISO('19000101'), '1900-01-01', '1900년은 받는다')
})

test('백 세 넘으신 분도 넣을 수 있다', () => {
  assert.equal(digitsToISO('19180315'), '1918-03-15')
  assert.equal(digitsToISO('19151231'), '1915-12-31')
})
