import { apiClient } from './client'

const BASE = '/api/v1'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data
  throw new Error(res?.data?.error ?? 'API error')
}

// ── 관리자 ────────────────────────────────────────────────────────────────────
// FormData 전송 헬퍼 — Content-Type을 undefined로 설정하면 브라우저가 multipart/form-data + boundary 자동 지정
const formHeaders = { headers: { 'Content-Type': undefined as any } }

export const adminAlbumAPI = {
  listGuardians: () =>
    apiClient.get(`${BASE}/admin/guardians`).then(unwrap<any[]>),

  createGuardian: (form: FormData) =>
    apiClient.post(`${BASE}/admin/guardians`, form, formHeaders).then(unwrap<any>),

  updateGuardian: (id: string, form: FormData) =>
    apiClient.patch(`${BASE}/admin/guardians/${id}`, form, formHeaders).then(unwrap<any>),
  
  unlinkResident: (guardianId: string, residentId: string) =>
    apiClient.delete(`${BASE}/admin/guardians/${guardianId}/residents/${residentId}`).then(unwrap<any>),

  deleteGuardian: (id: string) =>
    apiClient.delete(`${BASE}/admin/guardians/${id}`).then(unwrap<any>),

  listAlbums: (residentId?: string) =>
    apiClient.get(`${BASE}/admin/albums`, { params: residentId ? { resident_id: residentId } : {} })
      .then(unwrap<any[]>),

  createAlbum: (form: FormData) =>
    apiClient.post(`${BASE}/admin/albums`, form, formHeaders).then(unwrap<any>),

  updateAlbum: (id: string, form: FormData) =>
    apiClient.patch(`${BASE}/admin/albums/${id}`, form, formHeaders).then(unwrap<any>),

  deleteAlbum: (id: string) =>
    apiClient.delete(`${BASE}/admin/albums/${id}`).then(unwrap<any>),

  listMedia: (albumId: string) =>
    apiClient.get(`${BASE}/admin/albums/${albumId}/media`).then(unwrap<any[]>),

  uploadMedia: (albumId: string, files: File[]) => {
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    return apiClient.post(`${BASE}/admin/albums/${albumId}/media`, form, formHeaders).then(unwrap<any[]>)
  },

  deleteMedia: (albumId: string, mediaId: string) =>
    apiClient.delete(`${BASE}/admin/albums/${albumId}/media/${mediaId}`).then(unwrap<any>),

  setMediaStatus: (albumId: string, mediaId: string, status: 'approved' | 'pending' | 'rejected') =>
    apiClient.patch(`${BASE}/admin/albums/${albumId}/media/${mediaId}/status`, { status }).then(unwrap<any>),

  notify: (albumId: string) =>
    apiClient.post(`${BASE}/admin/albums/${albumId}/notify`).then(unwrap<any>),

  fcmStatus: () =>
    apiClient.get(`${BASE}/admin/albums-fcm-status`).then(unwrap<any>),
  engagement: (days = 30) =>
    apiClient.get(`${BASE}/admin/albums-engagement`, { params: { days } }).then(unwrap<any>),
}

// ── 보호자 ────────────────────────────────────────────────────────────────────
const familyBase = () => {
  const token = localStorage.getItem('family_token')
  return { headers: token ? { Authorization: `Bearer ${token}` } : {} }
}

export const familyAPI = {
  login: (phone: string, password: string) => {
    const form = new FormData()
    form.append('phone', phone); form.append('password', password)
    return apiClient.post(`${BASE}/family/login`, form, { headers: { 'Content-Type': undefined as any } }).then(unwrap<any>)
  },
  me:     () => apiClient.get(`${BASE}/family/me`,          familyBase()).then(unwrap<any>),
  albums: () => apiClient.get(`${BASE}/family/albums`,       familyBase()).then(unwrap<any[]>),
  album:  (id: string) => apiClient.get(`${BASE}/family/albums/${id}`, familyBase()).then(unwrap<any>),
}

