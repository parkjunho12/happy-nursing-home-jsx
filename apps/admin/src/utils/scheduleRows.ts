/**
 * 근무표 저장에 실을 rows 만들기.
 *
 * 사람마다 직종·조·층·순서·메모·총시간을 담는다. 이 배열이 그대로 서버에
 * 저장되고, 다음 달에도 승계된다. 층 배정이 사는 곳이 여기다.
 *
 * 화면에서 떼어낸 이유: 여기서 한 사람이라도 빠지면 그 사람의 조·층이
 * 조용히 사라진다. 그런 코드는 테스트가 붙잡고 있어야 한다.
 */

export interface RowStaffLike {
  id: string
  pos?: string | null
  team?: string | null
  floor?: string | null
  note?: string | null
}

export interface ScheduleRowOut {
  staff_id: string
  position: string
  team: string
  floor: string
  order: number
  note: string
  hours: number
  extra: number
  total: number
}

export interface RowTotals { hours: number; extra: number; total: number }

export function buildScheduleRows(
  staff: RowStaffLike[],
  totalsOf: (id: string) => RowTotals,
): ScheduleRowOut[] {
  return staff.map((s, i) => {
    const t = totalsOf(s.id)
    return {
      staff_id: s.id,
      position: s.pos ?? '',
      team: s.team ?? '',
      // 층은 빈 문자열로 둔다. undefined 면 JSON 에서 키가 통째로 빠지고,
      // 그러면 '층을 지웠다' 와 '층을 안 건드렸다' 를 구분할 수 없다.
      floor: s.floor ?? '',
      order: i,
      note: s.note ?? '',
      hours: t.hours, extra: t.extra, total: t.total,
    }
  })
}

/**
 * 이대로 저장해도 되는가.
 *
 * 빈 배열을 보내면 서버가 모두의 조·층·순서를 지운다. 기준시간 같은
 * 위쪽 입력만 고쳐도 저장 버튼이 열리므로, 직원 목록을 못 불러온 채
 * 저장하는 길이 실제로 있다.
 */
export function canSaveRows(staffCount: number): boolean {
  return staffCount > 0
}
