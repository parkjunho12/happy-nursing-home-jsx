/** 응급벨 배치도의 방 묶기.
 *
 *  배치도는 방을 카드 하나로 그린다. 카드 안에 그 방 벨이 번호순으로 들어간다.
 *
 *  까다로운 것은 두 방이 함께 쓰는 화장실이다. 벨은 한 방에만 달려 있지만
 *  두 방 어르신이 다 쓰므로, 배치도에서는 두 방 카드에 모두 보여야 한다.
 *  벨이 안 달린 쪽 카드에는 '몇 번 화장실을 옆방과 함께 쓴다'는 안내만 넣는다.
 *  그게 없으면 그 방 선생님은 화장실 벨이 울렸을 때 자기 방인 줄 모른다.
 */

export interface BellLike {
  id: string
  no: number
  room: string
  kind: string
  note?: string | null
  is_wc: boolean
}

export interface RoomCard<T extends BellLike> {
  room: string
  bells: T[]
  /** 옆방에 달린, 함께 쓰는 화장실 — 안내만 보여준다 */
  sharedRef: { no: number; withRoom: string } | null
  /** 카드 머리에 적을 번호 목록 (안내용 화장실 번호까지 포함) */
  numbers: number[]
}

/** '201호 ↔ 202호' 에서 두 방 이름을 뽑는다. 형식이 아니면 빈 배열 */
export function sharedRooms(note?: string | null): string[] {
  const m = /([\w가-힣]+호)\s*↔\s*([\w가-힣]+호)/.exec(note ?? '')
  return m ? [m[1], m[2]] : []
}

export function buildRoomCards<T extends BellLike>(bells: T[]): RoomCard<T>[] {
  const order: string[] = []
  const byRoom = new Map<string, T[]>()
  for (const b of [...bells].sort((a, b2) => a.no - b2.no)) {
    if (!byRoom.has(b.room)) { byRoom.set(b.room, []); order.push(b.room) }
    byRoom.get(b.room)!.push(b)
  }

  // 함께 쓰는 화장실 → 벨이 안 달린 쪽 방에 안내를 붙인다
  const refs = new Map<string, { no: number; withRoom: string }>()
  for (const b of bells) {
    if (!b.is_wc) continue
    const pair = sharedRooms(b.note)
    if (pair.length !== 2) continue
    const other = pair.find(r => r !== b.room)
    if (other && other !== b.room) refs.set(other, { no: b.no, withRoom: b.room })
  }

  return order.map(room => {
    const list = byRoom.get(room)!
    const ref = refs.get(room) ?? null
    const nums = [...list.map(b => b.no), ...(ref ? [ref.no] : [])].sort((a, b2) => a - b2)
    return { room, bells: list, sharedRef: ref, numbers: nums }
  })
}

/** 한 장에 넣을 방의 최대 개수.
 *
 *  원본 배치도가 6개까지 넣고 있었다(306·307·308·309·310·공용). A4 가로에서
 *  그 폭이 실제로 쓸 만하다는 뜻이라 같은 값을 쓴다.
 */
export const MAX_ROOMS_PER_PAGE = 6

/** 방 카드를 쪽으로 나눈다 — 고르게.
 *
 *  앞에서부터 6개씩 자르면 11개일 때 6·5 가 아니라 6·5 가 되지만, 10개일 때는
 *  6·4 가 되어 뒷장이 휑해진다. 벽에 나란히 붙이는 문서라 두 장의 무게가
 *  비슷해야 보기 좋다. 그래서 장수를 먼저 정하고 고르게 나눈다.
 *
 *    11개 → 2장(6·5)   10개 → 2장(5·5)   6개 이하 → 1장
 */
export function splitPages<T>(cards: T[], maxPerPage = MAX_ROOMS_PER_PAGE): T[][] {
  if (cards.length === 0) return []
  const pages = Math.max(1, Math.ceil(cards.length / maxPerPage))
  const base = Math.floor(cards.length / pages)
  const extra = cards.length % pages          // 앞장부터 한 개씩 더 가져간다
  const out: T[][] = []
  let i = 0
  for (let p = 0; p < pages; p++) {
    const n = base + (p < extra ? 1 : 0)
    out.push(cards.slice(i, i + n))
    i += n
  }
  return out
}
