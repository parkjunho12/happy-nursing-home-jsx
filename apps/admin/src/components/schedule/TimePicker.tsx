import { toKorean, toHHMM, koreanLabel, type Ampm } from '@/utils/koreanTime'

/**
 * 시각 선택 — 한국말 순서 그대로 오전/오후 → 시 → 분.
 *
 * 왜 목록(select)을 걷어냈나.
 *   10분 단위로 바꾸니 선택지가 144줄이 됐다. 오후 2시 40분 하나 고르자고
 *   144줄을 훑는 건 병원 예약을 옮겨 적는 일에 비해 너무 큰 품이다.
 *   버튼 판으로 두면 세 번 눌러 끝난다. 스크롤도, 타이핑도 없다.
 *
 * 왜 이 순서인가.
 *   우리는 "오후 두시 사십분" 이라고 말한다. 화면도 그 순서로 둔다.
 *   숫자만 큼직하게 놓아 한 번에 눈에 들어오게 했다 — 쓰시는 분들 중에는
 *   작은 글씨가 힘든 분도 있다.
 *
 * 10분 배수가 아닌 값(지난 기록의 14:45 같은 것)이 들어오면 그 분도 함께
 * 보여준다. 안 보여주면 열자마자 값이 사라진 것처럼 보인다.
 */
const MINUTES = [0, 10, 20, 30, 40, 50]
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]   // 12시가 먼저 — 12시 다음이 1시다

export default function TimePicker({
  value, onChange, minHour = 0, maxHour = 23, emptyLabel = '시간 미정',
}: {
  value: string
  onChange: (hhmm: string) => void
  /** 고를 수 있는 시(24시각). 밖의 시간은 눌리지 않는다 */
  minHour?: number
  maxHour?: number
  /** 값이 없을 때 위에 뭐라고 적을지 */
  emptyLabel?: string
}) {
  const parsed = toKorean(value)
  // 값이 없을 때 아무 시각이나 골라 놓은 것처럼 보이면 안 된다.
  // '지정 안 함' 이 뜻이 있는 화면이 있어서, 비었으면 아무 칸도 칠하지 않는다.
  const empty = !parsed
  const k = parsed ?? { ampm: '오전' as Ampm, hour12: 9, minute: 0 }

  /** 오전/오후 + 12시각 표기 → 24시각의 시 */
  const h24 = (ampm: Ampm, h12: number) => (h12 % 12) + (ampm === '오후' ? 12 : 0)
  const enabled = (ampm: Ampm, h12: number) => {
    const h = h24(ampm, h12)
    return h >= minHour && h <= maxHour
  }
  const ampmOk = (a: Ampm) => HOURS.some(h => enabled(a, h))

  const set = (p: Partial<typeof k>) => {
    const next = { ...k, ...p }
    // 오전↔오후를 옮겼는데 그 시간이 범위 밖이면, 누를 수 있는 가장 이른 시로 옮긴다.
    // 그러지 않으면 눌러도 아무 일이 안 일어나 고장 난 것처럼 보인다.
    if (!enabled(next.ampm, next.hour12)) {
      const first = HOURS.find(h => enabled(next.ampm, h))
      if (first === undefined) return
      next.hour12 = first
    }
    onChange(toHHMM(next))
  }

  // 10분 배수가 아닌 값도 고를 수 있게 끼워 넣는다
  const minutes = (empty || MINUTES.includes(k.minute))
    ? MINUTES : [...MINUTES, k.minute].sort((a, b) => a - b)

  const chip = (on: boolean, dim = false) =>
    `rounded-lg text-sm font-bold border transition-all ${
      on ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
      : dim ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-400'}`

  return (
    <div className="rounded-xl border border-gray-200 p-2.5 bg-white">
      {/* 고른 시각을 크게 — 잘못 고른 것을 바로 알아채게 */}
      <p className={`text-center text-lg font-extrabold mb-2 ${empty ? 'text-gray-300' : 'text-violet-700'}`}>
        {empty ? emptyLabel : koreanLabel(value)}
      </p>

      <div className="flex gap-1.5 mb-2">
        {(['오전', '오후'] as Ampm[]).map(a => (
          <button key={a} type="button" disabled={!ampmOk(a)}
            onClick={() => set({ ampm: a })}
            className={`${chip(!empty && k.ampm === a, !ampmOk(a))} flex-1 py-2`}>{a}</button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {HOURS.map(h => (
          <button key={h} type="button" disabled={!enabled(k.ampm, h)}
            onClick={() => set({ hour12: h })}
            className={`${chip(!empty && k.hour12 === h, !enabled(k.ampm, h))} py-2`}>{h}</button>
        ))}
      </div>
      <p className="text-[10px] text-gray-300 text-center -mt-1 mb-1.5">시</p>

      <div className="grid grid-cols-6 gap-1.5">
        {minutes.map(mi => (
          <button key={mi} type="button" onClick={() => set({ minute: mi })}
            className={`${chip(!empty && k.minute === mi)} py-2`}>
            {String(mi).padStart(2, '0')}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-300 text-center mt-1">분</p>
    </div>
  )
}
