import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Radio, Plus, Play, Square, Loader2, Trash2, Pencil, X, Volume2, Wifi, WifiOff,
  CalendarClock, History, AlertTriangle, CheckCircle2, Upload, Sparkles,
} from 'lucide-react'
import {
  broadcastAPI, mediaUrl, type BroadcastSchedule, type Dashboard, type BroadcastMeta,
  type PositionCastConfig, type PositionPlan,
  type AudioConfig, type AudioPreset, type AudioStats,
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
/** 기록에 보여줄 시각 — 실제로 방송이 나간 때(Agent 보고)를 우선한다.
 *  created_at 은 서버가 찍은 값이라 서버 시계가 틀어져 있으면 그만큼 어긋난다. */
const logTime = (l: BroadcastLog) => mdhm(l.started_at ?? l.created_at)
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
  const [tab, setTab] = useState<'dashboard' | 'schedules' | 'position' | 'audio' | 'logs'>('dashboard')
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

      {/* 서버 시계가 틀어지면 화면에 보이는 시각이 실제와 달라진다.
          방송 자체는 현장 PC 시계로 나가지만, 기록 시각이 어긋나므로 알려준다. */}
      {dash && typeof dash.server_clock_skew_sec === 'number'
        && Math.abs(dash.server_clock_skew_sec) >= 60 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>서버 시계가 {Math.abs(Math.round(dash.server_clock_skew_sec / 60))}분
          {dash.server_clock_skew_sec > 0 ? ' 빠릅니다' : ' 느립니다'}.</b>
          {' '}화면에 표시되는 기록 시각이 실제와 다를 수 있습니다.
          <span className="block text-xs mt-1 text-amber-700 leading-relaxed">
            방송은 현장 PC 시계로 나가므로 <b>방송 시각 자체는 정확</b>합니다.
            서버에서 시간 동기화를 켜주세요:
            {' '}<code className="text-[11px]">sudo timedatectl set-ntp true</code>
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
        {([['dashboard', '현황'], ['schedules', `예약 (${list.length})`], ['position', '체위변경'], ['audio', '음질'], ['logs', '방송 이력']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
              tab === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && dash && <DashboardView dash={dash} />}

      {tab === 'position' && <PositionCastView onChanged={load} />}

      {tab === 'audio' && <AudioShapeView />}

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
                    {s.source === 'PROGRAM' && (
                      <span title="프로그램 관리에서 자동으로 만든 예약입니다"
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200">
                        프로그램 자동
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
                    <audio controls preload="none" src={mediaUrl(s.media_url)} className="h-8 max-w-[190px]" title="미리듣기 — 관리자 PC에서만 들립니다" />
                  )}
                  <button onClick={() => playNow(s)} disabled={busy === s.id || s.status !== 'READY'}
                    title="지금 바로 방송" className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-30">
                    {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </button>
                  {s.source === 'PROGRAM' ? (
                    // 여기서 고쳐도 다음 동기화 때 되돌아간다 — 어디서 고치는지만 알린다
                    <span className="text-[11px] text-gray-400 px-2 whitespace-nowrap">
                      프로그램 관리에서 변경
                    </span>
                  ) : (<>
                    <button onClick={() => toggle(s)} disabled={busy === s.id}
                      title={s.enabled ? '비활성화' : '활성화'}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                        s.enabled ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-gray-400 border-gray-200'}`}>
                      {s.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => setEditing(s)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(s)} className="p-2 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                  </>)}
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
                  <span className="text-xs text-gray-400 w-24 shrink-0"
                    title={l.started_at ? '실제 방송 시각' : '서버 기록 시각'}>{logTime(l)}</span>
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
                {/* 시계가 어긋나면 방송이 그만큼 어긋난다 — 조용히 넘기면 원인을 못 찾는다 */}
                {typeof d.clock_skew_sec === 'number' && Math.abs(d.clock_skew_sec) >= 30 && (
                  <span title="서버와 이 PC의 시계가 다릅니다. 양쪽 시간 동기화(NTP)를 확인하세요."
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                    ⏱ 시계 {Math.abs(Math.round(d.clock_skew_sec / 60)) >= 1
                      ? `${Math.abs(Math.round(d.clock_skew_sec / 60))}분`
                      : `${Math.abs(d.clock_skew_sec)}초`} 차이
                  </span>
                )}
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
                <span className="text-xs text-gray-400 w-20 shrink-0"
                  title={l.started_at ? '실제 방송 시각' : '서버 기록 시각'}>{logTime(l)}</span>
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
        // 즉시 방송도 시각을 직접 보낸다. null 로 두면 서버가 자기 시계로 찍는데,
        // 서버 시계가 틀어져 있으면 목록·이력에 엉뚱한 시각이 남는다.
        // 관리자 PC 시계가 현장의 실제 시각이므로 이쪽을 기준으로 삼는다.
        scheduled_at: immediate ? toLocalInput(new Date()) : when,
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

          {/* 업로드 결과 안내 — 조용히 처리하면 현장에서 "왜 작게 나오지"가 된다 */}
          {media?.still_quiet && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              원본 소리가 많이 작아 <b>최대치까지만 키웠습니다.</b> 방송이 작게 들릴 수 있으니
              미리듣기로 확인하고, 필요하면 더 큰 음원으로 다시 올려주세요.
            </p>
          )}
          {media?.audio_only && (
            <p className="text-xs text-gray-500">
              영상에서 <b>소리만</b> 뽑아 저장했습니다. (방송에는 오디오만 쓰입니다)
            </p>
          )}

          {/* 미리듣기 */}
          {media?.url && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-[11px] font-bold text-gray-500 mb-1.5">
                미리듣기 {media.duration_sec ? `· ${media.duration_sec}초` : ''}
                <span className="font-normal text-gray-400"> — 이 PC에서만 들립니다(스피커로 안 나감)</span>
              </p>
              <audio controls src={mediaUrl(media.url)} className="w-full h-9" />
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


/* ── 체위변경 안내방송 ──────────────────────────────────────────
 * 수급자 관리에서 '체위변경 대상자'로 표시된 분들의 이름을 부르고
 * 실시를 안내한다. 이름이 건물 전체에 나가는 방송이라
 * 미리 들어보고 켤 수 있게 한다. 대상자가 없으면 아예 나가지 않는다.
 */
function PositionCastView({ onChanged }: { onChanged: () => void }) {
  const [plan, setPlan] = useState<PositionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try { setPlan(await broadcastAPI.positionPlan()) }
    catch (e: any) { setErr(e?.message ?? '불러오지 못했습니다') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async (patch: Partial<PositionCastConfig>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    setSaving(true); setErr(''); setMsg(''); setPreview(null)
    try {
      const r = await broadcastAPI.positionSave(patch)
      const x = r.result
      setMsg(x?.enabled === false
        ? `껐습니다. 잡아둔 ${x.removed}건을 취소했습니다.`
        : x?.reason ? x.reason
        : `예약 ${x?.created ?? 0}건 생성 · ${x?.updated ?? 0}건 수정 · ${x?.removed ?? 0}건 취소`)
      setPlan(await broadcastAPI.positionPlan())
      onChanged()
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '저장 실패') }
    finally { setSaving(false) }
  }

  const listen = async () => {
    setSaving(true); setErr(''); setMsg('')
    try { setPreview((await broadcastAPI.positionPreview()).url) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '음성 생성 실패') }
    finally { setSaving(false) }
  }

  const toggleTime = (t: string) => {
    if (!plan) return
    const cur = plan.config.times
    save({ times: cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t].sort() })
  }

  if (loading || !plan) return <p className="text-sm text-gray-400 py-10 text-center">불러오는 중…</p>
  const cfg = plan.config
  // 07시부터 2시간 간격. 체위변경 기준이 2시간이다.
  const SLOTS = ['05:00', '07:00', '09:00', '11:00', '13:00', '15:00',
                 '17:00', '19:00', '21:00', '23:00']

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${cfg.enabled && plan.count > 0
        ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {!cfg.enabled ? '체위변경 안내방송 꺼짐'
                : plan.count === 0 ? '켜져 있지만 나가지 않습니다'
                : `체위변경 안내방송 켜짐 — 하루 ${cfg.times.length}회`}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {!cfg.enabled
                ? '지금은 체위변경 시간에 아무 방송도 나가지 않습니다.'
                : plan.count === 0
                  ? '체위변경 대상자가 없습니다. 수급자 관리에서 대상 어르신을 표시해주세요.'
                  : `대상 ${plan.count}명의 이름을 부르고 실시를 안내합니다.`}
            </p>
          </div>
          <button disabled={saving}
            onClick={() => save({ enabled: !cfg.enabled }, cfg.enabled
              ? '체위변경 안내방송을 끕니다.\n잡아둔 예약이 모두 취소됩니다.'
              : `체위변경 안내방송을 켭니다.\n\n대상 ${plan.count}명의 이름이 건물 전체 스피커로 나갑니다.\n하루 ${cfg.times.length}회. 문구를 확인하셨나요?`)}
            className={`ml-auto shrink-0 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${
              cfg.enabled ? 'border border-gray-200 bg-white text-gray-600' : 'bg-indigo-600 text-white'}`}>
            {saving ? '…' : cfg.enabled ? '끄기' : '켜기'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs font-bold text-gray-600 mb-2">
          방송 시각 <span className="font-normal text-gray-400">체위변경은 2시간 간격이 기준입니다</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SLOTS.map(t => (
            <button key={t} disabled={saving} onClick={() => toggleTime(t)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${
                cfg.times.includes(t) ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>
        {cfg.times.filter(t => !SLOTS.includes(t)).length > 0 && (
          <p className="text-[11px] text-gray-400 mt-2">
            그 밖의 시각: {cfg.times.filter(t => !SLOTS.includes(t)).join(', ')}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-gray-500">부르는 방식</span>
            <select value={cfg.name_style} disabled={saving}
              onChange={e => save({ name_style: e.target.value as PositionCastConfig['name_style'] })}
              className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 rounded-xl bg-white">
              <option value="name">이름만 (김OO)</option>
              <option value="room_name">호실 + 이름 (201호 김OO)</option>
              <option value="room">호실만 (201호)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-gray-500">음량</span>
            <select value={cfg.volume} disabled={saving}
              onChange={e => save({ volume: Number(e.target.value) })}
              className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 rounded-xl bg-white">
              {[30, 50, 70, 85, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <button type="button" disabled={saving}
          onClick={() => save({ mask_names: !cfg.mask_names }, cfg.mask_names
            ? '어르신 성함을 그대로 부릅니다.\n\n건물 전체 스피커로 나가며 방문객에게도 들립니다.\n그대로 진행할까요?'
            : undefined)}
          className={`w-full mt-3 text-left px-3 py-2.5 rounded-xl border text-sm transition-colors disabled:opacity-50 ${
            cfg.mask_names ? 'bg-violet-50 border-violet-300 text-violet-700'
                           : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          <span className="font-bold">{cfg.mask_names ? '✓ ' : ''}이름 가려서 부르기</span>
          <span className="block text-[10px] opacity-70 mt-0.5">
            {cfg.mask_names
              ? '이길용 → 이땡용 처럼 가운데를 가립니다. 성과 끝 글자가 남아 선생님들은 알아보십니다'
              : '성함을 그대로 부릅니다. 방문객에게도 들립니다'}
          </span>
        </button>
        <p className="text-[11px] text-gray-400 mt-2">
          이름을 부르는 방송입니다. 보호자가 계실 수 있는 시간대라면 「호실만」도 고려해보세요.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-bold text-gray-600">대상 어르신</p>
          <span className="text-[11px] text-gray-400">{plan.count}명</span>
          <a href="/eval/residents" className="ml-auto text-[11px] text-indigo-600 font-semibold hover:underline">
            수급자 관리에서 바꾸기 →
          </a>
        </div>
        {plan.count === 0 ? (
          <p className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl py-6 text-center">
            체위변경 대상자로 표시된 어르신이 없습니다.<br />
            수급자 관리에서 어르신을 열고 <b>체위변경 대상자</b>를 체크해주세요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {plan.targets.map(t => (
              <span key={t.id} className="text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-100">
                {t.room && <b className="mr-1">{t.room}호</b>}{t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-bold text-gray-600">방송 문구</p>
          <span className="text-[11px] text-gray-400">{plan.template_help}</span>
          {cfg.template.trim() !== plan.default_template.trim() && (
            <button disabled={saving}
              onClick={() => save({ template: plan.default_template },
                '문구를 기본 문구로 되돌립니다.\n지금 적어 두신 내용은 사라집니다.')}
              className="ml-auto text-[11px] text-indigo-600 font-semibold hover:underline disabled:opacity-50">
              기본 문구로 되돌리기
            </button>
          )}
        </div>
        <textarea key={cfg.template} defaultValue={cfg.template} rows={5} id="pos-tpl"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        <div className="flex items-center gap-2 mt-2">
          <p className="text-[11px] text-gray-400">
            {'{names}'} 자리에 대상 어르신 이름이 들어갑니다
          </p>
          <button disabled={saving}
            onClick={() => {
              const el = document.getElementById('pos-tpl') as HTMLTextAreaElement | null
              if (el) save({ template: el.value })
            }}
            className="ml-auto px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-bold disabled:opacity-50">
            문구 저장
          </button>
        </div>
      </div>

      {plan.text && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-bold text-gray-600">이렇게 나갑니다</p>
            <button onClick={listen} disabled={saving}
              className="ml-auto px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-600 disabled:opacity-50">
              미리듣기
            </button>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{plan.text}</p>
          {preview && (
            <div className="mt-3">
              <p className="text-[11px] font-bold text-gray-500 mb-1">
                미리듣기 — <span className="font-normal">이 PC에서만 들립니다 (스피커로 안 나감)</span>
              </p>
              <audio controls autoPlay src={mediaUrl(preview)} className="w-full h-9" />
            </div>
          )}
        </div>
      )}

      {msg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <p className="text-[11px] text-gray-400 text-center">
        수급자 관리에서 대상자를 바꾸면 명단과 음성이 자동으로 다시 만들어집니다.
      </p>
    </div>
  )
}

/* ── 음질 (컴프레서) ────────────────────────────────────────────
 * TTS 음성은 문장 안에서 세기가 들쭉날쭉하다. 어떤 음절만 튀면 앰프를 올릴 때
 * 그 음절만 귀를 때리고, 맞춰 낮추면 나머지 말이 안 들린다.
 * 큰 데를 눌러(컴프레서) 어디서나 또렷하게 만든다 — 방송용 마이크가 하는 일이다.
 *
 * 귀로만 고르면 '조금 더 크게' 를 반복하다 결국 찌그러진다.
 * 그래서 재본 숫자를 함께 보여주고 원본과 나란히 듣게 한다.
 */
function AudioShapeView() {
  const [cfg, setCfg] = useState<AudioConfig | null>(null)
  const [presets, setPresets] = useState<AudioPreset[]>([])
  const [ffmpeg, setFfmpeg] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [cmp, setCmp] = useState<{ before: AudioStats; after: AudioStats; filter: string | null } | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    broadcastAPI.audioConfig()
      .then(r => { setCfg(r.config); setPresets(r.presets); setFfmpeg(r.ffmpeg) })
      .catch(() => setErr('설정을 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (patch: Partial<AudioConfig>) => {
    setSaving(true); setErr(''); setMsg('')
    try {
      const r = await broadcastAPI.audioSave(patch)
      setCfg(r.config); setCmp(null)
      setMsg('저장했습니다. 앞으로 만드는 음성부터 적용됩니다.')
    } catch (e: any) { setErr(e?.response?.data?.detail ?? '저장 실패') }
    finally { setSaving(false) }
  }

  const listen = async () => {
    setTesting(true); setErr(''); setMsg('')
    try {
      const r = await broadcastAPI.audioPreview({})
      setCmp({ before: r.before, after: r.after, filter: r.filter })
    } catch (e: any) { setErr(e?.response?.data?.detail ?? '만들지 못했습니다') }
    finally { setTesting(false) }
  }

  if (loading || !cfg) return <p className="text-sm text-gray-400 py-10 text-center">불러오는 중…</p>

  /** 숫자를 막대로 — dB 는 눈에 안 들어온다 */
  const Bar = ({ label, v, lo, hi, tone, hint }: {
    label: string; v: number; lo: number; hi: number; tone: string; hint?: string
  }) => {
    const pct = Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
    return (
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-bold text-gray-600">{label}</span>
          <span className="text-[11px] font-black text-gray-900 tabular-nums">{v.toFixed(1)}dB</span>
          {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-0.5">
          <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  const Card = ({ t, s2 }: { t: string; s2: AudioStats }) => (
    <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
      <p className="text-xs font-bold text-gray-700">{t}</p>
      {s2.url && <audio controls src={mediaUrl(s2.url)} className="w-full h-9" />}
      <Bar label="가장 큰 순간" v={s2.peak_db} lo={-24} hi={0} tone="bg-rose-400" />
      <Bar label="느껴지는 크기" v={s2.rms_db} lo={-40} hi={-6} tone="bg-emerald-500" />
      <Bar label="세기 차이" v={s2.crest_db} lo={4} hi={26} tone="bg-amber-500"
        hint={s2.crest_db > 17 ? '어떤 데만 크게 들립니다' : s2.crest_db > 13 ? '보통' : '고릅니다'} />
    </div>
  )

  return (
    <div className="space-y-4">
      {!ffmpeg && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-bold text-amber-800">서버에 ffmpeg 이 없어 음질 보정을 할 수 없습니다</p>
          <p className="text-[11px] text-amber-600 mt-0.5">
            지금은 음량만 맞춰 내보냅니다. 관리자에게 알려주세요.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-sm font-bold text-gray-800">방송 음질</p>
        <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
          어떤 음절만 크게 튀면 앰프를 맞추기 어렵습니다. 큰 데를 눌러 어디서나 또렷하게 만듭니다.
          <span className="block mt-0.5">앞으로 <b>새로 만드는 음성</b>부터 적용됩니다 — 이미 만들어 둔 음원은 그대로입니다.</span>
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {presets.map(p => {
            const on = !cfg.custom && cfg.preset === p.key
            return (
              <button key={p.key} disabled={saving}
                onClick={() => save({ preset: p.key as AudioConfig['preset'], custom: false })}
                className={`text-left p-3 rounded-xl border transition-colors disabled:opacity-50 ${
                  on ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className={`text-sm font-bold ${on ? 'text-indigo-800' : 'text-gray-800'}`}>
                  {on ? '✓ ' : ''}{p.label}
                </p>
                <p className="text-[10.5px] text-gray-500 mt-0.5 leading-snug">{p.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-bold text-gray-700">들어보고 고르기</p>
          <span className="text-[11px] text-gray-400">원본과 나란히 듣습니다 · 스피커로 안 나갑니다</span>
          <button onClick={listen} disabled={testing}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-bold disabled:opacity-50">
            {testing && <Loader2 size={11} className="animate-spin" />}
            {cmp ? '다시 만들기' : '만들어 듣기'}
          </button>
        </div>
        {!cmp ? (
          <p className="text-xs text-gray-400 py-6 text-center">
            「만들어 듣기」를 누르면 같은 문구를 원본·보정 두 가지로 만들어 비교합니다.
          </p>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-2.5">
              <Card t="원본 (음량만 맞춤)" s2={cmp.before} />
              <Card t="지금 설정으로 보정" s2={cmp.after} />
            </div>
            <p className="text-[11px] text-gray-500 mt-2.5">
              <b>세기 차이</b>가 줄고 <b>느껴지는 크기</b>가 커졌다면 잘 맞은 것입니다.
              가장 큰 순간은 어느 설정에서도 천장({cfg.ceiling_db}dB)을 넘지 않습니다.
            </p>
            {cmp.filter && (
              <p className="text-[10px] text-gray-300 mt-1 font-mono break-all">{cmp.filter}</p>
            )}
          </>
        )}
      </div>

      <details className="rounded-2xl border border-gray-100 bg-white p-4">
        <summary className="text-xs font-bold text-gray-600 cursor-pointer">
          직접 맞추기 <span className="font-normal text-gray-400">— 프리셋으로 안 될 때만</span>
        </summary>
        <div className="mt-3 space-y-3">
          <button type="button" onClick={() => save({ custom: !cfg.custom })} disabled={saving}
            className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors disabled:opacity-50 ${
              cfg.custom ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'border-gray-200 text-gray-500'}`}>
            <span className="font-bold">{cfg.custom ? '✓ ' : ''}아래 값을 직접 쓰기</span>
            <span className="block text-[10.5px] opacity-70 mt-0.5">
              끄면 위에서 고른 프리셋 값을 씁니다
            </span>
          </button>
          {([
            ['threshold_db', '누르기 시작하는 세기', -40, -6, 1, 'dB — 낮출수록 더 많이 눌립니다'],
            ['ratio', '누르는 정도', 1, 12, 0.5, ': 1 — 높을수록 강하게'],
            ['attack_ms', '무는 속도', 1, 60, 1, 'ms — 빠를수록 튀는 소리를 잘 잡습니다'],
            ['release_ms', '놓는 속도', 60, 600, 10, 'ms — 너무 짧으면 소리가 출렁입니다'],
            ['target_lufs', '느껴지는 크기 목표', -24, -10, 0.5, 'LUFS — 높을수록 크게'],
          ] as const).map(([k, label, lo, hi, step, unit]) => (
            <label key={k} className="block">
              <span className="text-[11px] font-semibold text-gray-600">
                {label} <b className="text-gray-900 tabular-nums">{(cfg as any)[k] ?? '-'}</b>
                <span className="font-normal text-gray-400"> {unit}</span>
              </span>
              <input type="range" min={lo} max={hi} step={step}
                value={Number((cfg as any)[k] ?? lo)} disabled={!cfg.custom || saving}
                onChange={e => setCfg(c => c && ({ ...c, [k]: Number(e.target.value) }))}
                onMouseUp={e => cfg.custom && save({ [k]: Number((e.target as HTMLInputElement).value) } as any)}
                onTouchEnd={e => cfg.custom && save({ [k]: Number((e.target as HTMLInputElement).value) } as any)}
                className="w-full accent-indigo-600 disabled:opacity-40" />
            </label>
          ))}
        </div>
      </details>

      {msg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </div>
  )
}