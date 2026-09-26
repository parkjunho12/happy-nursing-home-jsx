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

import { shortIssue, staffBreakdown, weeklyPrintDigest, weeklyPrintToken } from '../src/utils/weeklyAudit'

test('shortIssue — 문제 문구를 한 토막으로', () => {
  assert.equal(shortIssue('1회 / 기준 3회'), '1/3회')
  assert.equal(shortIssue('미체크 (기준 1회)'), '미체크')
  assert.equal(shortIssue('미체크: 신체기능훈련, 기본동작훈련, 일상생활동작훈련 (신체·기본·일상 모두)'), '미체크 신체기능·기본동작·일상생활동작')
  assert.equal(shortIssue('확인(C) 기록 0회 (기준 1회 이상)'), '확인0회')
  assert.equal(shortIssue('교체(R) 5회 (기준 6회 이상)'), '교체5회')
  assert.equal(shortIssue('체위변경 8회 (기준 12회 · 2시간마다)'), '8회')
  assert.equal(shortIssue('체위변경 간격 12시간 (07:00→19:00) — 2시간 초과'), '간격12h 07:00→19:00')
  assert.equal(shortIssue('저녁 미체크(사유·조치사항 없음)'), '저녁 미체크')
  assert.equal(shortIssue('저녁(16:30) 외출·외박 중 미식사인데 조치사항 없음'), '저녁 외출중 미식사·조치없음')
})

test('weeklyPrintToken / weeklyPrintDigest — 날짜별 위치·항목 줄, 공란은 후보 표시', () => {
  const rows = [
    F({ id: '1', item: '이동도움', issue: '1회 / 기준 3회', room: '303호', resident: '이경애', staff: '강풀잎' } as any),
    F({ id: '2', item: '이동도움', issue: '1회 / 기준 3회', room: '303호', resident: '이경애', staff: '강풀잎' } as any),
    F({ id: '3', area: '화장실이용', item: '기저귀 교체', issue: '확인(C) 기록 0회 (기준 1회 이상)', kind: 'blank', staff: null, owner_candidates: ['김만자', '박영선'], resident: '오경애', room: '307호' } as any),
    F({ id: '4', area: '식사', item: '저녁식사', issue: '저녁 미체크(사유·조치사항 없음)', staff: '최진흥', resident: '박청', room: '304호' } as any),
  ]
  assert.equal(weeklyPrintToken(rows[0] as any), '이경애(303) 1/3회 강풀잎')
  const d = weeklyPrintDigest(rows as any)
  assert.equal(d.length, 1)
  assert.equal(d[0].error, 3); assert.equal(d[0].blank, 1)
  assert.deepEqual(d[0].lines.map(l => l.item), ['이동도움', '저녁식사', '기저귀 교체'])   // 신체활동 → 식사 → 화장실이용
  assert.equal(d[0].lines[0].count, 2)
  assert.equal(d[0].lines[0].text, '이경애(303) 1/3회 강풀잎')
  assert.equal(d[0].lines[0].where, '2-1 신체활동지원 칸')
  assert.equal(d[0].lines[2].text, '오경애(307) 확인0회 후보 김만자·박영선')
})

test('staffBreakdown — 선생님별 항목 건수, 공란은 후보 전원에게', () => {
  const rows = [
    F({ id: '1', item: '이동도움', staff: '강풀잎' } as any),
    F({ id: '2', item: '옷갈아입히기', staff: '강풀잎' } as any),
    F({ id: '3', item: '이동도움', staff: '강풀잎' } as any),
    F({ id: '4', item: '체위변경', area: '체위변경', kind: 'check', staff: '강풀잎' } as any),
    F({ id: '5', item: '기저귀 교체', area: '화장실이용', kind: 'blank', staff: null, owner_candidates: ['김만자', '강풀잎'] } as any),
  ]
  const b = staffBreakdown(rows as any)
  assert.equal(b[0].staff, '강풀잎')
  assert.equal(b[0].error, 3); assert.equal(b[0].blank_owner, 1); assert.equal(b[0].check, 1)
  assert.deepEqual(b[0].items[0], { label: '신체활동 · 이동도움', count: 2 })
  assert.equal(b[1].staff, '김만자'); assert.equal(b[1].blank_owner, 1)
})
