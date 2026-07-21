/**
 * 생일 → 달력 이벤트 변환.
 *
 * 생년월일(1940-05-12)은 한 번이지만 달력에는 매년 나타나야 한다.
 * 보이는 기간에 걸친 연도마다 해당 월·일을 만들어 돌려준다.
 * 2월 29일생은 평년에는 2월 28일에 표시한다(생략되면 4년에 한 번만 축하받게 된다).
 */
export interface BirthdayPerson {
  id: string
  name: string
  birthDate?: string | null   // 'YYYY-MM-DD'
  status?: string
}

export interface BirthdayEvent {
  key: string
  dateKey: string             // 이번에 표시할 날짜 'YYYY-MM-DD'
  name: string
  age: number                 // 그날 만 나이 (그해 - 출생년)
  kind: 'resident' | 'staff'
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export function birthdaysInRange(
  people: BirthdayPerson[],
  startISO: string,
  endISO: string,
  kind: 'resident' | 'staff',
): BirthdayEvent[] {
  const out: BirthdayEvent[] = []
  const y0 = Number(startISO.slice(0, 4))
  const y1 = Number(endISO.slice(0, 4))
  for (const p of people) {
    if (p.status && p.status !== 'active') continue
    const bd = (p.birthDate ?? '').trim()
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(bd)
    if (!m) continue
    const [, by, bm, bdd] = m
    for (let y = y0; y <= y1; y++) {
      let day = bdd
      if (bm === '02' && bdd === '29' && !isLeap(y)) day = '28'   // 평년엔 2/28
      const dateKey = `${y}-${bm}-${day}`
      if (dateKey < startISO || dateKey > endISO) continue
      out.push({
        key: `bday-${kind}-${p.id}-${y}`,
        dateKey, name: p.name,
        age: y - Number(by),
        kind,
      })
    }
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}
