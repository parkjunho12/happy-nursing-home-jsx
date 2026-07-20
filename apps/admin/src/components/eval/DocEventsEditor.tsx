import { useState } from 'react'
import { X, GripVertical, ArrowDownUp } from 'lucide-react'
import DateField from '@/components/ui/DateField'
import { type DocEvent, type DocType, KINDS, defaultKind, asEvent , STATUSES, statusMeta, effStatus, type EventStatus } from '@/utils/docEvents'

/**
 * 서류 일시 편집기 — 계약서/급여제공계획서/결과평가 공용.
 * 각 행 = 날짜(선택) + 구분(색상) + 메모(선택). 드래그로 순서 변경, 날짜순 정렬 지원.
 */
const inp = 'px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-200'

interface Props {
  type: DocType
  value?: DocEvent[]
  onChange: (next: DocEvent[]) => void
  addLabel?: string
  defaultAddKind?: string
}

export default function DocEventsEditor({ type, value, onChange, addLabel = '+ 일시 추가', defaultAddKind }: Props) {
  const items = (value ?? []).map(asEvent)
  const kinds = KINDS[type]
  const [dragI, setDragI] = useState<number | null>(null)
  const [overI, setOverI] = useState<number | null>(null)

  const patch = (i: number, p: Partial<DocEvent>) => onChange(items.map((x, xi) => xi === i ? { ...x, ...p } : x))
  const add = () => onChange([...items, { date: '', memo: '', kind: defaultAddKind ?? defaultKind(type) }])
  const rm = (i: number) => onChange(items.filter((_, xi) => xi !== i))
  const sortByDate = () => onChange([...items].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')))

  const drop = (target: number) => {
    if (dragI === null || dragI === target) { setDragI(null); setOverI(null); return }
    const next = [...items]
    const [moved] = next.splice(dragI, 1)
    next.splice(target, 0, moved)
    onChange(next); setDragI(null); setOverI(null)
  }

  return (
    <div className="space-y-1.5">
      {items.map((it, i) => {
        const meta = kinds.find(k => k.v === it.kind) ?? kinds[0]
        return (
          <div key={i}
            onDragOver={e => { e.preventDefault(); if (overI !== i) setOverI(i) }}
            onDrop={() => drop(i)}
            className={`flex flex-wrap items-center gap-1.5 rounded-lg ${overI === i && dragI !== null ? 'ring-2 ring-teal-300 ring-offset-1' : ''} ${dragI === i ? 'opacity-40' : ''}`}
          >
            <span draggable onDragStart={() => setDragI(i)} onDragEnd={() => { setDragI(null); setOverI(null) }}
              className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0" title="드래그로 순서 변경">
              <GripVertical className="w-4 h-4" />
            </span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
            <select value={it.kind ?? kinds[0].v} onChange={e => patch(i, { kind: e.target.value })} className={`${inp} w-28`}>
              {kinds.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
            </select>
            <DateField value={it.date} onChange={v => patch(i, { date: v })} className={inp} wrapperClassName="flex-1 min-w-[8rem]" placeholder="날짜(선택)" />
            <input value={it.memo ?? ''} onChange={e => patch(i, { memo: e.target.value })} placeholder="메모(선택)" className={`${inp} flex-1 min-w-[7rem]`} />
            {(() => {
              const cur = effStatus(it)
              const sm = statusMeta(cur)
              return (
                <select
                  title="서류 상태"
                  value={cur ?? ''}
                  onChange={e => {
                    const v = (e.target.value || null) as EventStatus | null
                    patch(i, { status: v, done: v === '완료' })
                  }}
                  className={`shrink-0 text-[11px] font-bold px-2 py-1.5 rounded-lg border cursor-pointer focus:outline-none ${sm ? sm.chip : 'bg-white border-gray-200 text-gray-400'}`}>
                  <option value="">상태 없음</option>
                  {STATUSES.map(st => <option key={st.v} value={st.v}>{st.label}</option>)}
                </select>
              )
            })()}
            <button type="button" onClick={() => rm(i)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )
      })}
      <div className="flex items-center gap-3">
        <button type="button" onClick={add} className="text-xs font-semibold text-teal-600 hover:underline">{addLabel}</button>
        {items.length > 1 && (
          <button type="button" onClick={sortByDate} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600">
            <ArrowDownUp className="w-3 h-3" /> 날짜순 정렬
          </button>
        )}
      </div>
    </div>
  )
}
