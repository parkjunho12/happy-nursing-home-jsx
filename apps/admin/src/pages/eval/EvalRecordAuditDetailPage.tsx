import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ArrowLeft, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  User, Calendar, Activity, ShieldCheck,
  Clock, Thermometer, Bath,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useAuditStore } from '@/store/auditStore'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface AuditIssue {
  type: string; severity: 'critical'|'high'|'medium'|'low'
  location: string; description: string; suggestion: string
}
interface ResidentResult {
  resident_name: string; birth_date: string; care_grade: string
  resident_status: string; match_status: string
  score: number; grade: string; total_rows: number; bathing_count: number
  issue_summary: { critical: number; high: number; medium: number; low: number }
  issues: AuditIssue[]
}
interface AuditRecord {
  id: string; filename: string; auditor: string; created_at: string
  result: {
    resident_results?: ResidentResult[]
    total_residents_detected?: number
    score: number; grade: string; overall_grade: string
  }
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
const SEV_ORDER: Record<string, number> = { critical:0, high:1, medium:2, low:3 }
const GRADE_CLS: Record<string, string> = {
  '양호(A)':'bg-green-100 text-green-700 border-green-300',
  '양호(B)':'bg-blue-100 text-blue-700 border-blue-300',
  '보통(C)':'bg-orange-100 text-orange-700 border-orange-300',
  '미흡(D)':'bg-red-100 text-red-700 border-red-300',
  '양호':'bg-green-100 text-green-700 border-green-300',
  '보통':'bg-orange-100 text-orange-700 border-orange-300',
  '미흡':'bg-red-100 text-red-700 border-red-300',
}

export default function EvalRecordAuditDetailPage() {
  const { auditId, residentName } = useParams<{ auditId: string; residentName: string }>()
  const navigate = useNavigate()
  const { currentAudit, history } = useAuditStore()
  const [audit,    setAudit]    = useState<AuditRecord | null>(null)
  const [resident, setResident] = useState<ResidentResult | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'all'|'critical'|'high'|'medium'|'low'>('all')

  useEffect(() => {
    const load = async () => {
      const decodedName = decodeURIComponent(residentName || '')

      // 1. store에서 먼저 찾기 (페이지 이동 후 복귀 시 즉시 표시)
      const storeAudit =
        currentAudit?.id === auditId ? currentAudit :
        history.find(h => h.id === auditId) ?? null

      if (storeAudit) {
        setAudit(storeAudit)
        const found = storeAudit.result?.resident_results?.find(
          (r: ResidentResult) => r.resident_name === decodedName
        )
        setResident(found || null)
        setLoading(false)
        return
      }

      // 2. store에 없으면 API 조회
      try {
        const res = await apiClient.get(`/api/v1/eval/record-audit/history/${auditId}`)
        const data = (res.data as any)?.data as AuditRecord
        setAudit(data)
        const found = data?.result?.resident_results?.find(
          (r: ResidentResult) => r.resident_name === decodedName
        )
        setResident(found || null)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [auditId, residentName, currentAudit])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-orange"/>
      </div>
    )
  }

  if (!resident) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16}/> 돌아가기
        </button>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center text-red-600">
          수급자 검수 결과를 찾을 수 없습니다.
        </div>
      </div>
    )
  }

  const filteredIssues = resident.issues.filter(
    i => filter === 'all' || i.severity === filter
  ).sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])

  const issuesByType: Record<string, AuditIssue[]> = {}
  filteredIssues.forEach(i => {
    if (!issuesByType[i.type]) issuesByType[i.type] = []
    issuesByType[i.type].push(i)
  })

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500">
          <ArrowLeft size={16}/>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <User size={18} className="text-blue-500"/>
            {resident.resident_name} 어르신 검수 결과
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {audit?.filename} · 검수: {audit?.auditor} · {new Date(audit?.created_at || '').toLocaleString('ko-KR')}
          </p>
        </div>
      </div>

      {/* 수급자 기본 정보 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start gap-4">
          {/* 점수 뱃지 */}
          <div className="flex-shrink-0 text-center">
            <div className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center ${GRADE_CLS[resident.grade] ?? ''}`}>
              <span className="text-xs font-normal opacity-60">점수</span>
              <span className="text-2xl font-bold leading-tight">{resident.score}</span>
            </div>
            <p className="text-[11px] font-bold mt-1.5 text-gray-500">{resident.grade}</p>
          </div>

          {/* 수급자 정보 */}
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={13} className="text-gray-400"/>
                <span className="text-gray-400">생년월일</span>
                <span className="font-semibold">{resident.birth_date || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <ShieldCheck size={13} className="text-gray-400"/>
                <span className="text-gray-400">장기요양등급</span>
                <span className="font-semibold">{resident.care_grade || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Activity size={13} className="text-gray-400"/>
                <span className="text-gray-400">수급자 상태</span>
                <span className="font-semibold">{resident.resident_status || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={13} className="text-gray-400"/>
                <span className="text-gray-400">검수 일수</span>
                <span className="font-semibold">{resident.total_rows}일</span>
              </div>
            </div>

            {/* DB 매칭 상태 */}
            <div className="mt-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                resident.match_status === 'matched'   ? 'bg-green-100 text-green-700' :
                resident.match_status === 'unmatched' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {resident.match_status === 'matched'   ? '✅ DB 매칭됨' :
                 resident.match_status === 'unmatched' ? '❌ DB 미매칭' : '⚠️ 동명이인'}
              </span>
            </div>
          </div>
        </div>

        {/* 이슈 통계 */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-50">
          {[
            { label:'즉시조치', count: resident.issue_summary.critical, cls:'bg-purple-50 text-purple-700', sev:'critical' },
            { label:'중요',     count: resident.issue_summary.high,     cls:'bg-red-50 text-red-600',     sev:'high' },
            { label:'보통',     count: resident.issue_summary.medium,   cls:'bg-orange-50 text-orange-600', sev:'medium' },
            { label:'경미',     count: resident.issue_summary.low,      cls:'bg-gray-50 text-gray-500',   sev:'low' },
          ].map(s => (
            <button key={s.label}
              onClick={() => setFilter(filter === s.sev as any ? 'all' : s.sev as any)}
              className={`text-center rounded-xl py-3 transition-all ${s.cls} ${filter === s.sev ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80'}`}>
              <p className="text-xl font-bold">{s.count}</p>
              <p className="text-[11px]">{s.label}</p>
            </button>
          ))}
        </div>

        {/* 특이 지표 */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <Bath size={14} className={resident.bathing_count >= 5 ? 'text-green-500' : 'text-red-500'}/>
            <span className="text-xs text-gray-500">이달 목욕</span>
            <span className={`text-sm font-bold ${resident.bathing_count >= 5 ? 'text-green-600' : 'text-red-600'}`}>
              {resident.bathing_count}회 {resident.bathing_count >= 5 ? '✓' : '(기준 미달)'}
            </span>
          </div>
        </div>
      </div>

      {/* 이슈 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-800 text-sm">
            검수 이슈 {filteredIssues.length}건
            {filter !== 'all' && <span className="ml-2 text-xs text-gray-400">(필터: {SEV_LABEL[filter]})</span>}
          </p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-xs text-gray-400 hover:text-gray-600">
              전체 보기
            </button>
          )}
        </div>

        {filteredIssues.length === 0 ? (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
            <CheckCircle2 size={36} className="mx-auto mb-2 text-green-500"/>
            <p className="font-semibold text-green-700">해당 심각도의 이슈가 없습니다</p>
          </div>
        ) : (
          // 타입별 그룹화 표시
          Object.entries(issuesByType).map(([type, issues]) => (
            <IssueGroup key={type} type={type} issues={issues}/>
          ))
        )}
      </div>
    </div>
  )
}

// ── 이슈 그룹 컴포넌트 ───────────────────────────────────────────────────────
function IssueGroup({ type, issues }: { type: string; issues: AuditIssue[] }) {
  const [open, setOpen] = useState(true)
  const topSev = issues.reduce((best, i) =>
    SEV_ORDER[i.severity] < SEV_ORDER[best] ? i.severity : best
  , issues[0].severity)

  const TYPE_ICON: Record<string, React.ReactNode> = {
    '혈압체온미기재':  <Thermometer size={14}/>,
    '작성자누락':      <User size={14}/>,
    '목욕횟수부족':    <Bath size={14}/>,
    '휴무자제공기록':  <AlertTriangle size={14}/>,
    '외박외출중제공기록': <Calendar size={14}/>,
    '와상이동도움이상': <Activity size={14}/>,
    '기저귀기록누락':  <ShieldCheck size={14}/>,
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${SEV[topSev] ?? SEV.low}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${SEV[topSev]}`}>
          {SEV_LABEL[topSev]}
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-sm flex-1">
          {TYPE_ICON[type] || <AlertTriangle size={14}/>}
          {type}
        </span>
        <span className="text-xs font-bold opacity-60">{issues.length}건</span>
        {open ? <ChevronUp size={14} className="flex-shrink-0 opacity-40"/> : <ChevronDown size={14} className="flex-shrink-0 opacity-40"/>}
      </button>

      {open && (
        <div className="border-t border-current/10">
          {issues.map((issue, i) => (
            <div key={i} className={`px-4 py-3 ${i > 0 ? 'border-t border-current/10' : ''}`}>
              <p className="text-xs font-semibold opacity-60 mb-1">{issue.location}</p>
              <p className="text-sm font-semibold leading-snug">{issue.description}</p>
              {issue.suggestion && (
                <div className="mt-2 bg-white/50 rounded-xl px-3 py-2">
                  <p className="text-[11px] font-semibold opacity-50 mb-0.5">개선 방안</p>
                  <p className="text-xs leading-relaxed">{issue.suggestion}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
