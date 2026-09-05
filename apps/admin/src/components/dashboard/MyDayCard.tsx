import { useEffect, useState } from 'react'
import { BedDouble, CalendarClock, Loader2, Sun, Moon, Clock3 } from 'lucide-react'
import { caregiverDayAPI, type MyDay } from '@/api/caregiverDayClient'

/**
 * 요양보호사가 앱을 열었을 때 맨 처음 보는 것 — 오늘 무슨 근무이고,
 * 몇 시에 무엇을 하고, 어느 어르신을 맡는가.
 *
 * 왜 맨 위인가
 *   출근길에 앱을 여는 이유는 딱 이 셋이다. 그 아래에 있는 것들(서류 현황·
 *   채용·인력배치)은 오늘 손이 가는 일이 아니다. 아래로 내려야 보이는
 *   정보는 없는 것과 같다.
 *
 * 쉬는 날에는 일과를 내지 않는다
 *   근무 코드가 휴무면 '오늘은 쉬는 날' 한 줄이면 된다. 쉬는 날 아침에
 *   기상 도움 일과가 펼쳐져 있으면 순간 출근인 줄 안다.
 *
 * 계정이 직원 명단과 연결돼 있지 않으면 그렇다고 말한다. 빈 화면을 두면
 * 본인이 잘못 본 줄 알고 계속 새로고침한다.
 */
export default function MyDayCard() {
  const [d, setD] = useState<MyDay | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    caregiverDayAPI.mine().then(setD).catch(() => setErr(true))
  }, [])

  if (err) return null                    // 이 카드 하나 때문에 대시보드를 막지 않는다
  if (!d) return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 flex justify-center">
      <Loader2 size={16} className="animate-spin text-gray-300" />
    </div>
  )

  // 쉬는 날은 '쉬는 코드' 일 때만. 모르는 코드(직접 적은 '0930 1230' 같은
  // 시간대)를 쉬는 날로 보이면, 출근해야 하는 아침에 쉬는 날이라고 뜬다.
  const OFF_CODES = ['休', '대휴', '초과휴', '◆병', '◆']
  const off = !d.shift_code || OFF_CODES.includes(d.shift_code)
  const night = d.shift_code === 'N'
  const today = new Date(d.date + 'T00:00:00')
  const dow = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()]

  return (
    <section className={`rounded-2xl border shadow-sm overflow-hidden ${night ? 'border-indigo-200' : 'border-teal-200'}`}>
      {/* 오늘 무슨 근무인가 — 제일 큰 글자로. 이것 하나 보려고 여는 사람이 많다 */}
      <div className={`px-4 py-3 flex items-center gap-3 ${night ? 'bg-indigo-600' : off ? 'bg-gray-500' : 'bg-teal-600'}`}>
        {night ? <Moon size={20} className="text-white/90" /> : <Sun size={20} className="text-white/90" />}
        <div>
          <p className="text-[11px] font-bold text-white/70">
            {d.date.slice(5).replace('-', '월 ')}일 ({dow}){d.floor && ` · ${d.floor}`}
          </p>
          <p className="text-lg font-extrabold text-white leading-tight">
            {d.staff_name ? `${d.staff_name} 선생님 · ` : ''}
            {!d.shift_code ? '오늘 근무가 없습니다' : off ? d.shift_label : `${d.shift_label} 근무`}
          </p>
        </div>
        <span className="ml-auto text-2xl font-black text-white/80">{d.shift_code ?? '—'}</span>
      </div>

      <div className="bg-white">
        {!d.linked ? (
          <p className="px-4 py-5 text-sm text-gray-500 text-center">
            계정이 직원 명단과 연결되어 있지 않습니다.<br />
            <span className="text-xs text-gray-400">관리자에게 계정 연동을 요청해 주세요 — 연동하면 오늘 근무와 담당 어르신이 여기에 나옵니다.</span>
          </p>
        ) : (
          <>
            {/* 오늘 일과 */}
            {!off && (
              <div className="px-4 pt-3">
                <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <CalendarClock size={13} /> 오늘 일과
                </p>
                {d.items.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">아직 등록된 일과가 없습니다.</p>
                ) : (
                  <ul className="space-y-1">
                    {d.items.map((it, i) => (
                      <li key={i} className={`flex gap-2.5 items-start rounded-lg px-2 py-1.5 ${it.kind === 'extra' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                        <span className={`shrink-0 w-[52px] text-[13px] font-extrabold tabular-nums ${it.kind === 'extra' ? 'text-amber-700' : 'text-teal-700'}`}>
                          {it.time ?? <Clock3 size={12} className="inline text-gray-300" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="text-[13px] font-bold text-gray-900">{it.title}</span>
                          {/* 오늘만의 일은 눈에 띄어야 한다 — 늘 하던 것과 섞이면 놓친다 */}
                          {it.kind === 'extra' && <span className="ml-1.5 text-[10px] font-extrabold text-amber-700">오늘만</span>}
                          {it.end && <span className="ml-1.5 text-[11px] text-gray-400">~{it.end}</span>}
                          {it.note && <span className="block text-[11px] text-gray-500">{it.note}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 내 담당 어르신 */}
            <div className="px-4 py-3">
              <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-1.5">
                <BedDouble size={13} /> 내 담당 어르신
                <span className="font-extrabold text-gray-700">{d.residents.length}명</span>
              </p>
              {d.residents.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">아직 배정된 어르신이 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {d.residents.map(r => (
                    <span key={r.id} title={r.note ?? undefined}
                      className="inline-flex items-center gap-1 rounded-lg border border-teal-100 bg-teal-50 px-2 py-1">
                      <span className="text-[10px] font-bold text-teal-600">{r.room ? `${r.room}호` : r.floor}</span>
                      <span className="text-[13px] font-extrabold text-gray-900">{r.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
