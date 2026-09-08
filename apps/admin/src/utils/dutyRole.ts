/** 정기 업무를 '누가' 아니라 '어느 직종이' 하는 일로 보여준다.
 *
 *  ■ 왜 이름이 아니라 직종인가
 *
 *    담당자 이름을 적어 두면 그분이 퇴사하거나 담당이 바뀔 때마다 목록이
 *    틀린 정보가 된다. '이건 간호팀이 하는 일' 은 사람이 바뀌어도 그대로다.
 *    새로 오신 분도 목록만 보고 자기 일을 안다.
 *
 *  ■ 어떻게 정하는가 — 순서대로
 *
 *    ① 직원 명단에 있는 이름이면 그분의 직종을 쓴다 (가장 정확하다)
 *    ② 이미 직종처럼 적혀 있으면 그대로 쓴다 ('간호사', '시설장' …)
 *    ③ 둘 다 아니면 업무 이름에서 미룬다 (퇴사자·계정명이 적힌 경우)
 *
 *    ③은 짐작이다. 그래서 화면에서 옅게 표시하고, 확실한 것과 구분한다 —
 *    짐작을 사실처럼 보여주면 그걸 믿고 일하게 된다.
 */

/** 화면에 쓰는 직종. 시설의 실제 직종(요양보호사·간호팀장·사회복지사·
 *  물리치료사·작업치료사·시설장)에 행정·영양처럼 사람은 없지만 일은 있는
 *  묶음을 더한 것이다. */
export const DUTY_ROLES = [
  '시설장', '사회복지사', '간호팀', '요양보호사', '물리·작업치료',
  '영양·조리', '사무·회계', '안전관리', '전체',
] as const
export type DutyRole = typeof DUTY_ROLES[number]

export const ROLE_TONE: Record<string, string> = {
  '시설장':        'bg-gray-800 text-white',
  '사회복지사':    'bg-teal-100 text-teal-800',
  '간호팀':        'bg-rose-100 text-rose-800',
  '요양보호사':    'bg-amber-100 text-amber-800',
  '물리·작업치료': 'bg-blue-100 text-blue-800',
  '영양·조리':     'bg-lime-100 text-lime-800',
  '사무·회계':     'bg-violet-100 text-violet-800',
  '안전관리':      'bg-orange-100 text-orange-800',
  '전체':          'bg-gray-100 text-gray-600',
}

/** 직원 명단의 직종 → 화면 직종 */
function fromPosition(pos?: string | null): DutyRole | null {
  const p = (pos ?? '').replace(/\s/g, '')
  if (!p) return null
  if (p === '시설장' || p === '대표' || p === '이사') return '시설장'
  if (p === '사회복지사') return '사회복지사'
  if (p.startsWith('간호')) return '간호팀'
  if (p.includes('요양보호') || p === '요양팀장') return '요양보호사'
  if (p === '물리치료사' || p === '작업치료사') return '물리·작업치료'
  if (p === '영양사' || p === '조리원' || p === '위생원') return '영양·조리'
  if (p === '사무원') return '사무·회계'
  return null
}

/** 담당자 칸에 이미 직종처럼 적혀 있는 경우 */
function fromLabel(v?: string | null): DutyRole | null {
  const s = (v ?? '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes('시설장')) return '시설장'
  if (s.includes('사회복지')) return '사회복지사'
  if (s.startsWith('간호')) return '간호팀'
  if (s.includes('요양보호')) return '요양보호사'
  if (s.includes('물리') || s.includes('작업치료')) return '물리·작업치료'
  if (s.includes('영양') || s.includes('급식') || s.includes('조리')) return '영양·조리'
  if (s.includes('사무') || s.includes('회계') || s.includes('행정')) return '사무·회계'
  if (s.includes('안전') || s.includes('소방') || s.includes('시설관리')) return '안전관리'
  if (s.includes('개인정보')) return '사무·회계'
  if (s === '전체' || s === '전직원') return '전체'
  return null
}

/** 업무 이름으로 미룬다 — 위 둘로 안 풀릴 때만.
 *
 *  앞에 오는 규칙이 이긴다. '투약' 이 '기록' 보다 앞에 있어야
 *  '수급자 투약 기록' 이 사무가 아니라 간호팀으로 간다.
 */
const BY_TITLE: [string[], DutyRole][] = [
  [['투약', '욕창', '체위변경', '감염', '예방접종', '건강검진', '혈압', '의료', '응급', '흡인', '경관', '구강건강'], '간호팀'],
  [['급여', '수가', '이체', '소득세', '회계', '영수증', '통장', '납부', '퇴직연금', '본인부담', '정산', '계약서', '비용'], '사무·회계'],
  [['소방', '전기', '가스', '승강기', '재난', '대피', '안전점검', '시설안전', '위험'], '안전관리'],
  [['식단', '급식', '영양', '조리', '식자재', '위생', '검식', '배식'], '영양·조리'],
  [['재활', '물리치료', '작업치료', '보행', '운동프로그램'], '물리·작업치료'],
  [['인권', '학대', '상담', '사례관리', '프로그램', '만족도', '고충', '자원봉사', '보호자', '교육'], '사회복지사'],
  [['목욕', '기저귀', '체위', '식사보조', '이동보조'], '요양보호사'],
  [['운영위원회', '규정', '인사', '평가', '위원회'], '시설장'],
]

function fromTitle(title?: string | null): DutyRole | null {
  const t = (title ?? '')
  for (const [words, role] of BY_TITLE) {
    if (words.some(w => t.includes(w))) return role
  }
  return null
}

export interface DutyGuess {
  role: DutyRole
  /** 짐작인가 — 화면에서 옅게 보여 확실한 것과 구분한다 */
  guessed: boolean
}

/** 이 업무는 어느 직종이 하는가.
 *
 *  staffPos: 직원 이름 → 직종 (수급자 관리의 직원 명단에서 만든다)
 */
export function dutyRoleOf(
  item: { title?: string | null; assignee?: string | null },
  staffPos: Map<string, string>,
): DutyGuess {
  const name = (item.assignee ?? '').trim()

  // ① 실제 직원이면 그분 직종 — 가장 정확하다
  const byStaff = fromPosition(staffPos.get(name))
  if (byStaff) return { role: byStaff, guessed: false }

  // ② 이미 직종처럼 적혀 있으면 그대로
  const byLabel = fromLabel(name)
  if (byLabel) return { role: byLabel, guessed: false }

  // ③ 업무 이름에서 미룬다 — 짐작임을 표시한다
  const byTitle = fromTitle(item.title)
  if (byTitle) return { role: byTitle, guessed: true }

  return { role: '전체', guessed: true }
}
