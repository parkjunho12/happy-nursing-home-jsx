/**
 * 근무표 형광펜 — 순수 규칙.
 *
 * 칸 표시가 날 전체(열) 표시를 이긴다. 같은 색을 다시 칠하면 지워진다(이유가
 * 없을 때만). 이 규칙이 서버(work_schedule_highlight.py)와 같아야 벽보와
 * 화면이 다른 칸을 가리키지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hlKey, toHlMap, hlOf, hlOwn, paintHl, noteHl, hlLegend, hlCount, type Highlight } from '../src/utils/scheduleHighlight'

const H = (staff_id: string, day: number, color: Highlight['color'] = 'yellow', note = ''): Highlight => ({ staff_id, day, color, note })

test('키 — 열은 앞이 비어 있다', () => {
  assert.equal(hlKey('s1', 2), 's1:2')
  assert.equal(hlKey('', 2), ':2')
  assert.equal(hlKey(undefined, 2), ':2')
  assert.equal(hlKey(' s1 ', 2), 's1:2')
})

test('겹침 — 칸 표시가 열 표시를 이긴다', () => {
  const m = toHlMap([H('', 2, 'yellow', '근무 변경'), H('s1', 2, 'pink', '대휴'), H('s2', 5, 'green')])
  assert.equal(hlOf(m, 's1', 2)?.color, 'pink')
  assert.equal(hlOf(m, 's9', 2)?.color, 'yellow')
  assert.equal(hlOf(m, 's2', 5)?.color, 'green')
  assert.equal(hlOf(m, 's1', 5), undefined)
  assert.equal(hlOwn(m, 's9', 2), undefined, '직접 그은 것만 볼 때는 열 표시가 안 잡힌다')
})

test('칠하기 — 같은 색 다시 칠하면 지움, 다른 색은 바꿈, 이유는 남음', () => {
  let m = toHlMap([])
  let r = paintHl(m, 's1', 3, 'yellow')
  assert.equal(r.item.color, 'yellow'); m = r.map
  r = paintHl(m, 's1', 3, 'pink')
  assert.equal(r.item.color, 'pink'); m = r.map
  assert.equal(hlOwn(m, 's1', 3)?.color, 'pink')
  r = paintHl(m, 's1', 3, 'pink')
  assert.equal(r.item.color, '', '같은 색 = 지우기')
  assert.equal(hlOwn(r.map, 's1', 3), undefined)
})

test('칠하기 — 이유가 있으면 같은 색을 다시 칠해도 안 지워진다 (실수로 이유를 날리지 않게)', () => {
  const m = toHlMap([H('s1', 3, 'yellow', '대휴 당김')])
  const r = paintHl(m, 's1', 3, 'yellow')
  assert.equal(r.item.color, 'yellow')
  assert.equal(r.item.note, '대휴 당김')
})

test('지우개 — null 은 무조건 지운다', () => {
  const m = toHlMap([H('s1', 3, 'yellow', '대휴 당김')])
  const r = paintHl(m, 's1', 3, null)
  assert.equal(r.item.color, '')
  assert.equal(hlCount(r.map), 0)
})

test('이유 — 표시 없던 칸에 적으면 노랑으로, 비우면 표시는 남는다', () => {
  let r = noteHl(toHlMap([]), '', 2, '  10/2 근무 변경 ')
  assert.deepEqual(r.item, { staff_id: '', day: 2, color: 'yellow', note: '10/2 근무 변경' })
  r = noteHl(r.map, '', 2, '')
  assert.equal(r.item.color, 'yellow')
  assert.equal(r.item.note, '')
  assert.equal(hlCount(r.map), 1)
})

test('범례 — 이유 있는 것만, 날짜 순, 같은 날은 전체 먼저', () => {
  const m = toHlMap([H('s1', 5, 'green', '조 이동'), H('', 2, 'yellow', '근무 변경'), H('s1', 2, 'pink', '대휴'), H('s2', 9)])
  const lines = hlLegend(m, { s1: '김철수' })
  assert.deepEqual(lines.map(l => `${l.day}일 · ${l.who} · ${l.note}`),
    ['2일 · 전체 · 근무 변경', '2일 · 김철수 · 대휴', '5일 · 김철수 · 조 이동'])
})

test('범례 — 이름 모르는 사람은 (퇴사)', () => {
  const lines = hlLegend(toHlMap([H('zz', 9, 'yellow', 'x')]), {})
  assert.equal(lines[0].who, '(퇴사)')
})
