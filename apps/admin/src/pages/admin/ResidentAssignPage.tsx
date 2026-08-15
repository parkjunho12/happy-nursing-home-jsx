import { useEffect, useMemo, useState } from 'react'
import { History, Loader2, Printer, Search, Users, Wand2, X } from 'lucide-react'
import { assignmentAPI, type AssignRow, type StaffOpt, type AssignLog } from '@/api/assignmentClient'
import RoomPicker from '@/components/eval/RoomPicker'

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

  const td = 'border-b border-gray-100 px-2.5 py-2 text-sm'

  // ── 담당 선택 피커 — 드롭다운 대신 검색 + 담당 수가 보이는 목록 ──
  const [pick, setPick] = useState<{ rid: string; kind: 'care' | 'rehab'; name: string } | null>(null)
  const [pickQ, setPickQ] = useState('')
  const openPick = (rid: string, kind: 'care' | 'rehab', name: string) => { setPick({ rid, kind, name }); setPickQ('') }
  const loadOf = (kind: 'care' | 'rehab') => {
    const key = kind === 'care' ? 'care_staff_name' : 'rehab_staff_name'
    const m = new Map<string, number>()
    rows.forEach(r => { const n = (r as any)[key]; if (n) m.set(n, (m.get(n) ?? 0) + 1) })
    return m
  }
  const doPick = async (staffId: string | null, staffName: string | null) => {
    if (!pick) return
    const { rid, kind } = pick
    setPick(null)
    if (kind === 'care') {
      await assignmentAPI.setCare(rid, staffId)
      patch(rid, { care_staff_id: staffId, care_staff_name: staffName })
    } else {
      await assignmentAPI.setRehab(rid, staffId)
      patch(rid, { rehab_staff_id: staffId, rehab_staff_name: staffName })
    }
  }

  // ── 호실 변경 — 침대 그림으로 고르고 바로 저장 (배정 해제도 여기서) ──
  const [bed, setBed] = useState<AssignRow | null>(null)
  const [bedBusy, setBedBusy] = useState<string | null>(null)
  const changeBed = async (row: AssignRow, f: string, room: string, force?: boolean) => {
    setBed(null); setBedBusy(row.resident_id)
    try {
      await assignmentAPI.setBed(row.resident_id, f, room, force)
      load()   // 호실 순 정렬·방 구분선·층 탭까지 다시 맞춘다
    } catch (e: any) {
      // 정원 초과(409)만은 그 자리에서 확인받고 강행 (직접 입력한 호실 포함)
      const detail = e?.response?.data?.detail
      if (e?.response?.status === 409 && confirm(`${detail}\n\n그래도 이 방으로 배정할까요?`)) {
        try { await assignmentAPI.setBed(row.resident_id, f, room, true); load() }
        catch (e2: any) { alert(e2?.response?.data?.detail ?? e2?.message ?? '호실 변경에 실패했습니다.') }
      } else if (e?.response?.status !== 409) {
        alert(detail ?? e?.message ?? '호실 변경에 실패했습니다.')
      }
    } finally { setBedBusy(null) }
  }

  // 호실 경계 — 같은 방 첫 행에만 호실 표시 (엑셀 명단과 같은 눈높이)
  let prevRoom = '__'

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="print:hidden">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Users size={20} className="text-teal-600" />
        <h1 className="text-xl font-bold text-gray-900">담당 어르신 명단</h1>
        {(() => {
          const incoming = rows.filter(r => (r.admission_date ?? '') > today).length
          return (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-100">현원 {rows.length - incoming}명</span>
              {incoming > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-100">입소 예정 {incoming}명</span>}
            </span>
          )
        })()}
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
      <p className="text-xs text-gray-400 mb-3">담당·호실을 바꾸면 바로 저장되고 이력이 남습니다 · 호실 숫자를 누르면 침대 그림에서 고르거나 배정을 해제할 수 있어요 · 빈칸만 자동 배정(기존 담당 유지)</p>

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
                    <td className={`${td} text-center`}>
                      <button onClick={() => setBed(r)} disabled={bedBusy === r.resident_id}
                        title="눌러서 호실 변경 · 배정 해제"
                        className={`w-12 text-center font-extrabold rounded-lg py-0.5 transition-colors ${
                          !r.room ? 'text-gray-300 border border-dashed border-gray-300 hover:border-teal-400 hover:text-teal-500'
                          : first ? 'bg-gray-800 text-white hover:bg-teal-600'
                          : 'text-gray-300 bg-transparent hover:bg-gray-100 hover:text-gray-500'}`}>
                        {bedBusy === r.resident_id
                          ? <Loader2 size={12} className="animate-spin mx-auto" />
                          : (r.room || '-')}
                      </button>
                    </td>
                    <td className={`${td} font-bold text-gray-800`}>
                      {r.name}
                      {incoming && <span className="ml-1 text-[10px] font-bold text-amber-600">{Number(r.admission_date!.slice(5, 7))}/{Number(r.admission_date!.slice(8, 10))} 입소</span>}
                    </td>
                    <td className={td}>
                      <button onClick={() => openPick(r.resident_id, 'care', r.name)}
                        className={`w-full px-2 py-1.5 text-xs rounded-lg border text-left font-semibold transition-colors ${
                          r.care_staff_name ? 'border-teal-100 bg-teal-50/60 text-teal-800 hover:bg-teal-50' : 'border-dashed border-gray-300 text-gray-400 hover:border-teal-300'}`}>
                        {r.care_staff_name ?? '+ 배정'}
                      </button>
                    </td>
                    <td className={td}>
                      <button onClick={() => openPick(r.resident_id, 'rehab', r.name)}
                        className={`w-full px-2 py-1.5 text-xs rounded-lg border text-left font-semibold transition-colors ${
                          r.rehab_staff_name ? 'border-indigo-100 bg-indigo-50/60 text-indigo-800 hover:bg-indigo-50' : 'border-dashed border-gray-300 text-gray-400 hover:border-indigo-300'}`}>
                        {r.rehab_staff_name ?? '+ 배정'}
                      </button>
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
          const cur = list.filter(r => (r.admission_date ?? '') <= today).length
          const incom = list.length - cur
          // 호실 바뀔 때마다 음영 교차 — 방 단위가 한눈에 들어온다
          let pv = '__'; let band = 0
          const dense = list.length >= 25       // 인원이 많으면 자동으로 촘촘하게 (34명도 1장)
          const careSum = (() => { const m2 = new Map<string, number>(); list.forEach(r => { if (r.care_staff_name) m2.set(r.care_staff_name, (m2.get(r.care_staff_name) ?? 0) + 1) }); return [...m2.entries()].sort((a, b) => b[1] - a[1]) })()
          const rehabSum = (() => { const m2 = new Map<string, number>(); list.forEach(r => { if (r.rehab_staff_name) m2.set(r.rehab_staff_name, (m2.get(r.rehab_staff_name) ?? 0) + 1) }); return [...m2.entries()].sort((a, b) => b[1] - a[1]) })()
          return (
            <div key={f} className="asg-print-page">
              {/* 머리글 */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '3px solid #0d9488', paddingBottom: dense ? '5px' : '8px', marginBottom: dense ? '6px' : '10px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: '#0d9488', letterSpacing: '0.2em', margin: 0 }}>행복한요양원 · 정성으로 모시겠습니다</p>
                  <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#111827', margin: '2px 0 0', letterSpacing: '0.08em' }}>담당 어르신 명단</h1>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 10, background: '#0d9488', color: 'white', fontSize: '18px', fontWeight: 900 }}>{f}</span>
                  <p style={{ fontSize: '9.5px', color: '#6b7280', margin: '4px 0 0' }}>
                    현원 <b style={{ color: '#111827' }}>{cur}명</b>{incom > 0 && <> · 입소 예정 <b style={{ color: '#b45309' }}>{incom}명</b></>} · 출력 {new Date().toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </div>
              {/* 명단 표 */}
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '14%' }} /><col style={{ width: '22%' }} />
                  <col style={{ width: '21%' }} /><col style={{ width: '21%' }} /><col style={{ width: '22%' }} />
                </colgroup>
                <thead>
                  <tr>
                    {['호실', '성함', '담당 요양팀', '담당 재활팀', '기타'].map(h => (
                      <th key={h} style={{
                        border: '1px solid #99f6e4', background: '#ccfbf1', color: '#115e59',
                        padding: dense ? '3px 4px' : '6px 4px', fontSize: dense ? '10px' : '11px', fontWeight: 800,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => {
                    const first = r.room !== pv
                    if (first) { pv = r.room; band += 1 }
                    const incoming = (r.admission_date ?? '') > today
                    const bg = incoming ? '#fffbeb' : band % 2 === 0 ? '#f8fafc' : 'white'
                    const cell: React.CSSProperties = {
                      border: '1px solid #e2e8f0', background: bg, lineHeight: 1.25,
                      padding: dense ? '2px 6px' : '5px 7px', fontSize: dense ? '11px' : '12.5px',
                    }
                    return (
                      <tr key={r.resident_id} className={first ? 'asg-room-top' : ''}>
                        <td style={{ ...cell, textAlign: 'center' }}>
                          {first && <span style={{
                            display: 'inline-block', minWidth: 40, borderRadius: 8,
                            background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e',
                            padding: dense ? '1px 6px' : '2px 8px',
                            fontSize: dense ? '11px' : '13px', fontWeight: 900,
                          }}>{r.room}호</span>}
                        </td>
                        <td style={{ ...cell, fontWeight: 800, color: '#111827' }}>
                          {r.name}
                          {incoming && <span style={{ marginLeft: 5, fontSize: '9px', fontWeight: 800, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '1px 5px', verticalAlign: 'middle' }}>입소 예정</span>}
                        </td>
                        <td style={{ ...cell, textAlign: 'center', color: '#334155' }}>{r.care_staff_name ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                        <td style={{ ...cell, textAlign: 'center', color: '#334155' }}>{r.rehab_staff_name ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                        <td style={{ ...cell, fontSize: dense ? '9.5px' : '10.5px', color: '#64748b' }}>
                          {[incoming ? `${Number(r.admission_date!.slice(5, 7))}/${Number(r.admission_date!.slice(8, 10))} 입소` : '', r.note ?? ''].filter(Boolean).join(' · ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {/* 담당별 인원 요약 — 균형이 종이에서도 보이게 */}
              <div style={{ display: 'flex', gap: '8px', marginTop: dense ? '6px' : '10px' }}>
                {[['요양팀', careSum, '#0d9488', '#f0fdfa', '#99f6e4'] as const, ['재활팀', rehabSum, '#7c3aed', '#faf5ff', '#ddd6fe'] as const].map(([label, sum, c, bg2, bd]) => (
                  <div key={label} style={{ flex: 1, border: `1px solid ${bd}`, background: bg2, borderRadius: 10, padding: dense ? '4px 8px' : '6px 10px' }}>
                    <p style={{ fontSize: dense ? '9px' : '10px', fontWeight: 900, color: c, margin: '0 0 2px' }}>{label} 담당 현황</p>
                    <p style={{ fontSize: dense ? '9px' : '10px', color: '#374151', margin: 0, lineHeight: 1.6 }}>
                      {sum.length === 0 ? '미배정' : sum.map(([n, c2]) => (
                        <span key={n} style={{ display: 'inline-block', marginRight: 8, whiteSpace: 'nowrap' }}>
                          {n} <b style={{ color: c }}>{c2}명</b>
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '8.5px', color: '#9ca3af', textAlign: 'right', margin: '6px 2px 0' }}>
                ※ 담당 변경은 관리자 페이지 「담당 어르신 명단」에서 — 변경 이력이 함께 남습니다 · 행복한요양원
              </p>
            </div>
          )
        })}
      </div>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          .asg-print-page { page-break-after: always; }
          .asg-print-page:last-child { page-break-after: auto; }
          .asg-room-top td { border-top: 2px solid #5eead4 !important; }
          .asg-print-page * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .asg-print-page { break-inside: avoid; }
          .asg-print-page tr { break-inside: avoid; }
        }
      `}</style>

      {/* 호실 변경 — 침대 그림에서 고르면 바로 저장 ('배정 해제'도 이 안에) */}
      {bed && (
        <RoomPicker
          current={{ floor: bed.floor === '미지정' ? '' : bed.floor, room: bed.room }}
          onClose={() => setBed(null)}
          onPick={(f, room, force) => changeBed(bed, f, room, force)} />
      )}

      {/* 담당 선택 — 검색 + 담당 수 보이는 원클릭 배정 */}
      {pick && (() => {
        const list = pick.kind === 'care' ? care : rehab
        const loads = loadOf(pick.kind)
        const filtered = list.filter(s2 => !pickQ || s2.name.includes(pickQ))
        const hoverCls = pick.kind === 'care'
          ? 'hover:bg-teal-50 hover:border-teal-200'
          : 'hover:bg-indigo-50 hover:border-indigo-200'
        return (
          <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4" onClick={() => setPick(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs max-h-[70vh] overflow-y-auto p-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-gray-800">{pick.name} — 담당 {pick.kind === 'care' ? '요양팀' : '재활팀'}</h3>
                <button onClick={() => setPick(null)} className="ml-auto text-gray-300"><X size={16} /></button>
              </div>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input autoFocus value={pickQ} onChange={e => setPickQ(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && filtered.length === 1) doPick(filtered[0].id, filtered[0].name)
                    if (e.key === 'Escape') setPick(null)
                  }}
                  placeholder="이름 검색 — 한 명 남으면 Enter"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div className="space-y-1">
                <button onClick={() => doPick(null, null)}
                  className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-gray-400 hover:bg-gray-50 border border-transparent">
                  미배정으로
                </button>
                {filtered.map(s2 => {
                  const n = loads.get(s2.name) ?? 0
                  return (
                    <button key={s2.id} onClick={() => doPick(s2.id, s2.name)}
                      className={`w-full flex items-center gap-1.5 px-3 py-2 rounded-xl text-left text-sm font-semibold text-gray-700 border border-transparent ${hoverCls}`}>
                      {s2.name}
                      {s2.pending && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1 py-0.5 rounded"
                          title={s2.hire_date ? `입사 예정 ${s2.hire_date}` : '입사 예정'}>
                          {s2.hire_date ? `${Number(s2.hire_date.slice(5, 7))}/${Number(s2.hire_date.slice(8, 10))} 입사` : '입사 예정'}
                        </span>
                      )}
                      <span className={`ml-auto text-[11px] font-bold ${n === 0 ? 'text-green-600' : n >= 4 ? 'text-red-400' : 'text-gray-400'}`}>{n}명 담당</span>
                    </button>
                  )
                })}
                {filtered.length === 0 && <p className="text-xs text-gray-300 text-center py-4">검색 결과 없음</p>}
              </div>
            </div>
          </div>
        )
      })()}

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
