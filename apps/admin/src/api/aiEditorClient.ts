import { apiClient } from './client'

const BASE = '/api/v1/admin/ai-editor'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data as T
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

/** 편집 대상 서비스 — 레지스트리에 올린 것만 건드릴 수 있다 */
export interface AiService {
  key: string
  name: string
  repo: string
  root_path: string
  base_branch: string
  pages: { path: string; label?: string }[]
  prod_url?: string | null
  active: boolean
  check_cmds: string[]
}

/** 실제로 코드를 고치는 기계 */
export interface AiAgent {
  agent_id: string
  name: string
  hostname?: string | null
  version?: string | null
  tools: Record<string, any>
  online: boolean
  last_seen?: string | null
  now_job_id?: string | null
}

export type JobStatus =
  | 'QUEUED' | 'RUNNING' | 'ANALYZING' | 'CHECKING'
  | 'PREVIEW' | 'PR_OPEN' | 'MERGED' | 'DEPLOYED' | 'FAILED' | 'CANCELLED'

/** 화면에서 고른 요소 — Inspector 가 보낸 그대로 */
export interface PickedTarget {
  tag?: string
  componentName?: string | null
  componentPath?: string[]
  text?: string
  className?: string
  selector?: string
  sourceFile?: string | null
  line?: number | null
  column?: number | null
  pageUrl?: string
  style?: Record<string, string>
  boundingBox?: { x: number; y: number; width: number; height: number }
}

export interface AiJob {
  id: string
  service_key: string
  page_url?: string | null
  title: string
  status: JobStatus
  step?: string | null
  progress: number
  scope: string
  priority: number
  approve_mode: string
  branch?: string | null
  preview_url?: string | null
  pr_url?: string | null
  pr_number?: number | null
  deploy_run?: string | null
  files: { path: string; added: number; removed: number }[]
  checks: { name: string; ok: boolean; ms?: number; output?: string }[]
  error?: string | null
  agent_id?: string | null
  requested_by?: string | null
  cancel_requested: boolean
  created_at?: string | null
  started_at?: string | null
  ended_at?: string | null
  /* 상세 조회에서만 온다 */
  instruction?: string
  extra_notes?: string | null
  images?: string[]
  target?: PickedTarget | null
  plan?: string | null
  summary?: string | null
  diff?: string | null
  base_sha?: string | null
  head_sha?: string | null
}

export interface JobEvent {
  level: 'info' | 'warn' | 'error'
  message: string
  detail?: string | null
  at?: string | null
}

/** 상태별 표시 — 화면 여기저기서 같은 말과 색을 쓰려고 한곳에 둔다 */
export const JOB_STATUS_META: Record<JobStatus, { label: string; cls: string; dot: string }> = {
  QUEUED:    { label: '대기 중',   cls: 'bg-gray-100 text-gray-600 border-gray-200',      dot: 'bg-gray-400' },
  RUNNING:   { label: '작업 중',   cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  ANALYZING: { label: '분석 중',   cls: 'bg-sky-50 text-sky-700 border-sky-200',          dot: 'bg-sky-500' },
  CHECKING:  { label: '검증 중',   cls: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-500' },
  PREVIEW:   { label: '확인 대기', cls: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  PR_OPEN:   { label: 'PR 열림',   cls: 'bg-teal-50 text-teal-700 border-teal-200',       dot: 'bg-teal-500' },
  MERGED:    { label: '병합됨',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  DEPLOYED:  { label: '배포됨',    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' },
  FAILED:    { label: '실패',      cls: 'bg-rose-50 text-rose-700 border-rose-200',       dot: 'bg-rose-500' },
  CANCELLED: { label: '중지됨',    cls: 'bg-gray-100 text-gray-400 border-gray-200',      dot: 'bg-gray-300' },
}

export const SCOPE_META = [
  { v: 'element', label: '고른 요소만', hint: '다른 곳은 건드리지 않습니다 — 가장 안전합니다' },
  { v: 'page',    label: '이 화면',     hint: '이 화면 파일 안에서 고칩니다' },
  { v: 'feature', label: '관련 기능',   hint: '연결된 파일까지 — 범위가 넓어 확인이 더 필요합니다' },
] as const

export const aiEditorAPI = {
  services: () => apiClient.get(`${BASE}/services`)
    .then(unwrap<{ services: AiService[]; agents: AiAgent[]; online_agents: number }>),

  /** 처음 한 번 — 이 저장소의 관리자 화면을 기본값으로 등록 */
  seed: () => apiClient.post(`${BASE}/services/seed`, {}).then(unwrap<AiService>),

  jobs: (p: { service_key?: string; status?: string; limit?: number } = {}) =>
    apiClient.get(`${BASE}/jobs`, { params: p }).then(unwrap<AiJob[]>),

  job: (id: string, since?: string) =>
    apiClient.get(`${BASE}/jobs/${id}`, { params: since ? { since } : {} })
      .then(unwrap<{ job: AiJob; events: JobEvent[] }>),

  create: (b: {
    service_key: string; instruction: string; page_url?: string | null
    title?: string; scope?: string; priority?: number; approve_mode?: string
    extra_notes?: string | null; images?: string[]; target?: PickedTarget | null
    analyze_only?: boolean
  }) => apiClient.post(`${BASE}/jobs`, b).then(unwrap<AiJob>),

  cancel: (id: string) => apiClient.post(`${BASE}/jobs/${id}/cancel`, {}).then(unwrap<AiJob>),
  approve: (id: string, merge: boolean) =>
    apiClient.post(`${BASE}/jobs/${id}/approve`, { merge }).then(unwrap<AiJob>),
  revise: (id: string, instruction: string) =>
    apiClient.post(`${BASE}/jobs/${id}/revise`, { instruction }).then(unwrap<AiJob>),
  rollback: (id: string) => apiClient.post(`${BASE}/jobs/${id}/rollback`, {}).then(unwrap<AiJob>),
}
