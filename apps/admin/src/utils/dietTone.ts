/**
 * 식이 색 — 한 곳에서만 정한다.
 *
 * 색을 고른 기준은 '손이 더 가는 쪽일수록 눈에 띄게' 다.
 * 일반식·일반찬은 회색으로 가라앉히고, 죽·미음·갈찬처럼 삼킴이 어려워
 * 조정한 것은 색을 준다. 36명 중 눈이 찾아야 하는 것은 그 몇 명이다.
 *
 * 인쇄는 흑백으로 나갈 수 있어 글자를 함께 적는다 — 색만으로 구분하지 않는다.
 */
export interface Tone { chip: string; dot: string; text: string }

export const RICE_TONE: Record<string, Tone> = {
  일반식: { chip: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400', text: 'text-gray-600' },
  당뇨식: { chip: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', text: 'text-indigo-700' },
  죽:     { chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', text: 'text-amber-800' },
  미음:   { chip: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500', text: 'text-rose-700' },
}

export const SIDE_TONE: Record<string, Tone> = {
  일반찬: { chip: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400', text: 'text-gray-600' },
  다진찬: { chip: 'bg-teal-100 text-teal-700 border-teal-200', dot: 'bg-teal-500', text: 'text-teal-700' },
  갈찬:   { chip: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500', text: 'text-violet-700' },
}

export const TUBE_TONE: Tone =
  { chip: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500', text: 'text-sky-700' }

export const UNSET_TONE: Tone =
  { chip: 'bg-white text-red-500 border-red-300 border-dashed', dot: 'bg-red-400', text: 'text-red-500' }

export const toneOf = (rice?: string | null, side?: string | null, tube?: boolean): Tone => {
  if (tube) return TUBE_TONE
  if (rice && RICE_TONE[rice]) return RICE_TONE[rice]
  if (side && SIDE_TONE[side]) return SIDE_TONE[side]
  return UNSET_TONE
}

/** 한 줄로 읽는 식이 — 이력·인쇄·알림에 같은 말이 나가도록 */
export const dietLabel = (rice?: string | null, side?: string | null, tube?: boolean): string => {
  if (tube) return '경관식'
  const parts = [rice, side].filter(Boolean)
  return parts.length ? parts.join(' · ') : '미정'
}
