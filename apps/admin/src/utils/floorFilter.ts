/**
 * 근무표 층 걸러보기.
 *
 * 층을 고르면 그 층 요양보호사만 남는다. 간호사·사회복지사처럼 층이 없는
 * 직종은 그대로 둔다 — 층은 요양보호사에게 붙는 개념이고, 층별로 뽑아
 * 붙일 때도 그 사람들은 함께 보여야 한다.
 *
 * 보기 전용이다. 저장·검수·자동생성은 언제나 전체 인원을 쓴다. 걸러둔 채로
 * 저장했다가 사람이 빠지면 그건 근무표가 아니라 사고다. 그래서 이 함수는
 * 새 배열을 돌려줄 뿐, 원본을 건드리지 않는다.
 */

export interface FloorStaffLike {
  id: string
  pos?: string | null
  floor?: string | null
}

/** 이 직종이 교대조(=요양보호사)인가 — shared.ts 의 canJoinTeam 과 같은 기준 */
export type IsCaregiver = (pos?: string | null) => boolean

export function filterByFloor<T extends FloorStaffLike>(
  staff: T[], floor: string, isCaregiver: IsCaregiver,
): T[] {
  if (!floor) return staff
  return staff.filter(s => !isCaregiver(s.pos) || (s.floor || '') === floor)
}

/** 층을 고른 탓에 숨겨진 '층 미지정' 요양보호사 수 — 조용히 사라지면 안 된다 */
export function countHiddenNoFloor<T extends FloorStaffLike>(
  staff: T[], floor: string, isCaregiver: IsCaregiver,
): number {
  if (!floor) return 0
  return staff.filter(s => isCaregiver(s.pos) && !s.floor).length
}
