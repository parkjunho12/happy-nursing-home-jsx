/** 수급자 목록의 순서와 찾기.
 *
 *  기본은 최근 입소 순이다. 새로 오신 분이 목록 맨 위에 있어야 한다 —
 *  서류도 체크리스트도 갓 입소하신 분에게 할 일이 가장 많고, 그분을 찾으려고
 *  일흔 명짜리 목록을 훑어 내리는 것이 실제로 가장 잦은 일이었다.
 *
 *  ㄱㄴㄷ 순은 성함을 알고 찾을 때 쓴다. 두 순서 모두 필요해서 버튼으로 둔다.
 */

export type ResidentSort = 'admission' | 'name'

export interface SortableResident {
  name: string
  admissionDate?: string | null
  floor?: string | null
  room?: string | null
}

/** 성함 ㄱㄴㄷ — 한글 순서는 브라우저 로캘에 맡긴다. */
const byName = (a: SortableResident, b: SortableResident) =>
  a.name.localeCompare(b.name, 'ko')

/** 목록 순서.
 *
 *  최근 입소 순에서 입소일이 없는 분은 맨 아래로 둔다. 빈 값을 최신으로 치면
 *  아직 입소일을 안 적은 분이 맨 위에 올라와 새로 오신 분을 가린다.
 *  같은 날 입소하신 분끼리는 ㄱㄴㄷ 순 — 새로고침할 때마다 순서가 바뀌면
 *  아까 본 자리에 다시 없다.
 */
export function sortResidents<T extends SortableResident>(list: T[], sort: ResidentSort): T[] {
  const out = [...list]
  if (sort === 'name') return out.sort(byName)
  return out.sort((a, b) => {
    const da = a.admissionDate || ''
    const db = b.admissionDate || ''
    if (!da && !db) return byName(a, b)
    if (!da) return 1
    if (!db) return -1
    return db.localeCompare(da) || byName(a, b)
  })
}

/** 찾기 — 성함·호실·층으로.
 *
 *  '305' 로도 '305호' 로도 찾히게 한다. 직원들은 어르신을 호실로 부르는 일이
 *  많아 성함만으로 찾게 하면 반쯤은 못 찾는다. 띄어쓰기는 무시한다.
 */
export function matchResident(r: SortableResident, q: string): boolean {
  const s = q.replace(/\s/g, '')
  if (!s) return true
  const room = (r.room ?? '').replace(/호$/, '')
  return [r.name, room, `${room}호`, r.floor ?? '', `${r.floor ?? ''}${room}`]
    .some(v => v.replace(/\s/g, '').includes(s))
}
