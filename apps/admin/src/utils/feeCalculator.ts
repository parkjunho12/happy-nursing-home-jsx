/**
 * 2026년 노인요양시설(시설급여) 수입·가산·인건비 계획 계산기.
 *
 * 이 파일은 "보수적인 계획 숫자"를 만든다. 공단 청구 결과나 법적 기준
 * 충족 여부를 판정하지 않는다. 확인되지 않은 가산은 0으로 두고, 인력
 * 배치·인건비 비율은 계획용 추정치로만 낸다. 실제 청구·감사 판단은
 * 고시 원문과 공단 통보를 따른다.
 *
 * 근거: 보건복지부 고시 제2025-247호(2025.12.30 개정)
 * 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」
 * - 국가법령정보센터: https://www.law.go.kr (행정규칙 → 고시명으로 검색)
 * - 노인장기요양보험(공단): https://www.longtermcare.or.kr
 *
 * 이 파일이 쓰는 조문
 * - 제44조 시설급여 비용: 2026년 등급별 1일 수가. 2.1:1 이상('enhanced') /
 *   2.1:1 미만('standard') 두 단가. 단가 선택은 사용자가 직접 고른다.
 *   이 계산기가 인력 기준 충족을 확인해 주지 않는다.
 * - 제47조 입소자: 월별 입소자수 = 일자별 합계 ÷ 급여제공일수, 소수점 반올림
 *   → averageResidents는 정수로 받는다.
 * - 제48조 인력배치기준: 계산 결과 소수점 반올림, 0.5 미만이면 1명
 *   → requiredCaregiversLegal(참고값). 계획값은 별도로 올림(ceil).
 * - 제56조 인력추가배치 가산: 가산금액 = 가산 기준금액(급여비용 합의 80%)
 *   × (가산점수 합 ÷ 입소자수) × 서비스유형점수(시설 1점).
 *   간호(조무)사 1인 1.2점, 사회복지사·물리(작업)치료사 1인 1.4점.
 *   인정범위: 10명 미만 1.4, 10~29 2.6, 30~49 4.0, 50~69 5.2, 70~89 6.6, 90 이상 7.8.
 *   제56조의2(요양보호사 초과배치 한시 가산)는 인정범위 밖.
 * - 제59조 간호사배치 가산: 간호사 1인당 0.6점. 입소자 50인 이상
 *   노인요양시설은 (기관 단위로) 0.2점을 더한다 — 간호사당 0.8이 아니다.
 * - 제60조 야간직원배치 가산: 1명 이상 근무 시 기관당 0.9점, 또는
 *   (야간 1인당 입소자 20인 이하 AND 주간 인원 ≥ 야간×2, 20인 미만은 동수)
 *   이면 야간직원 1인당 0.9점. 야간·주간 인력수 계산은 공단이 정한다
 *   (제60조④) → dayStaff/nightStaff는 소수 FTE 허용.
 *   지급받은 가산금은 야간 근무자에게 지급해야 한다(제60조⑤).
 * - 제62조 맞춤형서비스제공 가산: 주 4회/월 16회 이상 0.5점, 주 2~3회/월 8회 이상 0.25점.
 * - 제11조의2 인건비 지출비율: 노인요양시설 62.6%. 기준 급여비용(②)에는
 *   제11조의4 장기근속 장려금, 제44조, 제56조, 제59조, 제60조 등이 들어가고
 *   제56조의2·제62조는 들어가지 않는다. 연 단위(1.1~12.31)로 본다.
 *
 * 실제 청구·정산 금액이나 특정 시설의 과거 실적은 여기 들어 있지 않다.
 */

export type FeeTier = 'enhanced' | 'standard'

export interface FeeInputs {
  /** 'YYYY-MM'. 2026년만 지원한다. */
  month: string
  /** 수가 단가 구분. 사용자가 직접 선택한다(자동 판정 아님). */
  tier: FeeTier
  /** [1등급, 2등급, 3~5등급] 인원 */
  counts: number[]
  /** 청구 일수(전원 동일 가정, 예측용). 달의 일수 이하 */
  days: number
  /** 가산 분모로 쓰는 월 평균 인정 입소자수. 인원 합계와 별개로 적는다 */
  averageResidents: number
  /** 정원. 0이면 미입력 */
  capacity: number
  /** 본인부담률 가중 평균(0, 0.08, 0.12, 0.20 사이) */
  copayRate: number
  /** 식재료비 1식 단가 */
  mealPrice: number
  mealsPerDay: number
  /** 간식비 1회 단가 */
  snackPrice: number
  snacksPerDay: number
  /** 비급여(식재료·간식) 청구 일수 */
  noncoveredDays: number
  /** 인력추가배치 — 간호(조무)사 추가 인원(1인 1.2점) */
  extraNursing: number
  /** 인력추가배치 — 사회복지사 추가 인원(1인 1.4점) */
  extraSocial: number
  /** 인력추가배치 — 물리(작업)치료사 추가 인원(1인 1.4점) */
  extraTherapy: number
  /** 간호사 배치 가산 대상 간호사 수(1인 0.6점, 50인 이상 시설은 기관당 +0.2점) */
  registeredNurses: number
  /** 주간(06~22시) 요양보호사+간호(조무)사 인원(공단 산정 FTE, 소수 허용) */
  dayStaff: number
  /** 야간(22~06시) 요양보호사+간호(조무)사 인원(공단 산정 FTE, 소수 허용) */
  nightStaff: number
  /** 맞춤형 서비스 가산 점수: 0, 0.25, 0.5 */
  programPoints: number
  programConfirmed: boolean
  /** 인력추가배치·간호사 가산 인정 여부를 확인했는가 */
  staffingConfirmed: boolean
  /** 야간 배치 가산 인정 여부를 확인했는가 */
  nightConfirmed: boolean
  /** 요양보호사 초과배치 한시 가산 등, 사용자가 직접 인정받은 점수 */
  temporaryPoints: number
  temporaryConfirmed: boolean
  /** 실제 요양보호사 FTE */
  caregiverFte: number
  /** 월 인건비 지출액(0이면 미입력) */
  payroll: number
  /** 인건비 비율 산정 기준 금액. 0이면 (수가+가산−맞춤형−한시)으로 근사 추정 */
  laborBasis: number
  /** 인건비 외 월 지출 */
  otherCosts: number
  /** 추가 채용 시 월 비용(사회복지사 1인 가정) */
  hireCost: number
}

export interface FeeResult {
  /** 등급별 인원 합계 */
  residents: number
  /** 급여비용 합(수가 × 인원 × 일수) */
  base: number
  /** 본인부담금 */
  copay: number
  /** 공단 청구액(가산 전) */
  insurer: number
  /** 비급여(식재료+간식) */
  noncovered: number
  /** 가산 기준금액 = base × 0.8 */
  bonusBase: number
  extraPoints: number
  nursePoints: number
  nightPoints: number
  programPoints: number
  temporaryPoints: number
  extraBonus: number
  nurseBonus: number
  nightBonus: number
  programBonus: number
  temporaryBonus: number
  /** 가산 합계 */
  bonus: number
  /** 시설 총수입 = base + bonus + noncovered */
  total: number
  /** 가산 후 공단 청구액 = insurer + bonus */
  insuranceTotal: number
  /** 계획용 요양보호사 필요 인원(입소자/2.1). 법정 판정이 아니다 */
  requiredCaregiversRaw: number
  /** 올림한 계획 인원(보수적) */
  requiredCaregiversPlan: number
  /**
   * 제48조 산식 참고값: 반올림, 0.5 미만이면 1명. 입소자 0이면 0.
   * 실제 배치 판정은 공단 근무인원 산정(제51조)을 따르므로 참고용이다.
   */
  requiredCaregiversLegal: number
  /** 인건비 최소액 계산에 실제로 쓴 기준 금액 */
  laborBasisUsed: number
  /** caregiverFte − plan. 음수면 계획 대비 부족 */
  caregiverGap: number
  /** 인건비 최소 지출 추정(62.6%) */
  laborMinimum: number
  /** payroll − laborMinimum. payroll 0이면 의미 없음 */
  laborGap: number
  /** total − payroll − otherCosts */
  operatingBalance: number
  /** 사회복지사 1인 추가 시 늘어나는 인력추가배치 가산(한도 반영) */
  hireBonus: number
  /** hireBonus − hireCost */
  hireNet: number
  warnings: string[]
}

export const SUPPORTED_YEAR = 2026

export const RATES: Record<FeeTier, readonly [number, number, number]> = {
  enhanced: [93070, 86340, 81540],
  standard: [88520, 82120, 77540],
}

/** 가산 기준금액 비율 (급여비용 합의 80%) */
export const BONUS_BASE_RATIO = 0.8
/** 노인요양시설 인건비 지출 비율 */
export const LABOR_RATIO = 0.626
/** 요양보호사 배치 기준(입소자 n명당 1인) */
export const CAREGIVER_RATIO = 2.1

export const POINTS = {
  extraNursing: 1.2,
  extraSocial: 1.4,
  extraTherapy: 1.4,
  nurse: 0.6,
  /** 제59조② 입소자 50인 이상 노인요양시설: 기관 단위로 더하는 점수 */
  nurseLargeExtra: 0.2,
  nurseLargeThreshold: 50,
  night: 0.9,
  nightResidentsPerStaff: 20,
  nightEqualBelow: 20,
} as const

export const PROGRAM_POINT_OPTIONS = [0, 0.25, 0.5] as const

const MONTH_RE = /^(\d{4})-(\d{2})$/

export function daysInMonth(month: string): number {
  const m = MONTH_RE.exec(month)
  if (!m) return NaN
  const year = Number(m[1])
  const mon = Number(m[2])
  if (mon < 1 || mon > 12) return NaN
  return new Date(Date.UTC(year, mon, 0)).getUTCDate()
}

/** 인력추가배치 가산점수 인정 한도(입소자수 기준) */
export function extraCap(residents: number): number {
  if (residents < 10) return 1.4
  if (residents < 30) return 2.6
  if (residents < 50) return 4.0
  if (residents < 70) return 5.2
  if (residents < 90) return 6.6
  return 7.8
}

export function defaultInputs(month: string): FeeInputs {
  const dim = daysInMonth(month)
  const days = Number.isFinite(dim) ? dim : 0
  return {
    month,
    tier: 'enhanced',
    counts: [0, 0, 0],
    days,
    averageResidents: 0,
    capacity: 0,
    copayRate: 0.2,
    mealPrice: 4000,
    mealsPerDay: 3,
    snackPrice: 750,
    snacksPerDay: 2,
    noncoveredDays: days,
    extraNursing: 0,
    extraSocial: 0,
    extraTherapy: 0,
    registeredNurses: 0,
    dayStaff: 0,
    nightStaff: 0,
    programPoints: 0,
    programConfirmed: false,
    staffingConfirmed: false,
    nightConfirmed: false,
    temporaryPoints: 0,
    temporaryConfirmed: false,
    caregiverFte: 0,
    payroll: 0,
    laborBasis: 0,
    otherCosts: 0,
    hireCost: 0,
  }
}

/* ------------------------------------------------------------------ */
/* 검증                                                                */
/* ------------------------------------------------------------------ */

type NumericKey = {
  [K in keyof FeeInputs]: FeeInputs[K] extends number ? K : never
}[keyof FeeInputs]

const NUMERIC_KEYS: NumericKey[] = [
  'days',
  'averageResidents',
  'capacity',
  'copayRate',
  'mealPrice',
  'mealsPerDay',
  'snackPrice',
  'snacksPerDay',
  'noncoveredDays',
  'extraNursing',
  'extraSocial',
  'extraTherapy',
  'registeredNurses',
  'dayStaff',
  'nightStaff',
  'programPoints',
  'temporaryPoints',
  'caregiverFte',
  'payroll',
  'laborBasis',
  'otherCosts',
  'hireCost',
]

/**
 * 정수만 받는 항목.
 * - averageResidents: 제47조② 월별 입소자수는 반올림한 정수
 * - extraNursing·extraSocial·extraTherapy·registeredNurses: 가산 인정 인원은 공단이 정수로 산정
 * - dayStaff/nightStaff는 제60조④ 공단 산정 FTE라 소수를 허용한다
 */
const INTEGER_KEYS: NumericKey[] = [
  'days',
  'averageResidents',
  'capacity',
  'mealsPerDay',
  'snacksPerDay',
  'noncoveredDays',
  'extraNursing',
  'extraSocial',
  'extraTherapy',
  'registeredNurses',
]

const BOOLEAN_KEYS: (keyof FeeInputs)[] = [
  'programConfirmed',
  'staffingConfirmed',
  'nightConfirmed',
  'temporaryConfirmed',
]

/** 입력 상한. 오타(0 하나 더 붙음)를 잡기 위한 계획용 경계다 */
const BOUNDS: Partial<Record<NumericKey, number>> = {
  averageResidents: 1000,
  capacity: 1000,
  copayRate: 0.2,
  mealPrice: 100000,
  mealsPerDay: 5,
  snackPrice: 100000,
  snacksPerDay: 5,
  extraNursing: 50,
  extraSocial: 50,
  extraTherapy: 50,
  registeredNurses: 50,
  dayStaff: 200,
  nightStaff: 100,
  temporaryPoints: 20,
  caregiverFte: 500,
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function validateInputs(x: FeeInputs): string[] {
  const errors: string[] = []
  if (!x || typeof x !== 'object') return ['입력이 없습니다']

  if (typeof x.month !== 'string' || !MONTH_RE.test(x.month)) {
    errors.push("month: 'YYYY-MM' 형식이어야 합니다")
  } else {
    const dim = daysInMonth(x.month)
    if (!Number.isFinite(dim)) {
      errors.push('month: 존재하지 않는 달입니다')
    } else if (Number(x.month.slice(0, 4)) !== SUPPORTED_YEAR) {
      errors.push(`month: ${SUPPORTED_YEAR}년 수가만 지원합니다`)
    }
  }

  if (x.tier !== 'enhanced' && x.tier !== 'standard') {
    errors.push("tier: 'enhanced' 또는 'standard'여야 합니다")
  }

  if (!Array.isArray(x.counts) || x.counts.length !== 3) {
    errors.push('counts: [1등급, 2등급, 3~5등급] 세 칸이어야 합니다')
  } else {
    x.counts.forEach((c, i) => {
      if (!isFiniteNumber(c) || c < 0 || !Number.isInteger(c)) {
        errors.push(`counts[${i}]: 0 이상 정수여야 합니다`)
      } else if (c > 1000) {
        errors.push(`counts[${i}]: 1000 이하여야 합니다`)
      }
    })
  }

  for (const key of NUMERIC_KEYS) {
    const v = x[key]
    if (!isFiniteNumber(v)) {
      errors.push(`${key}: 숫자여야 합니다`)
      continue
    }
    if (v < 0) errors.push(`${key}: 음수일 수 없습니다`)
    if (INTEGER_KEYS.includes(key) && !Number.isInteger(v)) {
      errors.push(`${key}: 정수여야 합니다`)
    }
    const max = BOUNDS[key]
    if (max !== undefined && v > max) errors.push(`${key}: ${max} 이하여야 합니다`)
  }

  for (const key of BOOLEAN_KEYS) {
    if (typeof x[key] !== 'boolean') errors.push(`${key}: true/false여야 합니다`)
  }

  const dim = typeof x.month === 'string' ? daysInMonth(x.month) : NaN
  if (Number.isFinite(dim)) {
    if (isFiniteNumber(x.days) && x.days > dim) {
      errors.push(`days: ${x.month}은 ${dim}일까지입니다`)
    }
    if (isFiniteNumber(x.noncoveredDays) && x.noncoveredDays > dim) {
      errors.push(`noncoveredDays: ${x.month}은 ${dim}일까지입니다`)
    }
  }

  if (
    isFiniteNumber(x.programPoints) &&
    !PROGRAM_POINT_OPTIONS.some((p) => p === x.programPoints)
  ) {
    errors.push('programPoints: 0, 0.25, 0.5 중 하나여야 합니다')
  }

  return errors
}

/* ------------------------------------------------------------------ */
/* 계산                                                                */
/* ------------------------------------------------------------------ */

/** 점수는 소수 둘째 자리에서 내림 (부동소수 오차 보정 포함) */
export function floorPoints(p: number): number {
  return Math.floor(p * 100 + 1e-7) / 100
}

/** 금액은 10원 단위 내림 (추정치이므로 보수적으로) */
export function floorWon(v: number): number {
  return Math.floor(v / 10 + 1e-7) * 10
}

function bonusFor(bonusBase: number, points: number, denominator: number): number {
  if (denominator <= 0 || points <= 0) return 0
  return floorWon((bonusBase * points) / denominator)
}

function rawExtraPoints(x: FeeInputs): number {
  return (
    x.extraNursing * POINTS.extraNursing +
    (x.extraSocial + x.extraTherapy) * POINTS.extraTherapy
  )
}

export function calculateFee(x: FeeInputs): FeeResult {
  const errors = validateInputs(x)
  if (errors.length) {
    throw new Error(`feeCalculator 입력 오류: ${errors.join('; ')}`)
  }

  const warnings: string[] = []
  const dim = daysInMonth(x.month)
  const rates = RATES[x.tier]
  const residents = x.counts[0] + x.counts[1] + x.counts[2]
  const n = x.averageResidents

  /* 수가 */
  const base =
    rates[0] * x.counts[0] * x.days +
    rates[1] * x.counts[1] * x.days +
    rates[2] * x.counts[2] * x.days
  const copay = Math.round(base * x.copayRate)
  const insurer = base - copay
  const noncovered =
    residents *
    x.noncoveredDays *
    (x.mealPrice * x.mealsPerDay + x.snackPrice * x.snacksPerDay)
  const bonusBase = base * BONUS_BASE_RATIO

  /* 가산점수 */
  const cap = extraCap(n)
  const extraRaw = rawExtraPoints(x)
  const extraCapped = floorPoints(Math.min(extraRaw, cap))
  const extraPoints = x.staffingConfirmed ? extraCapped : 0

  /* 제59조: 간호사 1인당 0.6점 + (50인 이상 시설이고 간호사가 있으면) 기관당 0.2점 */
  const nurseLarge = n >= POINTS.nurseLargeThreshold && x.registeredNurses > 0
  const nursePoints = x.staffingConfirmed
    ? floorPoints(
        x.registeredNurses * POINTS.nurse + (nurseLarge ? POINTS.nurseLargeExtra : 0),
      )
    : 0

  let nightPoints = 0
  let nightEnhanced = false
  if (x.nightConfirmed && x.nightStaff >= 1) {
    const ratioOk = n / x.nightStaff <= POINTS.nightResidentsPerStaff
    const dayMultiplier = n < POINTS.nightEqualBelow ? 1 : 2
    const dayOk = x.dayStaff >= x.nightStaff * dayMultiplier
    nightEnhanced = n > 0 && ratioOk && dayOk
    nightPoints = floorPoints(nightEnhanced ? x.nightStaff * POINTS.night : POINTS.night)
  }

  const programPoints = x.programConfirmed ? x.programPoints : 0
  const temporaryPoints = x.temporaryConfirmed ? floorPoints(x.temporaryPoints) : 0

  /* 가산금 */
  const extraBonus = bonusFor(bonusBase, extraPoints, n)
  const nurseBonus = bonusFor(bonusBase, nursePoints, n)
  const nightBonus = bonusFor(bonusBase, nightPoints, n)
  const programBonus = bonusFor(bonusBase, programPoints, n)
  const temporaryBonus = bonusFor(bonusBase, temporaryPoints, n)
  const bonus = extraBonus + nurseBonus + nightBonus + programBonus + temporaryBonus

  const total = base + bonus + noncovered
  const insuranceTotal = insurer + bonus

  /* 인력 계획 — 인원 합계와 평균 현원 중 큰 쪽으로 보수적으로 잡는다 */
  const staffingResidents = Math.max(residents, n)
  const requiredCaregiversRaw = staffingResidents / CAREGIVER_RATIO
  const requiredCaregiversPlan = Math.max(0, Math.ceil(requiredCaregiversRaw - 1e-9))
  const caregiverGap = x.caregiverFte - requiredCaregiversPlan
  /* 제48조 산식 참고값: 인정 입소자수(없으면 인원 합계) ÷ 2.1, 반올림, 0.5 미만이면 1명 */
  const legalResidents = n > 0 ? n : residents
  const requiredCaregiversLegal =
    legalResidents > 0 ? Math.max(1, Math.round(legalResidents / CAREGIVER_RATIO)) : 0

  /*
   * 인건비. 제11조의2②의 기준 급여비용에는 제62조(맞춤형)와 제56조의2(한시)가
   * 없으므로 추정 기준액에서 뺀다. 제11조의4 장기근속 장려금은 들어가야 하지만
   * 이 계산기에 입력이 없어 못 넣는다 → 근사치일 뿐이다.
   */
  const laborBasisUsed =
    x.laborBasis > 0 ? x.laborBasis : base + bonus - programBonus - temporaryBonus
  const laborMinimum = Math.round(laborBasisUsed * LABOR_RATIO)
  const laborGap = x.payroll - laborMinimum
  const operatingBalance = total - x.payroll - x.otherCosts

  /* 채용 시나리오 — 사회복지사 1인(1.4점) 추가의 한도 반영 증분 */
  const hireBefore = bonusFor(bonusBase, floorPoints(Math.min(extraRaw, cap)), n)
  const hireAfter = bonusFor(
    bonusBase,
    floorPoints(Math.min(extraRaw + POINTS.extraSocial, cap)),
    n,
  )
  const hireBonus = hireAfter - hireBefore
  const hireNet = hireBonus - x.hireCost

  /* 경고 */
  if (residents === 0) warnings.push('입소자 인원이 0명입니다 — 수가 0원')
  if (x.capacity === 0) warnings.push('정원 미입력 — 정원 대비 현원 비교 생략')
  else if (residents > x.capacity) {
    warnings.push(`인원 합계 ${residents}명이 정원 ${x.capacity}명을 넘습니다`)
  }
  if (n === 0) {
    warnings.push('평균 현원(가산 분모) 0 — 모든 가산을 0원으로 둡니다')
  } else if (residents !== n) {
    warnings.push(
      `인원 합계 ${residents}명과 평균 현원 ${n}명이 다릅니다 — 가산 분모는 평균 현원 기준`,
    )
  }
  if (x.days < dim) {
    warnings.push(`청구 일수 ${x.days}일 (${x.month}은 ${dim}일) — 전원 동일 일수 가정`)
  }
  if (x.noncoveredDays < dim) {
    warnings.push(`비급여 일수 ${x.noncoveredDays}일 (${x.month}은 ${dim}일)`)
  }
  warnings.push(
    x.tier === 'enhanced'
      ? '수가 단가 2.1:1 이상 — 사용자 선택값이며 인력 기준 충족 여부는 확인하지 않습니다'
      : '수가 단가 2.1:1 미만 — 사용자 선택값입니다',
  )

  const hasStaffingInput = extraRaw > 0 || x.registeredNurses > 0
  if (!x.staffingConfirmed && hasStaffingInput) {
    warnings.push('인력추가배치·간호사 가산 미확인 — 0원으로 둡니다 (staffingConfirmed)')
  }
  if (x.staffingConfirmed && extraRaw > cap) {
    warnings.push(
      `인력추가배치 점수 ${floorPoints(extraRaw)}점이 인정 한도 ${cap}점을 넘어 ${cap}점만 반영`,
    )
  }
  if (x.staffingConfirmed && extraRaw > 0) {
    warnings.push(
      '인력추가배치 가산 인원(간호(조무)사 1.2점, 사회복지사·치료사 1.4점)은 공단이 월 기준근무시간으로 산정한 인원이어야 합니다(제51조)',
    )
  }
  if (x.staffingConfirmed && x.registeredNurses > 0) {
    warnings.push(
      nurseLarge
        ? `간호사 가산 1인 ${POINTS.nurse}점 + 입소자 ${POINTS.nurseLargeThreshold}인 이상 기관당 ${POINTS.nurseLargeExtra}점 (제59조) — 간호사 자격·근무시간 요건 확인 필요`
        : `간호사 가산 1인 ${POINTS.nurse}점 (제59조) — 간호사 자격·근무시간 요건 확인 필요`,
    )
  }
  if (!x.nightConfirmed && x.nightStaff >= 1) {
    warnings.push('야간 배치 가산 미확인 — 0원으로 둡니다 (nightConfirmed)')
  }
  if (x.nightConfirmed && x.nightStaff >= 1 && !nightEnhanced) {
    warnings.push(
      `야간직원배치강화 조건 미충족(야간 1인당 ${POINTS.nightResidentsPerStaff}인 이하, 주간 인원 요건) — 기관당 0.9점만 반영`,
    )
  }
  if (nightBonus > 0) {
    warnings.push('야간 배치 가산은 야간 근무자 처우에 써야 하는 돈입니다 — 자유 수익 아님')
  }
  if (!x.programConfirmed && x.programPoints > 0) {
    warnings.push('맞춤형 프로그램 가산 미확인 — 0원으로 둡니다 (programConfirmed)')
  }
  if (!x.temporaryConfirmed && x.temporaryPoints > 0) {
    warnings.push('한시 가산 미확인 — 0원으로 둡니다 (temporaryConfirmed)')
  }
  if (temporaryPoints > 0) {
    warnings.push('한시 가산은 사용자가 직접 인정받은 점수로 한도 계산에 넣지 않습니다')
  }
  if (x.laborBasis === 0) {
    warnings.push(
      '인건비 기준액 미입력 — (수가+가산−맞춤형−한시)×62.6%로 근사 추정. 장기근속 장려금(제11조의4) 등은 입력이 없어 기준액에 포함하지 못함. 연 단위 판정이며 법정 준수 판정 아님',
    )
  } else {
    warnings.push('인건비 최소액은 62.6% 추정치입니다 — 연 단위 판정이며 법정 준수 판정 아님')
  }
  if (x.payroll === 0) warnings.push('인건비 지출 미입력 — 인건비 격차·운영 수지는 참고용')
  if (caregiverGap < 0) {
    warnings.push(
      `요양보호사 계획 인원 ${requiredCaregiversPlan}명 대비 ${-caregiverGap}명 부족 (계획용, 법정 배치 판정 아님)`,
    )
  } else {
    warnings.push('요양보호사 필요 인원은 계획용 계산입니다 — 법정 배치 판정 아님')
  }
  if (requiredCaregiversLegal !== requiredCaregiversPlan) {
    warnings.push(
      `제48조 산식 참고값 ${requiredCaregiversLegal}명(반올림)과 계획값 ${requiredCaregiversPlan}명(올림)이 다릅니다 — 계획은 올림 기준`,
    )
  }
  if (hireBonus === 0 && n > 0 && extraRaw >= cap) {
    warnings.push('인력추가배치 한도 도달 — 사회복지사 추가 채용 가산 증분 0원')
  }
  if (!x.staffingConfirmed && hireBonus > 0) {
    warnings.push('채용 시나리오 가산 증분은 인력추가배치 가산이 인정될 때만 유효합니다')
  }

  return {
    residents,
    base,
    copay,
    insurer,
    noncovered,
    bonusBase,
    extraPoints,
    nursePoints,
    nightPoints,
    programPoints,
    temporaryPoints,
    extraBonus,
    nurseBonus,
    nightBonus,
    programBonus,
    temporaryBonus,
    bonus,
    total,
    insuranceTotal,
    requiredCaregiversRaw,
    requiredCaregiversPlan,
    requiredCaregiversLegal,
    caregiverGap,
    laborBasisUsed,
    laborMinimum,
    laborGap,
    operatingBalance,
    hireBonus,
    hireNet,
    warnings,
  }
}
