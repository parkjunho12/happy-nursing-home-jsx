import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  KIND_LABEL, addDays, filterFindings, formatMonth, formatRange, groupByDate, itemMatrix, mondayOf, weeksOfMonth,
  type NursingFindingLike,
} from '../src/utils/nursingAudit'

const F = (over: Partial<NursingFindingLike> = {}): NursingFindingLike => ({
  date: '2026-09-21', weekday: '월', resident: '김승호', room: '204호', area: '투약', item: '미작성', kind: 'error', staff: null, ...over,
})

test('KIND_LABEL — 세 종류', () => {
  assert.deepEqual(KIND_LABEL, { error: '오류', check: '확인', info: '참고' })
})

test('mondayOf / addDays — 요일 계산은 UTC 고정', () => {
  assert.equal(mondayOf('2026-09-26'), '2026-09-21')   // 토 → 월
  assert.equal(mondayOf('2026-09-21'), '2026-09-21')
  assert.equal(mondayOf('2026-09-27'), '2026-09-21')   // 일 → 그 주 월
  assert.equal(addDays('2026-09-30', 1), '2026-10-01')
})

test('weeksOfMonth — 달과 겹치는 월~일 주, 최신 우선', () => {
  const w = weeksOfMonth('2026-09')
  assert.equal(w[w.length - 1].start, '2026-08-31')
  assert.equal(w[w.length - 1].end, '2026-09-06')
  assert.equal(w[0].start, '2026-09-28')
  assert.equal(w[0].end, '2026-10-04')
  assert.equal(w.length, 5)
  assert.equal(w[0].label, '9/28(월) ~ 10/4(일)')
})

test('formatRange / formatMonth', () => {
  assert.equal(formatRange('2026-09-14', '2026-09-20'), '9/14(월) ~ 9/20(일)')
  assert.equal(formatRange('', '2026-09-20'), '')
  assert.equal(formatMonth('2026-09'), '2026년 9월')
})

test('filterFindings — 어르신 필터는 residents 배열(동일 시각 묶음)도 본다', () => {
  const rows = [F({ id: '1' } as any), F({ id: '2', resident: '2명', residents: ['박청', '김승호'] } as any), F({ id: '3', resident: '박청' } as any)]
  const r = filterFindings(rows, { resident: '김승호' })
  assert.deepEqual(r.map((x: any) => x.id), ['1', '2'])
})

test('filterFindings — 분야·항목·종류·검색어', () => {
  const rows = [F({ id: '1' } as any), F({ id: '2', area: '간호일지', item: '바이탈 미기록', kind: 'check', issue: '혈압 없음' } as any)]
  assert.equal(filterFindings(rows, { area: '간호일지' }).length, 1)
  assert.equal(filterFindings(rows, { item: '미작성' }).length, 1)
  assert.equal(filterFindings(rows, { kind: 'check' }).length, 1)
  assert.equal(filterFindings(rows, { q: '혈압' }).length, 1)
})

test('groupByDate — 날짜 오름차순, 요일은 항목값 우선', () => {
  const g = groupByDate([F({ date: '2026-09-22', weekday: null } as any), F({ date: '2026-09-21' } as any)])
  assert.deepEqual(g.map(x => x.date), ['2026-09-21', '2026-09-22'])
  assert.equal(g[1].weekday, '화')
})

test('itemMatrix — 분야 순서는 투약→진료기록→간호일지, 항목별 종류 집계', () => {
  const m = itemMatrix([
    F({ area: '간호일지', item: '건강관리 미체크' } as any),
    F({ area: '투약', item: '미작성', kind: 'check' } as any),
    F({ area: '투약', item: '미작성' } as any),
    F({ area: '진료기록', item: '외출기록 없음' } as any),
  ])
  assert.deepEqual(m.map(x => x.area), ['투약', '진료기록', '간호일지'])
  assert.equal(m[0].error, 1); assert.equal(m[0].check, 1); assert.equal(m[0].total, 2)
})
