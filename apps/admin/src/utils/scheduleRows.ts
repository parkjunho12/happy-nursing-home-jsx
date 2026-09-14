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


/**
 * 조 편성(직종·조·층)이 바뀌었는가 — 서버의 work_schedule_rows.same_assignment 와 같은 기준.
 *
 * 순서·비고·집계는 보지 않는다. 순서는 화면 정렬에 따라 매번 달라지고, 비고는
 * 그 달의 이야기다. 서버가 뒤 달에 이월할지 판단하는 기준과 여기가 다르면
 * 화면은 안 물었는데 서버는 이월하는(또는 그 반대) 일이 생긴다.
 */
export function assignmentChanged(
  before: { staff_id: string; position?: string | null; team?: string | null; floor?: string | null }[],
  after: { staff_id: string; position?: string | null; team?: string | null; floor?: string | null }[],
): boolean {
  const key = (rows: typeof before) => rows
    .filter(r => r.staff_id)
    .map(r => [r.staff_id, (r.position ?? '').trim(), (r.team ?? '').trim(), (r.floor ?? '').trim()].join('\u0001'))
    .sort()
    .join('\u0002')
  // 저장 직전 편성이 없었으면(첫 저장) 따라오던 달도 없다 — 묻지 않는다
  if (before.filter(r => r.staff_id).length === 0) return false
  return key(before) !== key(after)
}
