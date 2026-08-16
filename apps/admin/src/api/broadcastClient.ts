import { apiClient } from './client'

const BASE = '/api/v1/admin/broadcast'

/** 음원 주소를 절대 주소로 바꾼다.
 *  Admin 은 admin.도메인, 파일은 api.도메인 에 있다. 상대경로 그대로 쓰면
 *  admin 쪽 SPA 폴백이 index.html 을 돌려줘 미리듣기가 조용히 실패한다. */
const MEDIA_ORIGIN = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8010'
export const mediaUrl = (u?: string | null): string =>
  !u ? '' : /^(https?:|blob:|data:)/.test(u) ? u : `${MEDIA_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type BroadcastType = 'TTS' | 'AUDIO' | 'VIDEO'
export type RunStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING' | 'PLAYING'

/** 반복 규칙 — 0=월 … 6=일 (서버와 동일) */
/** 체위변경 안내방송 설정 */
export interface PositionCastConfig {
  enabled: boolean
  times: string[]            // 'HH:MM' — 이 시각마다 매일 나간다
  volume: number
  voice?: string | null
  template: string           // {names} {count}
  name_style: 'name' | 'room_name' | 'room'
  max_names: number
  mask_names: boolean        // 이름 가운데를 가려 부른다 (이길용 → 이모용)
}
export interface PositionTarget { id: string; name: string; room?: string | null; floor?: string | null }
export interface PositionPlan {
  config: PositionCastConfig
  times: string[]
  count: number
  targets: PositionTarget[]
  text: string
  skip: string | null
}
export interface PositionSyncResult {
  enabled: boolean; created: number; updated: number; removed: number
  failed: number; planned: number; count: number; reason: string | null; errors: string[]
}

/** 프로그램 시간표 자동 방송 설정 */
export interface ProgramCastConfig {
  enabled: boolean
  lead_min: number          // 시작 몇 분 전에 방송할지
  volume: number
  voice?: string | null
  template: string          // {time} {title} {who}
  exclude_kinds: string[]
  quiet_start: string       // 이 시각 전에는 방송하지 않는다
  quiet_end: string
  days_ahead: number
}
/** 미리보기 한 줄 — 언제 무엇이 나가는지 */
export interface ProgramCastItem {
  date: string
  program_time: string
  at: string
  titles: string[]
  groups: string[]
  text: string
  source_key: string
  skip: string | null       // 값이 있으면 이 건은 나가지 않는다
}
export interface ProgramSyncResult {
  enabled: boolean; created: number; updated: number; removed: number
  failed: number; planned: number; errors: string[]
}

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
  /** MANUAL=사람이 만든 예약, PROGRAM=프로그램 시간표에서 자동 생성 */
  source?: 'MANUAL' | 'PROGRAM'
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
  /** 이 PC 와 서버 시계의 차이(초). 양수면 서버가 빠름 */
  clock_skew_sec?: number | null
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
  /** 서버와 방송 PC 시계의 차이(초). 양수면 서버가 빠름. 없으면 알 수 없음 */
  server_clock_skew_sec?: number | null
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
  /** 업로드 시 음량을 얼마나 키웠는지(dB) */
  gain_db?: number | null
  /** 원본이 너무 작아 상한까지 키워도 모자란 경우 */
  still_quiet?: boolean
  /** 영상에서 오디오만 추출했는지 */
  audio_only?: boolean
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

  /** 문구 하나로 바로 방송 — 프로그램 안내처럼 그때그때 만드는 방송용 */
  announce: (body: { title: string; text: string; volume?: number; voice?: string; preview_only?: boolean }) =>
    apiClient.post(`${BASE}/announce`, body)
      .then(unwrap<{ media_id: string; url: string; duration_sec?: number | null; text: string; played: boolean }>),

  /* 체위변경 안내방송 */
  positionPlan: () => apiClient.get(`${BASE}/position/plan`).then(unwrap<PositionPlan>),
  positionSave: (body: Partial<PositionCastConfig>) => apiClient.put(`${BASE}/position/config`, body)
    .then(unwrap<{ config: PositionCastConfig; result: PositionSyncResult }>),
  positionSync: () => apiClient.post(`${BASE}/position/sync`, {}).then(unwrap<PositionSyncResult>),
  positionPreview: () => apiClient.post(`${BASE}/position/preview`, {})
    .then(unwrap<{ url: string; duration_sec?: number | null; text: string; count: number }>),

  /* 프로그램 시간표 자동 예약 */
  programConfig: () => apiClient.get(`${BASE}/program/config`)
    .then(unwrap<{ config: ProgramCastConfig; defaults: ProgramCastConfig; template_help: string }>),
  programSave: (body: Partial<ProgramCastConfig>) => apiClient.put(`${BASE}/program/config`, body)
    .then(unwrap<{ config: ProgramCastConfig; result: ProgramSyncResult }>),
  programPlan: (days = 7) => apiClient.get(`${BASE}/program/plan`, { params: { days } })
    .then(unwrap<{ config: ProgramCastConfig; items: ProgramCastItem[]; count: number }>),
  programSync: () => apiClient.post(`${BASE}/program/sync`, {}).then(unwrap<ProgramSyncResult>),

  create: (body: ScheduleInput) => apiClient.post(`${BASE}/schedules`, body).then(unwrap<BroadcastSchedule>),
  update: (id: string, body: Partial<ScheduleInput>) =>
    apiClient.patch(`${BASE}/schedules/${id}`, body).then(unwrap<BroadcastSchedule>),
  remove: (id: string) => apiClient.delete(`${BASE}/schedules/${id}`).then(r => r.data),
  playNow: (id: string) => apiClient.post(`${BASE}/schedules/${id}/play-now`, {}).then(r => r.data),
  stopAll: (reason?: string) => apiClient.post(`${BASE}/stop`, { reason }).then(r => r.data),
}
