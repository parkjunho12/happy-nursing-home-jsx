import { useEffect, useMemo, useState } from 'react'
import { Check, FileOutput, Loader2, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { outgoingDocAPI, type OutgoingDoc } from '@/api/outgoingDocClient'
import { useLtcStore } from '@/store/ltc'

/**
 * 내보내야 할 문서 — 교부 목록과 그 기록.
 *
 * ■ 무엇을 담는가
 *
 *   '원종순 어르신 장기요양인정서 갱신 서류' 처럼, 어르신이나 보호자에게
 *   건네야 하는 것. 체크리스트는 입소할 때 해야 할 일이 정해져 있지만
 *   이건 그때그때 생기고 몇 건이 될지 모른다.
 *
 * ■ 교부하면 지우지 않는다
 *
 *   목록에서만 내리고 날짜를 남긴다. 나중에 "그 서류 받으셨나요" 를 물어올 때
 *   답할 수 있어야 한다. 그래서 기록 탭에서 언제 누가 누구에게 건넸는지 본다.
 *
 * ■ 되돌릴 수 있다
 *
 *   잘못 눌렀을 때 돌아올 길이 없으면 아무도 편히 못 누른다. 교부 취소를 둔다.
 */
const TARGETS = ['보호자', '어르신', '공단', '병원', '구청·주민센터', '기타'] as const

const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

export default function OutgoingDocsPage() {
  const { residents, loadAll, loaded } = useLtcStore()
  const [rows, setRows] = useState<OutgoingDoc[] | null>(null)
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ person_id: '', title: '', target: '보호자', due_date: '', note: '' })
  const [pickQ, setPickQ] = useState('')
  const [issueFor, setIssueFor] = useState<OutgoingDoc | null>(null)
  const [issueTo, setIssueTo] = useState('')
  const [issueOn, setIssueOn] = useState(todayISO())

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])
  const load = () => outgoingDocAPI.list().then(setRows).catch(() => setRows([]))
  useEffect(() => { load() }, [])

  const active = useMemo(
    () => residents.filter(r => r.status === 'active' || r.status === 'pending'), [residents])

  const cand = useMemo(() => {
    const k = pickQ.trim()
    return active
      .filter(r => !k || r.name.includes(k) || String((r as any).room ?? '').includes(k))
      .sort((a, b) => String((a as any).room ?? '힣').localeCompare(String((b as any).room ?? '힣'), 'ko', { numeric: true }))
  }, [active, pickQ])

  const todo = (rows ?? []).filter(d => !d.issued_at)
  const done = (rows ?? []).filter(d => d.issued_at)
  const shown = useMemo(() => {
    const list = tab === 'todo' ? todo : done
    const k = q.trim()
    if (!k) return list
    return list.filter(d => d.title.includes(k) || (d.person_name ?? '').includes(k)
      || (d.note ?? '').includes(k) || (d.issued_to ?? '').includes(k))
  }, [rows, tab, q])

  const add = async () => {
    if (!form.title.trim()) return alert('어떤 문서인지 적어주세요.')
    setAdding(true)
    try {
      const d = await outgoingDocAPI.add({
        person_id: form.person_id || null, title: form.title.trim(),
        target: form.target || null, due_date: form.due_date || null, note: form.note.trim(),
      })
      setRows(rs => [d, ...(rs ?? [])])
      setForm({ person_id: '', title: '', target: '보호자', due_date: '', note: '' })
      setPickQ('')
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '추가하지 못했습니다.')
    } finally { setAdding(false) }
  }

  const doIssue = async () => {
    if (!issueFor) return
    setBusy(issueFor.id)
    try {
      const d = await outgoingDocAPI.issue(issueFor.id, { issued_to: issueTo.trim(), issued_at: issueOn })
      setRows(rs => (rs ?? []).map(x => x.id === d.id ? d : x))
      setIssueFor(null); setIssueTo(''); setIssueOn(todayISO())
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '교부 처리에 실패했습니다.')
    } finally { setBusy(null) }
  }

  const undo = async (d: OutgoingDoc) => {
    if (!confirm(`「${d.title}」 교부를 취소할까요?\n다시 「내보낼 것」 목록으로 돌아갑니다.`)) return
    setBusy(d.id)
    try {
      const r = await outgoingDocAPI.undo(d.id)
      setRows(rs => (rs ?? []).map(x => x.id === r.id ? r : x))
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '취소하지 못했습니다.')
    } finally { setBusy(null) }
  }

  const remove = async (d: OutgoingDoc) => {
    if (!confirm(`「${d.title}」 을(를) 목록에서 지울까요?`)) return
    setBusy(d.id)
    try {
      await outgoingDocAPI.remove(d.id)
      setRows(rs => (rs ?? []).filter(x => x.id !== d.id))
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '지우지 못했습니다.')
    } finally { setBusy(null) }
  }

  const ic = 'px-2.5 py-2 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:border-teal-400'
  const dday = (due?: string | null) => {
    if (!due) return null
    const d = Math.round((new Date(due + 'T00:00:00').getTime()
      - new Date(todayISO() + 'T00:00:00').getTime()) / 86400000)
    return d
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
          <FileOutput size={18} className="text-teal-600" /> 내보내야 할 문서
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          어르신·보호자께 드려야 할 서류를 적어 두고, 건네드리면 「교부」를 눌러주세요. 언제 누구에게 드렸는지 기록에 남습니다.
        </p>
      </div>

      {/* 새로 추가 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="md:col-span-1">
            {/* 어르신 — 시설 대외 문서면 비워 둔다 */}
            <input value={pickQ} onChange={e => setPickQ(e.target.value)} list="odoc-res"
              placeholder="어르신 (선택)"
              onBlur={() => {
                const hit = active.find(r => r.name === pickQ.trim())
                setForm(f => ({ ...f, person_id: hit?.id ?? '' }))
              }}
              className={`${ic} w-full`} />
            <datalist id="odoc-res">
              {cand.map(r => <option key={r.id} value={r.name}>{(r as any).room ? `${(r as any).room}호` : ''}</option>)}
            </datalist>
          </div>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="문서 이름 — 예) 장기요양인정서 갱신 서류"
            className={`${ic} md:col-span-2 font-bold`} />
          <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}
            className={`${ic} bg-white`}>
            {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
            title="기한 (선택)" className={ic} />
        </div>
        <div className="flex gap-2 mt-2">
          <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="메모 (선택)" className={`${ic} flex-1`} />
          <button onClick={add} disabled={adding}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold disabled:opacity-40">
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 추가
          </button>
        </div>
      </div>

      {/* 탭 · 찾기 */}
      <div className="flex items-center gap-2 flex-wrap">
        {([['todo', `내보낼 것 ${todo.length}`], ['done', `교부 기록 ${done.length}`]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border ${tab === v ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="성함 · 문서명으로 찾기"
            className="w-52 pl-7 pr-2 py-2 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:border-teal-400" />
        </div>
      </div>

      {/* 목록 */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        {rows === null ? (
          <div className="flex justify-center py-14"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-14">
            {tab === 'todo' ? '내보낼 문서가 없습니다.' : '아직 교부한 기록이 없습니다.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {shown.map(d => {
              const dd = dday(d.due_date)
              return (
                <li key={d.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50/60">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] text-gray-900">
                      {d.person_name && <span className="font-extrabold">{d.person_name} 어르신 </span>}
                      <span className="font-semibold">{d.title}</span>
                      {d.target && <span className="ml-1.5 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">{d.target}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {d.issued_at ? (
                        <>
                          {d.issued_at} 교부
                          {d.issued_to && <> · 받으신 분 <b className="text-gray-600">{d.issued_to}</b></>}
                          {d.issued_by && <> · 처리 {d.issued_by}</>}
                        </>
                      ) : (
                        <>
                          {d.created_by && <>{d.created_by} 등록</>}
                          {d.note && <> · {d.note}</>}
                        </>
                      )}
                    </p>
                  </div>

                  {!d.issued_at && dd != null && (
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      dd < 0 ? 'bg-red-100 text-red-600' : dd === 0 ? 'bg-amber-100 text-amber-700'
                      : dd <= 3 ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                      {dd < 0 ? `지연 ${-dd}일` : dd === 0 ? '오늘까지' : `D-${dd}`}
                    </span>
                  )}

                  {d.issued_at ? (
                    <button onClick={() => undo(d)} disabled={busy === d.id}
                      title="교부 취소 — 다시 목록으로"
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                      {busy === d.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} 취소
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { setIssueFor(d); setIssueTo(''); setIssueOn(todayISO()) }}
                        disabled={busy === d.id}
                        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-[11px] font-bold disabled:opacity-40">
                        <Check size={11} /> 교부
                      </button>
                      <button onClick={() => remove(d)} disabled={busy === d.id}
                        title="목록에서 지우기" className="shrink-0 p-1 text-gray-300 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 교부 — 받으신 분과 날짜를 함께 남긴다 */}
      {issueFor && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
          onClick={() => !busy && setIssueFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-gray-900">교부</h3>
              <button onClick={() => setIssueFor(null)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <p className="text-[12px] text-gray-500 mb-3">
              {issueFor.person_name && <b>{issueFor.person_name} 어르신 </b>}{issueFor.title}
            </p>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">받으신 분 <span className="font-normal text-gray-400">(선택)</span></label>
            <input value={issueTo} onChange={e => setIssueTo(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') doIssue() }}
              placeholder="예) 장남 김○○ · 본인"
              className={`${ic} w-full mb-2`} />
            <label className="block text-[11px] font-bold text-gray-500 mb-1">교부일</label>
            <input type="date" value={issueOn} onChange={e => setIssueOn(e.target.value)} className={`${ic} w-full`} />
            <div className="flex gap-2 mt-3">
              <span className="text-[11px] text-gray-400 self-center">기록에 남고, 잘못 누르면 취소할 수 있습니다</span>
              <button onClick={doIssue} disabled={busy === issueFor.id}
                className="ml-auto px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold disabled:opacity-40">
                {busy === issueFor.id ? '처리 중…' : '교부 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
