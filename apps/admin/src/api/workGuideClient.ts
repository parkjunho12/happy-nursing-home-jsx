import { apiClient } from './client'
import type { GuideRole } from '@/config/workGuide'

const BASE = '/api/v1/admin/work-guide'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface GuidePermission {
  position: string | null
  my_role: GuideRole | null
  allowed_roles: GuideRole[]
  can_view_all: boolean
  has_position: boolean
}

export const workGuideAPI = {
  roles: () => apiClient.get(`${BASE}/roles`).then(unwrap<GuidePermission>),
}
