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

import { homeDigest, printDigest, printToken } from '../src/utils/nursingAudit'

test('printDigest — 날짜별로 위치·항목 줄을 만들고 참고는 건수만 센다', () => {
  const d = printDigest([
    F({ id: '1', item: '미작성', time: '11:07', resident: '길영옥', room: '307호' } as any),
    F({ id: '2', item: '미작성', time: '11:07', resident: '길영옥', room: '307호' } as any),           // 같은 어르신·시각(다른 약) → 토큰 1개
    F({ id: '3', kind: 'info', item: '투약 미기록(●)', resident: '황영수' } as any),
    F({ id: '4', area: '간호일지', item: '건강관리 미체크', resident: '백명애', room: '303호' } as any),
    F({ id: '5', item: '동일 제공자 동일 시각 다른 생활실', time: '12:04', staff: '박미순', evidence: '204호 김승호, 304호 박청', resident: '2명', room: '2개 생활실' } as any),
    F({ id: '6', kind: 'check', item: '동일 시각 다른 생활실', time: '08:03', resident: '7명' } as any),
    F({ id: '7', kind: 'check', item: '동일 시각 다른 생활실', time: '08:04', resident: '6명' } as any),
  ])
  assert.equal(d.length, 1)
  assert.equal(d[0].error, 4); assert.equal(d[0].check, 2); assert.equal(d[0].info, 1)
  const items = d[0].lines.map(l => l.item)
  assert.deepEqual(items, ['미작성', '동일 제공자 동일 시각 다른 생활실', '동일 시각 다른 생활실', '건강관리 미체크'])  // 투약 먼저, 오류 먼저
  assert.equal(d[0].lines[0].count, 2)
  assert.equal(d[0].lines[0].text, '길영옥(307) 11:07')
  assert.match(d[0].lines[0].where, /^3-1 › 어르신 클릭 › 2.투약관리 탭 › 위쪽 빨간 "미작성" 칸/)
  assert.equal(d[0].lines[1].text, '12:04 박미순(204·304호)')
  assert.match(d[0].lines[2].text, /^2건 \(08:03·08:04\)/)
  assert.match(d[0].lines[3].where, /^3-1-1 통합 간호관리 기록 › 날짜를 그날로 › 어르신 행 "건강관리" 체크/)
})

test('printDigest — 외출이 걸린 미작성은 1-5 외출,외박 관리와 대조하라고 덧붙인다', () => {
  const d = printDigest([F({ id: '1', item: '미작성', time: '08:00', exception: '외박 09-10 07:40~09-21 16:00 시간대' } as any)])
  assert.match(d[0].lines[0].where, /1-5 외출,외박 관리와 대조/)
  const d2 = printDigest([F({ id: '2', item: '외출·외박 중 투약기록', time: '08:06', staff: '김현숙' } as any)])
  assert.match(d2[0].lines[0].where, /^3-1 › 2.투약관리 탭 › 그 슬롯 시간을 외출 전·후 실제 시각으로/)
})

test('printDigest — 토큰이 많으면 "외 N"으로 접는다', () => {
  const rows = Array.from({ length: 20 }, (_, i) => F({ id: String(i), area: '간호일지', item: '건강관리 미체크', resident: `어르신${i}` } as any))
  const d = printDigest(rows, 5)
  assert.equal(d[0].lines[0].count, 20)
  assert.match(d[0].lines[0].text, / 외 15$/)
})

test('printToken — 어르신(호실) 형식', () => {
  assert.equal(printToken(F({ area: '간호일지', item: '바이탈 미기록', resident: '육춘근', room: '304호' } as any)), '육춘근(304)')
})

test('homeDigest — 어르신별 구분별 날짜 목록, 가정간호 표시 없는 줄은 제외', () => {
  const h = homeDigest([
    { date: '2026-09-21', resident: '김승호', room: '204호', type: '비위관', home_nursing: true },
    { date: '2026-09-21', resident: '김승호', room: '204호', type: '욕창간호', home_nursing: true },
    { date: '2026-09-23', resident: '김승호', room: '204호', type: '욕창간호', home_nursing: true },
    { date: '2026-09-22', resident: '김승호', room: '204호', type: '도뇨관', home_nursing: false },
  ])
  assert.equal(h.length, 1)
  assert.deepEqual(h[0].types, [{ type: '욕창간호', dates: ['9/21', '9/23'] }, { type: '비위관', dates: ['9/21'] }])
  assert.equal(h[0].room, '204')
})
