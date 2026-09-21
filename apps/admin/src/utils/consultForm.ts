/** 입소 상담에서 여쭙는 것 — 순서·보기·멘트를 한곳에.
 *
 *  화면(입력)과 종이(상담 기록지)가 같은 표를 읽는다. 두 곳에 따로 적으면
 *  항목이 하나 늘 때 한쪽만 늘어나고, 그러면 화면에 적은 것이 종이에 안 나온다.
 *
 *  멘트를 함께 둔 이유: 상담 전화는 복지 선생님만 받지 않는다. 사무실에
 *  있는 사람이 받는다. 처음 받는 사람도 순서대로 읽으면 통화가 굴러가야 한다.
 *  읽어야 하는 대본이 아니라, 막혔을 때 보는 줄이다.
 */

export type FieldType = 'text' | 'textarea' | 'choice' | 'chips' | 'date' | 'time' | 'number'

export interface ConsultField {
  key: string
  label: string
  type: FieldType
  options?: string[]
  /** 그 칸을 여쭐 때의 도움말 — 헷갈리기 쉬운 것에만 붙인다 */
  hint?: string
  unit?: string
  /** 표에서 차지하는 칸 수 (1~3). 긴 글은 3 */
  span?: 1 | 2 | 3
  placeholder?: string
}

export interface ConsultSection {
  key: string
  title: string
  /** 멘트 — 이 대목에서 여쭙는 말 */
  script: string
  fields: ConsultField[]
  /** 부부 상담일 때만 나오는 대목 */
  coupleOnly?: boolean
  /** 비용이 걸린 대목 — 화면에서 먼저 눈에 띄게 한다 */
  key_point?: boolean
}

/** 여러 개를 고르는 칸의 구분자 — 종이에도 이대로 찍힌다 */
export const CHIP_SEP = ' · '

export const CONSULT_SECTIONS: ConsultSection[] = [
  {
    key: 'head',
    title: '상담 개요',
    script: '안녕하세요, 행복한요양원입니다. 입소 상담 도와드리겠습니다. 실례지만 어르신과 어떻게 되시는 분일까요?',
    fields: [
      { key: 'consulted_on', label: '상담일', type: 'date' },
      { key: 'consulted_at', label: '상담 시각', type: 'time' },
      { key: 'counselor', label: '상담자', type: 'text', placeholder: '받은 사람' },
      {
        key: 'route', label: '상담 경로', type: 'choice',
        options: ['전화', '홈페이지', '지인 소개', '병원·의료기관', '건강보험공단', '블로그·검색', '현수막·전단', '재상담', '기타'],
        hint: '어떻게 알고 연락 주셨는지 — 광고를 어디에 낼지 정하는 근거가 된다',
      },
      { key: 'method', label: '상담 방법', type: 'choice', options: ['전화', '방문(내소)', '시설 견학', '온라인', '기타'] },
      { key: 'caller', label: '상담하신 분', type: 'text', placeholder: '성함 (보호자 본인이 아닐 수 있다)' },
    ],
  },
  {
    key: 'elder',
    title: '어르신',
    script: '먼저 어르신에 대해 몇 가지 여쭙겠습니다. 성함과 연세가 어떻게 되실까요? 지금은 어디에 계신지요?',
    fields: [
      { key: 'resident_name', label: '어르신 성함', type: 'text' },
      { key: 'gender', label: '성별', type: 'choice', options: ['남', '여'] },
      { key: 'age', label: '연령', type: 'number', unit: '세' },
      { key: 'height_cm', label: '키', type: 'text', unit: 'cm' },
      { key: 'weight_kg', label: '몸무게', type: 'text', unit: 'kg' },
      {
        key: 'living', label: '현재 거주 상황', type: 'choice',
        options: ['자택(독거)', '자택(가족 동거)', '요양병원', '일반병원', '타 요양원', '주야간보호 이용', '자녀 집', '기타'],
        hint: '병원에 계시면 퇴원 예정일을 함께 여쭙는다 — 입소일이 거기에 매인다',
      },
      { key: 'living_note', label: '거주 관련 메모', type: 'text', span: 2, placeholder: '퇴원 예정일 · 병원명 등' },
    ],
  },
  {
    key: 'grade',
    title: '요양등급 · 비용',
    key_point: true,
    script: '장기요양등급은 받으셨을까요? 등급에 따라 비용이 달라져서, 본인부담률도 함께 확인해 드리겠습니다.',
    fields: [
      {
        key: 'grade', label: '요양등급', type: 'choice',
        options: ['1등급', '2등급', '3등급', '4등급', '5등급', '인지지원등급', '등급외', '신청 중', '모름'],
      },
      {
        key: 'benefit', label: '급여 종류', type: 'choice',
        options: ['시설급여', '재가급여', '등급외자', '시설급여 신청중', '모름'],
        hint: '재가급여면 시설급여로 변경 신청이 필요하다 — 통화에서 바로 안내한다',
      },
      {
        key: 'copay', label: '본인부담금', type: 'choice',
        options: ['일반(20%)', '감경 12%', '감경 8%', '기초수급자(면제)', '모름'],
        hint: '감경 여부는 건강보험 납부액으로 정해진다. 모르시면 공단에 확인하시도록 안내',
      },
      { key: 'grade_note', label: '등급 관련 메모', type: 'text', span: 3, placeholder: '인정번호 · 유효기간 · 갱신 예정 등' },
    ],
  },
  {
    key: 'health',
    title: '건강 상태',
    script: '어르신 상태를 알아야 모실 준비를 할 수 있어서 여쭙습니다. 불편하신 것부터 편하게 말씀해 주세요.',
    fields: [
      { key: 'diagnosis', label: '진단명', type: 'textarea', span: 3, placeholder: '치매 · 파킨슨 · 뇌경색 · 당뇨 · 고혈압 등' },
      {
        key: 'behavior', label: '심리상황 및 정신행동 양상', type: 'chips', span: 3,
        options: ['특이사항 없음', '배회', '공격성·폭언', '반복 질문', '수집·숨김', '망상·환각', '우울', '불안·초조', '거부(목욕·투약)', '야간 섬망', '낙상 위험'],
        hint: '해당하는 것을 눌러 담고, 구체적인 것은 뒤에 적는다',
      },
      { key: 'sleep', label: '수면상태', type: 'chips', span: 3, options: ['양호', '자주 깸', '불면', '낮밤 바뀜', '수면제 복용'] },
      { key: 'hearing', label: '청각기능', type: 'choice', options: ['정상', '조금 어두움', '많이 어두움', '거의 못 들음'] },
      { key: 'hearing_aid', label: '보청기', type: 'choice', options: ['미사용', '사용'] },
      { key: 'vision', label: '시각기능', type: 'choice', options: ['정상', '조금 안 보임', '많이 안 보임', '거의 못 봄'] },
      { key: 'glasses', label: '안경', type: 'choice', options: ['미착용', '착용'] },
      { key: 'speech', label: '언어능력', type: 'choice', options: ['원활', '어눌함', '단어 수준', '의사표현 불가'] },
      {
        key: 'mobility', label: '보행 능력', type: 'choice',
        options: ['독립 보행', '지팡이·워커', '부축 필요', '휠체어', '와상'],
        hint: '층과 방을 정하는 근거가 된다',
      },
      { key: 'toileting', label: '대소변', type: 'choice', options: ['자립', '부분 도움', '기저귀 착용', '유치도뇨', '인공항문'] },
      { key: 'eating', label: '식사', type: 'choice', options: ['자립', '부분 도움', '전적 도움', '경관식'] },
      {
        key: 'diet', label: '식사 종류', type: 'choice',
        options: ['일반식', '죽', '다진 반찬', '미음', '경관식', '당뇨식', '저염식'],
      },
      { key: 'health_note', label: '건강 관련 덧붙임', type: 'textarea', span: 3, placeholder: '복용 약 · 최근 입원 · 욕창 · 알레르기 등' },
    ],
  },
  {
    key: 'family',
    title: '보호자 · 가족',
    script: '연락드릴 보호자분 성함과 연락처를 남겨주시겠어요? 어르신과 어떻게 되시는지도 함께 적어두겠습니다.',
    fields: [
      { key: 'children', label: '자녀 여부', type: 'choice', options: ['없음', '1명', '2명', '3명', '4명 이상'] },
      { key: 'guardian_name', label: '보호자 성함', type: 'text' },
      { key: 'guardian_relation', label: '관계', type: 'choice', options: ['자녀', '배우자', '며느리·사위', '형제자매', '손자녀', '조카', '기타'] },
      { key: 'guardian_phone', label: '연락처', type: 'text', placeholder: '010-0000-0000' },
      { key: 'address', label: '주소', type: 'text', span: 2 },
    ],
  },
  {
    key: 'couple',
    title: '부부 상담',
    coupleOnly: true,
    script: '두 분 다 모시는 것으로 상담드리겠습니다. 같은 방을 쓰시길 원하시는지요? 비용은 두 분 합산으로 말씀드릴게요.',
    fields: [
      {
        key: 'couple_room', label: '같은 방 희망', type: 'choice',
        options: ['같은 방 희망', '같은 층이면 됨', '상관없음', '미정'],
        hint: '방은 남녀를 나눠 쓰는 것이 보통이라 같은 방은 2인실이 있어야 한다 — 「담당 어르신 명단」에서 호실 정원을 보고 말씀드린다',
      },
      {
        key: 'cost_guided', label: '합산 비용 안내', type: 'choice',
        options: ['두 분 합산 금액 안내함', '아직 안내 못 함'],
        hint: '한 분 기준으로만 말씀드리면 나중에 금액을 보고 놀라신다',
      },
    ],
  },
  {
    key: 'next',
    title: '진행 · 안내',
    script: '입소 전에 건강검진(흉부 X-ray·결핵검사)이 필요합니다. 희망하시는 입소일이 언제쯤이신지요? 필요하신 것 더 있으시면 말씀해 주세요.',
    fields: [
      {
        key: 'checkup', label: '건강검진 연계', type: 'choice',
        options: ['안내함', '예약함', '완료', '해당 없음'],
        hint: '흉부 X-ray·결핵검사는 입소 전에 받아야 한다 — 통화에서 미리 안내하면 입소가 밀리지 않는다',
      },
      { key: 'checkup_note', label: '검진 메모', type: 'text', span: 2, placeholder: '검진기관 · 예약일' },
      { key: 'wish_date', label: '희망 입소일', type: 'date' },
      { key: 'followup_on', label: '다음 연락 예정일', type: 'date', hint: '먼저 연락드리기로 했으면 적어둔다 — 목록에서 그날이 다가오면 보인다' },
      { key: 'guided', label: '안내한 내용', type: 'textarea', span: 3, placeholder: '월 비용 · 준비물 · 면회 방법 등 통화에서 설명한 것' },
      { key: 'notes', label: '특이사항', type: 'textarea', span: 3, placeholder: '그 밖에 남겨둘 것' },
    ],
  },
]

/** 모든 칸을 한 줄로 — 화면과 종이가 같은 목록을 돈다 */
export const CONSULT_FIELDS: ConsultField[] = CONSULT_SECTIONS.flatMap(s => s.fields)

export const FIELD_BY_KEY: Record<string, ConsultField> =
  Object.fromEntries(CONSULT_FIELDS.map(f => [f.key, f]))

/** 진행 상태 — 상담 뒤에 무엇을 해야 하는지가 보이게 */
export const CONSULT_STATUS: { key: string; label: string; cls: string }[] = [
  { key: 'open', label: '상담함', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  { key: 'visit', label: '방문 예정', cls: 'bg-violet-100 text-violet-800 border-violet-200' },
  { key: 'admit', label: '입소 예정', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  { key: 'done', label: '입소 완료', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { key: 'drop', label: '종결', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
]
export const STATUS_LABEL: Record<string, string> =
  Object.fromEntries(CONSULT_STATUS.map(s => [s.key, s.label]))

/**
 * 여러 개 고르는 칸에서 하나를 켜고 끈다.
 *
 * 고른 것들을 ' · ' 로 이어 한 줄로 들고 있는다. 따로 표를 두지 않는 이유는
 * 종이에 그대로 한 줄로 찍히기 때문이다 — 담는 모양과 찍히는 모양이 같으면
 * 사이에서 어긋날 일이 없다.
 *
 * 손으로 덧붙여 적은 말은 건드리지 않는다. '배회 · 새벽 3시쯤' 에서 배회만
 * 꺼도 뒤의 메모는 남아야 한다.
 */
export function toggleChip(cur: string | null | undefined, chip: string): string {
  const parts = String(cur ?? '').split(CHIP_SEP).map(s => s.trim()).filter(Boolean)
  const i = parts.indexOf(chip)
  if (i >= 0) parts.splice(i, 1)
  else parts.push(chip)
  return parts.join(CHIP_SEP)
}

export function hasChip(cur: string | null | undefined, chip: string): boolean {
  return String(cur ?? '').split(CHIP_SEP).map(s => s.trim()).includes(chip)
}

/**
 * 꼭 여쭤야 하는 것 중 아직 빈 칸.
 *
 * 저장을 막지는 않는다 — 통화 중에 빈칸 때문에 막히면 그 순간 보호자를
 * 기다리게 한다. 대신 무엇이 남았는지 보여주어, 끊기 전에 여쭙게 한다.
 *
 * 비용(등급·급여·본인부담)을 넣은 이유: 이걸 안 여쭤보면 입소 직전에 다시
 * 연락해야 하고, 그때 금액이 달라지면 이야기가 처음으로 돌아간다.
 */
export const REQUIRED_KEYS = [
  'resident_name', 'gender', 'age',
  'grade', 'benefit', 'copay',
  'mobility', 'eating',
  'guardian_name', 'guardian_phone',
] as const

/** 부부일 때 더 여쭤야 하는 것 — 같은 방과 합산 금액은 부부에게만 있는 질문이다 */
export const COUPLE_REQUIRED_KEYS = ['couple_room', 'cost_guided'] as const

/** 값이 들어 있는가. 숫자 0 은 빈칸이 아니다. */
export function filled(row: Record<string, any> | null | undefined, key: string): boolean {
  const v = (row ?? {})[key]
  return !(v === null || v === undefined || String(v).trim() === '')
}

export function consultMissing(
  row: Record<string, any> | null | undefined,
  isCouple = false,
): ConsultField[] {
  const keys: string[] = [...REQUIRED_KEYS, ...(isCouple ? COUPLE_REQUIRED_KEYS : [])]
  return keys
    .filter(k => !filled(row, k))
    .map(k => FIELD_BY_KEY[k])
    .filter(Boolean)
}

/** 꼭 여쭐 칸인가 — 화면에서 살짝 다르게 그린다 */
export function isRequiredKey(key: string, isCouple = false): boolean {
  return (REQUIRED_KEYS as readonly string[]).includes(key)
    || (isCouple && (COUPLE_REQUIRED_KEYS as readonly string[]).includes(key))
}

/** 이 대목에서 몇 칸이나 채워졌는가 — 옆 목록에 점으로 보여준다 */
export function sectionProgress(
  row: Record<string, any> | null | undefined,
  sec: ConsultSection,
): { done: number; total: number } {
  return {
    done: sec.fields.filter(f => filled(row, f.key)).length,
    total: sec.fields.length,
  }
}

/** 통화 중에 보이는 대목 — 부부가 아니면 부부 대목을 뺀다 */
export function visibleSections(isCouple: boolean): ConsultSection[] {
  return CONSULT_SECTIONS.filter(s => !s.coupleOnly || isCouple)
}

/** 아직 안 여쭌 것 중 첫 칸 — 눌렀을 때 그리로 데려간다 */
export function firstMissingKey(
  row: Record<string, any> | null | undefined,
  isCouple = false,
): string | null {
  return consultMissing(row, isCouple)[0]?.key ?? null
}

/**
 * 통화 중에 한 줄 받아 적기 — 특이사항 맨 뒤에 붙인다.
 *
 * 보호자는 표 순서대로 말씀하지 않는다. 듣는 대로 한 줄씩 쌓아두었다가
 * 통화가 끝난 뒤 제자리에 옮긴다. 새 칸을 만들지 않고 특이사항에 쌓는 이유는,
 * 옮기지 못한 채로 끝나도 종이에 그대로 나가기 때문이다.
 */
export function appendNote(cur: string | null | undefined, line: string): string {
  const add = String(line ?? '').trim()
  if (!add) return String(cur ?? '')
  const base = String(cur ?? '').replace(/\s+$/, '')
  return base ? `${base}\n${add}` : add
}

/** 목록에 한 줄로 — '홍길동 어르신 (여 · 85세)' */
export function consultTitle(row: Record<string, any> | null | undefined): string {
  const r = row ?? {}
  const name = String(r.resident_name ?? '').trim()
  const sub = [String(r.gender ?? '').trim(), r.age ? `${r.age}세` : '']
    .filter(Boolean).join(' · ')
  if (!name) return sub ? `성함 미상 (${sub})` : '성함 미상'
  return sub ? `${name} 어르신 (${sub})` : `${name} 어르신`
}

/** 비어 있는 칸은 종이에 '—' 로 — 안 여쭌 것인지 없는 것인지는 통화한 사람만 안다 */
export function showValue(row: Record<string, any> | null | undefined, f: ConsultField): string {
  const v = (row ?? {})[f.key]
  const s = v === null || v === undefined ? '' : String(v).trim()
  if (!s) return '—'
  return f.unit ? `${s}${f.unit}` : s
}
