/** 남녀를 색으로 가른다 — 화면과 종이가 같은 색을 쓰게.
 *
 *  방을 훑을 때 성별이 한눈에 보여야 한다. 새로 오실 분을 어느 방에 넣을지
 *  정할 때 남녀를 잘못 보면 방을 다시 옮겨야 하고, 그건 어르신께 부담이다.
 *
 *  색을 여기 한 곳에만 둔다. 화면과 인쇄에 따로 적으면 나중에 한쪽만
 *  고쳐져서 벽에 붙인 종이와 화면의 색이 달라진다.
 *
 *  성별이 비어 있는 분이 실제로 있다(수급자 관리에서 안 고른 경우).
 *  그런 방은 회색으로 두어 '아직 안 정해졌다'가 보이게 한다 —
 *  임의로 한쪽 색을 칠하면 틀린 정보를 사실처럼 보여주는 것이 된다.
 */

export type Gender = 'male' | 'female' | ''

export function normGender(v: unknown): Gender {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'male' || s === 'm' || s === '남' || s === '남자') return 'male'
  if (s === 'female' || s === 'f' || s === '여' || s === '여자') return 'female'
  return ''
}

/** 방 하나의 성별 — 그 방에 계신 분들로 정한다.
 *
 *  섞여 있으면 '모름'으로 둔다. 한쪽 색을 칠하면 다른 성별 어르신이
 *  그 방에 계신다는 사실이 색에 묻힌다.
 */
export function roomGender(genders: unknown[]): Gender {
  const set = new Set(genders.map(normGender).filter(Boolean))
  if (set.size === 1) return [...set][0] as Gender
  return ''
}

/** 화면용 — Tailwind 클래스 */
export const TONE = {
  male:   { row: 'bg-sky-50/70',  room: 'bg-sky-100 text-sky-800 border-sky-200',
            dot: 'bg-sky-500',   label: '남' },
  female: { row: 'bg-rose-50/60', room: 'bg-rose-100 text-rose-800 border-rose-200',
            dot: 'bg-rose-400',  label: '여' },
  '':     { row: '',              room: 'bg-gray-100 text-gray-500 border-gray-200',
            dot: 'bg-gray-300',  label: '—' },
} as const

/** 인쇄용 — 흑백 프린터에서도 구분되게 색과 함께 글자를 남긴다.
 *
 *  색만으로 나누면 흑백으로 뽑았을 때 둘이 같은 회색이 된다. 그래서 호실
 *  옆에 남/여 글자를 함께 찍는다. 색은 옅게 — 진하면 성함이 안 읽힌다.
 */
export const PRINT_TONE = {
  male:   { bg: '#eff6ff', band: '#bfdbfe', ink: '#1e40af', label: '남' },
  female: { bg: '#fff1f2', band: '#fecdd3', ink: '#9f1239', label: '여' },
  '':     { bg: '#f8fafc', band: '#e2e8f0', ink: '#64748b', label: '' },
} as const
