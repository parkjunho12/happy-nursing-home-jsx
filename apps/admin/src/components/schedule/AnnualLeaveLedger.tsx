import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { ledgerAPI, type LedgerRow } from '@/api/leaveClient'

/**
 * 연차휴가 관리대장 — 엑셀 시트를 그대로 화면으로.
 *
 * 시설 규칙:
 *  · ★ 사용불가월 — 1일 입사자는 입사달만, 그 외는 입사달+다음달
 *  · 1년차 최대 11개 — 한 달 만근 + 다음 달 하루 근무 시 1개씩 발생
 *  · 2~3년차 15 · 4~5년차 16 · 6~7년차 17 · 8년차~ 18
 *  · 월 1회 사용 권장 — 쓸 수 있는데 안 쓴 지난달은 X로 표시
 *  · 연차 사용촉진제(근로기준법 61조) — 이월 없음. 촉진은 서면·개별 통지여야 하며
 *    연말에 전 직원 일괄 공지하는 것은 법적 효력이 없다.
 *    1년 이상(회계연도 부여): 1차 촉구 7/1~7/10, 2차 시기지정 통보 10/31까지, 12/31 소멸
 *    1년 미만(입사일 기준): 입사 1년 되는 날 역산 — 1차 3개월 전부터 10일, 2차 2개월 전까지
 *    그래서 이 대장의 역할은 '통지 시기를 놓치지 않고, 소멸 전에 쓰게 만드는 것'이다.
 * 사용 내역 = 승인된 연차 신청 + 근무표에 칠한 休 (합집합)
 */
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function AnnualLeaveLedger() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [monthNow, setMonthNow] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    ledgerAPI.get(year)
      .then(r => { setRows(r.rows); setMonthNow(r.month_now) })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [year])

  const th = 'px-2 py-1.5 text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-200 whitespace-nowrap'
  const td = 'px-2 py-1.5 text-xs border border-gray-100 text-center whitespace-nowrap'

  const fmtHire = (h?: string | null) => h ? `${h.slice(2, 4)}.${h.slice(5, 7)}.${h.slice(8, 10)}` : '-'
  const fmtUse = (ds: string[]) => ds.map(d => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`).join(', ')

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
          <button onClick={() => setYear(y => y - 1)} className="px-2 py-2 hover:bg-gray-50" aria-label="이전 해">
            <ChevronLeft className="w-4 h-4 text-gray-500" /></button>
          <span className="px-3 text-sm font-bold text-gray-800">{year}년 연차휴가 관리대장</span>
          <button onClick={() => setYear(y => y + 1)} className="px-2 py-2 hover:bg-gray-50" aria-label="다음 해">
            <ChevronRight className="w-4 h-4 text-gray-500" /></button>
        </div>
        <span className="text-[11px] text-gray-400">
          1년차 최대 11개(만근한 다음 달 근무 시 1개씩 발생) · 2~3년차 15 · 4~5년차 16 · 6~7년차 17 · 8년차~ 18 — 월 1회 사용 권장 · 이월 없음(연말 소멸)
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
          <table className="border-collapse min-w-[1100px] w-full">
            <thead>
              <tr>
                <th className={th}>순번</th>
                <th className={th}>직책</th>
                <th className={`${th} text-left`}>성명</th>
                <th className={th}>입사일</th>
                <th className={th} title="1년차는 한 달 만근 + 다음 달 근무 시 1개씩 발생 (만근 가정, 최대 11)">발생</th>
                <th className={th}>사용</th>
                <th className={th} title="사용촉진제 — 이월 없이 소멸 (소멸일은 사람마다 다름)">남은<br /><span className="font-normal text-gray-400">소멸</span></th>
                <th className={th} style={{ minWidth: 110 }}
                  title="근로기준법 61조 — 촉진은 서면·개별 통지. 연말 일괄 공지는 효력이 없습니다. 1년 이상=회계연도(1차 7/1~7/10, 2차 10/31까지), 1년 미만=입사 1년 기준 역산">촉진 통지<br /><span className="font-normal text-gray-400">서면·개별</span></th>
                {MONTHS.map(m => (
                  <th key={m} className={`${th} ${m === monthNow ? 'bg-indigo-50 text-indigo-700' : ''}`} style={{ minWidth: 52 }}>{m}월</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.staff_id} className="hover:bg-gray-50/50">
                  <td className={`${td} text-gray-400`}>{i + 1}</td>
                  <td className={`${td} text-gray-500`}>{r.position || '-'}</td>
                  <td className={`${td} text-left font-bold text-gray-800`}>
                    {r.name} <span className="text-[10px] font-normal text-gray-400">{r.service_year}년차</span>
                  </td>
                  <td className={`${td} text-gray-500`}>{fmtHire(r.hire_date)}</td>
                  <td className={td}>
                    {r.service_year === 1
                      ? <span title={`연간 최대 ${r.entitle}개 — 만근 시 월 1개 발생`}>{r.accrued}<span className="text-gray-300">/{r.entitle}</span></span>
                      : r.entitle}
                  </td>
                  <td className={`${td} text-gray-700`}>{r.used_total || ''}</td>
                  {(() => {
                    // 촉진제 핵심 경고: 남은 연차 > 남은 달 수면 월 1회로는 다 못 쓴다 = 소멸 예정
                    const monthsLeft = monthNow > 0 ? 12 - monthNow + 1 : 12
                    const risk = r.remaining > monthsLeft
                    return (
                      <td className={`${td} font-bold ${r.remaining < 0 ? 'text-red-600' : risk ? 'bg-red-50 text-red-600' : 'text-gray-800'}`}
                        title={risk ? `남은 ${r.remaining}개 > 남은 ${monthsLeft}개월 — 월 1회로는 연말까지 다 못 씁니다 (소멸 위험)` : '이월 없음 — 연말 소멸'}>
                        {r.remaining}{risk && <span className="block text-[9px] font-extrabold">소멸위험</span>}
                      </td>
                    )
                  })()}
                  {(() => {
                    const p = r.promotion
                    if (!p) return <td className={td}>-</td>
                    const today = new Date().toISOString().slice(0, 10)
                    const fmt = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
                    const inFirst = today >= p.first_notice[0] && today <= p.first_notice[1]
                    // 1차 기간이 지났는데 남은 연차가 있으면 2차 기한 강조
                    const needSecond = today > p.first_notice[1] && today <= p.second_deadline && r.remaining > 0
                    return (
                      <td className={`${td} text-[10px] leading-relaxed ${inFirst ? 'bg-amber-50 text-amber-700 font-bold' : needSecond ? 'bg-red-50 text-red-600 font-bold' : 'text-gray-500'}`}
                        title={`${p.basis === 'fiscal' ? '회계연도 기준' : '입사 1년 기준(1년 미만)'} — 소멸 ${p.expire_on}`}>
                        1차 {fmt(p.first_notice[0])}~{fmt(p.first_notice[1])}
                        <br />2차 {fmt(p.second_deadline)}까지
                        {inFirst && <span className="block text-[9px]">지금 1차 통지 기간!</span>}
                        {needSecond && <span className="block text-[9px]">2차 지정 통보 필요</span>}
                      </td>
                    )
                  })()}
                  {MONTHS.map(m => {
                    const blocked = r.blocked_months.includes(m)
                    const uses = r.used_by_month[String(m)] ?? []
                    // 쓸 수 있었는데 안 쓴 지난달 = X (월 1회 촉진용 표시)
                    const missed = !blocked && uses.length === 0 && monthNow > 0 && m < monthNow &&
                      !!r.hire_date && `${year}-${String(m).padStart(2, '0')}` >= r.hire_date.slice(0, 7)
                    return (
                      <td key={m} className={`${td} ${m === monthNow ? 'bg-indigo-50/40' : ''} ${
                        blocked ? 'bg-violet-50 text-violet-600 font-bold'
                        : uses.length ? 'text-emerald-700 font-semibold'
                        : missed ? 'text-gray-300' : 'text-gray-200'}`}
                        title={blocked ? '연차 사용불가월' : uses.length ? uses.join(', ') : missed ? '사용 없음' : ''}>
                        {blocked ? '★' : uses.length ? fmtUse(uses) : missed ? 'X' : ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={19} className="text-center py-10 text-sm text-gray-400">표시할 직원이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-gray-500">
        <span><span className="text-violet-600 font-bold">★</span> 사용불가월 (1일 입사=그달만 · 그 외=입사달+다음달)</span>
        <span><span className="text-emerald-700 font-semibold">6/10</span> 사용일</span>
        <span><span className="text-gray-300">X</span> 사용 가능했지만 안 씀 (월 1회 권장)</span>
        <span className="text-gray-400">사용 = 승인된 연차 신청 + 근무표의 休</span>
        <span className="text-red-500 font-semibold">촉진제 — 이월 없음 · 촉진 통지는 서면·개별(일괄 연말 공지는 효력 없음)</span>
        <span className="text-gray-400">1년 이상: 1차 7/1~7/10 · 2차 10/31까지 · 12/31 소멸 — 1년 미만: 입사 1년 기준 역산</span>
      </div>
    </div>
  )
}
