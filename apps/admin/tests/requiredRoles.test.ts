// 필수 직종(간호팀장·사회복지사) 일 1명 출근 룰 검증
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditSchedule, REQUIRED_ROLES, type AuditInput } from '../src/utils/scheduleAudit'

const days = [1, 2, 3].map(day => ({ day, dow: day % 7 }))
const base = (staff: AuditInput['staff'], data: AuditInput['data']): AuditInput => ({
  days, staff, data,
  baseHours: 0, minStaffPerDay: 0, maxNightStreak: 99, maxWorkStreak: 99, hoursTolerance: 999,
})

test('필수 직종이 매일 근무하면 roleMissing 없음', () => {
  const issues = auditSchedule(base(
    [
      { id: 'n1', name: '김간호', pos: '간호팀장' },
      { id: 's1', name: '박복지', pos: '사회복지사' },
    ],
    { n1: { '1': 'D', '2': 'D', '3': 'N' }, s1: { '1': 'D', '2': 'N', '3': 'D' } },
  ))
  assert.equal(issues.filter(i => i.kind === 'roleMissing').length, 0)
})

test('간호팀장이 빠진 날을 danger로 잡는다 (연차는 근무 아님)', () => {
  const issues = auditSchedule(base(
    [
      { id: 'n1', name: '김간호', pos: '간호팀장' },
      { id: 's1', name: '박복지', pos: '사회복지사' },
    ],
    { n1: { '1': 'D', '2': '休' }, s1: { '1': 'D', '2': 'D', '3': 'D' } }, // 간호: 2일 연차, 3일 공백
  ))
  const rm = issues.filter(i => i.kind === 'roleMissing')
  assert.deepEqual(rm.map(i => i.day).sort(), [2, 3])
  assert.ok(rm.every(i => i.level === 'danger' && i.title.includes('간호팀장')))
})

test('같은 직종 여러 명이면 한 명만 나와도 통과', () => {
  const issues = auditSchedule(base(
    [
      { id: 's1', name: '박복지', pos: '사회복지사' },
      { id: 's2', name: '이복지', pos: '사회복지사' },
      { id: 'n1', name: '김간호', pos: '간호팀장' },
    ],
    {
      s1: { '1': 'D' }, s2: { '2': 'D', '3': 'D' },      // 복지: 매일 교대로 1명
      n1: { '1': 'D', '2': 'D', '3': 'D' },
    },
  ))
  assert.equal(issues.filter(i => i.kind === 'roleMissing' && i.title.includes('사회복지사')).length, 0)
})

test('해당 직종이 편성표에 아예 없으면 한 건짜리 경고', () => {
  const issues = auditSchedule(base(
    [{ id: 'n1', name: '김간호', pos: '간호팀장' }],
    { n1: { '1': 'D', '2': 'D', '3': 'D' } },
  ))
  const rm = issues.filter(i => i.kind === 'roleMissing')
  assert.equal(rm.length, 1)
  assert.equal(rm[0].level, 'warn')
  assert.ok(rm[0].title.includes('사회복지사'))
})

test('REQUIRED_ROLES는 간호팀장·사회복지사', () => {
  assert.deepEqual([...REQUIRED_ROLES], ['간호팀장', '사회복지사'])
})
