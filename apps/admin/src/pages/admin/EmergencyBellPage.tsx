import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Printer, Save, BellRing, Info, AlertTriangle } from 'lucide-react'
import { bellAPI, type BellPage } from '@/api/emergencyBellClient'
import { buildRoomCards, splitPages } from '@/utils/bellLayout'
import { pickOrder, missingInRoom, unknownNames } from '@/utils/bellResidents'

/**
 * 응급벨 명단 — 벨 번호마다 어느 어르신인지 정하고 배치도로 뽑는다.
 *
 * 벨이 울리면 번호만 뜬다. 그 번호가 몇 호실 누구인지 알아야 바로 달려간다.
 * 그래서 층마다 배치도를 뽑아 벽에 붙인다.
 *
 * 화면에서 이름을 고치고, 그대로 인쇄한다. 화면과 인쇄물이 같은 그림이라
 * '인쇄하면 어떻게 나오지' 를 따로 상상하지 않아도 된다.
 *
 * 벨 번호·호실·구분은 설비라서 여기서 바꾸지 않는다.
 */

export default function EmergencyBellPage() {
  const [data, setData] = useState<BellPage | null>(null)
  const [floor, setFloor] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Record<string, { name: string; status: string }>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const printedAt = useRef(new Date())

  const load = () => {
    setLoading(true)
    bellAPI.list()
      .then(d => {
        setData(d)
        setFloor(f => f || d.floors[0] || '')
        const m: Record<string, { name: string; status: string }> = {}
        d.rows.forEach(b => { m[b.id] = { name: b.resident_name ?? '', status: b.status ?? '' } })
        setDraft(m)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const bells = useMemo(
    () => (data?.rows ?? []).filter(b => b.floor === floor), [data, floor])
  const cards = useMemo(() => buildRoomCards(bells), [bells])
  // 벽에 나란히 붙이는 문서라 장수가 적을수록 좋다. 한 층이 두 장을 넘지
  // 않게, 두 장의 무게가 비슷하게 나눈다(utils/bellLayout.splitPages).
  const pages = useMemo(() => splitPages(cards), [cards])

  const residents = data?.residents ?? []

  /** 적어 둔 이름 중 수급자 명단에 없는 것 — 오타이거나 퇴소한 분이다 */
  const unknown = useMemo(
    () => unknownNames(residents, bells.filter(b => !b.is_wc).map(b => draft[b.id]?.name ?? '')),
    [residents, bells, draft])

  const dirty = useMemo(() => (data?.rows ?? []).some(b => {
    const d = draft[b.id]; if (!d) return false
    return d.name !== (b.resident_name ?? '') || d.status !== (b.status ?? '')
  }), [data, draft])

  const set = (id: string, p: Partial<{ name: string; status: string }>) =>
    setDraft(s => {
      const cur = s[id] ?? { name: '', status: '' }
      const next = { ...cur, ...p }
      // 이름을 지우면 '재실'도 함께 지운다 — 빈칸이 재실로 남으면 배치도가 거짓말이 된다
      if (next.name.trim() === '' && next.status === '재실') next.status = ''
      return { ...s, [id]: next }
    })

  const save = async () => {
    if (!data) return
    setSaving(true)
    try {
      const items = data.rows.filter(b => !b.is_wc).map(b => ({
        id: b.id,
        resident_name: draft[b.id]?.name ?? '',
        status: draft[b.id]?.status ?? '',
      }))
      const r = await bellAPI.saveMany(items)
      if (r.failed.length) alert(`${r.failed.length}칸을 저장하지 못했습니다.`)
      setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '저장하지 못했습니다')
    } finally { setSaving(false) }
  }

  const canEdit = !!data?.can_edit
  const today = printedAt.current
  const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`

  const filled = bells.filter(b => !b.is_wc && (draft[b.id]?.name ?? '').trim()).length
  const roomBells = bells.filter(b => !b.is_wc).length

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto eb-root">
      {/* ── 조작부 (인쇄에서는 빠진다) ── */}
      <div className="print:hidden">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <BellRing className="text-rose-600" size={20} />
          <h1 className="text-xl font-bold text-gray-900">응급벨 명단</h1>
          {!canEdit && (
            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
              보기 전용
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          벨이 울리면 번호만 뜹니다. 번호 → 방 → 성함을 보고 바로 달려갈 수 있게 층마다 붙여 두세요.
        </p>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden bg-white">
            {(data?.floors ?? []).map(f => (
              <button key={f} onClick={() => setFloor(f)}
                className={`px-4 py-2 text-sm font-bold transition-colors ${
                  floor === f ? 'bg-rose-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{f}</button>
            ))}
          </div>
          {!loading && (
            <span className="text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
              {filled} / {roomBells}자리 지정
            </span>
          )}
          {canEdit && (
            <button onClick={save} disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
            </button>
          )}
          {dirty && <span className="text-[11px] text-amber-600 font-semibold">저장하지 않은 변경이 있습니다</span>}
          {!dirty && savedAt && <span className="text-[11px] text-emerald-600 font-semibold">{savedAt} 저장됨</span>}
          <button onClick={() => { printedAt.current = new Date(); setTimeout(() => window.print(), 50) }}
            disabled={dirty}
            title={dirty ? '먼저 저장해주세요 — 저장 안 한 내용이 인쇄될 수 있습니다' : `${floor} 배치도 인쇄`}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <Printer size={15} /> 배치도 인쇄
          </button>
        </div>

        {unknown.length > 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 flex items-start gap-1.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              수급자 명단에 없는 이름이 있습니다 — <b>{unknown.join(', ')}</b>.
              오타이거나 퇴소하신 분일 수 있습니다. 벨이 울렸을 때 헛사람을 찾게 되니 확인해주세요.
            </span>
          </p>
        )}

        <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-4 flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0 text-gray-400" />
          <span>
            벨 번호·호실·화장실 배치는 설비라 여기서 바꾸지 않습니다. 바뀌었다면 알려주세요.
            비워 두면 배치도에 <b>점선 빈칸</b>으로 나가 손으로 적을 수 있습니다.
            성함 칸을 누르면 <b>수급자 관리에 등록된 어르신</b>이 같은 방부터 뜹니다.
          </span>
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : !data ? (
        <p className="text-sm text-gray-400 py-20 text-center">불러오지 못했습니다.</p>
      ) : (
        <>
          {pages.map((pageCards, pi) => (
            <section key={pi} className="eb-page mb-6">
              {/* 머리 */}
              <div className="flex items-center gap-2 flex-wrap border-b-2 border-rose-700 pb-2 mb-2">
                <h2 className="text-xl font-extrabold text-rose-700">{floor} 응급벨 배치도</h2>
                <span className="text-[11px] font-bold text-white bg-rose-700 px-2 py-1 rounded-lg">
                  {pageCards[0]?.room} ~ {pageCards[pageCards.length - 1]?.room}
                </span>
                <span className="ml-auto text-[11px] font-bold text-rose-700">{pi + 1} / {pages.length}</span>
              </div>

              {/* 범례 */}
              <div className="flex items-center gap-3 flex-wrap text-[10px] text-gray-600 mb-2">
                <span className="inline-flex items-center gap-1"><i className="w-4 h-3 rounded border-2 border-rose-600 inline-block" /> 생활실 (어르신)</span>
                <span className="inline-flex items-center gap-1"><i className="w-4 h-3 rounded bg-sky-100 border border-sky-400 inline-block" /> 화장실</span>
                <span className="inline-flex items-center gap-1"><i className="w-4 h-3 rounded border border-dashed border-rose-300 inline-block" /> 빈자리 (직접 기재)</span>
                <span className="inline-flex items-center gap-1"><i className="w-4 h-3 rounded bg-gray-200 inline-block" /> 공실 (사용 안 함)</span>
                <span className="inline-flex items-center gap-1"><i className="w-4 h-3 rounded border-2 border-dashed border-sky-500 inline-block" /> 두 방이 함께 쓰는 화장실</span>
              </div>

              <div className="eb-grid grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(pageCards.length, 1)}, minmax(0,1fr))` }}>
                {pageCards.map(card => (
                  <div key={card.room} className="eb-card border-2 border-rose-700 rounded-xl overflow-hidden flex flex-col bg-white">
                    <div className="bg-rose-700 text-white text-center py-1.5">
                      <p className="text-base font-extrabold leading-tight">{card.room}</p>
                      <p className="text-[9px] opacity-90">{card.numbers.join(' · ')}번</p>
                    </div>

                    <div className="flex-1 divide-y divide-rose-100">
                      {card.bells.filter(b => !b.is_wc).map(b => {
                        const d = draft[b.id] ?? { name: '', status: '' }
                        const empty = !d.name.trim()
                        const vacant = d.status === '공실'
                        return (
                          <div key={b.id} className={`flex items-center gap-2 px-2 py-2 ${vacant ? 'bg-gray-100' : ''}`}>
                            <span className="w-7 h-7 shrink-0 rounded-full bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center">{b.no}</span>
                            {canEdit ? (
                              <input value={d.name} maxLength={20}
                                onChange={e => set(b.id, { name: e.target.value })}
                                list={`res-${b.id}`}
                                placeholder="성함"
                                // 인쇄에서는 '성함' 안내글 대신 점선 빈칸으로 나가게 한다 —
                                // 벽보에 '성함 성함 성함' 이 늘어서면 읽을 수가 없다
                                data-empty={empty ? '1' : undefined}
                                className={`eb-input flex-1 min-w-0 px-1 py-0.5 text-sm font-bold rounded border ${
                                  empty ? 'border-dashed border-rose-300 text-gray-400' : 'border-transparent text-gray-900'} focus:outline-none focus:border-rose-400`} />
                            ) : (
                              <span className={`flex-1 text-sm font-bold ${empty ? 'text-gray-300' : 'text-gray-900'}`}>
                                {d.name || '⋯⋯⋯'}
                              </span>
                            )}
                            {canEdit && (
                              // 같은 방 어르신이 맨 앞에 온다 — 대개 첫 두세 명 안에서 끝난다.
                              // 직접 칠 수도 있게 둔다(명단에 없는 분을 임시로 적어야 할 때가 있다).
                              <datalist id={`res-${b.id}`}>
                                {pickOrder(residents, b.floor, b.room).map(r => (
                                  <option key={`${r.name}-${r.room}`} value={r.name}>
                                    {r.room ? `${r.room}호` : ''}{r.floor ? ` · ${r.floor}` : ''}
                                  </option>
                                ))}
                              </datalist>
                            )}
                            {canEdit && (
                              <button type="button" title="공실로 표시"
                                onClick={() => set(b.id, { status: vacant ? '' : '공실' })}
                                className={`eb-vac shrink-0 text-[9px] font-bold px-1.5 py-1 rounded border ${
                                  vacant ? 'bg-gray-500 text-white border-gray-500' : 'text-gray-300 border-gray-200'}`}>공실</button>
                            )}
                            {!canEdit && vacant && <span className="text-[9px] font-bold text-gray-500">공실</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* 이 방에 계신데 아직 어느 벨에도 안 넣은 분.
                        빠뜨리면 그분 자리만 배치도에 비어 있게 된다. */}
                    {canEdit && (() => {
                      const miss = missingInRoom(residents, floor, card.room,
                        card.bells.filter(b => !b.is_wc).map(b => draft[b.id]?.name ?? ''))
                      if (!miss.length) return null
                      return (
                        <div className="print:hidden bg-amber-50 border-t border-amber-200 px-2 py-1.5">
                          <p className="text-[10px] font-bold text-amber-800 mb-1">아직 안 넣은 어르신</p>
                          <div className="flex flex-wrap gap-1">
                            {miss.map(r => (
                              <button key={r.name} type="button"
                                onClick={() => {
                                  // 비어 있는 첫 칸에 넣는다 — 어느 칸인지는 사람이 옮기면 된다
                                  const slot = card.bells.find(b => !b.is_wc && !(draft[b.id]?.name ?? '').trim())
                                  if (!slot) { alert('이 방에 빈 칸이 없습니다.'); return }
                                  set(slot.id, { name: r.name })
                                }}
                                className="text-[10px] font-bold text-amber-900 bg-white border border-amber-300 px-1.5 py-0.5 rounded hover:bg-amber-100">
                                + {r.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* 이 방에 달린 화장실 */}
                    {card.bells.filter(b => b.is_wc).map(b => (
                      <div key={b.id} className="bg-sky-50 border-t-2 border-sky-500 px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-[11px] font-extrabold flex items-center justify-center">{b.no}</span>
                          <span className="text-sm font-extrabold text-sky-900">화장실</span>
                          <span className="text-[9px] font-bold text-white bg-sky-600 px-1.5 py-0.5 rounded">
                            {b.kind.includes('전용') ? '전용' : b.kind.includes('층') ? '층 공용' : '공용'}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-sky-800 mt-0.5">{b.note}</p>
                      </div>
                    ))}

                    {/* 옆방에 달린, 함께 쓰는 화장실 — 안내만 */}
                    {card.sharedRef && (
                      <div className="bg-sky-50/60 border-t-2 border-dashed border-sky-500 px-2 py-2 flex items-center gap-1.5">
                        <span className="w-6 h-6 shrink-0 rounded-full bg-sky-600 text-white text-[11px] font-extrabold flex items-center justify-center">{card.sharedRef.no}</span>
                        <p className="text-[10px] font-bold text-sky-800 leading-tight">
                          {card.sharedRef.no}번 화장실<br />{card.sharedRef.withRoom}와 함께 사용 ▶
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 꼬리 */}
              <div className="mt-2 pt-1.5 border-t-2 border-rose-700 flex items-start gap-3 text-[10px] text-gray-600">
                <div className="flex-1">
                  <p>※ 벨이 울리면 <b className="text-rose-700">번호 → 방 → 성함</b> 순서로 확인하고 즉시 해당 생활실로 이동합니다.</p>
                  <p>※ <b className="text-rose-700">점선 빈칸</b>은 아직 정해지지 않은 자리입니다. 성함을 적어 주세요. / 파란 점선 띠는 <b className="text-sky-700">두 방이 함께 쓰는 화장실</b>입니다.</p>
                </div>
                <div className="text-right shrink-0">
                  <p>※ 입·퇴소 시 반드시 수정 후 재출력</p>
                  <p>작성일 : {dateStr} &nbsp; 확인 : &nbsp;&nbsp;&nbsp; (인)</p>
                </div>
              </div>
            </section>
          ))}
        </>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 7mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          /* 한 층이 여러 장이면 장마다 새 쪽 — 방 카드가 쪽 경계에서 잘리면
             벽에 붙였을 때 그 방만 반쪽이 된다 */
          .eb-page { page-break-after: always; break-after: page; margin: 0 !important; }
          .eb-page:last-child { page-break-after: auto; break-after: auto; }
          .eb-card { break-inside: avoid; page-break-inside: avoid; }
          /* 한 장에 방이 여섯이면 칸이 좁아진다 — 이름이 잘리지 않게 줄인다.
             (이름은 대개 세 글자라 이 크기로 충분하다) */
          .eb-grid { gap: 1.5mm !important; }
          /* 입력칸을 종이에서는 글자처럼 보이게 — 네모 상자가 줄줄이 찍히면 읽기 나쁘다 */
          .eb-input { border-color: transparent !important; background: transparent !important; }
          /* 안내글('성함')은 화면에서만 쓴다. 종이에는 손으로 적을 점선만 남긴다 */
          .eb-input::placeholder { color: transparent !important; }
          .eb-input[data-empty] {
            border-bottom: 1.2px dotted #e5a3a3 !important;
            border-radius: 0 !important;
          }
          .eb-vac { display: none !important; }
        }
      `}</style>
    </div>
  )
}
