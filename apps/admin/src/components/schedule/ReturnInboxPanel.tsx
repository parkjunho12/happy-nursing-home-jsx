import { useEffect, useState } from 'react'
import { Home, Loader2, X } from 'lucide-react'
import { scheduleAPI, type ScheduleEvent } from '@/api/scheduleClient'
import { evalResidentsAPI } from '@/api/evalClient'

/**
 * 귀원 대기함 — 외출·외박·외래 나가신 어르신 중 아직 귀원 기록이 없는 분 목록.
 * 「지금 귀원」 한 번이면 끝, 시각이 다르면 시간만 고쳐서 기록.
 */
const CAT_CLS: Record<string, string> = {
  외출: 'bg-cyan-100 text-cyan-700', 외박: 'bg-indigo-100 text-indigo-700', '외래·병원': 'bg-rose-100 text-rose-700',
}
const nowHM = () => {
  const d = new Date(Date.now() + 9 * 3600e3)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export default function ReturnInboxPanel({ onClose, onRecorded }: { onClose: () => void; onRecorded: () => void }) {
  const [rows, setRows] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [times, setTimes] = useState<Record<string, string>>({})
  const [floorOf, setFloorOf] = useState<Record<string, string>>({})   // 어르신 이름 → 층
  const [floor, setFloor] = useState('')

  useEffect(() => {
    evalResidentsAPI.list().then((rows: any[]) => {
      const m: Record<string, string> = {}
      rows.forEach(r => { if (r.name && r.floor) m[r.name] = r.floor })
      setFloorOf(m)
    }).catch(() => {})
  }, [])
  const nameOf = (e: ScheduleEvent) => e.title.replace(/^\[[^\]]+\]\s*/, '').replace(/\s*어르신$/, '').trim()

  const load = () => {
    setLoading(true)
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    const start = new Date(Date.now() + 9 * 3600e3 - 14 * 86400e3).toISOString().slice(0, 10)
    scheduleAPI.events({ start_date: start, end_date: today })
      .then(evs => setRows(
        (evs as any[])
          .filter(e => ['외출', '외박', '외래·병원'].includes(e.category)
            && e.status !== 'canceled' && !e.returned_at
            && (e.start_at ?? '').slice(0, 10) <= today)
          .sort((a, b) => (a.start_at ?? '').localeCompare(b.start_at ?? ''))
      ))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const record = async (e: ScheduleEvent, time?: string) => {
    setBusy(e.id)
    try {
      const dateIso = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
      await scheduleAPI.markReturned(e.id, time ? { returned_at: `${dateIso}T${time}:00` } : {})
      setRows(prev => prev.filter(x => x.id !== e.id))
      onRecorded()
    } catch (err: any) { alert(err?.response?.data?.detail ?? '기록 실패') }
    finally { setBusy(null) }
  }

  const fmt = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <Home size={16} className="text-amber-500" />
          <h2 className="text-sm font-bold text-gray-800">귀원 대기 어르신</h2>
          {rows.length > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{rows.length}명</span>}
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">돌아오시면 「지금 귀원」 — 시각이 다르면 시간을 고쳐서 기록하세요.</p>

        {/* 층 필터 */}
        {rows.length > 0 && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {['', ...Array.from(new Set(rows.map(e => floorOf[nameOf(e)]).filter(Boolean))).sort()].map(f => (
              <button key={f || 'all'} type="button" onClick={() => setFloor(f as string)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${floor === f ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-500 border-gray-200'}`}>
                {f || '전체'}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">🏠</p>
            <p className="text-sm font-semibold text-green-600">모든 어르신 귀원 기록 완료!</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.filter(e => !floor || floorOf[nameOf(e)] === floor).map(e => {
              const days = Math.round((Date.now() - new Date(e.start_at!).getTime()) / 86400000)
              return (
                <li key={e.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CAT_CLS[e.category] ?? 'bg-gray-100 text-gray-500'}`}>{e.category}</span>
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {e.title.replace(/^\[[^\]]+\]\s*/, '')}
                      {floorOf[nameOf(e)] && <span className="ml-1 text-[10px] font-semibold text-gray-400">{floorOf[nameOf(e)]}</span>}
                    </p>
                    <span className="ml-auto text-[10px] text-gray-400 shrink-0">
                      출발 {fmt(e.start_at)}{days >= 1 && <b className="text-red-500"> · {days}일째</b>}
                    </span>
                  </div>
                  {e.end_at && <p className="text-[10px] text-gray-400 mb-1.5">예정 귀원 {fmt(e.end_at)}</p>}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => record(e)} disabled={busy === e.id}
                      className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-50">
                      {busy === e.id ? <Loader2 size={12} className="animate-spin mx-auto" /> : '🏠 지금 귀원'}
                    </button>
                    <input type="time" value={times[e.id] ?? nowHM()}
                      onChange={ev => setTimes(p => ({ ...p, [e.id]: ev.target.value }))}
                      className="w-[6.2rem] px-1.5 py-2 text-xs border border-gray-200 rounded-xl bg-white" />
                    <button onClick={() => record(e, times[e.id] ?? nowHM())} disabled={busy === e.id}
                      className="shrink-0 px-2.5 py-2 rounded-xl border border-green-200 text-green-700 text-xs font-bold hover:bg-green-50 disabled:opacity-50">
                      이 시각으로
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
