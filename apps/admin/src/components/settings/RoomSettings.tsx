import { useEffect, useMemo, useState } from 'react'
import { BedDouble, Plus, Trash2 } from 'lucide-react'
import { roomAPI, type RoomConfigRow } from '@/api/roomClient'

/** 층·호실 관리 — 시설 구조를 자유롭게 정의 (층 이름, 호실, 침대 수) */
export default function RoomSettings() {
  const [rows, setRows] = useState<RoomConfigRow[]>([])
  const [nf, setNf] = useState({ floor: '2층', room: '', capacity: 4 })

  const load = () => { roomAPI.list().then(setRows).catch(() => setRows([])) }
  useEffect(load, [])

  const byFloor = useMemo(() => {
    const m = new Map<string, RoomConfigRow[]>()
    rows.forEach(r => { const a = m.get(r.floor) ?? []; a.push(r); m.set(r.floor, a) })
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const add = async () => {
    if (!nf.room.trim()) { alert('호실명을 입력해주세요. (예: 201)'); return }
    try { await roomAPI.create(nf); setNf(p => ({ ...p, room: '' })); load() }
    catch (e: any) { alert(e?.response?.data?.detail ?? '추가 실패') }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <BedDouble size={16} className="text-teal-600" />
        <h2 className="text-base font-bold text-gray-800">층 · 호실 관리</h2>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        여기 정의한 방·침대 수가 어르신 등록의 침대 선택 화면이 됩니다. 정원 = 그 방 침대 수.
      </p>

      <div className="flex items-end gap-1.5 mb-4 flex-wrap">
        <label className="text-xs text-gray-500">층
          <input value={nf.floor} onChange={e => setNf({ ...nf, floor: e.target.value })}
            className="block w-20 px-2 py-2 text-sm border border-gray-200 rounded-lg mt-1" placeholder="2층" />
        </label>
        <label className="text-xs text-gray-500">호실
          <input value={nf.room} onChange={e => setNf({ ...nf, room: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && add()}
            className="block w-20 px-2 py-2 text-sm border border-gray-200 rounded-lg mt-1" placeholder="201" />
        </label>
        <label className="text-xs text-gray-500">침대 수
          <input type="number" min={1} max={12} value={nf.capacity}
            onChange={e => setNf({ ...nf, capacity: Number(e.target.value) })}
            className="block w-20 px-2 py-2 text-sm border border-gray-200 rounded-lg mt-1" />
        </label>
        <button onClick={add}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold">
          <Plus size={14} /> 호실 추가
        </button>
      </div>

      {byFloor.length === 0 ? (
        <p className="text-sm text-gray-300 text-center py-6">아직 등록된 호실이 없습니다</p>
      ) : byFloor.map(([floor, list]) => (
        <div key={floor} className="mb-3">
          <p className="text-xs font-extrabold text-gray-500 mb-1.5">{floor}
            <span className="font-normal text-gray-400 ml-1.5">
              {list.length}개 호실 · 침대 {list.reduce((n, r) => n + r.capacity, 0)}개
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...list].sort((a, b) => a.room.localeCompare(b.room)).map(r => (
              <span key={r.id} className="inline-flex items-center gap-1.5 border border-gray-200 rounded-xl pl-3 pr-1.5 py-1.5 text-sm">
                <b className="text-gray-800">{r.room}호</b>
                <input type="number" min={1} max={12} defaultValue={r.capacity}
                  title="침대 수 — 바꾸면 바로 저장"
                  onBlur={async e => {
                    const v = Number(e.target.value)
                    if (v !== r.capacity && v >= 1) {
                      try { await roomAPI.update(r.id, { floor: r.floor, room: r.room, capacity: v }); load() }
                      catch (er: any) { alert(er?.response?.data?.detail ?? '저장 실패') }
                    }
                  }}
                  className="w-12 px-1 py-0.5 text-xs text-center border border-gray-100 rounded-lg" />
                <span className="text-[10px] text-gray-400">침대</span>
                <button onClick={async () => { if (confirm(`${floor} ${r.room}호를 삭제할까요?`)) { await roomAPI.remove(r.id); load() } }}
                  className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
