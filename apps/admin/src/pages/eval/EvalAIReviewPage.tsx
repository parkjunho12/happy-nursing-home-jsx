import { useState, useEffect, useRef } from 'react'
import {
  Upload, FileText, Trash2, Sparkles, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Plus, Loader2,
} from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { evalGuidelineAPI, evalAIReviewAPI } from '@/api/evalClient'
import { RISK_COLORS, RISK_LABELS, FREQUENCY_LABELS } from '@/utils/period'

interface Guideline {
  id: string
  title: string
  filename?: string
  char_count: number
  created_at: string
}

interface ChecklistFinding {
  checklist_id?: string
  title: string
  issue: string
  severity: string
  recommendation: string
}

interface MissingItem {
  indicator_name: string
  description: string
  suggested_title: string
  suggested_frequency: string
  severity: string
}

interface ReviewResult {
  overall_score: number
  summary: string
  strengths: string[]
  findings: ChecklistFinding[]
  missing_items: MissingItem[]
  compliance_notes: string[]
}

interface ReviewRecord {
  id: number
  guideline_id?: string
  guideline_title?: string
  domain_id?: string
  overall_score: number
  summary: string
  model?: string
  created_at: string
  result: ReviewResult
}

interface ReviewHistoryItem {
  id: number
  guideline_title?: string
  domain_id?: string
  overall_score: number
  summary: string
  created_at: string
}

export default function EvalAIReviewPage() {
  const { domains, checklists, addChecklist, loaded, loadAll } = useLtcStore()
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [history, setHistory] = useState<ReviewHistoryItem[]>([])
  const [selectedGuideline, setSelectedGuideline] = useState<string>('')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [loadingGuidelines, setLoadingGuidelines] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [result, setResult] = useState<ReviewRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPasteForm, setShowPasteForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { refreshGuidelines(); refreshHistory() }, [])

  const refreshGuidelines = async () => {
    setLoadingGuidelines(true)
    try {
      const data = await evalGuidelineAPI.list()
      setGuidelines(data)
      if (data.length && !selectedGuideline) setSelectedGuideline(data[0].id)
    } catch (e) { console.error(e) }
    finally { setLoadingGuidelines(false) }
  }

  const refreshHistory = async () => {
    try { setHistory(await evalAIReviewAPI.history()) } catch (e) { console.error(e) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const g = await evalGuidelineAPI.upload(file)
      await refreshGuidelines()
      setSelectedGuideline(g.id)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteGuideline = async (id: string) => {
    if (!confirm('이 가이드라인 문서를 삭제하시겠습니까?')) return
    await evalGuidelineAPI.delete(id)
    await refreshGuidelines()
    if (selectedGuideline === id) setSelectedGuideline('')
  }

  const handleRunReview = async () => {
    if (!selectedGuideline) return
    setReviewing(true)
    setError(null)
    setResult(null)
    try {
      const data = await evalAIReviewAPI.run({
        guideline_id: selectedGuideline,
        domain_id: selectedDomain === 'all' ? undefined : selectedDomain,
      })
      setResult(data)
      refreshHistory()
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'AI 검토 중 오류가 발생했습니다.')
    } finally {
      setReviewing(false)
    }
  }

  const handleLoadHistory = async (id: number) => {
    setError(null)
    try {
      const data = await evalAIReviewAPI.get(id)
      setResult(data)
    } catch (e) { console.error(e) }
  }

  if (!loaded) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-orange border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 체크리스트 검토</h1>
        <p className="text-sm text-gray-500 mt-0.5">평가 가이드라인(.md)을 등록하고, 현재 체크리스트 체계를 AI로 분석합니다</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5"/>
          <span>{error}</span>
        </div>
      )}

      {/* 가이드라인 관리 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><FileText size={15}/>평가 가이드라인 문서</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPasteForm(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
            >
              <Plus size={13}/>텍스트 붙여넣기
            </button>
            <label className="flex items-center gap-1.5 text-xs font-medium text-white bg-primary-orange rounded-lg px-3 py-1.5 hover:bg-primary-orange/90 cursor-pointer">
              {uploading ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>}
              .md 업로드
              <input ref={fileInputRef} type="file" accept=".md,.markdown,.txt" onChange={handleFileUpload} disabled={uploading} className="hidden"/>
            </label>
          </div>
        </div>

        {showPasteForm && <PasteGuidelineForm onDone={async () => { setShowPasteForm(false); await refreshGuidelines() }} />}

        {loadingGuidelines ? (
          <p className="text-sm text-gray-400 py-4 text-center">불러오는 중...</p>
        ) : guidelines.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            등록된 가이드라인 문서가 없습니다. 평가 매뉴얼 .md 파일을 업로드해주세요.
          </p>
        ) : (
          <div className="space-y-1.5">
            {guidelines.map(g => (
              <label key={g.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedGuideline === g.id ? 'bg-orange-50 border-primary-orange' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                }`}>
                <input type="radio" name="guideline" checked={selectedGuideline === g.id}
                  onChange={() => setSelectedGuideline(g.id)} className="accent-primary-orange"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{g.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.filename && `${g.filename} · `}{g.char_count.toLocaleString()}자 · {new Date(g.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <button onClick={(e) => { e.preventDefault(); handleDeleteGuideline(g.id) }}
                  className="text-gray-300 hover:text-red-500 flex-shrink-0">
                  <Trash2 size={14}/>
                </button>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 검토 실행 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Sparkles size={15}/>AI 검토 실행</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">검토 범위</label>
            <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-orange/40">
              <option value="all">전체 체크리스트</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <button
            onClick={handleRunReview}
            disabled={!selectedGuideline || reviewing || checklists.length === 0}
            className="flex items-center gap-2 bg-primary-orange text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50 disabled:cursor-not-allowed">
            {reviewing ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>}
            {reviewing ? 'AI 검토 중... (최대 1분)' : 'AI 검토 시작'}
          </button>
        </div>
        {!selectedGuideline && <p className="text-xs text-gray-400">먼저 검토할 가이드라인 문서를 선택하세요.</p>}
      </div>

      {/* 검토 결과 */}
      {result && <ReviewResultView result={result} onAddChecklist={addChecklist} domains={domains} />}

      {/* 검토 이력 */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3"><Clock size={15}/>검토 이력</h2>
          <div className="space-y-1.5">
            {history.map(h => (
              <button key={h.id} onClick={() => handleLoadHistory(h.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  result?.id === h.id ? 'bg-orange-50 border-primary-orange' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                }`}>
                <ScoreBadge score={h.overall_score} size="sm"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{h.guideline_title ?? '가이드라인'}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{h.summary}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{new Date(h.created_at).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// 결과 표시
// ════════════════════════════════════════════════════════════════

function ReviewResultView({ result, onAddChecklist, domains }: {
  result: ReviewRecord
  onAddChecklist: (item: any) => Promise<any>
  domains: { id: string; name: string }[]
}) {
  const r = result.result
  const [showAllFindings, setShowAllFindings] = useState(false)
  const [showAllMissing, setShowAllMissing] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  const [addingIdx, setAddingIdx] = useState<number | null>(null)

  const findings = showAllFindings ? r.findings : r.findings.slice(0, 5)
  const missing  = showAllMissing  ? r.missing_items : r.missing_items.slice(0, 5)

  const handleAddMissing = async (item: MissingItem, idx: number) => {
    setAddingIdx(idx)
    try {
      await onAddChecklist({
        title: item.suggested_title,
        description: `[AI 검토 제안] ${item.description}`,
        frequency: (['daily','weekly','monthly','quarterly','half-yearly','yearly'].includes(item.suggested_frequency)
          ? item.suggested_frequency : 'monthly') as any,
        relatedIndicatorId: '',
        relatedCategoryId: '',
        relatedDomainId: result.domain_id ?? '',
        assignee: '',
        evidenceRequired: '',
        storageLocation: '',
        howTo: '',
        evalNote: item.description,
        riskLevel: (item.severity as any) ?? 'medium',
        active: true,
        memo: `AI 검토(${new Date(result.created_at).toLocaleDateString('ko-KR')}) 결과 기반 자동 추가 — 관련 지표: ${item.indicator_name}`,
        attachmentName: '',
        personType: 'facility',
      })
      setAddedIds(prev => new Set(prev).add(idx))
    } catch (e) {
      console.error(e)
      alert('체크리스트 추가에 실패했습니다.')
    } finally {
      setAddingIdx(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* 종합 점수 & 요약 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <ScoreBadge score={r.overall_score} size="lg"/>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-gray-800">검토 결과</h3>
              {result.guideline_title && <span className="text-xs text-gray-400">· {result.guideline_title}</span>}
              {result.domain_id && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                  {domains.find(d=>d.id===result.domain_id)?.name ?? result.domain_id}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{r.summary}</p>
            {result.model && <p className="text-xs text-gray-300 mt-2">model: {result.model}</p>}
          </div>
        </div>

        {/* 잘 갖춰진 점 */}
        {r.strengths.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1.5"><CheckCircle2 size={13}/>잘 갖춰진 점</p>
            <ul className="space-y-1">
              {r.strengths.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 보완 필요 항목 */}
      {r.findings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-orange-500"/>보완 필요 항목
            <span className="text-xs font-normal text-gray-400">({r.findings.length}건)</span>
          </h3>
          <div className="space-y-2">
            {findings.map((f, i) => (
              <div key={i} className={`rounded-xl border p-3.5 ${
                f.severity === 'high' ? 'bg-red-50 border-red-100' :
                f.severity === 'low'  ? 'bg-gray-50 border-gray-100' : 'bg-orange-50 border-orange-100'
              }`}>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[f.severity] ?? RISK_COLORS.medium}`}>
                    {RISK_LABELS[f.severity] ?? f.severity}
                  </span>
                  <p className="text-sm font-semibold text-gray-800">{f.title}</p>
                </div>
                <p className="text-sm text-gray-600 mb-1.5">{f.issue}</p>
                <div className="bg-white/70 rounded-lg p-2.5 text-xs text-gray-700">
                  <span className="font-semibold text-gray-500">개선 제안: </span>{f.recommendation}
                </div>
              </div>
            ))}
          </div>
          {r.findings.length > 5 && (
            <button onClick={() => setShowAllFindings(v => !v)} className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
              {showAllFindings ? <>접기 <ChevronUp size={13}/></> : <>{r.findings.length - 5}건 더보기 <ChevronDown size={13}/></>}
            </button>
          )}
        </div>
      )}

      {/* 누락된 항목 제안 */}
      {r.missing_items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
            <Plus size={15} className="text-blue-500"/>누락된 체크리스트 제안
            <span className="text-xs font-normal text-gray-400">({r.missing_items.length}건)</span>
          </h3>
          <div className="space-y-2">
            {missing.map((m, i) => (
              <div key={i} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[m.severity] ?? RISK_COLORS.medium}`}>
                    {RISK_LABELS[m.severity] ?? m.severity}
                  </span>
                  <span className="text-xs bg-white text-gray-500 px-2 py-0.5 rounded-full font-medium">{m.indicator_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FREQUENCY_LABELS[m.suggested_frequency] ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                    {FREQUENCY_LABELS[m.suggested_frequency] ?? m.suggested_frequency}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{m.suggested_title}</p>
                <p className="text-sm text-gray-600 mb-2">{m.description}</p>
                <button
                  onClick={() => handleAddMissing(m, i)}
                  disabled={addedIds.has(i) || addingIdx === i}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    addedIds.has(i) ? 'bg-green-100 text-green-700 cursor-default' : 'bg-primary-orange text-white hover:bg-primary-orange/90'
                  } disabled:opacity-70`}>
                  {addingIdx === i ? <Loader2 size={12} className="animate-spin"/> : addedIds.has(i) ? <CheckCircle2 size={12}/> : <Plus size={12}/>}
                  {addedIds.has(i) ? '체크리스트에 추가됨' : '체크리스트에 추가'}
                </button>
              </div>
            ))}
          </div>
          {r.missing_items.length > 5 && (
            <button onClick={() => setShowAllMissing(v => !v)} className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
              {showAllMissing ? <>접기 <ChevronUp size={13}/></> : <>{r.missing_items.length - 5}건 더보기 <ChevronDown size={13}/></>}
            </button>
          )}
        </div>
      )}

      {/* 종합 의견 */}
      {r.compliance_notes.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2">종합 의견</h3>
          <ul className="space-y-1.5">
            {r.compliance_notes.map((n, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-1">•</span><span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ScoreBadge({ score, size }: { score: number; size: 'sm' | 'lg' }) {
  const color = score >= 80 ? 'text-green-600 bg-green-50 border-green-200'
    : score >= 50 ? 'text-orange-600 bg-orange-50 border-orange-200'
    : 'text-red-600 bg-red-50 border-red-200'
  const dim = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm'
  return (
    <div className={`flex-shrink-0 ${dim} rounded-2xl border-2 ${color} flex flex-col items-center justify-center font-bold`}>
      {score}
      {size === 'lg' && <span className="text-[10px] font-normal -mt-0.5">/ 100</span>}
    </div>
  )
}

function PasteGuidelineForm({ onDone }: { onDone: () => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    try {
      await evalGuidelineAPI.create({ title, content })
      await onDone()
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
      <div className="flex items-center justify-between">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="문서 제목 (예: 2025 시설급여 평가 매뉴얼)"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-orange/40 bg-white"/>
      </div>
      <textarea value={content} onChange={e=>setContent(e.target.value)} rows={6}
        placeholder="평가 가이드라인 / 지표 내용을 마크다운 형식으로 붙여넣으세요..."
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-orange/40 bg-white font-mono"/>
      <div className="flex justify-end gap-2">
        <span className="text-xs text-gray-400 self-center">{content.length.toLocaleString()}자</span>
        <button type="submit" disabled={saving || !title.trim() || !content.trim()}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary-orange text-white rounded-lg px-3 py-1.5 hover:bg-primary-orange/90 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
          저장
        </button>
      </div>
    </form>
  )
}
