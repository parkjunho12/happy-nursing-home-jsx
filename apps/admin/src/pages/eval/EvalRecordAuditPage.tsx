import { useState, useMemo, useCallback } from 'react'
import {
  Upload, FileSpreadsheet, CheckCircle2, ChevronRight,
  RefreshCw, Download, Filter, X, Sparkles, Eye, Loader2,
} from 'lucide-react'
import type { Issue, SheetData, IssueSeverity, IssueCategory, IssueStatus } from '@/types/audit'
import { parseExcelFile } from '@/lib/excelParser'
import { runRuleEngine } from '@/lib/ruleEngine'

// ── 상수 ─────────────────────────────────────────────────────────────────────
const SEV_CONFIG: Record<IssueSeverity, { bg: string; text: string; border: string; dot: string }> = {
  높음: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  중간: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-400' },
  낮음: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
}
const CAT_ICON: Record<IssueCategory, string> = {
  날짜: '📅', 바이탈: '🩺', 서비스제공: '📋', 서명: '✍️', 패턴: '🔁', AI검토: '✨',
}
const STATUS_CONFIG: Record<IssueStatus, { label: string; cls: string }> = {
  미확인:  { label: '미확인',  cls: 'bg-gray-100 text-gray-600' },
  확인완료: { label: '확인완료', cls: 'bg-blue-100 text-blue-700' },
  수정완료: { label: '수정완료', cls: 'bg-green-100 text-green-700' },
}

export default function EvalRecordAuditPage() {
  const [sheets,   setSheets]   = useState<SheetData[]>([])
  const [issues,   setIssues]   = useState<Issue[]>([])
  const [fileName, setFileName] = useState('')
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [selected, setSelected] = useState<Issue | null>(null)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiDone,    setAiDone]      = useState(false)
  const [uploading, setUploading]   = useState(false)

  // 필터
  const [filterSev,  setFilterSev]  = useState<IssueSeverity | 'all'>('all')
  const [filterCat,  setFilterCat]  = useState<IssueCategory | 'all'>('all')
  const [filterStat, setFilterStat] = useState<IssueStatus | 'all'>('all')
  const [filterName, setFilterName] = useState('')

  // 파일 업로드
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xls|xlsx)$/i)) return
    setUploading(true)
    try {
      const parsed = await parseExcelFile(file)
      setSheets(parsed)
      setFileName(file.name)
      setActiveSheet(parsed[0]?.name ?? null)
      const found = runRuleEngine(parsed)
      setIssues(found)
      setSelected(null)
      setAiDone(false)
    } finally { setUploading(false) }
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // 상태 변경
  const changeStatus = (id: string, status: IssueStatus) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : null)
  }

  // AI 검수
  const runAI = async () => {
    setAiLoading(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `당신은 장기요양기관 평가 전문가입니다.
다음은 제공기록지 기본 룰 검수 결과입니다. 평가자가 지적할 수 있는 추가적인 문제를 3~5개 찾아주세요.
JSON 배열만 반환하세요:
[{"message":"...","suggestion":"...","severity":"높음|중간|낮음","category":"AI검토"}]

검수 결과:
${JSON.stringify(issues.slice(0, 20).map(i => ({ message: i.message, category: i.category, severity: i.severity })), null, 2)}

시트 구조:
${sheets.map(s => `시트: ${s.name}, 컬럼: ${s.headers.filter(Boolean).join(', ')}`).join('\n')}`
          }]
        })
      })
      const data = await response.json()
      const text = (data.content?.[0]?.text ?? '').replace(/```json|```/g, '').trim()
      const aiIssues: Omit<Issue, 'id' | 'sheetName' | 'row' | 'status'>[] = JSON.parse(text)
      const newIssues: Issue[] = aiIssues.map((ai, idx) => ({
        id: `ai-${Date.now()}-${idx}`,
        sheetName: sheets[0]?.name ?? '',
        row: 0,
        category: 'AI검토',
        severity: ai.severity ?? '낮음',
        message: ai.message,
        suggestion: ai.suggestion,
        status: '미확인',
      }))
      setIssues(prev => [...prev.filter(i => i.category !== 'AI검토'), ...newIssues])
      setAiDone(true)
    } catch (e) {
      console.error('AI 검수 실패', e)
    } finally {
      setAiLoading(false)
    }
  }

  // CSV 다운로드
  const downloadCSV = () => {
    const header = '시트,행,날짜,카테고리,심각도,메시지,제안,상태,원본값\n'
    const rows = issues.map(i =>
      [i.sheetName, i.row, i.date??'', i.category, i.severity,
       `"${i.message}"`, `"${i.suggestion}"`, i.status, `"${i.originalValue??''}"`].join(',')
    ).join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `검수결과_${fileName.replace(/\.[^.]+$/, '')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // 필터된 이슈
  const filtered = useMemo(() => issues.filter(i => {
    if (activeSheet && i.sheetName !== activeSheet && i.sheetName !== '') return false
    if (filterSev  !== 'all' && i.severity  !== filterSev)  return false
    if (filterCat  !== 'all' && i.category  !== filterCat)  return false
    if (filterStat !== 'all' && i.status    !== filterStat)  return false
    if (filterName && !(i.residentName ?? '').includes(filterName) && !i.message.includes(filterName)) return false
    return true
  }), [issues, activeSheet, filterSev, filterCat, filterStat, filterName])

  const counts = useMemo(() => ({
    high: issues.filter(i => i.severity === '높음').length,
    mid:  issues.filter(i => i.severity === '중간').length,
    low:  issues.filter(i => i.severity === '낮음').length,
    done: issues.filter(i => i.status === '수정완료').length,
  }), [issues])

  const hasFile = sheets.length > 0

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">제공기록지 검수</h1>
          <p className="text-sm text-gray-500 mt-0.5">엑셀(.xls/.xlsx) 업로드 → 기본 룰 자동 검수 → AI 추가 분석</p>
        </div>
        {hasFile && (
          <div className="flex gap-2">
            <button onClick={runAI} disabled={aiLoading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 font-semibold">
              {aiLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
              {aiDone ? 'AI 재검토' : 'AI 검수 실행'}
            </button>
            <button onClick={downloadCSV}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              <Download size={14}/> CSV 저장
            </button>
          </div>
        )}
      </div>

      {/* 업로드 영역 */}
      {!hasFile ? (
        <div
          onDragOver={e => e.preventDefault()} onDrop={onDrop}
          className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 hover:border-primary-orange hover:bg-orange-50/30 transition-colors cursor-pointer min-h-[400px]"
          onClick={() => document.getElementById('excel-upload')?.click()}>
          <input id="excel-upload" type="file" accept=".xls,.xlsx" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
          {uploading ? (
            <div className="text-center">
              <Loader2 size={40} className="mx-auto mb-3 text-primary-orange animate-spin"/>
              <p className="text-sm text-gray-500">파일 분석 중...</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload size={28} className="text-primary-orange"/>
              </div>
              <p className="text-lg font-bold text-gray-800 mb-1">제공기록지 엑셀 파일을 올려주세요</p>
              <p className="text-sm text-gray-400">.xls, .xlsx 파일 지원 · 드래그 또는 클릭</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0" style={{ height: 'calc(100vh - 220px)' }}>
          {/* 좌측 패널 */}
          <div className="w-52 flex-shrink-0 flex flex-col gap-3">
            {/* 파일명 */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet size={16} className="text-green-600 flex-shrink-0"/>
                <p className="text-xs font-semibold text-gray-700 truncate">{fileName}</p>
              </div>
              <button onClick={() => document.getElementById('excel-upload2')?.click()}
                className="w-full text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-primary-orange hover:text-primary-orange transition-colors">
                <RefreshCw size={11} className="inline mr-1"/>다른 파일
              </button>
              <input id="excel-upload2" type="file" accept=".xls,.xlsx" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
            </div>

            {/* 시트 목록 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 px-3 pt-2.5 pb-1.5">시트</p>
              {sheets.map(s => (
                <button key={s.name} onClick={() => setActiveSheet(s.name)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    activeSheet === s.name ? 'bg-orange-50 text-primary-orange font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  <ChevronRight size={11} className={activeSheet===s.name?'opacity-100':'opacity-0'}/>
                  {s.name}
                  <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {issues.filter(i => i.sheetName === s.name).length}
                  </span>
                </button>
              ))}
            </div>

            {/* 요약 */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">검수 결과 요약</p>
              {([['높음', counts.high, 'text-red-600 bg-red-50'],
                 ['중간', counts.mid,  'text-orange-600 bg-orange-50'],
                 ['낮음', counts.low,  'text-yellow-600 bg-yellow-50']] as const).map(([sev, cnt, cls]) => (
                <div key={sev} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${cls.split(' ')[1]}`}>
                  <span className={`text-xs font-semibold ${cls.split(' ')[0]}`}>{sev}</span>
                  <span className={`text-sm font-bold ${cls.split(' ')[0]}`}>{cnt}건</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-green-50">
                <span className="text-xs font-semibold text-green-600">수정완료</span>
                <span className="text-sm font-bold text-green-600">{counts.done}건</span>
              </div>
            </div>
          </div>

          {/* 중앙 테이블 */}
          <div className="flex-1 flex flex-col min-w-0 gap-3">
            {/* 필터 바 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2.5 flex gap-2 flex-wrap items-center">
              <Filter size={13} className="text-gray-400 flex-shrink-0"/>
              <select value={filterSev} onChange={e => setFilterSev(e.target.value as any)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-orange bg-white">
                <option value="all">전체 심각도</option>
                <option value="높음">높음</option>
                <option value="중간">중간</option>
                <option value="낮음">낮음</option>
              </select>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value as any)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-orange bg-white">
                <option value="all">전체 카테고리</option>
                {(['날짜','바이탈','서비스제공','서명','패턴','AI검토'] as IssueCategory[]).map(c => (
                  <option key={c} value={c}>{CAT_ICON[c]} {c}</option>
                ))}
              </select>
              <select value={filterStat} onChange={e => setFilterStat(e.target.value as any)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-orange bg-white">
                <option value="all">전체 상태</option>
                <option value="미확인">미확인</option>
                <option value="확인완료">확인완료</option>
                <option value="수정완료">수정완료</option>
              </select>
              <input value={filterName} onChange={e => setFilterName(e.target.value)}
                placeholder="메시지 검색..."
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-orange w-32"/>
              {(filterSev!=='all'||filterCat!=='all'||filterStat!=='all'||filterName) && (
                <button onClick={() => { setFilterSev('all'); setFilterCat('all'); setFilterStat('all'); setFilterName('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                  <X size={12}/>초기화
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400">{filtered.length}건</span>
            </div>

            {/* 이슈 목록 */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 bg-white rounded-xl border border-gray-100 text-gray-400">
                  <CheckCircle2 size={32} className="mb-2 text-green-400 opacity-60"/>
                  <p className="text-sm">해당 조건의 이슈가 없습니다.</p>
                </div>
              ) : filtered.map(issue => {
                const sev = SEV_CONFIG[issue.severity]
                const sta = STATUS_CONFIG[issue.status]
                return (
                  <div key={issue.id}
                    onClick={() => setSelected(issue)}
                    className={`bg-white rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md ${
                      selected?.id === issue.id ? 'ring-2 ring-primary-orange border-transparent' : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    <div className="flex items-start gap-3 p-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${sev.dot}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>
                            {issue.severity}
                          </span>
                          <span className="text-[10px] text-gray-500">{CAT_ICON[issue.category]} {issue.category}</span>
                          {issue.row > 0 && <span className="text-[10px] text-gray-400">{issue.row}행</span>}
                          {issue.date && <span className="text-[10px] text-gray-400">{issue.date}</span>}
                        </div>
                        <p className="text-sm text-gray-800 leading-snug">{issue.message}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sta.cls}`}>
                        {sta.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 우측 상세 패널 */}
          <div className="w-72 flex-shrink-0">
            {selected ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full overflow-y-auto">
                <div className="p-4 border-b border-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SEV_CONFIG[selected.severity].bg} ${SEV_CONFIG[selected.severity].text} ${SEV_CONFIG[selected.severity].border}`}>
                      {selected.severity}
                    </span>
                    <span className="text-xs text-gray-500">{CAT_ICON[selected.category]} {selected.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{selected.message}</p>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">📍 위치</p>
                    <p className="text-xs text-gray-700">
                      시트: <span className="font-medium">{selected.sheetName}</span>
                      {selected.row > 0 && <span> / {selected.row}행</span>}
                      {selected.column !== undefined && <span> / {selected.column + 1}열</span>}
                    </p>
                  </div>
                  {selected.originalValue !== undefined && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">📄 원본 값</p>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all">
                        {selected.originalValue || <span className="text-gray-400 italic">비어 있음</span>}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">💡 수정 제안</p>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-800 leading-relaxed">
                      {selected.suggestion}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">🔄 상태 변경</p>
                    <div className="flex flex-col gap-1.5">
                      {(['미확인','확인완료','수정완료'] as IssueStatus[]).map(s => (
                        <button key={s} onClick={() => changeStatus(selected.id, s)}
                          className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
                            selected.status === s
                              ? 'bg-primary-orange text-white shadow-sm'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}>
                          {STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 h-full flex flex-col items-center justify-center text-gray-400">
                <Eye size={28} className="mb-2 opacity-40"/>
                <p className="text-sm">이슈를 선택하면<br/>상세 내용이 표시됩니다</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 로딩 오버레이 */}
      {aiLoading && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-xs">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={24} className="text-purple-600 animate-pulse"/>
            </div>
            <p className="font-bold text-gray-900 mb-1">AI 검수 중...</p>
            <p className="text-xs text-gray-500">평가자 관점에서 추가 이슈를 분석하고 있습니다.</p>
          </div>
        </div>
      )}
    </div>
  )
}
