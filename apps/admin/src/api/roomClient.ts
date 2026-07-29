import { apiClient } from './client'

const BASE = '/api/v1/admin/rooms'
function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export interface RoomInfo { id: string; room: string; capacity: number; occupants: string[]; free: number }
export interface FloorInfo { floor: string; rooms: RoomInfo[]; capacity: number; occupied: number }
export interface RoomConfigRow { id: string; floor: string; room: string; capacity: number }

export const roomAPI = {
  /** 층 → 호실 → 침대 점유 현황 (전 직원 조회 가능) */
  occupancy: () => apiClient.get(`${BASE}/occupancy`).then(unwrap<{ floors: FloorInfo[] }>),
  list: () => apiClient.get(BASE).then(unwrap<RoomConfigRow[]>),
  create: (b: { floor: string; room: string; capacity: number }) =>
    apiClient.post(BASE, b).then(r => r.data),
  update: (id: string, b: { floor: string; room: string; capacity: number }) =>
    apiClient.put(`${BASE}/${id}`, b).then(r => r.data),
  remove: (id: string) => apiClient.delete(`${BASE}/${id}`).then(r => r.data),
}
