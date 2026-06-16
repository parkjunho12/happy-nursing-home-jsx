import { useState, useCallback, useMemo } from 'react'
import {
  Upload, Sparkles, Download, Filter, X,
  AlertTriangle, CheckCircle2, Info, Loader2,
  FileSpreadsheet, RefreshCw, ChevronDown,
} from 'lucide-react'
import { apiClient } from '@/api/client'

// ── 타입 ──────────────────────────────────────────────────────────────────────
type Severity = 'high' | 'medium' | 'low'
type IssueStatus = '미확인' | '확인완료' | '수정완료'

interface AuditIssue {
  resident_name: string
  date: string
  category: string
  severity: Severity
  message: string
  suggestion: string
  original_value: string
  row: number
  status?: IssueStatus
}

interface AuditResult {
  total_rows: number
  issue_count: number
  issues: AuditIssue[]
  summary: string
  provider: string
  model: string
  warning: string
  file_name: string
  disclaimer: string
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const SEV: Record<Severity, { label: string; bg: string; text: string; border: string; dot: string }> = {
  high:   { label: '높음', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  medium: { label: '중간', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-400' },
  low:    { label: '낮음', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
}
const STATUS_CLS: Record<IssueStatus, string> = {
  '미확인':  'bg-gray-100 text-gray-600',
  '확인완료': 'bg-blue-100 text-blue-700',
  '수정완료': 'bg-green-100 text-green-700',
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function EvalRecordAuditPage() {
  const [file,      setFile]      = useState<File | null>(null)
  const [result,    setResult]    = useState<AuditResult | null>(null)
  const [issues,    setIssues]    = useState<AuditIssue[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [selected,  setSelected]  = useState<AuditIssue | null>(null)

  // 필터
  const [filterSev,      setFilterSev]      = useState<Severity | 'all'>('all')
  const [filterResident, setFilterResident] = useState('all')
  const [filterStatus,   setFilterStatus]   = useState<IssueStatus | 'all'>('all')
  const [searchText,     setSearchText]     = useState('')

  const handleFile = useCallback((f: File) => {
    if (!f.name.match(/\.(xls|xlsx)$/i)) {
      setError('xlsx 또는 xls 파일만 업로드 가능합니다.')
      return
    }
    setFile(f)
    setResult(null)
    setIssues([])
    setError('')
    setSelected(null)
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const runAudit = async () => {
    if (!file) return
    setLoading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiClient.post('/api/v1/admin/eval-record-audit/upload', form, {
        headers: { 'Content-Type': undefined as any },
        timeout: 120_000,   // AI 응답 최대 2분
      })
      const data: AuditResult = res.data.data
      setResult(data)
      setIssues(data.issues.map(i => ({ ...i, status: '미확인' as IssueStatus })))
      // 필터 초기화
      setFilterSev('all'); setFilterResident('all'); setFilterStatus('all'); setSearchText('')
      setSelected(null)
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? '검수 중 오류가 발생했습니다'
      setError(msg)
    } finally { setLoading(false) }
  }

  const changeStatus = (idx: number, status: IssueStatus) => {
    setIssues(prev => prev.map((is, i) => i === idx ? { ...is, status } : is))
    if (selected) setSelected(s => s ? { ...s, status } : null)
  }

  // 고유 어르신 목록
  const residents = useMemo(() =>
    [...new Set(issues.map(i => i.resident_name).filter(Boolean))].sort()
  , [issues])

  // 필터된 이슈
  const filtered = useMemo(() => issues.filter(issue => {
    if (filterSev !== 'all' && issue.severity !== filterSev) return false
    if (filterResident !== 'all' && issue.resident_name !== filterResident) return false
    if (filterStatus !== 'all' && issue.status !== filterStatus) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      if (!issue.message.toLowerCase().includes(q) &&
          !issue.category.toLowerCase().includes(q) &&
          !issue.resident_name.toLowerCase().includes(q)) return false
    }
    return true
  }), [issues, filterSev, filterResident, filterStatus, searchText])

  // CSV 다운로드
  const downloadCSV = () => {
    if (!issues.length) return
    const header = '어르신명,날짜,카테고리,심각도,메시지,수정제안,원본값,행,상태\n'
    const rows = issues.map(i =>
      [i.resident_name, i.date, i.category, SEV[i.severity]?.label ?? i.severity,
       `"${i.message}"`, `"${i.suggestion}"`, `"${i.original_value}"`, i.row, i.status].join(',')
    ).join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `검수결과_${result?.file_name?.replace(/\.[^.]+$/, '') ?? '제공기록지'}.csv`
    a.click(); URL.revokeObjectURL(a.href)
  }

  const counts = useMemo(() => ({
    high:   issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low:    issues.filter(i => i.severity === 'low').length,
    done:   issues.filter(i => i.status === '수정완료').length,
  }), [issues])

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">제공기록지 AI 검수</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            엑셀 파일 업로드 → AI가 오류를 찾아드립니다
          </p>
        </div>
        {result && (
          <div className="flex gap-2">
            <button onClick={downloadCSV}
              className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
              <Download size={14}/> CSV 저장
            </button>
            <button onClick={() => { setFile(null); setResult(null); setIssues([]) }}
              className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
              <RefreshCw size={14}/> 초기화
            </button>
          </div>
        )}
      </div>

      {/* 업로드 & 실행 */}
      {!result && (
        <div
          onDragOver={e => e.preventDefault()} onDrop={onDrop}
          onClick={() => !file && document.getElementById('record-upload')?.click()}
          className={`border-2 border-dashed rounded-2xl transition-all ${
            file
              ? 'border-primary-orange bg-orange-50/30 cursor-default'
              : 'border-gray-200 bg-gray-50 hover:border-primary-orange hover:bg-orange-50/20 cursor-pointer'
          } p-10 flex flex-col items-center justify-center text-center min-h-[260px]`}>
          <input id="record-upload" type="file" accept=".xls,.xlsx" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>

          {file ? (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <FileSpreadsheet size={26} className="text-green-600"/>
              </div>
              <div>
                <p className="font-bold text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <button onClick={e => { e.stopPropagation(); runAudit() }}
                  disabled={loading}
                  className="flex items-center gap-2 bg-primary-orange text-white font-bold px-6 py-2.5 rounded-xl hover:bg-primary-orange/90 disabled:opacity-60 shadow-lg shadow-orange-200">
                  {loading
                    ? <><Loader2 size={16} className="animate-spin"/> AI 검수 중...</>
                    : <><Sparkles size={16}/> AI 검수 시작</>}
                </button>
                <button onClick={e => { e.stopPropagation(); setFile(null) }}
                  className="text-sm text-gray-500 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50">
                  다른 파일
                </button>
              </div>
              {loading && (
                <p className="text-xs text-gray-400">
                  AI가 제공기록지를 분석 중입니다. 최대 1~2분 소요됩니다...
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
                <Upload size={26} className="text-primary-orange"/>
              </div>
              <p className="font-bold text-gray-800">제공기록지 엑셀을 업로드하세요</p>
              <p className="text-sm text-gray-400">.xls, .xlsx 지원 · 드래그 또는 클릭 · 최대 10MB</p>
            </div>
          )}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15}/>
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13}/></button>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 경고 / 면책 안내 */}
          {result.warning && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              <AlertTriangle size={14}/> {result.warning}
            </div>
          )}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            <Info size={13} className="flex-shrink-0"/>
            {result.disclaimer}
          </div>

          {/* AI 요약 */}
          {result.summary && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl px-5 py-4">
              <p className="text-xs font-bold text-purple-600 mb-1 flex items-center gap-1">
                <Sparkles size={12}/> AI 종합 의견 ({result.provider} / {result.model})
              </p>
              <p className="text-sm text-gray-800 leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="총 검수 행수" value={`${result.total_rows}행`} color="gray"/>
            <SummaryCard label="높음" value={`${counts.high}건`} color="red"/>
            <SummaryCard label="중간" value={`${counts.medium}건`} color="orange"/>
            <SummaryCard label="수정완료" value={`${counts.done}건`} color="green"/>
          </div>

          {/* 필터 & 검색 */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm flex gap-2 flex-wrap items-center">
            <Filter size={13} className="text-gray-400 flex-shrink-0"/>

            <select value={filterSev} onChange={e => setFilterSev(e.target.value as any)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-orange bg-white">
              <option value="all">전체 심각도</option>
              <option value="high">높음</option>
              <option value="medium">중간</option>
              <option value="low">낮음</option>
            </select>

            {residents.length > 0 && (
              <select value={filterResident} onChange={e => setFilterResident(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-orange bg-white max-w-[140px]">
                <option value="all">전체 어르신</option>
                {residents.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-orange bg-white">
              <option value="all">전체 상태</option>
              <option value="미확인">미확인</option>
              <option value="확인완료">확인완료</option>
              <option value="수정완료">수정완료</option>
            </select>

            <div className="relative flex-1 min-w-[160px]">
              <input value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="메시지, 어르신명 검색..."
                className="w-full text-xs border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-orange"/>
              {searchText && (
                <button onClick={() => setSearchText('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                  <X size={11}/>
                </button>
              )}
            </div>

            <span className="ml-auto text-xs text-gray-400">{filtered.length}건</span>
          </div>

          {/* 이슈 목록 + 상세 패널 */}
          <div className="flex gap-4" style={{ minHeight: '400px' }}>
            {/* 목록 */}
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[600px] pr-0.5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
                  <CheckCircle2 size={32} className="mb-2 text-green-400 opacity-60"/>
                  <p className="text-sm text-gray-500">해당 조건의 이슈가 없습니다</p>
                </div>
              ) : filtered.map((issue, i) => {
                const sev = SEV[issue.severity] ?? SEV.low
                return (
                  <div key={i} onClick={() => setSelected(issue)}
                    className={`bg-white rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md ${
                      selected === issue
                        ? 'ring-2 ring-primary-orange border-transparent'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    <div className="flex items-start gap-3 p-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${sev.dot}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>
                            {sev.label}
                          </span>
                          <span className="text-[10px] text-gray-500">{issue.category}</span>
                          {issue.resident_name && (
                            <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full font-medium">
                              {issue.resident_name}
                            </span>
                          )}
                          {issue.date && <span className="text-[10px] text-gray-400">{issue.date}</span>}
                          {issue.row > 0 && <span className="text-[10px] text-gray-400">{issue.row}행</span>}
                        </div>
                        <p className="text-sm text-gray-800 leading-snug">{issue.message}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_CLS[issue.status ?? '미확인']}`}>
                        {issue.status ?? '미확인'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 상세 패널 */}
            <div className="w-72 flex-shrink-0">
              {selected ? (
                <DetailPanel
                  issue={selected}
                  onStatusChange={status => {
                    const idx = issues.indexOf(selected)
                    if (idx >= 0) changeStatus(idx, status)
                  }}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 h-full flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                  <ChevronDown size={24} className="mb-2 opacity-30"/>
                  <p className="text-sm">이슈를 선택하면<br/>상세 내용이 표시됩니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 재검수 */}
          <div className="flex justify-center pt-2">
            <button onClick={() => { setResult(null); setIssues([]) }}
              className="flex items-center gap-2 text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50">
              <RefreshCw size={13}/> 다른 파일 검수
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 요약 카드 ──────────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color }: { label:string; value:string; color:string }) {
  const bg = { red:'bg-red-50', orange:'bg-orange-50', green:'bg-green-50', gray:'bg-gray-50' }[color] ?? 'bg-gray-50'
  const tc = { red:'text-red-700', orange:'text-orange-700', green:'text-green-700', gray:'text-gray-700' }[color] ?? 'text-gray-700'
  return (
    <div className={`${bg} rounded-xl p-4 border border-white shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${tc}`}>{value}</p>
    </div>
  )
}

// ── 상세 패널 ──────────────────────────────────────────────────────────────────
function DetailPanel({ issue, onStatusChange }: {
  issue: AuditIssue & { status?: IssueStatus }
  onStatusChange: (s: IssueStatus) => void
}) {
  const sev = SEV[issue.severity] ?? SEV.low
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-y-auto max-h-[600px]">
      <div className="p-4 border-b border-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>
            {sev.label}
          </span>
          <span className="text-xs text-gray-500">{issue.category}</span>
        </div>
        <p className="text-sm font-semibold text-gray-800 leading-snug">{issue.message}</p>
      </div>
      <div className="p-4 space-y-4">
        {(issue.resident_name || issue.date) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">📍 대상</p>
            <p className="text-xs text-gray-700">
              {issue.resident_name && <span className="font-medium">{issue.resident_name}</span>}
              {issue.date && <span className="ml-2 text-gray-500">{issue.date}</span>}
              {issue.row > 0 && <span className="ml-2 text-gray-400">{issue.row}행</span>}
            </p>
          </div>
        )}
        {issue.original_value && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">📄 원본 값</p>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all">
              {issue.original_value || <span className="text-gray-400 italic">비어 있음</span>}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">💡 수정 제안</p>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-800 leading-relaxed">
            {issue.suggestion}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">🔄 상태</p>
          <div className="flex flex-col gap-1.5">
            {(['미확인', '확인완료', '수정완료'] as IssueStatus[]).map(s => (
              <button key={s} onClick={() => onStatusChange(s)}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
                  (issue.status ?? '미확인') === s
                    ? 'bg-primary-orange text-white shadow-sm'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
