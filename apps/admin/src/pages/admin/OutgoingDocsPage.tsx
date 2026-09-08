import { useEffect, useMemo, useState } from 'react'
import { Check, FileOutput, Loader2, MapPin, Plus, RotateCcw, Search, Trash2, UserRound, X } from 'lucide-react'
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

/** 서류를 어디 두는가. 대개 현관 앞에 모아 두므로 그것을 기본값으로 둔다.
 *  자주 쓰는 자리를 단추로 내놓고, 그 밖은 직접 적는다 — 목록만 두면
 *  없는 자리를 못 적고, 자유 입력만 두면 같은 곳을 저마다 다르게 적는다. */
const DEFAULT_LOCATION = '1층 현관'
const PLACES = [DEFAULT_LOCATION, '사무실', '2층 간호사실', '3층 간호사실', '원장실'] as const

const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

export default function OutgoingDocsPage() {
  const { residents, loadAll, loaded } = useLtcStore()
  const [rows, setRows] = useState<OutgoingDoc[] | null>(null)
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    person_id: '', person_name: '', title: '', target: '보호자',
    location: DEFAULT_LOCATION, due_date: '', note: '',
  })
  // 어르신 고르기 — 자유 입력은 이름을 정확히 안 치면 조용히 안 붙는다.
  // 눌러서 찾아 고르게 한다(응급벨 명단과 같은 방식).
  const [pickOpen, setPickOpen] = useState(false)
  const [pickQ, setPickQ] = useState('')
  // 위치 고치기 — 어느 줄의 위치를 바꾸는 중인지
  const [locFor, setLocFor] = useState<OutgoingDoc | null>(null)
  const [locVal, setLocVal] = useState('')
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
        target: form.target || null, location: form.location.trim() || DEFAULT_LOCATION,
        due_date: form.due_date || null, note: form.note.trim(),
      })
      setRows(rs => [d, ...(rs ?? [])])
      // 위치는 남긴다 — 대개 같은 자리에 계속 둔다. 매번 다시 고르게 하지 않는다.
      setForm(f => ({ person_id: '', person_name: '', title: '', target: '보호자',
                      location: f.location, due_date: '', note: '' }))
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

  const saveLoc = async () => {
    if (!locFor) return
    setBusy(locFor.id)
    try {
      const r = await outgoingDocAPI.edit(locFor.id, { location: locVal.trim() || DEFAULT_LOCATION })
      setRows(rs => (rs ?? []).map(x => x.id === r.id ? r : x))
      setLocFor(null)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '위치를 바꾸지 못했습니다.')
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
          {/* 어르신 — 눌러서 찾아 고른다. 시설 대외 문서면 비워 둔다. */}
          <button type="button" onClick={() => { setPickOpen(true); setPickQ('') }}
            className={`${ic} w-full text-left truncate ${form.person_id ? 'font-bold text-gray-900' : 'text-gray-400'}`}>
            {form.person_name || '어르신 선택'}
          </button>
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

        {/* 어디 뒀는가 — 자주 쓰는 자리는 눌러서, 그 밖은 직접 적는다 */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <MapPin size={13} className="text-gray-400 shrink-0" />
          {PLACES.map(pl => (
            <button key={pl} type="button" onClick={() => setForm({ ...form, location: pl })}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                form.location === pl ? 'bg-gray-800 border-gray-800 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {pl}
            </button>
          ))}
          <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
            placeholder="직접 입력" className={`${ic} w-32 py-1`} />
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
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {d.issued_at ? (
                        <>
                          <span>
                            {d.issued_at} 교부
                            {d.issued_to && <> · 받으신 분 <b className="text-gray-600">{d.issued_to}</b></>}
                            {d.issued_by && <> · 처리 {d.issued_by}</>}
                          </span>
                        </>
                      ) : (
                        <>
                          {/* 위치 — 꺼내러 갈 때 제일 먼저 보는 것이라 눈에 띄게 두고,
                              눌러서 바로 고칠 수 있게 한다 */}
                          <button onClick={() => { setLocFor(d); setLocVal(d.location ?? DEFAULT_LOCATION) }}
                            title="둔 곳 바꾸기"
                            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-gray-600 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 hover:border-gray-400">
                            <MapPin size={10} /> {d.location || DEFAULT_LOCATION}
                          </button>
                          {d.created_by && <span>{d.created_by} 등록</span>}
                          {d.note && <span>· {d.note}</span>}
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

      {/* 어르신 고르기 — 이름·호실로 찾는다.
          자유 입력은 이름을 정확히 안 치면 조용히 안 붙어, 고른 줄 알고 넘어간다. */}
      {pickOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPickOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
              <UserRound size={15} className="text-teal-600" />
              <h3 className="text-sm font-bold text-gray-900">어르신 선택</h3>
              <button onClick={() => setPickOpen(false)} className="ml-auto text-gray-300 hover:text-gray-500"><X size={16} /></button>
            </div>
            <div className="px-3 py-2 border-b shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input autoFocus value={pickQ} onChange={e => setPickQ(e.target.value)}
                  placeholder="성함 · 호실로 찾기"
                  className="w-full pl-7 pr-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cand.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">찾는 어르신이 없습니다.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {cand.map(r => (
                    <li key={r.id}>
                      <button onClick={() => {
                          setForm(f => ({ ...f, person_id: r.id, person_name: r.name }))
                          setPickOpen(false)
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-teal-50 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0">
                          {(r as any).room ? `${(r as any).room}호` : (r as any).floor ?? ''}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{r.name}</span>
                        {r.status === 'pending' && <span className="ml-auto text-[10px] font-bold text-amber-600">입소 예정</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* 어르신 없이 등록하는 것도 정상적인 쓰임 — 시설 대외 문서 */}
            <div className="px-3 py-2.5 border-t shrink-0">
              <button onClick={() => { setForm(f => ({ ...f, person_id: '', person_name: '' })); setPickOpen(false) }}
                className="w-full py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50">
                어르신 없이 (시설 문서)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 둔 곳 바꾸기 */}
      {locFor && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
          onClick={() => !busy && setLocFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin size={14} className="text-gray-500" />
              <h3 className="text-sm font-bold text-gray-900">둔 곳</h3>
              <button onClick={() => setLocFor(null)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <p className="text-[12px] text-gray-500 mb-3">
              {locFor.person_name && <b>{locFor.person_name} 어르신 </b>}{locFor.title}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PLACES.map(pl => (
                <button key={pl} onClick={() => setLocVal(pl)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${
                    locVal === pl ? 'bg-gray-800 border-gray-800 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {pl}
                </button>
              ))}
            </div>
            <input value={locVal} onChange={e => setLocVal(e.target.value)} maxLength={100}
              onKeyDown={e => { if (e.key === 'Enter') saveLoc() }}
              placeholder="직접 입력" className={`${ic} w-full`} />
            <div className="flex gap-2 mt-3">
              <span className="text-[11px] text-gray-400 self-center">비우면 「{DEFAULT_LOCATION}」으로 둡니다</span>
              <button onClick={saveLoc} disabled={busy === locFor.id}
                className="ml-auto px-4 py-2 rounded-xl bg-gray-800 text-white text-xs font-bold disabled:opacity-40">
                {busy === locFor.id ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

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
