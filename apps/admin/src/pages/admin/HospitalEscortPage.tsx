import { useCallback, useEffect, useState } from 'react'
import {
  Ambulance, Plus, Copy, Check, Loader2, X, Clock, History,
  AlertTriangle, Send, MessageSquare, CarFront, UserRound, Trash2, Phone,
} from 'lucide-react'
import { escortAPI, type Escort, type EscortList, type EscortInput, type EscortLog, type GuardianOption } from '@/api/escortClient'
import ResidentPickerModal from '@/components/eval/ResidentPickerModal'
import { useLtcStore } from '@/store/ltc'

/**
 * 병원동행 요청 — 간호팀이 올리고, 복지팀이 업체에 전달한다.
 *
 * ■ 왜 화면에 두는가
 *
 *   말로 전하면 '휠체어 쓰신다고 했나' 를 나중에 아무도 확인할 수 없다.
 *   이동수단이 어르신 상태와 안 맞게 잡히면 그날 병원 앞에서 문제가 된다.
 *   누가 무엇을 언제 전했는지가 남아야 한다.
 *
 * ■ 화면이 하는 일
 *
 *   ① 간호팀이 여섯 가지를 적는다 (성함·보행·편마비·휠체어·주의사항·진료)
 *   ② 톡방에 붙여넣을 글을 만들어 준다 — 사람이 쓰면 어떤 날은 편마비가
 *      빠지고 어떤 날은 휠체어가 빠진다
 *   ③ 복지팀이 업체에 전달했다고 표시한다
 *   ④ 보호자·업체가 협의해 정한 이동수단을 받아 적는다
 *      (시설이 정하지 않는다 — 그래서 고르는 목록을 두지 않았다)
 *
 * ■ 단계마다 누가·언제가 남는다
 */

const STEPS: { key: Escort['status']; label: string; tone: string }[] = [
  { key: 'draft', label: '작성', tone: 'bg-gray-100 text-gray-600 border-gray-200' },
  { key: 'shared', label: '톡방 공유', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  { key: 'sent', label: '업체 전달', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
  { key: 'decided', label: '이동수단 확정', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
]
const STEP_INDEX: Record<string, number> = { draft: 0, shared: 1, sent: 2, decided: 3, done: 4, canceled: -1 }

const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const fmtDate = (iso?: string | null) => {
  if (!iso || iso.length !== 10) return ''
  const w = DOW[new Date(`${iso}T00:00:00+09:00`).getDay()]
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일(${w})`
}
const dday = (iso: string) =>
  Math.round((new Date(`${iso}T00:00:00+09:00`).getTime() - new Date(`${todayISO()}T00:00:00+09:00`).getTime()) / 86400000)
const fmtStamp = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', hour12: false, month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(d).reduce<Record<string, string>>((a, x) => (a[x.type] = x.value, a), {})
  return `${Number(p.month)}/${Number(p.day)} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}

const EMPTY: EscortInput = {
  resident_id: null, resident_name: '', floor: null, room: null,
  walking: null, hemiplegia: null, wheelchair: null, notes: '',
  hospital: '', department: '', visit_date: todayISO(), visit_time: '',
  guardian_name: '', guardian_relation: '', guardian_phone: '',
}

export default function HospitalEscortPage() {
  const [scope, setScope] = useState<'open' | 'done'>('open')
  const [data, setData] = useState<EscortList | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Escort | null>(null)
  const [logFor, setLogFor] = useState<Escort | null>(null)
  const { loadAll } = useLtcStore()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await escortAPI.list(scope)) } catch { setData(null) }
    finally { setLoading(false) }
  }, [scope])
  useEffect(() => { load() }, [load])
  useEffect(() => { loadAll() }, [loadAll])

  const items = data?.items ?? []
  const soon = items.filter(e => e.status !== 'done' && e.status !== 'canceled' && dday(e.visit_date) <= 3).length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Ambulance size={20} className="text-rose-500" /> 병원동행 요청
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            간호팀이 어르신 상태를 적어 톡방에 공유 → 복지팀이 업체에 전달 → 보호자·업체가 이동수단 협의
          </p>
        </div>
        {data?.can_nursing && (
          <button onClick={() => { setEditing(null); setFormOpen(true) }}
            className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 flex items-center gap-1.5">
            <Plus size={15} /> 동행 요청
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {([['open', '진행 중'], ['done', '지난 동행']] as const).map(([k, t]) => (
          <button key={k} onClick={() => setScope(k)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              scope === k ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{t}</button>
        ))}
        {soon > 0 && scope === 'open' && (
          <span className="ml-auto mb-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full">
            3일 안에 진료 {soon}건
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : !data ? (
        <p className="text-center py-16 text-sm text-gray-400">불러오지 못했습니다.</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">{scope === 'open' ? '진행 중인 병원동행 요청이 없습니다.' : '지난 동행 기록이 없습니다.'}</p>
          {scope === 'open' && data.can_nursing && (
            <p className="text-xs text-gray-300 mt-1">병원동행이 필요하면 「동행 요청」으로 올려 주세요.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(e => (
            <EscortCard key={e.id} e={e} onChanged={load}
              onEdit={() => { setEditing(e); setFormOpen(true) }}
              onLogs={() => setLogFor(e)} />
          ))}
        </div>
      )}

      {formOpen && (
        <EscortForm existing={editing} options={data?.options}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          onSaved={() => { setFormOpen(false); setEditing(null); load() }} />
      )}
      {logFor && <LogModal e={logFor} onClose={() => setLogFor(null)} />}
    </div>
  )
}

/* ══════════ 요청 한 건 ══════════ */
function EscortCard({ e, onChanged, onEdit, onLogs }: {
  e: Escort; onChanged: () => void; onEdit: () => void; onLogs: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [decideOpen, setDecideOpen] = useState(false)

  const step = STEP_INDEX[e.status] ?? 0
  const d = dday(e.visit_date)
  const past = e.status === 'done' || e.status === 'canceled'

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key); setTimeout(() => setCopied(null), 2000)
    } catch { alert('복사가 막혀 있습니다. 글을 직접 선택해 복사해 주세요.') }
  }

  const act = async (fn: () => Promise<any>, key: string) => {
    setBusy(key)
    try { await fn(); onChanged() }
    catch (err: any) { alert(err?.response?.data?.detail ?? '처리하지 못했습니다.') }
    finally { setBusy(null) }
  }

  return (
    <section className={`rounded-2xl border bg-white overflow-hidden ${
      e.status === 'canceled' ? 'border-gray-200 opacity-60'
        : d <= 1 && !past ? 'border-rose-300' : 'border-gray-200'}`}>
      {/* 머리 — 누가, 언제, 어디 */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <UserRound size={15} className="text-gray-400" />
        <span className="text-base font-bold text-gray-900">{e.resident_name}</span>
        {(e.floor || e.room) && (
          <span className="text-[11px] font-bold text-gray-400">
            {e.floor}{e.room ? ` ${e.room}호` : ''}
          </span>
        )}
        <span className="text-sm text-gray-600 ml-1">
          {e.hospital}{e.department ? ` ${e.department}` : ''}
        </span>
        <span className="text-sm font-bold text-gray-800">
          {fmtDate(e.visit_date)}{e.visit_time ? ` ${e.visit_time}` : ''}
        </span>
        {!past && (
          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
            d < 0 ? 'bg-gray-200 text-gray-600' : d === 0 ? 'bg-rose-500 text-white'
              : d <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
            {d < 0 ? `${-d}일 지남` : d === 0 ? '오늘' : `D-${d}`}
          </span>
        )}
        {e.status === 'canceled' && (
          <span className="text-[10px] font-bold text-white bg-gray-400 px-1.5 py-0.5 rounded">취소</span>
        )}
        {e.status === 'done' && (
          <span className="text-[10px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded">완료</span>
        )}
        <button onClick={onLogs} title="누가 무엇을 언제 했는지"
          className="ml-auto text-gray-300 hover:text-gray-600"><History size={15} /></button>
      </div>

      {/* 진행 단계 */}
      {e.status !== 'canceled' && (
        <div className="px-4 py-2 bg-gray-50/70 border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
          {STEPS.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                i <= step ? s.tone : 'bg-white text-gray-300 border-gray-200'}`}>
                {i < step && <Check size={9} className="inline mr-0.5" />}{s.label}
              </span>
              {i < STEPS.length - 1 && <span className="text-gray-200">›</span>}
            </span>
          ))}
        </div>
      )}

      <div className="px-4 py-3 space-y-3">
        {/* 어르신 상태 — 이동수단을 정하는 근거 */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Chip label="보행" v={e.walking} tone={e.walking === '불가' ? 'rose' : e.walking === '부축 필요' ? 'amber' : 'gray'} />
          <Chip label="편마비" v={e.hemiplegia} tone={e.hemiplegia === '있음' ? 'amber' : 'gray'} />
          <Chip label="휠체어" v={e.wheelchair} tone={e.wheelchair === '사용' ? 'sky' : 'gray'} />
          {e.guardian_phone
            ? <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                <Phone size={9} className="inline mr-0.5" />
                보호자 {e.guardian_name}{e.guardian_relation ? `(${e.guardian_relation})` : ''} {e.guardian_phone}
              </span>
            : <span className="px-2 py-0.5 rounded-full bg-white text-rose-500 border border-red-300 border-dashed">보호자 연락처 확인 필요</span>}
          {e.vendor && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">업체 {e.vendor}</span>}
          {e.transport && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
              <CarFront size={10} className="inline mr-0.5" />{e.transport}
            </span>
          )}
        </div>
        {e.notes && <p className="text-[12px] text-gray-600 leading-relaxed">· {e.notes}</p>}
        {e.transport_note && <p className="text-[11px] text-emerald-700">협의: {e.transport_note}</p>}
        {e.cancel_reason && <p className="text-[11px] text-gray-500">취소 사유: {e.cancel_reason}</p>}

        {e.missing.length > 0 && !past && (
          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5">
            <AlertTriangle size={12} /> 간호팀 확인이 필요합니다 — {e.missing.join(' · ')}
          </p>
        )}

        {/* 단계별 기록 */}
        <div className="text-[11px] text-gray-400 space-y-0.5">
          {e.created_by && <p>작성 {e.created_by} · {fmtStamp(e.created_at)}</p>}
          {e.shared_at && <p>톡방 공유 {e.shared_by} · {fmtStamp(e.shared_at)}</p>}
          {e.sent_at && <p>업체 전달 {e.sent_by} · {fmtStamp(e.sent_at)}{e.vendor ? ` (${e.vendor})` : ''}</p>}
          {e.decided_at && <p>이동수단 확정 {e.decided_by} · {fmtStamp(e.decided_at)}</p>}
          {e.done_at && <p>완료 {e.done_by} · {fmtStamp(e.done_at)}</p>}
        </div>
      </div>

      {/* 할 일 */}
      {!past && (
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2">
          <button onClick={() => copy(e.request_text, 'req')}
            className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold flex items-center gap-1.5">
            {copied === 'req' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'req' ? '복사됨 — 톡방에 붙여넣으세요' : '톡방에 올릴 내용 복사'}
          </button>
          {e.can_nursing && !e.shared_at && (
            <button onClick={() => act(() => escortAPI.share(e.id), 'share')} disabled={busy === 'share'}
              className="px-3 py-2 rounded-xl border border-amber-300 text-amber-700 text-xs font-bold hover:bg-amber-50 flex items-center gap-1.5">
              <MessageSquare size={13} /> 톡방에 올렸습니다
            </button>
          )}
          {e.can_welfare && (
            <button onClick={() => copy(e.vendor_text, 'vendor')}
              className="px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-gray-700 text-xs font-bold hover:bg-gray-100 flex items-center gap-1.5">
              {copied === 'vendor' ? <Check size={13} /> : <Copy size={13} />} 업체에 보낼 내용 복사
            </button>
          )}
          {e.can_welfare && !e.sent_at && (
            <button onClick={() => setSendOpen(true)}
              className="px-3 py-2 rounded-xl border border-sky-300 text-sky-700 text-xs font-bold hover:bg-sky-50 flex items-center gap-1.5">
              <Send size={13} /> 업체에 전달했습니다
            </button>
          )}
          {e.can_welfare && (
            <button onClick={() => setDecideOpen(true)}
              className="px-3 py-2 rounded-xl border border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 flex items-center gap-1.5">
              <CarFront size={13} /> {e.transport ? '이동수단 고치기' : '이동수단 확정'}
            </button>
          )}
          {e.decision_text && (
            <button onClick={() => copy(e.decision_text!, 'dec')}
              className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 flex items-center gap-1.5">
              {copied === 'dec' ? <Check size={13} /> : <Copy size={13} />} 확정 내용 복사
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {e.can_nursing && (
              <button onClick={onEdit} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-50">
                수정
              </button>
            )}
            <button onClick={() => act(() => escortAPI.done(e.id), 'done')} disabled={busy === 'done'}
              className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-50">
              동행 완료
            </button>
            <button onClick={() => {
              const r = prompt('취소 사유를 적어 주세요. (진료 연기 · 보호자 동행 등)')
              if (r?.trim()) act(() => escortAPI.cancel(e.id, r.trim()), 'cancel')
            }} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-400 text-xs hover:bg-gray-50">
              취소
            </button>
            {e.can_nursing && (e.status === 'draft' || e.status === 'shared') && (
              <button onClick={() => {
                if (confirm('이 요청을 지울까요? (잘못 올린 줄을 지우는 것입니다)')) act(() => escortAPI.remove(e.id), 'del')
              }} title="잘못 올린 줄 지우기"
                className="px-2 py-2 rounded-xl text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
            )}
          </div>
        </div>
      )}

      {sendOpen && (
        <StepModal title="업체에 전달했습니다" icon={<Send size={15} className="text-sky-600" />}
          fields={[{ key: 'vendor', label: '병원동행업체', value: e.vendor ?? '', ph: '예) 행복동행케어' },
                   { key: 'memo', label: '전달 방법·메모', value: '', ph: '예) 전화로 상태 전달, 보호자 연락처 안내' }]}
          hint="이동수단은 여기서 정하지 않습니다. 어르신 상태를 정확히 전달하고, 보호자와 업체가 협의하도록 안내해 주세요."
          onClose={() => setSendOpen(false)}
          onSubmit={async v => { await escortAPI.send(e.id, { vendor: v.vendor, memo: v.memo }); setSendOpen(false); onChanged() }} />
      )}
      {decideOpen && (
        <StepModal title="이동수단 확정" icon={<CarFront size={15} className="text-emerald-600" />}
          fields={[{ key: 'transport', label: '정해진 이동수단', value: e.transport ?? '', ph: '예) 휠체어 리프트 차량 · 보호자 차량 · 사설 구급차', required: true },
                   { key: 'transport_note', label: '협의 내용', value: e.transport_note ?? '', ph: '예) 보호자(딸)와 업체 통화로 확정' }]}
          hint="시설이 정하는 것이 아니라, 보호자와 동행업체가 협의해 정한 결과를 적습니다."
          onClose={() => setDecideOpen(false)}
          onSubmit={async v => {
            await escortAPI.decide(e.id, { transport: v.transport, transport_note: v.transport_note })
            setDecideOpen(false); onChanged()
          }} />
      )}
    </section>
  )
}

function Chip({ label, v, tone }: { label: string; v?: string | null; tone: string }) {
  const cls: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    sky: 'bg-sky-100 text-sky-800 border-sky-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full border ${v ? cls[tone] : 'bg-white text-rose-500 border-red-300 border-dashed'}`}>
      {label} {v || '확인 필요'}
    </span>
  )
}

/* ══════════ 간호팀 작성 ══════════ */
function EscortForm({ existing, options, onClose, onSaved }: {
  existing: Escort | null
  options?: { walking: string[]; hemiplegia: string[]; wheelchair: string[] }
  onClose: () => void; onSaved: () => void
}) {
  const [f, setF] = useState<EscortInput>(existing ? {
    resident_id: existing.resident_id, resident_name: existing.resident_name,
    floor: existing.floor, room: existing.room,
    walking: existing.walking, hemiplegia: existing.hemiplegia, wheelchair: existing.wheelchair,
    notes: existing.notes ?? '', hospital: existing.hospital, department: existing.department ?? '',
    visit_date: existing.visit_date, visit_time: existing.visit_time ?? '',
  } : { ...EMPTY })
  const [pick, setPick] = useState(false)
  const [busy, setBusy] = useState(false)
  // 등록된 보호자를 골라 넣는다 — 손으로 옮겨 적으면 번호가 한 자리씩 틀리고,
  // 그러면 업체가 협의를 못 한다
  const [guards, setGuards] = useState<GuardianOption[]>([])
  useEffect(() => {
    if (!f.resident_id) { setGuards([]); return }
    escortAPI.guardians(f.resident_id).then(setGuards).catch(() => setGuards([]))
  }, [f.resident_id])
  const opt = options ?? { walking: ['가능', '부축 필요', '불가'], hemiplegia: ['없음', '있음'], wheelchair: ['미사용', '사용'] }

  const save = async () => {
    if (!f.resident_name.trim()) return alert('어르신을 골라 주세요.')
    if (!f.hospital.trim()) return alert('병원명을 적어 주세요.')
    setBusy(true)
    try {
      existing ? await escortAPI.edit(existing.id, f) : await escortAPI.create(f)
      onSaved()
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }

  const radio = (label: string, key: keyof EscortInput, list: string[], no: number) => (
    <div>
      <p className="text-xs font-bold text-gray-500 mb-1.5">{no}. {label}</p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0,1fr))` }}>
        {list.map(v => (
          <button key={v} type="button" onClick={() => setF(s => ({ ...s, [key]: s[key] === v ? null : v }))}
            className={`px-2 py-2.5 rounded-xl text-sm font-bold border ${
              f[key] === v ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  )
  const inp = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-rose-400'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 sticky top-0 bg-white z-10">
          <Ambulance size={16} className="text-rose-500" />
          <p className="text-base font-bold text-gray-900">{existing ? '동행 요청 수정' : '병원동행 요청'}</p>
          <span className="text-[11px] text-gray-400">간호팀 작성</span>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1.5">1. 어르신 성함</p>
            <button type="button" onClick={() => setPick(true)}
              className={`w-full px-3 py-2.5 rounded-xl border text-left text-sm font-bold ${
                f.resident_name ? 'border-gray-200 text-gray-800' : 'border-dashed border-gray-300 text-gray-400'}`}>
              {f.resident_name
                ? `${f.resident_name}${f.floor || f.room ? ` · ${f.floor ?? ''}${f.room ? ` ${f.room}호` : ''}` : ''}`
                : '어르신 선택'}
            </button>
          </div>

          {radio('보행 가능 여부', 'walking', opt.walking, 2)}
          {radio('편마비 여부', 'hemiplegia', opt.hemiplegia, 3)}
          {radio('휠체어 사용 여부', 'wheelchair', opt.wheelchair, 4)}

          <div>
            <p className="text-xs font-bold text-gray-500 mb-1.5">5. 특이사항 및 이동 시 주의사항</p>
            <textarea value={f.notes ?? ''} onChange={e => setF(s => ({ ...s, notes: e.target.value }))} rows={3}
              placeholder="예) 오른쪽 편마비로 왼쪽에서 부축 · 승하차에 시간이 걸립니다 · 산소 사용"
              className={`${inp} resize-none`} />
          </div>

          {/* 보호자 — 업체가 이동수단을 협의할 상대다. 톡방 글에는 안 들어가고
              업체에 보내는 글에만 들어간다. */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1.5">
              보호자 <span className="font-normal text-gray-400">— 업체가 이동수단을 협의할 분</span>
            </p>
            {guards.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {guards.map((g, i) => {
                  const on = f.guardian_phone === g.phone
                  return (
                    <button key={i} type="button"
                      onClick={() => setF(s2 => ({ ...s2, guardian_name: g.name,
                        guardian_relation: g.relation ?? '', guardian_phone: g.phone }))}
                      className={`px-2.5 py-1.5 rounded-xl text-[12px] font-bold border ${
                        on ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                      {g.name}{g.relation ? `(${g.relation})` : ''} {g.phone}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <input value={f.guardian_name ?? ''} onChange={e => setF(s2 => ({ ...s2, guardian_name: e.target.value }))}
                placeholder="성함" className={inp} />
              <input value={f.guardian_relation ?? ''} onChange={e => setF(s2 => ({ ...s2, guardian_relation: e.target.value }))}
                placeholder="관계 (예: 딸)" className={inp} />
              <input value={f.guardian_phone ?? ''} onChange={e => setF(s2 => ({ ...s2, guardian_phone: e.target.value }))}
                placeholder="전화번호" className={inp} inputMode="tel" />
            </div>
            {guards.length === 0 && f.resident_id && (
              <p className="text-[11px] text-gray-400 mt-1">등록된 보호자가 없어 직접 적으셔야 합니다.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 mb-1.5">6. 진료 병원 및 일정</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={f.hospital} onChange={e => setF(s => ({ ...s, hospital: e.target.value }))}
                placeholder="병원명" className={inp} />
              <input value={f.department ?? ''} onChange={e => setF(s => ({ ...s, department: e.target.value }))}
                placeholder="진료과 (선택)" className={inp} />
              <input type="date" value={f.visit_date} onChange={e => setF(s => ({ ...s, visit_date: e.target.value }))} className={inp} />
              <input type="time" value={f.visit_time ?? ''} onChange={e => setF(s => ({ ...s, visit_time: e.target.value }))} className={inp} />
            </div>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            적어 주신 내용은 부서 톡방에 붙여넣을 글로 만들어 드립니다 ·
            보호자 연락처는 <b className="text-gray-500">업체에 보낼 글에만</b> 들어갑니다(톡방 글에는 안 들어갑니다) ·
            이동수단은 시설에서 정하지 않고, 보호자와 동행업체가 협의합니다
          </p>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
          <button onClick={save} disabled={busy}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl disabled:opacity-40 flex items-center justify-center gap-1.5">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {existing ? '고치기' : '요청 올리기'}
          </button>
        </div>
      </div>

      {pick && (
        <ResidentPickerModal onClose={() => setPick(false)}
          onPick={r => r && setF(s => ({ ...s, resident_id: r.id, resident_name: r.name, floor: r.floor ?? null, room: r.room ?? null }))} />
      )}
    </div>
  )
}

/* ══════════ 단계 기록 (업체 전달 · 이동수단) ══════════ */
function StepModal({ title, icon, fields, hint, onClose, onSubmit }: {
  title: string
  icon: React.ReactNode
  fields: { key: string; label: string; value: string; ph?: string; required?: boolean }[]
  hint: string
  onClose: () => void
  onSubmit: (v: Record<string, string>) => Promise<void>
}) {
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, f.value])))
  const [busy, setBusy] = useState(false)
  const go = async () => {
    const miss = fields.find(f => f.required && !(v[f.key] ?? '').trim())
    if (miss) return alert(`${miss.label}을(를) 적어 주세요.`)
    setBusy(true)
    try { await onSubmit(v) }
    catch (e: any) { alert(e?.response?.data?.detail ?? '저장하지 못했습니다.'); setBusy(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          {icon}<p className="text-sm font-bold text-gray-900">{title}</p>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <p className="text-xs font-bold text-gray-500 mb-1">
                {f.label}{f.required && <span className="text-rose-500"> *</span>}
              </p>
              <input value={v[f.key] ?? ''} onChange={e => setV(s => ({ ...s, [f.key]: e.target.value }))}
                placeholder={f.ph}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-rose-400" />
            </div>
          ))}
          <p className="text-[11px] text-gray-400 leading-relaxed bg-gray-50 rounded-lg px-2.5 py-2">{hint}</p>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
          <button onClick={go} disabled={busy}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-gray-900 rounded-xl disabled:opacity-40 flex items-center justify-center gap-1.5">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} 기록하기
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════ 누가 무엇을 언제 ══════════ */
function LogModal({ e, onClose }: { e: Escort; onClose: () => void }) {
  const [rows, setRows] = useState<EscortLog[] | null>(null)
  useEffect(() => { escortAPI.logs(e.id).then(setRows).catch(() => setRows([])) }, [e.id])
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col" onClick={ev => ev.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <History size={15} className="text-gray-500" />
          <p className="text-sm font-bold text-gray-900">{e.resident_name} 어르신 · 진행 기록</p>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows === null ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">기록이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {rows.map(r => (
                <li key={r.id} className="px-5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} className="text-gray-300" />
                    <span className="text-[13px] font-bold text-gray-800">{r.label}</span>
                    <span className="ml-auto text-[11px] text-gray-400">{r.actor}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">{fmtStamp(r.created_at)}</p>
                  {r.memo && <p className="text-[11px] text-gray-500 mt-0.5">{r.memo}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <p className="text-[11px] text-gray-400">병원동행은 구두로만 전하지 않습니다 — 확인·전달한 내용이 여기 남습니다.</p>
        </div>
      </div>
    </div>
  )
}
