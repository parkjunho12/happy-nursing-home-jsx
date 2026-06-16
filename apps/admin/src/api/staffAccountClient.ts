import { apiClient } from './client'

const BASE = '/api/v1'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.error ?? 'API error')
}

export interface StaffUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'STAFF'
  position?: string
  department?: string
  phone?: string
  is_active: boolean
}

export interface AssigneeInfo {
  user_id: string
  name: string
  position?: string
  role: string
}

export const ALLOWED_POSITIONS = [
  '요양보호사', '간호(조무)사', '사회복지사',
  '사무국장', '시설장', '대표', '이사', '사무원',
] as const

export type StaffPosition = typeof ALLOWED_POSITIONS[number]

export const staffAccountAPI = {
  positions: () =>
    apiClient.get(`${BASE}/staff-accounts/positions`).then(unwrap<string[]>),

  me: () =>
    apiClient.get(`${BASE}/staff-accounts/me`).then(unwrap<StaffUser>),

  list: () =>
    apiClient.get(`${BASE}/staff-accounts`).then(unwrap<StaffUser[]>),

  create: (body: {
    name: string; email: string; password: string
    role?: string; position?: string; department?: string; phone?: string
  }) => apiClient.post(`${BASE}/staff-accounts`, body).then(unwrap<StaffUser>),

  update: (id: string, body: Partial<{
    name: string; role: string; position: string
    department: string; phone: string; password: string
  }>) => apiClient.patch(`${BASE}/staff-accounts/${id}`, body).then(unwrap<StaffUser>),

  deactivate: (id: string) =>
    apiClient.patch(`${BASE}/staff-accounts/${id}/deactivate`).then(unwrap<any>),

  activate: (id: string) =>
    apiClient.patch(`${BASE}/staff-accounts/${id}/activate`).then(unwrap<any>),
}

export const checklistAssignAPI = {
  getAssignees: (itemId: string) =>
    apiClient.get(`${BASE}/eval/assign/${itemId}/assignees`).then(unwrap<AssigneeInfo[]>),

  setAssignees: (itemId: string, userIds: string[]) =>
    apiClient.put(`${BASE}/eval/assign/${itemId}/assignees`, { user_ids: userIds })
      .then(unwrap<AssigneeInfo[]>),

  addAssignee: (itemId: string, userId: string) =>
    apiClient.post(`${BASE}/eval/assign/${itemId}/assignees/${userId}`)
      .then(unwrap<AssigneeInfo[]>),

  removeAssignee: (itemId: string, userId: string) =>
    apiClient.delete(`${BASE}/eval/assign/${itemId}/assignees/${userId}`)
      .then(unwrap<AssigneeInfo[]>),

  myTasks: () =>
    apiClient.get(`${BASE}/eval/assign/my-tasks`).then(unwrap<any[]>),

  staffProgress: () =>
    apiClient.get(`${BASE}/eval/assign/staff-progress`).then(unwrap<any[]>),
}
