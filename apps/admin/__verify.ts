import { planMembersMonths, type MonthContext } from './src/utils/shiftBalance'

const HOL = new Set(['2026-07-17','2026-08-15','2026-08-17','2026-09-24','2026-09-25','2026-09-26',
  '2026-10-03','2026-10-05','2026-10-09','2026-12-25'])

function ctxOf(y: number, m: number): MonthContext {
  const total = new Date(y, m, 0).getDate()
  const key = `${y}-${String(m).padStart(2,'0')}`
  let wd = 0
  for (let d = 1; d <= total; d++) {
    const dt = new Date(y, m-1, d)
    const iso = `${key}-${String(d).padStart(2,'0')}`
    if (dt.getDay() === 0 || dt.getDay() === 6) continue
    if (HOL.has(iso)) continue
    wd++
  }
  return {
    ym: key,
    days: Array.from({length: total}, (_, i) => ({ day: i+1, iso: `${key}-${String(i+1).padStart(2,'0')}` })),
    baseHours: wd * 8,
    holidays: HOL,
  }
}

const ctxs = [7,8,9,10,11,12].map(m => ctxOf(2026, m))
const members = [
  { id: 'a', name: '김원녀' },
  { id: 'b', name: '이해옥' },
  { id: 'c', name: '최진흥' },
]
const series = planMembersMonths(ctxs, 'B조', undefined, members)

console.log('B조 — 월별 이월/추가근무/갚음 (실제 TS 코드 실행)')
console.log('월  이름     이월    추가근무  갚음(휴가/단축)  실근무  기준   미상환')
series.forEach((month, i) => {
  month.forEach(p => {
    const pay = `${p.compDays}일` + (p.shortenHours ? `+${p.shortenHours}h` : '')
    console.log(`${(i+7).toString().padStart(2)}  ${p.name?.padEnd(5)} ${String(p.opening).padStart(5)}h ${String(p.extraHours).padStart(7)}h  ${pay.padEnd(14)} ${String(p.workedHours).padStart(6)}h ${String(p.baseHours).padStart(4)}h ${String(p.closing).padStart(6)}h`)
  })
  console.log('')
})

// 검증: 이월이 실제로 이어지는가
let ok = true
for (let i = 1; i < series.length; i++) {
  series[i].forEach(p => {
    const prev = series[i-1].find(x => x.memberId === p.memberId)!
    if (Math.abs(p.opening - prev.closing) > 1e-6) {
      console.log(`  불일치: ${p.name} ${i+7}월 이월 ${p.opening} ≠ 전월 미상환 ${prev.closing}`)
      ok = false
    }
  })
}
console.log(ok ? '✅ 매월 이월값이 전월 미상환과 정확히 일치 — 이어서 계산되고 있음'
               : '❌ 이월이 끊김')
const shortfall = series.flat().filter(p => p.workedHours < p.baseHours)
console.log(`기준 미달: ${shortfall.length}건`)
