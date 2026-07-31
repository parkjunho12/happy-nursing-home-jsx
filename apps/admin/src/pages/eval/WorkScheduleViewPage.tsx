import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Loader2, Minus, Plus, ZoomIn } from 'lucide-react'
import { workScheduleAPI, type WorkScheduleDoc, type HolidayInfo } from '@/api/workScheduleClient'
import { sortScheduleStaff } from '@/components/schedule/shared'
import { useLtcStore } from '@/store/ltc'

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
const DOW = ['일', '월', '화', '수', '목', '금', '토']

export default function WorkScheduleViewPage() {
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [doc, setDoc] = useState<WorkScheduleDoc | null>(null)
  const [hols, setHols] = useState<Record<string, HolidayInfo>>({})
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const { staffList, loaded, loadAll } = useLtcStore()

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])
  useEffect(() => {
    setLoading(true)
    Promise.all([
      workScheduleAPI.get(ym).catch(() => null),
      workScheduleAPI.holidays(ym).catch(() => ({} as Record<string, HolidayInfo>)),
    ]).then(([d, h]) => { setDoc(d); setHols(h) }).finally(() => setLoading(false))
  }, [ym])

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
        hireDate: hireOf.get(r.staff_id) ?? '',
        codes: doc.data?.[r.staff_id] ?? {},
      }))
      .filter(r => Object.keys(r.codes).length > 0 || r.name !== '(퇴사)')
    return sortScheduleStaff(rows)
  }, [doc, staffList])

  const dayColor = (day: number, forText = true) => {
    const iso = `${ym}-${String(day).padStart(2, '0')}`
    const dow = new Date(y, m - 1, day).getDay()
    if ((hols[iso] && hols[iso].kind !== 'paid') || dow === 0) return forText ? 'text-red-500' : 'bg-red-50/60'
    if (dow === 6) return forText ? 'text-blue-500' : 'bg-blue-50/60'
    return forText ? 'text-gray-600' : ''
  }

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
          <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-500"><Minus size={14} /></button>
          <button onClick={() => setZoom(1)} className="text-xs font-bold text-gray-600 w-11 text-center">{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(1)))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-500"><Plus size={14} /></button>
        </div>
      </div>

      {/* 월 이동 */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button onClick={() => move(-1)} className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500 text-lg">‹</button>
        <span className="text-base font-bold text-gray-800">{y}년 {m}월</span>
        <button onClick={() => move(1)} className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500 text-lg">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : empty ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm">{m}월 근무표가 아직 저장되지 않았습니다.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto max-h-[74vh]"
            style={{ WebkitOverflowScrolling: 'touch' }}>
            <div style={{ zoom }}>
              <table className="border-collapse" style={{ minWidth: 'max-content' }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 px-2 py-1.5 text-[11px] font-bold text-gray-500 text-left min-w-[72px]">성명</th>
                    <th className="border-b border-gray-200 px-1 py-1.5 text-[10px] font-bold text-gray-400">조</th>
                    {days.map(d => {
                      const iso = `${ym}-${String(d).padStart(2, '0')}`
                      return (
                        <th key={d} className={`border-b border-gray-200 px-0.5 py-1 text-center min-w-[30px] ${iso === todayIso ? 'bg-amber-100' : dayColor(d, false)}`}>
                          <p className={`text-[11px] font-extrabold leading-none ${dayColor(d)}`}>{d}</p>
                          <p className={`text-[8.5px] leading-tight ${dayColor(d)}`}>{DOW[new Date(y, m - 1, d).getDay()]}</p>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p, pi) => {
                    const prevPos = pi > 0 ? people[pi - 1].pos : p.pos
                    const band = p.pos !== prevPos
                    return (
                      <tr key={p.id} className={band ? 'border-t-2 border-gray-200' : ''}>
                        <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-2 py-1 whitespace-nowrap">
                          <p className="text-[12px] font-bold text-gray-800 leading-tight">{p.name}</p>
                          <p className="text-[9px] text-gray-400 leading-tight">{p.pos}</p>
                        </td>
                        <td className="border-b border-gray-100 px-1 py-1 text-center text-[10px] font-bold text-gray-500 whitespace-nowrap">{p.team || ''}</td>
                        {days.map(d => {
                          const iso = `${ym}-${String(d).padStart(2, '0')}`
                          const c = p.codes[String(d)] ?? ''
                          return (
                            <td key={d} className={`border-b border-gray-50 p-0.5 text-center ${iso === todayIso ? 'bg-amber-50' : dayColor(d, false)}`}>
                              {c && (
                                <span className={`inline-block min-w-[24px] px-0.5 py-0.5 rounded text-[10px] font-bold leading-none ${codeCls(c)}`}>
                                  {c}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
            D 주간 08:50~18:00 · M 06:50~16:00 · N 야간 17:50~익일 09:00 · <span className="text-rose-500 font-bold">休</span> 연차 ·
            숫자 코드는 시간대 근무 — 수정은 PC 「근무표」에서
            {doc?.updated_at && ` · 저장 ${new Date(doc.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </>
      )}
    </div>
  )
}
