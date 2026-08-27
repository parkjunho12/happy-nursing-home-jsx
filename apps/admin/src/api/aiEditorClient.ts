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
  /** 배포 워크플로가 지켜보는 브랜치 — 없으면 '운영 반영' 을 쓰지 않는 서비스 */
  deploy_branch?: string | null
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

/**
 * 지금 미리보기 자리에 무엇이 떠 있는가.
 *
 * 포트가 하나뿐이라 미리보기도 한 번에 하나다.
 *   base — 작업과 무관한 기준 브랜치. 화면만 골라도 바로 볼 수 있다
 *   job  — 어떤 작업의 결과. 뜨는 동안 base 는 자리를 비켜준다
 */
export type PreviewState = 'off' | 'starting' | 'installing' | 'ready' | 'failed'

export interface PreviewInfo {
  state: PreviewState
  url?: string | null
  kind?: 'base' | 'job' | null
  service_key?: string | null
  want_service?: string | null
  msg?: string | null
  agent_id?: string | null
}

export const PREVIEW_META: Record<PreviewState, { label: string; hint: string }> = {
  off:        { label: '꺼짐',     hint: '편집 에이전트가 미리보기를 띄우지 않았습니다.' },
  starting:   { label: '여는 중',  hint: '미리보기 서버를 여는 중입니다.' },
  installing: { label: '설치 중',  hint: '의존성을 설치하는 중입니다 — 처음 한 번은 5~10분 걸립니다.' },
  ready:      { label: '준비됨',   hint: '' },
  failed:     { label: '실패',     hint: '미리보기를 띄우지 못했습니다.' },
}

/** 운영에 아직 안 올라간 것들 — 편집 에이전트가 세어 알려준다 */
export interface PendingDeploy {
  /** 에이전트가 아직 안 알려줬으면 false — '0건' 과 '모름' 은 다르다 */
  known: boolean
  from?: string | null
  to?: string | null
  count: number
  commits: { sha: string; subject: string }[]
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
  /** edit = 코드 수정 · promote = 운영 반영 */
  kind?: 'edit' | 'promote'
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
    .then(unwrap<{
      services: AiService[]; agents: AiAgent[]; online_agents: number
      preview: PreviewInfo
      pending_deploy: PendingDeploy
    }>),

  /** 운영 반영 — 기준 브랜치를 배포 브랜치로 올린다(작업으로 접수된다) */
  deploy: () => apiClient.post(`${BASE}/deploy`, {}).then(unwrap<AiJob>),

  /**
   * '이 서비스를 미리보기에 띄워줘' 라고 부탁한다.
   * 서버가 직접 띄우지 않는다 — 부탁만 남기고 편집 에이전트가 가져가 띄운다.
   */
  requestPreview: (service_key: string) =>
    apiClient.post(`${BASE}/preview`, { service_key }).then(unwrap<PreviewInfo>),

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
  approve: (id: string, merge: boolean, deploy = false) =>
    apiClient.post(`${BASE}/jobs/${id}/approve`, { merge, deploy }).then(unwrap<AiJob>),
  revise: (id: string, instruction: string) =>
    apiClient.post(`${BASE}/jobs/${id}/revise`, { instruction }).then(unwrap<AiJob>),
  rollback: (id: string) => apiClient.post(`${BASE}/jobs/${id}/rollback`, {}).then(unwrap<AiJob>),
}
