import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Radio, Plus, Play, Square, Loader2, Trash2, Pencil, X, Volume2, Wifi, WifiOff,
  CalendarClock, History, AlertTriangle, CheckCircle2, Upload, Sparkles,
} from 'lucide-react'
import {
  broadcastAPI, type BroadcastSchedule, type Dashboard, type BroadcastMeta,
  type BroadcastType, type RepeatRule, type MediaResult, type BroadcastLog,
} from '@/api/broadcastClient'

/* ── helpers ── */
const pad2 = (n: number) => String(n).padStart(2, '0')
const WEEK = ['월', '화', '수', '목', '금', '토', '일']   // 0=월 … 6=일 (서버와 동일)
const hm = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const md = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const mdhm = (iso?: string | null) => (iso ? `${md(iso)} ${hm(iso)}` : '')
/** datetime-local 입력용 — 로컬(KST) 기준 문자열 */
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`

const TYPE_LABEL: Record<BroadcastType, string> = { TTS: '음성 안내(TTS)', AUDIO: '음원(MP3·WAV)', VIDEO: '영상(MP4 소리만)' }

const STATUS_CHIP: Record<string, string> = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  SKIPPED: 'bg-gray-50 text-gray-500 border-gray-200',
  PLAYING: 'bg-blue-50 text-blue-700 border-blue-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
}
const STATUS_KO: Record<string, string> = {
  SUCCESS: '성공', FAILED: '실패', SKIPPED: '건너뜀', PLAYING: '재생 중', PENDING: '대기',
}

export default function BroadcastPage() {
  const [meta, setMeta] = useState<BroadcastMeta | null>(null)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [list, setList] = useState<BroadcastSchedule[]>([])
  const [logs, setLogs] = useState<BroadcastLog[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'dashboard' | 'schedules' | 'logs'>('dashboard')
  const [editing, setEditing] = useState<BroadcastSchedule | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [m, d, s] = await Promise.all([
        broadcastAPI.meta(), broadcastAPI.dashboard(), broadcastAPI.schedules(),
      ])
      setMeta(m); setDash(d); setList(s)
    } catch (e: any) {
      console.error('[broadcast] load failed', e)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // 방송은 '지금' 상태가 중요하다 — 대시보드에 머무는 동안만 짧게 갱신한다
  useEffect(() => {
    if (tab !== 'dashboard') return
    const t = setInterval(() => { broadcastAPI.dashboard().then(setDash).catch(() => {}) }, 15000)
    return () => clearInterval(t)
  }, [tab])

  useEffect(() => {
    if (tab === 'logs') broadcastAPI.logs({ limit: 200 }).then(setLogs).catch(() => setLogs([]))
  }, [tab])

  const playNow = async (s: BroadcastSchedule) => {
    if (!confirm(`「${s.title}」을(를) 지금 바로 방송할까요?\n건물 전체 스피커로 나갑니다.`)) return
    setBusy(s.id)
    try { await broadcastAPI.playNow(s.id); await load(); alert('방송 요청을 보냈습니다.') }
    catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '요청 실패') }
    finally { setBusy(null) }
  }

  const stopAll = async () => {
    if (!confirm('지금 나가는 방송을 즉시 중지할까요?\n\n※ 소방·비상방송 설비와는 무관하며, 안내방송만 멈춥니다.')) return
    setBusy('stop')
    try { await broadcastAPI.stopAll('관리자 즉시 중지'); await load(); alert('중지 명령을 보냈습니다.') }
    catch (e: any) { alert(e?.message ?? '중지 실패') }
    finally { setBusy(null) }
  }

  const toggle = async (s: BroadcastSchedule) => {
    setBusy(s.id)
    try { await broadcastAPI.update(s.id, { enabled: !s.enabled }); await load() }
    catch (e: any) { alert(e?.message ?? '변경 실패') }
    finally { setBusy(null) }
  }

  const remove = async (s: BroadcastSchedule) => {
    if (!confirm(`「${s.title}」 예약을 삭제할까요?\n지난 방송 이력은 남습니다.`)) return
    setBusy(s.id)
    try { await broadcastAPI.remove(s.id); await load() }
    catch (e: any) { alert(e?.message ?? '삭제 실패') }
    finally { setBusy(null) }
  }

  const offline = (dash?.devices ?? []).filter(d => !d.online)

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Radio className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">방송 관리</h1>
            <p className="text-xs text-gray-400">
              안내방송 예약·송출 · 소방/비상방송 설비와는 별개입니다
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={stopAll} disabled={busy === 'stop'}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 disabled:opacity-50">
            {busy === 'stop' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />} 즉시 중지
          </button>
          <button onClick={() => setEditing(null)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
            <Plus className="w-4 h-4" /> 방송 만들기
          </button>
        </div>
      </div>

      {/* 서버에 등록코드가 없으면 방송 PC 를 아예 붙일 수 없다.
          설치하러 현장에 가서야 503 을 보는 일이 없도록 여기서 먼저 알린다. */}
      {meta && !meta.enroll_ready && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <b>방송 PC 등록이 막혀 있습니다.</b> 서버에 등록코드(<code>BROADCAST_ENROLL_CODE</code>)가 없습니다.
          <span className="block text-xs mt-1 text-rose-600 leading-relaxed">
            <code>backend/.env</code> 에 값을 넣은 뒤 <b>이미지를 다시 빌드</b>해야 반영됩니다 —
            재시작만으로는 적용되지 않습니다.<br />
            <code className="text-[11px]">docker compose build backend &amp;&amp; docker compose up -d --force-recreate backend</code>
          </span>
        </div>
      )}
      {meta && meta.enroll_ready && !meta.tts_ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>음성 안내(TTS)를 만들 수 없습니다.</b> 서버에 TTS 설정이 없습니다.
          <span className="block text-xs mt-0.5 text-amber-700">
            MP3·MP4 업로드 방송은 정상 동작합니다. TTS 를 쓰시려면 <code>OPENAI_API_KEY</code> 를 설정하세요.
          </span>
        </div>
      )}

      {/* 방송 PC 가 꺼져 있으면 예약이 있어도 소리가 안 난다 — 가장 먼저 알린다 */}
      {dash && dash.devices.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>방송 PC가 등록되어 있지 않습니다.</b> 예약을 만들어도 소리가 나지 않습니다.
          <span className="block text-xs mt-0.5 text-amber-700">
            요양원 방송 PC에서 Agent를 설치하고 등록하세요. (apps/broadcast-agent/README.md)
          </span>
        </div>
      )}
      {offline.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
          <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <b>방송 PC {offline.length}대가 오프라인입니다.</b> — {offline.map(d => d.name).join(', ')}
            <span className="block text-xs mt-0.5 text-rose-600">
              PC 전원·네트워크를 확인하세요. 이 상태에서는 새 예약이 전달되지 않습니다.
            </span>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1.5">
        {([['dashboard', '현황'], ['schedules', `예약 (${list.length})`], ['logs', '방송 이력']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
              tab === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && dash && <DashboardView dash={dash} />}

      {tab === 'schedules' && (
        <div className="space-y-2">
          {list.length === 0 ? (
            <Empty onCreate={() => setEditing(null)} />
          ) : list.map(s => (
            <div key={s.id} className={`bg-white rounded-xl border p-4 ${s.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{s.title}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                      {TYPE_LABEL[s.type]}
                    </span>
                    {!s.enabled && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">비활성</span>}
                    {s.status !== 'READY' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                        {s.status === 'DRAFT' ? '음원 없음' : '오류'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />
                      {hm(s.scheduled_at)} · {s.repeat_label}</span>
                    <span className="inline-flex items-center gap-1"><Volume2 className="w-3 h-3" />{s.volume}%</span>
                    <span className="text-gray-400">전체 방송</span>
                  </p>
                  {s.text && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.text}</p>}
                  {s.next_at && s.enabled && (
                    <p className="text-xs text-indigo-600 font-semibold mt-1">다음: {mdhm(s.next_at)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {s.media_url && (
                    <audio controls preload="none" src={s.media_url} className="h-8 max-w-[190px]" title="미리듣기 — 관리자 PC에서만 들립니다" />
                  )}
                  <button onClick={() => playNow(s)} disabled={busy === s.id || s.status !== 'READY'}
                    title="지금 바로 방송" className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-30">
                    {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => toggle(s)} disabled={busy === s.id}
                    title={s.enabled ? '비활성화' : '활성화'}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                      s.enabled ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-gray-400 border-gray-200'}`}>
                    {s.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => setEditing(s)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(s)} className="p-2 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">아직 기록이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {logs.map(l => (
                <li key={l.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="text-xs text-gray-400 w-24 shrink-0">{mdhm(l.created_at)}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-200 shrink-0">
                    {l.event}
                  </span>
                  {l.status && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CHIP[l.status] ?? STATUS_CHIP.SKIPPED}`}>
                      {STATUS_KO[l.status] ?? l.status}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 truncate text-gray-700">{l.title ?? '—'}</span>
                  {l.device_id && <span className="text-xs text-gray-400 shrink-0">{l.device_id}</span>}
                  {l.actor && <span className="text-xs text-gray-400 shrink-0">{l.actor}</span>}
                  {l.error_message && <span className="text-xs text-rose-500 truncate max-w-[200px]">{l.error_message}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing !== undefined && meta && (
        <ScheduleModal editing={editing} meta={meta}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load() }} />
      )}
    </div>
  )
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
      <Radio className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-500 mb-1">등록된 방송이 없습니다.</p>
      <p className="text-xs text-gray-400 mb-5">식사 안내·프로그램 안내처럼 매일 반복되는 방송을 등록해보세요.</p>
      <button onClick={onCreate} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">방송 만들기</button>
    </div>
  )
}

/* ── 현황 ── */
function DashboardView({ dash }: { dash: Dashboard }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 지금 상태 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">현재 방송</p>
          {dash.playing.length > 0 ? (
            <p className="text-lg font-bold text-blue-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> 송출 중
            </p>
          ) : (
            <p className="text-lg font-bold text-gray-400">대기 중</p>
          )}
        </div>
        {/* 다음 예약 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">다음 예약</p>
          {dash.next ? (
            <>
              <p className="text-lg font-bold text-gray-900">{mdhm(dash.next.at)}</p>
              <p className="text-xs text-gray-500 truncate">{dash.next.title}</p>
            </>
          ) : <p className="text-lg font-bold text-gray-400">없음</p>}
        </div>
        {/* 방송 PC */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">방송 PC</p>
          <p className={`text-lg font-bold ${dash.online_count > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {dash.online_count} / {dash.devices.length} 온라인
          </p>
        </div>
      </div>

      {/* 오늘 일정 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-600">
          오늘 방송 일정
        </div>
        {dash.today.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">오늘 예정된 방송이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {dash.today.map((t, i) => (
              <li key={`${t.schedule_id}-${i}`} className={`px-4 py-2.5 flex items-center gap-3 ${t.past ? 'opacity-60' : ''}`}>
                <span className="font-bold text-gray-900 w-14 shrink-0">{hm(t.at)}</span>
                <span className="flex-1 min-w-0 truncate text-sm text-gray-700">{t.title}</span>
                {t.run_status ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_CHIP[t.run_status] ?? STATUS_CHIP.PENDING}`}>
                    {STATUS_KO[t.run_status] ?? t.run_status}
                  </span>
                ) : t.past ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-gray-50 text-gray-400 border-gray-200">기록 없음</span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-600 border-indigo-200">예정</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 방송 PC 상세 */}
      {dash.devices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-600">방송 PC</div>
          <ul className="divide-y divide-gray-50">
            {dash.devices.map(d => (
              <li key={d.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                {d.online ? <Wifi className="w-4 h-4 text-emerald-500 shrink-0" /> : <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />}
                <span className="font-semibold text-gray-800">{d.name}</span>
                <span className="text-xs text-gray-400">{d.device_id}</span>
                {d.now_playing && <span className="text-xs text-blue-600 font-semibold">▶ {d.now_playing}</span>}
                {/* 서버는 이 IP로 접속하지 않는다(통신은 항상 PC→서버).
                    사람이 그 PC를 찾아가거나 원격 접속할 때 쓰라고 보여준다. */}
                {d.local_ip && (
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200"
                    title={`원내 IP${d.hostname ? ` · ${d.hostname}` : ''}${d.last_ip ? ` · 접속 IP ${d.last_ip}` : ''}`}>
                    {d.local_ip}
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-400">
                  {d.hostname ? `${d.hostname} · ` : ''}
                  {d.output_name ? `${d.output_name} · ` : ''}{d.version ?? ''}
                  {d.last_seen ? ` · ${mdhm(d.last_seen)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 최근 기록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-600 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> 최근 방송 기록
        </div>
        {dash.recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">아직 기록이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {dash.recent.slice(0, 8).map(l => (
              <li key={l.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="text-xs text-gray-400 w-20 shrink-0">{mdhm(l.created_at)}</span>
                {l.status === 'SUCCESS' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                <span className="flex-1 min-w-0 truncate text-gray-700">{l.title ?? '—'}</span>
                {l.error_message && <span className="text-xs text-rose-500 truncate max-w-[220px]">{l.error_message}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ── 만들기 · 수정 ── */
function ScheduleModal({ editing, meta, onClose, onSaved }: {
  editing: BroadcastSchedule | null; meta: BroadcastMeta; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!editing
  const [type, setType] = useState<BroadcastType>(editing?.type ?? 'TTS')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [text, setText] = useState(editing?.text ?? '')
  const [media, setMedia] = useState<MediaResult | null>(
    editing?.media_id ? { id: editing.media_id, url: editing.media_url ?? '' } : null)
  const [when, setWhen] = useState(() =>
    toLocalInput(editing ? new Date(editing.scheduled_at) : new Date(Date.now() + 10 * 60000)))
  const [immediate, setImmediate] = useState(false)
  const [freq, setFreq] = useState<RepeatRule['freq']>(editing?.repeat_rule?.freq ?? 'once')
  const [days, setDays] = useState<number[]>(editing?.repeat_rule?.days ?? [])
  const [volume, setVolume] = useState(editing?.volume ?? 70)
  const [enabled, setEnabled] = useState(editing?.enabled ?? true)
  const [voice, setVoice] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [making, setMaking] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const ttsProvider = meta.tts_providers.find(p => p.current)
  const ttsReady = !!ttsProvider?.ready

  const makeTts = async () => {
    if (!text.trim()) { setErr('읽을 문구를 입력해주세요.'); return }
    setMaking(true); setErr('')
    try { setMedia(await broadcastAPI.tts({ text, voice: voice || undefined })) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '음성 생성 실패') }
    finally { setMaking(false) }
  }

  const pickFile = async (f?: File | null) => {
    if (!f) return
    setMaking(true); setErr('')
    try {
      const r = await broadcastAPI.upload(f)
      setMedia(r)
      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '업로드 실패') }
    finally { setMaking(false) }
  }

  const save = async () => {
    if (!title.trim()) { setErr('제목을 입력해주세요.'); return }
    if (!media) { setErr(type === 'TTS' ? '먼저 음성을 만들어주세요.' : '파일을 올려주세요.'); return }
    setSaving(true); setErr('')
    try {
      const body = {
        title: title.trim(), type,
        text: type === 'TTS' ? text.trim() : null,
        media_id: media.id,
        scheduled_at: immediate ? null : when,
        repeat_rule: { freq, ...(freq === 'weekly' ? { days } : {}) } as RepeatRule,
        zones: ['ALL'],
        volume, enabled,
      }
      const saved = isEdit ? await broadcastAPI.update(editing!.id, body)
        : await broadcastAPI.create(body)
      if (immediate && !isEdit) {
        await broadcastAPI.playNow(saved.id)
        alert('지금 방송을 요청했습니다.')
      }
      onSaved()
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '저장 실패') }
    finally { setSaving(false) }
  }

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40'

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{isEdit ? '방송 수정' : '방송 만들기'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* 종류 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">방송 종류</label>
            <div className="grid grid-cols-3 gap-1.5">
              {meta.types.map(t => (
                <button key={t} onClick={() => { setType(t); setMedia(null) }} disabled={isEdit}
                  className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${
                    type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            {isEdit && <p className="text-[11px] text-gray-400 mt-1">종류는 수정할 수 없습니다. 새로 만들어주세요.</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inp} placeholder="예) 점심 식사 안내" />
          </div>

          {/* 음원 */}
          {type === 'TTS' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">읽을 문구</label>
              <textarea value={text} onChange={e => { setText(e.target.value); setMedia(null) }} rows={3}
                className={`${inp} resize-none`} placeholder="예) 점심 식사 시간입니다. 식당으로 오세요." />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {(ttsProvider?.voices?.length ?? 0) > 0 && (
                  <select value={voice} onChange={e => { setVoice(e.target.value); setMedia(null) }}
                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
                    <option value="">기본 목소리</option>
                    {ttsProvider!.voices.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
                <button onClick={makeTts} disabled={making || !ttsReady}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold disabled:opacity-50">
                  {making ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} 음성 만들기
                </button>
                {!ttsReady && (
                  <span className="text-[11px] text-rose-500">
                    음성 생성이 설정돼 있지 않습니다 (서버 TTS 키 확인 필요)
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                파일 <span className="font-normal text-gray-400">({meta.allowed_ext.join(', ')} · 최대 {meta.max_upload_mb}MB)</span>
              </label>
              <input ref={fileRef} type="file" accept={meta.allowed_ext.join(',')} className="hidden"
                onChange={e => pickFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={making}
                className={`${inp} text-left flex items-center gap-2 ${media ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                {making ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {media ? '파일 준비됨 — 다시 고르려면 누르세요' : '눌러서 파일 선택'}
              </button>
            </div>
          )}

          {/* 미리듣기 */}
          {media?.url && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-[11px] font-bold text-gray-500 mb-1.5">
                미리듣기 {media.duration_sec ? `· ${media.duration_sec}초` : ''}
                <span className="font-normal text-gray-400"> — 이 PC에서만 들립니다(스피커로 안 나감)</span>
              </p>
              <audio controls src={media.url} className="w-full h-9" />
            </div>
          )}

          {/* 시점 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">방송 시점</label>
            {!isEdit && (
              <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
                <input type="checkbox" checked={immediate} onChange={e => setImmediate(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600" />
                저장하고 <b>지금 바로</b> 방송
              </label>
            )}
            {!immediate && (
              <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={inp} />
            )}
            <p className="text-[11px] text-gray-400 mt-1">기준 시간대: {meta.timezone}</p>
          </div>

          {/* 반복 */}
          {!immediate && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">반복</label>
              <div className="flex flex-wrap gap-1.5">
                {([['once', '1회'], ['daily', '매일'], ['weekdays', '평일'], ['weekly', '요일 지정']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setFreq(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      freq === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>{l}</button>
                ))}
              </div>
              {freq === 'weekly' && (
                <div className="flex gap-1 mt-2">
                  {WEEK.map((w, i) => (
                    <button key={w} onClick={() => setDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort())}
                      className={`w-9 h-9 rounded-lg text-xs font-bold border ${
                        days.includes(i) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-200'}`}>{w}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 볼륨 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              볼륨 <span className="text-indigo-600 font-bold">{volume}%</span>
            </label>
            <input type="range" min={0} max={100} step={5} value={volume}
              onChange={e => setVolume(Number(e.target.value))} className="w-full accent-indigo-600" />
          </div>

          {/* 구역 — 지금 되는 것만 보여준다 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">방송 구역</label>
            <div className="flex flex-wrap gap-1.5">
              {meta.zones.map(z => (
                <span key={z.key}
                  title={z.enabled ? '' : '장비가 없어 사용할 수 없습니다'}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    z.enabled ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-gray-50 text-gray-300 border-gray-200 line-through'}`}>
                  {z.label}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{meta.zone_note}</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-indigo-600" /> 활성화 (끄면 예약 시간이 와도 방송되지 않습니다)
          </label>

          {err && <p className="text-xs text-rose-600">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-500">취소</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}{immediate && !isEdit ? '저장하고 방송' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
