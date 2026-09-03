import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRoomCards, sharedRooms, splitPages, MAX_ROOMS_PER_PAGE } from '../src/utils/bellLayout'

/* 두 방이 함께 쓰는 화장실이 배치도의 핵심이다.
   벨은 한 방에만 달려 있지만 두 방 어르신이 다 쓴다. 안내가 빠지면
   그 방 선생님은 화장실 벨이 울렸을 때 자기 방인 줄 모른다. */

const B = (no: number, room: string, kind = '생활실', note: string | null = null) =>
  ({ id: `b${no}`, no, room, kind, note, is_wc: kind.startsWith('화장실') })

test('방 이름을 뽑는다', () => {
  assert.deepEqual(sharedRooms('201호 ↔ 202호'), ['201호', '202호'])
  assert.deepEqual(sharedRooms('203호만 사용'), [], '전용 화장실은 짝이 없다')
  assert.deepEqual(sharedRooms('3층 공용 화장실'), [])
  assert.deepEqual(sharedRooms(null), [])
})

test('방마다 카드 하나, 벨은 번호순', () => {
  const cards = buildRoomCards([B(3, '301호'), B(1, '301호'), B(2, '301호')])
  assert.equal(cards.length, 1)
  assert.deepEqual(cards[0].bells.map(b => b.no), [1, 2, 3])
})

test('함께 쓰는 화장실은 옆방 카드에도 안내로 들어간다', () => {
  const cards = buildRoomCards([
    B(1, '301호'), B(2, '301호'),
    B(5, '302호'), B(9, '302호', '화장실(공용)', '301호 ↔ 302호'),
  ])
  const c301 = cards.find(c => c.room === '301호')!
  const c302 = cards.find(c => c.room === '302호')!
  assert.deepEqual(c301.sharedRef, { no: 9, withRoom: '302호' }, '301호는 안내만')
  assert.equal(c302.sharedRef, null, '벨이 달린 302호에는 안내가 필요 없다')
  assert.deepEqual(c301.numbers, [1, 2, 9], '머리 번호에 화장실 번호가 들어간다')
  assert.deepEqual(c302.numbers, [5, 9])
  assert.ok(!c301.bells.some(b => b.no === 9), '301호 카드에 화장실 벨 자체가 들어가면 두 번 그려진다')
})

test('전용 화장실은 옆방에 안내를 넣지 않는다', () => {
  const cards = buildRoomCards([
    B(10, '303호'), B(14, '303호', '화장실(전용)', '303호만 사용'), B(15, '304호'),
  ])
  assert.equal(cards.find(c => c.room === '304호')!.sharedRef, null)
  assert.equal(cards.find(c => c.room === '303호')!.sharedRef, null)
})

test('층 공용 화장실은 제 방 카드에만 있다', () => {
  const cards = buildRoomCards([B(41, '공용', '화장실(층 공용)', '3층 공용 화장실')])
  assert.equal(cards.length, 1)
  assert.equal(cards[0].sharedRef, null)
  assert.deepEqual(cards[0].numbers, [41])
})

test('실제 3층 배치 — 방 11개, 화장실 안내는 3곳', () => {
  const rows = [
    ...[1, 2, 3, 4].map(n => B(n, '301호')),
    ...[5, 6, 7, 8].map(n => B(n, '302호')), B(9, '302호', '화장실(공용)', '301호 ↔ 302호'),
    ...[10, 11, 12, 13].map(n => B(n, '303호')), B(14, '303호', '화장실(전용)', '303호만 사용'),
    ...[15, 16, 17, 18].map(n => B(n, '304호')),
    ...[19, 20, 21, 22].map(n => B(n, '305호')), B(23, '305호', '화장실(공용)', '304호 ↔ 305호'),
    ...[24, 25, 26, 27].map(n => B(n, '306호')),
    ...[28, 29, 30, 31].map(n => B(n, '307호')), B(32, '307호', '화장실(공용)', '306호 ↔ 307호'),
    ...[33, 34].map(n => B(n, '308호')),
    ...[35, 36].map(n => B(n, '309호')), B(37, '309호', '화장실(공용)', '308호 ↔ 309호'),
    ...[38, 39].map(n => B(n, '310호')), B(40, '310호', '화장실(전용)', '310호만 사용'),
    B(41, '공용', '화장실(층 공용)', '3층 공용 화장실'),
  ]
  const cards = buildRoomCards(rows)
  assert.equal(cards.length, 11, '301~310호 + 공용')
  const withRef = cards.filter(c => c.sharedRef)
  assert.deepEqual(withRef.map(c => c.room), ['301호', '304호', '306호', '308호'])
  // 벨이 두 번 그려지면 배치도의 번호가 중복된다
  const drawn = cards.flatMap(c => c.bells.map(b => b.no))
  assert.equal(new Set(drawn).size, drawn.length, '같은 벨이 두 카드에 그려졌다')
  assert.equal(drawn.length, 41, '41개가 빠짐없이 그려져야 한다')
})


/* 벽에 나란히 붙이는 문서다. 장수가 적을수록 좋고, 두 장의 무게가 비슷해야
   보기 좋다. 원본 배치도도 3층을 2장(5개·6개)에 담고 있었다. */

test('실제 층은 두 장을 넘지 않는다', () => {
  const rooms = (n: number) => Array.from({ length: n }, (_, i) => i)
  assert.equal(splitPages(rooms(11)).length, 2, '3층 — 301~310호 + 공용')
  assert.equal(splitPages(rooms(10)).length, 2, '2층 — 201~210호')
})

test('고르게 나눈다 — 뒷장만 휑하지 않게', () => {
  assert.deepEqual(splitPages([1,2,3,4,5,6,7,8,9,10,11]).map(p => p.length), [6, 5])
  assert.deepEqual(splitPages([1,2,3,4,5,6,7,8,9,10]).map(p => p.length), [5, 5])
  assert.deepEqual(splitPages([1,2,3,4,5,6,7]).map(p => p.length), [4, 3])
})

test('한 장에 들어가면 한 장', () => {
  assert.deepEqual(splitPages([1,2,3,4,5,6]).map(p => p.length), [6])
  assert.deepEqual(splitPages([1]).map(p => p.length), [1])
  assert.deepEqual(splitPages([]), [])
})

test('한 장에 최대 개수를 넘기지 않는다 — 넘기면 글씨가 뭉개진다', () => {
  for (const n of [1, 5, 6, 7, 10, 11, 12, 13, 25]) {
    const pages = splitPages(Array.from({ length: n }, (_, i) => i))
    assert.ok(pages.every(p => p.length <= MAX_ROOMS_PER_PAGE), `${n}개에서 넘쳤다`)
    assert.equal(pages.flat().length, n, `${n}개에서 방이 새거나 겹쳤다`)
  }
})
