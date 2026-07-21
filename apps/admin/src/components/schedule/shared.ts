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
