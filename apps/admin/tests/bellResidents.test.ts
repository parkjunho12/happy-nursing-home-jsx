import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roomKey, pickOrder, missingInRoom, unknownNames } from '../src/utils/bellResidents'

/* 응급벨 명단은 벨이 울렸을 때 달려갈 방을 찾는 문서다.
   이름이 틀리거나 빠지면 그 몇 초를 잃는다. */

const R = (name: string, floor: string, room: string) => ({ name, floor, room })
const PEOPLE = [
  R('백명애', '3층', '303'), R('이경애', '3층', '303'), R('원종순', '3층', '303'),
  R('최재수', '3층', '304'), R('윤장헌', '3층', '305'),
  R('김이박', '2층', '201'),
]

test('호실 표기가 달라도 같은 방으로 본다', () => {
  // 수급자 관리는 '301', 응급벨은 '301호' — 안 맞추면 기능이 통째로 안 먹는다
  assert.equal(roomKey('301호'), '301')
  assert.equal(roomKey(' 301 '), '301')
  assert.equal(roomKey(301), '301')
  assert.equal(roomKey(null), '')
  assert.equal(roomKey('공용'), '공용')
})

test('같은 방 → 같은 층 → 나머지 순서로 보여준다', () => {
  const ordered = pickOrder(PEOPLE, '3층', '303호')
  assert.deepEqual(ordered.slice(0, 3).map(r => r.name).sort(),
    ['백명애', '원종순', '이경애'], '같은 방이 맨 앞')
  assert.equal(ordered[ordered.length - 1].name, '김이박', '다른 층이 맨 뒤')
})

test('이 방에 계신데 아직 안 넣은 분을 알려준다', () => {
  const miss = missingInRoom(PEOPLE, '3층', '303호', ['백명애', ''])
  assert.deepEqual(miss.map(r => r.name), ['이경애', '원종순'])
  assert.deepEqual(missingInRoom(PEOPLE, '3층', '303호', ['백명애', '이경애', '원종순']), [],
    '다 넣었으면 아무것도 안 알린다')
})

test('공백이 섞여도 넣은 것으로 본다 — 헛경고가 뜨면 경고를 안 믿게 된다', () => {
  assert.deepEqual(missingInRoom(PEOPLE, '3층', '304호', ['  최재수  ']), [])
})

test('명단에 없는 이름을 짚어 준다 — 오타이거나 퇴소한 분이다', () => {
  assert.deepEqual(unknownNames(PEOPLE, ['백명애', '백명해', '']), ['백명해'])
  assert.deepEqual(unknownNames(PEOPLE, ['백명애', '백명애']), [], '중복은 한 번만')
  assert.deepEqual(unknownNames(PEOPLE, []), [])
})

test('다른 층 같은 번호 방을 섞지 않는다', () => {
  // 2층 201호와 3층 301호는 번호가 달라 안 섞이지만, 층까지 봐야 안전하다
  const two = [...PEOPLE, R('동명이', '2층', '303')]
  assert.deepEqual(missingInRoom(two, '2층', '303호', []).map(r => r.name), ['동명이'])
  assert.deepEqual(missingInRoom(two, '3층', '303호', []).map(r => r.name),
    ['백명애', '이경애', '원종순'])
})
