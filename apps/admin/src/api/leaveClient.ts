import { apiClient } from './client'

const BASE = '/api/v1/admin/leave'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type LeaveKind = '연차' | '희망휴무'    // 반차 제도는 없음
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  staff_id: string
  staff_name?: string | null
  date: string           // YYYY-MM-DD
  kind: LeaveKind
  reason?: string | null
  use_annual?: boolean | null   // 희망휴무: 근무표 짤 때 연차(休)로 우선 반영
  status: LeaveStatus
  decided_by?: string | null
  signature_url?: string | null
  created_at?: string | null
}

export const LEAVE_KIND_META: Record<LeaveKind, { cls: string; hint: string }> = {
  연차:     { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', hint: '하루 쉬는 유급휴가 — 서명하고 신청하면, 승인 시 근무표에 休로 들어갑니다' },
  희망휴무: { cls: 'bg-sky-50 text-sky-700 border-sky-200',             hint: '이날은 쉬고 싶어요 — 한 달 최대 2일. 근무 인원을 보고 승인·반려해드립니다' },
}

const ORIGIN = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')
/** 서명 이미지 절대 URL (로컬 저장분 대응) */
export const signatureUrl = (u?: string | null) => (!u ? null : u.startsWith('http') ? u : `${ORIGIN}${u}`)

export const MAX_HOPE_PER_MONTH = 2   // 백엔드와 동일 값 — 서버가 최종 검증한다

/** 서명 제출 값 — 저장 서명 재사용 또는 새 서명 */
export interface SigPayload { use_saved: boolean; signature: string | null; save: boolean }

export const signatureAPI = {
  get: () => apiClient.get(`${BASE}/my-signature`).then(unwrap<{ signature_url: string | null }>),
  save: (signature: string) => apiClient.post(`${BASE}/my-signature`, { signature }).then(unwrap<{ signature_url: string }>),
  remove: () => apiClient.delete(`${BASE}/my-signature`).then(r => r.data),
}

export interface MyAnnual {
  year: number; service_year: number
  entitle: number      // 연간 최대 발생 — 1년차 11 (만근+다음 달 근무 시 1개씩)
  accrued: number      // 지금까지 발생
  used: number         // 사용 (승인·근무표 休 기준)
  pending: number      // 대기 중 신청
  available: number    // 지금 쓸 수 있는 연차
  blocked_months: number[]
  expire_on?: string   // 소멸일 — 1년 이상 12/31, 1년 미만 입사 1년 되는 날 전날
}

export const leaveAPI = {
  /** 내 연차 현황 — 남은 연차·쓸 수 있는 연차 */
  myAnnual: () => apiClient.get(`${BASE}/requests/my-annual`).then(unwrap<MyAnnual>),
  /** 저장된 근무표의 내 근무 칸 — 연차는 이 날짜들 중에서만 고른다 */
  myShifts: (month: string) =>
    apiClient.get(`${BASE}/requests/my-shifts`, { params: { month } })
      .then(unwrap<{ month: string; saved: boolean; shifts: Record<string, string> }>),
  create: (dates: string[], kind: LeaveKind, reason: string | undefined, sig: SigPayload, useAnnual?: boolean) =>
    apiClient.post(`${BASE}/requests`, {
      dates, kind, reason, use_annual: useAnnual,
      signature: sig.signature, use_saved_signature: sig.use_saved, save_signature: sig.save,
    }).then(unwrap<LeaveRequest[]>),
  mine: (year?: string) =>
    apiClient.get(`${BASE}/requests/mine`, { params: year ? { year } : {} })
      .then(unwrap<{ requests: LeaveRequest[]; used_annual: number; year: string }>),
  cancel: (id: string) => apiClient.delete(`${BASE}/requests/${id}`).then(r => r.data),
  list: (month?: string, status: LeaveStatus | '' = 'pending') =>
    apiClient.get(`${BASE}/requests`, { params: { ...(month ? { month } : {}), status } })
      .then(unwrap<LeaveRequest[]>),
  decide: (id: string, approve: boolean, note?: string) =>
    apiClient.patch(`${BASE}/requests/${id}`, { approve, note }).then(unwrap<LeaveRequest & { schedule_written?: boolean }>),
}

// ═══════════ 맞교대 ═══════════
export type SwapStatus = 'partner_wait' | 'pending' | 'approved' | 'rejected' | 'declined'

export interface SwapRequest {
  id: string
  requester_staff_id: string
  requester_name?: string | null
  partner_staff_id: string
  partner_name?: string | null
  dates: string[]               // [내 근무일, 상대 근무일]
  shift_code?: string | null    // 교환되는 근무 (D/N/M…) — 같은 근무끼리만
  reason?: string | null
  status: SwapStatus
  requester_signature_url?: string | null
  partner_signature_url?: string | null
  decided_by?: string | null
  created_at?: string | null
  i_am?: 'requester' | 'partner' | null
}

export const SWAP_STATUS_META: Record<SwapStatus, { t: string; cls: string }> = {
  partner_wait: { t: '상대 동의 대기', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  pending:      { t: '관리자 승인 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:     { t: '승인됨', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected:     { t: '반려됨', cls: 'bg-red-50 text-red-600 border-red-200' },
  declined:     { t: '상대 거절', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export const swapAPI = {
  /** 바꿀 수 있는 상대 — 같은 직종의 재직자만 (서버가 거른다) */
  partners: () =>
    apiClient.get(`${BASE}/swaps/partners`)
      .then(unwrap<{ my_position: string | null; partners: { id: string; name: string; position?: string | null }[] }>),
  /** 저장된 근무표에서 나·상대의 실제 근무 칸만 — 화면은 여기서만 고르게 한다 */
  shifts: (partner_staff_id: string, month: string) =>
    apiClient.get(`${BASE}/swaps/shifts`, { params: { partner_staff_id, month } })
      .then(unwrap<{ month: string; saved: boolean; mine: Record<string, string>; partner: Record<string, string> }>),
  create: (partner_staff_id: string, my_date: string, partner_date: string, reason: string | undefined, sig: SigPayload) =>
    apiClient.post(`${BASE}/swaps`, {
      partner_staff_id, my_date, partner_date, reason,
      signature: sig.signature, use_saved_signature: sig.use_saved, save_signature: sig.save,
    }).then(unwrap<SwapRequest>),
  mine: () => apiClient.get(`${BASE}/swaps/mine`).then(unwrap<SwapRequest[]>),
  consent: (id: string, agree: boolean, sig?: SigPayload) =>
    apiClient.post(`${BASE}/swaps/${id}/consent`, {
      agree, signature: sig?.signature ?? null,
      use_saved_signature: sig?.use_saved, save_signature: sig?.save,
    }).then(unwrap<SwapRequest>),
  list: (status = 'pending') =>
    apiClient.get(`${BASE}/swaps`, { params: { status } }).then(unwrap<SwapRequest[]>),
  decide: (id: string, approve: boolean, note?: string) =>
    apiClient.patch(`${BASE}/swaps/${id}`, { approve, note }).then(unwrap<SwapRequest & { swapped_dates?: string[] }>),
}

// ═══════════ 연차 관리대장 ═══════════
export interface LedgerRow {
  staff_id: string
  name: string
  position?: string | null
  hire_date?: string | null
  service_year: number
  entitle: number            // 연간 최대 발생 — 1년차 11
  accrued: number            // 현재까지 발생 (1년차만 월할)
  used_total: number
  remaining: number
  blocked_months: number[]   // ★ 연차 사용불가월
  used_by_month: Record<string, string[]>
  promotion?: {              // 연차 사용촉진 일정 (근로기준법 61조 — 서면·개별 통지)
    basis: 'fiscal' | 'hire' // fiscal=회계연도(1년 이상) / hire=입사일 기준(1년 미만)
    first_notice: [string, string]  // 1차 촉구 기간
    second_deadline: string         // 2차(시기 지정 통보) 기한
    expire_on: string               // 소멸일
  }
}

export const ledgerAPI = {
  get: (year: number) =>
    apiClient.get(`${BASE}/ledger`, { params: { year } })
      .then(unwrap<{ year: number; month_now: number; rows: LedgerRow[] }>),
  /** 직접 입력 (ADMIN·시설장) — 그 날짜 근무표에 休를 적는 방식 */
  addManual: (staff_id: string, date: string) =>
    apiClient.post(`${BASE}/ledger/manual`, { staff_id, date }).then(r => r.data),
  removeManual: (staff_id: string, date: string) =>
    apiClient.delete(`${BASE}/ledger/manual`, { params: { staff_id, date } }).then(r => r.data),
}
