import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatRange, filterFindings, groupByDate, rankStaff, sortStaffRows, KIND_LABEL,
  type WeeklyAuditFindingLike,
} from '../src/utils/weeklyAudit'

const F = (over: Partial<WeeklyAuditFindingLike> = {}): WeeklyAuditFindingLike => ({
  date: '2026-09-14', weekday: '월', resident: '강영덕', area: '신체활동',
  staff: '김만자', owner_candidates: [], kind: 'error',
  ...over,
})

test('formatRange — 월~일 표기', () => {
  assert.equal(formatRange('2026-09-14', '2026-09-20'), '9/14(월) ~ 9/20(일)')
})

test('formatRange — 값이 비면 빈 문자열', () => {
  assert.equal(formatRange('', '2026-09-20'), '')
})

test('KIND_LABEL — 세 종류 라벨', () => {
  assert.deepEqual(KIND_LABEL, { error: '오류', blank: '공란', check: '확인' })
})

test('filterFindings — 작성자(staff)로 거른다', () => {
  const rows = [F({ id: '1', staff: '김만자' } as any), F({ id: '2', staff: '박영선' } as any)]
  const r = filterFindings(rows, { staff: '김만자' })
  assert.equal(r.length, 1)
  assert.equal((r[0] as any).id, '1')
})

test('filterFindings — 공란의 책임 후보(owner_candidates)로도 잡힌다', () => {
  const rows = [
    F({ id: '1', staff: null, owner_candidates: ['박영선', '최숙진'], kind: 'blank' } as any),
    F({ id: '2', staff: '김만자', owner_candidates: [] } as any),
  ]
  const r = filterFindings(rows, { staff: '최숙진' })
  assert.equal(r.length, 1)
  assert.equal((r[0] as any).id, '1')
})

test('filterFindings — 어르신·분야·종류·검색어 동시 적용', () => {
  const rows = [
    F({ id: '1', resident: '강영덕', area: '신체활동', kind: 'error', issue: '1회 기록' } as any),
    F({ id: '2', resident: '강영덕', area: '화장실이용', kind: 'error' } as any),
    F({ id: '3', resident: '최길순', area: '신체활동', kind: 'blank' } as any),
  ]
  assert.equal(filterFindings(rows, { resident: '강영덕' }).length, 2)
  assert.equal(filterFindings(rows, { area: '신체활동' }).length, 2)
  assert.equal(filterFindings(rows, { kind: 'blank' }).length, 1)
  assert.equal(filterFindings(rows, { q: '1회' }).length, 1)
})

test('filterFindings — 원본을 건드리지 않는다', () => {
  const rows = [F({ id: '1' } as any)]
  const before = JSON.parse(JSON.stringify(rows))
  filterFindings(rows, { staff: '아무개' })
  assert.deepEqual(rows, before)
})

test('groupByDate — 날짜 오름차순으로 묶는다', () => {
  const rows = [
    F({ id: '1', date: '2026-09-16', weekday: '수' } as any),
    F({ id: '2', date: '2026-09-14', weekday: '월' } as any),
    F({ id: '3', date: '2026-09-14', weekday: '월' } as any),
  ]
  const groups = groupByDate(rows)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].date, '2026-09-14')
  assert.equal(groups[0].weekday, '월')
  assert.equal(groups[0].items.length, 2)
  assert.equal(groups[1].date, '2026-09-16')
})

test('rankStaff — 오류+공란 내림차순, 같으면 이름순', () => {
  const rows = [
    { staff: '다', error: 3, blank_owner: 0 },
    { staff: '가', error: 1, blank_owner: 1 },
    { staff: '나', error: 5, blank_owner: 0 },
    { staff: '나2', error: 0, blank_owner: 0 },
  ]
  const order = rankStaff(rows).map(r => r.staff)
  assert.deepEqual(order, ['나', '다', '가', '나2'])
})

test('rankStaff — 원본을 건드리지 않는다(복사본 정렬)', () => {
  const rows = [{ staff: '나', error: 1, blank_owner: 0 }, { staff: '가', error: 1, blank_owner: 0 }]
  const before = JSON.parse(JSON.stringify(rows))
  rankStaff(rows)
  assert.deepEqual(rows, before)
})

test('sortStaffRows — 오류율 내림차순, 작성 0회(null)는 맨 아래', () => {
  const rows = [
    { staff: '가', error: 1, blank_owner: 0, mentions: 100, error_rate: 1 },
    { staff: '나', error: 5, blank_owner: 0, mentions: 10, error_rate: 50 },
    { staff: '다', error: 0, blank_owner: 2, mentions: 0, error_rate: null },
    { staff: '라', error: 2, blank_owner: 0, mentions: 20, error_rate: 10 },
  ]
  assert.deepEqual(sortStaffRows(rows, 'error_rate', 'desc').map(r => r.staff), ['나', '라', '가', '다'])
  assert.deepEqual(sortStaffRows(rows, 'error_rate', 'asc').map(r => r.staff), ['가', '라', '나', '다'])
})

test('sortStaffRows — default 는 rankStaff 순서, 같은 값이면 이름순', () => {
  const rows = [
    { staff: '나', error: 1, blank_owner: 0, mentions: 5 },
    { staff: '가', error: 1, blank_owner: 0, mentions: 5 },
    { staff: '다', error: 3, blank_owner: 0, mentions: 5 },
  ]
  assert.deepEqual(sortStaffRows(rows, 'default').map(r => r.staff), ['다', '가', '나'])
  assert.deepEqual(sortStaffRows(rows, 'mentions', 'desc').map(r => r.staff), ['가', '나', '다'])
})
