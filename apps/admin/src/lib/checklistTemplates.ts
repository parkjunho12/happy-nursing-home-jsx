import { generateId } from '../utils/period'

const today = () => new Date().toISOString().split('T')[0]

// 생성일로부터 N개월 뒤 (입소·퇴소 체크리스트 기한)
const plusMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m - 1) + n, 1)
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()
  dt.setDate(Math.min(d, last))
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

// ══════════════════════════════════════════════════════════════════════════
// 입소 (서류/준비) 체크리스트 — 2026-08 전면 재정리
//  · 그룹 태그로 묶고, 항목별 기한(입소일 + N일)을 따로 둔다
//  · 대상자 구분(기초의료·신체제재·욕창·체위변경)에 따라 조건부 생성
// ══════════════════════════════════════════════════════════════════════════
export interface AdmissionFlags {
  basicMedical?: boolean   // 기초/의료 대상자
  restraint?: boolean      // 신체 제재 대상자
  pressureSore?: boolean   // 욕창 대상자
  positioning?: boolean    // 입소 후 다음날(체위변경) 업무 대상자
}

// off: 입소일 + N일 기한 · risk: 색 구분(high=빨강) · desc: 안내
type AdmTpl = { g: string; t: string; off: number; risk?: 'low' | 'medium' | 'high'; desc?: string; team?: '간호팀' | '물리치료사' | '복지팀' }

const ADM: AdmTpl[] = [
  // ── 입소 전 업무 ──
  { g: '입소전', t: '물품 자리에 준비 (물컵·칫솔·양치물컵 등) — 와상은 시설용 에어매트 준비', off: 0 },
  { g: '입소전', t: '침대·침실입구 이름표 부착 (당일)', off: 0 },
  { g: '입소전', t: '입소자 생활실 청결 관리 (보호자 방에 가심)', off: 0 },
  { g: '입소전', t: '입소자 담당 선생님 배정', off: 0 },
  { g: '입소전', t: '입소 본인부담금 명세서 (당월분)', off: 0 },
  { g: '입소전', t: '입소자(보호자) 상호존중 문자 전송', off: 0 },
  { g: '입소전', t: '영양팀에 입소자 식이 안내', off: 0 },
  // ── 제출 서류 확인 ──
  { g: '제출서류', t: '장기요양인정서', off: 0 },
  { g: '제출서류', t: '개인별장기요양이용 계획서', off: 0 },
  { g: '제출서류', t: '주민등록증 사본 (입소자·보호자)', off: 0 },
  { g: '제출서류', t: '주민등록 등본', off: 0 },
  { g: '제출서류', t: '가족관계증명서 (어르신 중심)', off: 0 },
  { g: '제출서류', t: '건강진단서 (결핵 기록 여부 확인)', off: 0 },
  { g: '제출서류', t: '약 처방전 (매수·일분 기입)', off: 0,
    desc: '완료 처리할 때 메모에 「N매 / N일분」 형태로 꼭 기입해주세요. 예) 3매 / 30일분' },
  { g: '제출서류', t: '의사소견서 (병원에서 입소한 경우)', off: 0 },
  { g: '제출서류', t: '전원 연계기록지 (시설에서 입소한 경우)', off: 0 },
  // ── 입소 서류 확인 ──
  { g: '입소서류', t: '장기요양급여표준약관 (시설급여계약서)', off: 0 },
  { g: '입소서류', t: '노인인권 보호지침 (시설 비치용) 보관', off: 0 },
  { g: '입소서류', t: '확인서 (계약서 부본 제공 관련)', off: 0 },
  { g: '입소서류', t: '개인정보수집 및 활용 동의서', off: 0 },
  { g: '입소서류', t: '시설 입소 수칙 확인서', off: 0 },
  { g: '입소서류', t: '시설 면책 동의서', off: 0 },
  { g: '입소서류', t: '계약의사 진료 동의서', off: 0 },
  { g: '입소서류', t: '계약의사 개인정보 수집 이용 동의서', off: 0 },
  { g: '입소서류', t: '처방전 발부 및 조제 위탁 동의서', off: 0 },
  { g: '입소서류', t: '신체구속에 관한 설명서 및 동의서', off: 0 },
  { g: '입소서류', t: '연명의료 결정 제도 서명', off: 0 },
  { g: '입소서류', t: '위임장 (심폐소생술 관련)', off: 0 },
  { g: '입소서류', t: 'CCTV 네트워크 카메라 설치 동의서 2장', off: 0 },
  { g: '입소서류', t: '가정간호 설명 및 동의서 (서강의원)', off: 0, team: '간호팀' },
  { g: '입소서류', t: '가정간호 설명 및 동의서 (아름다운 척외과)', off: 0, team: '간호팀' },
  { g: '입소서류', t: '입소자 간호정보 조사지 및 History', off: 0, team: '간호팀' },
  { g: '입소서류', t: '119 이송환자 정보카드', off: 0, team: '간호팀' },
  { g: '입소서류', t: '포괄평가 기록지 작성 및 의사 서명', off: 0, team: '간호팀' },
  // ── 전산·행정 (롱텀/희망이음/구글/케어포/관리자) ──
  { g: '전산', t: '[롱텀] 입소자 급여계약 등록 (수급자/등외자)', off: 0 },
  { g: '전산', t: '[롱텀] 장기요양 급여제공 계획서 통보', off: 0 },
  { g: '전산', t: '[희망이음] 입소보고', off: 14, desc: '입소 후 14일 이내' },
  { g: '전산', t: '[관리자] 수급자 관리 — 어르신 등록 및 수정 (프로그램 분류·종교 등)', off: 3 },
  { g: '전산', t: '[관리자] 어르신 서류 현황 — 어르신 서류 등록', off: 3 },
  { g: '전산', t: '[관리자] 보호자 앨범 — 어르신 앨범·보호자 계정 등록', off: 3 },
  { g: '전산', t: "[구글] '행복한_어르신현황' 수정", off: 3 },
  { g: '전산', t: "[구글] '행복한_식수현황' 수정", off: 3 },
  { g: '전산', t: "[구글] '행복한_촉탁의명부' 수정", off: 3 },
  { g: '전산', t: '[케어포] 1. 수급자관리 — 신규 입소자 등록', off: 3 },
  { g: '전산', t: '[케어포] 1-3. 기초평가 — 낙상위험도 평가', off: 3, team: '간호팀' },
  { g: '전산', t: '[케어포] 1-3. 기초평가 — 욕창위험도 평가', off: 3, team: '간호팀' },
  { g: '전산', t: '[케어포] 1-3. 기초평가 — 인지기능 평가', off: 3, team: '간호팀' },
  { g: '전산', t: '[케어포] 3-1-2. 수급자 체중 관리', off: 3, team: '간호팀' },
  { g: '전산', t: '[케어포] 3-1-3. 구강상태 점검', off: 3, team: '간호팀' },
  { g: '전산', t: '[케어포] 물리작업치료 평가 및 계획', off: 3, team: '물리치료사' },
  { g: '전산', t: '[케어포] 1-3. 기초평가 — 욕구사정', off: 3 },
  { g: '전산', t: '[케어포] 급여제공계획서 등록 및 보호자 발송', off: 3 },
  { g: '전산', t: '[케어포] 급여제공계획서 발송 유선 안내 작성', off: 3 },
  { g: '전산', t: '[케어포] 프로그램 그룹 설정', off: 3 },
  { g: '전산', t: '[케어포] 10-6. 수급자 앨범에 입소 물품 등록', off: 3 },
  { g: '전산', t: '[케어포] 집중배설관찰(72시간) 기록', off: 14, desc: '입소 후 14일 이내 72시간 연속 관찰 — 교환 시간 필수 기재' },
  { g: '전산', t: '상담일지 보호자 소통·사진 전송 (입소일)', off: 0 },
  { g: '전산', t: '상담일지 보호자 소통·사진 전송 (2일차)', off: 1 },
  { g: '전산', t: '상담일지 보호자 소통·사진 전송 (3일차)', off: 2 },
  { g: '전산', t: '입소자 상담 1회차 (입소 후 1주)', off: 7 },
  { g: '전산', t: '입소자 상담 2회차 (입소 후 2주)', off: 14 },
  { g: '전산', t: '입소자 상담 3회차 (입소 후 3주)', off: 21 },
  { g: '전산', t: '입소자 상담 4회차 (입소 후 4주)', off: 28 },
  { g: '전산', t: '입소자 기초 건강상태 작성 및 브리핑 (당일)', off: 0, team: '간호팀' },
  { g: '전산', t: '입소자 기초건강상태 변경 / 재브리핑 (입소 후 7일)', off: 7, team: '간호팀' },
  // ── 입소 당일 업무 ──
  { g: '당일', t: '입소자(보호자) 상호존중 문자 전송 철하기', off: 0 },
  { g: '당일', t: '입소자 파일 철 정리하기', off: 0 },
  { g: '당일', t: '입소자 물품 소독', off: 0, team: '간호팀' },
  { g: '당일', t: '의복 정리 및 이름 적기', off: 0 },
  { g: '당일', t: '이름표 부착 (틀니통)', off: 0 },
  { g: '당일', t: '이름표 부착 (휠체어·에어매트·워커)', off: 0 },
  { g: '당일', t: '배식 이름표 제작', off: 0 },
  { g: '당일', t: '색상 팔찌·침상 스티커·재실 알림판 변경', off: 0 },
  { g: '당일', t: '입소자 옴 예방 크림 도포 (요양보호사 주간자)', off: 0, team: '간호팀' },
  { g: '당일', t: '옴 예방 크림 도포 후 다음날 목욕', off: 1, team: '간호팀' },
  { g: '당일', t: '입소자 구강 및 피부 확인', off: 0, team: '간호팀' },
  { g: '당일', t: '입소자 의류 및 소지품 기록지', off: 0 },
]

// 조건부 그룹 — 대상자 구분에 따라
const ADM_BASIC_MEDICAL: AdmTpl[] = [
  { g: '기초의료', t: '장기요양기관 입소 — 이용신청서 (기초의료)', off: 0 },
  { g: '기초의료', t: '장기요양기관 입소 — 이용의뢰서 (기초의료)', off: 0 },
]
const ADM_RESTRAINT: AdmTpl[] = [
  { g: '신체제재', t: '[케어포] 신체제재 신규등록', off: 0 },
  { g: '신체제재', t: '신체제재 기록 인쇄 후 보호자 서명 받기', off: 0 },
  { g: '신체제재', t: '[케어포] 신체제재 통지기록 작성', off: 0 },
  { g: '신체제재', t: "[구글] '행복한_신체제재명단' 변경 및 안내", off: 0 },
  { g: '신체제재', t: '[다음날] 신체제재 경과기록지 작성 및 확인', off: 1 },
]
const ADM_POSITIONING: AdmTpl[] = [
  { g: '다음날', t: '[케어포] 3-1-3. 욕창방지 도구 체크', off: 1, team: '간호팀' },
  { g: '다음날', t: '[케어포] 체위변경 표 침실 부착', off: 1 },
  { g: '다음날', t: '[케어포] 체위변경 기록지 작성 및 확인', off: 1 },
]
const ADM_PRESSURE: AdmTpl[] = [
  { g: '욕창', t: '체위변경 대상자의 경우 서류에 체크', off: 0 },
  { g: '욕창', t: '[케어포] 3-1-3. 욕창 간호 기록 작성', off: 0, team: '간호팀' },
]

const plusDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  const p2 = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`
}

// 퇴소 시 자동 생성 템플릿 (2건) — 전산 보고
const DISCHARGE_TEMPLATES = [
  { templateId:'tpl_dis26_01', title:'[희망이음] 희망이음 퇴소 보고', description:'희망이음에 퇴소 보고 등록', evidenceRequired:'', storageLocation:'', howTo:'', evalNote:'', riskLevel:'high', relatedIndicatorId:'si25', relatedCategoryId:'cat5', relatedDomainId:'dom3' },
  { templateId:'tpl_dis26_02', title:'[롱텀케어] 퇴소 등록', description:'롱텀케어(장기요양정보시스템)에 퇴소 등록', evidenceRequired:'', storageLocation:'', howTo:'', evalNote:'', riskLevel:'high', relatedIndicatorId:'si25', relatedCategoryId:'cat5', relatedDomainId:'dom3' },
]

// 입사 시 자동 생성 템플릿 — 그룹은 제목의 [입사전]/[7일 이내]/[1달 이내] 태그로 인코딩
// off: 입사일 기준 기한 오프셋(일), months: 개월 단위 오프셋(우선)
const HIRE_TPL: { g: string; t: string; off?: number; months?: number; risk?: string; evalNote?: string }[] = [
  // 입사 전 — 기한은 입사일
  { g:'입사전', t:'케어포 ID/PW 만들기', off:0 },
  { g:'입사전', t:'카드키 만들기', off:0 },
  { g:'입사전', t:'건강검진 결과 통보서 1년 이내 확인', off:0, risk:'high', evalNote:'1년 초과 또는 미제출 시 직원건강관리(4점) 감점' },
  { g:'입사전', t:'입사 서류 안내 하기', off:0 },
  { g:'입사전', t:'근무표 만들기', off:0 },
  // 입사 7일 이내
  { g:'7일 이내', t:'신규직원 교육', off:7, risk:'high', evalNote:'7일 초과 시 운영규정(1점) 감점' },
  { g:'7일 이내', t:'[희망이음] 입퇴사 보고', off:7 },
  { g:'7일 이내', t:'[희망이음] 인력 변경 보고', off:7 },
  { g:'7일 이내', t:'노인 인권 교육 하기', off:7 },
  { g:'7일 이내', t:'근로계약 및 서류 챙기기', off:7 },
  // 입사 1달 이내
  { g:'1달 이내', t:'퇴직연금 등록', months:1 },
  { g:'1달 이내', t:'회계 업체 입퇴사 보고', months:1 },
  { g:'1달 이내', t:'4대 보험 가입 확인', months:1 },
]

function makeItem(tpl: any, personId: string, personName: string, personType: 'resident' | 'staff', dueDate: string, frequency: string) {
  return {
    id: generateId(),
    title: `[${personName}] ${tpl.title}`,
    description: tpl.description,
    frequency,
    relatedIndicatorId: tpl.relatedIndicatorId,
    relatedCategoryId:  tpl.relatedCategoryId,
    relatedDomainId:    tpl.relatedDomainId,
    assignee: personType === 'resident' ? '담당 사회복지사' : '시설장',
    dueDate,
    evidenceRequired: tpl.evidenceRequired,
    storageLocation:  tpl.storageLocation,
    howTo:            tpl.howTo,
    evalNote:         tpl.evalNote,
    completed:        false,
    completionHistory: [],
    memo:             '',
    attachmentName:   '',
    riskLevel:        tpl.riskLevel,
    active:           true,
    createdAt:        today(),
    personId,
    personName,
    personType,
    templateId:       tpl.templateId,
  }
}

export function generateResidentAdmissionChecklists(
  resident: { id: string; name: string; admissionDate: string },
  flags: AdmissionFlags = {},
) {
  const base = (resident.admissionDate || today()).slice(0, 10)
  const list: AdmTpl[] = [
    ...ADM,
    ...(flags.basicMedical ? ADM_BASIC_MEDICAL : []),
    ...(flags.restraint ? ADM_RESTRAINT : []),
    ...(flags.positioning ? ADM_POSITIONING : []),
    ...(flags.pressureSore ? ADM_PRESSURE : []),
  ]
  return list.map((tpl, i) =>
    makeItem({
      templateId: `tpl_adm26_${String(i + 1).padStart(2, '0')}`,
      title: `[${tpl.g}] ${tpl.t}`,
      description: tpl.desc ?? '',
      evidenceRequired: '', storageLocation: '', howTo: '', evalNote: '',
      riskLevel: tpl.risk ?? 'medium',
    }, resident.id, resident.name, 'resident', plusDays(base, tpl.off), 'on_admission')
  ).map((item, i) => ({ ...item, assignee: list[i].team ?? '복지팀' }))
}

export function generateResidentDischargeChecklists(resident: { id: string; name: string }, dischargeDate: string) {
  // 기한: 퇴소일 + 7일 (전산 보고는 신속하게)
  const due = plusDays((dischargeDate || today()).slice(0, 10), 7)
  return DISCHARGE_TEMPLATES.map(tpl =>
    makeItem(tpl, resident.id, resident.name, 'resident', due, 'on_discharge')
  )
}

// 퇴사 시 자동 생성 템플릿 (6건) — 제목 태그 [퇴사]로 그룹 인코딩
const RESIGN_TPL: string[] = [
  '사직서 등록',
  '희망이음 입퇴사 보고',
  '희망이음 인력 변경 보고',
  '회계 업체 입퇴사 등록',
  '퇴직연금 해제',
  '카드키 반납 및 반환금 이체',
]

export function generateStaffResignChecklists(staff: { id: string; name: string }, resignDate: string) {
  // 기한: 퇴사일 + 7일
  const due = plusDays((resignDate || today()).slice(0, 10), 7)
  return RESIGN_TPL.map((t, i) =>
    makeItem({
      templateId: `tpl_resign26_${String(i + 1).padStart(2, '0')}`,
      title: `[퇴사] ${t}`,
      description: '', evidenceRequired: '', storageLocation: '', howTo: '', evalNote: '',
      riskLevel: 'medium',
    }, staff.id, staff.name, 'staff', due, 'on_resign')
  )
}

export function generateStaffHireChecklists(staff: { id: string; name: string; hireDate: string }) {
  const base = (staff.hireDate || today()).slice(0, 10)
  return HIRE_TPL.map((tpl, i) =>
    makeItem({
      templateId: `tpl_hire26_${String(i + 1).padStart(2, '0')}`,
      title: `[${tpl.g}] ${tpl.t}`,
      description: '',
      evidenceRequired: '', storageLocation: '', howTo: '',
      evalNote: tpl.evalNote ?? '',
      riskLevel: tpl.risk ?? 'medium',
    }, staff.id, staff.name, 'staff',
      tpl.months ? plusMonths(base, tpl.months) : plusDays(base, tpl.off ?? 0),
      'on_hire')
  )
}
