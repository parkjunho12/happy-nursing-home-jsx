/**
 * 식이 색 — 한 곳에서만 정한다.
 *
 * 색을 고른 기준은 '손이 더 가는 쪽일수록 눈에 띄게' 다.
 * 일반식·일반찬은 회색으로 가라앉히고, 죽·미음·갈찬처럼 삼킴이 어려워
 * 조정한 것은 색을 준다. 36명 중 눈이 찾아야 하는 것은 그 몇 명이다.
 *
 * 인쇄는 흑백으로 나갈 수 있어 글자를 함께 적는다 — 색만으로 구분하지 않는다.
 */
/** 밥·반찬 종류 — 백엔드(diet_state.py)와 같은 차례·같은 말.
 *  화면이 목록을 받기 전에도 버튼을 그릴 수 있게 여기에도 둔다. 값 검사는 서버가 한다. */
export const RICE_TYPES = ['일반식', '당뇨식', '죽', '미음']
export const SIDE_TYPES = ['일반찬', '다진찬', '갈찬']

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

/**
 * 언제 적었는가 — 이력에 붙이는 시각.
 *
 * 적용일(effective_date)과 적은 시각(created_at)은 다르다. 오늘 오후에
 * 적으면서 '내일부터' 로 잡을 수 있다. 이력에서 둘이 구분되지 않으면
 * "그래서 언제 결정한 거냐" 를 다시 물어봐야 한다.
 *
 * 서버는 KST 로 적어 보내지만, 보는 사람의 시계가 다른 곳에 맞춰져 있어도
 * 같은 시각이 보이도록 서울 시간으로 못박아 표시한다.
 */
export const fmtStamp = (iso?: string | null, opts?: { withDate?: boolean }): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  // ko-KR 로 날짜를 맡기면 '9. 11.' 처럼 점이 붙는다 — 화면의 다른 날짜(9/11)와 어긋난다.
  // 그래서 조각을 받아 우리가 붙인다.
  const part = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(d).reduce<Record<string, string>>((a, x) => (a[x.type] = x.value, a), {})
  // 자정은 '24' 로 오는 환경이 있다 — 0 으로 되돌린다
  const hh = part.hour === '24' ? '00' : part.hour
  const time = `${hh}:${part.minute}`
  if (!opts?.withDate) return time
  return `${Number(part.month)}/${Number(part.day)} ${time}`
}

/** 적은 날이 적용일과 다른가 — 다르면 이력에 날짜까지 적는다 */
export const stampedOnAnotherDay = (iso?: string | null, effective?: string | null): boolean => {
  if (!iso || !effective) return false
  const d = new Date(iso)
  if (isNaN(d.getTime())) return false
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d)  // YYYY-MM-DD
  return ymd !== effective
}
