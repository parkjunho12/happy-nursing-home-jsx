/**
 * 성별 표기.
 *
 * 값은 'female' | 'male' | '' 세 가지다. 빈 값은 '아직 모른다' 는 뜻이다 —
 * 입소 예정자를 간단 등록하면 성별을 나중에 채우기 때문이다.
 *
 * 이걸 한곳에 모아둔 이유: 화면마다 `gender === 'female' ? '여' : '남'` 로
 * 적혀 있었다. 그러면 모르는 값이 전부 '남' 으로 보인다. 실제로 간단 등록한
 * 어르신이 모두 남자로 표시됐다. 모르면 모른다고 해야 한다 — 잘못 아는 것이
 * 모르는 것보다 나쁘다.
 */

export type Gender = string | null | undefined

export const GENDER_UNKNOWN = '—'

export function genderLabel(g: Gender): string {
  if (g === 'female') return '여'
  if (g === 'male') return '남'
  return GENDER_UNKNOWN
}

/** 이름 첫 글자 동그라미의 색 — 모르면 회색 */
export function genderAvatarClass(g: Gender): string {
  if (g === 'female') return 'bg-pink-100 text-pink-700'
  if (g === 'male') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-500'
}

/** 성별을 아직 모르는가 */
export function genderUnknown(g: Gender): boolean {
  return g !== 'female' && g !== 'male'
}
