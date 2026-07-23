/**
 * 직종별 업무 가이드 — 데이터 기반 설정.
 * ⚠ route 는 App.tsx 에 실제로 존재하는 경로만 사용한다(EXISTING_ROUTES 로 검증).
 * ⚠ 전용 화면이 없는 업무는 offSystem=true 로 표시하고 대체 기록 방법을 안내한다.
 */

export type GuideRole = 'facility_head' | 'social_worker' | 'nurse' | 'nurse_assistant' | 'caregiver'

/** 간호조무사 업무 수행 구분 */
export type ExecMode = 'direct' | 'nurse_check' | 'nurse_order' | 'report_now'

export const EXEC_MODE: Record<ExecMode, { label: string; tone: string }> = {
  direct:      { label: '직접 수행',        tone: 'bg-green-50 text-green-700 border-green-200' },
  nurse_check: { label: '간호사 확인 필요', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  nurse_order: { label: '간호사 지시 후',   tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  report_now:  { label: '즉시 보고',        tone: 'bg-red-50 text-red-700 border-red-200' },
}

export const ROLE_META: Record<GuideRole, { label: string; position: string; desc: string; accent: string }> = {
  facility_head:  { label: '시설장',      position: '시설장',      desc: '인력·운영·기록 점검 및 승인 중심', accent: 'violet' },
  social_worker:  { label: '사회복지사',  position: '사회복지사',  desc: '입소·상담·서류·보호자 소통 중심', accent: 'teal' },
  nurse:          { label: '간호사',      position: '간호사',      desc: '건강상태 확인·기록 검수 중심',   accent: 'rose' },
  nurse_assistant:{ label: '간호조무사',  position: '간호조무사',  desc: '측정·기록·보조 업무 중심',       accent: 'indigo' },
  caregiver:      { label: '요양보호사',  position: '요양보호사',  desc: '오늘 할 일 · 내 근무표 · 휴무 신청', accent: 'orange' },
}

/** App.tsx 에 실제 존재하는 라우트 (가이드 바로가기 검증용) */
export const EXISTING_ROUTES = new Set<string>([
  '/', '/contacts', '/eval/residents', '/resident-docs', '/eval/staff', '/staff-hr', '/staffing',
  '/schedule', '/facility-news', '/volunteers', '/recruitment', '/enteral', '/expense',
  '/eval/checklist', '/eval/calendar', '/eval/albums', '/eval/workload',
  '/eval/record-audit', '/eval/record-guide', '/eval/ai-review', '/eval/users',
  '/history', '/reviews', '/settings', '/guide', '/work-guide', '/my-schedule',
])

export interface RoleGuideItem {
  id: string
  roles: GuideRole[]
  title: string
  description: string
  category: string
  route?: string          // 없으면 시스템 외(offSystem)
  menuLabel?: string      // 실제 사이드바 메뉴명과 동일하게
  timing?: string         // 수행 시점
  relatedRoles?: string[] // 연계 직종
  caution?: string
  mode?: ExecMode         // 간호조무사 수행 구분
  offSystem?: boolean     // Admin 전용 화면 없음 → 대체 기록 방법 안내
  order: number
  isActive: boolean
}

export interface GuideStep { label: string; route?: string; menuLabel?: string; note?: string }
export interface GuideFlow { id: string; roles: GuideRole[]; title: string; steps: GuideStep[] }

/* ────────────────────────────────────────────────
 * 업무 카드 — 실제 존재하는 기능만 route 연결
 * ──────────────────────────────────────────────── */
export const GUIDE_ITEMS: RoleGuideItem[] = [
  /* ── 공통(전 직종) ── */
  {
    id: 'checklist', roles: ['social_worker', 'nurse', 'nurse_assistant'],
    category: '매일', title: '오늘 할 일 · 기록 체크리스트',
    description: '오늘 해야 할 업무를 확인하고 완료 체크합니다. 할 일이 생기면 바로 티켓으로 등록할 수 있습니다.',
    route: '/eval/checklist', menuLabel: '체크리스트',
    timing: '매일 근무 시작 시 · 업무 완료 직후',
    caution: '완료 체크를 미루면 누락으로 집계됩니다. 그날 안에 체크하세요.',
    relatedRoles: ['전 직종'], order: 10, isActive: true,
  },
  {
    id: 'calendar', roles: ['social_worker', 'nurse', 'nurse_assistant'],
    category: '매일', title: '체크 캘린더로 주기 업무 확인',
    description: '일별·주별·월별 반복 업무가 언제 도래하는지 달력으로 확인합니다.',
    route: '/eval/calendar', menuLabel: '체크 캘린더',
    timing: '주 1회 이상', order: 20, isActive: true,
  },
  {
    id: 'schedule', roles: ['social_worker', 'nurse', 'nurse_assistant'],
    category: '매일', title: '일정 캘린더',
    description: '시설 일정, 입소일, 어르신 서류 일시(계약서·계획서·평가), 직원 재계약일을 한 곳에서 봅니다.',
    route: '/schedule', menuLabel: '일정 캘린더',
    timing: '매일 아침', order: 30, isActive: true,
  },
  {
    id: 'album', roles: ['social_worker', 'nurse', 'nurse_assistant'],
    category: '소통', title: '보호자 앨범에 사진 올리기',
    description: '어르신 활동 사진을 올려 보호자에게 공유합니다.',
    route: '/eval/albums', menuLabel: '보호자 앨범',
    timing: '행사·프로그램 직후',
    caution: '얼굴이 나오는 사진은 동의 여부를 확인하세요.',
    order: 40, isActive: true,
  },
  {
    id: 'expense', roles: ['social_worker', 'nurse', 'nurse_assistant'],
    category: '회계', title: '지출결의 올리기',
    description: '구매·결제한 내역과 영수증을 등록해 결재를 요청합니다.',
    route: '/expense', menuLabel: '지출결의',
    timing: '구매 직후', order: 50, isActive: true,
  },

  /* ── 시설장 ── */
  {
    id: 'fh-staffing', roles: ['facility_head'],
    category: '인력', title: '입소 전 인력배치 확인 (2.1:1)',
    description: '입소를 받아도 되는지, 요양보호사가 몇 명 더 필요한지, 언제까지 채용해야 하는지 자동 판단합니다.',
    route: '/staffing', menuLabel: '인력배치 시뮬레이터',
    timing: '입소 결정 전 · 매월 초',
    caution: '결과는 예상값입니다. 실제 인력신고는 공단 안내를 최종 확인하세요.',
    relatedRoles: ['사회복지사'], order: 60, isActive: true,
  },
  {
    id: 'fh-staff', roles: ['facility_head'],
    category: '인력', title: '직원 입·퇴사 · 휴직 관리',
    description: '직원 등록·퇴사 처리, 휴직 기간(복직일 포함)을 관리합니다. 휴직은 인력배치 계산에서 자동 제외됩니다.',
    route: '/eval/staff', menuLabel: '직원 관리',
    timing: '입·퇴사·휴직 발생 즉시',
    caution: '직종을 정확히 입력해야 인력배치 계산에 반영됩니다.',
    order: 61, isActive: true,
  },
  {
    id: 'fh-hr', roles: ['facility_head'],
    category: '인력', title: '근로계약 · 제출서류 · 카드키 관리',
    description: '근로계약 기간·재계약일, 제출서류(건강검진·범죄경력·동의서 4종), 출입 카드키 보증금·반납을 관리합니다.',
    route: '/staff-hr', menuLabel: '직원 상세',
    timing: '입사 시 · 재계약 1개월 전',
    caution: '재계약일이 지난 직원은 빨갛게 표시됩니다. 놓치지 마세요.',
    order: 62, isActive: true,
  },
  {
    id: 'fh-recruit', roles: ['facility_head'],
    category: '인력', title: '채용 관리',
    description: '지원자·면접 일정을 관리합니다. 면접 일정은 일정 캘린더에도 표시됩니다.',
    route: '/recruitment', menuLabel: '채용 관리',
    timing: '채용 진행 시', order: 63, isActive: true,
  },
  {
    id: 'fh-workload', roles: ['facility_head'],
    category: '점검', title: '담당자별 업무 현황 점검',
    description: '직원별 체크리스트 진행률과 미완료 업무를 확인합니다.',
    route: '/eval/workload', menuLabel: '담당자별 현황',
    timing: '주 1회 이상',
    caution: '미완료가 쌓인 담당자는 개별 확인이 필요합니다.',
    relatedRoles: ['전 직종'], order: 64, isActive: true,
  },
  {
    id: 'fh-audit', roles: ['facility_head'],
    category: '점검', title: '제공기록지 검수 · AI 검토',
    description: '기록 누락·오류를 검수하고, AI 체크리스트 검토로 개선점을 확인합니다.',
    route: '/eval/record-audit', menuLabel: '제공기록지 검수',
    timing: '월 1회 이상',
    relatedRoles: ['요양보호사', '사회복지사'], order: 65, isActive: true,
  },
  {
    id: 'fh-ai', roles: ['facility_head'],
    category: '점검', title: 'AI 체크리스트 검토',
    description: '체크리스트 구성이 평가 기준에 맞는지 AI로 점검합니다.',
    route: '/eval/ai-review', menuLabel: 'AI 체크리스트 검토',
    timing: '평가 준비 시', order: 66, isActive: true,
  },
  {
    id: 'fh-docs', roles: ['facility_head'],
    category: '운영', title: '어르신 서류현황 점검 (인정서 갱신)',
    description: '인정서 만료·갱신 대상, 계약서·계획서·평가 일시 누락을 확인합니다.',
    route: '/resident-docs', menuLabel: '어르신 서류현황',
    timing: '월 1회 이상',
    caution: '인정서 종료 90일 전이 갱신 신청 기준입니다.',
    relatedRoles: ['사회복지사'], order: 67, isActive: true,
  },
  {
    id: 'fh-expense', roles: ['facility_head'],
    category: '운영', title: '지출결의 확인',
    description: '직원이 올린 지출결의를 확인합니다.',
    route: '/expense', menuLabel: '지출결의',
    timing: '수시',
    caution: '최종 승인 권한은 관리자(ADMIN)에게 있습니다. 시설장은 확인·검토만 가능합니다.',
    order: 68, isActive: true,
  },
  {
    id: 'fh-users', roles: ['facility_head'],
    category: '운영', title: '직원 계정 관리',
    description: '직원 로그인 계정과 직종을 지정합니다. 계정 직종이 정확해야 각자 맞는 메뉴·가이드가 보입니다.',
    route: '/eval/users', menuLabel: '직원 계정 관리',
    timing: '입사 시',
    caution: '관리자(ADMIN) 계정은 시설장이 관리할 수 없습니다.',
    order: 69, isActive: true,
  },

  /* ── 사회복지사 ── */
  {
    id: 'sw-admission', roles: ['social_worker'],
    category: '입·퇴소', title: '신규 어르신 입소 등록',
    description: '어르신 기본정보와 장기요양인정서(등급·유효기간·급여)를 등록합니다. 등록하면 입소 체크리스트와 서류현황이 자동 생성됩니다.',
    route: '/eval/residents', menuLabel: '수급자 관리',
    timing: '입소 당일 (늦어도 입소 다음 날까지)',
    relatedRoles: ['간호사', '요양보호사'],
    caution: '인정서 유효기간을 정확히 넣어야 갱신·계약 일정이 자동 계산됩니다.',
    order: 100, isActive: true,
  },
  {
    id: 'sw-docs', roles: ['social_worker'],
    category: '입·퇴소', title: '어르신 서류현황 관리 (인정서·계약서·계획서·평가)',
    description: '인정서 갱신, 계약서·급여제공계획서·결과평가 작성 일시를 관리합니다. 인정서 기준으로 일시를 자동 생성할 수 있습니다.',
    route: '/resident-docs', menuLabel: '어르신 서류현황',
    timing: '입소 후 · 인정서 갱신 시 · 변화 발생 시',
    caution: '인정서 종료 90일 전이 갱신 신청 기준입니다. 갱신대상 배지를 확인하세요.',
    order: 110, isActive: true,
  },
  {
    id: 'sw-discharge', roles: ['social_worker'],
    category: '입·퇴소', title: '퇴소 처리',
    description: '퇴소일을 등록하면 연계기록지 체크리스트가 생성되고 미완료 입소 체크리스트는 비활성화됩니다.',
    route: '/eval/residents', menuLabel: '수급자 관리',
    timing: '퇴소 당일', order: 120, isActive: true,
  },
  {
    id: 'sw-contact', roles: ['social_worker'],
    category: '보호자', title: '보호자 상담 접수·처리',
    description: '홈페이지·전화로 들어온 상담을 확인하고 처리 상태를 관리합니다.',
    route: '/contacts', menuLabel: '상담 관리',
    timing: '상담 접수 즉시 · 최소 1일 1회 확인',
    caution: '미처리 상담이 쌓이지 않도록 완료 처리하세요.',
    order: 130, isActive: true,
  },
  {
    id: 'sw-news', roles: ['social_worker'],
    category: '보호자', title: '시설소식(가정통신문) 발행',
    description: '보호자에게 알릴 소식·공지를 등록합니다.',
    route: '/facility-news', menuLabel: '시설소식',
    timing: '행사 전후 · 월 1회 이상', order: 140, isActive: true,
  },
  {
    id: 'sw-audit', roles: ['social_worker'],
    category: '기록·검수', title: '급여제공기록지 검수',
    description: '요양보호사가 작성한 제공기록지의 누락·오류를 검수합니다. 검수 기준은 별도 화면에서 확인합니다.',
    route: '/eval/record-audit', menuLabel: '제공기록지 검수',
    timing: '월 1회 이상',
    relatedRoles: ['요양보호사'], order: 150, isActive: true,
  },
  {
    id: 'sw-volunteer', roles: ['social_worker'],
    category: '운영', title: '자원봉사 관리',
    description: '자원봉사자 신청·활동을 관리합니다.',
    route: '/volunteers', menuLabel: '자원봉사 관리',
    timing: '신청 접수 시', order: 160, isActive: true,
  },
  {
    id: 'sw-enteral', roles: ['social_worker', 'nurse_assistant'],
    category: '운영', title: '경관식 관리',
    description: '경관식 재고·입출고를 관리합니다.',
    route: '/enteral', menuLabel: '경관식 관리',
    timing: '입출고 발생 시', order: 170, isActive: true,
  },

  /* ── 간호사 ── */
  {
    id: 'ns-health-check', roles: ['nurse'],
    category: '건강관리', title: '어르신 건강상태 확인 (체크리스트)',
    description: '건강상태·활력징후 확인 업무를 체크리스트에서 확인하고 완료 기록합니다. 전용 간호기록 화면은 아직 없습니다.',
    route: '/eval/checklist', menuLabel: '체크리스트',
    timing: '매일 · 상태 변화 시',
    caution: '수치(혈압·체온 등)는 체크리스트 메모에 남기고, 상세 기록지는 수기 서식으로 보관하세요.',
    relatedRoles: ['간호조무사', '요양보호사'], order: 200, isActive: true,
  },
  {
    id: 'ns-audit', roles: ['nurse'],
    category: '기록·검수', title: '제공기록지 검수 · 검수 기준 확인',
    description: '기록 누락·오류를 검수합니다. 판정 기준은 검수 기준 화면에서 확인합니다.',
    route: '/eval/record-audit', menuLabel: '제공기록지 검수',
    timing: '월 1회 이상',
    relatedRoles: ['요양보호사', '간호조무사'], order: 210, isActive: true,
  },
  {
    id: 'ns-audit-guide', roles: ['nurse', 'nurse_assistant', 'social_worker'],
    category: '기록·검수', title: '검수 기준 보기',
    description: '어떤 기록이 누락·오류로 판정되는지 기준을 확인합니다.',
    route: '/eval/record-guide', menuLabel: '검수 기준',
    timing: '검수 전', order: 220, isActive: true,
  },
  {
    id: 'ns-contact', roles: ['nurse'],
    category: '보호자', title: '보호자 건강상태 통보 이력',
    description: '보호자 문의·상담 이력을 확인합니다. (건강상태 통보 전용 화면은 없으며 상담 관리에 기록)',
    route: '/contacts', menuLabel: '상담 관리',
    timing: '상태 변화·병원 진료 후', order: 230, isActive: true,
  },

  /* ── 간호조무사 ── */
  {
    id: 'na-vital', roles: ['nurse_assistant'],
    category: '측정·기록', title: '활력징후 측정 및 기록',
    description: '혈압·체온·맥박 등을 측정하고 체크리스트에 완료 기록합니다. 수치는 메모에 남깁니다.',
    route: '/eval/checklist', menuLabel: '체크리스트',
    timing: '정해진 측정 주기마다',
    mode: 'direct',
    caution: '정상 범위를 벗어나면 즉시 간호사에게 보고하세요.',
    relatedRoles: ['간호사'], order: 300, isActive: true,
  },
  {
    id: 'na-med', roles: ['nurse_assistant'],
    category: '측정·기록', title: '투약 보조 기록',
    description: '투약 보조 수행 후 체크리스트에 기록합니다. 투약 판단·처방은 간호사 지시에 따릅니다.',
    route: '/eval/checklist', menuLabel: '체크리스트',
    timing: '투약 시간마다',
    mode: 'nurse_order',
    caution: '용량·시간 변경은 반드시 간호사 지시 후 수행합니다.',
    relatedRoles: ['간호사'], order: 310, isActive: true,
  },
  {
    id: 'na-skin', roles: ['nurse_assistant'],
    category: '측정·기록', title: '피부·구강·배변 상태 확인',
    description: '피부(욕창), 구강, 배변·배뇨 상태를 확인하고 체크리스트에 기록합니다.',
    route: '/eval/checklist', menuLabel: '체크리스트',
    timing: '매일 · 목욕 전후',
    mode: 'nurse_check',
    caution: '발적·상처·출혈 발견 시 즉시 간호사 확인이 필요합니다.',
    relatedRoles: ['간호사', '요양보호사'], order: 320, isActive: true,
  },
  {
    id: 'na-report', roles: ['nurse_assistant'],
    category: '보고', title: '이상 상태 즉시 보고',
    description: '낙상, 의식 저하, 발열, 출혈 등 이상 상태는 즉시 간호사에게 보고하고 체크리스트에 티켓으로 남깁니다.',
    route: '/eval/checklist', menuLabel: '체크리스트',
    timing: '발생 즉시',
    mode: 'report_now',
    caution: '기록보다 보고가 먼저입니다. 보고 후 기록하세요.',
    relatedRoles: ['간호사'], order: 330, isActive: true,
  },

  /* ── 요양보호사 — 50대 이상 선생님 기준: 카드 5장, 짧고 쉬운 말로 ── */
  {
    id: 'cg-my-schedule', roles: ['caregiver'],
    category: '근무', title: '내 근무표 보기',
    description: '오늘 내가 무슨 근무인지, 이번 달 근무가 어떻게 되는지 봅니다. 근무표가 새로 나오면 알림이 옵니다.',
    route: '/my-schedule', menuLabel: '내 근무표',
    timing: '매일 아침 · 근무표 알림이 왔을 때',
    order: 395, isActive: true,
  },
  {
    id: 'cg-leave', roles: ['caregiver'],
    category: '근무', title: '연차 · 쉬고 싶은 날 신청',
    description: '내 근무표 화면 아래에서 신청합니다. 연차는 근무가 있는 날을 골라 서명하면 되고, 쉬고 싶은 날(희망휴무)은 한 달에 2일까지 미리 낼 수 있어요. 동료와 근무를 바꾸는 것(맞교대)도 여기서 합니다.',
    route: '/my-schedule', menuLabel: '내 근무표',
    timing: '다음 달 근무표 나오기 전까지',
    caution: '신청만 하면 끝이 아니에요. 관리자 승인이 나야 확정입니다. 승인되면 알림이 와요.',
    order: 396, isActive: true,
  },
  {
    id: 'cg-record', roles: ['caregiver'],
    category: '매일 기록', title: '오늘 한 일 체크하기',
    description: '식사, 물 드리기, 기저귀, 자세 바꿔드리기, 목욕, 양치 — 어르신께 해드린 일을 그때그때 체크합니다.',
    route: '/eval/checklist', menuLabel: '체크리스트',
    timing: '해드린 직후 바로 · 퇴근 전에 빠진 것 없나 한 번 더',
    caution: '나중에 몰아서 하면 빠뜨리기 쉬워요. 하나 끝나면 바로 체크하세요.',
    order: 400, isActive: true,
  },
  {
    id: 'cg-report', roles: ['caregiver'],
    category: '보고', title: '어르신이 평소와 다르면 바로 알리기',
    description: '넘어지셨거나, 살갗에 상처가 있거나, 식사를 안 하시거나, 열이 나면 — 먼저 간호사 선생님께 말로 알리고, 그다음 체크리스트에 남깁니다.',
    route: '/eval/checklist', menuLabel: '체크리스트',
    timing: '발견하자마자',
    caution: '"괜찮겠지" 하고 넘기지 마세요. 말로 알리는 게 제일 먼저입니다.',
    order: 410, isActive: true,
  },
  {
    id: 'cg-album', roles: ['caregiver'],
    category: '소통', title: '어르신 사진 올리기',
    description: '프로그램이나 활동 사진을 올리면 보호자 가족들이 앱에서 바로 봅니다.',
    route: '/eval/albums', menuLabel: '보호자 앨범',
    timing: '활동 끝난 직후',
    caution: '다른 어르신 얼굴이 같이 나온 사진은 올리기 전에 한 번 더 확인하세요.',
    order: 420, isActive: true,
  },
]

/* ────────────────────────────────────────────────
 * 전용 화면이 없는 업무 (수기/체크리스트로 처리) — 정직하게 구분 표기
 * ──────────────────────────────────────────────── */
export const OFF_SYSTEM: { roles: GuideRole[]; items: string[] }[] = [
  {
    roles: ['facility_head'],
    items: [
      '운영위원회 · 고충처리 · 인권 관련 회의록',
      '근무표(시프트) 편성 — 현재 전용 화면 없음 (인력배치는 풀근무 기준 예상값)',
      '공단 인력신고 · 행정판정 서류',
    ],
  },
  {
    roles: ['social_worker'],
    items: [
      '욕구사정 · 급여제공계획서 본문 작성 (서류현황에는 "작성 일시"만 관리)',
      '프로그램 계획서 · 결과 기록',
      '외출·외박 관리 대장',
      '운영위원회 · 고충처리 · 인권 관련 기록',
    ],
  },
  {
    roles: ['nurse', 'nurse_assistant'],
    items: [
      '간호기록지 · 활력징후 수치 기록 (체크리스트 메모 + 수기 서식)',
      '투약·처방 관리 대장',
      '낙상 · 욕창 · 인지 평가 서식',
      '병원 진료 · 촉탁의 진료 기록',
      '감염관리 점검표',
    ],
  },
  {
    roles: ['caregiver'],
    items: [
      '급여제공기록지 서식 원본 (체크리스트로 수행 여부만 관리)',
    ],
  },
]

/* ────────────────────────────────────────────────
 * 업무 흐름
 * ──────────────────────────────────────────────── */
export const GUIDE_FLOWS: GuideFlow[] = [
  {
    id: 'flow-fh-admission', roles: ['facility_head'], title: '입소 결정 전 점검 (시설장)',
    steps: [
      { label: '인력배치 시뮬레이터로 입소 가능성 확인', route: '/staffing', menuLabel: '인력배치 시뮬레이터' },
      { label: '부족 시 → 채용 진행 또는 입소일 조정', route: '/recruitment', menuLabel: '채용 관리' },
      { label: '입소 확정 → 사회복지사에게 수급자 등록 요청', route: '/eval/residents', menuLabel: '수급자 관리' },
      { label: '서류현황에서 인정서·계약 일시 확인', route: '/resident-docs', menuLabel: '어르신 서류현황' },
    ],
  },
  {
    id: 'flow-fh-monthly', roles: ['facility_head'], title: '월간 운영 점검 (시설장)',
    steps: [
      { label: '① 담당자별 미완료 업무 확인', route: '/eval/workload', menuLabel: '담당자별 현황' },
      { label: '② 제공기록지 검수 (누락·오류)', route: '/eval/record-audit', menuLabel: '제공기록지 검수' },
      { label: '③ 인정서 갱신 대상 확인 (종료 90일 전)', route: '/resident-docs', menuLabel: '어르신 서류현황' },
      { label: '④ 직원 재계약일·제출서류 점검', route: '/staff-hr', menuLabel: '직원 상세' },
      { label: '⑤ 인력배치 기준 충족 여부 확인', route: '/staffing', menuLabel: '인력배치 시뮬레이터' },
    ],
  },
  {
    id: 'flow-admission', roles: ['social_worker'], title: '신규 어르신 입소 처리',
    steps: [
      { label: '수급자 등록 (기본정보 + 장기요양인정서)', route: '/eval/residents', menuLabel: '수급자 관리' },
      { label: '입소 체크리스트 확인 (자동 생성됨)', route: '/eval/checklist', menuLabel: '체크리스트' },
      { label: '어르신 서류현황에서 인정서·계약·계획서 일시 자동 생성', route: '/resident-docs', menuLabel: '어르신 서류현황' },
      { label: '욕구사정 · 급여제공계획서 작성 (수기 서식)', note: '전용 화면 없음 — 작성 일시만 서류현황에 기록' },
      { label: '보호자 설명 · 계약서 서명', route: '/resident-docs', menuLabel: '어르신 서류현황' },
      { label: '일정 캘린더에서 갱신·평가 일정 확인', route: '/schedule', menuLabel: '일정 캘린더' },
    ],
  },
  {
    id: 'flow-renewal', roles: ['social_worker'], title: '장기요양인정서 갱신',
    steps: [
      { label: '갱신대상(종료 90일 전) 확인', route: '/resident-docs', menuLabel: '어르신 서류현황' },
      { label: '보호자에게 갱신 서류 안내', route: '/contacts', menuLabel: '상담 관리' },
      { label: '갱신 인정서 추가 등록 (등급·유효기간·급여)', route: '/resident-docs', menuLabel: '어르신 서류현황' },
      { label: '"인정서 기준 일시 자동 생성"으로 계약·계획·평가 일시 갱신', route: '/resident-docs', menuLabel: '어르신 서류현황' },
    ],
  },
  {
    id: 'flow-daily-care', roles: ['caregiver'], title: '하루 순서 — 이대로만 하면 됩니다',
    steps: [
      { label: '출근하면 내 근무표에서 오늘 근무 확인', route: '/my-schedule', menuLabel: '내 근무표' },
      { label: '오늘 할 일 목록 열어보기', route: '/eval/checklist', menuLabel: '체크리스트' },
      { label: '어르신께 해드린 일은 그때그때 바로 체크', route: '/eval/checklist', menuLabel: '체크리스트' },
      { label: '평소와 다른 점이 보이면 간호사 선생님께 먼저 말하기', note: '말로 알리는 게 먼저, 기록은 그다음' },
      { label: '활동 사진이 있으면 앨범에 올리기', route: '/eval/albums', menuLabel: '보호자 앨범' },
      { label: '퇴근 전, 체크 안 한 것 없나 한 번 더 보기', route: '/eval/checklist', menuLabel: '체크리스트' },
    ],
  },
  {
    id: 'flow-abnormal', roles: ['nurse', 'nurse_assistant', 'caregiver'], title: '이상 상태 발생 시',
    steps: [
      { label: '① 즉시 간호사(또는 상급자)에게 구두 보고', note: '기록보다 보고가 먼저' },
      { label: '② 체크리스트에 무슨 일이 있었는지 기록', route: '/eval/checklist', menuLabel: '체크리스트' },
      { label: '③ 필요 시 보호자 통보 (상담 관리에 이력)', route: '/contacts', menuLabel: '상담 관리' },
      { label: '④ 후속 조치 완료 후 체크 마감', route: '/eval/checklist', menuLabel: '체크리스트' },
    ],
  },
]

/** 라우트 유효성 검증 — 존재하지 않는 route 는 가이드에서 제외 */
export const isValidRoute = (r?: string) => !!r && EXISTING_ROUTES.has(r)
