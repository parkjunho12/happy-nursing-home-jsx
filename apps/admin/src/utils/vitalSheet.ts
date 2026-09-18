/** 층별 바이탈·체온 점검표 — 종이에 낼 줄을 만든다.
 *
 *  간호팀이 쓰던 엑셀(「어르신 체온점검(각층) 건강모니터링.xlsx」)을 그대로
 *  옮긴 것이다. 그 표는 호실마다 정원만큼 줄을 두고(4인실 네 줄, 2인실 두 줄)
 *  계신 분 성함을 위에서부터 적고 나머지는 비워 둔다. 아무도 안 계신 방도
 *  줄은 그대로 있다 — 새로 오신 분을 손으로 적어 넣을 자리다.
 *
 *  명단은 「담당 어르신 명단」과 같은 데이터에서 온다. 따로 적으면 호실을
 *  옮긴 뒤 한쪽만 고쳐져서 종이와 명단이 달라진다.
 */

export interface SheetResident {
  name: string
  floor: string
  room: string
  admission_date?: string | null
}

export interface SheetRoomInfo { room: string; capacity: number }

export interface SheetRoom {
  room: string        // '' = 호실 없음
  names: string[]
  rows: number        // 종이에 낼 줄 수 — 정원과 인원 중 큰 쪽
}

/** 한 층의 호실 줄.
 *
 *  - 호실 순서는 방 설정(정원 목록) 순서를 따르고, 설정에 없는 방은 뒤에 번호순.
 *  - 줄 수는 정원. 정원보다 많이 계시면 그 수만큼(넘친 분이 빠지면 안 된다).
 *  - 정원이 없고 아무도 없는 방은 내지 않는다 — 줄 하나짜리 빈 방은 의미가 없다.
 *  - cutoff 뒤에 오시는 분(입소 예정)은 뺀다 — 아직 그 방에 안 계신다.
 *  - 이 층인데 호실이 없는 분은 맨 뒤 '호실 없음' 묶음으로. 조용히 빠지면
 *    그분만 점검에서 빠진다.
 */
export function buildSheetRooms(
  floor: string,
  residents: SheetResident[],
  rooms: SheetRoomInfo[],
  cutoff: string,
): SheetRoom[] {
  const here = residents.filter(r => r.floor === floor && (r.admission_date ?? '') <= cutoff)
  const capOf = new Map(rooms.map(r => [r.room, r.capacity]))
  const order = [
    ...rooms.map(r => r.room),
    ...[...new Set(here.map(r => r.room).filter(Boolean))]
      .filter(r => !capOf.has(r))
      .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })),
  ]
  const out: SheetRoom[] = []
  for (const room of order) {
    const names = here.filter(r => r.room === room).map(r => r.name)
    const rows = Math.max(capOf.get(room) ?? 0, names.length)
    if (rows === 0) continue
    out.push({ room, names, rows })
  }
  const noRoom = here.filter(r => !r.room).map(r => r.name)
  if (noRoom.length) out.push({ room: '', names: noRoom, rows: noRoom.length })
  return out
}

/** 한 장에 못 담으면 방 단위로 나눈다 — 한 방이 두 장에 걸치면 안 된다.
 *  나눌 때는 고르게. 마지막 장에 두 줄만 남으면 보기 안 좋다. */
export function chunkSheetRooms(rooms: SheetRoom[], maxRows: number): SheetRoom[][] {
  const total = rooms.reduce((s, r) => s + r.rows, 0)
  if (total <= maxRows) return [rooms]
  const pages = Math.ceil(total / maxRows)
  const per = Math.ceil(total / pages)
  const out: SheetRoom[][] = []
  let cur: SheetRoom[] = []; let n = 0
  for (const r of rooms) {
    if (n > 0 && n + r.rows > per) { out.push(cur); cur = []; n = 0 }
    cur.push(r); n += r.rows
  }
  if (cur.length) out.push(cur)
  return out
}

/** 날짜 줄 — 엑셀처럼 '2026.  9.    .' 로 두고 일은 손으로 적게 할 수 있다.
 *  한 달치를 미리 뽑아 두고 그날그날 일자만 적는 것이 현장 습관이다. */
export function sheetDateLine(ym: string, day: string): string {
  const [y, m] = ym.split('-')
  const mm = String(Number(m || 0) || '')
  const dd = day ? String(Number(day)) : '      '
  return `${y}.  ${mm}.  ${dd}.`
}

/** 입소 예정을 가르는 날 — 일자를 찍으면 그날, 일을 비워 두면 그 달 말일.
 *  한 달치를 뽑는 종이에 이달 중순에 오실 분이 빠져 있으면 다시 뽑아야 한다. */
export function sheetCutoff(ym: string, day: string): string {
  if (day) return `${ym}-${String(Number(day)).padStart(2, '0')}`
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}
