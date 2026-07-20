import { useEffect, useState } from 'react'
import { X, History, Loader2, Plus, Minus, ArrowRight } from 'lucide-react'
import { residentDocAPI, type DocChange, type DocChangeItem } from '@/api/residentDocClient'

/** ISO → 'YYYY-MM-DD' (KST 기준) */
const dayOf = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d)
}
const timeOf = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}
/** '오늘 · 7월 20일(월)' 형태 */
const dayLabel = (day: string) => {
  if (!day) return ''
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
  const y = new Date(Date.now() - 86400000)
  const yest = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(y)
  const [, m, d] = day.split('-')
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${day}T00:00:00+09:00`).getDay()]
  const base = `${Number(m)}월 ${Number(d)}일(${w})`
  return day === today ? `오늘 · ${base}` : day === yest ? `어제 · ${base}` : base
}

const ACTION: Record<string, { label: string; cls: string }> = {
  create: { label: '등록', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  update: { label: '수정', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  delete: { label: '삭제', cls: 'bg-red-50 text-red-700 border-red-200' },
}

function ChangeRow({ c }: { c: DocChangeItem }) {
  const isList = Array.isArray(c.added) || Array.isArray(c.removed)
  return (
    <div className="flex gap-2 text-[12px] leading-relaxed">
      <span className="shrink-0 w-[86px] text-gray-400 font-semibold">{c.label}</span>
      <div className="flex-1 min-w-0">
        {isList ? (
          <div className="space-y-0.5">
            {(c.added ?? []).map((x, i) => (
              <div key={`a${i}`} className="flex items-start gap-1 text-emerald-700">
                <Plus size={11} className="mt-[3px] shrink-0" /><span className="break-words">{x}</span>
              </div>
            ))}
            {(c.removed ?? []).map((x, i) => (
              <div key={`r${i}`} className="flex items-start gap-1 text-red-500">
                <Minus size={11} className="mt-[3px] shrink-0" /><span className="break-words line-through decoration-red-300">{x}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 line-through decoration-gray-300">{c.before ?? '(없음)'}</span>
            <ArrowRight size={11} className="text-gray-300 shrink-0" />
            <span className="font-semibold text-gray-800">{c.after ?? '(없음)'}</span>
          </span>
        )}
      </div>
    </div>
  )
}

/** 서류 수정 이력 — docId를 주면 해당 어르신만, 없으면 전체 최근 이력 */
export default function DocChangesModal({ docId, name, onClose }: { docId?: string; name?: string; onClose: () => void }) {
  const [list, setList] = useState<DocChange[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = docId ? residentDocAPI.changes(docId) : residentDocAPI.recentChanges(50)
    p.then(setList).catch(() => setList([])).finally(() => setLoading(false))
  }, [docId])

  // 날짜별 묶음
  const groups: [string, DocChange[]][] = []
  for (const c of list) {
    const d = dayOf(c.created_at)
    const last = groups[groups.length - 1]
    if (last && last[0] === d) last[1].push(c)
    else groups.push([d, [c]])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <History size={16} className="text-teal-600" />
            <h3 className="font-bold text-gray-900">{docId ? `${name ?? ''} 수정 이력` : '최근 수정 이력'}</h3>
            {list.length > 0 && <span className="text-[11px] text-gray-400">{list.length}건</span>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
          ) : list.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-12 px-6 leading-relaxed">
              아직 기록된 수정 이력이 없습니다.<br />
              지금부터 서류를 저장할 때마다 바뀐 항목이 자동으로 남습니다.
            </p>
          ) : (
            groups.map(([day, items]) => (
              <div key={day}>
                <div className="sticky top-0 z-10 bg-gray-50 border-y border-gray-100 px-5 py-1.5">
                  <span className="text-[11.5px] font-semibold text-gray-600">{dayLabel(day)}</span>
                  <span className="text-[10.5px] text-gray-400 ml-2">{items.length}건</span>
                </div>
                <ul>
                  {items.map(c => {
                    const a = ACTION[c.action] ?? ACTION.update
                    return (
                      <li key={c.id} className="px-5 py-3 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          <span className="text-[13px] font-semibold text-gray-800 tabular-nums">{timeOf(c.created_at)}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${a.cls}`}>{a.label}</span>
                          {!docId && c.resident_name && (
                            <span className="text-[12px] font-semibold text-gray-700">{c.resident_name}</span>
                          )}
                          <span className="text-[11px] text-gray-400 ml-auto">{c.user_name ?? '알 수 없음'}</span>
                        </div>
                        <div className="space-y-1">
                          {(c.changes ?? []).map((ch, i) => <ChangeRow key={i} c={ch} />)}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
