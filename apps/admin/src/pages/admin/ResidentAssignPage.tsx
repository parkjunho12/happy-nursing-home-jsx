import { useEffect, useMemo, useState } from 'react'
import { History, Loader2, Printer, Users, Wand2, X } from 'lucide-react'
import { assignmentAPI, type AssignRow, type StaffOpt, type AssignLog } from '@/api/assignmentClient'

/**
 * 담당 어르신 명단 — 엑셀 명단을 그대로 화면으로.
 * 층 탭 → 호실별 명단 → 담당 요양팀·재활팀을 그 자리에서 배정.
 * 자동 배정은 '빈 곳만, 가장 적게 맡은 사람에게' — 기존 담당은 안 건드린다.
 * 모든 변경은 히스토리에 남는다.
 */
const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

export default function ResidentAssignPage() {
  const [rows, setRows] = useState<AssignRow[]>([])
  const [care, setCare] = useState<StaffOpt[]>([])
  const [rehab, setRehab] = useState<StaffOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [floor, setFloor] = useState('')
  const [histOpen, setHistOpen] = useState(false)
  const [logs, setLogs] = useState<AssignLog[] | null>(null)
  const [autoBusy, setAutoBusy] = useState<'care' | 'rehab' | null>(null)

  const load = () => {
    assignmentAPI.roster()
      .then(r => {
        setRows(r.rows); setCare(r.care_staff); setRehab(r.rehab_staff)
        setFloor(f => f || (r.rows[0]?.floor ?? ''))
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const floors = useMemo(() => Array.from(new Set(rows.map(r => r.floor))).sort(), [rows])
  const shown = rows.filter(r => r.floor === floor)
  const today = todayISO()

  // 담당별 집계 — 균등한지 한눈에
  const counts = (key: 'care_staff_name' | 'rehab_staff_name', staff: StaffOpt[]) => {
    const m = new Map<string, number>(staff.map(s => [s.name, 0]))
    rows.forEach(r => { const n = r[key]; if (n) m.set(n, (m.get(n) ?? 0) + 1) })
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  const patch = (rid: string, p: Partial<AssignRow>) =>
    setRows(rs => rs.map(r => r.resident_id === rid ? { ...r, ...p } : r))

  const runAuto = async (kind: 'care' | 'rehab') => {
    const label = kind === 'care' ? '요양팀' : '재활팀'
    if (!confirm(`${label} 담당이 빈 어르신을 자동 배정할까요?\n(이미 배정된 어르신은 바뀌지 않습니다 — 가장 적게 맡은 선생님부터 채웁니다)`)) return
    setAutoBusy(kind)
    try {
      const r = await assignmentAPI.auto(kind)
      load()
      alert(`${label} ${r.assigned}명 배정 완료.\n\n담당 현황:\n${r.load.map(l => `  ${l.name} ${l.count}명`).join('\n')}`)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '자동 배정 실패') }
    finally { setAutoBusy(null) }
  }

  const openHist = async () => {
    setHistOpen(true); setLogs(null)
    try { setLogs(await assignmentAPI.logs(80)) } catch { setLogs([]) }
  }

  const sel = 'px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white w-full'
  const td = 'border border-gray-200 px-2 py-1.5 text-sm'

  // 호실 경계 — 같은 방 첫 행에만 호실 표시 (엑셀 명단과 같은 눈높이)
  let prevRoom = '__'

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="print:hidden">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Users size={20} className="text-teal-600" />
        <h1 className="text-xl font-bold text-gray-900">담당 어르신 명단</h1>
        <span className="text-sm text-gray-400">현원 <b className="text-gray-700">{rows.length}명</b>
          {rows.some(r => (r.admission_date ?? '') > today) && ` · 입소 예정 ${rows.filter(r => (r.admission_date ?? '') > today).length}명`}</span>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => runAuto('care')} disabled={!!autoBusy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-bold hover:bg-teal-100 disabled:opacity-50">
            {autoBusy === 'care' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} 요양팀 자동 배정
          </button>
          <button onClick={() => runAuto('rehab')} disabled={!!autoBusy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-bold hover:bg-indigo-100 disabled:opacity-50">
            {autoBusy === 'rehab' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} 재활팀 자동 배정
          </button>
          <button onClick={() => window.print()}
            title="층마다 한 장씩 — 담당·호실이 채워진 명단이 인쇄됩니다"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold">
            <Printer size={13} /> 인쇄
          </button>
          <button onClick={openHist}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50">
            <History size={13} /> 변경 이력
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">담당을 바꾸면 바로 저장되고 이력이 남습니다 · 빈칸만 자동 배정(기존 담당 유지)</p>

      {/* 담당별 집계 — 몇 명씩 맡고 있는지 */}
      <div className="flex flex-wrap gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <span className="font-bold text-teal-700 mr-0.5">요양팀</span>
          {counts('care_staff_name', care).map(([n, c]) => (
            <span key={n} className={`px-1.5 py-0.5 rounded border ${c === 0 ? 'bg-gray-50 text-gray-300 border-gray-100' : 'bg-teal-50 text-teal-700 border-teal-100 font-semibold'}`}>{n} {c}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <span className="font-bold text-indigo-700 mr-0.5">재활팀</span>
          {counts('rehab_staff_name', rehab).map(([n, c]) => (
            <span key={n} className={`px-1.5 py-0.5 rounded border ${c === 0 ? 'bg-gray-50 text-gray-300 border-gray-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100 font-semibold'}`}>{n} {c}</span>
          ))}
        </div>
      </div>

      {/* 층 탭 */}
      <div className="flex gap-1.5 mb-3">
        {floors.map(f => (
          <button key={f} onClick={() => setFloor(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${floor === f ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200'}`}>
            {f} <span className="text-[11px] font-semibold opacity-70">{rows.filter(r => r.floor === f).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse min-w-[720px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50">
                <th className={`${td} w-16 text-center text-xs font-bold text-gray-500`}>호실</th>
                <th className={`${td} w-24 text-xs font-bold text-gray-500`}>성함</th>
                <th className={`${td} w-36 text-xs font-bold text-teal-700`}>담당 요양팀</th>
                <th className={`${td} w-36 text-xs font-bold text-indigo-700`}>담당 재활팀</th>
                <th className={`${td} text-xs font-bold text-gray-500`}>기타</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const first = r.room !== prevRoom
                prevRoom = r.room
                const incoming = (r.admission_date ?? '') > today
                return (
                  <tr key={r.resident_id} className={`${first ? 'border-t-2 border-t-gray-300' : ''} ${incoming ? 'bg-amber-50/40' : ''}`}>
                    <td className={`${td} text-center font-extrabold text-gray-700`}>
                      <input defaultValue={r.room}
                        onBlur={async e => { const v = e.target.value.trim(); if (v !== r.room) { await assignmentAPI.setRoom(r.resident_id, v); patch(r.resident_id, { room: v }) } }}
                        className="w-12 text-center font-extrabold text-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-teal-200 rounded"
                        placeholder="-" />
                    </td>
                    <td className={`${td} font-bold text-gray-800`}>
                      {r.name}
                      {incoming && <span className="ml-1 text-[10px] font-bold text-amber-600">{Number(r.admission_date!.slice(5, 7))}/{Number(r.admission_date!.slice(8, 10))} 입소</span>}
                    </td>
                    <td className={td}>
                      <select value={r.care_staff_id ?? ''} className={sel}
                        onChange={async e => {
                          const v = e.target.value || null
                          await assignmentAPI.setCare(r.resident_id, v)
                          patch(r.resident_id, { care_staff_id: v, care_staff_name: care.find(s => s.id === v)?.name ?? null })
                        }}>
                        <option value="">미배정</option>
                        {care.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className={td}>
                      <select value={r.rehab_staff_id ?? ''} className={sel}
                        onChange={async e => {
                          const v = e.target.value || null
                          await assignmentAPI.setRehab(r.resident_id, v)
                          patch(r.resident_id, { rehab_staff_id: v, rehab_staff_name: rehab.find(s => s.id === v)?.name ?? null })
                        }}>
                        <option value="">미배정</option>
                        {rehab.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className={td}>
                      <input defaultValue={r.note ?? ''} placeholder="메모"
                        onBlur={async e => { const v = e.target.value; if (v !== (r.note ?? '')) { await assignmentAPI.setNote(r.resident_id, v); patch(r.resident_id, { note: v }) } }}
                        className="w-full text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-gray-200 rounded px-1 py-0.5" />
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-sm text-gray-400">이 층에 재원 어르신이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      </div>{/* /print:hidden */}

      {/* ── 인쇄 전용 — 층마다 한 장, 셀렉트 대신 글자로 ── */}
      <div className="hidden print:block">
        {floors.map(f => {
          const list = rows.filter(r => r.floor === f)
          let pv = '__'
          return (
            <div key={f} className="asg-print-page">
              <h1 className="text-center text-xl font-extrabold tracking-widest mb-1">담당 어르신 명단</h1>
              <p className="text-center text-sm font-bold mb-2">&lt; {f} &gt; · 현원 {list.length}명 · {new Date().toLocaleDateString('ko-KR')}</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['호실', '성함', '담당 요양팀', '담당 재활팀', '기타'].map(h => (
                      <th key={h} className="border border-gray-800 bg-gray-100 px-2 py-1.5 text-[11px] font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => {
                    const first = r.room !== pv
                    pv = r.room
                    const incoming = (r.admission_date ?? '') > today
                    return (
                      <tr key={r.resident_id} className={first ? 'asg-room-top' : ''}>
                        <td className="border border-gray-700 px-2 py-1.5 text-center text-sm font-extrabold">{first ? r.room : ''}</td>
                        <td className="border border-gray-700 px-2 py-1.5 text-sm font-bold">{r.name}</td>
                        <td className="border border-gray-700 px-2 py-1.5 text-sm text-center">{r.care_staff_name ?? ''}</td>
                        <td className="border border-gray-700 px-2 py-1.5 text-sm text-center">{r.rehab_staff_name ?? ''}</td>
                        <td className="border border-gray-700 px-2 py-1.5 text-xs">{[incoming ? `${Number(r.admission_date!.slice(5, 7))}/${Number(r.admission_date!.slice(8, 10))} 입소 예정` : '', r.note ?? ''].filter(Boolean).join(' · ')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          .asg-print-page { page-break-after: always; }
          .asg-print-page:last-child { page-break-after: auto; }
          .asg-room-top td { border-top: 2px solid #111 !important; }
          .asg-print-page th, .asg-print-page td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* 변경 이력 */}
      {histOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setHistOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <History size={15} className="text-gray-500" />
              <h2 className="text-sm font-bold text-gray-800">담당 변경 이력</h2>
              <button onClick={() => setHistOpen(false)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            {logs === null ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={16} /></div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">아직 변경 이력이 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {logs.map(l => (
                  <li key={l.id} className="text-xs text-gray-600 border-b border-gray-50 pb-1.5">
                    <b className="text-gray-800">{l.resident_name}</b> · {l.field}:{' '}
                    <span className="text-gray-400">{l.before ?? '없음'}</span> → <b>{l.after ?? '없음'}</b>
                    <span className="block text-[10px] text-gray-300">
                      {l.changed_by ?? ''} · {l.at ? new Date(l.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
