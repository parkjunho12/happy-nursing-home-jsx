/** 응급벨 칸에 넣을 어르신 고르기.
 *
 *  이름을 직접 치면 오타가 난다. 응급 상황에 헛사람을 찾게 된다.
 *  그래서 수급자 관리에 있는 분들 중에서 고르게 한다.
 *
 *  호실 표기가 두 곳에서 다르다 — 수급자 관리는 '301', 응급벨은 '301호'.
 *  그냥 비교하면 어느 방 어르신인지 영영 못 찾는다.
 */

export interface ResidentLike { name: string; floor?: string | null; room?: string | null }

/** '301호' / ' 301 ' / 301 → '301' */
export function roomKey(v: unknown): string {
  return String(v ?? '').trim().replace(/호/g, '').trim()
}

/** 이 벨 자리에 고를 만한 순서로 어르신을 늘어놓는다.
 *
 *  ① 같은 방  ② 같은 층  ③ 나머지
 *  같은 방이 맨 앞이라 대개 첫 두세 명 안에서 끝난다.
 */
export function pickOrder<T extends ResidentLike>(
  residents: T[], floor: string, room: string,
): T[] {
  const rk = roomKey(room)
  const rank = (r: T) => {
    if (rk && roomKey(r.room) === rk) return 0
    if (floor && (r.floor ?? '') === floor) return 1
    return 2
  }
  return [...residents].sort((a, b) =>
    rank(a) - rank(b) || (a.name || '').localeCompare(b.name || '', 'ko'))
}

/** 이 방에 계신데 아직 어느 벨에도 안 넣은 분.
 *
 *  빠뜨리면 그분 자리만 배치도에 비어 있게 된다. 입·퇴소가 잦아서
 *  사람이 눈으로 맞추다 보면 반드시 하나씩 샌다.
 */
export function missingInRoom<T extends ResidentLike>(
  residents: T[], floor: string, room: string, assignedNames: string[],
): T[] {
  const rk = roomKey(room)
  const used = new Set(assignedNames.map(n => (n || '').trim()).filter(Boolean))
  return residents.filter(r =>
    (r.floor ?? '') === floor && roomKey(r.room) === rk && !used.has((r.name || '').trim()))
}

/** 적힌 이름이 수급자 명단에 없는 것들 — 오타이거나 퇴소한 분이다 */
export function unknownNames<T extends ResidentLike>(
  residents: T[], names: string[],
): string[] {
  const known = new Set(residents.map(r => (r.name || '').trim()))
  return [...new Set(names.map(n => (n || '').trim()).filter(n => n && !known.has(n)))]
}
