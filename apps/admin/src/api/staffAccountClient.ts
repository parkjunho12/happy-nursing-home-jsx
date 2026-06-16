import { apiClient } from './client'

const BASE = '/api/v1'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data
  throw new Error(res?.data?.error ?? 'API error')
}

export interface StaffUser {
  id: string; name: string; email: string; role: 'ADMIN' | 'MANAGER' | 'STAFF'
  position?: string; department?: string; phone?: string; is_active: boolean
}

export const staffAccountAPI = {
  me: () =>
    apiClient.get(`${BASE}/staff-accounts/me`).then(unwrap<StaffUser>),

  list: () =>
    apiClient.get(`${BASE}/staff-accounts`).then(unwrap<StaffUser[]>),

  create: (body: { name:string; email:string; password:string; role?:string; position?:string; department?:string; phone?:string }) =>
    apiClient.post(`${BASE}/staff-accounts`, body).then(unwrap<StaffUser>),

  update: (id: string, body: Partial<{ name:string; role:string; position:string; department:string; phone:string; password:string }>) =>
    apiClient.patch(`${BASE}/staff-accounts/${id}`, body).then(unwrap<StaffUser>),

  deactivate: (id: string) =>
    apiClient.patch(`${BASE}/staff-accounts/${id}/deactivate`).then(unwrap<any>),

  activate: (id: string) =>
    apiClient.patch(`${BASE}/staff-accounts/${id}/activate`).then(unwrap<any>),
}

export const checklistAssignAPI = {
  assign: (itemId: string, assignedUserId: string, note?: string) =>
    apiClient.post(`${BASE}/eval/checklist/${itemId}/assign`, { assigned_user_id: assignedUserId, note }).then(unwrap<any>),

  changeStatus: (itemId: string, occId: string, status: string, note?: string) =>
    apiClient.patch(`${BASE}/eval/checklist/${itemId}/occurrence/${occId}/status`, { status, note }).then(unwrap<any>),

  complete: (itemId: string, occId: string, memo: string, file?: File) => {
    const form = new FormData()
    form.append('memo', memo)
    if (file) form.append('file', file)
    return apiClient.patch(`${BASE}/eval/checklist/${itemId}/occurrence/${occId}/complete`, form, {
      headers: { 'Content-Type': undefined as any },
    }).then(unwrap<any>)
  },

  reject: (itemId: string, occId: string, reason: string) =>
    apiClient.patch(`${BASE}/eval/checklist/${itemId}/occurrence/${occId}/reject`, { reason }).then(unwrap<any>),

  myTasks: () =>
    apiClient.get(`${BASE}/eval/checklist/my-tasks`).then(unwrap<any[]>),

  staffProgress: () =>
    apiClient.get(`${BASE}/eval/checklist/staff-progress`).then(unwrap<any[]>),

  activityLogs: (itemId: string) =>
    apiClient.get(`${BASE}/eval/checklist/${itemId}/activity-logs`).then(unwrap<any[]>),
}
