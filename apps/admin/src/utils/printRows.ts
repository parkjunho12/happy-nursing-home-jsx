/** 게시용 인쇄에서 어떤 요약 줄을 뺄지.
 *
 *  근무표를 벽에 붙일 때 일부만 골라 뽑는 일이 많다. 간호팀만, 사회복지팀만
 *  뽑는 경우도 있는데, 그때 '요양보호사 주간 인원 0 0 0 0 …' 같은 줄이 함께
 *  나가면 벽보에 0만 늘어선 줄이 붙는다. 읽는 사람은 그날 아무도 안 나온
 *  줄로 읽는다.
 *
 *  그래서 뽑는 대상에 요양보호사가 없으면 그 줄들을 뺀다.
 */

/** 인쇄 대상에 요양보호사가 한 명이라도 있는가.
 *
 *  pick 이 null 이면 전원 인쇄다 — 고르지 않았다는 뜻이지 아무도 없다는
 *  뜻이 아니다. 그때는 명단에 요양보호사가 있는지만 본다.
 */
export function printHasCaregiver<T extends { id: string; pos?: string | null }>(
  list: T[],
  pick: Set<string> | null,
  isCaregiver: (pos?: string | null) => boolean,
): boolean {
  return list.some(s => (!pick || pick.has(s.id)) && isCaregiver(s.pos))
}

/** 이 층 소계 줄을 인쇄에 낼지 — 그 층 사람 중 한 명이라도 뽑히면 낸다.
 *
 *  2층만 뽑는데 3층 소계가 0으로 따라 나가면 안 된다. 층마다 따로 본다.
 */
export function printHasAnyOf(ids: string[], pick: Set<string> | null): boolean {
  return !pick || ids.some(id => pick.has(id))
}

/** 층별 인원 줄을 인쇄에 낼지.
 *
 *  그 층 요양보호사가 인쇄물에 없으면 그 줄의 숫자는 실제 인원이 아니다.
 *  3층만 뽑았는데 '2층 주간 인원 1 1 2 …' 가 붙으면, 읽는 사람은 2층에
 *  한두 명만 있는 것으로 읽는다. 실제로는 대여섯 명이 있다. 벽에 붙는
 *  문서에 그런 숫자가 적히면 안 된다.
 *
 *  그 층에 요양보호사가 아예 없는 경우(사무직만 있는 층 등)에는 그 층
 *  사람이 한 명이라도 뽑혔는지로 본다 — 없는 기준으로 줄을 지울 수는 없다.
 */
export function printFloorRow<T extends { id: string; pos?: string | null; floor?: string | null }>(
  list: T[],
  floor: string,
  pick: Set<string> | null,
  isCaregiver: (pos?: string | null) => boolean,
): boolean {
  const onFloor = list.filter(s => (s.floor ?? '') === floor)
  const caregivers = onFloor.filter(s => isCaregiver(s.pos))
  const target = caregivers.length ? caregivers : onFloor
  return printHasAnyOf(target.map(s => s.id), pick)
}
