import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Search, StickyNote, X } from 'lucide-react'
import { workScheduleAPI, type StaffMemo } from '@/api/workScheduleClient'

/**
 * 그 달, 선생님별 메모.
 *
 * ■ 저장 버튼이 없다
 *   칸을 벗어나면 그때 저장한다. 저장 버튼을 두면 적어 놓고 안 누른 채
 *   닫는 일이 반드시 생기고, 그러면 적은 사람은 적었다고 믿는다.
 *   대신 저장됐다는 표시를 그 줄에 낸다 — 표시가 없으면 저장을 믿을 수 없다.
 *
 * ■ 한 화면에 다 모아 둔다
 *   사람마다 창을 따로 띄우면 여러 명에게 이어서 적을 때 열고 닫기를
 *   반복한다. 목록으로 두면 위에서 아래로 훑으며 적는다.
 *
 * ■ 달이 바뀌면 빈 칸에서 시작한다
 *   8월 메모가 9월에 남아 있으면 읽는 사람은 그것을 9월 이야기로 안다.
 *   (그래서 근무표의 '비고' 열에 얹지 않고 달마다 따로 저장한다)
 *
 * 벽보에는 나가지 않는다 — 사람에 대한 기록이라 화면에서만 본다.
 */

type Person = { id: string; name: string; pos?: string | null; team?: string | null }

export default function StaffMemoPanel({ ym, people, memos, onChange, onClose, focusId }: {
  ym: string
  people: Person[]
  memos: Record<string, StaffMemo>
  onChange: (m: StaffMemo) => void
  onClose: () => void
  focusId?: string | null
}) {
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, 'saving' | 'ok'>>({})
  const boxes = useRef<Record<string, HTMLTextAreaElement | null>>({})

  // 서버에서 온 것을 초안의 바닥으로 깐다. 내가 고치는 중인 칸은 건드리지 않는다.
  useEffect(() => {
    setDraft(d => {
      const next = { ...d }
      Object.values(memos).forEach(m => { if (next[m.staff_id] === undefined) next[m.staff_id] = m.memo })
      return next
    })
  }, [memos])

  // 표에서 어떤 선생님의 쪽지를 눌러 열었으면 그 칸으로 데려간다
  useEffect(() => {
    if (!focusId) return
    const el = boxes.current[focusId]
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.focus()
  }, [focusId, people.length])

  const shown = useMemo(() => {
    const key = q.trim()
    if (!key) return people
    return people.filter(p => p.name.includes(key) || (p.pos ?? '').includes(key) || (p.team ?? '').includes(key))
  }, [people, q])

  const written = people.filter(p => (draft[p.id] ?? memos[p.id]?.memo ?? '').trim()).length

  const save = async (p: Person) => {
    const text = (draft[p.id] ?? '').trim()
    const before = (memos[p.id]?.memo ?? '').trim()
    if (text === before) return                 // 안 바뀌었으면 서버를 부르지 않는다
    setBusy(b => ({ ...b, [p.id]: 'saving' }))
    try {
      const r = await workScheduleAPI.saveMemo({ year_month: ym, staff_id: p.id, memo: text })
      onChange(r)
      setBusy(b => ({ ...b, [p.id]: 'ok' }))
      setTimeout(() => setBusy(b => { const n = { ...b }; delete n[p.id]; return n }), 1500)
    } catch (e: any) {
      // 되돌린다 — 화면만 바뀌고 서버는 그대로면, 다음에 열었을 때 왜 사라졌는지 모른다
      setDraft(d => ({ ...d, [p.id]: before }))
      setBusy(b => { const n = { ...b }; delete n[p.id]; return n })
      alert(`${p.name} 선생님 메모를 저장하지 못했습니다.\n${e?.message ?? ''}`)
    }
  }

  const m = Number(ym.slice(5, 7))

  return (
    <div className="fixed inset-0 z-[70] flex justify-end print:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <aside className="relative bg-white w-full max-w-md h-full flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
          <StickyNote size={16} className="text-amber-600" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">{m}월 선생님 메모</h2>
            <p className="text-[11px] text-gray-400">
              {written > 0 ? `${written}명 적혀 있습니다` : '아직 적힌 메모가 없습니다'} · 이 달에만 남습니다
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-600"><X size={17} /></button>
        </div>

        <div className="px-3 py-2 border-b shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="성함 · 직종 · 조로 찾기"
              className="w-full pl-7 pr-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-amber-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {shown.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">찾는 선생님이 없습니다.</p>
          ) : shown.map(p => {
            const v = draft[p.id] ?? memos[p.id]?.memo ?? ''
            const meta = memos[p.id]
            return (
              <div key={p.id} className={`px-4 py-2.5 ${focusId === p.id ? 'bg-amber-50/60' : ''}`}>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-[13px] font-bold text-gray-900">{p.name}</span>
                  <span className="text-[10px] text-gray-400">{[p.pos, p.team].filter(Boolean).join(' · ')}</span>
                  <span className="ml-auto text-[10px]">
                    {busy[p.id] === 'saving' && <Loader2 size={11} className="animate-spin text-gray-300 inline" />}
                    {busy[p.id] === 'ok' && <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600"><Check size={10} />저장</span>}
                    {!busy[p.id] && meta?.updated_by && (
                      <span className="text-gray-300">
                        {meta.updated_by}
                        {meta.updated_at && ` · ${new Date(meta.updated_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}`}
                      </span>
                    )}
                  </span>
                </div>
                <textarea
                  ref={el => { boxes.current[p.id] = el }}
                  value={v} rows={2} maxLength={1000}
                  onChange={e => setDraft(d => ({ ...d, [p.id]: e.target.value }))}
                  onBlur={() => save(p)}
                  // 키보드만으로도 끝낼 수 있게 — 적고 Ctrl+Enter 면 저장되고 칸을 벗어난다
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur() }}
                  placeholder="예) 9/15 오전 병원 예약 · 야간 뒤 연차 희망"
                  className={`w-full px-2 py-1.5 rounded-lg border text-[13px] resize-none focus:outline-none ${
                    v.trim() ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'} focus:border-amber-400`} />
              </div>
            )
          })}
        </div>

        <p className="px-4 py-2 border-t text-[11px] text-gray-400 shrink-0">
          칸을 벗어나면 바로 저장됩니다 · 근무표가 확정된 뒤에도 적을 수 있습니다 · 벽보에는 나가지 않습니다
        </p>
      </aside>
    </div>
  )
}
