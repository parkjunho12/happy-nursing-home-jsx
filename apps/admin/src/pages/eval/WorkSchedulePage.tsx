import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Save, RotateCcw, Eraser, Loader2, CalendarDays } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { workScheduleAPI, type ScheduleData } from '@/api/workScheduleClient'

type Shift = { code: string; short: string; label: string; cls: string }
const SHIFTS: Shift[] = [
  { code: 'D', short: '주', label: '주간', cls: 'bg-sky-100 text-sky-800' },
  { code: 'N', short: '야', label: '야간', cls: 'bg-indigo-100 text-indigo-800' },
  { code: 'O', short: '오', label: '오프', cls: 'bg-gray-100 text-gray-500' },
  { code: 'V', short: '연', label: '연차', cls: 'bg-emerald-100 text-emerald-800' },
  { code: 'E', short: '교', label: '교육', cls: 'bg-amber-100 text-amber-800' },
  { code: 'H', short: '반', label: '반가', cls: 'bg-teal-100 text-teal-800' },
]
const SHIFT_MAP: Record<string, Shift> = Object.fromEntries(SHIFTS.map(s => [s.code, s]))
const DOW = ['일', '월', '화', '수', '목', '금', '토']

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function WorkSchedulePage() {
  const { staffList, loaded, loadAll, settings } = useLtcStore()
  const [ym, setYm] = useState(thisMonth())
  const [data, setData] = useState<ScheduleData>({})
  const [brush, setBrush] = useState<string>('D')   // 현재 선택된 근무('' = 지우개)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)
  const [pos, setPos] = useState('')
  const [q, setQ] = useState('')
  const painting = useRef(false)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])

  useEffect(() => {
    setLoading(true)
    workScheduleAPI.get(ym)
      .then(doc => { setData(doc.data || {}); setUpdatedBy(doc.updated_by ?? null); setDirty(false) })
      .catch(() => { setData({}); setUpdatedBy(null) })
      .finally(() => setLoading(false))
  }, [ym])

  useEffect(() => {
    const up = () => { painting.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const [y, m] = ym.split('-').map(Number)
  const days = useMemo(() => {
    const n = new Date(y, m, 0).getDate()
    return Array.from({ length: n }, (_, i) => {
      const dow = new Date(y, m - 1, i + 1).getDay()
      return { day: i + 1, dow }
    })
  }, [y, m])

  const positions = useMemo(() => Array.from(new Set(staffList.map(s => s.position).filter(Boolean))) as string[], [staffList])
  const staff = useMemo(() => staffList
    .filter(s => s.status === 'active')
    .filter(s => !pos || s.position === pos)
    .filter(s => !q || s.name.includes(q) || (s.position ?? '').includes(q))
    .sort((a, b) => (a.position ?? '').localeCompare(b.position ?? '') || a.name.localeCompare(b.name)),
    [staffList, pos, q])

  const apply = (staffId: string, day: number) => {
    setData(prev => {
      const row = { ...(prev[staffId] || {}) }
      if (!brush) delete row[String(day)]
      else row[String(day)] = brush
      return { ...prev, [staffId]: row }
    })
    setDirty(true)
  }

  const cell = (staffId: string, day: number) => data[staffId]?.[String(day)] || ''
  const countFor = (staffId: string, codes: string[]) =>
    days.reduce((n, d) => n + (codes.includes(cell(staffId, d.day)) ? 1 : 0), 0)
  const dailyCount = (day: number, code: string) =>
    staff.reduce((n, s) => n + (cell(s.id, day) === code ? 1 : 0), 0)

  const save = async () => {
    setSaving(true)
    try { const doc = await workScheduleAPI.save(ym, data); setUpdatedBy(doc.updated_by ?? null); setDirty(false) }
    catch (e: any) { alert(e?.message ?? '저장 실패') }
    finally { setSaving(false) }
  }

  const facility = settings?.facilityName || '행복한요양원'
  const th = 'border border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 px-1 py-1'
  const tdc = 'border border-gray-100 text-center p-0'

  return (
    <div className="p-4 md:p-6 max-w-full">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .ws-cell { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>

      {/* 헤더 (인쇄 제외) */}
      <div className="no-print flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-orange/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">근무표</h1>
            <p className="text-xs text-gray-400">월별 근무 스케줄 · 시설장·관리자 전용{updatedBy ? ` · 최근수정 ${updatedBy}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 hover:border-primary-orange hover:text-primary-orange rounded-xl font-semibold text-sm">
            <Printer className="w-4 h-4" /> 인쇄
          </button>
          <button onClick={save} disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-orange hover:bg-primary-orange/90 text-white rounded-xl font-semibold text-sm shadow-sm disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {dirty ? '저장' : '저장됨'}
          </button>
        </div>
      </div>

      {/* 컨트롤 바 (인쇄 제외) */}
      <div className="no-print flex items-center gap-2 mb-3 flex-wrap">
        <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => setYm(shiftMonth(ym, -1))} className="px-2 py-2 hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <span className="px-3 text-sm font-bold text-gray-800 tabular-nums">{y}년 {m}월</span>
          <button onClick={() => setYm(shiftMonth(ym, 1))} className="px-2 py-2 hover:bg-gray-50"><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => setYm(thisMonth())} className="px-2.5 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"><RotateCcw size={13} /></button>
        <select value={pos} onChange={e => setPos(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="">전체 직종</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="직원 검색" className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-32" />
        <span className="text-xs text-gray-400 ml-auto">{staff.length}명</span>
      </div>

      {/* 근무 팔레트 (인쇄 제외) */}
      <div className="no-print flex items-center gap-1.5 mb-3 flex-wrap bg-gray-50 rounded-xl p-2">
        <span className="text-xs font-bold text-gray-500 px-1">근무 선택 →</span>
        {SHIFTS.map(s => (
          <button key={s.code} onClick={() => setBrush(s.code)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${s.cls} ${brush === s.code ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-80 border-transparent'}`}>
            {s.label}({s.short})
          </button>
        ))}
        <button onClick={() => setBrush('')} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border ${brush === '' ? 'bg-white ring-2 ring-offset-1 ring-gray-400 text-gray-700' : 'bg-white text-gray-400 border-gray-200'}`}>
          <Eraser size={13} /> 지우기
        </button>
        <span className="text-[11px] text-gray-400 ml-1">칸을 클릭·드래그해서 채우세요</span>
      </div>

      {/* 인쇄 영역 */}
      <div className="print-area">
        <div className="hidden print:block mb-2">
          <h2 className="text-lg font-bold text-gray-900">{facility} 근무표 — {y}년 {m}월</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16 border border-gray-100 rounded-xl bg-white">표시할 재직 직원이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
            <table className="border-collapse text-center select-none" style={{ minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th className={`${th} sticky left-0 z-10 bg-gray-50 text-left min-w-[92px]`}>직원</th>
                  {days.map(d => (
                    <th key={d.day} className={`${th} w-8 ${d.dow === 0 ? 'text-red-500' : d.dow === 6 ? 'text-sky-500' : ''}`}>
                      <div>{d.day}</div><div className="font-normal">{DOW[d.dow]}</div>
                    </th>
                  ))}
                  <th className={`${th} w-9`}>근무</th>
                  <th className={`${th} w-9`}>야간</th>
                  <th className={`${th} w-9`}>오프</th>
                  <th className={`${th} w-9`}>연차</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id}>
                    <td className="border border-gray-100 text-left px-2 py-1 sticky left-0 z-10 bg-white min-w-[92px]">
                      <div className="text-xs font-bold text-gray-800 truncate">{s.name}</div>
                      {s.position && <div className="text-[10px] text-gray-400 truncate">{s.position}</div>}
                    </td>
                    {days.map(d => {
                      const c = cell(s.id, d.day)
                      const sh = c ? SHIFT_MAP[c] : null
                      return (
                        <td key={d.day} className={`${tdc} ${d.dow === 0 ? 'bg-red-50/40' : d.dow === 6 ? 'bg-sky-50/40' : ''}`}>
                          <div
                            onMouseDown={() => { painting.current = true; apply(s.id, d.day) }}
                            onMouseEnter={() => { if (painting.current) apply(s.id, d.day) }}
                            className={`ws-cell w-8 h-8 flex items-center justify-center text-[11px] font-bold cursor-pointer ${sh ? sh.cls : 'text-gray-300 hover:bg-orange-50'}`}>
                            {sh ? sh.short : '·'}
                          </div>
                        </td>
                      )
                    })}
                    <td className="border border-gray-100 text-xs font-bold text-gray-700">{countFor(s.id, ['D', 'N'])}</td>
                    <td className="border border-gray-100 text-xs text-indigo-600">{countFor(s.id, ['N'])}</td>
                    <td className="border border-gray-100 text-xs text-gray-400">{countFor(s.id, ['O'])}</td>
                    <td className="border border-gray-100 text-xs text-emerald-600">{countFor(s.id, ['V'])}</td>
                  </tr>
                ))}
                {/* 일별 커버리지 */}
                <tr className="bg-gray-50">
                  <td className={`${th} sticky left-0 z-10 bg-gray-50 text-left`}>일별 주/야</td>
                  {days.map(d => (
                    <td key={d.day} className="border border-gray-200 text-[10px] leading-tight py-0.5">
                      <div className="text-sky-600 font-bold">{dailyCount(d.day, 'D')}</div>
                      <div className="text-indigo-600">{dailyCount(d.day, 'N')}</div>
                    </td>
                  ))}
                  <td className={th} colSpan={4}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 범례 */}
        <div className="flex items-center gap-2 flex-wrap mt-3 text-[11px] text-gray-500">
          <span className="font-bold">범례:</span>
          {SHIFTS.map(s => (
            <span key={s.code} className={`px-2 py-0.5 rounded ${s.cls} font-semibold`}>{s.short} {s.label}</span>
          ))}
          <span className="ml-2">· 하단 «일별 주/야»는 그 날 주간/야간 근무 인원 수</span>
        </div>
      </div>
    </div>
  )
}
