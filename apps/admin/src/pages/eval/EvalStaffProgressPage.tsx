import { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle, Users } from 'lucide-react'
import { checklistAssignAPI } from '@/api/staffAccountClient'

type Progress = {
  user_id: string; name: string; role: string; position?: string
  total: number; completed: number; overdue: number; needs_revision: number; rate: number
}

export default function EvalStaffProgressPage() {
  const [data,    setData]    = useState<Progress[]>([])
  const [loading, setLoading] = useState(true)
  const [sort,    setSort]    = useState<'rate' | 'overdue' | 'total'>('total')

  const load = async () => {
    setLoading(true)
    try { setData(await checklistAssignAPI.staffProgress()) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const sorted = [...data].sort((a, b) => {
    if (sort === 'rate')    return a.rate    - b.rate
    if (sort === 'overdue') return b.overdue - a.overdue
    return b.total - a.total
  })

  const totals = data.reduce((acc, d) => ({
    total:     acc.total + d.total,
    completed: acc.completed + d.completed,
    overdue:   acc.overdue + d.overdue,
    revision:  acc.revision + d.needs_revision,
  }), { total: 0, completed: 0, overdue: 0, revision: 0 })

  const overallRate = totals.total > 0 ? Math.round(totals.completed / totals.total * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">직원별 진행률</h1>
          <p className="text-sm text-gray-500 mt-0.5">체크리스트 담당 항목 완료 현황</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
          <RefreshCw size={13}/> 새로고침
        </button>
      </div>

      {/* 전체 요약 */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow-lg shadow-orange-200">
        <p className="text-sm font-semibold opacity-80 mb-1">전체 완료율</p>
        <div className="flex items-end gap-3">
          <p className="text-4xl font-bold">{overallRate}%</p>
          <p className="text-sm opacity-80 mb-1">{totals.completed} / {totals.total} 건</p>
        </div>
        <div className="mt-3 bg-white/20 rounded-full h-2.5 overflow-hidden">
          <div className="bg-white h-full rounded-full transition-all" style={{ width: `${overallRate}%` }}/>
        </div>
        <div className="flex gap-4 mt-3 text-sm opacity-90">
          <span>⏰ 기한초과 {totals.overdue}건</span>
          <span>⚠️ 보완필요 {totals.revision}건</span>
        </div>
      </div>

      {/* 정렬 탭 */}
      <div className="flex gap-1.5">
        {(['total','rate','overdue'] as const).map(s => (
          <button key={s} onClick={() => setSort(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${sort===s?'bg-primary-orange text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s==='total'?'담당 건수순':s==='rate'?'완료율 낮은순':'기한초과순'}
          </button>
        ))}
      </div>

      {/* 직원별 카드 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-orange border-t-transparent rounded-full animate-spin mr-2"/>
          <span className="text-sm text-gray-500">불러오는 중...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Users size={32} className="mx-auto mb-2 opacity-30 text-gray-400"/>
          <p className="text-sm text-gray-500">담당 항목이 배정된 직원이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(d => (
            <div key={d.user_id} className={`bg-white rounded-xl border shadow-sm p-4 ${d.overdue > 0 ? 'border-red-100' : 'border-gray-100'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  d.role==='ADMIN'?'bg-red-100 text-red-700':d.role==='MANAGER'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'
                }`}>
                  {d.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{d.name}</p>
                    {d.position && <span className="text-[10px] text-gray-400">{d.position}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">담당 {d.total}건</span>
                    {d.overdue > 0 && (
                      <span className="text-xs text-red-500 font-medium flex items-center gap-0.5">
                        <AlertTriangle size={10}/> 초과 {d.overdue}건
                      </span>
                    )}
                    {d.needs_revision > 0 && (
                      <span className="text-xs text-orange-500 font-medium">⚠️ 보완 {d.needs_revision}건</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-bold ${d.rate >= 80 ? 'text-green-600' : d.rate >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                    {d.rate}%
                  </p>
                  <p className="text-[11px] text-gray-400">{d.completed}/{d.total}</p>
                </div>
              </div>
              {/* 프로그레스 바 */}
              <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  d.rate >= 80 ? 'bg-green-500' : d.rate >= 50 ? 'bg-orange-400' : 'bg-red-400'
                }`} style={{ width: `${d.rate}%` }}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
