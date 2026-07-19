import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Search, UserCheck } from 'lucide-react'
import type { LtcResident } from '@/store/ltc'

/**
 * 어르신 명단에서 직접 고르는 모달.
 * AI 제안이 없거나 틀렸을 때, 담당자가 전체 명단에서 한 번에 확정한다.
 */
export default function ResidentPickerModal({
  rawName, residents, currentId, onPick, onClose,
}: {
  rawName: string
  residents: LtcResident[]
  currentId?: string | null
  onPick: (r: { id: string; name: string } | null) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const list = useMemo(() => {
    const kw = q.trim()
    return residents
      .filter(r => r.status === 'active')
      .filter(r => !kw || r.name.includes(kw))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [residents, q])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-gray-900">어르신 선택</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <p className="text-[13px] text-gray-500">기록지 표기: <b className="text-gray-800">{rawName || '(없음)'}</b></p>
        </div>

        <div className="px-5 pt-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="이름 검색"
              className="w-full pl-9 pr-3 py-2.5 text-[15px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200" />
          </div>
        </div>

        <div className="px-3 py-2 overflow-y-auto flex-1">
          {list.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">검색 결과가 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {list.map(r => (
                <li key={r.id}>
                  <button onClick={() => onPick({ id: r.id, name: r.name })}
                    className={`w-full flex items-center gap-2.5 px-3 py-3 min-h-[52px] rounded-xl text-left transition-colors ${
                      currentId === r.id ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <span className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 text-[14px] font-bold flex items-center justify-center shrink-0">
                      {r.name.slice(0, 1)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[16px] font-semibold text-gray-800">{r.name}</span>
                      {r.floor && <span className="block text-[12px] text-gray-400">{r.floor}</span>}
                    </span>
                    {currentId === r.id && <UserCheck size={17} className="text-violet-600" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t shrink-0">
          <button onClick={() => onPick(null)}
            className="w-full py-3 min-h-[48px] border border-gray-200 text-gray-600 rounded-xl text-[15px] font-semibold hover:bg-gray-50">
            명단에 없는 분입니다
          </button>
        </div>
      </div>
    </div>
  )
}
