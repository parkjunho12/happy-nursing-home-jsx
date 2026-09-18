import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchResident, sortResidents } from '../src/utils/residentSort'

const R = (name: string, admissionDate?: string, room?: string, floor?: string) =>
  ({ name, admissionDate, room, floor })

test('기본은 최근 입소 순 — 새로 오신 분이 맨 위', () => {
  const out = sortResidents([R('가', '2024-03-01'), R('나', '2026-09-01'), R('다', '2025-06-15')], 'admission')
  assert.deepEqual(out.map(r => r.name), ['나', '다', '가'])
})

test('같은 날 입소면 ㄱㄴㄷ 순 — 새로고침마다 자리가 바뀌면 안 된다', () => {
  const out = sortResidents([R('최복순', '2026-01-05'), R('강복순', '2026-01-05')], 'admission')
  assert.deepEqual(out.map(r => r.name), ['강복순', '최복순'])
})

test('입소일이 없는 분은 맨 아래 — 최신으로 치면 새로 오신 분을 가린다', () => {
  const out = sortResidents([R('가'), R('나', '2026-09-01'), R('다', '2020-01-01')], 'admission')
  assert.deepEqual(out.map(r => r.name), ['나', '다', '가'])
})

test('ㄱㄴㄷ 순', () => {
  const out = sortResidents([R('최재수'), R('강영덕'), R('박청')], 'name')
  assert.deepEqual(out.map(r => r.name), ['강영덕', '박청', '최재수'])
})

test('원래 목록을 건드리지 않는다', () => {
  const src = [R('가', '2024-01-01'), R('나', '2026-01-01')]
  sortResidents(src, 'admission')
  assert.deepEqual(src.map(r => r.name), ['가', '나'])
})

test('성함·호실·층으로 찾는다 — 305 로도 305호 로도', () => {
  const r = R('윤장헌', '2025-01-01', '305', '3층')
  assert.equal(matchResident(r, '윤장'), true)
  assert.equal(matchResident(r, '305'), true)
  assert.equal(matchResident(r, '305호'), true)
  assert.equal(matchResident(r, '3층'), true)
  assert.equal(matchResident(r, '3층305'), true)
  assert.equal(matchResident(r, '이경애'), false)
})

test('빈 검색어는 모두 통과, 띄어쓰기는 무시', () => {
  const r = R('윤장헌', '2025-01-01', '305', '3층')
  assert.equal(matchResident(r, ''), true)
  assert.equal(matchResident(r, '  '), true)
  assert.equal(matchResident(r, '3층 305'), true)
})

test('호실·층이 비어 있어도 터지지 않는다', () => {
  assert.equal(matchResident(R('이름만'), '이름'), true)
  assert.equal(matchResident(R('이름만'), '305'), false)
})
