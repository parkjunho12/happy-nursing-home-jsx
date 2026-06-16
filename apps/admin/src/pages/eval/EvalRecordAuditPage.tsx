import { useState, useRef, useEffect } from 'react'
import {
  FileSpreadsheet, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, History, X, Printer, RefreshCw, ShieldCheck, Settings,
  Users, CalendarOff, Trash2, Upload, Edit3, Save, Check, Sparkles, Clock,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/auth'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface AuditIssue {
  type: string; severity: 'critical'|'high'|'medium'|'low'
  location: string; description: string; suggestion: string
}
interface LlmSummary {
  summary: string
  admin_comment: string
  priority_actions: string[]
  recording_tips: string[]
}
interface AuditResult {
  summary: string; score: number; total_rows: number
  issues: AuditIssue[]; strengths: string[]
  overall_grade: string; ai_recommendations?: string[]
  issue_summary?: { critical: number; high: number; medium: number; low: number }
  issue_total_count?: number
  llm_summary?: LlmSummary
}
interface AuditRecord {
  id: string; filename: string; auditor: string
  result: AuditResult; created_at: string
  context?: { residents_count: number; leaves_count: number; rule_applied: boolean }
}
interface Resident {
  id: string; name: string; birth_date: string; care_grade: string
  admission_date: string; discharge_date: string; room_name: string; status: string
}
interface WorkSchedule {
  id: string; staff_name: string; user_id: string | null
  work_date: string; shift_code: string; shift_label: string
  start_time: string; end_time: string; is_working: boolean
}
interface LeaveRecord {
  id: string; resident_name: string; leave_type: string
  start_date: string; start_time: string; end_date: string; end_time: string; reason: string
}

const SEV: Record<string, string> = {
  critical: 'bg-purple-50 border-purple-300 text-purple-800',
  high:     'bg-red-50 border-red-200 text-red-700',
  medium:   'bg-orange-50 border-orange-200 text-orange-700',
  low:      'bg-gray-50 border-gray-200 text-gray-600',
}
const SEV_LABEL: Record<string, string> = {
  critical:'즉시조치', high:'중요', medium:'보통', low:'경미'
}
const GRADE_CLS: Record<string, string> = {
  '양호(A)':'bg-green-100 text-green-700 border-green-300',
  '양호(B)':'bg-blue-100 text-blue-700 border-blue-300',
  '보통(C)':'bg-orange-100 text-orange-700 border-orange-300',
  '미흡(D)':'bg-red-100 text-red-700 border-red-300',
  '양호':'bg-green-100 text-green-700 border-green-300',
  '보통':'bg-orange-100 text-orange-700 border-orange-300',
  '미흡':'bg-red-100 text-red-700 border-red-300',
}
const STATUS_LABEL: Record<string, string> = { active:'입소중', inactive:'퇴소', deceased:'사망' }
const STATUS_CLS:   Record<string, string> = {
  active:'bg-green-100 text-green-700', inactive:'bg-gray-100 text-gray-500', deceased:'bg-red-100 text-red-700'
}

// ── 공통 업로드 버튼 ──────────────────────────────────────────────────────────
function UploadBtn({ label, accept, endpoint, onDone, disabled, color = 'blue' }: {
  label: string; accept: string; endpoint: string
  onDone: (msg: string, warnings?: string[]) => void; disabled?: boolean; color?: string
}) {
  const ref  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const cls = color === 'purple'
    ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'

  const upload = async (file: File) => {
    setUploading(true)
    const form = new FormData(); form.append('file', file)
    try {
      const res = await apiClient.post(endpoint, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const d = (res.data as any)?.data
      const normTag = d?.normalizer === 'openai' ? ' [AI 정규화]' : ' [기본 정규화]'
      const warnTag = d?.warnings?.length ? ` ⚠️ 경고 ${d.warnings.length}건` : ''
      onDone(`✅ ${file.name}${normTag} — 신규 ${d?.imported ?? 0}건, 수정 ${d?.updated ?? 0}건${warnTag}`, d?.warnings ?? [])
    } catch (e: any) {
      onDone(`❌ ${e?.response?.data?.detail ?? '업로드 실패'}`, [])
    } finally { setUploading(false) }
  }

  return (
    <>
      <button onClick={() => ref.current?.click()} disabled={disabled || uploading}
        className={`flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-xl disabled:opacity-50 transition-colors ${cls}`}>
        {uploading ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}
        {uploading ? '업로드 중...' : label}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}/>
    </>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function EvalRecordAuditPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const isSocial = user?.position === '사회복지사'

  const [tab, setTab] = useState<
    'audit' | 'residents' | 'leaves' | 'schedules' | 'rules'
  >('audit')

  // 검수 탭
  const [dragging,    setDragging]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [result,      setResult]      = useState<AuditRecord | null>(null)
  const [history,     setHistory]     = useState<AuditRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [auditError,  setAuditError]  = useState<string | null>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // 컨텍스트 데이터
  const [residents,  setResidents]  = useState<Resident[]>([])
  const [leaves,     setLeaves]     = useState<LeaveRecord[]>([])
  const [schedules,  setSchedules]  = useState<WorkSchedule[]>([])
  const [rule,       setRule]       = useState<{title:string;content:string}|null>(null)
  const [ctxMsg,      setCtxMsg]      = useState('')
  const [ctxWarnings, setCtxWarnings] = useState<string[]>([])

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (result) setTimeout(() => resultRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 100)
  }, [result])

  const loadAll = async () => {
    try {
      const [ruleRes, resRes, leaveRes, schedRes] = await Promise.allSettled([
        apiClient.get('/api/v1/eval/record-audit/rules'),
        apiClient.get('/api/v1/eval/carefor/residents'),
        apiClient.get('/api/v1/eval/carefor/leave-records'),
        apiClient.get('/api/v1/eval/carefor/work-schedules'),
      ])
      if (ruleRes.status === 'fulfilled')   setRule((ruleRes.value.data as any)?.data ?? null)
      if (resRes.status === 'fulfilled')    setResidents((resRes.value.data as any)?.data ?? [])
      if (leaveRes.status === 'fulfilled')  setLeaves((leaveRes.value.data as any)?.data ?? [])
      if (schedRes.status === 'fulfilled')  setSchedules((schedRes.value.data as any)?.data ?? [])
    } catch {}
  }

  const runAudit = async (file: File) => {
    setUploading(true); setAuditError(null); setResult(null)
    const form = new FormData(); form.append('file', file)
    try {
      const res = await apiClient.post('/api/v1/eval/record-audit/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000,
      })
      setResult((res.data as any)?.data)
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
    { id: 'audit',     label: '검수 실행',          icon: FileSpreadsheet },
    { id: 'residents', label: `수급자 정보 (${residents.length}명)`, icon: Users },
    { id: 'leaves',    label: `외박/외출 (${leaves.length}건)`,      icon: CalendarOff },
    { id: 'schedules', label: `근무표 (${schedules.length}건)`,       icon: Clock },
    { id: 'rules',     label: '검수 룰',             icon: Settings },
  ] as const

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">제공기록지 AI 검수</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Rule Engine이 판단 · Claude가 설명 생성 · 수급자 정보·외박/외출 DB 연계
          </p>
        </div>
        <div className="flex gap-2">
          {result && (
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
              <Printer size={14}/> 인쇄
            </button>
          )}
          <button onClick={async () => { if (!showHistory) { const r = await apiClient.get('/api/v1/eval/record-audit/history'); setHistory((r.data as any)?.data ?? []) }; setShowHistory(v=>!v) }}
            className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
            <History size={14}/> 이력
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {ctxMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm border ${ctxMsg.startsWith('✅') ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          <div className="flex items-center justify-between">{ctxMsg}<button onClick={() => { setCtxMsg(''); setCtxWarnings([]) }} className="ml-2 opacity-50 hover:opacity-100"><X size={12}/></button></div>
          {ctxWarnings.length > 0 && (
            <div className="mt-2 space-y-0.5">{ctxWarnings.slice(0,5).map((w,i) => <p key={i} className="text-xs opacity-70">⚠️ {w}</p>)}{ctxWarnings.length > 5 && <p className="text-xs opacity-50">외 {ctxWarnings.length-5}건</p>}</div>
          )}
        </div>
      )}

      {/* ── 검수 실행 탭 ── */}
      {tab === 'audit' && (
        <>
          {/* 컨텍스트 상태 */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: <ShieldCheck size={12}/>, label:'검수 룰', active: !!rule, text: rule ? '적용됨' : '미설정' },
              { icon: <Users size={12}/>,       label:'수급자', active: residents.length > 0, text: residents.length > 0 ? `${residents.length}명 연계` : '없음' },
              { icon: <CalendarOff size={12}/>, label:'외박/외출', active: leaves.length > 0, text: leaves.length > 0 ? `${leaves.length}건 연계` : '없음' },
              { icon: <Clock size={12}/>, label:'근무표', active: schedules.length > 0, text: schedules.length > 0 ? `${schedules.length}건 연계` : '없음' },
            ].map((b, i) => (
              <span key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium ${b.active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                {b.icon} {b.label}: <span className={b.active ? 'font-bold' : ''}>{b.text}</span>
              </span>
            ))}
          </div>

          {auditError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5"/>
              <span className="flex-1">{auditError}</span>
              <button onClick={() => setAuditError(null)}><X size={14}/></button>
            </div>
          )}

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) runAudit(f) }}
            onClick={() => !uploading && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
              uploading ? 'border-primary-orange/30 bg-orange-50/50 cursor-wait'
              : dragging ? 'border-primary-orange bg-orange-50 cursor-copy'
              : 'border-gray-200 hover:border-primary-orange hover:bg-orange-50/30 cursor-pointer'
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt"
              onChange={e => { const f = e.target.files?.[0]; if (f) runAudit(f) }}
              disabled={uploading} className="hidden"/>
            {uploading ? (
              <>
                <Loader2 size={40} className="mx-auto mb-3 text-primary-orange animate-spin"/>
                <p className="font-semibold text-gray-700">Rule Engine + AI 검수 중</p>
                <p className="text-sm text-gray-400 mt-1">수급자 {residents.length}명·외박/외출 {leaves.length}건·근무표 {schedules.length}건 연계 · 30초~1분 소요</p>
              </>
            ) : (
              <>
                <FileSpreadsheet size={40} className="mx-auto mb-3 text-gray-300"/>
                <p className="font-semibold text-gray-700 mb-1">{result ? '다른 파일 검수하기' : '제공기록지 파일 업로드'}</p>
                <p className="text-sm text-gray-400">xlsx · xls · csv · txt · 최대 5MB</p>
              </>
            )}
          </div>

          {result && (
            <div ref={resultRef}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">검수 결과</p>
                  {result.context?.residents_count ? (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">수급자 {result.context.residents_count}명 연계</span>
                  ) : null}
                  {result.context?.leaves_count ? (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">외박/외출 {result.context.leaves_count}건 연계</span>
                  ) : null}
                  {(result.context as any)?.schedules_count ? (
                    <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">근무표 {(result.context as any).schedules_count}건 연계</span>
                  ) : null}
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Rule Engine 판단</span>
                </div>
                <button onClick={() => { setResult(null); setAuditError(null) }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <RefreshCw size={11}/> 초기화
                </button>
              </div>
              <AuditResultView record={result}/>
            </div>
          )}

          {showHistory && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5"><History size={14}/> 검수 이력</p>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">이력이 없습니다</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map(h => (
                    <button key={h.id} onClick={() => { setResult(h); setShowHistory(false) }}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${GRADE_CLS[h.result.overall_grade] ?? ''}`}>
                        {h.result.overall_grade}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{h.filename}</p>
                        <p className="text-xs text-gray-400 truncate">{h.result.summary}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(h.created_at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── 수급자 정보 탭 ── */}
      {tab === 'residents' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <Users size={15} className="text-blue-500"/> 수급자 정보 업로드
                </p>
                <p className="text-xs text-gray-400 mt-0.5">케어포에서 내보낸 수급자 엑셀을 업로드하세요. 중복 시 자동 업데이트됩니다.</p>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  {residents.length > 0 && (
                    <button onClick={async () => { await apiClient.delete('/api/v1/eval/carefor/residents'); setResidents([]); setCtxMsg('✅ 수급자 정보 삭제됨') }}
                      className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50">
                      <Trash2 size={13} className="text-red-400"/>
                    </button>
                  )}
                  <UploadBtn label={residents.length > 0 ? '재업로드' : '엑셀 업로드'}
                    accept=".xlsx,.xls,.csv"
                    endpoint="/api/v1/eval/carefor/residents/upload"
                    onDone={(msg, warns) => { setCtxMsg(msg); if (warns?.length) setCtxWarnings(warns); loadAll() }}/>
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              권장 열: 수급자명, 생년월일, 장기요양등급, 입소일, 퇴소일, 생활실, 상태 (열 이름이 달라도 자동 인식)
            </p>
            {residents.length === 0 ? (
              <div className="bg-gray-50 rounded-xl py-8 text-center text-sm text-gray-400">
                등록된 수급자 정보가 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400">
                      {['이름','생년월일','등급','입소일','퇴소일','생활실','상태'].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-semibold">{h}</th>
                      ))}
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
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_CLS[r.status] ?? ''}`}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {residents.length > 50 && (
                  <p className="text-xs text-center text-gray-400 py-2">외 {residents.length - 50}명</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 외박/외출 탭 ── */}
      {tab === 'leaves' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <CalendarOff size={15} className="text-purple-500"/> 외박·외출 기록 업로드
                </p>
                <p className="text-xs text-gray-400 mt-0.5">외출·외박 기간 중 시설 서비스 기록이 있으면 Rule Engine이 자동으로 HIGH 이슈로 탐지합니다.</p>
              </div>
              {(isAdmin || isSocial) && (
                <div className="flex gap-2">
                  {leaves.length > 0 && (
                    <button onClick={async () => { await apiClient.delete('/api/v1/eval/carefor/leave-records'); setLeaves([]); setCtxMsg('✅ 외박/외출 기록 삭제됨') }}
                      className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50">
                      <Trash2 size={13} className="text-red-400"/>
                    </button>
                  )}
                  <UploadBtn label={leaves.length > 0 ? '재업로드' : '엑셀 업로드'}
                    accept=".xlsx,.xls,.csv" color="purple"
                    endpoint="/api/v1/eval/carefor/leave-records/upload"
                    onDone={(msg, warns) => { setCtxMsg(msg); if (warns?.length) setCtxWarnings(warns); loadAll() }}/>
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              권장 열: 수급자명, 구분(외출/외박/병원외출), 외박일/외출일, 귀원일, 사유 (열 이름이 달라도 자동 인식)
            </p>
            {leaves.length === 0 ? (
              <div className="bg-gray-50 rounded-xl py-8 text-center text-sm text-gray-400">등록된 외박/외출 기록이 없습니다</div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {leaves.slice(0, 100).map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 bg-gray-50 rounded-xl">
                    <span className={`px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                      l.leave_type === '외박' ? 'bg-purple-100 text-purple-700'
                      : l.leave_type === '병원외출' ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                    }`}>{l.leave_type}</span>
                    <span className="font-semibold text-gray-700">{l.resident_name}</span>
                    <span className="text-gray-500">{l.start_date}{l.start_time ? ` ${l.start_time}` : ''}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-500">{l.end_date || '미귀원'}{l.end_time ? ` ${l.end_time}` : ''}</span>
                    {l.reason && <span className="text-gray-400 truncate">{l.reason}</span>}
                  </div>
                ))}
                {leaves.length > 100 && <p className="text-xs text-center text-gray-400 py-1">외 {leaves.length-100}건</p>}
              </div>
            )}
          </div>
        </div>
      )}


      {/* ── 근무표 탭 ── */}
      {tab === 'schedules' && (
        <ScheduleTab schedules={schedules} isAdmin={isAdmin} onRefresh={loadAll} onMsg={(m,w)=>{setCtxMsg(m);if(w?.length)setCtxWarnings(w)}}/>
      )}

      {/* ── 검수 룰 탭 ── */}
      {tab === 'rules' && (
        <RulesTab rule={rule} isAdmin={isAdmin} onRefresh={loadAll}/>
      )}
    </div>
  )
}

// ── 검수 룰 탭 ───────────────────────────────────────────────────────────────
function RulesTab({ rule, isAdmin, onRefresh }: {
  rule: {title:string;content:string}|null; isAdmin: boolean; onRefresh: ()=>void
}) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(rule?.content ?? '')
  const [title,   setTitle]   = useState(rule?.title ?? '')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => { setContent(rule?.content ?? ''); setTitle(rule?.title ?? '') }, [rule])

  const save = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/eval/record-audit/rules', { title, content })
      setSaved(true); setEditing(false); onRefresh()
      setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <Settings size={15} className="text-orange-500"/> 검수 룰 (Rule Engine 기준)
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            DB에 저장된 기준값. Rule Engine과 Claude 모두 이 룰을 참고합니다.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50">취소</button>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-primary-orange text-white px-3 py-1.5 rounded-xl disabled:opacity-50">
                  {saving ? <Loader2 size={12} className="animate-spin"/> : saved ? <Check size={12}/> : <Save size={12}/>}
                  저장
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
                <Edit3 size={12}/> 수정
              </button>
            )}
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
            placeholder="룰 제목"/>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            rows={20}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-orange/40 resize-none"/>
          <p className="text-xs text-gray-400">{content.length.toLocaleString()}자</p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4">
          {rule ? (
            <>
              <p className="text-xs font-semibold text-gray-500 mb-2">{rule.title}</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">{rule.content}</pre>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">저장된 룰이 없습니다. {isAdmin ? '수정 버튼으로 입력하세요.' : ''}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── 검수 결과 뷰 ──────────────────────────────────────────────────────────────
function AuditResultView({ record }: { record: AuditRecord }) {
  const r = record.result
  const [showAll, setShowAll] = useState(false)
  const criticalIssues = r.issues.filter(i => i.severity === 'critical')
  const highIssues     = r.issues.filter(i => i.severity === 'high')
  const mediumIssues   = r.issues.filter(i => i.severity === 'medium')
  const lowIssues      = r.issues.filter(i => i.severity === 'low')
  const otherIssues    = [...mediumIssues, ...lowIssues]
  const visibleOther   = showAll ? otherIssues : otherIssues.slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 text-center">
            <div className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-bold ${GRADE_CLS[r.overall_grade] ?? ''}`}>
              <span className="text-xs font-normal opacity-70">점수</span>
              <span className="text-xl leading-tight">{r.score ?? '—'}</span>
            </div>
            <p className="text-[10px] font-bold mt-1 text-gray-500">{r.overall_grade}</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-bold text-gray-900 text-sm">{record.filename}</p>
              <span className="text-xs text-gray-400">· {(r.total_rows ?? 0).toLocaleString()}행 · {r.issues.length}건 지적</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{r.summary}</p>
            <p className="text-xs text-gray-400 mt-2">검수: {record.auditor} · {new Date(record.created_at).toLocaleString('ko-KR')}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-50">
          {[
            { label:'즉시조치', count: criticalIssues.length, cls:'bg-purple-50 text-purple-700' },
            { label:'중요',     count: highIssues.length,     cls:'bg-red-50 text-red-600' },
            { label:'보통',     count: mediumIssues.length,   cls:'bg-orange-50 text-orange-600' },
            { label:'경미',     count: lowIssues.length,      cls:'bg-gray-50 text-gray-500' },
          ].map(s => (
            <div key={s.label} className={`text-center rounded-xl py-2.5 ${s.cls}`}>
              <p className="text-lg font-bold">{s.count}</p>
              <p className="text-[11px]">{s.label}</p>
            </div>
          ))}
        </div>

        {r.strengths.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1">
              <CheckCircle2 size={12}/> 잘 기록된 점
            </p>
            <ul className="space-y-1">
              {r.strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">•</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* llm_summary — admin_comment, priority_actions, recording_tips */}
        {r.llm_summary?.admin_comment && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1">
              <Sparkles size={12}/> AI 분석
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">{r.llm_summary.admin_comment}</p>
          </div>
        )}
        {r.llm_summary?.priority_actions && r.llm_summary.priority_actions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-red-600 mb-1.5">⚡ 우선 조치</p>
            <ul className="space-y-1">
              {r.llm_summary.priority_actions.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-red-400 flex-shrink-0 mt-0.5">{i+1}.</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.llm_summary?.recording_tips && r.llm_summary.recording_tips.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-green-600 mb-1.5 flex items-center gap-1">
              <Sparkles size={12}/> 기록 개선 팁
            </p>
            <ul className="space-y-1">
              {r.llm_summary.recording_tips.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5">•</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.issue_total_count && r.issue_total_count > (r.issues?.length ?? 0) && (
          <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-xs text-yellow-700">
            ⚠️ 전체 이슈 {r.issue_total_count.toLocaleString()}건 중 상위 {r.issues?.length}건만 표시됩니다.
          </div>
        )}
      </div>

      {r.issues.length === 0 && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
          <CheckCircle2 size={36} className="mx-auto mb-2 text-green-500"/>
          <p className="font-semibold text-green-700 text-lg">Rule Engine 이슈 없음</p>
          <p className="text-sm text-green-600 mt-1">모든 검수 기준을 통과했습니다</p>
        </div>
      )}

      {criticalIssues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-purple-700 flex items-center gap-1 px-1">🚨 즉시 조치 — 허위기록 의심 ({criticalIssues.length}건)</p>
          {criticalIssues.map((issue, i) => <IssueCard key={i} issue={issue}/>)}
        </div>
      )}
      {highIssues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-red-600 flex items-center gap-1 px-1"><AlertTriangle size={12}/> 즉시 수정 필요 ({highIssues.length}건)</p>
          {highIssues.map((issue, i) => <IssueCard key={i} issue={issue}/>)}
        </div>
      )}
      {otherIssues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 px-1">기타 검수 사항 ({otherIssues.length}건)</p>
          {visibleOther.map((issue, i) => <IssueCard key={i} issue={issue}/>)}
          {otherIssues.length > 3 && (
            <button onClick={() => setShowAll(v => !v)}
              className="w-full text-xs font-medium text-gray-500 hover:text-gray-700 py-2 flex items-center justify-center gap-1 border border-gray-100 rounded-xl hover:bg-gray-50">
              {showAll ? <><ChevronUp size={13}/> 접기</> : <><ChevronDown size={13}/> {otherIssues.length-3}건 더보기</>}
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
      <button type="button" className="w-full flex items-center gap-2.5 p-3.5 text-left" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${SEV[issue.severity]}`}>{SEV_LABEL[issue.severity]}</span>
            <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded-full font-semibold">{issue.type}</span>
            {issue.location && <span className="text-[10px] opacity-70">{issue.location}</span>}
          </div>
          <p className="text-sm font-semibold leading-snug">{issue.description}</p>
        </div>
        {open ? <ChevronUp size={14} className="flex-shrink-0 opacity-50"/> : <ChevronDown size={14} className="flex-shrink-0 opacity-50"/>}
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
function ScheduleTab({ schedules, isAdmin, onRefresh, onMsg }: {
  schedules: WorkSchedule[]; isAdmin: boolean
  onRefresh: () => void; onMsg: (msg: string, warns?: string[]) => void
}) {
  const [year,  setYear]  = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const SHIFT_CLS: Record<string, string> = {
    '주간': 'bg-blue-100 text-blue-700',
    '야간': 'bg-indigo-100 text-indigo-700',
    '이브닝': 'bg-purple-100 text-purple-700',
    '휴무': 'bg-gray-100 text-gray-400',
    '연차': 'bg-yellow-100 text-yellow-600',
    '대휴': 'bg-orange-100 text-orange-600',
  }

  const upload = async (file: File) => {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('year',  String(year))
    form.append('month', String(month))
    try {
      const res = await apiClient.post('/api/v1/eval/carefor/work-schedules/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const d = (res.data as any)?.data
      const normTag = d?.normalizer === 'openai' ? ' [AI 정규화]' : ' [기본 정규화]'
      const warnTag = d?.warnings?.length ? ` ⚠️ 경고 ${d.warnings.length}건` : ''
      onMsg(
        `✅ 근무표 업로드${normTag} — 신규 ${d?.imported ?? 0}건, 수정 ${d?.updated ?? 0}건${warnTag}`,
        d?.warnings ?? []
      )
      onRefresh()
    } catch (e: any) {
      onMsg(`❌ ${e?.response?.data?.detail ?? '업로드 실패'}`)
    } finally { setUploading(false) }
  }

  // 필터링된 근무표 (연/월 기준)
  const prefix  = `${year}-${String(month).padStart(2,'0')}-`
  const filtered = schedules.filter(s => s.work_date.startsWith(prefix))

  // 직원별 그룹
  const byStaff: Record<string, WorkSchedule[]> = {}
  filtered.forEach(s => {
    if (!byStaff[s.staff_name]) byStaff[s.staff_name] = []
    byStaff[s.staff_name].push(s)
  })

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <Clock size={15} className="text-teal-500"/> 근무표 업로드
            </p>
            <p className="text-xs text-gray-400 mt-0.5">근무표 엑셀 업로드 — 행=직원·열=날짜 또는 행=날짜별 기록 두 형태 모두 지원</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {schedules.length > 0 && (
                <button onClick={async () => { await apiClient.delete(`/api/v1/eval/carefor/work-schedules?year=${year}&month=${month}`); onRefresh(); onMsg('✅ 해당 월 근무표 삭제됨') }}
                  className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50">
                  <Trash2 size={13} className="text-red-400"/>
                </button>
              )}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-xl disabled:opacity-50">
                {uploading ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}
                {uploading ? '업로드 중...' : '엑셀 업로드'}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}/>
            </div>
          )}
        </div>

        {/* 연/월 선택 */}
        <div className="flex items-center gap-2 mb-4">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-2 py-1.5 text-sm focus:outline-none">
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-2 py-1.5 text-sm focus:outline-none">
            {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          <span className="text-xs text-gray-400">{filtered.length}건 표시 중</span>
        </div>

        <p className="text-[11px] text-gray-400 mb-4">
          권장 형태 A: 첫 열=직원명, 이후 열=1일~31일, 셀=D/N/E/휴/연차<br/>
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
                  <th className="text-left py-2 px-2 font-semibold text-gray-500 sticky left-0 bg-white">직원명</th>
                  {days.map(d => (
                    <th key={d} className="text-center py-2 px-1 font-semibold text-gray-400 min-w-[28px]">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(byStaff).map(([name, recs]) => {
                  const byDay: Record<string, WorkSchedule> = {}
                  recs.forEach(r => {
                    const day = parseInt(r.work_date.slice(8))
                    byDay[day] = r
                  })
                  return (
                    <tr key={name} className="hover:bg-gray-50/50">
                      <td className="py-1.5 px-2 font-semibold text-gray-700 sticky left-0 bg-white whitespace-nowrap">{name}</td>
                      {days.map(d => {
                        const sc = byDay[d]
                        if (!sc) return <td key={d} className="py-1.5 px-1 text-center text-gray-200">·</td>
                        const lbl = sc.shift_label || sc.shift_code
                        const cls = SHIFT_CLS[lbl] ?? (sc.is_working ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400')
                        return (
                          <td key={d} className="py-1.5 px-0.5 text-center">
                            <span className={`inline-block text-[9px] font-bold px-1 py-0.5 rounded ${cls}`} title={`${sc.start_time||''}~${sc.end_time||''}`}>
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
      </div>
    </div>
  )
}
