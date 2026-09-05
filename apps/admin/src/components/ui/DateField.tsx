import { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { maskDate, digitsToISO } from '@/utils/dateInput'

/**
 * 한국형 날짜 입력기 — 직접 타이핑(YYYY.MM.DD 자동 서식) + 한글 달력 팝업.
 * value/onChange 는 ISO('YYYY-MM-DD') 문자열을 사용해 <input type="date"> 를 그대로 대체한다.
 */

const WD = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseISO = (s?: string | null): Date | null => {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
// ISO -> 'YYYY.MM.DD'
const fmtText = (s?: string | null) => {
  const d = parseISO(s)
  return d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : ''
}
// 타이핑 규칙은 utils/dateInput 에 있다 — 생년월일이 조용히 틀리면
// 나이 계산과 급여·평가가 모두 어긋나서, 따로 떼어 테스트를 붙였다.
const maskDigits = maskDate

interface Props {
  value?: string | null
  onChange: (iso: string) => void
  className?: string
  wrapperClassName?: string
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  /** 값이 없을 때 달력이 처음 보여줄 날짜 (예: 생년월일 → '1990-01-01') */
  defaultView?: string
}

export default function DateField({
  value, onChange, className = '', wrapperClassName = '',
  placeholder = 'YYYY.MM.DD', disabled = false, clearable = true, defaultView,
}: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(fmtText(value))
  const [focused, setFocused] = useState(false)
  const sel = parseISO(value)
  const [view, setView] = useState<Date>(() => sel ?? parseISO(defaultView ?? null) ?? new Date())
  const ref = useRef<HTMLDivElement>(null)

  // 외부 value 변경 → 입력 중이 아닐 때만 표시 텍스트 동기화
  useEffect(() => { if (!focused) setText(fmtText(value)) }, [value, focused])
  useEffect(() => {
    if (!open) return
    const d = sel ?? parseISO(defaultView ?? null)
    if (d) setView(d)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const y = view.getFullYear(), m = view.getMonth()
  const first = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const today = toISO(new Date())
  const cells: (number | null)[] = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  // 1915년부터 — 백 세를 넘기신 어르신 생년월일도 달력에서 고를 수 있어야 한다.
  // (직접 치면 1900년부터 되지만, 고를 수 없으면 못 넣는 줄 안다)
  const years = Array.from({ length: 126 }, (_, i) => 1915 + i)

  const handleType = (raw: string) => {
    const masked = maskDigits(raw)
    setText(masked)
    const iso = digitsToISO(masked)
    if (iso) { onChange(iso); const d = parseISO(iso); if (d) setView(d) }
    else if (raw.replace(/\D/g, '') === '') onChange('')
  }
  const handleBlur = () => {
    setFocused(false)
    const iso = digitsToISO(text)
    if (iso) { onChange(iso); setText(fmtText(iso)) }
    else if (text.replace(/\D/g, '') === '') { onChange(''); setText('') }
    else setText(fmtText(value)) // 유효하지 않으면 이전 값 복원
  }
  const pick = (iso: string) => { onChange(iso); setText(fmtText(iso)); setOpen(false) }

  return (
    <div className={`relative ${wrapperClassName}`} ref={ref}>
      <div className={`${className} w-full flex items-center gap-1`}>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={e => {
            setFocused(true)
            // 이미 값이 있으면 통째로 고른다. 그러지 않으면 커서가 끝에 놓여
            // 친 숫자가 뒤에 붙고, 앞 여덟 자리만 남아 값이 그대로다 —
            // 화면상 '키보드로는 입력이 안 되는' 것처럼 보인다.
            e.currentTarget.select()
          }}
          onChange={e => handleType(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleBlur() } }}
          className="flex-1 min-w-0 bg-transparent outline-none border-none p-0 text-inherit placeholder:text-gray-400"
        />
        <button type="button" tabIndex={-1} disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className="shrink-0 text-gray-400 hover:text-primary-orange">
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(y, m - 1, 1))}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center">‹</button>
            <div className="flex items-center gap-1 text-sm font-bold text-gray-800">
              <select value={y} onChange={e => setView(new Date(+e.target.value, m, 1))}
                className="bg-transparent font-bold focus:outline-none cursor-pointer">
                {years.map(yy => <option key={yy} value={yy}>{yy}년</option>)}
              </select>
              <select value={m} onChange={e => setView(new Date(y, +e.target.value, 1))}
                className="bg-transparent font-bold focus:outline-none cursor-pointer">
                {Array.from({ length: 12 }, (_, i) => i).map(mm => <option key={mm} value={mm}>{mm + 1}월</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setView(new Date(y, m + 1, 1))}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center">›</button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WD.map((w, i) => (
              <div key={w} className={`text-center text-[11px] font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />
              const iso = `${y}-${pad(m + 1)}-${pad(d)}`
              const isSel = value === iso
              const isToday = today === iso
              const wd = (first + d - 1) % 7
              return (
                <button key={i} type="button" onClick={() => pick(iso)}
                  className={`h-8 rounded-lg text-sm transition-colors ${
                    isSel ? 'bg-primary-orange text-white font-bold'
                    : isToday ? 'bg-orange-50 text-primary-orange font-semibold'
                    : wd === 0 ? 'text-red-500 hover:bg-gray-100'
                    : wd === 6 ? 'text-blue-500 hover:bg-gray-100'
                    : 'text-gray-700 hover:bg-gray-100'}`}>
                  {d}
                </button>
              )
            })}
          </div>

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
            {clearable
              ? <button type="button" onClick={() => { onChange(''); setText(''); setOpen(false) }} className="text-xs text-gray-400 hover:text-red-500">지우기</button>
              : <span />}
            <button type="button" onClick={() => pick(today)} className="text-xs font-semibold text-primary-orange hover:underline">오늘</button>
          </div>
        </div>
      )}
    </div>
  )
}
