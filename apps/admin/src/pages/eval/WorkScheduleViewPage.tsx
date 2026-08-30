import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, Loader2, Maximize2, Minus, Plus, ZoomIn } from 'lucide-react'
import { workScheduleAPI, type WorkScheduleDoc, type HolidayInfo } from '@/api/workScheduleClient'
import { sortScheduleStaff, canJoinTeam } from '@/components/schedule/shared'
import { countAsOf } from '@/utils/shiftCodes'
import { withFloorSubtotals } from '@/utils/floorSubtotals'
import { filterByFloor, countHiddenNoFloor } from '@/utils/floorFilter'
import { monthTotals, hourStatus, hourDiff } from '@/utils/monthHours'
import { useLtcStore } from '@/store/ltc'
import { useShiftConfig } from '@/store/shiftConfig'

/**
 * 전체 근무표 보기 — 모바일 최적화 읽기 전용 (ADMIN·시설장·대표·이사).
 * 이름 열·날짜 행 고정 + 코드 색상 + 줌(50~150%). 편집은 PC의 근무표 페이지에서.
 */
const CODE_CLS: Record<string, string> = {
  D: 'bg-sky-50 text-sky-700', M: 'bg-emerald-50 text-emerald-700', N: 'bg-indigo-50 text-indigo-700',
  '休': 'bg-rose-50 text-rose-600', '연차': 'bg-rose-50 text-rose-600',
  '대휴': 'bg-amber-50 text-amber-700', '초과휴': 'bg-amber-50 text-amber-700',
  AD: 'bg-teal-50 text-teal-700', PD: 'bg-teal-50 text-teal-700',
}
const codeCls = (c: string) => CODE_CLS[c] ?? (/^\d/.test(c) ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-600')
// "0930 1200" 같은 시간대 코드는 세로 두 줄로 — 열 폭을 좁게 유지
const splitTime = (c: string): string[] | null => {
  const m = c.trim().match(/^(\d{3,4})[\s~\-]+(\d{3,4})$/)
  return m ? [m[1], m[2]] : null
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 왼쪽에 고정하는 이름 열의 폭.
 *
 * 좁은 화면에서는 이 열이 넓을수록 날짜 볼 자리가 줄어든다. 실제로 필요한
 * 만큼만 준다 — 성명 네 글자(12px×4=48)와 직종 다섯 글자(9px×5=45)가
 * 들어가면 된다. 좌우 여백 12px 을 빼고 50px 이 남으니 둘 다 들어간다.
 */
const NAME_W = 62
/** 맨 오른쪽 총시간 열 */
const TOTAL_W = 52

export default function WorkScheduleViewPage() {
  // 코드별 시간 설정 — 총시간이 이 값으로 계산된다.
  // loadedHours 를 읽어야 설정이 실린 뒤 화면이 다시 그려진다.
  const loadShiftCfg = useShiftConfig(st => st.load)
  const useHoursFor = useShiftConfig(st => st.useFor)
  const loadedHours = useShiftConfig(st => st.hours)
  useEffect(() => { loadShiftCfg() }, [loadShiftCfg])
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  // 보고 있는 달의 규칙으로 총시간을 계산한다.
  // 8월 표를 보는데 9월부터 바뀐 값을 쓰면 숫자가 어긋난다.
  useEffect(() => { useHoursFor(ym) }, [ym, useHoursFor])
  const [doc, setDoc] = useState<WorkScheduleDoc | null>(null)
  const [hols, setHols] = useState<Record<string, HolidayInfo>>({})
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  // 층으로 걸러 보기 — ''이면 전체. 이 브라우저에 기억한다(편성 화면과 같은 열쇠는 쓰지 않는다,
  // 보는 화면과 짜는 화면에서 보고 싶은 층이 다를 수 있다).
  const [floorPick, setFloorPick] = useState(() => localStorage.getItem('wsv.floorPick') ?? '')
  useEffect(() => { localStorage.setItem('wsv.floorPick', floorPick) }, [floorPick])
  const { staffList, loadAll } = useLtcStore()
  const boxRef = useRef<HTMLDivElement>(null)      // 스크롤 컨테이너
  const innerRef = useRef<HTMLDivElement>(null)    // zoom 적용 대상
  const legendRef = useRef<HTMLParagraphElement>(null)  // 표 아래 안내문구
  const [boxH, setBoxH] = useState<number | undefined>(undefined)
  const zoomRef = useRef(zoom); zoomRef.current = zoom
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  const fitted = useRef(false)

  const clampZoom = (z: number) => Math.min(2, Math.max(0.3, z))
  /** 전체 폭이 화면에 딱 들어오는 배율 — 한눈에 보기 */
  const fitToScreen = () => {
    const box = boxRef.current, inner = innerRef.current
    if (!box || !inner) return
    const natural = inner.scrollWidth / zoomRef.current   // zoom이 반영된 폭 → 원래 폭 역산
    if (natural > 0) setZoom(clampZoom(+(box.clientWidth / natural).toFixed(2)))
  }

  // 손가락 두 개 핀치 줌 — passive:false로 브라우저 스크롤과 충돌 방지
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) pinchRef.current = { dist: dist(e.touches), zoom: zoomRef.current }
    }
    const move = (e: TouchEvent) => {
      const p = pinchRef.current
      if (p && e.touches.length === 2) {
        e.preventDefault()
        setZoom(clampZoom(+(p.zoom * dist(e.touches) / p.dist).toFixed(2)))
      }
    }
    const end = () => { pinchRef.current = null }
    box.addEventListener('touchstart', start, { passive: true })
    box.addEventListener('touchmove', move, { passive: false })
    box.addEventListener('touchend', end)
    box.addEventListener('touchcancel', end)
    return () => {
      box.removeEventListener('touchstart', start)
      box.removeEventListener('touchmove', move)
      box.removeEventListener('touchend', end)
      box.removeEventListener('touchcancel', end)
    }
  }, [loading])   // 컨테이너가 생긴 뒤 부착

  /**
   * 표 높이를 실제로 재서 정한다.
   *
   * 폰에는 아래에 탭바가 떠 있다. 높이를 100vh-몇백px 로 짐작해 두면 기기마다
   * 어긋나 표 아랫줄이 탭바에 가린다. 실제로 남는 자리를 재는 편이 확실하다.
   *
   *   표 위(box.top) ~ 화면 아래 - 탭바 - 표 아래 안내문구 - 여백
   *
   * 주소창이 접히고 펴질 때 화면 높이가 바뀌므로 그때마다 다시 잰다.
   */
  useLayoutEffect(() => {
    if (loading || !doc) return
    const measure = () => {
      const box = boxRef.current
      if (!box) return
      const top = box.getBoundingClientRect().top
      const bar = document.querySelector('nav[aria-label="주요 메뉴"]')
      const barH = bar ? bar.getBoundingClientRect().height : 0
      const legH = legendRef.current?.getBoundingClientRect().height ?? 0
      const avail = window.innerHeight - top - barH - legH - 16
      setBoxH(Math.max(220, Math.round(avail)))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [loading, doc])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    setLoading(true)
    Promise.all([
      workScheduleAPI.get(ym).catch(() => null),
      workScheduleAPI.holidays(ym).catch(() => ({} as Record<string, HolidayInfo>)),
    ]).then(([d, h]) => { setDoc(d); setHols(h) }).finally(() => setLoading(false))
  }, [ym])

  /**
   * 첫 진입에 자동으로 축소하지 않는다.
   *
   * 예전에는 폭을 화면에 맞춰 줄였는데, 31칸을 폰 화면에 욱여넣으면 글씨가
   * 너무 작아 읽을 수가 없다. Google 스프레드시트도 그렇게 하지 않는다 —
   * 100%로 두고 옆으로 미는 편이 낫다. 이름·총시간은 고정돼 따라온다.
   * 한눈에 보고 싶으면 「한눈에」를 누르면 된다.
   *
   * 대신 오늘 날짜가 보이도록 가로 위치를 맞춰 준다. 8월 28일에 표를 열면
   * 1일부터 보이는 것보다 오늘이 보이는 편이 쓸모 있다.
   */
  useEffect(() => {
    if (loading || fitted.current || !doc) return
    fitted.current = true
    requestAnimationFrame(() => {
      const box = boxRef.current
      const cell = box?.querySelector('[data-today="1"]') as HTMLElement | null
      if (!box || !cell) return
      box.scrollLeft = Math.max(0, cell.offsetLeft - box.clientWidth / 2)
    })
  }, [loading, doc])

  const move = (d: number) => {
    const [y, m] = ym.split('-').map(Number)
    const nd = new Date(y, m - 1 + d, 1)
    setYm(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`)
  }

  const [y, m] = ym.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  const days = Array.from({ length: total }, (_, i) => i + 1)
  const todayIso = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

  // 저장된 rows + 직원명 — 근무표 페이지와 같은 정렬
  const people = useMemo(() => {
    if (!doc) return []
    const nameOf = new Map(staffList.map(s => [s.id, s.name]))
    const posOf = new Map(staffList.map(s => [s.id, s.position ?? '']))
    const hireOf = new Map(staffList.map(s => [s.id, s.hireDate ?? '']))
    const rows = (doc.rows ?? [])
      .filter(r => (doc.data?.[r.staff_id] && Object.keys(doc.data[r.staff_id]).length > 0) || nameOf.has(r.staff_id))
      .map(r => ({
        id: r.staff_id,
        name: nameOf.get(r.staff_id) ?? '(퇴사)',
        pos: (r.position ?? posOf.get(r.staff_id) ?? '') || '',
        team: r.team ?? '',
        floor: r.floor ?? '',
        hireDate: hireOf.get(r.staff_id) ?? '',
        codes: doc.data?.[r.staff_id] ?? {},
      }))
      .filter(r => Object.keys(r.codes).length > 0 || r.name !== '(퇴사)')
    return sortScheduleStaff(rows)
  }, [doc, staffList])

  /** 표에 실제로 쓰인 층 — 아무도 배정 안 한 층은 고를 이유가 없다 */
  const floors = useMemo(() => {
    const set = new Set<string>()
    people.forEach(p => { if (p.floor) set.add(p.floor) })
    return Array.from(set).sort()
  }, [people])

  /**
   * 표에 보여줄 사람.
   *
   * 편성 화면과 같은 함수를 쓴다(utils/floorFilter). 두 화면이 다른 규칙으로
   * 거르면 같은 층을 골라도 사람이 달라 보인다.
   * 층이 없는 직종(간호·사회복지 등)은 어느 층을 골라도 남는다.
   */
  const shown = useMemo(
    () => filterByFloor(people, floorPick, canJoinTeam), [people, floorPick])
  const hiddenNoFloor = useMemo(
    () => countHiddenNoFloor(people, floorPick, canJoinTeam), [people, floorPick])

  /**
   * 표에 그릴 줄들 — 사람 줄 사이에 층별 소계를 끼워 넣는다.
   *
   * 요양보호사는 이미 층 순으로 정렬돼 있으므로(sortScheduleStaff), 층이
   * 바뀌는 자리에서 앞 층의 소계를 넣으면 된다. 마지막 층은 끝난 뒤에 넣는다.
   *
   * 층이 없는 직종(간호·사회복지 등)은 소계에 넣지 않는다 — 그 층에 몇 명이
   * 있는지를 보려는 것이지 전체 인원을 보려는 게 아니다.
   */
  const bodyRows = useMemo(() => withFloorSubtotals(shown, canJoinTeam), [shown])

  /** id → 사람. 아래 소계가 칸마다 찾아 쓰므로 배열을 훑지 않게 지도로 둔다
      (31칸 × 층 수 × 사람 수 만큼 불린다) */
  const byId = useMemo(() => new Map(shown.map(p => [p.id, p])), [shown])

  /** 그 날 그 층에서 주간(D)·야간(N)으로 나오는 사람 수 */
  const countOn = (ids: string[], day: number, shift: 'D' | 'N') => {
    let n = 0
    for (const id of ids) {
      const p = byId.get(id)
      if (p && countAsOf(p.codes[String(day)]) === shift) n++
    }
    return n
  }

  /** 기준 근로시간 — 저장된 값. 없으면 판단하지 않는다(모르면서 '정상' 이라 하면 안 된다) */
  const baseHours = Number(doc?.base_hours) || 0

  /** 사람마다 이번 달 총시간. 편성 화면과 같은 계산을 쓴다(utils/monthHours) */
  const totals = useMemo(() => {
    const m = new Map<string, ReturnType<typeof monthTotals>>()
    for (const p of people) m.set(p.id, monthTotals(p.codes, days))
    return m
    // loadedHours — 코드별 시간 설정이 실리면 총시간을 다시 계산한다
  }, [people, days, loadedHours])

  const dayColor = (day: number, forText = true) => {
    const iso = `${ym}-${String(day).padStart(2, '0')}`
    const dow = new Date(y, m - 1, day).getDay()
    if ((hols[iso] && hols[iso].kind !== 'paid') || dow === 0) return forText ? 'text-red-500' : 'bg-red-50/60'
    if (dow === 6) return forText ? 'text-blue-500' : 'bg-blue-50/60'
    return forText ? 'text-gray-600' : ''
  }

  // 일별 세로 구분선 — 매일 옅게, 토→일 경계는 진하게
  const vLine = (day: number) =>
    new Date(y, m - 1, day).getDay() === 6 ? 'border-r-2 border-r-gray-300' : 'border-r border-r-gray-200/80'

  const empty = !loading && (!doc || people.length === 0)

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <CalendarRange size={20} className="text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">전체 근무표</h1>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-200">보기 전용</span>
        {/* 줌 */}
        <div className="ml-auto flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1.5 py-1">
          <ZoomIn size={13} className="text-gray-400" />
          <button onClick={() => setZoom(z => clampZoom(+(z - 0.1).toFixed(1)))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-500"><Minus size={14} /></button>
          <button onClick={() => setZoom(1)} className="text-xs font-bold text-gray-600 w-11 text-center">{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom(z => clampZoom(+(z + 0.1).toFixed(1)))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-500"><Plus size={14} /></button>
          <button onClick={fitToScreen} title="한 화면에 맞추기"
            className="flex items-center gap-1 px-2 h-8 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold hover:bg-indigo-100">
            <Maximize2 size={12} /> 한눈에
          </button>
        </div>
      </div>

      {/* 월 이동 */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button onClick={() => move(-1)} className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500 text-lg">‹</button>
        <span className="text-base font-bold text-gray-800">{y}년 {m}월</span>
        <button onClick={() => move(1)} className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500 text-lg">›</button>
      </div>

      {/* 층으로 걸러 보기 — 그 층 요양보호사만 남는다.
          층이 없는 직종(간호·사회복지 등)은 어느 층을 골라도 남는다. */}
      {!loading && floors.length > 0 && (
        <div className="flex items-center justify-center gap-1 mb-3 flex-wrap">
          {[{ v: '', label: '전체' }, ...floors.map(f => ({ v: f, label: f }))].map(o => (
            <button key={o.v || 'all'} onClick={() => setFloorPick(o.v)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors ${
                floorPick === o.v
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white border-gray-200 text-gray-600'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {!loading && floorPick && (
        <p className="mb-2 text-[11.5px] text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          <b>{floorPick}</b> 요양보호사만 보고 있습니다 — 층이 없는 직종은 그대로 나옵니다.
          {hiddenNoFloor > 0 && (
            <span className="text-amber-700"> · 층을 지정하지 않은 요양보호사 {hiddenNoFloor}명은 숨겨졌습니다.</span>
          )}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : empty ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm">{m}월 근무표가 아직 저장되지 않았습니다.</p>
        </div>
      ) : (
        <>
          <div ref={boxRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y', maxHeight: boxH ?? '74vh' }}>
            <div ref={innerRef} style={{ zoom }}>
              <table className="border-collapse" style={{ minWidth: 'max-content' }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50">
                    <th style={{ width: NAME_W, minWidth: NAME_W, maxWidth: NAME_W }}
                      className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 px-1.5 py-1.5 text-[11px] font-bold text-gray-500 text-left">성명</th>
                    <th className="border-b border-r border-gray-200 px-1 py-1.5 text-[10px] font-bold text-gray-400">조</th>
                    <th className="border-b border-r-2 border-gray-200 border-r-gray-300 px-1 py-1.5 text-[10px] font-bold text-gray-400">층</th>
                    {days.map(d => {
                      const iso = `${ym}-${String(d).padStart(2, '0')}`
                      return (
                        <th key={d} data-today={iso === todayIso ? '1' : undefined}
                          className={`border-b border-gray-200 ${vLine(d)} px-0.5 py-1 text-center min-w-[30px] ${iso === todayIso ? 'bg-amber-100' : dayColor(d, false)}`}>
                          <p className={`text-[11px] font-extrabold leading-none ${dayColor(d)}`}>{d}</p>
                          <p className={`text-[8.5px] leading-tight ${dayColor(d)}`}>{DOW[new Date(y, m - 1, d).getDay()]}</p>
                        </th>
                      )
                    })}
                    {/* 총시간 — 맨 오른쪽. 날짜를 다 보고 난 끝에 합계가 오는 것이
                        표를 읽는 순서와 맞는다. */}
                    <th style={{ width: TOTAL_W, minWidth: TOTAL_W }}
                      className="border-b border-l-2 border-gray-200 border-l-gray-300 px-1 py-1 text-[10px] font-bold text-gray-500">
                      총시간
                      {baseHours > 0 && (
                        <span className="block text-[8px] font-normal text-gray-400 leading-tight">
                          기준 {baseHours}
                        </span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, ri) => {
                    if (row.kind === 'subtotal') {
                      const day = row.shift === 'D'
                      return (
                        <tr key={`sub-${row.floor}-${row.shift}`}
                          className={`${day ? 'bg-sky-50/70' : 'bg-indigo-50/70'} ${day ? 'border-t-2 border-gray-300' : ''}`}>
                          <td style={{ width: NAME_W, minWidth: NAME_W, maxWidth: NAME_W }}
                            className={`sticky left-0 z-10 ${day ? 'bg-sky-50' : 'bg-indigo-50'} border-b border-r border-gray-200 px-1.5 py-1`}>
                            <p className="text-[10.5px] font-extrabold text-gray-700 leading-tight truncate">
                              {row.floor || '층 미지정'}
                            </p>
                            <p className={`text-[9px] font-bold leading-tight ${day ? 'text-sky-700' : 'text-indigo-700'}`}>
                              {day ? '주간 소계' : '야간 소계'}
                            </p>
                          </td>
                          <td className="border-b border-gray-200 border-r border-gray-100" />
                          <td className="border-b border-gray-200 border-r-2 border-r-gray-300" />
                          {days.map(d => {
                            const n = countOn(row.ids, d, row.shift)
                            const iso = `${ym}-${String(d).padStart(2, '0')}`
                            return (
                              <td key={d}
                                className={`border-b border-gray-200 ${vLine(d)} p-0.5 text-center ${iso === todayIso ? 'bg-amber-100' : ''}`}>
                                {/* 0 은 흐리게 — 아무도 안 나오는 날이 눈에 띄어야 한다 */}
                                <span className={`text-[11px] font-extrabold ${
                                  n === 0 ? 'text-gray-300' : day ? 'text-sky-700' : 'text-indigo-700'}`}>{n}</span>
                              </td>
                            )
                          })}
                          <td style={{ width: TOTAL_W, minWidth: TOTAL_W }}
                            className="border-b border-gray-200 border-l-2 border-l-gray-300" />
                        </tr>
                      )
                    }

                    const p = row.p
                    const prev = ri > 0 ? bodyRows[ri - 1] : null
                    const prevPos = prev && prev.kind === 'person' ? prev.p.pos : p.pos
                    const band = p.pos !== prevPos
                    return (
                      <tr key={p.id} className={band ? 'border-t-2 border-gray-200' : ''}>
                        <td style={{ width: NAME_W, minWidth: NAME_W, maxWidth: NAME_W }}
                          className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-1.5 py-1">
                          <p className="text-[12px] font-bold text-gray-800 leading-tight truncate">{p.name}</p>
                          <p className="text-[9px] text-gray-400 leading-tight truncate">{p.pos}</p>
                        </td>
                        <td className="border-b border-gray-100 border-r border-gray-100 px-1 py-1 text-center text-[10px] font-bold text-gray-500 whitespace-nowrap">{p.team || ''}</td>
                        <td className="border-b border-gray-100 border-r-2 border-r-gray-300 px-1 py-1 text-center text-[10px] font-bold text-teal-700 whitespace-nowrap">{p.floor || ''}</td>
                        {days.map(d => {
                          const iso = `${ym}-${String(d).padStart(2, '0')}`
                          const c = p.codes[String(d)] ?? ''
                          return (
                            <td key={d} className={`border-b border-gray-50 ${vLine(d)} p-0.5 text-center ${iso === todayIso ? 'bg-amber-50' : dayColor(d, false)}`}>
                              {c && (
                                <span className={`inline-block min-w-[24px] px-0.5 py-0.5 rounded text-[10px] font-bold leading-none ${codeCls(c)}`}>
                                  {splitTime(c)
                                    ? splitTime(c)!.map((t, i) => <span key={i} className="block leading-[1.15]">{t}</span>)
                                    : c}
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <TotalCell t={totals.get(p.id)} baseHours={baseHours} />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p ref={legendRef} className="mt-2 text-[11px] text-gray-400 leading-relaxed">
            D 주간 08:50~18:00 · M 06:50~16:00 · N 야간 18:00~익일 09:00 · <span className="text-rose-500 font-bold">休</span> 연차 ·
            숫자 코드는 시간대 근무 — 손가락 두 개로 확대·축소, 「한눈에」로 전체 보기 · 수정은 PC 「근무표」에서
            {doc?.updated_at && ` · 저장 ${new Date(doc.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * 총시간 칸.
 *
 * 기준에 모자라면 급여가 깎이는 쪽이라 더 급하다 — 빨갛게. 넘으면 수당
 * 문제라 주황으로. 기준이 저장돼 있지 않으면 판단하지 않고 시간만 적는다.
 * 모르면서 '정상' 이라고 말하지 않는다.
 *
 * 이름 열 바로 옆에 고정된다. 날짜가 31칸이라 오른쪽 끝에 두면 핸드폰에서
 * 끝까지 밀어야 보인다.
 */
function TotalCell({ t, baseHours }: {
  t?: { total: number; extra: number } | undefined
  baseHours: number
}) {
  const total = t?.total ?? 0
  const st = hourStatus(total, baseHours)
  const diff = hourDiff(total, baseHours)
  const tone =
    st === 'short' ? 'text-rose-600' :
    st === 'over' ? 'text-amber-600' :
    st === 'ok' ? 'text-emerald-600' : 'text-gray-700'
  return (
    <td style={{ width: TOTAL_W, minWidth: TOTAL_W }}
      className="border-b border-gray-100 border-l-2 border-l-gray-300
                 px-1 py-1 text-center whitespace-nowrap">
      <span className={`block text-[11.5px] font-extrabold leading-tight ${tone}`}>{total}</span>
      {diff !== null && diff !== 0 && (
        <span className={`block text-[8.5px] leading-tight ${tone}`}>
          {diff > 0 ? `+${diff}` : diff}
        </span>
      )}
      {!!t?.extra && (
        <span className="block text-[8px] text-purple-500 leading-tight" title="직접 적은 시간대(추가근무)">
          추 {t.extra}
        </span>
      )}
    </td>
  )
}
