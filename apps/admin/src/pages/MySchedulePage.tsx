import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Sun, Moon, Coffee } from 'lucide-react'
import { workScheduleAPI, type MySchedule } from '@/api/workScheduleClient'
import { CODE_MAP, extraHoursOf, splitTimeRange } from '@/utils/shiftCodes'
import LeaveRequestCard from '@/components/schedule/LeaveRequestCard'
import PayslipCard from '@/components/schedule/PayslipCard'
import SwapRequestCard from '@/components/schedule/SwapRequestCard'

/**
 * 내 근무표 — 선생님들이 휴대폰으로 자기 근무만 확인하는 화면.
 *
 * 관리자용 31열 표는 휴대폰에서 읽을 수 없다. 여기서는
 * ① 오늘(내일) 근무를 문장으로 크게 ② 한 달 달력에 내 근무만 표시한다.
 * 대상 연령을 생각해 글자를 키우고 용어 설명을 붙인다.
 */

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

/** 근무 코드 → 사람 말 */
function describe(code?: string): { title: string; time?: string; icon: 'day' | 'night' | 'rest' } {
  const v = (code ?? '').trim()
  if (!v) return { title: '휴무', icon: 'rest' }
  const m = CODE_MAP[v]
  if (m) {
    if (m.group === '근무') return { title: `${m.label} 근무`, time: m.time, icon: m.countAs === 'N' ? 'night' : 'day' }
    return { title: m.label, icon: 'rest' }
  }
  const tr = splitTimeRange(v)
  // 시간이 직접 적힌 날은 추가근무일 수도, 단축 근무(초과분 갚는 날)일 수도 있다.
  // 본인 화면에서는 구분 없이 '시간 지정 근무'로 중립 표기 — 시간만 정확하면 된다.
  if (tr) return { title: '시간 지정 근무', time: `${tr[0].slice(0, 2)}:${tr[0].slice(2)} ~ ${tr[1].slice(0, 2)}:${tr[1].slice(2)} (${extraHoursOf(v)}시간)`, icon: 'day' }
  return { title: v, icon: 'day' }
}

const cellTone = (code?: string): string => {
  const v = (code ?? '').trim()
  if (!v) return 'bg-gray-50 text-gray-300'
  if (v === 'N') return 'bg-indigo-100 text-indigo-800'
  if (CODE_MAP[v]?.group === '휴무') return 'bg-emerald-50 text-emerald-700'
  return 'bg-sky-100 text-sky-800'
}

export default function MySchedulePage() {
  const [ym, setYm] = useState(thisMonth())
  const [data, setData] = useState<MySchedule | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setErr('')
    workScheduleAPI.mine(ym)
      .then(setData)
      .catch(e => {
        setData(null)
        const detail = e?.response?.data?.detail
        // 배포 전 백엔드(구버전)는 이 주소 자체가 없어 404가 난다 — 상황을 구분해 안내
        if (e?.response?.status === 404 && !detail) {
          setErr('서버가 아직 이 기능을 모릅니다. 백엔드를 새 버전으로 배포하면 열립니다.')
        } else {
          setErr(detail ?? e?.message ?? '근무표를 불러오지 못했습니다.')
        }
      })
      .finally(() => setLoading(false))
  }, [ym])

  const [y, m] = ym.split('-').map(Number)
  const today = new Date()
  const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m
  const todayDay = today.getDate()

  const weeks = useMemo(() => {
    const total = new Date(y, m, 0).getDate()
    const firstDow = new Date(y, m - 1, 1).getDay()
    const cells: (number | null)[] = [...Array(firstDow).fill(null)]
    for (let d = 1; d <= total; d++) cells.push(d)
    while (cells.length % 7) cells.push(null)
    const out: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
    return out
  }, [y, m])

  /** 오늘·내일·다음 근무 안내 */
  const brief = useMemo(() => {
    if (!data || !isThisMonth) return null
    const total = new Date(y, m, 0).getDate()
    const t = describe(data.codes[String(todayDay)])
    let next: { day: number; d: ReturnType<typeof describe> } | null = null
    for (let d = todayDay + 1; d <= total; d++) {
      const c = data.codes[String(d)]
      if (c && CODE_MAP[c]?.group !== '휴무') { next = { day: d, d: describe(c) }; break }
      if (c && !CODE_MAP[c]) { next = { day: d, d: describe(c) }; break }
    }
    return { today: t, next }
  }, [data, isThisMonth, todayDay, y, m])

  const Icon = ({ k, size = 22 }: { k: 'day' | 'night' | 'rest'; size?: number }) =>
    k === 'night' ? <Moon size={size} className="text-indigo-500" />
    : k === 'rest' ? <Coffee size={size} className="text-emerald-600" />
    : <Sun size={size} className="text-amber-500" />

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">내 근무표</h1>
          {data && <p className="text-sm text-gray-500">{data.staff_name} 선생님{data.team ? ` · ${data.team}` : ''}</p>}
        </div>
      </div>

      {/* 오늘 근무 — 가장 먼저 보이는 답 */}
      {brief && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 mb-3">
          <p className="text-sm text-gray-400 mb-1">오늘 {m}월 {todayDay}일 ({DOW[today.getDay()]})</p>
          <div className="flex items-center gap-3">
            <Icon k={brief.today.icon} size={30} />
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{brief.today.title}</p>
              {brief.today.time && <p className="text-base text-gray-500">{brief.today.time}</p>}
            </div>
          </div>
          {brief.next && (
            <p className="text-sm text-gray-500 mt-3 pt-3 border-t border-gray-50">
              다음 근무는 <b className="text-gray-800">{m}월 {brief.next.day}일 {brief.next.d.title}</b>
              {brief.next.d.time ? ` (${brief.next.d.time})` : ''} 입니다
            </p>
          )}
        </div>
      )}

      {/* 이번 달 내 근무가 이렇게 나온 이유 — 저장 시 만들어진 개인별 한 줄 */}
      {data?.note && (
        <div className="mb-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 px-4 py-3">
          <p className="text-xs font-bold text-indigo-500 mb-0.5">이번 달 내 근무 정리</p>
          <p className="text-sm text-gray-700 leading-relaxed">{data.note}</p>
        </div>
      )}

      {/* 월 이동 */}
      <div className="flex items-center justify-center gap-1 mb-2">
        <button onClick={() => setYm(shiftMonth(ym, -1))} className="p-3 rounded-xl hover:bg-gray-100" aria-label="이전 달">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <span className="text-lg font-bold text-gray-800 w-36 text-center">{y}년 {m}월</span>
        <button onClick={() => setYm(shiftMonth(ym, 1))} className="p-3 rounded-xl hover:bg-gray-100" aria-label="다음 달">
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
      ) : err ? (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 leading-relaxed">{err}</div>
      ) : !data || Object.keys(data.codes).length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center text-sm text-gray-400 leading-relaxed">
          {y}년 {m}월 근무표가 아직 나오지 않았습니다.<br />근무표가 나오면 여기에서 바로 보입니다.
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DOW.map((w, i) => (
                <div key={w} className={`py-2 text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{w}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((d, di) => {
                  const code = d ? data.codes[String(d)] : undefined
                  const isToday = isThisMonth && d === todayDay
                  const tr = code ? splitTimeRange(code) : null
                  return (
                    <div key={di} className={`min-h-[64px] p-1 border-b border-r border-gray-50 last:border-r-0 ${isToday ? 'ring-2 ring-inset ring-sky-400 rounded-lg' : ''}`}>
                      {d && (
                        <>
                          <p className={`text-xs font-semibold mb-1 ${di === 0 ? 'text-red-400' : di === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</p>
                          {code && (
                            <div className={`rounded-md px-1 py-1 text-center text-sm font-bold ${cellTone(code)}`}>
                              {tr ? <span className="text-[10px] leading-tight block">{tr[0]}<br />{tr[1]}</span> : code}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* 이 달 급여명세서 — 올라온 달에만 카드가 나타난다 */}
          <PayslipCard month={ym} />

          {/* 위에서 보던 달을 그대로 신청 카드에도 — 8월 보다가 신청하면 8월이 떠야 한다 */}
          <LeaveRequestCard month={ym} />
          <SwapRequestCard month={ym} />

          {/* 이번 달에 실제로 등장하는 코드만 설명 */}
          <div className="mt-3 rounded-2xl bg-white border border-gray-100 p-3">
            <p className="text-xs font-bold text-gray-500 mb-2">표시 안내</p>
            <div className="space-y-1.5">
              {Array.from(new Set(Object.values(data.codes))).map(c => {
                const d = describe(c)
                return (
                  <div key={c} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`w-12 shrink-0 text-center rounded-md py-0.5 text-xs font-bold ${cellTone(c)}`}>
                      {splitTimeRange(c) ? '시간' : c}
                    </span>
                    {d.title}{d.time ? ` — ${d.time}` : ''}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
