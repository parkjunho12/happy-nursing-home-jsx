import { useEffect, useMemo, useState } from 'react'
import { History, Loader2, Printer, Search, Users, Wand2, X, StickyNote, Check, CalendarClock } from 'lucide-react'
import { assignmentAPI, type AssignRow, type StaffOpt, type AssignLog, type AssignNote, type SnapDay } from '@/api/assignmentClient'
import RoomPicker from '@/components/eval/RoomPicker'
import { useLtcStore } from '@/store/ltc'

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
  // 명단에 함께 붙는 메모 — 어르신 한 분이 아니라 다 같이 알아야 하는 것
  const [note, setNote] = useState<AssignNote | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)
  // 그날 명단 보기 — null 이면 지금 명단(고칠 수 있는 상태)
  const [days, setDays] = useState<SnapDay[]>([])
  const [viewDate, setViewDate] = useState<string | null>(null)
  const [snapRows, setSnapRows] = useState<AssignRow[] | null>(null)
  const [snapMemo, setSnapMemo] = useState('')
  const [snapBusy, setSnapBusy] = useState(false)
  // 한 층이 한 화면에 들어와야 한다. 늘 보지 않아도 되는 것은 접어 둔다.
  const [countOpen, setCountOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const load = () => {
    assignmentAPI.roster()
      .then(r => {
        setRows(r.rows); setCare(r.care_staff); setRehab(r.rehab_staff)
        setFloor(f => f || (r.rows[0]?.floor ?? ''))
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  // 지난 날을 보는 중이면 그날 명단을, 아니면 지금 명단을 그린다
  const base = snapRows ?? rows
  const floors = useMemo(() => Array.from(new Set(base.map(r => r.floor))).sort(), [base])
  const shown = base.filter(r => r.floor === floor)
  /** 방별로 묶는다 — 화면은 방 카드 격자로 그린다.
   *  호실이 없는 분은 맨 뒤에 '미배정' 으로 모은다. 빠뜨리면 그분만 안 보인다. */
  const roomCards = useMemo(() => {
    const m = new Map<string, typeof shown>()
    for (const r of shown) {
      const k = r.room || '미배정'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    return [...m.entries()].sort((a, b) =>
      a[0] === '미배정' ? 1 : b[0] === '미배정' ? -1 : a[0].localeCompare(b[0], 'ko', { numeric: true }))
  }, [shown])
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


  // ── 담당 선택 피커 — 드롭다운 대신 검색 + 담당 수가 보이는 목록 ──
  const loadNote = () => assignmentAPI.note()
    .then(n => { setNote(n); setNoteDraft(n.content) })
    .catch(() => setNote(null))
  useEffect(() => { loadNote() }, [])

  const loadDays = () => assignmentAPI.snapshots()
    .then(d => setDays(d.days)).catch(() => setDays([]))
  useEffect(() => { loadDays() }, [])

  /** 그날 탭을 누르면 그날 명단으로 바꿔 보여준다. 고칠 수는 없다 —
   *  지난 날 기록을 고치면 그건 더 이상 그날 모습이 아니다. */
  const openDay = async (d: string | null) => {
    if (d === null) { setViewDate(null); setSnapRows(null); return }
    setSnapBusy(true)
    try {
      const s2 = await assignmentAPI.snapshot(d)
      setSnapRows(s2.rows); setSnapMemo(s2.memo); setViewDate(d)
    } catch { alert('그날 기록을 불러오지 못했습니다.') }
    finally { setSnapBusy(false) }
  }
  const past = viewDate !== null

  const saveNote = async () => {
    setNoteBusy(true)
    try { const n = await assignmentAPI.saveNote(noteDraft); setNote(n); setNoteDraft(n.content) }
    catch (e: any) { alert(e?.response?.data?.detail ?? '메모를 저장하지 못했습니다') }
    finally { setNoteBusy(false) }
  }

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
      // 여기서 바꾼 호실은 수급자 스토어를 거치지 않는다 — 수급자 관리·서류현황이 옛 호실을 들고 있지 않게
      useLtcStore.getState().invalidate()
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
      <p className="text-[11px] text-gray-400 mb-2">바꾸면 바로 저장되고 이력이 남습니다 · 호실을 누르면 침대에서 고르거나 배정을 해제할 수 있어요</p>

      {/* 담당별 집계 — 늘 보는 것이 아니라 접어 둔다. 그 자리를 명단에 쓴다. */}
      <button onClick={() => setCountOpen(o => !o)}
        className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700">
        담당별 인원 {countOpen ? '접기 ▴' : '보기 ▾'}
      </button>
      <div className={`${countOpen ? 'flex' : 'hidden'} flex-wrap gap-3 mb-2`}>
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

      {/* ── 날짜 탭 ──
          명단이 바뀐 날마다 한 장씩 남는다. 눌러서 그날 모습을 본다.
          '지금' 은 고칠 수 있고, 지난 날은 볼 수만 있다 — 지난 기록을
          고치면 그건 더 이상 그날 모습이 아니다. */}
      {days.length > 0 && (
        <div className="mb-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            <CalendarClock size={13} className="text-gray-400" />
            <span className="text-[11px] text-gray-400 mr-0.5" title="명단이 바뀐 날 — 눌러서 그날 명단을 봅니다">바뀐 날</span>
            {snapBusy && <Loader2 size={12} className="animate-spin text-gray-300" />}
            <button onClick={() => openDay(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                !past ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              지금
            </button>
            {days.map(d => {
              const [, mo, da] = d.date.split('-')
              return (
                <button key={d.date} onClick={() => openDay(d.date)}
                  title={`${d.date} · ${d.count}명${d.changed_by ? ` · ${d.changed_by}` : ''}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    viewDate === d.date ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200 hover:border-teal-400'}`}>
                  {Number(mo)}/{Number(da)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {past && (
        <p className="mb-3 text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
          <CalendarClock size={14} className="shrink-0" />
          <span>
            <b>{viewDate}</b>의 명단을 보고 있습니다 — 지난 기록이라 고칠 수 없습니다.
            고치시려면 <b>지금</b>을 눌러주세요.
          </span>
        </p>
      )}

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
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : (
        /* ── 방별 카드 ──
           한 층이 열 개 방·서른 몇 명이라, 한 줄짜리 표로 늘어놓으면 화면을
           벗어나 스크롤을 해야 한다. 방마다 카드로 묶어 격자로 놓으면
           한 층이 한눈에 들어온다 — 실제 층 구조와도 같은 모양이다.
           (인쇄물은 예전 표 그대로다. A4 에 맞춰 실측해 둔 것이라 안 건드린다) */
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {roomCards.map(([room, list]) => (
            <div key={room} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <button onClick={() => !past && list[0] && setBed(list[0])} disabled={past}
                  title={past ? '지난 날 기록은 고칠 수 없습니다' : '눌러서 호실 변경 · 배정 해제'}
                  className={`px-1.5 py-0.5 rounded-md text-xs font-extrabold ${
                    room === '미배정' ? 'text-gray-400 border border-dashed border-gray-300'
                    : 'bg-gray-800 text-white'} ${past ? '' : 'hover:bg-teal-600'}`}>
                  {list.some(x => bedBusy === x.resident_id)
                    ? <Loader2 size={11} className="animate-spin mx-auto" />
                    : (room === '미배정' ? '호실 없음' : room)}
                </button>
                <span className="text-[10px] text-gray-400">{list.length}명</span>
              </div>

              <div className="divide-y divide-gray-50">
                {list.map(r => {
                  const incoming = (r.admission_date ?? '') > today
                  return (
                    <div key={r.resident_id} className={`px-2 py-1 ${incoming ? 'bg-amber-50/50' : ''}`}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => !past && setBed(r)} disabled={past}
                          className="text-[13px] font-bold text-gray-800 truncate hover:text-teal-700 disabled:hover:text-gray-800">
                          {r.name}
                        </button>
                        {incoming && (
                          <span className="text-[9px] font-bold text-amber-600 shrink-0">
                            {Number(r.admission_date!.slice(5, 7))}/{Number(r.admission_date!.slice(8, 10))} 입소
                          </span>
                        )}
                        <input key={`${viewDate ?? 'now'}-${r.resident_id}`}
                          defaultValue={r.note ?? ''} placeholder={past ? '' : '메모'} readOnly={past}
                          onBlur={async e => { if (past) return; const v = e.target.value; if (v !== (r.note ?? '')) { await assignmentAPI.setNote(r.resident_id, v); patch(r.resident_id, { note: v }) } }}
                          className="ml-auto w-16 shrink-0 text-[10px] text-right bg-transparent text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-200 rounded px-1" />
                      </div>
                      <div className="flex gap-1 mt-0.5">
                        <button onClick={() => !past && openPick(r.resident_id, 'care', r.name)} disabled={past}
                          title="담당 요양팀"
                          className={`flex-1 min-w-0 truncate px-1.5 py-0.5 text-[11px] rounded-md border font-semibold transition-colors ${
                            r.care_staff_name ? 'border-teal-100 bg-teal-50/60 text-teal-800 hover:bg-teal-50'
                            : 'border-dashed border-gray-300 text-gray-400 hover:border-teal-300'}`}>
                          {r.care_staff_name ?? '+ 요양'}
                        </button>
                        <button onClick={() => !past && openPick(r.resident_id, 'rehab', r.name)} disabled={past}
                          title="담당 재활팀"
                          className={`flex-1 min-w-0 truncate px-1.5 py-0.5 text-[11px] rounded-md border font-semibold transition-colors ${
                            r.rehab_staff_name ? 'border-indigo-100 bg-indigo-50/60 text-indigo-800 hover:bg-indigo-50'
                            : 'border-dashed border-gray-300 text-gray-400 hover:border-indigo-300'}`}>
                          {r.rehab_staff_name ?? '+ 재활'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {roomCards.length === 0 && (
            <p className="col-span-full text-center py-12 text-sm text-gray-400">이 층에 재원 어르신이 없습니다</p>
          )}
        </div>
      )}

      </div>{/* /print:hidden */}

      {/* ── 인쇄 전용 — 층마다 한 장, 셀렉트 대신 글자로 ── */}
      <div className="hidden print:block">
        {floors.map(f => {
          const list = rows.filter(r => r.floor === f)
          const cur = list.filter(r => (r.admission_date ?? '') <= today).length
          const incom = list.length - cur

          // 37명이 넘으면 한 장에 욱여넣지 않고 장을 나눈다.
          // 억지로 한 장에 담으면 글자가 11px까지 떨어져 벽에 붙여도 안 보인다.
          // 나눌 때는 균등하게 — 마지막 장에 두세 명만 남으면 보기 안 좋다.
          const PER_PAGE_MAX = 36
          const pageCount = Math.max(1, Math.ceil(list.length / PER_PAGE_MAX))
          const perPage = Math.ceil(list.length / pageCount)
          const chunks = Array.from({ length: pageCount },
            (_, i) => list.slice(i * perPage, (i + 1) * perPage))

          return chunks.map((chunk, ci) => {
          // 호실 바뀔 때마다 음영 교차 — 방 단위가 한눈에 들어온다
          let pv = '__'; let band = 0
          // 한 장(A4)에 들어가는 선에서 최대한 크게. 인원이 적을수록 더 키운다.
          // 현장에서 벽에 붙여놓고 멀리서 보는 표라 글자 크기가 곧 쓸모다.
          // 크기는 A4 한 장 기준으로 실제 인쇄해 재서 정한 값이다(측정 최대치보다 한 단계 여유).
          const n = chunk.length
          const sz = n <= 20 ? { f: 17,   p: 8 }
                   : n <= 24 ? { f: 15,   p: 5.5 }
                   : n <= 28 ? { f: 14,   p: 4 }
                   : n <= 32 ? { f: 13,   p: 3 }
                   :           { f: 12,   p: 2 }
          const room = sz.f + 2, head = sz.f - 3   // 호실은 크게, 머리글은 조금 작게
          return (
            <div key={`${f}-${ci}`} className="asg-print-page">
              {/* 머리글 */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '3px solid #0d9488', paddingBottom: '7px', marginBottom: '9px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: '#0d9488', letterSpacing: '0.2em', margin: 0 }}>행복한요양원 · 정성으로 모시겠습니다</p>
                  <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#111827', margin: '2px 0 0', letterSpacing: '0.08em' }}>담당 어르신 명단</h1>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', padding: '5px 18px', borderRadius: 10, background: '#0d9488', color: 'white', fontSize: '21px', fontWeight: 900 }}>
                    {f}{pageCount > 1 && <span style={{ fontSize: '14px', marginLeft: 6, opacity: 0.85 }}>({ci + 1}/{pageCount})</span>}
                  </span>
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>
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
                        padding: `${sz.p}px 4px`, fontSize: `${head}px`, fontWeight: 800,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chunk.map(r => {
                    const first = r.room !== pv
                    if (first) { pv = r.room; band += 1 }
                    const incoming = (r.admission_date ?? '') > today
                    const bg = incoming ? '#fffbeb' : band % 2 === 0 ? '#f8fafc' : 'white'
                    const cell: React.CSSProperties = {
                      border: '1px solid #e2e8f0', background: bg, lineHeight: 1.3,
                      padding: `${sz.p}px 7px`, fontSize: `${sz.f}px`,
                    }
                    return (
                      <tr key={r.resident_id} className={first ? 'asg-room-top' : ''}>
                        <td style={{ ...cell, textAlign: 'center' }}>
                          {first && <span style={{
                            display: 'inline-block', minWidth: 46, borderRadius: 8,
                            background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e',
                            padding: '2px 8px',
                            fontSize: `${room}px`, fontWeight: 900,
                          }}>{r.room}호</span>}
                        </td>
                        <td style={{ ...cell, fontWeight: 800, color: '#111827', fontSize: `${sz.f + 1}px` }}>
                          {r.name}
                          {incoming && <span style={{ marginLeft: 5, fontSize: `${Math.max(9, sz.f - 4)}px`, fontWeight: 800, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '1px 5px', verticalAlign: 'middle' }}>입소 예정</span>}
                        </td>
                        <td style={{ ...cell, textAlign: 'center', color: '#111827', fontWeight: 700 }}>{r.care_staff_name ?? <span style={{ color: '#cbd5e1', fontWeight: 400 }}>—</span>}</td>
                        <td style={{ ...cell, textAlign: 'center', color: '#111827', fontWeight: 700 }}>{r.rehab_staff_name ?? <span style={{ color: '#cbd5e1', fontWeight: 400 }}>—</span>}</td>
                        <td style={{ ...cell, fontSize: `${sz.f - 2}px`, color: '#64748b' }}>
                          {[incoming ? `${Number(r.admission_date!.slice(5, 7))}/${Number(r.admission_date!.slice(8, 10))} 입소` : '', r.note ?? ''].filter(Boolean).join(' · ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {/* 담당별 인원 요약은 종이에 넣지 않는다 — 그 자리를 명단 글자 크기에 쓴다.
                  (화면 상단 집계에서 언제든 볼 수 있다) */}
              <p style={{ fontSize: '9px', color: '#9ca3af', textAlign: 'right', margin: '8px 2px 0' }}>
                ※ 담당 변경은 관리자 페이지 「담당 어르신 명단」에서 — 변경 이력이 함께 남습니다 · 행복한요양원
              </p>
            </div>
          )
          })
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
      {/* ── 명단 아래 메모 ──
          어르신 한 분에 대한 이야기가 아니라, 이 명단을 보는 사람들이 다 같이
          알아야 하는 것을 적는 자리다 — '이번 주 독감 예방접종' 같은.
          인쇄에도 함께 나간다. 벽에 붙는 종이에 지침이 같이 있어야 한다. */}
      <section className="mt-3">
        <div className="flex items-center gap-1.5 mb-1.5 print:hidden">
          <StickyNote size={14} className="text-amber-600" />
          {/* 접어 둔다 — 한 층이 한 화면에 들어와야 한다.
              다만 적힌 내용이 있으면 접힌 채로도 한 줄이 보인다.
              아무도 못 보는 메모는 없는 것과 같다. */}
          <button onClick={() => setNoteOpen(o => !o)}
            className="text-sm font-bold text-gray-800 hover:text-amber-700 shrink-0">
            전체 어르신 메모 {noteOpen ? '▴' : '▾'}
          </button>
          {!noteOpen && (
            <span className={`text-xs truncate ${(past ? snapMemo : note?.content) ? 'text-gray-700' : 'text-gray-400'}`}>
              {(past ? snapMemo : note?.content) || '한 분이 아니라 다 같이 알아야 할 내용 — 명단과 함께 인쇄됩니다'}
            </span>
          )}
          {note?.updated_by && (
            <span className="ml-auto text-[11px] text-gray-400">
              마지막 수정 {note.updated_by}
              {note.updated_at && ` · ${new Date(note.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
            </span>
          )}
        </div>

        <div className={`rounded-xl border border-amber-200 bg-amber-50/60 p-3 print:border-gray-400 print:bg-white print:block ${noteOpen ? '' : 'hidden'}`}>
          <p className="hidden print:block text-xs font-bold text-gray-700 mb-1">전체 어르신 메모</p>
          {past && <p className="text-[11px] text-teal-700 font-semibold mb-1 print:hidden">{viewDate} 당시 메모</p>}
          <textarea
            value={past ? snapMemo : noteDraft}
            readOnly={past}
            onChange={e => setNoteDraft(e.target.value)}
            maxLength={note?.max_length ?? 1000}
            rows={3}
            placeholder="예) 이번 주 독감 예방접종 — 목요일 오전, 해당 어르신은 개별 안내드립니다."
            className="eb-note w-full bg-transparent text-sm text-gray-800 resize-none focus:outline-none placeholder:text-gray-400" />
          <div className={`items-center gap-2 mt-1 print:hidden ${past ? 'hidden' : 'flex'}`}>
            <button onClick={saveNote}
              disabled={noteBusy || noteDraft === (note?.content ?? '')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-40">
              {noteBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} 저장
            </button>
            {noteDraft !== (note?.content ?? '') && (
              <span className="text-[11px] text-amber-700 font-semibold">저장하지 않은 변경이 있습니다</span>
            )}
            <span className="ml-auto text-[11px] text-gray-400">
              {noteDraft.length} / {note?.max_length ?? 1000}자
            </span>
          </div>
        </div>
      </section>

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

      <style>{`
        @media print {
          /* 입력칸이 종이에 네모 상자로 찍히면 읽기 나쁘다 — 글자만 남긴다 */
          .eb-note { border: 0 !important; background: transparent !important; }
          .eb-note::placeholder { color: transparent !important; }
        }
      `}</style>
    </div>
  )
}
