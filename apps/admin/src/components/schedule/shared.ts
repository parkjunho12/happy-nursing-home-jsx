// 근무표 화면들이 공유하는 상수 — 페이지와 패널 컴포넌트가 함께 쓴다
export const SHIFT_POSITION = '요양보호사'
/** 교대(주주야야휴휴)를 돌 수 있는 직종인지 — 나머지는 모두 주간 */
export const canJoinTeam = (pos?: string | null) => (pos ?? '').includes(SHIFT_POSITION)

/** 조별 색 띠 — 표에서 조 경계를 눈으로 잡기 위한 것 */
export const TEAM_BAND: Record<string, string> = {
  'A조': 'bg-rose-400', 'B조': 'bg-sky-400', 'C조': 'bg-emerald-400',
  'D조': 'bg-violet-400', 'E조': 'bg-amber-400', 'F조': 'bg-teal-400', '주간': 'bg-gray-300',
}

/** 표에 실리는 직원 행 */
export interface StaffRow {
  id: string
  name: string
  pos: string
  team: string
  note: string
}


/** 근무표 직종 정렬 순서 — 시설 요청 순.
 *  시설장 → 사회복지사 → 간호(조무사·팀장·간호사) → 물리·작업치료사 → 기타 →
 *  요양보호사(교대조 먼저, 주간 아래). 묶음 안은 입사 빠른 순. */
export const SCHEDULE_POS_ORDER = ['시설장', '사회복지사', '간호조무사', '간호팀장', '간호사', '물리치료사', '작업치료사', '팀장', '요양팀장', '조리원', '위생원', '사무원', '요양보호사']

export interface SortableStaff { pos: string; team?: string | null; hireDate?: string | null; name: string }

/** 근무표 표시 정렬 — 페이지·인쇄·근무상황부가 전부 이 함수를 쓴다 */
export function sortScheduleStaff<T extends SortableStaff>(list: T[]): T[] {
  const CG = SCHEDULE_POS_ORDER.indexOf('요양보호사')
  const rank = (x: SortableStaff) => {
    const pos = (x.pos || '').trim()
    const team = (x.team ?? '').trim()
    const i = SCHEDULE_POS_ORDER.indexOf(pos)
    // 모르는 직종은 '요양보호사 표기 변형'일 가능성이 커서 요보와 같은 등급으로 —
    // 다른 등급에 두면 조 없는 변형 표기가 교대조 위로 올라가는 사고가 난다 (운영 버그의 원인)
    const base = i === -1 ? CG : i
    // 조가 있으면 그 등급 최상단, 없으면(요보·미상 직종) 그 아래
    if (team) return base * 10
    if (canJoinTeam(pos) || i === -1) return base * 10 + 5
    return base * 10
  }
  const hasTeam = (x: SortableStaff) => ((x.team ?? '').trim() ? 0 : 1)
  return [...list].sort((a, b) =>
    rank(a) - rank(b) ||
    hasTeam(a) - hasTeam(b) ||                                        // 랭크 동률이어도 조 있는 사람 위
    ((a.team ?? '').trim()).localeCompare((b.team ?? '').trim()) ||    // A→B→C
    ((a.hireDate || '9999').slice(0, 10)).localeCompare((b.hireDate || '9999').slice(0, 10)) ||
    a.name.localeCompare(b.name, 'ko'))
}
