import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveDown, moveUp, parseFavs, removeFav, toggleFav } from '../src/utils/favOrder'

/* 즐겨찾기는 적힌 차례대로 맨 위에 붙는다. 그 차례를 손으로 바꾼다. */

const L = ['/a', '/b', '/c']

test('한 칸 위로', () => {
  assert.deepEqual(moveUp(L, '/b'), ['/b', '/a', '/c'])
  assert.deepEqual(moveUp(L, '/c'), ['/a', '/c', '/b'])
})

test('맨 위는 더 못 올린다 — 없는 자리로 밀면 목록이 비뚤어진다', () => {
  assert.deepEqual(moveUp(L, '/a'), L)
  assert.deepEqual(moveUp(L, '/없음'), L)
  assert.deepEqual(moveUp([], '/a'), [])
})

test('한 칸 아래로, 맨 아래는 그대로', () => {
  assert.deepEqual(moveDown(L, '/b'), ['/a', '/c', '/b'])
  assert.deepEqual(moveDown(L, '/c'), L)
  assert.deepEqual(moveDown(L, '/없음'), L)
})

test('원래 목록을 건드리지 않는다', () => {
  const src = [...L]
  moveUp(src, '/b'); moveDown(src, '/a'); removeFav(src, '/a'); toggleFav(src, '/z')
  assert.deepEqual(src, L)
})

test('올렸다 내리면 제자리', () => {
  assert.deepEqual(moveDown(moveUp(L, '/b'), '/b'), L)
})

test('별 누르기 — 새것은 맨 뒤에 붙는다', () => {
  // 맨 앞에 넣으면 방금 누른 것이 늘 1번이 되어 맞춰둔 차례가 흐트러진다
  assert.deepEqual(toggleFav(L, '/d'), ['/a', '/b', '/c', '/d'])
  assert.deepEqual(toggleFav(L, '/b'), ['/a', '/c'])
})

test('빼기', () => {
  assert.deepEqual(removeFav(L, '/b'), ['/a', '/c'])
  assert.deepEqual(removeFav(L, '/없음'), L)
})

test('저장된 값이 이상해도 메뉴는 떠야 한다', () => {
  assert.deepEqual(parseFavs('["/a","/b"]'), ['/a', '/b'])
  assert.deepEqual(parseFavs(null), [])
  assert.deepEqual(parseFavs('그냥 글자'), [])
  assert.deepEqual(parseFavs('{"a":1}'), [])
  assert.deepEqual(parseFavs('[1,null,"/a",""]'), ['/a'])
})

test('같은 것이 두 번 들어 있으면 하나로 — 두 줄로 보이면 안 된다', () => {
  assert.deepEqual(parseFavs('["/a","/a","/b"]'), ['/a', '/b'])
})
