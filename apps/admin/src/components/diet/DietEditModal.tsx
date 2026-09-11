import { useEffect, useRef, useState } from 'react'
import { Check, History, Loader2, X, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dietAPI, type DietChange } from '@/api/dietClient'
import { RICE_TONE, SIDE_TONE, RICE_TYPES, SIDE_TYPES, dietLabel, fmtStamp, stampedOnAnotherDay } from '@/utils/dietTone'

/**
 * 식이 바꾸기 — 식이 현황·수급자 관리 어디서 눌러도 같은 창이 뜬다.
 *
 * ■ 왜 한 컴포넌트인가
 *
 *   두 화면에 각각 만들면 한쪽에만 '적용일' 이 생기거나, 한쪽만 경관식을
 *   밥·반찬과 함께 저장하게 된다. 그러면 같은 어르신이 화면마다 다르게
 *   보이고, 그때는 어느 쪽이 맞는지 아무도 모른다.
 *
 * ■ 이력은 식이 현황에서만 본다
 *
 *   수급자 관리는 '이 어르신은 지금 무엇을 드시나' 를 보고 고치는 자리다.
 *   지난 내력까지 거기서 펼치면 화면이 길어지고, 정작 봐야 할 인정서·서류가
 *   밀린다. 그래서 showHistory 를 준 곳(식이 현황)에서만 펼친다.
 */

const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const fmtMD = (s?: string | null) => (s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : '')
const fmtFull = (s: string) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`
const fmtYMD = (s?: string | null) => {
  if (!s) return ''
  const y = s.slice(0, 4)
  return y === String(new Date().getFullYear()) ? fmtMD(s) : `${y.slice(2)}.${fmtMD(s)}`
}

export interface DietCurrent {
  rice?: string | null
  side?: string | null
  tube: boolean
  since?: string | null
}

export default function DietEditModal({
  residentId, name, sub, current, rice = RICE_TYPES, side = SIDE_TYPES,
  showHistory = false, onClose, onSaved,
}: {
  residentId: string
  name: string
  /** 층·호실처럼 누구인지 짚어 주는 한 줄 */
  sub?: string
  current: DietCurrent
  rice?: string[]
  side?: string[]
  showHistory?: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [r, setR] = useState<string | null>(current.rice ?? null)
  const [s, setS] = useState<string | null>(current.side ?? null)
  const [tube, setTube] = useState(current.tube)
  const [on, setOn] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [hist, setHist] = useState<DietChange[] | null>(null)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (showHistory) dietAPI.history(residentId).then(setHist).catch(() => setHist([]))
  }, [residentId, showHistory])
  useEffect(() => { first.current?.focus() }, [])

  const changed = tube !== current.tube || (!tube && (r !== current.rice || s !== current.side))
  const save = async () => {
    setBusy(true)
    try {
      await dietAPI.set(residentId, { rice: r, side: s, tube, effective_date: on, note })
      onSaved()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '저장하지 못했습니다.')
    } finally { setBusy(false) }
  }

  const btn = (label: string, on_: boolean, tone: string, click: () => void, ref?: any) => (
    <button key={label} ref={ref} type="button" onClick={click}
      className={`px-3 py-2.5 rounded-xl text-sm font-bold border transition-all ${
        on_ ? `${tone} ring-2 ring-offset-1 ring-gray-300` : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 sticky top-0 bg-white z-10">
          <div>
            <p className="text-base font-bold text-gray-900">{name} 어르신</p>
            <p className="text-[11px] text-gray-400">
              {sub ? `${sub} · ` : ''}지금 {dietLabel(current.rice, current.side, current.tube)}
              {current.since && ` (${fmtMD(current.since)}부터)`}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* 경관식이면 밥·반찬을 고르지 않는다 — 골라 둔 채 두면 집계가 두 번 센다 */}
          <label className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={tube} onChange={e => setTube(e.target.checked)} className="w-4 h-4 accent-sky-600" />
            <span className="text-sm font-bold text-sky-800">경관식</span>
            <span className="text-[11px] text-sky-600">체크하면 밥·반찬은 고르지 않습니다</span>
          </label>

          {!tube && (
            <>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1.5">밥</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {rice.map((t, i) => btn(t, r === t, RICE_TONE[t]?.chip ?? '',
                    () => setR(r === t ? null : t), i === 0 ? first : undefined))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1.5">반찬</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {side.map(t => btn(t, s === t, SIDE_TONE[t]?.chip ?? '', () => setS(s === t ? null : t)))}
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5">언제부터</p>
              <input type="date" value={on} onChange={e => setOn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5">사유 <span className="font-normal text-gray-300">(선택)</span></p>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="예) 삼킴 어려워 조정"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-[12px]">
            <span className="text-gray-400">{dietLabel(current.rice, current.side, current.tube)}</span>
            <span className="mx-1.5 text-gray-300">→</span>
            <b className="text-gray-800">{dietLabel(r, s, tube)}</b>
            <span className="text-gray-400"> · {fmtFull(on)}부터</span>
          </div>

          {/* 지난 내력 — 식이 현황에서만. 같은 자리에서 보이면 '또 바꾸는 것인지' 를 판단할 수 있다 */}
          {showHistory ? (hist && hist.length > 0 && (
            <details>
              <summary className="text-xs font-bold text-gray-400 cursor-pointer flex items-center gap-1">
                <History size={12} /> 내력 {hist.length}건 — 언제 무엇으로 바뀌었나
              </summary>
              <div className="mt-2 space-y-1">
                {hist.map(h => {
                  const future = h.effective_date > todayISO()
                  return (
                    <div key={h.id} className={`text-[11px] flex gap-1.5 ${future ? 'text-sky-600' : 'text-gray-500'}`}>
                      <span className={`w-14 shrink-0 tabular-nums ${future ? 'font-bold' : 'text-gray-400'}`}>
                        {fmtYMD(h.effective_date)}
                      </span>
                      <span className="flex-1">
                        {future && <span className="font-bold">예정 · </span>}
                        {h.diff?.[0] ?? dietLabel(h.rice, h.side, h.tube)}
                      </span>
                      {/* 언제 적었는지 — 적용일과 다른 날 적었으면 날짜까지 */}
                      <span className="text-gray-400 tabular-nums shrink-0">
                        {h.created_at && (
                          stampedOnAnotherDay(h.created_at, h.effective_date)
                            ? fmtStamp(h.created_at, { withDate: true })
                            : fmtStamp(h.created_at))}
                      </span>
                      <span className="text-gray-300 shrink-0">{h.source === 'import' ? '엑셀' : h.changed_by ?? ''}</span>
                    </div>
                  )
                })}
              </div>
            </details>
          )) : (
            <Link to="/diet" className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-orange-600">
              <History size={12} /> 지난 내력은 「식이 현황」에서 <ExternalLink size={10} />
            </Link>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
          <button onClick={save} disabled={busy || (!changed && !note)}
            title={!changed && !note ? '바뀐 내용이 없습니다' : undefined}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-40 flex items-center justify-center gap-1.5">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} 이 식이로 바꾸기
          </button>
        </div>
      </div>
    </div>
  )
}
