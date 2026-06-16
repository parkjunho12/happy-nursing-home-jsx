import { useState, useEffect, useMemo } from 'react'
import { CheckCircle2, Clock, RefreshCw, ChevronRight, Upload } from 'lucide-react'
import { checklistAssignAPI } from '@/api/staffAccountClient'
import { useAuthStore } from '@/store/auth'
import { daysFromToday } from '@/utils/period'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:        { label: '대기',     cls: 'bg-gray-100 text-gray-600' },
  in_progress:    { label: '진행중',   cls: 'bg-blue-100 text-blue-700' },
  completed:      { label: '완료',     cls: 'bg-green-100 text-green-700' },
  needs_revision: { label: '보완필요', cls: 'bg-orange-100 text-orange-700' },
  overdue:        { label: '기한초과', cls: 'bg-red-100 text-red-700' },
}

const FREQ_LABELS: Record<string, string> = {
  daily:'일일', weekly:'주별', monthly:'월별',
  quarterly:'분기별', 'half-yearly':'반기별', yearly:'연별',
}

export default function EvalMyTasksPage() {
  const { user }   = useAuthStore()
  const [tasks,    setTasks]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selTask,  setSelTask]  = useState<any | null>(null)
  const [filter,   setFilter]   = useState<'all' | 'pending' | 'overdue' | 'needs_revision'>('all')

  const load = async () => {
    setLoading(true)
    try { setTasks(await checklistAssignAPI.myTasks()) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks
    if (filter === 'overdue') return tasks.filter(t => t.status === 'overdue')
    if (filter === 'needs_revision') return tasks.filter(t => t.status === 'needs_revision')
    return tasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
  }, [tasks, filter])

  const counts = useMemo(() => ({
    total:    tasks.length,
    overdue:  tasks.filter(t => t.status === 'overdue').length,
    revision: tasks.filter(t => t.status === 'needs_revision').length,
  }), [tasks])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 담당 업무</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user?.name}님에게 배정된 체크리스트 항목입니다</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
          <RefreshCw size={13}/> 새로고침
        </button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-4 border border-white shadow-sm">
          <p className="text-xs text-gray-500 mb-1">전체 담당</p>
          <p className="text-2xl font-bold text-gray-900">{counts.total}건</p>
        </div>
        <div className={`rounded-xl p-4 border border-white shadow-sm ${counts.overdue > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <p className="text-xs text-gray-500 mb-1">기한 초과</p>
          <p className={`text-2xl font-bold ${counts.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{counts.overdue}건</p>
        </div>
        <div className={`rounded-xl p-4 border border-white shadow-sm ${counts.revision > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
          <p className="text-xs text-gray-500 mb-1">보완 필요</p>
          <p className={`text-2xl font-bold ${counts.revision > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{counts.revision}건</p>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1.5">
        {(['all','pending','overdue','needs_revision'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filter===f?'bg-primary-orange text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f==='all'?'전체':f==='pending'?'미완료':f==='overdue'?'기한초과':'보완필요'}
          </button>
        ))}
      </div>

      {/* 업무 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-orange border-t-transparent rounded-full animate-spin mr-2"/>
          <span className="text-sm text-gray-500">불러오는 중...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-green-400 opacity-60"/>
          <p className="text-sm font-medium text-green-600">
            {filter === 'all' ? '담당 업무가 없습니다' : '해당 항목이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="flex gap-4" style={{ minHeight: '400px' }}>
          {/* 목록 */}
          <div className="flex-1 space-y-2">
            {filtered.map((task, i) => {
              const sc   = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending
              const days = task.due_date ? daysFromToday(task.due_date) : null
              const urgent = days !== null && days <= 3 && task.status !== 'completed'
              return (
                <div key={task.id || i} onClick={() => setSelTask(task)}
                  className={`bg-white rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all ${
                    selTask?.id === task.id ? 'ring-2 ring-primary-orange border-transparent' :
                    task.status==='overdue' ? 'border-red-200' :
                    task.status==='needs_revision' ? 'border-orange-200' : 'border-gray-100'
                  }`}>
                  <div className="flex items-center gap-3 p-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                        <span className="text-[10px] text-gray-400">{FREQ_LABELS[task.frequency] ?? task.frequency}</span>
                        {urgent && <span className="text-[10px] text-red-500 font-bold">D-{days}</span>}
                      </div>
                      <p className="text-sm font-semibold text-gray-800 truncate">{task.title}</p>
                      {task.due_date && (
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <Clock size={9}/> 마감 {task.due_date}
                        </p>
                      )}
                      {task.rejection_reason && (
                        <p className="text-[11px] text-orange-600 mt-0.5">⚠️ {task.rejection_reason}</p>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0"/>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 상세 패널 */}
          <div className="w-72 flex-shrink-0">
            {selTask ? (
              <TaskDetailPanel
                task={selTask}
                onCompleted={() => { load(); setSelTask(null) }}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 h-full flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                <CheckCircle2 size={28} className="mb-2 opacity-30"/>
                <p className="text-sm text-center">항목을 선택하면<br/>완료 처리할 수 있습니다</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 업무 상세 패널 ─────────────────────────────────────────────────────────────
function TaskDetailPanel({ task, onCompleted }: { task: any; onCompleted: ()=>void }) {
  const [memo,    setMemo]    = useState(task.memo || '')
  const [file,    setFile]    = useState<File | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending

  const complete = async () => {
    setSaving(true); setError('')
    try {
      await checklistAssignAPI.complete(task.checklist_item_id, task.id, memo, file || undefined)
      onCompleted()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '완료 처리 중 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-y-auto max-h-[600px]">
      <div className="p-4 border-b border-gray-50">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span>
        <p className="font-semibold text-gray-900 mt-2 leading-snug">{task.title}</p>
        {task.due_date && (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Clock size={10}/> 마감 {task.due_date}
          </p>
        )}
      </div>
      <div className="p-4 space-y-4">
        {task.rejection_reason && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-orange-700 mb-1">⚠️ 보완 요청 사항</p>
            <p className="text-xs text-orange-800">{task.rejection_reason}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">완료 메모</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40 resize-none"
            rows={3} value={memo} onChange={e => setMemo(e.target.value)}
            placeholder="완료 내용, 증빙 요약 등을 입력하세요"/>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">증빙자료 첨부</label>
          <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-orange hover:bg-orange-50/30 transition-colors">
            <Upload size={13} className="text-gray-400"/>
            <span className="text-xs text-gray-500">{file ? file.name : '파일 선택'}</span>
            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)}/>
          </label>
        </div>

        {task.attachment_url && (
          <div className="text-xs text-blue-600">
            📎 <a href={task.attachment_url} target="_blank" rel="noopener noreferrer" className="underline">기존 첨부파일</a>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-600">⚠️ {error}</div>}

        {task.status !== 'completed' && (
          <button onClick={complete} disabled={saving}
            className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> 처리 중...</>
              : <><CheckCircle2 size={15}/> 완료 처리</>}
          </button>
        )}
        {task.status === 'completed' && (
          <div className="text-center py-3 text-green-600 font-semibold text-sm">
            ✅ 완료된 항목입니다
          </div>
        )}
      </div>
    </div>
  )
}
