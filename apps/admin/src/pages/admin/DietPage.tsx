import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  UtensilsCrossed, Printer, Upload, Loader2, X,
  ChevronLeft, ChevronRight, AlertTriangle, CalendarClock, Trash2, Search,
} from 'lucide-react'
import { dietAPI, type DietRow, type DietToday, type DietChange, type ImportResult } from '@/api/dietClient'
import { RICE_TONE, SIDE_TONE, TUBE_TONE, UNSET_TONE, dietLabel } from '@/utils/dietTone'
import DietEditModal from '@/components/diet/DietEditModal'

/**
 * 식이 현황 — 어느 어르신이 무엇을 드시는가.
 *
 * ■ 종이에서 무엇이 불편했나
 *
 *   바뀔 때마다 그날짜 시트를 새로 떠서 보관했다. 다섯 달에 시트 55장.
 *   '지금 뭘 드시나' 는 마지막 시트를 찾아야 알고, '언제부터 죽이었나' 는
 *   55장을 거꾸로 넘겨야 했다. 그래서 여기서는 바뀐 순간만 쌓고, 지금도
 *   지난 6월 3일도 같은 기록에서 계산해 낸다.
 *
 * ■ 이 화면이 답해야 하는 것 세 가지
 *
 *   ① 오늘 주방에 몇 인분씩 올리나   → 맨 위 집계
 *   ② 이 어르신은 무엇을 드시나      → 층·호실 순 명단
 *   ③ 언제부터 바뀌었고 누가 바꿨나  → 이력 탭 · 어르신별 내력
 *
 * ■ 바꾸기는 두 번 누르면 끝나야 한다
 *
 *   삼킴이 나빠져 죽으로 내리는 판단은 현장에서 즉시 난다. 그때 화면을
 *   여러 겹 지나야 하면 종이에 적고 만다. 그래서 어르신을 누르면 바로
 *   밥·반찬 버튼이 뜨고, 적용일은 오늘이 기본이다.
 */

const FLOOR_ORDER = ['2층', '3층', '4층', '1층']
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const fmtMD = (s?: string | null) => (s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : '')
const fmtFull = (s: string) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`

export default function DietPage() {
  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState<DietToday | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'now' | 'log'>('now')
  const [log, setLog] = useState<DietChange[]>([])
  const [edit, setEdit] = useState<DietRow | null>(null)
  const [search, setSearch] = useState('')
  const [impOpen, setImpOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await dietAPI.today(date)) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [date])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'log') dietAPI.log().then(setLog).catch(() => setLog([])) }, [tab])

  const move = (d: number) => {
    const t = new Date(date + 'T00:00:00')
    t.setDate(t.getDate() + d)
    setDate(t.toISOString().slice(0, 10))
  }

  const isToday = date === todayISO()
  const rows = useMemo(() => (data?.residents ?? []).filter(r =>
    !search || (r.name ?? '').includes(search) || (r.room ?? '').includes(search)), [data, search])

  /** 층 → 호실 → 어르신. 종이 표와 같은 차례라 눈이 그대로 옮겨간다 */
  const byFloor = useMemo(() => {
    const m = new Map<string, Map<string, DietRow[]>>()
    rows.forEach(r => {
      const f = r.floor || '미지정', room = r.room || '미지정'
      if (!m.has(f)) m.set(f, new Map())
      const rm = m.get(f)!
      if (!rm.has(room)) rm.set(room, [])
      rm.get(room)!.push(r)
    })
    return [...m.entries()].sort((a, b) => {
      const ia = FLOOR_ORDER.indexOf(a[0]), ib = FLOOR_ORDER.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [rows])

  const unset = (data?.residents ?? []).filter(r => !r.tube && (r.unset || (!r.rice && !r.side))).length
  const upcoming = (data?.residents ?? []).filter(r => r.upcoming).length

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto diet-print">
      {/* ── 머리 ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed size={20} className="text-orange-500" /> 식이 현황
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            어르신별 밥·반찬 종류와 그 내력 · 바꾸면 날짜와 바꾼 사람이 함께 남습니다
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTab('now'); setTimeout(() => window.print(), 80) }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
            <Printer size={14} /> 주방용 인쇄
          </button>
          <button onClick={() => setImpOpen(true)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
            <Upload size={14} /> 엑셀 가져오기
          </button>
        </div>
      </div>

      {/* ── 날짜 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 mb-7 print:hidden">
        <button onClick={() => move(-1)} className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50"><ChevronLeft size={16} /></button>
        <div className="relative">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-800" />
          <span className="absolute -bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
            {date.slice(0, 4)}년 {fmtFull(date)} ({DOW[new Date(date + 'T00:00:00').getDay()]})
          </span>
        </div>
        <button onClick={() => move(1)} className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50"><ChevronRight size={16} /></button>
        {!isToday && (
          <button onClick={() => setDate(todayISO())}
            className="ml-1 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">오늘로</button>
        )}
        {!isToday && <span className="text-[11px] text-amber-600 font-bold">지난 날짜를 보고 있습니다 — 그날 기준입니다</span>}
      </div>

      {/* 종이에만 나오는 머리글 — 화면 머리글은 버튼이 섞여 있어 인쇄에서 감춘다.
          주방 벽에 붙는 종이라 '언제 것인지' 가 없으면 못 쓴다. */}
      <div className="hidden print:block mb-2">
        <h1 className="text-base font-bold text-gray-900">
          식이 현황 · {date.slice(0, 4)}년 {fmtFull(date)} ({DOW[new Date(date + 'T00:00:00').getDay()]})
        </h1>
      </div>

      {/* ── 주방에 넘길 숫자 ──────────────────────────────────── */}
      {data && <CountStrip data={data} />}

      {/* ── 탭 ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-3 print:hidden">
        {([['now', '현황'], ['log', '변경 이력']] as const).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              tab === k ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{t}</button>
        ))}
        {tab === 'now' && (
          <div className="ml-auto flex items-center gap-2 pb-1.5">
            {unset > 0 && (
              <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle size={11} /> 식이 미정 {unset}명
              </span>
            )}
            {upcoming > 0 && (
              <span className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-1 rounded-full flex items-center gap-1">
                <CalendarClock size={11} /> 변경 예정 {upcoming}건
              </span>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="성함·호실"
                className="pl-7 pr-2 py-1.5 w-32 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-orange-300" />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : !data ? (
        <p className="text-center py-16 text-sm text-gray-400">현황을 불러오지 못했습니다.</p>
      ) : tab === 'now' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-3">
          {byFloor.map(([floor, rooms]) => (
            <section key={floor} className="rounded-2xl border border-gray-200 bg-white overflow-hidden break-inside-avoid">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-800">{floor}</h2>
                <span className="text-[11px] text-gray-400">
                  {[...rooms.values()].reduce((s, v) => s + v.length, 0)}명
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {[...rooms.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([room, list]) => (
                  <div key={room} className="flex">
                    <div className="w-12 shrink-0 px-2 py-2 bg-gray-50/60 text-[11px] font-bold text-gray-400 text-center border-r border-gray-100">
                      {room}
                    </div>
                    <div className="flex-1 divide-y divide-gray-50">
                      {list.map(r => (
                        <ResidentLine key={r.resident_id} r={r} canEdit={data.can_edit}
                          onClick={() => data.can_edit && setEdit(r)} />
                      ))}
                    </div>
                  </div>
                ))}
                {rooms.size === 0 && <p className="px-3 py-6 text-xs text-gray-300 text-center">해당 없음</p>}
              </div>
            </section>
          ))}
          {byFloor.length === 0 && (
            <p className="col-span-full text-center py-16 text-sm text-gray-400">
              {search ? '찾으시는 어르신이 없습니다.' : '그날 재원 중인 어르신이 없습니다.'}
            </p>
          )}
        </div>
      ) : (
        <ChangeLog rows={log} canEdit={!!data.can_edit}
          onRemoved={() => { dietAPI.log().then(setLog); load() }} />
      )}

      {edit && (
        <DietEditModal residentId={edit.resident_id} name={edit.name}
          sub={`${edit.floor ?? ''} ${edit.room ? edit.room + '호' : ''}`.trim()}
          current={edit} rice={data!.rice_types} side={data!.side_types}
          showHistory
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); if (tab === 'log') dietAPI.log().then(setLog) }} />
      )}
      {impOpen && <ImportModal onClose={() => setImpOpen(false)} onDone={() => { setImpOpen(false); load() }} />}

      <p className="text-[11px] text-gray-400 mt-3 print:hidden">
        💡 입원·외박으로 자리를 비운 끼니는 여기서 세지 않습니다 — 그건 일정에 기록된 대로 「식수 정산」이 계산합니다.
      </p>
    </div>
  )
}

/* ══════════ 주방에 넘길 숫자 ══════════ */
function CountStrip({ data }: { data: DietToday }) {
  const c = data.counts
  const cell = (label: string, tone: string, n: number, big = false) => (
    <div key={label} className={`rounded-xl border px-3 py-2 text-center ${tone} ${n === 0 ? 'opacity-40' : ''}`}>
      <p className={`font-extrabold leading-none ${big ? 'text-2xl' : 'text-xl'}`}>{n}</p>
      <p className="text-[10px] font-bold mt-1">{label}</p>
    </div>
  )
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 print:p-2 mb-4 print:mb-2">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-bold text-gray-700">{fmtFull(data.date)} 주방에 올릴 수량</p>
        <span className="text-[11px] text-gray-400">재원 {c['합계']}명 (경관식 {c['경관식']}명 제외하면 {c['합계'] - c['경관식']}명)</span>
      </div>
      {/* 밥·반찬·그 외를 갈라 둔다 — 주방은 솥과 찬을 따로 잡는다.
          한 줄로 아홉 칸을 늘어놓으면 어디까지가 밥인지 세어 봐야 한다. */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {([['밥', data.rice_types, RICE_TONE],
           ['반찬', data.side_types, SIDE_TONE]] as const).map(([label, types, tone]) => (
          <div key={label}>
            <p className="text-[10px] font-bold text-gray-400 mb-1 pl-0.5">{label}</p>
            <div className="flex gap-1.5">
              {types.map(t => cell(t, (tone as any)[t]?.chip ?? '', c[t] ?? 0, true))}
            </div>
          </div>
        ))}
        <div>
          <p className="text-[10px] font-bold text-gray-400 mb-1 pl-0.5">그 외</p>
          <div className="flex gap-1.5">
            {cell('경관식', TUBE_TONE.chip, c['경관식'] ?? 0)}
            {(c['미정'] ?? 0) > 0 && cell('미정', UNSET_TONE.chip, c['미정'])}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════ 어르신 한 줄 ══════════ */
function ResidentLine({ r, canEdit, onClick }: { r: DietRow; canEdit: boolean; onClick: () => void }) {
  const chip = (t: string, cls: string) =>
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{t}</span>
  return (
    <button onClick={onClick} disabled={!canEdit}
      className={`diet-line w-full text-left px-2.5 py-2 print:py-1 flex items-center gap-1.5 flex-wrap ${canEdit ? 'hover:bg-orange-50/50 cursor-pointer' : 'cursor-default'}`}>
      <span className="text-[13px] font-bold text-gray-800 w-[3.6rem] shrink-0">{r.name}</span>
      {/* 기록은 있는데 밥·반찬이 비어 있는 경우도 '미정' 이다 —
          경관식을 풀면 그렇게 된다. 빈칸으로 두면 아무도 못 알아챈다. */}
      {r.tube ? chip('경관식', TUBE_TONE.chip)
        : (r.unset || (!r.rice && !r.side)) ? chip('식이 미정', UNSET_TONE.chip)
        : <>
            {r.rice && chip(r.rice, RICE_TONE[r.rice]?.chip ?? '')}
            {r.side && chip(r.side, SIDE_TONE[r.side]?.chip ?? '')}
          </>}
      {r.since && !r.unset && (
        <span className="text-[10px] text-gray-400 ml-auto shrink-0 tabular-nums print:hidden">{fmtMD(r.since)}~</span>
      )}
      {r.upcoming && (
        <span className="w-full text-[10px] font-bold text-sky-600 flex items-center gap-0.5 print:hidden">
          <CalendarClock size={9} />{fmtMD(r.upcoming.date)}부터 {dietLabel(r.upcoming.rice, r.upcoming.side, r.upcoming.tube)}
        </span>
      )}
      {r.note && <span className="w-full text-[10px] text-gray-400 truncate print:hidden">· {r.note}</span>}
    </button>
  )
}

/* ══════════ 변경 이력 ══════════ */
function ChangeLog({ rows, canEdit, onRemoved }: {
  rows: DietChange[]; canEdit: boolean; onRemoved: () => void
}) {
  /** 무엇에서 무엇으로 바뀌었는지 — 한 사람의 바로 앞 기록을 찾아 붙인다.
   *  결과만 있으면 '원래 뭐였더라' 를 또 뒤져야 한다. */
  const withPrev = useMemo(() => {
    const asc = [...rows].sort((a, b) =>
      a.effective_date.localeCompare(b.effective_date) ||
      (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    const last = new Map<string, DietChange>()
    const prevOf = new Map<string, DietChange | undefined>()
    asc.forEach(c => { prevOf.set(c.id, last.get(c.resident_id)); last.set(c.resident_id, c) })
    return rows.map(c => ({ c, prev: prevOf.get(c.id) }))
  }, [rows])

  const byDate = useMemo(() => {
    const m = new Map<string, typeof withPrev>()
    withPrev.forEach(x => {
      const d = x.c.effective_date
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(x)
    })
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [withPrev])

  const remove = async (c: DietChange) => {
    if (!confirm(`${c.name} 어르신 · ${fmtFull(c.effective_date)}부터 ${dietLabel(c.rice, c.side, c.tube)}\n이 기록을 지울까요?\n\n(잘못 넣은 줄을 지우는 것입니다 — 식이를 되돌리려면 새로 바꿔 주세요)`)) return
    try { await dietAPI.removeChange(c.id); onRemoved() }
    catch (e: any) { alert(e?.response?.data?.detail ?? '지우지 못했습니다.') }
  }

  if (rows.length === 0)
    return <p className="text-center py-16 text-sm text-gray-400">아직 변경 기록이 없습니다.</p>

  const chipOf = (c: DietChange) =>
    c.tube ? TUBE_TONE.chip
      : RICE_TONE[c.rice ?? '']?.chip ?? SIDE_TONE[c.side ?? '']?.chip ?? UNSET_TONE.chip

  return (
    <div className="space-y-3">
      {byDate.map(([d, list]) => {
        const future = d > todayISO()
        return (
          <section key={d} className={`rounded-2xl border bg-white overflow-hidden ${future ? 'border-sky-200' : 'border-gray-200'}`}>
            <div className={`px-3 py-2 border-b flex items-center gap-2 ${future ? 'bg-sky-50 border-sky-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-sm font-bold ${future ? 'text-sky-800' : 'text-gray-800'}`}>
                {d.slice(0, 4)}년 {fmtFull(d)}
              </p>
              {future && <span className="text-[10px] font-bold text-white bg-sky-500 px-1.5 py-0.5 rounded-full">아직 안 옴</span>}
              <span className="text-[11px] text-gray-400">{list.length}건</span>
              <span className="ml-auto text-[11px] text-gray-400">{DOW[new Date(d + 'T00:00:00').getDay()]}요일</span>
            </div>
            <div className="divide-y divide-gray-100">
              {list.map(({ c, prev }) => (
                <div key={c.id} className="px-3 py-2 flex items-center gap-2 text-[13px] flex-wrap">
                  <span className="font-bold text-gray-800 w-16 shrink-0">{c.name}</span>
                  {/* 이전 → 이후. 첫 기록이면 '미정' 에서 시작한 것으로 적는다 */}
                  <span className="text-[11px] text-gray-400">
                    {prev ? dietLabel(prev.rice, prev.side, prev.tube) : '미정'}
                  </span>
                  <span className="text-gray-300">→</span>
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${chipOf(c)}`}>
                    {dietLabel(c.rice, c.side, c.tube)}
                  </span>
                  {c.note && <span className="text-[11px] text-gray-400 truncate max-w-[16rem]">· {c.note}</span>}
                  <span className="ml-auto text-[11px] text-gray-300 shrink-0">
                    {c.source === 'import' ? '엑셀에서 가져옴' : c.changed_by ?? ''}
                  </span>
                  {canEdit && (
                    <button onClick={() => remove(c)} title="잘못 넣은 줄 지우기"
                      className="text-gray-200 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ══════════ 엑셀 가져오기 ══════════ */
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [prev, setPrev] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pick = async (f: File) => {
    setFile(f); setPrev(null); setErr(null); setBusy(true)
    try { setPrev(await dietAPI.importExcel(f, false)) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? '파일을 읽지 못했습니다.') }
    finally { setBusy(false) }
  }
  const apply = async () => {
    if (!file) return
    setBusy(true)
    try { await dietAPI.importExcel(file, true); onDone() }
    catch (e: any) { setErr(e?.response?.data?.detail ?? '가져오지 못했습니다.'); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <p className="text-base font-bold text-gray-900">쓰시던 엑셀 가져오기</p>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[12px] text-gray-500 leading-relaxed">
            「식수현황」 파일을 그대로 올리시면 날짜 시트(<b>26.09.07</b> 같은 이름)를 차례대로 읽어
            <b> 바뀐 순간만</b> 기록으로 옮깁니다. 어르신을 새로 만들지는 않습니다 —
            명단에 없는 성함은 건너뛰고 몇 분인지 알려 드립니다.
          </p>
          <input type="file" accept=".xlsx" onChange={e => e.target.files?.[0] && pick(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />

          {busy && <p className="text-sm text-gray-400 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />읽는 중…</p>}
          {err && <p className="text-sm text-red-500">{err}</p>}

          {prev && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5 text-[12px]">
              <p className="font-bold text-gray-800">
                시트 {prev.sheets}장 ({prev.first_date} ~ {prev.last_date}) · 파일 속 {prev.people_in_file}명
              </p>
              <p className="text-gray-600">
                바뀐 순간 <b>{prev.changes_found}</b>건 중 <b className="text-orange-600">{prev.will_add}건</b>을 넣습니다
                {prev.already_have > 0 && <span className="text-gray-400"> · 이미 있는 것 {prev.already_have}건은 건너뜁니다</span>}
              </p>
              {prev.unmatched_count > 0 && (
                <p className="text-amber-700">
                  명단에 없는 성함 {prev.unmatched_count}분은 건너뜁니다
                  <span className="text-amber-600"> (퇴소하신 분이면 그대로 두셔도 됩니다)</span>
                </p>
              )}
              {prev.ambiguous_count > 0 && (
                <p className="text-red-600">동명이인 {prev.ambiguous_count}분은 사람이 정해야 해서 건너뜁니다</p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
          <button onClick={apply} disabled={busy || !prev || prev.will_add === 0}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-40">
            {prev ? `${prev.will_add}건 가져오기` : '파일을 먼저 고르세요'}
          </button>
        </div>
      </div>
    </div>
  )
}
