import { useState } from 'react'
import { Loader2, LogOut, Undo2, X } from 'lucide-react'
import { scheduleAPI } from '@/api/scheduleClient'
import type { DietRow } from '@/api/dietClient'

/**
 * 외박 — 식이 화면에서 바로.
 *
 *  ■ 적히는 곳은 일정 한 곳뿐
 *
 *    여기서 누르면 일정에 「[외박] ○○○ 어르신」 한 줄이 생긴다. 식이 표에는
 *    아무것도 적지 않는다. 두 곳에 적으면 언젠가 어긋나고, 어긋나면 주방은
 *    틀린 쪽을 보고 차린다.
 *
 *    그래서 일정 화면에서 외박을 적어도 이 화면에 그대로 나타난다 —
 *    같은 줄을 읽고 있기 때문이다.
 *
 *  ■ 떠나는 날·돌아오는 날은 주방 숫자에서 빼지 않는다
 *
 *    떠나는 날 아침·점심은 드셨고 돌아오는 날 저녁은 드신다. 가운데 날만
 *    뺀다. 하루 단위로 뺐다 넣었다 하면 그 이틀치가 통째로 틀린다.
 */
const pad = (n: number) => String(n).padStart(2, '0')

/** 지금(한국). 9시간 밀어 두고 UTC 값을 읽으면 한국 날짜·시각이 된다. */
const kstNow = () => new Date(Date.now() + 9 * 3600e3)
const kstToday = () => kstNow().toISOString().slice(0, 10)
const kstHM = () => { const d = kstNow(); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }

/**
 * 날짜 더하기 — 글자만 가지고 센다.
 *
 * Date 로 옮겼다가 toISOString 으로 되돌리면 그 사이에 표준시로 바뀌어
 * 하루가 밀린다(한국 자정 = 전날 15시 UTC). 실제로 '내일' 을 넣었는데
 * 오늘이 나왔다.
 */
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}
const fmt = (iso?: string | null) => {
  if (!iso) return '미정'
  const s = String(iso)
  return `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))} ${s.slice(11, 16)}`
}

export default function AwayModal({ r, onClose, onDone }: {
  r: DietRow
  onClose: () => void
  onDone: () => void
}) {
  const today = kstToday()
  const a = r.away

  // 대개 저녁에 모시러 오셔서 이튿날 점심 지나 돌아오신다 — 그 값을 미리 둔다
  const [startDate, setStartDate] = useState(today)
  const [startTime, setStartTime] = useState('18:00')
  const [endDate, setEndDate] = useState(addDays(today, 1))
  const [endTime, setEndTime] = useState('12:00')
  /**
   * 언제 오실지 모르는 경우가 실제로 있다 — 병원에 들르신다거나, 가족이
   * '일단 모시고 간다' 고만 하신다거나. 그때 아무 날짜나 찍어 넣으면 그날이
   * 지나 저절로 '돌아오신 것' 이 되어 상이 차려진다. 모르면 모른다고 적는다.
   */
  const [unknownEnd, setUnknownEnd] = useState(false)
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const create = async () => {
    if (!unknownEnd && `${endDate}T${endTime}` <= `${startDate}T${startTime}`) {
      setErr('귀원 예정이 출발보다 빠릅니다.'); return
    }
    setBusy(true); setErr('')
    try {
      await scheduleAPI.createEvent({
        category: '외박',
        title: `[외박] ${r.name} 어르신`,
        start_at: `${startDate}T${startTime}`,
        end_at: unknownEnd ? null : `${endDate}T${endTime}`,
        memo: memo.trim() || undefined,
      })
      onDone()
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? '일정에 적지 못했습니다.')
      setBusy(false)
    }
  }

  const markReturned = async () => {
    if (!a) return
    setBusy(true); setErr('')
    try {
      await scheduleAPI.markReturned(a.event_id, {
        returned_at: `${kstToday()}T${kstHM()}`,
      })
      onDone()
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? '귀원을 적지 못했습니다.')
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!a) return
    if (!confirm(`${r.name} 어르신 외박을 취소할까요?\n\n일정에서도 취소됩니다.`)) return
    setBusy(true); setErr('')
    try {
      await scheduleAPI.updateEvent(a.event_id, { status: 'canceled' })
      onDone()
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? '취소하지 못했습니다.')
      setBusy(false)
    }
  }

  const field = 'w-full px-3 py-2.5 text-[15px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200'

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <LogOut size={16} className="text-green-700" />
          <h3 className="font-bold text-gray-900 text-[15px]">
            {r.name} 어르신 {a ? '외박' : '외박 등록'}
          </h3>
          <span className="text-[11px] text-gray-400">
            {[r.floor, r.room ? `${r.room}호` : ''].filter(Boolean).join(' ')}
          </span>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          {a ? (
            <>
              <div className={`rounded-xl border px-3 py-2.5 ${
                a.unknown_return ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                <p className={`text-[14px] font-bold ${a.unknown_return ? 'text-amber-900' : 'text-green-900'}`}>
                  {a.label}
                </p>
                <p className={`text-[12.5px] mt-0.5 ${a.unknown_return ? 'text-amber-800' : 'text-green-800'}`}>
                  {fmt(a.start)} 출발 · {a.end ? `${fmt(a.end)} ${a.returned ? '귀원' : '귀원 예정'}` : '귀원 예정 미정'}
                </p>
                <p className={`text-[11.5px] mt-1 ${a.unknown_return ? 'text-amber-700' : 'text-green-700/80'}`}>
                  {a.full_day
                    ? '오늘은 하루 종일 안 계셔서 주방 숫자에서 빠집니다.'
                    : '오늘은 한 끼 이상 드셔서 주방 숫자에는 그대로 듭니다.'}
                  {a.unknown_return && ' 돌아오시면 아래를 눌러 마무리해 주세요.'}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!a.returned && (
                  <button onClick={markReturned} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-bold disabled:opacity-50">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} 지금 귀원하셨습니다
                  </button>
                )}
                <button onClick={cancel} disabled={busy}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:bg-gray-50 disabled:opacity-50">
                  외박 취소
                </button>
              </div>
              <p className="text-[11.5px] text-gray-400">
                날짜를 고치시려면 「일정 캘린더」에서 이 외박을 여세요. 적히는 곳은 일정 한 곳입니다.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-gray-500 mb-1">출발</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={field} />
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={field + ' mt-1.5'} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-500 mb-1">귀원 예정</label>
                  {unknownEnd ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] font-bold text-amber-900">
                      아직 모름
                    </div>
                  ) : (
                    <>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={field} />
                      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={field + ' mt-1.5'} />
                    </>
                  )}
                  <label className="mt-2 flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={unknownEnd} className="mt-0.5 w-4 h-4 accent-amber-600"
                      onChange={e => setUnknownEnd(e.target.checked)} />
                    <span className="text-[12.5px] font-bold text-gray-700">귀원 예정을 아직 모릅니다</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-gray-500 mb-1">메모</label>
                <input value={memo} onChange={e => setMemo(e.target.value)}
                  placeholder="예: 아드님 댁 · 명절 외박" className={field} />
              </div>
              <p className="text-[11.5px] text-gray-400 leading-relaxed">
                「일정 캘린더」에 <b>[외박] {r.name} 어르신</b> 으로 한 줄이 생깁니다.
                {unknownEnd
                  ? ' 귀원을 적어 주실 때까지 계속 안 계신 것으로 봅니다 — 돌아오시면 이 자리에서 「지금 귀원하셨습니다」를 눌러 주세요.'
                  : ' 가운데 날은 주방 숫자에서 빠지고, 떠나는 날·돌아오는 날은 그대로 듭니다.'}
              </p>
            </>
          )}

          {err && <p className="text-[12.5px] text-rose-600">{err}</p>}
        </div>

        {!a && (
          <div className="px-4 py-3 border-t flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50">
              닫기
            </button>
            <button onClick={create} disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-bold disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} 외박으로 등록
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
