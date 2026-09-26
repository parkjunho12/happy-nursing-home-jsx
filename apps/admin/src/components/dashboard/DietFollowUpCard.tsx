import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, ChevronRight, Check, Loader2, X } from 'lucide-react'
import { dietFollowupAPI, type DietFollowUp, type DietFollowUpTask } from '@/api/dietFollowupClient'

/**
 * 식이가 바뀐 뒤 해야 할 것 — 욕구사정 · 급여제공계획서 · 서류현황 기록.
 *
 *  ■ 왜 대시보드에 띄우는가
 *
 *    주방에 알리려고 식이를 바꾸는 사람과, 욕구사정·계획서를 쓰는 사람이
 *    다르다. 말로 전하면 잊히고, 몇 달 뒤 지도점검에서야 '언제 바뀐 건데
 *    계획서는 그대로냐' 가 나온다.
 *
 *    그래서 바꾸는 순간 할 일이 한 줄 생기고, 셋 다 끝날 때까지 여기 남는다.
 *    계획서를 고쳐 놓고 「어르신 서류현황」에 작성 일시를 안 적는 일이 잦아,
 *    그 기록까지 따로 항목으로 둔다 — 점검에서 보는 것은 그 일시다.
 *    끝나면 저절로 사라진다 — '완료' 를 한 번 더 누르게 하면 그 한 번을
 *    안 눌러서 목록에 계속 쌓인다.
 *
 *  ■ 볼 사람만 본다
 *
 *    권한이 없으면(403) 아무것도 그리지 않는다. 할 일이 없을 때도 마찬가지다 —
 *    빈 카드가 늘 자리를 차지하면 대시보드가 길어지기만 한다.
 */
const fmtMD = (iso?: string | null) =>
  iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : ''

/** 며칠 지났는가 — 오래 묵은 것을 붉게 표시하려고 */
function daysSince(iso?: string | null): number {
  if (!iso) return 0
  const d = Date.parse(`${iso}T00:00:00+09:00`)
  if (Number.isNaN(d)) return 0
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
  const t = Date.parse(`${today}T00:00:00+09:00`)
  return Math.max(0, Math.round((t - d) / 86400000))
}

export default function DietFollowUpCard() {
  const navigate = useNavigate()
  const [items, setItems] = useState<DietFollowUp[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    dietFollowupAPI.list('open', 20)
      .then(r => setItems(r.items))
      .catch(() => setItems(null))     // 403 포함 — 카드 자체를 숨긴다
  }, [])
  useEffect(() => { load() }, [load])

  const toggle = async (f: DietFollowUp, task: DietFollowUpTask, done: boolean) => {
    setBusy(`${f.id}-${task}`)
    try {
      const saved = await dietFollowupAPI.setTask(f.id, task, done)
      // 셋 다 끝나면 목록에서 내려간다
      setItems(list => (list ?? [])
        .map(x => (x.id === saved.id ? saved : x))
        .filter(x => !x.done_at))
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? '바꾸지 못했습니다.')
    } finally { setBusy(null) }
  }

  const skip = async (f: DietFollowUp) => {
    const reason = prompt(
      `${f.resident_name} 어르신 — 욕구사정·계획서를 하지 않아도 되는 까닭을 적어 주세요.\n` +
      '(나중에 "왜 안 했지" 를 따질 수 있어야 해서 까닭 없이는 접히지 않습니다)')
    if (reason === null) return
    if (reason.trim().length < 2) { alert('까닭을 적어 주세요.'); return }
    setBusy(`${f.id}-skip`)
    try {
      await dietFollowupAPI.skip(f.id, reason.trim())
      setItems(list => (list ?? []).filter(x => x.id !== f.id))
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? '접지 못했습니다.')
    } finally { setBusy(null) }
  }

  if (!items || items.length === 0) return null

  return (
    <section className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100 bg-amber-50/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <UtensilsCrossed size={14} className="text-amber-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">식이 바뀜 — 서류 반영</h2>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shrink-0">
            {items.length}건
          </span>
        </div>
        <button onClick={() => navigate('/diet')}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-gray-400 hover:text-amber-600 shrink-0">
          식이 현황 <ChevronRight size={14} />
        </button>
      </div>

      <p className="px-4 pt-2.5 text-[11.5px] text-gray-500 leading-relaxed">
        식사 형태가 바뀌면 <b>욕구사정</b>을 다시 하고, <b>급여제공계획서</b>에 반영한 뒤,
        <b>서류현황</b>에 작성 일시까지 적어야 합니다. 셋 다 체크하면 이 목록에서 내려갑니다.
      </p>

      <ul className="px-3 py-2.5 space-y-2">
        {items.map(f => {
          const days = daysSince(f.effective_date)
          return (
            <li key={f.id} className={`rounded-xl border px-3 py-2.5 ${
              days >= 14 ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/60'}`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => navigate('/diet')}
                  className="text-[13px] font-bold text-gray-900 hover:text-amber-700">
                  {f.resident_name || '성함 미상'}
                </button>
                <span className="text-[11px] text-gray-400">
                  {[f.floor, f.room ? `${f.room}호` : ''].filter(Boolean).join(' ')}
                </span>
                <span className="text-[11.5px] text-gray-600">
                  {f.before_label} <span className="text-gray-300">→</span>{' '}
                  <b className="text-gray-900">{f.after_label}</b>
                </span>
                <span className={`ml-auto text-[10.5px] font-bold shrink-0 ${
                  days >= 14 ? 'text-red-600' : 'text-gray-400'}`}>
                  {fmtMD(f.effective_date)}{days > 0 ? ` · ${days}일째` : ' · 오늘'}
                </span>
              </div>
              {f.note && <p className="text-[11px] text-gray-400 mt-0.5 truncate">· {f.note}</p>}

              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {f.tasks.map(t => {
                  const done = !!t.done_at
                  return (
                    <button key={t.key} onClick={() => toggle(f, t.key, !done)}
                      disabled={busy === `${f.id}-${t.key}`}
                      title={done ? `${t.done_by ?? ''} 완료 — 누르면 되돌립니다` : '다 했으면 누르세요'}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold border transition-colors disabled:opacity-50 ${
                        done ? 'bg-emerald-600 text-white border-emerald-600'
                             : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'}`}>
                      {busy === `${f.id}-${t.key}`
                        ? <Loader2 size={11} className="animate-spin" />
                        : done ? <Check size={12} /> : <span className="w-3 h-3 rounded border border-current inline-block" />}
                      {t.label}
                    </button>
                  )
                })}
                <button onClick={() => navigate('/resident-docs')}
                  title="어르신 서류현황으로 — 급여제공계획서 일시를 여기에 적습니다"
                  className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 hover:underline px-1">
                  서류현황 열기 ▸
                </button>
                <button onClick={() => skip(f)} disabled={busy === `${f.id}-skip`}
                  title="해당 없음으로 접기 — 까닭을 적습니다"
                  className="ml-auto p-1 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                  <X size={13} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
