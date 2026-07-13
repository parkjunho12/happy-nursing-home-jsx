import { useState, useRef, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuditStore } from '@/store/auditStore'
import {
  FileSpreadsheet, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, History, X, Printer, RefreshCw, Settings,
  Users, CalendarOff, Trash2, Upload, Edit3, Save, Sparkles, Clock, Plus,
  Zap, XCircle, AlertOctagon, RotateCw } from 'lucide-react'
import { apiClient } from '@/api/client'
import CareforRowEditor, { type FieldSpec } from '@/components/eval/CareforRowEditor'
import { useAuthStore } from '@/store/auth'

// ── 권한 타입 ────────────────────────────────────────────────────────────────
type RoleUser = {
  role?: string | null
  position?: string | null
}

function canManageAuditContext(user: RoleUser | null) {
  return user?.role === 'ADMIN' || user?.position === '사회복지사'
}

function canManageRules(user: RoleUser | null) {
  return user?.role === 'ADMIN'
}

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface AuditIssue {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  location: string
  description: string
  suggestion: string
}

interface LlmSummary {
  summary: string
  admin_comment: string
  priority_actions: string[]
  recording_tips: string[]
}

interface ResidentResult {
  resident_name: string
  birth_date: string
  care_grade: string
  resident_status: string
  match_status: string
  score: number
  grade: string
  total_rows: number
  bathing_count: number
  issue_summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  issues: AuditIssue[]
}

interface AuditResult {
  summary: string
  score: number
  total_rows: number
  issues: AuditIssue[]
  strengths: string[]
  overall_grade: string
  ai_recommendations?: string[]
  issue_summary?: {
    critical: number
    high: number
    medium: number
    low: number
  }
  issue_total_count?: number
  llm_summary?: LlmSummary
  total_residents_detected?: number
  matched_residents?: number
  unmatched_residents?: number
  resident_results?: ResidentResult[]
}

interface AuditRecord {
  id: string
  filename: string
  auditor: string
  result: AuditResult
  created_at: string
  context?: {
    residents_count: number
    leaves_count: number
    rule_applied: boolean
    schedules_count?: number
  }
}

interface Resident {
  id: string
  name: string
  birth_date: string
  care_grade: string
  admission_date: string
  discharge_date: string
  room_name: string
  status: string
}

interface WorkSchedule {
  id: string
  staff_name: string
  user_id: string | null
  work_date: string
  shift_code: string
  shift_label: string
  start_time: string
  end_time: string
  is_working: boolean
}

interface LeaveRecord {
  id: string
  resident_name: string
  leave_type: string
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  reason: string
}

type TabType = 'audit' | 'residents' | 'leaves' | 'rules' | 'schedules'

const SEV: Record<string, string> = {
  critical: 'bg-purple-50 border-purple-300 text-purple-800',
  high: 'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-orange-50 border-orange-200 text-orange-700',
  low: 'bg-gray-50 border-gray-200 text-gray-600',
}

const SEV_LABEL: Record<string, string> = {
  critical: '즉시조치',
  high: '중요',
  medium: '보통',
  low: '경미',
}

const GRADE_CLS: Record<string, string> = {
  '양호(A)': 'bg-green-100 text-green-700 border-green-300',
  '양호(B)': 'bg-blue-100 text-blue-700 border-blue-300',
  '보통(C)': 'bg-orange-100 text-orange-700 border-orange-300',
  '미흡(D)': 'bg-red-100 text-red-700 border-red-300',
  양호: 'bg-green-100 text-green-700 border-green-300',
  보통: 'bg-orange-100 text-orange-700 border-orange-300',
  미흡: 'bg-red-100 text-red-700 border-red-300',
}

const STATUS_LABEL: Record<string, string> = {
  active: '입소중',
  inactive: '퇴소',
  deceased: '사망',
}

const STATUS_CLS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  deceased: 'bg-red-100 text-red-700',
}

// ── 공통 업로드 버튼 ──────────────────────────────────────────────────────────
function UploadBtn({
  label,
  accept,
  endpoint,
  onDone,
  disabled,
  color = 'blue',
}: {
  label: string
  accept: string
  endpoint: string
  onDone: (msg: string, warnings?: string[]) => void
  disabled?: boolean
  color?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const cls =
    color === 'purple'
      ? 'bg-purple-500 hover:bg-purple-600'
      : color === 'teal'
        ? 'bg-teal-500 hover:bg-teal-600'
        : 'bg-blue-500 hover:bg-blue-600'

  const upload = async (file: File) => {
    setUploading(true)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await apiClient.post(endpoint, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const d = (res.data as any)?.data
      const normTag = d?.normalizer === 'openai' ? ' [AI 정규화]' : ' [기본 정규화]'
      const warnTag = d?.warnings?.length ? ` ⚠️ 경고 ${d.warnings.length}건` : ''

      onDone(
        `✅ ${file.name}${normTag} — 신규 ${d?.imported ?? 0}건, 수정 ${d?.updated ?? 0}건${warnTag}`,
        d?.warnings ?? [],
      )
    } catch (e: any) {
      onDone(`❌ ${e?.response?.data?.detail ?? '업로드 실패'}`, [])
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled || uploading}
        className={`flex w-full sm:w-auto items-center justify-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-xl disabled:opacity-50 transition-colors ${cls}`}
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {uploading ? '업로드 중...' : label}
      </button>

      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) upload(f)
          e.target.value = ''
        }}
      />
    </>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function EvalRecordAuditPage() {
  const { user } = useAuthStore()

  const isAdmin = user?.role === 'ADMIN'
  const isSocial = user?.position === '사회복지사'
  const canManageContext = canManageAuditContext(user)
  const canManageRule = canManageRules(user)

  const { currentAudit, setCurrentAudit, history, setHistory, addToHistory } =
    useAuditStore()

  const result = currentAudit
  const setResult = (r: AuditRecord | null) => setCurrentAudit(r)

  const [tab, setTab] = useState<TabType>('audit')

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const [residents, setResidents] = useState<Resident[]>([])
  const [leaves, setLeaves] = useState<LeaveRecord[]>([])
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [ctxMsg, setCtxMsg] = useState('')
  const [ctxWarnings, setCtxWarnings] = useState<string[]>([])

  const loadAll = async () => {
    try {
      const [resRes, leaveRes, schedRes] = await Promise.allSettled([
        apiClient.get('/api/v1/eval/carefor/residents'),
        apiClient.get('/api/v1/eval/carefor/leave-records'),
        apiClient.get('/api/v1/eval/carefor/work-schedules'),
      ])

      if (resRes.status === 'fulfilled') {
        setResidents((resRes.value.data as any)?.data ?? [])
      }

      if (leaveRes.status === 'fulfilled') {
        setLeaves((leaveRes.value.data as any)?.data ?? [])
      }

      if (schedRes.status === 'fulfilled') {
        setSchedules((schedRes.value.data as any)?.data ?? [])
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (result) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    }
  }, [result])

  useEffect(() => {
    if (!canManageContext && ['residents', 'leaves', 'schedules'].includes(tab)) {
      setTab('audit')
      return
    }

    if (!canManageRule && tab === 'rules') {
      setTab('audit')
    }
  }, [tab, canManageContext, canManageRule])

  const runAudit = async (file: File) => {
    setUploading(true)
    setAuditError(null)
    setResult(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await apiClient.post('/api/v1/eval/record-audit/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })

      const auditData = (res.data as any)?.data
      setResult(auditData)

      if (auditData) addToHistory(auditData)

      const hRes = await apiClient.get('/api/v1/eval/record-audit/history')
      setHistory((hRes.data as any)?.data ?? [])
    } catch (e: any) {
      setAuditError(e?.response?.data?.detail ?? 'AI 검수 중 오류가 발생했습니다')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const TABS = [
    { id: 'audit', label: '검수 실행', icon: FileSpreadsheet },
    ...(canManageContext
      ? [
          { id: 'residents', label: `수급자 정보 (${residents.length}명)`, icon: Users },
          { id: 'leaves', label: `외박/외출 (${leaves.length}건)`, icon: CalendarOff },
          { id: 'schedules', label: `근무표 (${schedules.length}건)`, icon: Clock },
        ]
      : []),
    ...(canManageRule
      ? [{ id: 'rules', label: '검수 룰', icon: Settings }]
      : []),
  ] as const

  return (
    <div className="space-y-5 p-4 sm:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            제공기록지 AI 검수
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Rule Engine이 판단하고 AI가 수정 필요 사항을 설명합니다.
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {result && (
            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50"
            >
              <Printer size={14} />
              인쇄
            </button>
          )}

          <button
            type="button"
            onClick={async () => {
              if (!showHistory) {
                const r = await apiClient.get('/api/v1/eval/record-audit/history')
                setHistory((r.data as any)?.data ?? [])
              }
              setShowHistory(v => !v)
            }}
            className="flex w-full sm:w-auto items-center justify-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50"
          >
            <History size={14} />
            이력
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as TabType)}
            className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={14} />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {ctxMsg && (
        <div
          className={`px-4 py-3 rounded-xl text-sm border ${
            ctxMsg.startsWith('✅')
              ? 'bg-green-50 border-green-100 text-green-700'
              : 'bg-red-50 border-red-100 text-red-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span>{ctxMsg}</span>
            <button
              type="button"
              onClick={() => {
                setCtxMsg('')
                setCtxWarnings([])
              }}
              className="opacity-50 hover:opacity-100"
            >
              <X size={12} />
            </button>
          </div>

          {ctxWarnings.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {ctxWarnings.slice(0, 5).map((w, i) => (
                <p key={i} className="text-xs opacity-70">
                  ⚠️ {w}
                </p>
              ))}

              {ctxWarnings.length > 5 && (
                <p className="text-xs opacity-50">
                  외 {ctxWarnings.length - 5}건
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              {
                icon: <Users size={12} />,
                label: '수급자',
                active: residents.length > 0,
                text: residents.length > 0 ? `${residents.length}명 연계` : '없음',
              },
              {
                icon: <CalendarOff size={12} />,
                label: '외박/외출',
                active: leaves.length > 0,
                text: leaves.length > 0 ? `${leaves.length}건 연계` : '없음',
              },
              {
                icon: <Clock size={12} />,
                label: '근무표',
                active: schedules.length > 0,
                text: schedules.length > 0 ? `${schedules.length}건 연계` : '없음',
              },
            ].map((b, i) => (
              <span
                key={i}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium ${
                  b.active
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                {b.icon}
                {b.label}: <span className={b.active ? 'font-bold' : ''}>{b.text}</span>
              </span>
            ))}
          </div>

          {auditError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1">{auditError}</span>
              <button type="button" onClick={() => setAuditError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          <div
            onDragOver={e => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) runAudit(f)
            }}
            onClick={() => !uploading && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-colors ${
              uploading
                ? 'border-primary-orange/30 bg-orange-50/50 cursor-wait'
                : dragging
                  ? 'border-primary-orange bg-orange-50 cursor-copy'
                  : 'border-gray-200 hover:border-primary-orange hover:bg-orange-50/30 cursor-pointer'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) runAudit(f)
              }}
              disabled={uploading}
              className="hidden"
            />

            {uploading ? (
              <>
                <Loader2
                  size={40}
                  className="mx-auto mb-3 text-primary-orange animate-spin"
                />
                <p className="font-semibold text-gray-700">Rule Engine + AI 검수 중</p>
                <p className="text-sm text-gray-400 mt-1">
                  수급자 {residents.length}명 · 외박/외출 {leaves.length}건 · 근무표{' '}
                  {schedules.length}건 연계
                </p>
              </>
            ) : (
              <>
                <FileSpreadsheet size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700 mb-1">
                  {result ? '다른 파일 검수하기' : '제공기록지 파일 업로드'}
                </p>
                <p className="text-sm text-gray-400">xlsx · xls · csv · txt · 최대 5MB</p>
              </>
            )}
          </div>

          {result && (
            <div ref={resultRef}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    검수 결과
                  </p>

                  {result.context?.residents_count ? (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                      수급자 {result.context.residents_count}명 연계
                    </span>
                  ) : null}

                  {result.context?.leaves_count ? (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                      외박/외출 {result.context.leaves_count}건 연계
                    </span>
                  ) : null}

                  {result.context?.schedules_count ? (
                    <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">
                      근무표 {result.context.schedules_count}건 연계
                    </span>
                  ) : null}

                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                    Rule Engine 판단
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    setAuditError(null)
                  }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  <RefreshCw size={11} />
                  초기화
                </button>
              </div>

              <AuditResultView record={result} />
            </div>
          )}

          {showHistory && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                  <History size={14} />
                  검수 이력
                </p>

                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  이력이 없습니다
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setResult(h)
                        setShowHistory(false)
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                          GRADE_CLS[h.result.overall_grade] ?? ''
                        }`}
                      >
                        {h.result.overall_grade}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {h.filename}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {h.result.summary}
                        </p>
                      </div>

                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(h.created_at).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {canManageContext && tab === 'residents' && (
        <ResidentsTab
          residents={residents}
          isAdmin={isAdmin}
          onRefresh={loadAll}
          onMsg={(m, w) => {
            setCtxMsg(m)
            if (w?.length) setCtxWarnings(w)
          }}
        />
      )}

      {canManageContext && tab === 'leaves' && (
        <LeavesTab
          leaves={leaves}
          canManage={isAdmin || isSocial}
          onRefresh={loadAll}
          onMsg={(m, w) => {
            setCtxMsg(m)
            if (w?.length) setCtxWarnings(w)
          }}
        />
      )}

      {canManageContext && tab === 'schedules' && (
        <ScheduleTab
          schedules={schedules}
          isAdmin={isAdmin}
          onRefresh={loadAll}
          onMsg={(m, w) => {
            setCtxMsg(m)
            if (w?.length) setCtxWarnings(w)
          }}
        />
      )}

      {canManageRule && tab === 'rules' && <RulesTab isAdmin={isAdmin} />}
    </div>
  )
}

// ── 수급자 탭 ────────────────────────────────────────────────────────────────
const RESIDENT_FIELDS: FieldSpec[] = [
  { key: 'name', label: '이름', required: true },
  { key: 'birth_date', label: '생년월일', type: 'date' },
  { key: 'care_grade', label: '장기요양등급', placeholder: '예: 3등급' },
  { key: 'admission_date', label: '입소일', type: 'date' },
  { key: 'discharge_date', label: '퇴소일', type: 'date' },
  { key: 'room_name', label: '생활실' },
  { key: 'status', label: '상태', type: 'select', options: ['active', 'discharged'] },
]
const LEAVE_FIELDS: FieldSpec[] = [
  { key: 'resident_name', label: '수급자명', required: true },
  { key: 'leave_type', label: '구분', type: 'select', options: ['외출', '외박', '병원외출', '기타'] },
  { key: 'start_date', label: '시작일', type: 'date', required: true },
  { key: 'start_time', label: '시작시간', type: 'time' },
  { key: 'end_date', label: '종료일', type: 'date' },
  { key: 'end_time', label: '종료시간', type: 'time' },
  { key: 'reason', label: '사유' },
  { key: 'guardian_name', label: '보호자' },
]
const SCHEDULE_FIELDS: FieldSpec[] = [
  { key: 'staff_name', label: '직원명', required: true },
  { key: 'work_date', label: '근무일자', type: 'date', required: true },
  { key: 'shift_code', label: '근무코드', placeholder: 'D / N / E / 휴' },
  { key: 'shift_label', label: '근무명', placeholder: '주간 / 야간 / 휴무' },
  { key: 'start_time', label: '시작시간', type: 'time' },
  { key: 'end_time', label: '종료시간', type: 'time' },
  { key: 'position', label: '직종' },
  { key: 'team', label: '조' },
  { key: 'is_working', label: '근무 여부', type: 'bool' },
]

function ResidentsTab({
  residents,
  isAdmin,
  onRefresh,
  onMsg,
}: {
  residents: Resident[]
  isAdmin: boolean
  onRefresh: () => void
  onMsg: (msg: string, warns?: string[]) => void
}) {
  const [editRow, setEditRow] = useState<Record<string, any> | null | undefined>(undefined)
  const [syncing, setSyncing] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <Users size={15} className="text-blue-500" />
            수급자 정보 업로드
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            케어포에서 내보낸 수급자 엑셀을 업로드하세요.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {residents.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await apiClient.delete('/api/v1/eval/carefor/residents')
                  onRefresh()
                  onMsg('✅ 수급자 정보 삭제됨')
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-100 hover:bg-red-50 text-xs font-semibold text-red-500"
              >
                <Trash2 size={13} />
                삭제
              </button>
            )}

            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                if (!confirm('수급자 관리의 현재 수급자 정보로 대체합니다. 진행할까요?')) return
                setSyncing(true)
                try {
                  const res = await apiClient.post('/api/v1/eval/carefor/residents/sync-from-admin?replace=true')
                  const d = (res.data as any)?.data
                  onRefresh()
                  onMsg(`✅ 수급자 관리에서 ${d?.total ?? 0}명을 가져왔습니다 (엑셀 업로드 불필요)`)
                } catch (e: any) {
                  onMsg(`❌ ${e?.response?.data?.detail ?? '가져오기 실패'}`)
                } finally { setSyncing(false) }
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
              {syncing ? '가져오는 중...' : '수급자 관리에서 가져오기'}
            </button>

            <button
              type="button"
              onClick={() => setEditRow(null)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600"
            >
              + 직접 추가
            </button>

            <UploadBtn
              label={residents.length > 0 ? '재업로드' : '엑셀 업로드'}
              accept=".xlsx,.xls,.csv"
              endpoint="/api/v1/eval/carefor/residents/upload"
              onDone={(msg, warns) => {
                onMsg(msg, warns)
                onRefresh()
              }}
            />
          </div>
        )}
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 mb-3">
        <p className="text-[11px] font-bold text-teal-700 mb-1">✅ 권장: 엑셀 업로드 없이 바로 가져오기</p>
        <p className="text-[11px] text-teal-700 leading-relaxed">
          <b>「수급자 관리에서 가져오기」</b> 버튼을 누르면 Admin에 등록된 수급자(입소일·퇴소일·등급)를 그대로 불러옵니다. 엑셀을 뽑을 필요가 없습니다.
        </p>
        <p className="text-[10px] text-teal-500 mt-2 pt-2 border-t border-teal-100">
          📄 <b>케어포 엑셀로 넣고 싶다면</b>: <b>1-8 수급자 현황 리포트</b> → <b>해당 월 출력</b> → 엑셀로 저장 후 업로드
          <br /><span className="text-teal-400">권장 열: 수급자명, 생년월일, 장기요양등급, 입소일, 퇴소일, 생활실, 상태</span>
        </p>
      </div>

      {residents.length === 0 ? (
        <div className="bg-gray-50 rounded-xl py-8 text-center text-sm text-gray-400">
          등록된 수급자 정보가 없습니다
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400">
                {['이름', '생년월일', '등급', '입소일', '퇴소일', '생활실', '상태'].map(h => (
                  <th key={h} className="text-left py-2 px-2 font-semibold">
                    {h}
                  </th>
                ))}
                {isAdmin && <th className="text-right py-2 px-2 font-semibold">관리</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {residents.slice(0, 50).map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="py-2 px-2 font-semibold text-gray-800">{r.name}</td>
                  <td className="py-2 px-2 text-gray-500">{r.birth_date || '-'}</td>
                  <td className="py-2 px-2 text-gray-600">{r.care_grade || '-'}</td>
                  <td className="py-2 px-2 text-gray-500">{r.admission_date || '-'}</td>
                  <td className="py-2 px-2 text-gray-400">{r.discharge_date || '-'}</td>
                  <td className="py-2 px-2 text-gray-500">{r.room_name || '-'}</td>
                  <td className="py-2 px-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        STATUS_CLS[r.status] ?? ''
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => setEditRow(r)}
                        className="text-[11px] font-semibold text-gray-400 hover:text-primary-orange px-2 py-1 rounded hover:bg-orange-50">
                        수정
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {residents.length > 50 && (
            <p className="text-xs text-center text-gray-400 py-2">
              외 {residents.length - 50}명
            </p>
          )}
        </div>
      )}

      {editRow !== undefined && (
        <CareforRowEditor
          title="수급자"
          base="/api/v1/eval/carefor/residents"
          fields={RESIDENT_FIELDS}
          row={editRow}
          onClose={() => setEditRow(undefined)}
          onSaved={() => { onRefresh(); onMsg('✅ 수급자 정보가 반영되었습니다') }}
        />
      )}
    </div>
  )
}

// ── 외박/외출 탭 ─────────────────────────────────────────────────────────────
function LeavesTab({
  leaves,
  canManage,
  onRefresh,
  onMsg,
}: {
  leaves: LeaveRecord[]
  canManage: boolean
  onRefresh: () => void
  onMsg: (msg: string, warns?: string[]) => void
}) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [editRow, setEditRow] = useState<Record<string, any> | null | undefined>(undefined)
  const monthPrefix = `${ym.y}-${String(ym.m).padStart(2, '0')}-`
  const shown = leaves.filter(l => (l.start_date ?? '').startsWith(monthPrefix))
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <CalendarOff size={15} className="text-purple-500" />
            외박·외출 기록 업로드
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            외출·외박 기간 중 시설 서비스 기록이 있으면 HIGH 이슈로 탐지합니다.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {shown.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`${ym.y}년 ${ym.m}월 외박·외출 기록을 삭제할까요?`)) return
                  await apiClient.delete(`/api/v1/eval/carefor/leave-records/month/${ym.y}/${ym.m}`)
                  onRefresh()
                  onMsg(`✅ ${ym.y}년 ${ym.m}월 외박/외출 기록 삭제됨`)
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-100 hover:bg-red-50 text-xs font-semibold text-red-500"
              >
                <Trash2 size={13} />
                {ym.m}월 삭제
              </button>
            )}

            <button
              type="button"
              onClick={() => setEditRow(null)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600"
            >
              + 직접 추가
            </button>

            <UploadBtn
              label={leaves.length > 0 ? '재업로드' : '엑셀 업로드'}
              accept=".xlsx,.xls,.csv"
              color="purple"
              endpoint="/api/v1/eval/carefor/leave-records/upload"
              onDone={(msg, warns) => {
                onMsg(msg, warns)
                onRefresh()
              }}
            />
          </div>
        )}
      </div>

      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-3">
        <p className="text-[11px] font-bold text-purple-700 mb-1">📄 엑셀 뽑는 방법 (케어포)</p>
        <p className="text-[11px] text-purple-700 leading-relaxed">
          <b>1-9 수급자 외출·외박 리포트</b> → 해당 월 <b>1일 ~ 31일</b>로 기간 설정 → <b>조회</b> → <b>엑셀로 저장</b>
        </p>
        <p className="text-[10px] text-purple-400 mt-1">권장 열: 수급자명, 구분, 외박일/외출일, 귀원일, 사유</p>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-500">조회 월</span>
        <select value={ym.y} onChange={e => setYm({ ...ym, y: +e.target.value })}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={ym.m} onChange={e => setYm({ ...ym, m: +e.target.value })}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{shown.length}건 / 전체 {leaves.length}건</span>
      </div>

      {shown.length === 0 ? (
        <div className="bg-gray-50 rounded-xl py-8 text-center text-sm text-gray-400">
          {ym.y}년 {ym.m}월 외박/외출 기록이 없습니다
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {shown.slice(0, 100).map((l, i) => (
            <div
              key={l.id || i}
              className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs px-3 py-2 bg-gray-50 rounded-xl"
            >
              <span
                className={`w-fit px-1.5 py-0.5 rounded-full font-semibold ${
                  l.leave_type === '외박'
                    ? 'bg-purple-100 text-purple-700'
                    : l.leave_type === '병원외출'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                {l.leave_type}
              </span>

              <span className="font-semibold text-gray-700">{l.resident_name}</span>
              <span className="text-gray-500">
                {l.start_date}
                {l.start_time ? ` ${l.start_time}` : ''}
              </span>
              <span className="hidden sm:inline text-gray-400">→</span>
              <span className="text-gray-500">
                {l.end_date || '미귀원'}
                {l.end_time ? ` ${l.end_time}` : ''}
              </span>
              {l.reason && <span className="text-gray-400 truncate">{l.reason}</span>}
              {canManage && (
                <button onClick={() => setEditRow(l as any)}
                  className="sm:ml-auto text-[11px] font-semibold text-gray-400 hover:text-purple-600 px-2 py-0.5 rounded hover:bg-purple-50 shrink-0">
                  수정
                </button>
              )}
            </div>
          ))}

          {shown.length > 100 && (
            <p className="text-xs text-center text-gray-400 py-1">
              외 {shown.length - 100}건
            </p>
          )}
        </div>
      )}

      {editRow !== undefined && (
        <CareforRowEditor
          title="외박·외출"
          base="/api/v1/eval/carefor/leave-records"
          fields={LEAVE_FIELDS}
          row={editRow}
          onClose={() => setEditRow(undefined)}
          onSaved={() => { onRefresh(); onMsg('✅ 외박·외출 기록이 반영되었습니다') }}
        />
      )}
    </div>
  )
}

// ── 검수 룰 탭 ───────────────────────────────────────────────────────────────
interface AuditRule {
  id: number
  title: string
  content: string
  is_active: boolean
  created_at: string
  updated_at: string
}

function RulesTab({ isAdmin }: { isAdmin: boolean }) {
  const [rules, setRules] = useState<AuditRule[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/api/v1/eval/record-audit/rules')
      setRules((res.data as any)?.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = async (id: number) => {
    await apiClient.patch(`/api/v1/eval/record-audit/rules/${id}/toggle`)
    load()
  }

  const del = async (id: number, title: string) => {
    if (!confirm(`"${title}" 룰을 삭제하시겠습니까?`)) return
    await apiClient.delete(`/api/v1/eval/record-audit/rules/${id}`)
    load()
  }

  const save = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      setMsg('제목과 내용을 입력하세요')
      return
    }

    setSaving(true)
    setMsg('')

    try {
      if (editId !== null) {
        await apiClient.patch(`/api/v1/eval/record-audit/rules/${editId}`, {
          title: newTitle,
          content: newContent,
        })
        setMsg('✅ 수정됨')
      } else {
        await apiClient.post('/api/v1/eval/record-audit/rules', {
          title: newTitle,
          content: newContent,
        })
        setMsg('✅ 추가됨')
      }

      setAdding(false)
      setEditId(null)
      setNewTitle('')
      setNewContent('')
      load()
    } catch (e: any) {
      setMsg(`❌ ${e?.response?.data?.detail ?? '오류'}`)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (rule: AuditRule) => {
    setEditId(rule.id)
    setNewTitle(rule.title)
    setNewContent(rule.content)
    setAdding(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <Settings size={15} className="text-orange-500" />
            검수 룰 관리
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            활성화된 룰이 검수 기준에 적용됩니다.
          </p>
        </div>

        {isAdmin && !adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setEditId(null)
              setNewTitle('')
              setNewContent('')
            }}
            className="flex w-full sm:w-auto items-center justify-center gap-1.5 text-xs font-semibold bg-primary-orange text-white px-3 py-2 rounded-xl hover:bg-primary-orange/90"
          >
            <Plus size={12} />
            룰 추가
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`px-4 py-2.5 rounded-xl text-sm border ${
            msg.startsWith('✅')
              ? 'bg-green-50 border-green-100 text-green-700'
              : 'bg-red-50 border-red-100 text-red-700'
          }`}
        >
          {msg}
        </div>
      )}

      {adding && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-orange-900">
            {editId ? '룰 수정' : '새 룰 추가'}
          </p>

          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="룰 제목"
            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/40"
          />

          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={8}
            placeholder={`[HIGH] 예시 룰\n- 외박 중 서비스 기록이 있으면 중요 이슈\n\n[MEDIUM] 권고 사항\n- 목욕은 주 2회 이상 기록 권장`}
            className="w-full border border-orange-200 rounded-xl px-3 py-2.5 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/40 resize-none"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary-orange text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {editId ? '저장' : '추가'}
            </button>

            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setEditId(null)
                setMsg('')
              }}
              className="text-xs text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={16} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-gray-50 rounded-xl py-8 text-center text-sm text-gray-400">
          저장된 룰이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${
                rule.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => toggle(rule.id)}
                    title={rule.is_active ? '비활성화' : '활성화'}
                    className={`flex-shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                      rule.is_active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        rule.is_active ? 'left-4' : 'left-0.5'
                      }`}
                    />
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">
                    {rule.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {rule.is_active ? '✅ 검수 시 적용됨' : '⏸ 비활성'}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(rule)}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      <Edit3 size={12} className="text-gray-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => del(rule.id, rule.title)}
                      className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50"
                    >
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 bg-gray-50/50">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-mono max-h-32 overflow-y-auto">
                  {rule.content}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 검수 결과 뷰 ──────────────────────────────────────────────────────────────
function AuditResultView({ record }: { record: AuditRecord }) {
  const r = record.result
  const llmSummary = r.llm_summary

  const [showAll, setShowAll] = useState(false)

  const issues = r.issues ?? []
  const strengths = r.strengths ?? []

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const highIssues = issues.filter(i => i.severity === 'high')
  const mediumIssues = issues.filter(i => i.severity === 'medium')
  const lowIssues = issues.filter(i => i.severity === 'low')

  const otherIssues = [...mediumIssues, ...lowIssues]
  const visibleOther = showAll ? otherIssues : otherIssues.slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 text-center">
            <div
              className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-bold ${
                GRADE_CLS[r.overall_grade] ?? ''
              }`}
            >
              <span className="text-xs font-normal opacity-70">점수</span>
              <span className="text-xl leading-tight">{r.score ?? '—'}</span>
            </div>

            <p className="text-[10px] font-bold mt-1 text-gray-500">
              {r.overall_grade}
            </p>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-bold text-gray-900 text-sm truncate">
                {record.filename}
              </p>
              <span className="text-xs text-gray-400">
                · {(r.total_rows ?? 0).toLocaleString()}행 · {issues.length}건 지적
              </span>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              {r.summary}
            </p>

            <p className="text-xs text-gray-400 mt-2">
              검수: {record.auditor} ·{' '}
              {new Date(record.created_at).toLocaleString('ko-KR')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-50">
          {[
            {
              label: '즉시조치',
              count: criticalIssues.length,
              cls: 'bg-purple-50 text-purple-700',
            },
            {
              label: '중요',
              count: highIssues.length,
              cls: 'bg-red-50 text-red-600',
            },
            {
              label: '보통',
              count: mediumIssues.length,
              cls: 'bg-orange-50 text-orange-600',
            },
            {
              label: '경미',
              count: lowIssues.length,
              cls: 'bg-gray-50 text-gray-500',
            },
          ].map(s => (
            <div key={s.label} className={`text-center rounded-xl py-2.5 ${s.cls}`}>
              <p className="text-lg font-bold">{s.count}</p>
              <p className="text-[11px]">{s.label}</p>
            </div>
          ))}
        </div>

        {strengths.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1">
              <CheckCircle2 size={12} />
              잘 기록된 점
            </p>

            <ul className="space-y-1">
              {strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {llmSummary?.admin_comment && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1">
              <Sparkles size={12} />
              AI 분석
            </p>

            <p className="text-sm text-gray-600 leading-relaxed">
              {llmSummary.admin_comment}
            </p>
          </div>
        )}

        {!!llmSummary?.priority_actions?.length && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
              <Zap size={12} /> 우선 조치
            </p>

            <ul className="space-y-1">
              {llmSummary.priority_actions.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-red-400 flex-shrink-0 mt-0.5">
                    {i + 1}.
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!!llmSummary?.recording_tips?.length && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-green-600 mb-1.5 flex items-center gap-1">
              <Sparkles size={12} />
              기록 개선 팁
            </p>

            <ul className="space-y-1">
              {llmSummary.recording_tips.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.issue_total_count && r.issue_total_count > issues.length && (
          <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-xs text-yellow-700 flex items-start gap-1.5">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>전체 이슈 {r.issue_total_count.toLocaleString()}건 중 상위 {issues.length}건만 표시됩니다.</span>
          </div>
        )}
      </div>

      {r.total_residents_detected && r.total_residents_detected > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
              <Users size={14} className="text-blue-500" />
              수급자별 검수 결과 ({r.total_residents_detected}명)
            </p>

            <div className="flex gap-3 text-xs text-gray-500">
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> 매칭 {r.matched_residents ?? 0}명
              </span>

              {(r.unmatched_residents ?? 0) > 0 && (
                <span className="text-red-500 flex items-center gap-1">
                  <XCircle size={12} /> 미매칭 {r.unmatched_residents}명
                </span>
              )}
            </div>
          </div>

          <ResidentResultTable
            residents={r.resident_results ?? []}
            auditId={record.id}
          />
        </div>
      )}

      {issues.length === 0 && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
          <CheckCircle2 size={36} className="mx-auto mb-2 text-green-500" />
          <p className="font-semibold text-green-700 text-lg">
            Rule Engine 이슈 없음
          </p>
          <p className="text-sm text-green-600 mt-1">
            모든 검수 기준을 통과했습니다
          </p>
        </div>
      )}

      {criticalIssues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-purple-700 flex items-center gap-1 px-1">
            <AlertOctagon size={12} /> 즉시 조치 — 허위기록 의심 ({criticalIssues.length}건)
          </p>

          {criticalIssues.map((issue, i) => (
            <IssueCard key={i} issue={issue} />
          ))}
        </div>
      )}

      {highIssues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-red-600 flex items-center gap-1 px-1">
            <AlertTriangle size={12} />
            즉시 수정 필요 ({highIssues.length}건)
          </p>

          {highIssues.map((issue, i) => (
            <IssueCard key={i} issue={issue} />
          ))}
        </div>
      )}

      {otherIssues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 px-1">
            기타 검수 사항 ({otherIssues.length}건)
          </p>

          {visibleOther.map((issue, i) => (
            <IssueCard key={i} issue={issue} />
          ))}

          {otherIssues.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="w-full text-xs font-medium text-gray-500 hover:text-gray-700 py-2 flex items-center justify-center gap-1 border border-gray-100 rounded-xl hover:bg-gray-50"
            >
              {showAll ? (
                <>
                  <ChevronUp size={13} />
                  접기
                </>
              ) : (
                <>
                  <ChevronDown size={13} />
                  {otherIssues.length - 3}건 더보기
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function IssueCard({ issue }: { issue: AuditIssue }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-xl border ${SEV[issue.severity] ?? SEV.low}`}>
      <button
        type="button"
        className="w-full flex items-center gap-2.5 p-3.5 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                SEV[issue.severity]
              }`}
            >
              {SEV_LABEL[issue.severity]}
            </span>
            <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded-full font-semibold">
              {issue.type}
            </span>
            {issue.location && (
              <span className="text-[10px] opacity-70">{issue.location}</span>
            )}
          </div>

          <p className="text-sm font-semibold leading-snug">{issue.description}</p>
        </div>

        {open ? (
          <ChevronUp size={14} className="flex-shrink-0 opacity-50" />
        ) : (
          <ChevronDown size={14} className="flex-shrink-0 opacity-50" />
        )}
      </button>

      {open && issue.suggestion && (
        <div className="px-3.5 pb-3.5">
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-[11px] font-semibold opacity-60 mb-1">개선 방안</p>
            <p className="text-sm">{issue.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 근무표 탭 ─────────────────────────────────────────────────────────────────
function ScheduleTab({
  schedules,
  isAdmin,
  onRefresh,
  onMsg,
}: {
  schedules: WorkSchedule[]
  isAdmin: boolean
  onRefresh: () => void
  onMsg: (msg: string, warns?: string[]) => void
}) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [editRow, setEditRow] = useState<Record<string, any> | null | undefined>(undefined)

  const SHIFT_CLS: Record<string, string> = {
    주간: 'bg-blue-100 text-blue-700',
    야간: 'bg-indigo-100 text-indigo-700',
    이브닝: 'bg-purple-100 text-purple-700',
    휴무: 'bg-gray-100 text-gray-400',
    연차: 'bg-yellow-100 text-yellow-600',
    대휴: 'bg-orange-100 text-orange-600',
  }

  const upload = async (file: File) => {
    setUploading(true)

    const form = new FormData()
    form.append('file', file)
    form.append('year', String(year))
    form.append('month', String(month))

    try {
      const res = await apiClient.post('/api/v1/eval/carefor/work-schedules/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const d = (res.data as any)?.data
      const normTag = d?.normalizer === 'openai' ? ' [AI 정규화]' : ' [기본 정규화]'
      const warnTag = d?.warnings?.length ? ` ⚠️ 경고 ${d.warnings.length}건` : ''

      onMsg(
        `✅ 근무표 업로드${normTag} — 신규 ${d?.imported ?? 0}건, 수정 ${d?.updated ?? 0}건${warnTag}`,
        d?.warnings ?? [],
      )

      onRefresh()
    } catch (e: any) {
      onMsg(`❌ ${e?.response?.data?.detail ?? '업로드 실패'}`)
    } finally {
      setUploading(false)
    }
  }

  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const filtered = schedules.filter(s => s.work_date.startsWith(prefix))

  const byStaff: Record<string, WorkSchedule[]> = {}
  filtered.forEach(s => {
    if (!byStaff[s.staff_name]) byStaff[s.staff_name] = []
    byStaff[s.staff_name].push(s)
  })

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <Clock size={15} className="text-teal-500" />
            근무표 업로드
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            근무표 엑셀 업로드 — 행=직원·열=날짜 또는 행=날짜별 기록 지원
          </p>
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 mt-2">
            <p className="text-[11px] font-bold text-teal-700 mb-1">📄 엑셀 뽑는 방법</p>
            <p className="text-[11px] text-teal-700 leading-relaxed">
              Google Sheet <b>「행복한_근무표」</b> → <b>해당 월 근무</b> 시트 → <b>파일 &gt; 다운로드 &gt; Microsoft Excel(.xlsx)</b>
            </p>
            <p className="text-[10px] text-teal-400 mt-1">업로드 전 위에서 <b>해당 연·월</b>을 먼저 선택하세요.</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {schedules.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await apiClient.delete(
                    `/api/v1/eval/carefor/work-schedules?year=${year}&month=${month}`,
                  )
                  onRefresh()
                  onMsg('✅ 해당 월 근무표 삭제됨')
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-100 hover:bg-red-50 text-xs font-semibold text-red-500"
              >
                <Trash2 size={13} />
                삭제
              </button>
            )}

            <button
              type="button"
              onClick={() => setEditRow(null)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600"
            >
              + 직접 추가
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white px-3 py-2 rounded-xl disabled:opacity-50"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? '업로드 중...' : '엑셀 업로드'}
            </button>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ''
              }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none"
        >
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>

        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>

        <span className="text-xs text-gray-400">{filtered.length}건 표시 중</span>
      </div>

      <p className="text-[11px] text-gray-400 mb-4">
        권장 형태 A: 첫 열=직원명, 이후 열=1일~31일, 셀=D/N/E/휴/연차
        <br />
        권장 형태 B: 날짜 | 직원명 | 근무구분 | 시작시간 | 종료시간
      </p>

      {Object.keys(byStaff).length === 0 ? (
        <div className="bg-gray-50 rounded-xl py-8 text-center text-sm text-gray-400">
          {year}년 {month}월 근무표가 없습니다
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-2 font-semibold text-gray-500 sticky left-0 bg-white">
                  직원명
                </th>

                {days.map(d => (
                  <th
                    key={d}
                    className="text-center py-2 px-1 font-semibold text-gray-400 min-w-[28px]"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {Object.entries(byStaff).map(([name, recs]) => {
                const byDay: Record<number, WorkSchedule> = {}

                recs.forEach(r => {
                  const day = parseInt(r.work_date.slice(8), 10)
                  byDay[day] = r
                })

                return (
                  <tr key={name} className="hover:bg-gray-50/50">
                    <td className="py-1.5 px-2 font-semibold text-gray-700 sticky left-0 bg-white whitespace-nowrap">
                      {name}
                    </td>

                    {days.map(d => {
                      const sc = byDay[d]

                      if (!sc) {
                        return (
                          <td key={d} className="py-1.5 px-1 text-center text-gray-200">
                            ·
                          </td>
                        )
                      }

                      const lbl = sc.shift_label || sc.shift_code
                      const cls =
                        SHIFT_CLS[lbl] ??
                        (sc.is_working
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400')

                      return (
                        <td key={d} className="py-1.5 px-0.5 text-center">
                          <span
                            onClick={() => isAdmin && setEditRow(sc as any)}
                            className={`inline-block text-[9px] font-bold px-1 py-0.5 rounded ${cls} ${isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-teal-300' : ''}`}
                            title={isAdmin ? `클릭해 수정 · ${sc.start_time || ''}~${sc.end_time || ''}` : `${sc.start_time || ''}~${sc.end_time || ''}`}
                          >
                            {sc.shift_code || lbl}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && (
        <p className="text-[11px] text-gray-400 mt-2">💡 근무 코드를 클릭하면 해당 근무를 수정·삭제할 수 있습니다.</p>
      )}

      {editRow !== undefined && (
        <CareforRowEditor
          title="근무표"
          base="/api/v1/eval/carefor/work-schedules"
          fields={SCHEDULE_FIELDS}
          row={editRow}
          onClose={() => setEditRow(undefined)}
          onSaved={() => { onRefresh(); onMsg('✅ 근무표가 반영되었습니다') }}
        />
      )}
    </div>
  )
}

// ── 수급자별 결과 테이블 ──────────────────────────────────────────────────────
function ResidentResultTable({
  residents,
  auditId,
}: {
  residents: ResidentResult[]
  auditId: string
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'issues' | 'unmatched' | 'high'>('all')

  const filtered = residents.filter(r => {
    const nameMatch = !search || r.resident_name.includes(search)
    const filterMatch =
      filter === 'all'
        ? true
        : filter === 'issues'
          ? r.issues.length > 0
          : filter === 'unmatched'
            ? r.match_status === 'unmatched'
            : filter === 'high'
              ? r.issue_summary.critical + r.issue_summary.high > 0
              : true

    return nameMatch && filterMatch
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름 검색"
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/40 w-full sm:w-32"
        />

        {(['all', 'issues', 'high', 'unmatched'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-2 rounded-xl border transition-colors ${
              filter === f
                ? 'bg-blue-500 text-white border-blue-500'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f === 'all'
              ? '전체'
              : f === 'issues'
                ? '이슈 있음'
                : f === 'high'
                  ? '고위험'
                  : '미매칭'}
          </button>
        ))}

        <span className="text-xs text-gray-400 self-center">{filtered.length}명</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[880px]">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              {['수급자명', '생년월일', '상태', '등급', '점수', '즉시조치', '중요', '목욕', '매칭', '상세'].map(h => (
                <th key={h} className="text-left py-2 px-2 font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {filtered.map((r, i) => {
              const rowId = `${r.resident_name}-${i}`
              const highCount = r.issue_summary.critical + r.issue_summary.high

              return (
                <Fragment key={rowId}>
                  <tr className={`hover:bg-gray-50/50 ${highCount > 0 ? 'bg-red-50/20' : ''}`}>
                    <td className="py-2 px-2 font-semibold text-gray-800">
                      {r.resident_name}
                    </td>
                    <td className="py-2 px-2 text-gray-500">{r.birth_date || '-'}</td>
                    <td className="py-2 px-2 text-gray-500 text-[10px]">
                      {r.resident_status || '-'}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          GRADE_CLS[r.grade] ?? ''
                        }`}
                      >
                        {r.grade}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-bold text-gray-700">{r.score}</td>
                    <td className="py-2 px-2">
                      {highCount > 0 ? (
                        <span className="text-red-600 font-bold">{highCount}건</span>
                      ) : (
                        <span className="text-green-500">✓</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-orange-600">
                      {r.issue_summary.medium || '-'}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={
                          r.bathing_count >= 5
                            ? 'text-green-600'
                            : 'text-red-500 font-bold'
                        }
                      >
                        {r.bathing_count}회
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          r.match_status === 'matched'
                            ? 'bg-green-100 text-green-700'
                            : r.match_status === 'unmatched'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {r.match_status === 'matched'
                          ? '매칭'
                          : r.match_status === 'unmatched'
                            ? '미매칭'
                            : '동명이인'}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/eval/record-audit/${auditId}/resident/${encodeURIComponent(
                              r.resident_name,
                            )}`,
                          )
                        }
                        className="text-blue-500 hover:text-blue-700 text-[10px] font-semibold underline-offset-2 hover:underline"
                      >
                        상세 →
                      </button>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}