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

// 입소 시 자동 생성 템플릿 (12건)
const ADMISSION_TEMPLATES = [
  { templateId:'tpl_adm_01', title:'폭언·폭행·성희롱 예방 안내 문자 발송', description:'입소 시 보호자에게 폭언·폭행·성희롱 예방 및 상호존중 내용 문자 안내', evidenceRequired:'문자 발송 이력', storageLocation:'입소파일 > 입소 안내', howTo:'입소 당일 보호자 연락처로 안내 문자 발송. 발송 이력 저장', evalNote:'미발송 시 수급자의 권리(3점) 감점', riskLevel:'medium', relatedIndicatorId:'si15', relatedCategoryId:'cat3', relatedDomainId:'dom2' },
  { templateId:'tpl_adm_02', title:'입소 후 4주 면담 (주 1회, 5개 항목)', description:'입소 후 4주간 주 1회 이상 면담 실시 — 상담일자·직원명·방법·수급자명·내용', evidenceRequired:'면담 기록지 (4회 이상, 5개 항목)', storageLocation:'상담파일 > 입소 초기 면담', howTo:'입소 당일 첫 면담 후 매주 1회 실시. 5개 항목 빠짐없이 기재', evalNote:'4주 미실시 또는 항목 누락 시 수급자참여강화(3점) 감점', riskLevel:'high', relatedIndicatorId:'si13', relatedCategoryId:'cat3', relatedDomainId:'dom2' },
  { templateId:'tpl_adm_03', title:'노인인권보호지침 제공', description:'입소 시 수급자 또는 보호자에게 노인인권보호지침 제공 및 수령 서명', evidenceRequired:'노인인권보호지침 수령 확인서', storageLocation:'입소파일 > 권리 안내', howTo:'입소 당일 지침 출력 제공 후 서명 받기', evalNote:'미제공 또는 서명 없을 시 감점', riskLevel:'medium', relatedIndicatorId:'si15', relatedCategoryId:'cat3', relatedDomainId:'dom2' },
  { templateId:'tpl_adm_04', title:'보호자 연명의료결정제도 안내', description:'입소 시 보호자에게 연명의료결정제도 설명 및 서명', evidenceRequired:'연명의료 안내 확인서 (보호자 서명)', storageLocation:'입소파일 > 생애말기 관련', howTo:'입소 당일 안내문 제공 후 보호자 서명 받기', evalNote:'미안내 시 생애말기 돌봄(2점) 감점', riskLevel:'medium', relatedIndicatorId:'si20', relatedCategoryId:'cat3', relatedDomainId:'dom2' },
  { templateId:'tpl_adm_05', title:'입소 전 건강진단 결과 확인 (30일 이내)', description:'급여 개시 전 건강진단 결과 확인 — 입소일 포함 30일 이내 결과만 인정', evidenceRequired:'건강진단 결과서 (30일 이내)', storageLocation:'간호파일 > 입소 건강진단', howTo:'입소 당일 결과서 제출 여부 확인. 30일 초과 결과는 재검진 요청', evalNote:'30일 초과 또는 미제출 시 수급자건강관리 감점', riskLevel:'high', relatedIndicatorId:'si23', relatedCategoryId:'cat4', relatedDomainId:'dom2' },
  { templateId:'tpl_adm_06', title:'욕구사정·낙상·욕창·인지기능 평가 (반기)', description:'장기요양등급 인정서 기준 반기 1회 욕구사정·낙상위험도·욕창위험도·인지기능 평가', evidenceRequired:'욕구사정지, 낙상위험도, 욕창위험도(Braden), 인지기능평가 4종', storageLocation:'개인파일 > 반기 종합 평가', howTo:'등급 인정서 기준 6개월마다 4종 평가 실시. 결과를 급여계획에 반영', evalNote:'4종 중 1종 누락 시 통합적사정(2점) 감점', riskLevel:'high', relatedIndicatorId:'si24', relatedCategoryId:'cat5', relatedDomainId:'dom3' },
  { templateId:'tpl_adm_07', title:'급여제공계획 작성 및 공단 통보 (반기)', description:'욕구사정 결과 기반 급여제공계획 수립 후 공단 통보 (반기 1회)', evidenceRequired:'급여제공계획서, 공단 통보 확인서', storageLocation:'개인파일 > 급여제공계획', howTo:'욕구사정 완료 후 계획서 작성. 수급자·보호자 서명 후 공단 전산 통보', evalNote:'공단 미통보 또는 계획서 미작성 시 감점', riskLevel:'high', relatedIndicatorId:'si25', relatedCategoryId:'cat5', relatedDomainId:'dom3' },
  { templateId:'tpl_adm_08', title:'급여제공결과 평가 (반기)', description:'급여제공계획 목표 달성 여부를 반기 1회 평가', evidenceRequired:'급여제공결과 평가지', storageLocation:'개인파일 > 결과평가', howTo:'계획 목표 대비 달성 여부 평가 후 다음 계획에 반영', evalNote:'반기 미실시 시 감점', riskLevel:'medium', relatedIndicatorId:'si37', relatedCategoryId:'cat7', relatedDomainId:'dom4' },
  { templateId:'tpl_adm_09', title:'신체·인지기능 프로그램 계획 수립 (반기)', description:'수급자별 신체·인지기능 프로그램 계획 반기 1회 수립', evidenceRequired:'신체·인지 프로그램 계획서', storageLocation:'개인파일 > 프로그램 계획', howTo:'기능 평가 결과 반영하여 개인별 계획 수립. 반기마다 재수립', evalNote:'미수립 시 감점', riskLevel:'medium', relatedIndicatorId:'si25', relatedCategoryId:'cat5', relatedDomainId:'dom3' },
  { templateId:'tpl_adm_10', title:'14일 이내 72시간 집중배설관리', description:'입소 후 14일 이내 72시간 연속 집중배설 관찰 기록표 작성 (교환 시간 필수)', evidenceRequired:'집중배설 관찰 기록표 (교환 시간 기재)', storageLocation:'간호파일 > 배설관리', howTo:'입소 후 14일 내 임의 72시간 배설 패턴 관찰. 기저귀 교환 시 교환 시간 명시. 주기적 교환 기록 불인정', evalNote:'미실시 또는 교환 시간 미기재 시 배설관리(2점) 감점', riskLevel:'high', relatedIndicatorId:'si28', relatedCategoryId:'cat6', relatedDomainId:'dom3' },
  { templateId:'tpl_adm_11', title:'기능회복 훈련 계획 작성 (입소 시)', description:'입소 시 수급자별 기능회복 훈련 계획 작성. 이후 연 1회 재작성', evidenceRequired:'기능회복 훈련 계획서', storageLocation:'재활파일 > 기능회복 훈련', howTo:'입소 후 기능평가 결과로 훈련 계획 수립. 매년 재작성하며 상태 변화 반영', evalNote:'미작성 또는 연 주기 미재작성 시 감점', riskLevel:'medium', relatedIndicatorId:'si34', relatedCategoryId:'cat6', relatedDomainId:'dom3' },
  { templateId:'tpl_adm_12', title:'기피식품 파악 및 대체식품 제공 확인', description:'입소 시 수급자 기피식품 파악 후 대체식품 제공 계획 수립 및 주방 공유', evidenceRequired:'기피식품 파악 기록, 대체식품 제공 확인', storageLocation:'개인파일 > 식이관리', howTo:'입소 면담 시 기피식품 목록 작성 후 조리팀에 공유', evalNote:'기피식품 미파악 시 개별욕구존중(2점) 감점', riskLevel:'low', relatedIndicatorId:'si16', relatedCategoryId:'cat3', relatedDomainId:'dom2' },
]

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

export function generateResidentAdmissionChecklists(resident: { id: string; name: string; admissionDate: string }) {
  // 기한: 생성일(오늘)로부터 1개월
  const due = plusMonths(today(), 1)
  return ADMISSION_TEMPLATES.map(tpl =>
    makeItem(tpl, resident.id, resident.name, 'resident', due, 'on_admission')
  )
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
