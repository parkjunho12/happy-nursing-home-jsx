import { apiClient } from './client'
import type { SigPayload } from './leaveClient'

const BASE = '/api/v1/admin/payslips'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface Payslip {
  id: string
  staff_id: string
  staff_name?: string | null
  year_month: string
  image_url: string
  uploaded_by?: string | null
  signed: boolean
  signature_url?: string | null
  signed_at?: string | null
  created_at?: string | null
}

const ORIGIN = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')
export const payslipImageUrl = (u?: string | null) => (!u ? null : u.startsWith('http') ? u : `${ORIGIN}${u}`)

export const payslipAPI = {
  upload: (month: string, staff_id: string, file: File) => {
    const form = new FormData()
    form.append('month', month); form.append('staff_id', staff_id); form.append('file', file)
    return apiClient.post(BASE, form, { headers: { 'Content-Type': undefined as any } }).then(unwrap<Payslip>)
  },
  list: (month: string) => apiClient.get(BASE, { params: { month } }).then(unwrap<Payslip[]>),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
  mine: (month: string) => apiClient.get(`${BASE}/mine`, { params: { month } }).then(unwrap<Payslip | null>),
  sign: (month: string, sig: SigPayload) =>
    apiClient.post(`${BASE}/mine/sign?month=${month}`, {
      signature: sig.signature, use_saved_signature: sig.use_saved, save_signature: sig.save,
    }).then(unwrap<Payslip>),
}
