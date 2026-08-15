import { apiClient } from './client'

const BASE = '/api/v1/admin/broadcast'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type BroadcastType = 'TTS' | 'AUDIO' | 'VIDEO'
export type RunStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING' | 'PLAYING'

/** 반복 규칙 — 0=월 … 6=일 (서버와 동일) */
export interface RepeatRule {
  freq: 'once' | 'daily' | 'weekdays' | 'weekly'
  days?: number[]
  until?: string
}

export interface BroadcastSchedule {
  id: string
  title: string
  type: BroadcastType
  text?: string | null
  media_id?: string | null
  media_url?: string | null
  scheduled_at: string
  timezone: string
  repeat_rule: RepeatRule
  repeat_label: string
  zones: string[]
  volume: number
  status: 'DRAFT' | 'READY' | 'FAILED'
  enabled: boolean
  max_seconds: number
  error_message?: string | null
  created_by?: string | null
  created_at?: string | null
  next_at?: string | null
}

export interface BroadcastDevice {
  id: string
  device_id: string
  name: string
  zones: string[]
  output_name?: string | null
  version?: string | null
  /** PC 가 스스로 알려준 값 — 원격 접속·현장 확인용 */
  hostname?: string | null
  local_ip?: string | null
  /** 서버가 본 IP (요양원 공유기의 WAN 주소) */
  last_ip?: string | null
  last_seen?: string | null
  online: boolean
  now_playing?: string | null
  active: boolean
}

export interface BroadcastLog {
  id: string
  schedule_id?: string | null
  device_id?: string | null
  event: string
  status?: string | null
  title?: string | null
  started_at?: string | null
  ended_at?: string | null
  error_message?: string | null
  actor?: string | null
  created_at?: string | null
}

export interface TodayItem {
  schedule_id: string
  title: string
  type: BroadcastType
  at: string
  status: string
  past: boolean
  zones: string[]
  run_status?: RunStatus | null
  device_id?: string | null
}

export interface Dashboard {
  now: string
  playing: { run_id: string; schedule_id: string; device_id?: string | null; started_at?: string | null }[]
  next: (BroadcastSchedule & { at: string }) | null
  today: TodayItem[]
  devices: BroadcastDevice[]
  online_count: number
  recent: BroadcastLog[]
  enabled: boolean
}

export interface BroadcastMeta {
  /** 방송 PC 를 등록할 수 있는 상태인지 (서버에 BROADCAST_ENROLL_CODE 가 있는지) */
  enroll_ready: boolean
  /** 지금 TTS 로 음성을 만들 수 있는지 */
  tts_ready: boolean
  types: BroadcastType[]
  /** enabled=false 인 구역은 실제로 동작하지 않는다 — 화면에서 고를 수 없게 해야 한다 */
  zones: { key: string; label: string; enabled: boolean }[]
  zone_note: string
  tts_providers: { name: string; ready: boolean; voices: string[]; default_voice: string; current: boolean }[]
  max_upload_mb: number
  max_seconds_default: number
  allowed_ext: string[]
  timezone: string
}

export interface MediaResult {
  id: string
  url: string
  duration_sec?: number | null
  sha256?: string
  reused?: boolean
  provider?: string
  voice?: string
  size_bytes?: number
}

export interface ScheduleInput {
  title: string
  type: BroadcastType
  text?: string | null
  media_id?: string | null
  scheduled_at?: string | null
  repeat_rule?: RepeatRule
  zones?: string[]
  volume?: number
  max_seconds?: number
  enabled?: boolean
}

export const broadcastAPI = {
  meta: () => apiClient.get(`${BASE}/meta`).then(unwrap<BroadcastMeta>),
  dashboard: () => apiClient.get(`${BASE}/dashboard`).then(unwrap<Dashboard>),
  schedules: () => apiClient.get(`${BASE}/schedules`).then(unwrap<BroadcastSchedule[]>),
  logs: (params?: { limit?: number; schedule_id?: string }) =>
    apiClient.get(`${BASE}/logs`, { params: params ?? {} }).then(unwrap<BroadcastLog[]>),
  devices: () => apiClient.get(`${BASE}/devices`).then(unwrap<BroadcastDevice[]>),

  tts: (body: { text: string; voice?: string; speed?: number; provider?: string }) =>
    apiClient.post(`${BASE}/media/tts`, body).then(unwrap<MediaResult>),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post(`${BASE}/media/upload`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap<MediaResult>)
  },

  create: (body: ScheduleInput) => apiClient.post(`${BASE}/schedules`, body).then(unwrap<BroadcastSchedule>),
  update: (id: string, body: Partial<ScheduleInput>) =>
    apiClient.patch(`${BASE}/schedules/${id}`, body).then(unwrap<BroadcastSchedule>),
  remove: (id: string) => apiClient.delete(`${BASE}/schedules/${id}`).then(r => r.data),
  playNow: (id: string) => apiClient.post(`${BASE}/schedules/${id}/play-now`, {}).then(r => r.data),
  stopAll: (reason?: string) => apiClient.post(`${BASE}/stop`, { reason }).then(r => r.data),
}
