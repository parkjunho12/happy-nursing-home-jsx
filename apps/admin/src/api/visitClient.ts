import { apiClient } from './client'

const BASE = '/api/v1/admin'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type VisitStatus = 'pending' | 'approved' | 'rejected' | 'canceled'

export interface VisitReservation {
  id: string
  guardian_id: string
  guardian_name?: string | null
  resident_id: string
  resident_name?: string | null
  relation?: string | null
  date: string       // YYYY-MM-DD
  time: string       // HH:MM
  visitors: number
  memo?: string | null
  status: VisitStatus
  reject_reason?: string | null
  decided_by?: string | null
  created_at?: string | null
}

export const visitAPI = {
  list: (status: VisitStatus | '' = 'pending') =>
    apiClient.get(`${BASE}/visits`, { params: status ? { status } : {} })
      .then(unwrap<VisitReservation[]>),
  decide: (id: string, approve: boolean, note?: string) =>
    apiClient.patch(`${BASE}/visits/${id}`, { approve, note }).then(unwrap<VisitReservation>),
}
