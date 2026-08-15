import { useEffect, useState } from 'react'
import { BedDouble, ChevronLeft, Loader2, X, Pencil } from 'lucide-react'
import { roomAPI, type FloorInfo, type RoomInfo } from '@/api/roomClient'

/**
 * 층 → 호실 → 침대 선택 모달.
 *
 * "어느 방에 자리가 있지?"를 말이 아니라 그림으로 답한다:
 * 층 카드(몇 분 계시고 몇 자리 남았는지) → 호실 카드(침대 그림,
 * 찬 침대는 빨강·빈 침대는 초록) → 침대를 누르면 그 방으로 배정.
 *
 * 만실이어도 막지 않는다 — 두 분을 맞바꾸거나 잠시 겹쳐 두는 일이 실제로 있어서,
 * 확인만 한 번 받고 넘긴다(force). 설정에 없는 호실은 '직접 입력'으로 바로 적는다.
 */
export default function RoomPicker({ current, onPick, onClose }: {
  current?: { floor?: string | null; room?: string | null }
  /** force=true → 정원 초과를 확인받고 강행 */
  onPick: (floor: string, room: string, force?: boolean) => void
  onClose: () => void
}) {
  const [floors, setFloors] = useState<FloorInfo[] | null>(null)
  const [floor, setFloor] = useState<FloorInfo | null>(null)
  const [manual, setManual] = useState(false)
  const [mFloor, setMFloor] = useState(current?.floor ?? '')
  const [mRoom, setMRoom] = useState(current?.room ?? '')

  useEffect(() => {
    roomAPI.occupancy().then(r => {
      setFloors(r.floors)
      // 현재 층이 있으면 그 층부터 펼쳐준다
      if (current?.floor) {
        const f = r.floors.find(x => x.floor === current.floor)
        if (f) setFloor(f)
      }
      // 등록된 호실이 아예 없으면 곧장 직접 입력 — 빈 화면에서 막히지 않게
      if (r.floors.length === 0) setManual(true)
    }).catch(() => { setFloors([]); setManual(true) })
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (f: string, r: RoomInfo, isCurrent: boolean) => {
    const over = r.free === 0 && !isCurrent
    if (over && !confirm(
      `${f} ${r.room}호는 정원 ${r.capacity}명이 이미 찼습니다.\n(현재: ${r.occupants.join(', ')})\n\n그래도 이 방으로 배정할까요?`
    )) return
    onPick(f, r.room, over)
  }

  const Bed = ({ filled, name }: { filled: boolean; name?: string }) => (
    <span title={name || '빈 자리'}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${
        filled ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>
      <BedDouble size={15} />
    </span>
  )

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/40'

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          {floor && !manual && (
            <button onClick={() => setFloor(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
          )}
          <h3 className="text-sm font-bold text-gray-800">
            {manual ? '층 · 호실 직접 입력' : floor ? `${floor.floor} — 호실 선택` : '층 선택'}
          </h3>
          {(current?.floor || current?.room) && (
            <button onClick={() => onPick('', '')}
              className="ml-auto text-[11px] font-bold text-red-400 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">
              배정 해제
            </button>
          )}
          <button onClick={onClose} className={`${(current?.floor || current?.room) ? '' : 'ml-auto '}text-gray-300 hover:text-gray-500`}><X size={18} /></button>
        </div>

        {floors === null ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : manual ? (
          /* ── 직접 입력 — 설정에 없는 호실도 그냥 적어 넣는다 ── */
          <div className="space-y-3">
            {floors.length === 0 && (
              <p className="text-xs text-gray-400 leading-relaxed">
                아직 등록된 층·호실이 없습니다. 여기에 바로 적어 넣어도 되고,
                <br />설정 → 층·호실 관리에서 만들어두면 침대 그림으로 고를 수 있어요.
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">층</label>
              <input value={mFloor} onChange={e => setMFloor(e.target.value)} placeholder="예) 2층" className={inp} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">호실</label>
              <input value={mRoom} onChange={e => setMRoom(e.target.value)} placeholder="예) 201"
                className={inp} onKeyDown={e => { if (e.key === 'Enter') onPick(mFloor.trim(), mRoom.trim()) }} />
              <p className="text-[11px] text-gray-400 mt-1">숫자만 적으세요 — '호'는 화면에서 자동으로 붙습니다.</p>
            </div>
            <div className="flex gap-2 pt-1">
              {floors.length > 0 && (
                <button onClick={() => setManual(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-500">침대에서 고르기</button>
              )}
              <button onClick={() => onPick(mFloor.trim(), mRoom.trim())}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold">이 호실로 배정</button>
            </div>
          </div>
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
            <button onClick={() => setManual(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-xs font-bold text-gray-500 hover:bg-gray-50">
              <Pencil size={13} /> 직접 입력
            </button>
          </div>
        ) : (
          /* ── 2단계: 호실 — 침대 그림, 눌러서 배정 (만실은 확인 후 강행) ── */
          <div className="space-y-2">
            {floor.rooms.map((r: RoomInfo) => {
              const isCurrent = current?.room === r.room && current?.floor === floor.floor
              const full = r.free === 0 && !isCurrent
              return (
                <button key={r.id}
                  onClick={() => pick(floor.floor, r, isCurrent)}
                  title={full ? '만실 — 눌러서 확인 후 배정' : `${r.room}호에 배정`}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isCurrent ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-200'
                    : full ? 'border-gray-200 bg-gray-50 hover:border-amber-300 hover:bg-amber-50/50'
                    : 'border-gray-200 hover:border-green-400 hover:bg-green-50/40'}`}>
                  <span className="text-base font-extrabold text-gray-800 w-12">{r.room}호</span>
                  <span className="flex gap-1 flex-wrap">
                    {r.occupants.map((n, i) => <Bed key={`o${i}`} filled name={n} />)}
                    {Array.from({ length: r.free }).map((_, i) => <Bed key={`f${i}`} filled={false} />)}
                  </span>
                  <span className={`ml-auto text-xs font-bold ${r.free > 0 ? 'text-green-600' : 'text-amber-500'}`}>
                    {isCurrent ? '현재 방' : r.free > 0 ? `${r.free}자리` : '만실'}
                  </span>
                </button>
              )
            })}
            <button onClick={() => setManual(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-xs font-bold text-gray-500 hover:bg-gray-50">
              <Pencil size={13} /> 직접 입력
            </button>
            <p className="text-[11px] text-gray-400 text-center pt-1">
              빨간 침대 = 계신 자리 (이름은 침대에 마우스를 올리면) · 초록 침대 = 빈 자리
              <br />만실인 방도 확인 후 배정할 수 있어요 (자리 맞바꿈 등).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
