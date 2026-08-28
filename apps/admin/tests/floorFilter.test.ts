import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterByFloor, countHiddenNoFloor } from '../src/utils/floorFilter'

/** 실제와 같은 기준 — 직종에 '요양보호사' 가 들어가면 교대조다 */
const isCg = (pos?: string | null) => (pos ?? '').includes('요양보호사')

const STAFF = [
  { id: 'c2a', pos: '요양보호사', floor: '2층' },
  { id: 'c2b', pos: '요양보호사', floor: '2층' },
  { id: 'c3a', pos: '요양보호사', floor: '3층' },
  { id: 'cNo', pos: '요양보호사', floor: '' },        // 층 미지정
  { id: 'nur', pos: '간호사', floor: '' },
  { id: 'sw',  pos: '사회복지사', floor: null },
  { id: 'head', pos: '시설장' },                       // floor 자체가 없음
]

test('기본은 전체 — 아무도 빠지지 않는다', () => {
  const r = filterByFloor(STAFF, '', isCg)
  assert.equal(r.length, STAFF.length)
  assert.deepEqual(r, STAFF)
})

test('층을 고르면 그 층 요양보호사만 남는다', () => {
  const r = filterByFloor(STAFF, '2층', isCg).map(s => s.id)
  assert.ok(r.includes('c2a') && r.includes('c2b'))
  assert.ok(!r.includes('c3a'), '다른 층 요양보호사는 빠져야 한다')
  assert.ok(!r.includes('cNo'), '층 미지정 요양보호사도 빠진다')
})

test('층이 없는 직종은 언제나 남는다 — 간호사가 사라지면 근무표가 아니다', () => {
  for (const f of ['2층', '3층', '4층']) {
    const r = filterByFloor(STAFF, f, isCg).map(s => s.id)
    assert.ok(r.includes('nur'), `${f}: 간호사`)
    assert.ok(r.includes('sw'), `${f}: 사회복지사`)
    assert.ok(r.includes('head'), `${f}: 시설장(floor 없음)`)
  }
})

test('아무도 없는 층을 고르면 요양보호사만 비고 나머지는 남는다', () => {
  const r = filterByFloor(STAFF, '9층', isCg).map(s => s.id)
  assert.deepEqual(r, ['nur', 'sw', 'head'])
})

test('원본을 건드리지 않는다 — 저장은 전체 인원으로 가야 한다', () => {
  const before = JSON.parse(JSON.stringify(STAFF))
  filterByFloor(STAFF, '2층', isCg)
  countHiddenNoFloor(STAFF, '2층', isCg)
  assert.deepEqual(STAFF, before, '걸러보기가 원본을 바꾸면 저장 때 사람이 빠진다')
})

test('숨겨진 층 미지정 요양보호사를 센다', () => {
  assert.equal(countHiddenNoFloor(STAFF, '2층', isCg), 1)
  assert.equal(countHiddenNoFloor(STAFF, '', isCg), 0, '전체일 때는 숨는 사람이 없다')
})

test('층 문자열은 정확히 같아야 한다 — 2층과 2 는 다르다', () => {
  const r = filterByFloor(STAFF, '2', isCg).map(s => s.id)
  assert.ok(!r.includes('c2a'))
})
