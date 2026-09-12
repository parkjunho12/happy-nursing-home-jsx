import { useMemo, useState } from 'react'
import { Search, UserRound, X } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'

/**
 * 어르신 고르기 — 이름·호실로 찾는다.
 *
 * 자유 입력으로 두면 이름을 정확히 안 치거나 동명이인일 때 조용히 안 붙고,
 * 고른 줄 알고 넘어간다. 그래서 목록에서 고르게 한다.
 */
export interface PickedResident {
  id: string
  name: string
  floor?: string | null
  room?: string | null
}

export default function ResidentPickerModal({
  onPick, onClose, allowNone, noneLabel = '어르신 없이',
}: {
  onPick: (r: PickedResident | null) => void
  onClose: () => void
  /** '어르신 없이' 를 고를 수 있는가 (시설 문서 등) */
  allowNone?: boolean
  noneLabel?: string
}) {
  const { residents } = useLtcStore()
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const s = q.trim()
    return residents
      .filter(r => r.status !== 'discharged')
      .filter(r => !s || (r.name ?? '').includes(s) || ((r as any).room ?? '').includes(s))
      .sort((a, b) =>
        ((a as any).floor ?? '').localeCompare((b as any).floor ?? '') ||
        ((a as any).room ?? '999').localeCompare((b as any).room ?? '999') ||
        (a.name ?? '').localeCompare(b.name ?? '', 'ko'))
      .slice(0, 80)
  }, [residents, q])

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
          <UserRound size={15} className="text-teal-600" />
          <h3 className="text-sm font-bold text-gray-900">어르신 선택</h3>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <div className="px-3 py-2 border-b shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="성함 · 호실로 찾기"
              className="w-full pl-7 pr-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">찾는 어르신이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {list.map(r => (
                <li key={r.id}>
                  <button onClick={() => { onPick({ id: r.id, name: r.name, floor: (r as any).floor, room: (r as any).room }); onClose() }}
                    className="w-full text-left px-4 py-2.5 hover:bg-teal-50 flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0">
                      {(r as any).room ? `${(r as any).room}호` : (r as any).floor ?? ''}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{r.name}</span>
                    {r.status === 'pending' && <span className="ml-auto text-[10px] font-bold text-amber-600">입소 예정</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {allowNone && (
          <div className="px-3 py-2.5 border-t shrink-0">
            <button onClick={() => { onPick(null); onClose() }}
              className="w-full py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50">
              {noneLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
