import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withFloorSubtotals } from '../src/utils/floorSubtotals'
import { canJoinTeam } from '../src/components/schedule/shared'
import { sortScheduleStaff } from '../src/components/schedule/shared'

const cg = (id: string, floor: string) => ({ id, pos: '요양보호사', floor, name: id, team: '' })
const other = (id: string, pos: string) => ({ id, pos, floor: '', name: id, team: '' })

/** 줄 종류를 읽기 쉽게 */
const shape = (rows: ReturnType<typeof withFloorSubtotals<any>>) =>
  rows.map(r => r.kind === 'person' ? r.p.id : `${r.floor}·${r.shift === 'D' ? '주간' : '야간'}`)

test('층마다 주간·야간 소계가 뒤에 붙는다', () => {
  assert.deepEqual(shape(withFloorSubtotals([
    cg('가', '2층'), cg('나', '2층'), cg('다', '3층'),
  ], canJoinTeam)), ['가', '나', '2층·주간', '2층·야간', '다', '3층·주간', '3층·야간'])
})

test('층이 늘어도 그대로 된다 — 4층·5층이 생겨도 고칠 것이 없다', () => {
  const rows = shape(withFloorSubtotals([
    cg('a', '2층'), cg('b', '3층'), cg('c', '4층'), cg('d', '5층'),
  ], canJoinTeam))
  for (const f of ['2층', '3층', '4층', '5층']) {
    assert.ok(rows.includes(`${f}·주간`), `${f} 주간 소계`)
    assert.ok(rows.includes(`${f}·야간`), `${f} 야간 소계`)
  }
})

test('마지막 층도 빠지지 않는다', () => {
  const rows = shape(withFloorSubtotals([cg('가', '2층')], canJoinTeam))
  assert.deepEqual(rows, ['가', '2층·주간', '2층·야간'])
})

test('층이 없는 직종은 소계에 들어가지 않는다', () => {
  const rows = withFloorSubtotals([
    other('시설장', '시설장'), other('간호', '간호사'), cg('요보', '2층'),
  ], canJoinTeam)
  const sub = rows.filter(r => r.kind === 'subtotal') as any[]
  assert.equal(sub.length, 2, '2층 소계 두 줄만')
  assert.deepEqual(sub[0].ids, ['요보'], '간호사·시설장은 세지 않는다')
})

test('요양보호사가 없으면 소계도 없다', () => {
  const rows = withFloorSubtotals([other('간호', '간호사')], canJoinTeam)
  assert.equal(rows.filter(r => r.kind === 'subtotal').length, 0)
})

test('층 미지정 요양보호사도 한 묶음으로 소계가 나온다', () => {
  const rows = withFloorSubtotals([cg('가', '2층'), cg('나', '')], canJoinTeam)
  const sub = rows.filter(r => r.kind === 'subtotal') as any[]
  assert.deepEqual(sub.map(s => s.floor), ['2층', '2층', '', ''])
  assert.deepEqual(sub[2].ids, ['나'])
})

test('실제 정렬을 거친 목록에서도 층이 섞이지 않는다', () => {
  // 정렬 전에는 층이 뒤죽박죽이어도, 정렬 뒤에는 층별로 뭉쳐야 한다
  const sorted = sortScheduleStaff([
    cg('삼1', '3층'), cg('이1', '2층'), cg('삼2', '3층'), cg('이2', '2층'),
  ] as any)
  const rows = shape(withFloorSubtotals(sorted as any, canJoinTeam))
  assert.deepEqual(rows, ['이1', '이2', '2층·주간', '2층·야간',
                          '삼1', '삼2', '3층·주간', '3층·야간'])
})

test('소계에 담기는 사람이 그 층 사람뿐이다', () => {
  const rows = withFloorSubtotals([cg('이', '2층'), cg('삼', '3층')], canJoinTeam)
  const sub = rows.filter(r => r.kind === 'subtotal') as any[]
  assert.deepEqual(sub[0].ids, ['이'])
  assert.deepEqual(sub[2].ids, ['삼'])
})

/* 층이 뒤섞인 목록을 넣으면 같은 층 소계가 여러 번 나온다.
   이건 고쳐야 할 버그가 아니라 이 함수의 한계다 — 정렬이 층으로 묶어 준다는
   전제 위에 서 있다. 근무표 편성 화면의 '가나다·입사순' 정렬이 그 전제를
   깨므로, 그 화면은 기본 정렬일 때만 소계를 낸다.
   이 테스트는 그 가드가 왜 있는지를 못박아 둔다 — 없애면 여기가 알려 준다. */
test('층이 뒤섞이면 같은 층 소계가 여러 번 나온다 (그래서 정렬 가드가 필요하다)', () => {
  const mixed = [
    { id: 'a', pos: '요양보호사', floor: '2층' },
    { id: 'b', pos: '요양보호사', floor: '3층' },
    { id: 'c', pos: '요양보호사', floor: '2층' },
  ]
  const subs = withFloorSubtotals(mixed, canJoinTeam).filter(r => r.kind === 'subtotal')
  const twos = subs.filter(r => r.kind === 'subtotal' && r.floor === '2층')
  assert.equal(subs.length, 6, '2층·3층·2층 → 세 덩어리 × 두 줄')
  assert.equal(twos.length, 4, '2층 소계가 두 번(주간·야간씩) 나온다')
})
