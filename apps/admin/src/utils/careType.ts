// 어르신 구분 — 입력받지 않고 인정서에서 도출한다.
// 인정서에 '시설' 급여가 하나라도 있으면 시설급여 확보,
// 없으면 등급외이거나 재가급여만 있는 상태 = 시설급여 신청 대상이다.
import type { Certification } from './cert'

export type CareType = '시설' | '재가' | '등급외'

export interface CareMeta {
  v: CareType
  label: string
  short: string
  cls: string
  followup: boolean    // 시설급여 신청을 챙겨야 하는 구분인지
  hint: string
}

export const CARE_META: Record<CareType, CareMeta> = {
  시설: { v: '시설', label: '시설급여', short: '시설', followup: false,
    cls: 'bg-gray-100 text-gray-600 border-gray-200',
    hint: '인정서에 시설급여가 있어 본인부담금이 적용됩니다.' },
  재가: { v: '재가', label: '재가급여만', short: '재가', followup: true,
    cls: 'bg-violet-50 text-violet-700 border-violet-200',
    hint: '재가급여만 있습니다 — 시설급여 신청 대상입니다.' },
  등급외: { v: '등급외', label: '등급외', short: '등급외', followup: true,
    cls: 'bg-orange-50 text-orange-700 border-orange-200',
    hint: '등급외 판정입니다 — 시설급여 신청 대상입니다.' },
}

export const CARE_TYPES: CareMeta[] = [CARE_META.시설, CARE_META.재가, CARE_META.등급외]

/** 인정서 목록 → 구분. 급여는 여러 인정서에 걸쳐 있을 수 있어 전체를 본다. */
export const deriveCare = (certs?: Certification[] | null): CareType => {
  const list = certs ?? []
  const hasFacility = list.some(c => (c.benefits ?? []).some(b => (b.type ?? '').includes('시설')))
  if (hasFacility) return '시설'
  // 시설급여가 없다 → 등급외인지 재가인지만 구분
  const anyGraded = list.some(c => c.grade && c.grade !== '등급외')
  return anyGraded ? '재가' : '등급외'
}

export const careMeta = (v?: string | null): CareMeta =>
  CARE_META[(v as CareType)] ?? CARE_META.시설

/** 시설급여 신청을 챙겨야 하는 어르신인지 — 인정서 기준 */
export const needsFacilityApply = (certs?: Certification[] | null): boolean =>
  deriveCare(certs) !== '시설'

/** @deprecated 문자열 구분 대신 needsFacilityApply(certs)를 쓸 것 */
export const needsFollowup = (v?: string | null): boolean => careMeta(v).followup

// ── 시설급여 신청 진행 단계 ──────────────────────────────────
// 장기요양 신청 절차를 보호자에게 설명할 수 있는 5단계로 정리했다.
// 시설급여가 적용돼야 본인부담금이 내려가므로 보호자가 가장 민감해하는 지점이다.
export type ApplyStage = '예정' | '신청' | '조사' | '판정' | '완료'

export interface StageMeta {
  v: ApplyStage
  label: string        // 짧은 이름 (스테퍼)
  full: string         // 폼 선택지
  guide: string        // 이 단계에서 할 일
  guardian: string     // 보호자에게 이렇게 설명하면 된다
  cls: string
  bar: string
}

export const APPLY_STAGES: StageMeta[] = [
  { v: '예정', label: '신청 예정', full: '1. 신청 예정',
    guide: '보호자 동의를 받고 신청서를 준비합니다.',
    guardian: '시설급여 신청을 준비 중입니다.',
    cls: 'bg-gray-100 text-gray-600 border-gray-200', bar: 'bg-gray-300' },
  { v: '신청', label: '신청 접수', full: '2. 신청서 접수',
    guide: '공단에 신청서를 접수했습니다. 의사소견서 제출 여부를 확인하세요.',
    guardian: '공단에 신청서를 접수했습니다.',
    cls: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-400' },
  { v: '조사', label: '방문조사', full: '3. 방문조사 · 의사소견서',
    guide: '공단 방문조사 일정을 잡고, 의사소견서를 제출합니다.',
    guardian: '공단 직원이 방문조사를 나옵니다.',
    cls: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-400' },
  { v: '판정', label: '판정 대기', full: '4. 등급판정 대기',
    guide: '등급판정위원회 결과를 기다립니다. 보통 30일 안팎 걸립니다.',
    guardian: '등급 판정 결과를 기다리고 있습니다. 보통 한 달 정도 걸립니다.',
    cls: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400' },
  { v: '완료', label: '시설급여 적용', full: '5. 시설급여 적용 완료',
    guide: '인정서를 등록하고 계약서·계획서 일시를 갱신하세요.',
    guardian: '시설급여가 적용되어 본인부담금이 조정됩니다.',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
]

export const stageMeta = (v?: string | null): StageMeta | null =>
  APPLY_STAGES.find(s => s.v === v) ?? null

export const stageIndex = (v?: string | null): number =>
  APPLY_STAGES.findIndex(s => s.v === v)

/** 다음 단계 (마지막이면 null) */
export const nextStage = (v?: string | null): StageMeta | null => {
  const i = stageIndex(v)
  return i >= 0 && i < APPLY_STAGES.length - 1 ? APPLY_STAGES[i + 1] : null
}

/** 진행률 0~100 */
export const stageProgress = (v?: string | null): number => {
  const i = stageIndex(v)
  return i < 0 ? 0 : Math.round((i / (APPLY_STAGES.length - 1)) * 100)
}

/** 보호자 안내가 오래됐는지 (기본 14일) */
export const GUARDIAN_STALE_DAYS = 14
