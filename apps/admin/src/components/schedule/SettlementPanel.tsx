import { Sparkles } from 'lucide-react'
import type { MemberMonthPlan } from '@/utils/shiftBalance'

/**
 * 교대조 정산 표 — 자동 생성 직후 '왜 이 근무가 나왔는지' 근거를 보여준다.
 * 이월·추가근무·갚음(휴가/단축)·미상환과, 못 갚은 시간의 예상 수당까지.
 */
export default function SettlementPanel({ plans, onClose, settleStart, wage, setWage, rate, setRate }: {
  plans: MemberMonthPlan[]
  onClose: () => void
  settleStart: string
  wage: string
  setWage: (v: string) => void
  rate: string
  setRate: (v: string) => void
}) {
  if (plans.length === 0) return null
  return (
          <div className="mb-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 print:hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={13} className="text-indigo-600" />
              <span className="text-xs font-bold text-indigo-800">교대조 근무시간 맞추기 <span className="font-normal text-indigo-500">(입사일 기준 개인별)</span></span>
              <span className="text-[11px] text-indigo-500">{settleStart.replace('-', '년 ')}월부터 이월 계산</span>
              <button onClick={() => onClose()} className="ml-auto text-[11px] text-gray-400 hover:text-gray-600">닫기</button>
            </div>
            <div className="overflow-x-auto">
              <table className="text-[11px] w-full min-w-[520px]">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left font-semibold py-1">이름</th>
                    <th className="font-semibold">조</th>
                    <th className="font-semibold">회전</th>
                    <th className="font-semibold">대휴</th>
                    <th className="font-semibold">이월<br /><span className="font-normal text-[10px]">지난달까지</span></th>
                    <th className="font-semibold">추가<br />근무</th>
                    <th className="font-semibold">갚음<br /><span className="font-normal text-[10px]">휴가·단축</span></th>
                    <th className="font-semibold">추가근무</th>
                    <th className="font-semibold">실근무</th>
                    <th className="font-semibold">기준</th>
                    <th className="font-semibold">못 갚은<br />추가근무</th>
                    <th className="font-semibold">예상 수당</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.memberId} className="border-t border-indigo-100/70">
                      <td className="py-1 font-bold text-gray-700">
                        {p.name}
                        {p.activeDays < p.monthDays && (
                          <span className="ml-1 text-[10px] font-normal text-amber-600">재직 {p.activeDays}/{p.monthDays}일</span>
                        )}
                      </td>
                      <td className="text-center text-gray-500">{p.team}</td>
                      <td className="text-center text-gray-500">{p.rotationHours}h</td>
                      <td className="text-center text-amber-700">{p.daehyuDays || '-'}{p.daehyuDays ? '일' : ''}</td>
                      <td className={`text-center font-semibold ${p.opening > 0 ? 'text-amber-700' : 'text-gray-300'}`}>
                        {p.opening > 0 ? `${p.opening}h` : '-'}
                      </td>
                      <td className="text-center text-sky-700">{p.extraHours > 0 ? `${p.extraHours}h` : '-'}</td>
                      <td className="text-center text-violet-700">
                        {p.paidBack > 0
                          ? <>{p.compDays > 0 && `${p.compDays}일`}{p.compDays > 0 && p.shortenHours > 0 && '+'}{p.shortenHours > 0 && `${p.shortenHours}h단축`}</>
                          : '-'}
                      </td>
                      <td className="text-center text-violet-700">{p.extraHours > 0 ? `${p.extraHours}h` : '-'}</td>
                      <td className={`text-center font-bold ${Math.abs(p.workedHours - p.baseHours) > 8 ? 'text-red-600' : 'text-gray-800'}`}>{p.workedHours}h</td>
                      <td className="text-center text-gray-500">{p.baseHours}h</td>
                      <td className={`text-center font-semibold ${p.closing === 0 ? 'text-gray-400' : 'text-emerald-700'}`}>
                        {p.closing > 0 ? `${p.closing}h` : '0'}
                      </td>
                      <td className="text-center text-gray-600">
                        {p.closing > 0 && Number(wage) > 0
                          ? `${Math.round(p.closing * Number(wage) * (Number(rate) || 1)).toLocaleString()}원`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-indigo-100">
              <span className="text-[11px] font-bold text-indigo-800">못 갚은 추가근무를 수당으로</span>
              <label className="text-[11px] text-gray-500">시급
                <input value={wage} onChange={e => setWage(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="10320" className="ml-1 w-20 px-2 py-1 text-[12px] border border-gray-200 rounded-lg text-right" />원
              </label>
              <label className="text-[11px] text-gray-500">가산율
                <input value={rate} onChange={e => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="ml-1 w-12 px-2 py-1 text-[12px] border border-gray-200 rounded-lg text-right" />배
              </label>
              {Number(wage) > 0 && (() => {
                const owed = plans.reduce((a, p) => a + Math.max(0, p.closing), 0)
                return (
                  <span className="text-[11.5px] font-bold text-indigo-800">
                    합계 {Math.round(owed * 10) / 10}시간 · 약 {Math.round(owed * Number(wage) * (Number(rate) || 1)).toLocaleString()}원
                  </span>
                )
              })()}
              <span className="text-[11px] text-gray-400">연장근로 가산은 통상임금의 50%(1.5배)가 일반적입니다 — 시설 기준에 맞게 조정하세요.</span>
            </div>
            <p className="text-[11px] text-indigo-600 mt-1.5">
              공휴일에 근무하면 <b>대체휴무</b>로 다른 날 쉬고, 그만큼 줄어든 시간은 <b>추가근무</b>(0850~)로 채웁니다.
              쉬는 날 나와서 일한 추가근무는 쌓아 두었다가, 기준시간을 넘는 여유가 생기면
              <b>초과근무 휴가</b>(하루)나 <b>근무 단축</b>(0850~1600 등)으로 갚습니다.
              연말까지 못 갚은 시간은 위의 <b>예상 수당</b>으로 지급하시면 됩니다.
            </p>
          </div>
  )
}
