import { apiClient } from './client'

const BASE = '/api/v1/admin/staff-hr'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface ContractPeriod { start?: string | null; end?: string | null }
export type DocKey = 'health' | 'criminal' | 'cert' | 'resident' | 'family' | 'id_copy' | 'bankbook' | 'insurance' | 'withholding' | 'subholiday' | 'compleave' | 'privacy' | 'cctv' | 'pension'

export interface HrRecord {
  id: string
  seq: number
  staff_id?: string | null
  active?: boolean
  hire_date?: string | null
  name?: string | null
  position?: string | null
  contract_period?: string | null
  contracts?: ContractPeriod[]
  contract_written: boolean
  renewal_date?: string | null
  note?: string | null
  docs: Record<DocKey, boolean | null>
  doc_note?: string | null
}
export interface HrInput {
  seq?: number
  hire_date?: string | null
  name?: string | null
  position?: string | null
  contract_period?: string | null
  contracts?: ContractPeriod[]
  contract_written?: boolean
  renewal_date?: string | null
  note?: string | null
  docs?: Partial<Record<DocKey, boolean | null>>
  doc_note?: string | null
  active?: boolean
}

export const DOC_FIELDS: { key: DocKey; label: string; short: string }[] = [
  { key: 'health',    label: '건강검진',                 short: '건강검진' },
  { key: 'criminal',  label: '범죄경력조회',             short: '범죄경력' },
  { key: 'cert',      label: '자격증 사본',              short: '자격증' },
  { key: 'resident',  label: '등본',                     short: '등본' },
  { key: 'family',    label: '가족관계증명서',           short: '가족관계' },
  { key: 'id_copy',   label: '신분증 사본',              short: '신분증' },
  { key: 'bankbook',  label: '통장 사본',                short: '통장' },
  { key: 'insurance', label: '건강보험자격득실확인서',   short: '자격득실' },
  { key: 'withholding', label: '원천징수 동의서',          short: '원천징수' },
  { key: 'subholiday',  label: '근로자 대표 합의서',       short: '근로자대표' },
  { key: 'privacy',     label: '정보보호 서약서',          short: '정보보호' },
  { key: 'cctv',        label: 'CCTV 동의서',              short: 'CCTV' },
  { key: 'pension',     label: '퇴직연금',                 short: '퇴직연금' },
]

export const hrAPI = {
  list: (includeInactive = false) => apiClient.get(`${BASE}/records`, { params: includeInactive ? { include_inactive: true } : {} }).then(unwrap<HrRecord[]>),
  create: (b: HrInput) => apiClient.post(`${BASE}/records`, b).then(unwrap<HrRecord>),
  update: (id: string, b: HrInput) => apiClient.patch(`${BASE}/records/${id}`, b).then(unwrap<HrRecord>),
  remove: (id: string) => apiClient.delete(`${BASE}/records/${id}`).then(r => r.data),
}
