/**
 * 근무표 형광펜 — 순수 규칙.
 *
 * 근무표는 벽에 붙인 뒤에도 바뀐다. 2일 근무가 바뀌고, 누가 대휴를 당겼다.
 * 다시 붙여도 지난달과 똑같이 생긴 표에서 어디가 달라졌는지 아무도 못 찾는다.
 * 종이라면 형광펜으로 긋는다 — 그것을 그대로 옮긴 것이다.
 *
 * 근무 코드(data)와 섞지 않는다. 시간 계산·자동 편성·되돌리기가 전부 그 값을
 * 읽는다. 서버(work_schedule_highlight.py)와 규칙이 같아야 벽보(엑셀)와 화면이
 * 다른 칸을 가리키지 않는다 — 특히 "칸 표시가 날 전체 표시를 이긴다".
 */

export type HlColor = 'yellow' | 'pink' | 'green'
export const HL_COLORS: readonly HlColor[] = ['yellow', 'pink', 'green'] as const

export interface Highlight {
  staff_id: string      // '' = 그 날 전체(열)
  day: number
  color: HlColor
  note: string
  updated_by?: string | null
  updated_at?: string | null
}

/** 화면 표시용 — 형광펜 느낌은 반투명 덧칠(multiply)로 낸다. 근무 색 위에 그어도 근무 색이 남는다. */
export const HL_STYLE: Record<HlColor, { label: string; tint: string; ink: string; swatch: string }> = {
  yellow: { label: '노랑', tint: 'rgba(250, 204, 21, .55)', ink: '#a16207', swatch: 'bg-yellow-300' },
  pink:   { label: '분홍', tint: 'rgba(244, 114, 182, .45)', ink: '#be185d', swatch: 'bg-pink-300' },
  green:  { label: '초록', tint: 'rgba(74, 222, 128, .5)',   ink: '#15803d', swatch: 'bg-green-300' },
}

export const isHlColor = (c: unknown): c is HlColor => typeof c === 'string' && (HL_COLORS as readonly string[]).includes(c)

/** '<staff_id>:<day>' — 열이면 ':<day>'. 서버 key_of 와 같다. */
export const hlKey = (staffId: string | null | undefined, day: number) => `${(staffId ?? '').trim()}:${day}`

export type HlMap = Record<string, Highlight>

export const toHlMap = (list: Highlight[]): HlMap =>
  Object.fromEntries(list.map(h => [hlKey(h.staff_id, h.day), h]))

/** 그 칸에 실제로 보일 형광펜 — 칸 표시가 있으면 그것, 없으면 그 날 열 표시. */
export function hlOf(map: HlMap, staffId: string, day: number): Highlight | undefined {
  return map[hlKey(staffId, day)] ?? map[hlKey('', day)]
}

/** 그 칸에 "직접" 그은 것만 (열 표시는 빼고) — 지우개가 열까지 지우면 안 된다. */
export const hlOwn = (map: HlMap, staffId: string, day: number): Highlight | undefined => map[hlKey(staffId, day)]

/**
 * 한 칸을 칠했을 때 다음 상태.
 *
 * 같은 색을 다시 칠하면 지운다 — 형광펜 하나로 긋고 지우는 편이 도구를 바꾸는
 * 것보다 빠르다. 다른 색이면 색만 바꾸고 이유는 남긴다(이유는 색이 아니라 칸에
 * 붙은 것이다). color 가 null 이면 지우개.
 */
/** 서버로 보내는 한 칸 — color '' 는 지우기 */
export type HlItem = { staff_id: string; day: number; color: HlColor | ''; note: string }

export function paintHl(
  map: HlMap, staffId: string, day: number, color: HlColor | null,
): { map: HlMap; item: HlItem } {
  const key = hlKey(staffId, day)
  const cur = map[key]
  const next = { ...map }
  if (color === null || (cur && cur.color === color && !cur.note)) {
    delete next[key]
    return { map: next, item: { staff_id: (staffId ?? '').trim(), day, color: '', note: '' } }
  }
  const item: Highlight = { staff_id: (staffId ?? '').trim(), day, color, note: cur?.note ?? '' }
  next[key] = item
  return { map: next, item }
}

/** 이유만 바꾼다. 표시가 없던 칸에 이유를 적으면 노랑으로 긋는다. 이유를 비우면 표시는 남는다. */
export function noteHl(map: HlMap, staffId: string, day: number, note: string): { map: HlMap; item: Highlight } {
  const key = hlKey(staffId, day)
  const cur = map[key]
  const item: Highlight = { staff_id: (staffId ?? '').trim(), day, color: cur?.color ?? 'yellow', note: note.trim().slice(0, 200) }
  return { map: { ...map, [key]: item }, item }
}

/** 표 아래 범례 — 이유 적은 것만. 날짜 순, 같은 날은 '전체' 먼저. 서버 legend_lines 와 같다. */
export function hlLegend(map: HlMap, names: Record<string, string>): { key: string; day: number; who: string; note: string; color: HlColor }[] {
  return Object.values(map)
    .filter(h => (h.note ?? '').trim())
    .map(h => ({
      key: hlKey(h.staff_id, h.day), day: h.day, color: h.color,
      who: h.staff_id === '' ? '전체' : (names[h.staff_id] ?? '(퇴사)'),
      note: h.note.trim(),
      _col: h.staff_id === '' ? 0 : 1,
    }))
    .sort((a, b) => a.day - b.day || a._col - b._col || a.note.localeCompare(b.note, 'ko'))
    .map(({ _col: _, ...r }) => r)
}

/** 눈에 띄는 표시 개수 — 툴바 배지용 */
export const hlCount = (map: HlMap) => Object.keys(map).length
