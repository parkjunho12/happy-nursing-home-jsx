/**
 * 근무표에 층별 소계 줄을 끼워 넣는다.
 *
 *   2층 요양보호사들…
 *   2층 주간 소계
 *   2층 야간 소계
 *   3층 요양보호사들…
 *   3층 주간 소계
 *   3층 야간 소계
 *
 * 요양보호사는 이미 층 순으로 정렬돼 있으므로(sortScheduleStaff), 층이
 * 바뀌는 자리에서 앞 층의 소계를 넣으면 된다. 층이 늘어도(4층·5층) 목록을
 * 고칠 필요가 없다 — 실제로 있는 층을 따라간다.
 *
 * 층이 없는 직종(간호·사회복지·시설장)은 소계에 넣지 않는다. 그 층에 몇 명이
 * 있는지를 보려는 것이지 전체 인원을 세려는 게 아니다.
 */
export interface SubtotalStaff {
  id: string
  pos: string
  floor?: string | null
}

export type BodyRow<T extends SubtotalStaff> =
  | { kind: 'person'; p: T }
  | { kind: 'subtotal'; floor: string; shift: 'D' | 'N'; ids: string[] }

/** 교대조(=요양보호사)인지 판별 — 부르는 쪽이 넘긴다(filterByFloor 와 같은 방식) */
export type IsCaregiver = (pos?: string | null) => boolean

export function withFloorSubtotals<T extends SubtotalStaff>(
  list: T[], isCaregiver: IsCaregiver,
): BodyRow<T>[] {
  const out: BodyRow<T>[] = []
  let curFloor: string | null = null
  let bucket: string[] = []

  const flush = () => {
    if (curFloor === null || bucket.length === 0) return
    out.push({ kind: 'subtotal', floor: curFloor, shift: 'D', ids: [...bucket] })
    out.push({ kind: 'subtotal', floor: curFloor, shift: 'N', ids: [...bucket] })
  }

  for (const p of list) {
    if (!isCaregiver(p.pos)) {      // 층과 무관한 직종
      out.push({ kind: 'person', p })
      continue
    }
    const f = (p.floor || '').trim()
    if (curFloor !== null && f !== curFloor) { flush(); bucket = [] }
    curFloor = f
    bucket.push(p.id)
    out.push({ kind: 'person', p })
  }
  flush()
  return out
}
