import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ClipboardCheck, Loader2, MessageCircle, Search, Trash2, X } from 'lucide-react'
import { isKakaoShareEnabled, shareText } from '@/lib/kakaoShare'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/api/client'
import { auditCheckAPI, type AuditRound, type AuditItem } from '@/api/auditCheckClient'

/**
 * 지도점검 종합 체크리스트 — 공단 지도점검 준비를 전 직원이 나눠서.
 * 점검일을 정하면 회차 탭이 생기고 152개 항목이 자동 시드된다.
 * 체크하면 누가 했는지 기록되고, 항목마다 담당자를 지정할 수 있다.
 */
const SECTION_ORDER = [
  '기관 기본 운영', '인사·종사자 관리', '근무관리', '입소관리', '급여제공 관리',
  '간호 및 건강관리', '프로그램 운영', '사례관리 및 회의', '급여청구 및 회계',
  '시설 및 안전관리', '급식관리', '개인정보 및 정보보호', '기타 운영관리', '지도점검 전 최종 확인',
]
const fmtDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

export default function AuditCheckPage() {
  const { user } = useAuthStore()
  const canManage = user?.role === 'ADMIN' || user?.position === '시설장'
  const isAdmin = user?.role === 'ADMIN'
  const [rounds, setRounds] = useState<AuditRound[]>([])
  const [cur, setCur] = useState<string | null>(null)
  const [items, setItems] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [onlyTodo, setOnlyTodo] = useState(false)
  const [onlyMine, setOnlyMine] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [staffOpts, setStaffOpts] = useState<{ name: string; position?: string | null }[]>([])
  const posOf = (name?: string | null) => staffOpts.find(o2 => o2.name === name)?.position ?? null
  const [assignFor, setAssignFor] = useState<AuditItem | null>(null)
  // 일괄 담당 지정 — 선택 모드
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPickOpen, setBulkPickOpen] = useState(false)
  const toggleSel = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const doBulkAssign = async (name: string | null) => {
    try {
      await auditCheckAPI.bulkAssign([...selected], name)
      setItems(prev => prev.map(i => selected.has(i.id) ? { ...i, assignee_name: name } : i))
      setBulkPickOpen(false); setSelected(new Set()); setBulkMode(false)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '일괄 지정 실패') }
  }

  const loadRounds = async (selectLast = false) => {
    setLoading(true)
    try {
      const rs = await auditCheckAPI.rounds()
      setRounds(rs)
      if (rs.length > 0 && (selectLast || !cur || !rs.some(r => r.id === cur))) setCur(rs[0].id)
      if (rs.length === 0) setCur(null)
    } finally { setLoading(false) }
  }
  useEffect(() => { loadRounds() }, [])
  useEffect(() => {
    apiClient.get('/api/v1/users/assignee-options')
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? []
        const seen = new Set<string>()
        const opts = data
          .filter((u: any) => u.name && !seen.has(u.name) && seen.add(u.name))
          .map((u: any) => ({ name: u.name as string, position: (u.position ?? null) as string | null }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ko'))
        setStaffOpts(opts)
      }).catch(() => setStaffOpts([]))
  }, [])
  useEffect(() => {
    if (!cur) { setItems([]); return }
    setItemsLoading(true)
    auditCheckAPI.items(cur).then(setItems).catch(() => setItems([])).finally(() => setItemsLoading(false))
  }, [cur])

  const patch = async (id: string, b: Parameters<typeof auditCheckAPI.patch>[1]) => {
    setBusyId(id)
    try {
      const r = await auditCheckAPI.patch(id, b)
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...r } : i))
      setRounds(prev => prev.map(rd => rd.id !== cur ? rd : {
        ...rd,
        done: b.checked === undefined ? rd.done : rd.done + (b.checked ? 1 : -1),
      }))
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setBusyId(null) }
  }

  const [batchSec, setBatchSec] = useState<string | null>(null)
  const checkAllSection = async (sec: string, list: AuditItem[]) => {
    const todo = list.filter(i => !i.checked)
    if (todo.length === 0) return
    if (!confirm(`「${sec}」 미완료 ${todo.length}건을 전부 완료 처리할까요?\n체크한 담당자로 내 이름이 기록됩니다.`)) return
    setBatchSec(sec)
    try {
      for (const i of todo) {
        const r = await auditCheckAPI.patch(i.id, { checked: true })
        setItems(prev => prev.map(x => x.id === i.id ? { ...x, ...r } : x))
      }
      setRounds(prev => prev.map(rd => rd.id !== cur ? rd : { ...rd, done: rd.done + todo.length }))
    } catch (e: any) { alert(e?.response?.data?.detail ?? '일괄 처리 중 오류') }
    finally { setBatchSec(null) }
  }

  const shareSummary = async () => {
    if (!round) return
    const undoneBySec = SECTION_ORDER
      .map(sec => ({ sec, n: items.filter(i => i.section === sec && !i.checked).length }))
      .filter(x => x.n > 0)
    const short = (sec: string) => sec.replace('지도점검 전 최종 확인', '최종확인').split(' ')[0].replace('·', '/').slice(0, 5)
    const lines = [
      `📋 지도점검 체크리스트 (${fmtDate(round.date)} 점검)`,
      `진행 ${done}/${items.length} (${pct}%)`,
      undoneBySec.length === 0 ? '✅ 전 항목 완료!' : `남은 항목: ${undoneBySec.map(x => `${short(x.sec)} ${x.n}`).join(' · ')}`,
      '관리자 페이지 → 지도점검 체크리스트에서 내 담당 항목을 확인해주세요',
    ]
    try { await shareText(lines.join('\n')) }
    catch (e: any) { alert(e?.message ?? '카카오 공유를 열 수 없습니다. 모바일 카카오톡에서 시도해주세요.') }
  }

  const filtered = useMemo(() => items
    .filter(i => !onlyTodo || !i.checked)
    .filter(i => !onlyMine || i.assignee_name === user?.name)
    .filter(i => !q || i.title.includes(q) || (i.assignee_name ?? '').includes(q)),
    [items, onlyTodo, onlyMine, q, user?.name])

  const sections = useMemo(() => SECTION_ORDER
    .map(sec => ({ sec, list: filtered.filter(i => i.section === sec) }))
    .filter(g => g.list.length > 0), [filtered])

  const round = rounds.find(r => r.id === cur)
  const done = items.filter(i => i.checked).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <ClipboardCheck size={20} className="text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">지도점검 종합 체크리스트</h1>
        <span className="text-[11px] text-gray-400">공단 지도점검 대비 152항목 — 다 같이 나눠 준비해요</span>
        <div className="ml-auto flex gap-1.5">
          {isKakaoShareEnabled() && rounds.length > 0 && (
            <button onClick={shareSummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FEE500] hover:brightness-95 text-[#3A1D1D] text-sm font-bold">
              <MessageCircle size={13} /> 카톡 공유
            </button>
          )}
          {canManage && (
            <button onClick={() => { setNewDate(''); setNewTitle(''); setNewOpen(true) }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
              <CalendarPlus size={13} /> 새 점검 일정
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : rounds.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 mt-3">
          <p className="text-sm">아직 점검 회차가 없습니다.{canManage ? ' 「새 점검 일정」으로 점검일을 정하면 체크리스트가 만들어져요.' : ' 관리자가 점검 일정을 만들면 여기에 표시됩니다.'}</p>
        </div>
      ) : (
        <>
          {/* 회차 탭 */}
          <div className="flex gap-1.5 flex-wrap my-3">
            {rounds.map(r => (
              <button key={r.id} onClick={() => setCur(r.id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${cur === r.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                {r.date} {r.title && <span className="font-semibold opacity-80">· {r.title}</span>}
                <span className={`ml-1.5 text-[10px] font-bold ${cur === r.id ? 'text-indigo-100' : r.done === r.total ? 'text-green-600' : 'text-gray-400'}`}>
                  {r.done === r.total ? '✓ 완료' : `${r.done}/${r.total}`}
                </span>
              </button>
            ))}
          </div>

          {round && (
            <>
              {/* 진행률 + 필터 */}
              <div className="flex items-center gap-2 flex-wrap mb-3 bg-white border border-gray-100 rounded-2xl p-2.5">
                <div className="flex items-center gap-2 min-w-[160px]">
                  <span className={`text-sm font-extrabold ${pct === 100 ? 'text-green-600' : 'text-indigo-600'}`}>{pct}%</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[80px]">
                    <div className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-400">{done}/{items.length}</span>
                </div>
                <div className="w-px h-6 bg-gray-100" />
                <button onClick={() => setOnlyTodo(v => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${onlyTodo ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-500 border-gray-200'}`}>
                  미완료만
                </button>
                <button onClick={() => setOnlyMine(v => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${onlyMine ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                  내 담당만
                </button>
                <button onClick={() => { setBulkMode(v => !v); setSelected(new Set()) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${bulkMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {bulkMode ? '선택 취소' : '일괄 담당 지정'}
                </button>
                <div className="relative ml-auto">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="항목·담당자 검색"
                    className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl w-40" />
                </div>
                {canManage && (
                  <button onClick={async () => {
                    if (!confirm(`${round.date} 점검 회차를 삭제할까요?\n체크 기록도 함께 사라집니다.`)) return
                    await auditCheckAPI.removeRound(round.id)
                    loadRounds(true)
                  }} title="회차 삭제" className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                )}
              </div>

              {itemsLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
              ) : (
                <div className="space-y-4">
                  {sections.map(({ sec, list }) => {
                    const sd = list.filter(i => i.checked).length
                    const secNo = SECTION_ORDER.indexOf(sec) + 1
                    const isFinal = sec === '지도점검 전 최종 확인'
                    let prevSub: string | null | undefined = '__'
                    return (
                      <section key={sec} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 ${isFinal ? 'bg-rose-50/60' : 'bg-indigo-50/40'}`}>
                          <h2 className={`text-sm font-extrabold ${isFinal ? 'text-rose-700' : 'text-indigo-800'}`}>
                            {isFinal ? '★ ' : `${secNo}. `}{sec}
                          </h2>
                          <span className={`text-[11px] font-bold ${sd === list.length ? 'text-green-600' : 'text-gray-400'}`}>
                            {sd === list.length ? '✓ 완료' : `${sd}/${list.length}`}
                          </span>
                          {!bulkMode && sd < list.length && (
                            <button onClick={() => checkAllSection(sec, list)} disabled={batchSec !== null}
                              className="text-[10px] font-bold text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full hover:bg-indigo-50 disabled:opacity-40">
                              {batchSec === sec ? <Loader2 size={10} className="animate-spin" /> : '전체 체크'}
                            </button>
                          )}
                          {bulkMode && (
                            <button onClick={() => setSelected(p => {
                              const n = new Set(p)
                              const all = list.every(i => n.has(i.id))
                              list.forEach(i => all ? n.delete(i.id) : n.add(i.id))
                              return n
                            })} className="text-[10px] font-bold text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full hover:bg-indigo-50">
                              {list.every(i => selected.has(i.id)) ? '영역 해제' : '영역 전체 선택'}
                            </button>
                          )}
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px] ml-auto">
                            <div className={`h-1.5 rounded-full ${sd === list.length ? 'bg-green-400' : isFinal ? 'bg-rose-400' : 'bg-indigo-400'}`}
                              style={{ width: `${(sd / list.length) * 100}%` }} />
                          </div>
                        </div>
                        <ul className="divide-y divide-gray-50">
                          {list.map(i => {
                            const showSub = i.sub !== prevSub
                            prevSub = i.sub
                            return (
                              <div key={i.id}>
                                {showSub && i.sub && (
                                  <p className="px-4 pt-2 pb-1 text-[11px] font-extrabold text-gray-400">▸ {i.sub}</p>
                                )}
                                <li onClick={bulkMode ? () => toggleSel(i.id) : undefined}
                                  className={`flex items-center gap-2.5 px-4 py-2 ${i.checked ? 'bg-green-50/40' : ''} ${bulkMode ? 'cursor-pointer' : ''} ${bulkMode && selected.has(i.id) ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : ''}`}>
                                  {bulkMode && (
                                    <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${selected.has(i.id) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 bg-white'}`}>
                                      {selected.has(i.id) && <span className="text-white text-[9px] font-black leading-none">✓</span>}
                                    </span>
                                  )}
                                  <button type="button" disabled={busyId === i.id || bulkMode}
                                    onClick={e => { e.stopPropagation(); patch(i.id, { checked: !i.checked }) }}
                                    className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${i.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400 bg-white'} ${busyId === i.id ? 'opacity-40' : ''}`}>
                                    {i.checked && <span className="text-white text-[11px] font-black leading-none">✓</span>}
                                  </button>
                                  <span className={`flex-1 min-w-0 text-[13px] ${i.checked ? 'line-through text-gray-400' : 'font-semibold text-gray-700'}`}>
                                    {i.title}
                                    {i.note && <span className="ml-1.5 text-[11px] font-normal text-amber-600">— {i.note}</span>}
                                  </span>
                                  {i.checked && i.checked_by && (
                                    <span className="shrink-0 text-[10px] font-bold text-green-700 bg-white border border-green-200 px-1.5 py-0.5 rounded-full">
                                      ✓ {i.checked_by}{i.checked_at && ` ${fmtDate(i.checked_at.slice(0, 10))}`}
                                    </span>
                                  )}
                                  <button type="button" onClick={e => { e.stopPropagation(); if (!bulkMode) setAssignFor(i) }}
                                    className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${i.assignee_name ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-gray-300 border-gray-200 hover:text-gray-500'}`}>
                                    {i.assignee_name
                                      ? <>{i.assignee_name}{posOf(i.assignee_name) && <span className="font-semibold opacity-60"> · {posOf(i.assignee_name)}</span>}</>
                                      : '담당 지정'}
                                  </button>
                                  {isAdmin && (
                                    <button type="button" title="항목 삭제 (이번 회차에서만)"
                                      onClick={async e => {
                                        e.stopPropagation()
                                        if (!confirm(`「${i.title}」 항목을 이 회차에서 삭제할까요?\n(다음 회차를 만들면 다시 생성됩니다)`)) return
                                        try {
                                          await auditCheckAPI.removeItem(i.id)
                                          setItems(prev => prev.filter(x => x.id !== i.id))
                                          setRounds(prev => prev.map(rd => rd.id !== cur ? rd : {
                                            ...rd, total: rd.total - 1, done: rd.done - (i.checked ? 1 : 0),
                                          }))
                                        } catch (e: any) { alert(e?.response?.data?.detail ?? '삭제 실패') }
                                      }}
                                      className="shrink-0 p-1 text-gray-200 hover:text-red-500 rounded">
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </li>
                              </div>
                            )
                          })}
                        </ul>
                      </section>
                    )
                  })}
                  {sections.length === 0 && (
                    <p className="text-center py-12 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">조건에 맞는 항목이 없습니다.</p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 일괄 지정 하단 바 */}
      {bulkMode && selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-2.5">
          <span className="text-sm font-bold">{selected.size}개 선택</span>
          <button onClick={() => setBulkPickOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-xs font-bold">담당자 지정</button>
          <button onClick={() => doBulkAssign(null)}
            className="px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs font-bold">담당 해제</button>
          <button onClick={() => setSelected(new Set())} className="p-1 text-gray-400 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* 일괄 담당자 선택 */}
      {bulkPickOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setBulkPickOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs max-h-[70vh] overflow-y-auto p-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-gray-800">{selected.size}개 항목 담당자 지정</h3>
              <button onClick={() => setBulkPickOpen(false)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <div className="space-y-1">
              {staffOpts.map(o2 => (
                <button key={o2.name} onClick={() => doBulkAssign(o2.name)}
                  className="w-full flex items-center px-3 py-2 rounded-xl text-left text-sm font-semibold text-gray-700 hover:bg-teal-50">
                  {o2.name}
                  {o2.position && <span className="ml-auto text-[11px] font-semibold text-gray-400">{o2.position}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 새 점검 일정 */}
      {newOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setNewOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <CalendarPlus size={15} className="text-indigo-500" />
              <h3 className="text-sm font-bold text-gray-800">새 점검 일정</h3>
              <button onClick={() => setNewOpen(false)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">점검일을 정하면 회차 탭이 생기고 152개 항목이 준비됩니다.</p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">점검일 *</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl mb-3" />
            <label className="block text-xs font-semibold text-gray-600 mb-1">메모 (선택)</label>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="예: 공단 정기 지도점검"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl mb-3" />
            <button disabled={!newDate}
              onClick={async () => {
                try {
                  await auditCheckAPI.createRound(newDate, newTitle || undefined)
                  setNewOpen(false)
                  loadRounds(true)
                } catch (e: any) { alert(e?.response?.data?.detail ?? '생성 실패') }
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-40">
              회차 만들기 (152항목)
            </button>
          </div>
        </div>
      )}

      {/* 담당자 지정 */}
      {assignFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAssignFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs max-h-[70vh] overflow-y-auto p-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-gray-800 truncate">담당 지정 — {assignFor.title}</h3>
              <button onClick={() => setAssignFor(null)} className="ml-auto text-gray-300 shrink-0"><X size={16} /></button>
            </div>
            <div className="space-y-1">
              <button onClick={() => { patch(assignFor.id, { assignee_name: '' }); setAssignFor(null) }}
                className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-gray-400 hover:bg-gray-50">담당 해제</button>
              {staffOpts.map(o2 => (
                <button key={o2.name} onClick={() => { patch(assignFor.id, { assignee_name: o2.name }); setAssignFor(null) }}
                  className={`w-full flex items-center px-3 py-2 rounded-xl text-left text-sm font-semibold hover:bg-teal-50 ${assignFor.assignee_name === o2.name ? 'text-teal-700 bg-teal-50' : 'text-gray-700'}`}>
                  {o2.name}
                  {o2.position && <span className="ml-auto text-[11px] font-semibold text-gray-400">{o2.position}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
