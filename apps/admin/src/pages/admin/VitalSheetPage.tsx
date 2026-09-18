import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Loader2, Printer, Thermometer } from 'lucide-react'
import { assignmentAPI, type AssignRow } from '@/api/assignmentClient'
import { roomAPI, type FloorInfo } from '@/api/roomClient'
import {
  buildSheetRooms, chunkSheetRooms, sheetCutoff, sheetDateLine, type SheetRoom,
} from '@/utils/vitalSheet'

/**
 * 층별 바이탈·건강 모니터링 출력 — 간호팀 엑셀을 그대로 종이로.
 *
 *  간호팀은 매달 「N층 바이탈 및 간호처치 대상자」와 「N층 건강 모니터링(체온)」
 *  두 장을 엑셀에서 뽑아 썼다. 어르신이 들고 나실 때마다 엑셀의 성함을 손으로
 *  고쳐야 했고, 「담당 어르신 명단」과 어긋나는 일이 잦았다.
 *
 *  여기서는 명단·방 정원을 그대로 가져와 그 표를 만든다. 명단이 바뀌면 종이도
 *  바뀐다. 표 모양은 엑셀 그대로 — 호실마다 정원만큼 줄, 빈 줄은 손으로 적는 자리.
 *  엑셀처럼 한 장에 같은 표 두 부를 나란히 놓아 반으로 잘라 쓰는 것이 기본이다.
 */

type Kind = 'vital' | 'temp'
const KIND_LABEL: Record<Kind, string> = { vital: '바이탈 및 간호처치 대상자', temp: '건강 모니터링 (체온)' }

const kstNow = () => new Date(Date.now() + 9 * 3600e3)
const thisYm = () => kstNow().toISOString().slice(0, 7)

const MM = 3.7795   // 1mm = 3.78px (96dpi)
// A4 에서 여백 7mm 를 뺀 지면. 높이는 2mm 덜 쓴다 — 반올림으로 조금이라도
// 넘치면 브라우저가 빈 장을 한 장 더 낸다.
const PAGE = {
  landscape: { w: 283, h: 194 },
  portrait:  { w: 196, h: 281 },
}
const GAP_MM = 8          // 두 부 사이 — 자르는 선이 지나갈 자리
const MIN_ROW_MM = 3.8    // 이보다 줄이 낮으면 손으로 못 적는다 → 장을 나눈다

const loadJSON = <T,>(k: string, fb: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb } catch { return fb }
}

export default function VitalSheetPage() {
  const [rows, setRows] = useState<AssignRow[]>([])
  const [roomInfo, setRoomInfo] = useState<FloorInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [floorPick, setFloorPick] = useState('')     // '' = 전체 층
  const [kinds, setKinds] = useState<Record<Kind, boolean>>(() => loadJSON('vs.kinds', { vital: true, temp: true }))
  const [ym, setYm] = useState(thisYm)
  const [day, setDay] = useState('')                 // '' = 일은 손으로
  const [copies, setCopies] = useState<1 | 2>(() => loadJSON<1 | 2>('vs.copies', 2))
  // 체온 재는 시각 — 엑셀은 21시·02시·06시(야간). 바뀌면 여기서 고친다.
  const [times, setTimes] = useState<string[]>(() => loadJSON('vs.times', ['21:00', '02:00', '06:00']))
  useEffect(() => { localStorage.setItem('vs.kinds', JSON.stringify(kinds)) }, [kinds])
  useEffect(() => { localStorage.setItem('vs.copies', JSON.stringify(copies)) }, [copies])
  useEffect(() => { localStorage.setItem('vs.times', JSON.stringify(times)) }, [times])

  useEffect(() => {
    Promise.all([assignmentAPI.roster(), roomAPI.occupancy()])
      .then(([r, o]) => { setRows(r.rows); setRoomInfo(o.floors) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 층 목록 — 방 설정에 있는 층과 명단에 있는 층을 합친다. '미지정' 은 층이 아니다.
  const floors = useMemo(() => Array.from(new Set([
    ...roomInfo.map(f => f.floor),
    ...rows.map(r => r.floor),
  ])).filter(f => f && f !== '미지정').sort(), [roomInfo, rows])

  const cutoff = sheetCutoff(ym, day)
  const dateLine = sheetDateLine(ym, day)
  const incoming = rows.filter(r => (r.admission_date ?? '') > cutoff).length
  const noFloor = rows.filter(r => !floors.includes(r.floor) && (r.admission_date ?? '') <= cutoff).length

  const orient = copies === 2 ? 'landscape' : 'portrait'
  const page = PAGE[orient]
  const sheetW = copies === 2 ? (page.w - GAP_MM) / 2 : page.w
  // 제목·날짜 줄과 머리글 두 줄이 쓰는 높이 — 나머지를 본문 줄이 나눠 갖는다
  const titleMm = copies === 2 ? 15 : 20
  const hdrMm = copies === 2 ? 6 : 8
  const bodyMm = page.h - titleMm - hdrMm * 2
  const maxRows = Math.floor(bodyMm / MIN_ROW_MM)

  /** 낼 장 — 층마다 (바이탈, 체온) 순서. 한 층이 한 장에 안 들어가면 방 단위로 나눈다. */
  const pages = useMemo(() => {
    const out: { key: string; floor: string; kind: Kind; rooms: SheetRoom[]; no: number; of: number }[] = []
    const targets = floorPick ? [floorPick] : floors
    for (const f of targets) {
      const cfg = roomInfo.find(x => x.floor === f)?.rooms ?? []
      const all = buildSheetRooms(f, rows, cfg, cutoff)
      if (!all.length) continue
      const chunks = chunkSheetRooms(all, maxRows)
      for (const kind of ['vital', 'temp'] as Kind[]) {
        if (!kinds[kind]) continue
        chunks.forEach((c, i) => out.push({ key: `${f}-${kind}-${i}`, floor: f, kind, rooms: c, no: i + 1, of: chunks.length }))
      }
    }
    return out
  }, [floorPick, floors, roomInfo, rows, cutoff, kinds, maxRows])

  // 화면에서는 종이를 화면 폭에 맞춰 줄여 보여준다(인쇄에서는 원래 크기)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = () => setZoom(Math.min(1, (el.clientWidth - 2) / (page.w * MM)))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [page.w])

  const setDayClean = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 2)
    if (!n) { setDay(''); return }
    const d = Math.min(31, Math.max(1, Number(n)))
    setDay(String(d))
  }

  const chip = (on: boolean, extra = '') =>
    `px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${on ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} ${extra}`

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto print:p-0 print:max-w-none">
      <div className="print:hidden" data-print="off">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Activity size={20} className="text-rose-600" />
          <h1 className="text-xl font-bold text-gray-900">바이탈 · 건강 모니터링 출력</h1>
          <button onClick={() => window.print()} disabled={!pages.length}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold disabled:opacity-40">
            <Printer size={13} /> 인쇄 {pages.length > 0 && <span className="text-[11px] opacity-80">{pages.length}장</span>}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          「담당 어르신 명단」의 호실과 방 정원 그대로. 층마다 <b>바이탈 및 간호처치 대상자</b>와 <b>건강 모니터링(체온)</b> 한 장씩 —
          호실마다 정원만큼 줄을 두고 빈 줄은 손으로 적는 자리로 둡니다.
        </p>

        <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 w-12">층</span>
            <button onClick={() => setFloorPick('')} className={chip(floorPick === '')}>전체 층</button>
            {floors.map(f => (
              <button key={f} onClick={() => setFloorPick(f)} className={chip(floorPick === f)}>{f}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 w-12">서식</span>
            <button onClick={() => setKinds(k => ({ ...k, vital: !k.vital }))} className={chip(kinds.vital, 'inline-flex items-center gap-1')}>
              <Activity size={12} /> 바이탈 · 간호처치 대상자
            </button>
            <button onClick={() => setKinds(k => ({ ...k, temp: !k.temp }))} className={chip(kinds.temp, 'inline-flex items-center gap-1')}>
              <Thermometer size={12} /> 건강 모니터링 (체온)
            </button>
            {kinds.temp && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 ml-1">
                체온 시각
                {times.map((t, i) => (
                  <input key={i} type="time" value={t}
                    onChange={e => setTimes(ts => ts.map((x, k) => k === i ? e.target.value : x))}
                    className="px-1.5 py-1 border border-gray-200 rounded-lg text-xs w-[92px] focus:outline-none focus:ring-2 focus:ring-rose-100" />
                ))}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 w-12">날짜</span>
            <input type="month" value={ym} onChange={e => e.target.value && setYm(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-100" />
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <input inputMode="numeric" value={day} onChange={e => setDayClean(e.target.value)} placeholder="손으로"
                className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-rose-100" />
              일
            </span>
            <span className="text-[11px] text-gray-400">일을 비워 두면 한 달치를 뽑아 그날그날 손으로 적습니다</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 w-12">한 장에</span>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
              <button onClick={() => setCopies(2)} className={`px-2.5 py-1.5 ${copies === 2 ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>2부 (가로 · 반으로 잘라)</button>
              <button onClick={() => setCopies(1)} className={`px-2.5 py-1.5 ${copies === 1 ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>1부 크게 (세로)</button>
            </div>
            <span className="text-[11px] text-gray-400">인쇄 창에서 용지 A4 · 배경 그래픽 켜기</span>
          </div>
          {(incoming > 0 || noFloor > 0) && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
              {incoming > 0 && <>입소 예정 <b>{incoming}명</b>은 {day ? '그날' : '이달 말'} 이후에 오셔서 빼고 냅니다. </>}
              {noFloor > 0 && <>층이 정해지지 않은 <b>{noFloor}명</b>은 층 표에 넣을 수 없습니다 — 「담당 어르신 명단」에서 호실을 정해 주세요.</>}
            </p>
          )}
        </div>
      </div>

      {/* 폭을 재는 상자는 늘 그려 둔다 — 로딩 뒤에 생기면 재는 시점을 놓친다 */}
      <div ref={wrapRef}>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="animate-spin" /></div>
      ) : pages.length === 0 ? (
        <p className="text-center py-16 text-sm text-gray-400">낼 표가 없습니다. 층과 서식을 골라 주세요.</p>
      ) : (
        <div className="vs-pages" style={{ zoom }}>
          {pages.map(p => (
            <div key={p.key} className="vs-page"
              style={{ width: `${page.w}mm`, height: `${page.h}mm`, display: 'flex', gap: `${GAP_MM}mm` }}>
              {Array.from({ length: copies }, (_, ci) => (
                <Sheet key={ci} kind={p.kind} floor={p.floor} rooms={p.rooms} dateLine={dateLine}
                  times={times} widthMm={sheetW} heightMm={page.h} hdrMm={hdrMm} titleMm={titleMm}
                  big={copies === 1} pageNo={p.of > 1 ? `${p.no}/${p.of}` : ''} />
              ))}
            </div>
          ))}
        </div>
      )}
      </div>

      <style>{`
        .vs-pages { display: flex; flex-direction: column; gap: 16px; }
        .vs-page { background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,.12); box-sizing: content-box; padding: 7mm; }
        @media print {
          @page { size: A4 ${orient}; margin: 7mm; }
          .vs-pages { zoom: 1 !important; gap: 0; }
          .vs-page { box-shadow: none; padding: 0; page-break-after: always; break-inside: avoid; overflow: hidden; }
          .vs-page:last-child { page-break-after: auto; }
          .vs-page * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .vs-page tr { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

/** 표 한 부 — 엑셀 한 쪽 반을 그대로.
 *  높이를 고정해 두 부가 나란히 같은 높이로 서게 한다. 줄 높이는 남은 높이를
 *  줄 수로 나눠 정한다 — 34줄이면 5mm 남짓, 20줄이면 더 넉넉하게. */
function Sheet({ kind, floor, rooms, dateLine, times, widthMm, heightMm, hdrMm, titleMm, big, pageNo }: {
  kind: Kind; floor: string; rooms: SheetRoom[]; dateLine: string; times: string[]
  widthMm: number; heightMm: number; hdrMm: number; titleMm: number; big: boolean; pageNo: string
}) {
  const n = rooms.reduce((s, r) => s + r.rows, 0)
  const rowMm = Math.min(big ? 9 : 7, (heightMm - titleMm - hdrMm * 2) / Math.max(1, n))
  const fs = Math.round(Math.min(rowMm * 2.4, big ? 17 : 13))     // 본문 글자
  const hs = Math.max(9, fs - 1)                                   // 머리글 글자
  const ts = big ? 22 : 15                                          // 제목 글자

  const thin = '1px solid #111'
  const th: React.CSSProperties = {
    border: thin, background: '#ddf2fa', color: '#111', fontWeight: 800, fontSize: `${hs}px`,
    textAlign: 'center', padding: 0, height: `${hdrMm}mm`, lineHeight: 1.1,
  }
  const td = (band: boolean): React.CSSProperties => ({
    border: thin, height: `${rowMm}mm`, padding: '0 3px', fontSize: `${fs}px`, lineHeight: 1,
    background: band ? '#f8fafc' : '#fff', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
  })

  const cols = kind === 'vital'
    ? [8, 13, 14, 8.5, 9.5, 9.5, 16, 21.5]
    : [11, 22, 15, 15, 15, 22]

  return (
    <div style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, display: 'flex', flexDirection: 'column', fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif', color: '#111' }}>
      <div style={{ height: `${titleMm}mm`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: `${ts}px`, fontWeight: 900, letterSpacing: '0.06em' }}>{floor}</span>
          <span style={{ fontSize: `${ts}px`, fontWeight: kind === 'vital' ? 900 : 700 }}>{KIND_LABEL[kind]}</span>
          {pageNo && <span style={{ fontSize: `${Math.max(9, ts - 6)}px`, color: '#6b7280' }}>({pageNo})</span>}
        </div>
        <div style={{ textAlign: 'center', fontSize: `${Math.max(10, ts - 4)}px`, fontWeight: 700, marginTop: 2, letterSpacing: '0.05em' }}>{dateLine}</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', border: '2px solid #111' }}>
        <colgroup>{cols.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
        <thead>
          {kind === 'vital' ? (
            <tr>
              {['이름', '혈압', '맥박', '체온', '산소\n포화도', '간호처치', '특이사항'].map((h, i) => (
                <th key={h} style={{ ...th, height: `${hdrMm * 2}mm`, whiteSpace: 'pre-line' }} colSpan={i === 0 ? 2 : 1}>{h}</th>
              ))}
            </tr>
          ) : (
            <>
              <tr>
                <th style={th} colSpan={2} rowSpan={2}>이름</th>
                <th style={th}>1회</th><th style={th}>2회</th><th style={th}>3회</th>
                <th style={th} rowSpan={2}>특이사항</th>
              </tr>
              <tr>
                {times.map((t, i) => <th key={i} style={{ ...th, fontWeight: 600, background: '#fff' }}>{t}</th>)}
              </tr>
            </>
          )}
        </thead>
        <tbody>
          {rooms.map((room, ri) => Array.from({ length: room.rows }, (_, i) => {
            const c = td(ri % 2 === 1)
            return (
              <tr key={`${room.room}-${i}`}>
                {i === 0 && (
                  <td rowSpan={room.rows} style={{ ...c, fontWeight: 900, fontSize: `${fs + 1}px`, background: '#fff' }}>
                    {room.room || '—'}
                  </td>
                )}
                <td style={{ ...c, fontWeight: 700, textAlign: 'center' }}>{room.names[i] ?? ''}</td>
                {kind === 'vital' ? (
                  <>
                    <td style={{ ...c, color: '#9ca3af' }}>/</td>
                    <td style={c} /><td style={c} /><td style={c} /><td style={c} /><td style={c} />
                  </>
                ) : (
                  <><td style={c} /><td style={c} /><td style={c} /><td style={c} /></>
                )}
              </tr>
            )
          }))}
        </tbody>
      </table>
    </div>
  )
}
