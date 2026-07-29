import { useEffect, useState } from 'react'
import { BedDouble, ChevronLeft, Loader2, X } from 'lucide-react'
import { roomAPI, type FloorInfo, type RoomInfo } from '@/api/roomClient'

/**
 * 층 → 호실 → 침대 선택 모달.
 *
 * "어느 방에 자리가 있지?"를 말이 아니라 그림으로 답한다:
 * 층 카드(몇 분 계시고 몇 자리 남았는지) → 호실 카드(침대 그림,
 * 찬 침대는 빨강·빈 침대는 초록) → 빈 침대를 누르면 그 방으로 배정.
 */
export default function RoomPicker({ current, onPick, onClose }: {
  current?: { floor?: string | null; room?: string | null }
  onPick: (floor: string, room: string) => void
  onClose: () => void
}) {
  const [floors, setFloors] = useState<FloorInfo[] | null>(null)
  const [floor, setFloor] = useState<FloorInfo | null>(null)

  useEffect(() => {
    roomAPI.occupancy().then(r => {
      setFloors(r.floors)
      // 현재 층이 있으면 그 층부터 펼쳐준다
      if (current?.floor) {
        const f = r.floors.find(x => x.floor === current.floor)
        if (f) setFloor(f)
      }
    }).catch(() => setFloors([]))
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const Bed = ({ filled, name }: { filled: boolean; name?: string }) => (
    <span title={name || '빈 자리'}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${
        filled ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>
      <BedDouble size={15} />
    </span>
  )

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          {floor && (
            <button onClick={() => setFloor(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
          )}
          <h3 className="text-sm font-bold text-gray-800">
            {floor ? `${floor.floor} — 호실 선택` : '층 선택'}
          </h3>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>

        {floors === null ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : floors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            등록된 층·호실이 없습니다.<br />
            <span className="text-xs">설정 → 층·호실 관리에서 먼저 만들어주세요.</span>
          </p>
        ) : !floor ? (
          /* ── 1단계: 층 — 몇 분 계시고 몇 자리 남았는지 ── */
          <div className="space-y-2">
            {floors.map(f => {
              const free = f.capacity - f.occupied
              return (
                <button key={f.floor} onClick={() => setFloor(f)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50/40 text-left">
                  <span className="text-lg font-extrabold text-gray-800 w-12">{f.floor}</span>
                  <span className="text-sm text-gray-600">{f.occupied}명 입소 중</span>
                  <span className={`ml-auto text-sm font-bold ${free > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {free > 0 ? `${free}자리 남음` : '만실'}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          /* ── 2단계: 호실 — 침대 그림, 빈 침대(초록)를 누르면 배정 ── */
          <div className="space-y-2">
            {floor.rooms.map((r: RoomInfo) => {
              const isCurrent = current?.room === r.room && current?.floor === floor.floor
              const full = r.free === 0 && !isCurrent
              return (
                <button key={r.id} disabled={full}
                  onClick={() => onPick(floor.floor, r.room)}
                  title={full ? '만실' : `${r.room}호에 배정`}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isCurrent ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-200'
                    : full ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    : 'border-gray-200 hover:border-green-400 hover:bg-green-50/40'}`}>
                  <span className="text-base font-extrabold text-gray-800 w-12">{r.room}호</span>
                  <span className="flex gap-1 flex-wrap">
                    {r.occupants.map((n, i) => <Bed key={`o${i}`} filled name={n} />)}
                    {Array.from({ length: r.free }).map((_, i) => <Bed key={`f${i}`} filled={false} />)}
                  </span>
                  <span className={`ml-auto text-xs font-bold ${r.free > 0 ? 'text-green-600' : 'text-red-400'}`}>
                    {isCurrent ? '현재 방' : r.free > 0 ? `${r.free}자리` : '만실'}
                  </span>
                </button>
              )
            })}
            <p className="text-[11px] text-gray-400 text-center pt-1">
              빨간 침대 = 계신 자리 (이름은 침대에 마우스를 올리면) · 초록 침대 = 빈 자리
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
