/** 근무표 정렬 — "운영에서 주간이 위로" 재발 방지 테스트 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortScheduleStaff } from '../src/components/schedule/shared'

test('교대조가 주간보다 항상 위 — 운영 데이터 변형 포함', () => {
  const staff = [
    { name: '주간1', pos: '요양보호사', team: '', hireDate: '2020-01-01' },
    { name: '조A', pos: '요양보호사', team: 'A조', hireDate: '2024-01-01' },
    { name: '주간2', pos: '요양보호사 ', team: null, hireDate: '2019-01-01' },   // 직종 뒤 공백
    { name: '조B', pos: '요양보호사', team: 'B조', hireDate: '2022-01-01' },
    { name: '조C이상표기', pos: '요양사', team: 'C조', hireDate: '2023-01-01' },  // 표기 변형 + 조 있음
  ]
  const out = sortScheduleStaff(staff).map(s => s.name)
  // 조 있는 사람 전원이 주간 전원보다 앞
  const lastTeam = Math.max(out.indexOf('조A'), out.indexOf('조B'), out.indexOf('조C이상표기'))
  const firstDay = Math.min(out.indexOf('주간1'), out.indexOf('주간2'))
  assert.ok(lastTeam < firstDay, `교대조가 주간 아래로 감: ${out.join(' → ')}`)
  // 조끼리 A→B→C
  assert.ok(out.indexOf('조A') < out.indexOf('조B'))
})

test('전체 직종 순서 + 묶음 내 입사순', () => {
  const staff = [
    { name: '요보주간', pos: '요양보호사', team: '', hireDate: '2020-01-01' },
    { name: '물치', pos: '물리치료사', team: '', hireDate: '2023-01-01' },
    { name: '간호팀장', pos: '간호팀장', team: '', hireDate: '2021-01-01' },
    { name: '시설장', pos: '시설장', team: '', hireDate: '2019-01-01' },
    { name: '요보A', pos: '요양보호사', team: 'A조', hireDate: '2022-01-01' },
    { name: '사복', pos: '사회복지사', team: '', hireDate: '2022-01-01' },
    { name: '간조', pos: '간호조무사', team: '', hireDate: '2023-01-01' },
    { name: '요보A선임', pos: '요양보호사', team: 'A조', hireDate: '2020-05-01' },
  ]
  assert.deepEqual(sortScheduleStaff(staff).map(s => s.name),
    ['시설장', '사복', '간조', '간호팀장', '물치', '요보A선임', '요보A', '요보주간'])
})

test('운영 재현 — 직종 표기가 깨진 주간이 교대조 위로 못 올라간다', () => {
  const staff = [
    { name: '주간표기변형', pos: '요양 보호사', team: '', hireDate: '2018-01-01' },  // 공백 낀 표기
    { name: '주간미상', pos: '', team: null, hireDate: '2017-01-01' },               // 직종 비어 있음
    { name: '조A', pos: '요양보호사', team: 'A조', hireDate: '2024-01-01' },
    { name: '조B', pos: '요양보호사', team: 'B조', hireDate: '2024-01-01' },
  ]
  const out = sortScheduleStaff(staff).map(s => s.name)
  assert.deepEqual(out.slice(0, 2), ['조A', '조B'], `교대조가 위여야 함: ${out.join(' → ')}`)
})
