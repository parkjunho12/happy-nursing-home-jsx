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

// 퇴소 시 자동 생성 템플릿 (1건)
const DISCHARGE_TEMPLATES = [
  { templateId:'tpl_dis_01', title:'연계기록지 및 급여이용종료 상담 실시', description:'퇴소 전 연계기록지 작성 및 급여이용종료 상담 실시', evidenceRequired:'연계기록지, 급여이용종료 상담 기록', storageLocation:'퇴소파일 > 연계기록', howTo:'퇴소 전 사회복지사가 수급자/보호자와 상담. 연계기관 정보 기재', evalNote:'미실시 시 급여제공계획(2점) 감점', riskLevel:'medium', relatedIndicatorId:'si25', relatedCategoryId:'cat5', relatedDomainId:'dom3' },
]

// 입사 시 자동 생성 템플릿 (2건)
const HIRE_TEMPLATES = [
  { templateId:'tpl_hire_01', title:'입사 7일 이내 운영규정 교육', description:'입사 후 7일 이내 운영규정 교육 실시 및 서명', evidenceRequired:'운영규정 교육 확인서, 서명', storageLocation:'인사파일 > 신규 직원 교육', howTo:'입사 후 7일 이내 운영규정 전달 및 교육. 서명 받기', evalNote:'7일 초과 시 운영규정(1점) 감점', riskLevel:'high', relatedIndicatorId:'si01', relatedCategoryId:'cat1', relatedDomainId:'dom1' },
  { templateId:'tpl_hire_02', title:'건강검진 결과 통보서 확인 (1년 이내)', description:'입사 전 1년 이내 건강검진 결과 통보서 제출 여부 확인', evidenceRequired:'건강검진 결과 통보서 (입사 기준 1년 이내)', storageLocation:'인사파일 > 건강관리', howTo:'입사 시 1년 이내 결과서 제출 요청. 1년 초과 결과 불인정', evalNote:'1년 초과 또는 미제출 시 직원건강관리(4점) 감점', riskLevel:'high', relatedIndicatorId:'si05', relatedCategoryId:'cat1', relatedDomainId:'dom1' },
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

export function generateResidentDischargeChecklists(resident: { id: string; name: string }, _dischargeDate: string) {
  // 기한: 생성일(오늘)로부터 1개월
  const due = plusMonths(today(), 1)
  return DISCHARGE_TEMPLATES.map(tpl =>
    makeItem(tpl, resident.id, resident.name, 'resident', due, 'on_discharge')
  )
}

export function generateStaffHireChecklists(staff: { id: string; name: string; hireDate: string }) {
  // tpl_hire_01: 7일 이내
  const due7 = (() => {
    const d = new Date(staff.hireDate); d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })()
  return HIRE_TEMPLATES.map(tpl =>
    makeItem(tpl, staff.id, staff.name, 'staff',
      tpl.templateId === 'tpl_hire_01' ? due7 : staff.hireDate,
      'on_hire')
  )
}
