import type { StaffRow } from './shared'

/**
 * 근무상황부(출석부) — 사람마다 A4 한 장, 인쇄 전용.
 *
 * 50~60대 선생님이 벽에서 떼서 바로 적는 종이다:
 *  · 날짜 옆에 요일을 함께 — "오늘이 몇 번째 줄이지?"를 없앤다
 *  · 일요일·공휴일 빨강, 토요일 파랑 — 근무표와 같은 색 약속
 *  · 근무형태·출근·퇴근·서명 모두 공란 — 본인이 그날그날 손으로 적는다
 */
export default function AttendanceSheets({ ym, staff, holidays }: {
  ym: string                                         // 'YYYY-MM'
  staff: StaffRow[]                                  // 선택된 인원 (표시 순서대로)
  holidays?: Record<string, { name: string; kind?: string }>   // 'YYYY-MM-DD' → 공휴일
}) {
  const [y, m] = ym.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  const left = Array.from({ length: 15 }, (_, i) => i + 1)
  const right = Array.from({ length: total - 15 }, (_, i) => i + 16)
  const DOW = ['일', '월', '화', '수', '목', '금', '토']

  const iso = (d: number) => `${ym}-${String(d).padStart(2, '0')}`
  const dayColor = (d: number) => {
    const w = new Date(y, m - 1, d).getDay()
    const h = holidays?.[iso(d)]
    // 근로자의 날(kind='paid')은 관공서 공휴일이 아니라 빨간 날로 치지 않는다 (근무표와 동일)
    if (w === 0 || (h && h.kind !== 'paid')) return 'att-red'
    if (w === 6) return 'att-blue'
    return ''
  }
  const dowOf = (d: number) => DOW[new Date(y, m - 1, d).getDay()]

  // 표가 주인공 — 손으로 적는 칸을 크게, 안내는 작게
  const th = 'border border-gray-800 px-1 py-[5px] text-[12px] font-bold text-center bg-gray-50'
  const td = 'border border-gray-800 px-1 text-[14px] text-center'

  const Row = ({ day }: { day?: number }) => (
    <>
      <td className={`${td} w-14 h-[34px] font-extrabold ${day ? dayColor(day) : ''}`}>
        {day ? <>{day} <span className="text-[11px] font-bold">{dowOf(day)}</span></> : ''}
      </td>
      <td className={`${td} w-16`}></td>
      <td className={`${td} w-20 text-gray-300`}>{day ? ':' : ''}</td>
      <td className={`${td} w-20 text-gray-300`}>{day ? ':' : ''}</td>
      <td className={`${td} w-24`}></td>
    </>
  )

  return (
    <div className="att-sheets hidden print:block">
      {staff.map(s => (
        <div key={s.id} className="att-page">
          {/* 상단 — 제목이 주인공, 성명·확인은 우상단에 작게 */}
          <div className="flex items-end justify-between mb-1.5">
            <h1 className="text-2xl font-extrabold tracking-[0.3em]">
              {y}년 {m}월 근무상황부
            </h1>
            <table className="border-collapse shrink-0">
              <tbody>
                <tr>
                  <td className="border border-gray-800 bg-gray-100 px-2 py-[2px] text-[10px] font-bold text-center w-20">성 명</td>
                  <td className="border border-gray-800 bg-gray-100 px-2 py-[2px] text-[10px] font-bold text-center w-16">확 인</td>
                </tr>
                <tr>
                  <td className="border border-gray-800 h-7 text-[13px] font-bold text-center">{s.name}</td>
                  <td className="border border-gray-800 h-7"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 근무 형태 — 한 줄 작게 */}
          <p className="text-[9px] text-gray-500 text-center border border-gray-300 rounded px-1 py-[3px] mb-2">
            근무형태&nbsp;&nbsp;D 08:50~18:00 · M 06:50~16:00 · N 17:50~익일09:00 · 休 연차 · 대휴 공휴일근무보상 · 초과휴 추가근무보상
          </p>

          {/* 1~15 | 16~말일 2단 표 */}
          <table className="att-table w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>일</th><th className={th}>근무<br />형태</th>
                <th className={th}>출근</th><th className={th}>퇴근</th><th className={th}>서명</th>
                <th className="w-3 border-0"></th>
                <th className={th}>일</th><th className={th}>근무<br />형태</th>
                <th className={th}>출근</th><th className={th}>퇴근</th><th className={th}>서명</th>
              </tr>
            </thead>
            <tbody>
              {left.map((d, i) => (
                <tr key={d}>
                  <Row day={d} />
                  <td className="border-0"></td>
                  {right[i] !== undefined
                    ? <Row day={right[i]} />
                    : i === left.length - 1
                      ? <td colSpan={5} className={`${td} h-[34px] font-bold tracking-widest`}>행복한요양원 녹양역점</td>
                      : <Row />}
                </tr>
              ))}
              {right.length >= 15 && (
                <tr>
                  <td colSpan={5} className={`${td} h-[34px] font-bold tracking-widest`}>행복한요양원 녹양역점</td>
                  <td className="border-0"></td>
                  {right[15] !== undefined ? <Row day={right[15]} /> : <Row />}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
