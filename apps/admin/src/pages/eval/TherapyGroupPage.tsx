import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users, Plus, Trash2, Loader2, RefreshCw, CalendarClock, X, Radio, BellRing, Wand2,
} from 'lucide-react'
import {
  therapyAPI, KIND_META, WEEKDAYS, AXIS_META,
  type TherapyOverview, type TherapyGroup, type TherapySlot, type GroupKind,
  type ComposeAxis, type ComposePlan,
} from '@/api/therapyClient'

/**
 * 치료 프로그램 조 편성.
 *
 * 작업치료사 한 사람이 어르신 예순여덟 분을 매일 볼 수는 없다. 그래서 조로
 * 나눈다 — 나와서 앉아 계실 수 있는 분은 조 활동으로, 누워 계신 분은 방으로
 * 찾아간다. 조마다 요일과 시각을 정해 두면 그 시간에 방송으로 이름을 부르고
 * 담당 선생님께 알림이 간다.
 *
 * 이 화면이 지키는 것
 *  · 한 분은 한 조에만. 두 조에 있으면 같은 시간에 두 곳에서 부른다.
 *  · 아직 어느 조에도 없는 분을 늘 보여준다. 편성에서 빠진 사람이 조용히
 *    묻히면 그 어르신만 프로그램을 못 받는다.
 */
export default function TherapyGroupPage() {
  const [ov, setOv] = useState<TherapyOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<TherapyGroup | null>(null)
  const [slotOpen, setSlotOpen] = useState<TherapySlot | 'new' | null>(null)
  const [autoOpen, setAutoOpen] = useState(false)

  const load = useCallback(async () => {
    try { setOv(await therapyAPI.overview()); setErr('') }
    catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '불러오지 못했습니다') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('')
    try { await fn(); await load() }
    catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '실패했습니다') }
    finally { setBusy(false) }
  }

  const groups = ov?.groups ?? []
  const gmap = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups])
  const assigned = groups.reduce((n, g) => n + g.count, 0)

  /** 요일별로 묶은 시간표 — 표로 보려면 이 모양이어야 한다 */
  const byDay = useMemo(() => {
    const m: Record<number, TherapySlot[]> = {}
    for (const s of ov?.slots ?? []) (m[s.weekday] ??= []).push(s)
    for (const k of Object.keys(m)) m[+k].sort((a, b) => a.start_time.localeCompare(b.start_time))
    return m
  }, [ov?.slots])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-gray-300" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">치료 프로그램 조 편성</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            조를 짜고 시간표를 정하면, 그 시간에 방송으로 부르고 알림이 갑니다
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={busy}
            className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setAutoOpen(true)}
            title="수급자에 이미 적혀 있는 인지·여가·신체 그룹으로 조를 한 번에 짭니다"
            className="flex items-center gap-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-100">
            <Wand2 size={15} /> 자동 편성
          </button>
          <button onClick={() => setEditing({
            id: '', name: '', floor: '', kind: 'gather', note: '', color: '',
            sort: groups.length, active: true, members: [], count: 0,
          })}
            className="flex items-center gap-1.5 bg-primary-orange text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 shadow-sm">
            <Plus size={15} /> 조 만들기
          </button>
        </div>
      </div>

      {err && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{err}</p>}

      {/* 편성 현황 — 빠진 분이 있는지가 한눈에 보여야 한다 */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="조" value={`${groups.length}개`} tone="orange" />
        <Stat label="편성된 어르신" value={`${assigned}명`} tone="green" />
        <Stat label="아직 편성 안 된 분" value={`${ov?.unassigned.length ?? 0}명`}
          tone={(ov?.unassigned.length ?? 0) > 0 ? 'amber' : 'gray'} />
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">아직 조가 없습니다</p>
          <p className="text-xs mt-1.5">
            먼저 「나오는 조」와 「찾아가는 조」를 만들고 어르신을 넣어주세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {groups.map(g => (
            <GroupCard key={g.id} g={g} busy={busy}
              unassigned={ov?.unassigned ?? []}
              onEdit={() => setEditing(g)}
              onDelete={() => {
                if (!confirm(`'${g.name}' 을 지울까요?\n조원 연결만 끊고 어르신은 지우지 않습니다.`)) return
                act(() => therapyAPI.deleteGroup(g.id))
              }}
              onMembers={ids => act(() => therapyAPI.setMembers(g.id, ids))} />
          ))}
        </div>
      )}

      {/* 아직 어느 조에도 없는 분 */}
      {(ov?.unassigned.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-800 mb-1">
            아직 어느 조에도 없는 어르신 {ov!.unassigned.length}명
          </p>
          <p className="text-xs text-amber-700 mb-2">
            이 분들은 프로그램 시간에 불리지 않습니다. 조에 넣어주세요.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ov!.unassigned.map(u => (
              <span key={u.resident_id}
                className="text-[11px] bg-white border border-amber-200 rounded-lg px-2 py-1 text-gray-700">
                {u.name}
                <span className="text-gray-400 ml-1">{u.floor}{u.room ? ` ${u.room}호` : ''}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 시간표 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <CalendarClock size={16} className="text-gray-400" />
            <h2 className="font-bold text-gray-900">주간 시간표</h2>
            <span className="text-xs text-gray-400">{ov?.slots.length ?? 0}칸</span>
          </div>
          <button onClick={() => setSlotOpen('new')} disabled={groups.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <Plus size={13} /> 시간 넣기
          </button>
        </div>

        {(ov?.slots.length ?? 0) === 0 ? (
          <p className="text-xs text-gray-400 py-8 text-center">
            시간표가 비어 있습니다. 「시간 넣기」로 요일과 시각을 정해주세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className="min-w-0">
                <p className={`text-[11px] font-bold mb-1.5 ${i >= 5 ? 'text-rose-500' : 'text-gray-500'}`}>{w}</p>
                <div className="space-y-1.5">
                  {(byDay[i] ?? []).map(s => {
                    const g = gmap.get(s.group_id)
                    return (
                      <button key={s.id} onClick={() => setSlotOpen(s)}
                        className={`w-full text-left rounded-lg border px-2 py-1.5 transition-colors ${
                          s.active ? 'border-gray-200 hover:bg-gray-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                        <div className="text-[11px] font-mono text-gray-500">
                          {s.start_time}{s.end_time ? `–${s.end_time}` : ''}
                        </div>
                        <div className="text-[11.5px] font-bold text-gray-800 truncate">
                          {g?.name ?? '(지워진 조)'}
                        </div>
                        {s.activity && (
                          <div className="text-[10px] text-gray-400 truncate">{s.activity}</div>
                        )}
                        <div className="flex gap-1 mt-0.5">
                          {s.broadcast && <Radio size={9} className="text-teal-500" />}
                          {s.notify && <BellRing size={9} className="text-indigo-500" />}
                        </div>
                      </button>
                    )
                  })}
                  {(byDay[i] ?? []).length === 0 && (
                    <p className="text-[10px] text-gray-300 py-2 text-center">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10.5px] text-gray-400 mt-3 leading-relaxed">
          <Radio size={10} className="inline text-teal-500" /> 방송 ·
          <BellRing size={10} className="inline text-indigo-500 ml-1" /> 알림 —
          찾아가는 조는 보통 방송을 끕니다. 누워 계신 분을 불러낼 수는 없고, 방송은 소음이 됩니다.
        </p>
      </div>

      {editing && (
        <GroupModal g={editing} busy={busy} onClose={() => setEditing(null)}
          onSave={async b => {
            await act(() => editing.id
              ? therapyAPI.updateGroup(editing.id, b)
              : therapyAPI.createGroup(b as any))
            setEditing(null)
          }} />
      )}
      {autoOpen && (
        <AutoComposeModal busy={busy} onClose={() => setAutoOpen(false)}
          onDone={async () => { setAutoOpen(false); await load() }} />
      )}
      {slotOpen && (
        <SlotModal slot={slotOpen === 'new' ? null : slotOpen} groups={groups} busy={busy}
          onClose={() => setSlotOpen(null)}
          onSave={async b => {
            await act(() => slotOpen === 'new'
              ? therapyAPI.createSlot(b as any)
              : therapyAPI.updateSlot(slotOpen.id, b))
            setSlotOpen(null)
          }}
          onDelete={slotOpen === 'new' ? undefined : async () => {
            if (!confirm('이 시간을 지울까요?')) return
            await act(() => therapyAPI.deleteSlot(slotOpen.id))
            setSlotOpen(null)
          }} />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  const cls: Record<string, string> = {
    orange: 'bg-orange-50', green: 'bg-green-50', amber: 'bg-amber-50', gray: 'bg-gray-50',
  }
  return (
    <div className={`${cls[tone]} rounded-xl p-4 border border-white shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function GroupCard({ g, unassigned, busy, onEdit, onDelete, onMembers }: {
  g: TherapyGroup
  unassigned: { resident_id: string; name: string; floor?: string | null; room?: string | null }[]
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onMembers: (ids: string[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const meta = KIND_META[g.kind]
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-gray-900">{g.name}</span>
            {g.floor && <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">{g.floor}</span>}
            <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 border ${
              g.kind === 'visit'
                ? 'text-violet-700 bg-violet-50 border-violet-200'
                : 'text-sky-700 bg-sky-50 border-sky-200'}`}>{meta.label}</span>
            <span className="text-xs text-gray-400">{g.count}명</span>
          </div>
          {g.note && <p className="text-[11px] text-gray-500 mt-0.5">{g.note}</p>}
        </div>
        <button onClick={onEdit} className="text-[11px] text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50">수정</button>
        <button onClick={onDelete} title="조 지우기"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:bg-rose-50 hover:text-rose-500">
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {g.members.map(m => (
          <span key={m.resident_id}
            className="inline-flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
            {m.name}
            <span className="text-gray-400">{m.room ? `${m.room}호` : ''}</span>
            <button title="이 조에서 빼기" disabled={busy}
              onClick={() => onMembers(g.members.filter(x => x.resident_id !== m.resident_id).map(x => x.resident_id))}
              className="text-gray-300 hover:text-rose-500"><X size={11} /></button>
          </span>
        ))}
        {g.members.length === 0 && <span className="text-[11px] text-gray-400 py-1">아직 아무도 없습니다.</span>}
      </div>

      <button onClick={() => setAdding(v => !v)}
        className="mt-2 text-[11px] font-bold text-indigo-600 hover:underline">
        {adding ? '닫기' : '+ 어르신 넣기'}
      </button>
      {adding && (
        <div className="mt-1.5 border border-gray-100 rounded-lg p-2 max-h-40 overflow-y-auto">
          {unassigned.length === 0
            ? <p className="text-[11px] text-gray-400 text-center py-2">편성 안 된 어르신이 없습니다.</p>
            : (
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map(u => (
                  <button key={u.resident_id} disabled={busy}
                    onClick={() => onMembers([...g.members.map(x => x.resident_id), u.resident_id])}
                    className="text-[11px] border border-dashed border-gray-300 rounded-lg px-2 py-1 hover:border-indigo-400 hover:text-indigo-600">
                    {u.name}<span className="text-gray-400 ml-1">{u.floor}</span>
                  </button>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  )
}

function GroupModal({ g, busy, onClose, onSave }: {
  g: TherapyGroup; busy: boolean; onClose: () => void
  onSave: (b: Partial<TherapyGroup>) => void
}) {
  const [f, setF] = useState({
    name: g.name, floor: g.floor ?? '', kind: g.kind as GroupKind, note: g.note ?? '',
  })
  const ic = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200'
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900">{g.id ? '조 수정' : '조 만들기'}</h3>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">조 이름 *</label>
          <input autoFocus value={f.name} onChange={e => setF({ ...f, name: e.target.value })}
            className={ic} placeholder="예: 가온조" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">층</label>
          <input value={f.floor} onChange={e => setF({ ...f, floor: e.target.value })}
            className={ic} placeholder="예: 2층" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">성격</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['gather', 'visit'] as GroupKind[]).map(k => (
              <button key={k} type="button" onClick={() => setF({ ...f, kind: k })}
                className={`py-2 rounded-xl text-xs font-bold border ${
                  f.kind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>
                {KIND_META[k].label}
              </button>
            ))}
          </div>
          <p className="text-[10.5px] text-gray-400 mt-1">{KIND_META[f.kind].hint}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">설명 <span className="font-normal text-gray-400">(선택)</span></label>
          <input value={f.note} onChange={e => setF({ ...f, note: e.target.value })}
            className={ic} placeholder="예: 상태가 나은 분" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => onSave(f)} disabled={busy || !f.name.trim()}
            className="flex-1 bg-primary-orange text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
            저장
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm">취소</button>
        </div>
      </div>
    </div>
  )
}

function SlotModal({ slot, groups, busy, onClose, onSave, onDelete }: {
  slot: TherapySlot | null
  groups: TherapyGroup[]
  busy: boolean
  onClose: () => void
  onSave: (b: Partial<TherapySlot>) => void
  onDelete?: () => void
}) {
  const [f, setF] = useState({
    weekday: slot?.weekday ?? 0,
    start_time: slot?.start_time ?? '09:45',
    end_time: slot?.end_time ?? '10:25',
    group_id: slot?.group_id ?? groups[0]?.id ?? '',
    place: slot?.place ?? '',
    activity: slot?.activity ?? '',
    broadcast: slot?.broadcast ?? true,
    notify: slot?.notify ?? true,
    lead_min: slot?.lead_min ?? 10,
    active: slot?.active ?? true,
  })
  const g = groups.find(x => x.id === f.group_id)
  const ic = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200'
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900">{slot ? '시간 수정' : '시간 넣기'}</h3>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">요일</label>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w, i) => (
              <button key={w} type="button" onClick={() => setF({ ...f, weekday: i })}
                className={`py-2 rounded-lg text-xs font-bold border ${
                  f.weekday === i ? 'bg-indigo-600 text-white border-indigo-600'
                    : `border-gray-200 ${i >= 5 ? 'text-rose-500' : 'text-gray-600'}`}`}>{w}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">시작 *</label>
            <input type="time" value={f.start_time} onChange={e => setF({ ...f, start_time: e.target.value })} className={ic} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">종료</label>
            <input type="time" value={f.end_time} onChange={e => setF({ ...f, end_time: e.target.value })} className={ic} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">조 *</label>
          <select value={f.group_id} onChange={e => setF({ ...f, group_id: e.target.value })} className={ic}>
            {groups.map(x => <option key={x.id} value={x.id}>{x.name} ({x.count}명)</option>)}
          </select>
          {g?.kind === 'visit' && f.broadcast && (
            <p className="text-[10.5px] text-amber-700 mt-1">
              찾아가는 조입니다 — 방송을 켜두면 누워 계신 분을 부르는 방송이 나갑니다.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">장소</label>
            <input value={f.place} onChange={e => setF({ ...f, place: e.target.value })} className={ic} placeholder="3층 프로그램실" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">몇 분 전 알림</label>
            <input type="number" min={0} max={60} value={f.lead_min}
              onChange={e => setF({ ...f, lead_min: Number(e.target.value) })} className={ic} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">활동</label>
          <input value={f.activity} onChange={e => setF({ ...f, activity: e.target.value })}
            className={ic} placeholder="예: 옛 사진으로 기억 되살리기" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {([['broadcast', '방송', Radio], ['notify', '알림', BellRing]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setF({ ...f, [k]: !f[k] })}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border ${
                f[k] ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-200 text-gray-400'}`}>
              <Icon size={12} /> {label} {f[k] ? '켬' : '끔'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => onSave(f)} disabled={busy || !f.group_id}
            className="flex-1 bg-primary-orange text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
            저장
          </button>
          {onDelete && (
            <button onClick={onDelete} className="px-3 border border-rose-200 text-rose-600 rounded-xl text-sm">삭제</button>
          )}
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm">취소</button>
        </div>
      </div>
    </div>
  )
}

/**
 * 자동 편성 — 수급자에 이미 적혀 있는 인지·여가·신체 그룹(A/B/C)으로 조를 짠다.
 *
 * 어르신 예순여덟 분을 손으로 넣는 것은 일이 아니라 고역이다. 이미 있는
 * 정보를 다시 입력하게 하지 않는다.
 *
 * 다만 이 일은 지금 편성을 통째로 갈아엎는다. 그래서 먼저 미리보기로
 * 무엇이 만들어지고 몇 명이 옮겨지는지 보여주고, 그 다음에 저장한다.
 */
function AutoComposeModal({ busy, onClose, onDone }: {
  busy: boolean; onClose: () => void; onDone: () => void
}) {
  const [axis, setAxis] = useState<ComposeAxis>('physical')
  const [byFloor, setByFloor] = useState(true)
  const [plan, setPlan] = useState<ComposePlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const preview = useCallback(async (a: ComposeAxis, f: boolean) => {
    setLoading(true); setErr('')
    try { setPlan(await therapyAPI.autoCompose(a, f, true)) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '실패했습니다'); setPlan(null) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { preview(axis, byFloor) }, [axis, byFloor, preview])

  const apply = async () => {
    if (!plan) return
    if (!confirm(
      `${plan.group_count}개 조에 ${plan.assigned}명을 편성합니다.\n` +
      (plan.moving > 0 ? `\n※ 지금 다른 조에 있는 ${plan.moving}명이 옮겨집니다.\n` : '') +
      (plan.skipped.length > 0 ? `※ ${plan.axis_label} 그룹이 비어 있는 ${plan.skipped.length}명은 편성되지 않습니다.\n` : '') +
      `\n계속할까요?`)) return
    setLoading(true); setErr('')
    try { await therapyAPI.autoCompose(axis, byFloor, false); onDone() }
    catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '실패했습니다') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-bold text-gray-900">자동 편성</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            수급자 관리에 이미 적어 둔 그룹(A·B·C)으로 조를 짭니다. 다시 입력하실 필요 없습니다.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">무엇을 기준으로</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['physical', 'cognitive', 'leisure'] as ComposeAxis[]).map(a => (
              <button key={a} type="button" onClick={() => setAxis(a)}
                className={`py-2 rounded-xl text-xs font-bold border ${
                  axis === a ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>
                {AXIS_META[a]}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={() => setByFloor(v => !v)}
          className={`w-full py-2 rounded-xl text-xs font-bold border ${
            byFloor ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-200 text-gray-500'}`}>
          {byFloor ? '✓ 층까지 나눔 (2층 A조 · 3층 A조)' : '층 구분 없음 (A조 · B조 · C조)'}
        </button>

        {err && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{err}</p>}

        {loading && !plan ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div>
        ) : plan && (
          <>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              {plan.groups.map(g => (
                <div key={g.name} className="flex items-center gap-2 px-3 py-2">
                  <span className="text-sm font-bold text-gray-800 flex-1">{g.name}</span>
                  {g.exists && <span className="text-[10px] text-gray-400">이미 있음</span>}
                  <span className="text-xs text-gray-500">{g.count}명</span>
                </div>
              ))}
              {plan.groups.length === 0 && (
                <p className="text-xs text-gray-400 py-6 text-center">
                  {plan.axis_label} 그룹이 적힌 어르신이 없습니다. 수급자 관리에서 먼저 지정해주세요.
                </p>
              )}
            </div>

            {plan.moving > 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                지금 다른 조에 있는 <b>{plan.moving}명</b>이 옮겨집니다. 손으로 짜 두신 편성이 있으면 바뀝니다.
              </p>
            )}
            {plan.skipped.length > 0 && (
              <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <b>{plan.axis_label} 그룹이 비어 있는 {plan.skipped.length}명</b>은 편성되지 않습니다 —
                임의로 넣으면 엉뚱한 시간에 불립니다.
                <div className="mt-1 flex flex-wrap gap-1">
                  {plan.skipped.slice(0, 12).map(sk => (
                    <span key={sk.resident_id} className="bg-white border border-gray-200 rounded px-1.5 py-0.5">
                      {sk.name}
                    </span>
                  ))}
                  {plan.skipped.length > 12 && <span className="text-gray-400">외 {plan.skipped.length - 12}명</span>}
                </div>
              </div>
            )}
            <p className="text-[10.5px] text-gray-400">
              조의 성격(나오는 조 / 찾아가는 조)은 A·B·C 로 알 수 없어 모두 「나오는 조」로 만듭니다.
              누워 계신 분들의 조는 만든 뒤 바꿔주세요.
            </p>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={apply} disabled={busy || loading || !plan || plan.groups.length === 0}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
            {loading ? '처리 중…' : `${plan?.group_count ?? 0}개 조로 편성`}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm">취소</button>
        </div>
      </div>
    </div>
  )
}
