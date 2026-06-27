import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { naverAdsAPI, type BidOverride } from '@/api/naverAdsClient'

const won = (n?: number | null) => (n == null ? '-' : `${Math.round(n).toLocaleString()}원`)
const pad2 = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const fmtDT = (s?: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-')
const OV_STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: '예약', cls: 'bg-gray-100 text-gray-600' },
  active: { label: '적용중', cls: 'bg-green-50 text-green-700' },
  done: { label: '완료', cls: 'bg-blue-50 text-blue-700' },
  canceled: { label: '취소', cls: 'bg-gray-100 text-gray-400' },
  failed: { label: '실패', cls: 'bg-red-50 text-red-600' },
}
const schedText = (o: BidOverride) =>
  o.repeat === 'daily' ? `매일 ${o.daily_start}~${o.daily_end}` : `${fmtDT(o.start_at)} ~ ${fmtDT(o.end_at)}`

export default function OverridesPanel() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<BidOverride[]>([])
  const [filter, setFilter] = useState('live')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<BidOverride | null>(null)
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg] = useState('')
  const [status, setStatus] = useState<any | null>(null)
  const [ksList, setKsList] = useState<any[]>([])
  const [dpCfg, setDpCfg] = useState<any | null>(null)
  const [dpKw, setDpKw] = useState<{ global_enabled: boolean; dry_run: boolean; items: any[] } | null>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [list, st, ks, dp, dpk] = await Promise.all([
        naverAdsAPI.listOverrides(filter || undefined),
        naverAdsAPI.schedulerStatus().catch(() => null),
        naverAdsAPI.keywordSchedulesAll().catch(() => []),
        naverAdsAPI.getDaypartingConfig().catch(() => null),
        naverAdsAPI.daypartingKeywords().catch(() => null),
      ])
      setRows(list); if (st) setStatus(st); setKsList(ks || []); setDpCfg(dp); setDpKw(dpk)
    }
    catch (e: any) { setError(e?.message ?? '목록을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter])

  const cancelOv = async (o: BidOverride) => {
    if (!confirm('예약을 취소할까요? 적용 중이면 즉시 원래 입찰가로 복원됩니다.')) return
    try { await naverAdsAPI.cancelOverride(o.id); await load() } catch (e: any) { setError(e?.message ?? '취소 실패') }
  }
  const delOv = async (o: BidOverride) => {
    if (!confirm('이 예약 내역을 삭제할까요?')) return
    try { await naverAdsAPI.deleteOverride(o.id); await load() } catch (e: any) { setError(e?.message ?? '삭제 실패') }
  }
  const activateNow = async (o: BidOverride) => {
    if (!confirm(`'${o.keyword || o.keyword_id}' 입찰가를 지금 즉시 ${o.override_bid.toLocaleString()}원으로 변경할까요? (종료 시각에 자동 복원)`)) return
    try { await naverAdsAPI.activateOverrideNow(o.id); await load() } catch (e: any) { setError(e?.message ?? '적용 실패') }
  }
  const runNow = async () => {
    setRunning(true); setRunMsg(''); setError('')
    try {
      const r = await naverAdsAPI.bidOverridesRunNow()
      if (!r || r.ran === false) setRunMsg('지금 적용/복원할 예약이 없습니다.')
      else if (r.dry_run) setRunMsg(`⚠️ 모의(dry-run) 상태라 실제 입찰가는 변경되지 않았습니다. 아래 ‘실제 반영’을 켜야 적용됩니다. (적용 ${r.activated ?? 0} · 복원 ${r.reverted ?? 0})`)
      else setRunMsg(`점검 완료 · 적용 ${r.activated ?? 0} · 복원 ${r.reverted ?? 0} · 실패 ${r.failed ?? 0}`)
      await load()
    } catch (e: any) { setError(e?.message ?? '점검 실패') }
    finally { setRunning(false) }
  }

  const FILTERS: [string, string][] = [['live', '적용중·예약'], ['active', '적용중'], ['scheduled', '예약'], ['done', '완료'], ['', '전체']]

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">임시 입찰 예약 관리</h1>
        <button onClick={runNow} disabled={running} className="text-sm px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 disabled:opacity-50">{running ? '점검 중…' : '지금 점검'}</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">모든 키워드의 임시 입찰 변경 예약을 한 곳에서 보고 수정·취소·삭제합니다.</p>

      {status && <SchedulerStatus s={status} />}
      {dpCfg && <DaypartingView cfg={dpCfg} navigate={navigate} />}
      {dpKw && <DaypartingKeywords data={dpKw} reload={load} setError={setError} navigate={navigate} />}
      <KeywordSchedules list={ksList} navigate={navigate} />

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
      {runMsg && <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">{runMsg}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === v ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{label}</button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">{rows.length.toLocaleString()}건</span>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['상태', '키워드', '캠페인 · 광고그룹', '반복', '적용 시간', '변경가', '원래가', '관리'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : '예약이 없습니다.'}</td></tr>
            )}
            {rows.map(o => {
              const st = OV_STATUS[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900 max-w-[160px] truncate" title={o.keyword ?? ''}>
                    <button onClick={() => navigate(`/naver-ads/keyword/${o.keyword_id}`)} className="hover:text-primary-orange hover:underline">{o.keyword || o.keyword_id}</button>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[180px] truncate" title={`${o.campaign_name ?? ''} · ${o.adgroup_name ?? ''}`}>{[o.campaign_name, o.adgroup_name].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap">{o.repeat === 'daily' ? '매일' : '한 번'}</td>
                  <td className="px-3 py-2.5 tabular-nums text-gray-600 whitespace-nowrap">{schedText(o)}</td>
                  <td className="px-3 py-2.5 font-bold tabular-nums text-gray-900">{won(o.override_bid)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-gray-500">{o.original_bid != null ? won(o.original_bid) : '-'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {o.status === 'scheduled' && (
                      <button onClick={() => activateNow(o)} className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 font-semibold hover:bg-green-50 mr-1">즉시 적용</button>
                    )}
                    {o.status === 'scheduled' && (
                      <button onClick={() => setEditing(o)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 mr-1">수정</button>
                    )}
                    {(o.status === 'scheduled' || o.status === 'active') && (
                      <button onClick={() => cancelOv(o)} className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-700 hover:bg-amber-50 mr-1">취소</button>
                    )}
                    <button onClick={() => delOv(o)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-50">삭제</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && <EditModal o={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load() }} setError={setError} />}
    </div>
  )
}

function EditModal({ o, onClose, onSaved, setError }: { o: BidOverride; onClose: () => void; onSaved: () => void; setError: (s: string) => void }) {
  const [bid, setBid] = useState(String(o.override_bid))
  const [repeat, setRepeat] = useState<'once' | 'daily'>(o.repeat === 'daily' ? 'daily' : 'once')
  const [start, setStart] = useState(o.start_at ? toLocalInput(new Date(o.start_at)) : '')
  const [end, setEnd] = useState(o.end_at ? toLocalInput(new Date(o.end_at)) : '')
  const [dStart, setDStart] = useState(o.daily_start || '18:00')
  const [dEnd, setDEnd] = useState(o.daily_end || '21:00')
  const [note, setNote] = useState(o.note || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const b = Math.round(Number(bid))
    if (!b || b <= 0) { setError('변경 입찰가를 입력하세요.'); return }
    setSaving(true)
    try {
      await naverAdsAPI.updateOverride(o.id, {
        override_bid: b, repeat, note: note || null,
        ...(repeat === 'daily' ? { daily_start: dStart, daily_end: dEnd } : { start_at: start, end_at: end }),
      })
      onSaved()
    } catch (e: any) { setError(e?.message ?? '수정 실패'); setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">예약 수정</h3>
        <p className="text-xs text-gray-400 mb-4">{o.keyword || o.keyword_id}</p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {(['once', 'daily'] as const).map(rp => (
              <button key={rp} onClick={() => setRepeat(rp)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${repeat === rp ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {rp === 'once' ? '한 번만' : '매일 반복'}
              </button>
            ))}
          </div>
          <div><label className={labelCls}>변경 입찰가 (원)</label><input type="number" min={0} value={bid} onChange={e => setBid(e.target.value)} className={inputCls} /></div>
          {repeat === 'daily' ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>매일 시작</label><input type="time" value={dStart} onChange={e => setDStart(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>매일 종료</label><input type="time" value={dEnd} onChange={e => setDEnd(e.target.value)} className={inputCls} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>시작 시각</label><input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>종료 시각</label><input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className={inputCls} /></div>
            </div>
          )}
          <div><label className={labelCls}>메모</label><input value={note} onChange={e => setNote(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">취소</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-orange text-white hover:bg-primary-orange/90 disabled:opacity-50">{saving ? '저장 중…' : '수정 저장'}</button>
        </div>
      </div>
    </div>
  )
}

function SchedulerStatus({ s }: { s: any }) {
  const dp = s.dayparting || {}
  const ks = s.keyword_schedules || {}
  const ov = s.overrides || {}
  const fmt = (x?: string | null) => (x ? new Date(x).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-')
  const ls = dp.last_run_summary || {}
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-bold text-gray-900">스케줄러 현황</h3>
        <span className="text-xs text-gray-400">기준 {fmt(s.now)}</span>
        {dp.dry_run && <span className="ml-auto inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700">모의(dry-run) · 실제 미반영</span>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-500 mb-1">데이파팅</p>
          <p className={`text-lg font-bold ${dp.enabled ? 'text-green-600' : 'text-gray-400'}`}>{dp.enabled ? 'ON' : 'OFF'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">현재 배수 x{dp.current_multiplier ?? '-'} · 기준 {dp.base_keyword_count ?? 0}개</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-500 mb-1">키워드 시간표</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">{ks.enabled ?? 0}<span className="text-sm text-gray-400"> / {ks.total ?? 0}</span></p>
          <p className="text-[11px] text-gray-400 mt-0.5">활성 / 전체</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-500 mb-1">임시 예약</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">적용중 {ov.active ?? 0} · 예약 {ov.scheduled ?? 0}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">오늘 적용 {s.today_applied ?? 0}건</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-500 mb-1">마지막 데이파팅 실행</p>
          <p className="text-sm font-bold text-gray-700">{fmt(dp.last_run_at)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{ls && (ls.applied != null) ? `적용 ${ls.applied} · 실패 ${ls.failed ?? 0} · 건너뜀 ${ls.skipped ?? 0}` : '-'}</p>
        </div>
      </div>
    </div>
  )
}

function DaypartingView({ cfg, navigate }: { cfg: any; navigate: (p: string) => void }) {
  const hm: Record<string, number> = cfg.hour_multipliers || {}
  const wm: Record<string, number> = cfg.weekday_multipliers || {}
  const wdays = ['월', '화', '수', '목', '금', '토', '일']
  const cell = (v: number) => v > 1 ? 'bg-orange-50 text-orange-700' : v < 1 ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-bold text-gray-900">데이파팅(시간대·요일 가중치)</h3>
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cfg.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{cfg.enabled ? 'ON' : 'OFF'}</span>
        {cfg.dry_run && <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700">모의(dry-run)</span>}
        <button onClick={() => navigate('/naver-ads')} className="ml-auto text-xs text-gray-400 hover:text-gray-700">설정 변경 → 광고 운영 탭</button>
      </div>
      <p className="text-xs text-gray-500 mb-2">기준가 {cfg.base_keyword_count ?? 0}개 · 최소입찰 {(cfg.min_bid ?? 0).toLocaleString()}원 · 현재 배수 x{cfg.current_multiplier ?? '-'}</p>
      <div className="mb-3">
        <p className="text-[11px] text-gray-400 mb-1">시간대(0~23시) 배수</p>
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className={`rounded text-center py-1 ${cell(Number(hm[String(h)] ?? 1))}`}>
              <div className="text-[9px] text-gray-400">{h}</div>
              <div className="text-[11px] font-bold tabular-nums">x{hm[String(h)] ?? 1}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] text-gray-400 mb-1">요일 배수</p>
        <div className="grid grid-cols-7 gap-1 max-w-md">
          {wdays.map(d => (
            <div key={d} className={`rounded text-center py-1 ${cell(Number(wm[d] ?? 1))}`}>
              <div className="text-[9px] text-gray-400">{d}</div>
              <div className="text-[11px] font-bold tabular-nums">x{wm[d] ?? 1}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KeywordSchedules({ list, navigate }: { list: any[]; navigate: (p: string) => void }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-4">
      <h3 className="font-bold text-gray-900 mb-3">등록된 키워드 시간표 <span className="text-xs font-normal text-gray-400">({list.length}개)</span></h3>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400">등록된 키워드 시간표가 없습니다. 키워드 상세에서 시간별 입찰가를 저장하면 여기에 표시됩니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                {['키워드', '캠페인 · 광고그룹', '활성', '설정 시간', '수정', ''].map(h => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map(k => (
                <tr key={k.keyword_id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-2 font-semibold text-gray-900 max-w-[160px] truncate" title={k.keyword ?? ''}>{k.keyword || k.keyword_id}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate">{[k.campaign_name, k.adgroup_name].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${k.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{k.enabled ? '활성' : '꺼짐'}</span></td>
                  <td className="px-3 py-2 text-gray-600 tabular-nums">{(k.hours || []).length}시간 {(k.hours || []).length > 0 && <span className="text-[11px] text-gray-400">({(k.hours || []).map((h: number) => `${h}시`).join(', ')})</span>}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{k.updated_at ? new Date(k.updated_at).toLocaleDateString('ko-KR') : '-'}</td>
                  <td className="px-3 py-2"><button onClick={() => navigate(`/naver-ads/keyword/${k.keyword_id}`)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">수정</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function DaypartingKeywords({ data, reload, setError, navigate }: { data: { global_enabled: boolean; dry_run: boolean; items: any[] }; reload: () => Promise<void>; setError: (s: string) => void; navigate: (p: string) => void }) {
  const won = (n?: number | null) => (n == null ? '-' : `${Math.round(n).toLocaleString()}원`)
  const setGlobal = async (en: boolean) => {
    try { await naverAdsAPI.setDaypartingEnabled(en); await reload() } catch (e: any) { setError(e?.message ?? '변경 실패') }
  }
  const toggleKw = async (keyword_id: string, en: boolean) => {
    try { await naverAdsAPI.toggleDaypartingKeyword({ keyword_id, enabled: en }); await reload() } catch (e: any) { setError(e?.message ?? '변경 실패') }
  }
  const toggleAll = async (en: boolean) => {
    try { await naverAdsAPI.toggleDaypartingKeyword({ all: true, enabled: en }); await reload() } catch (e: any) { setError(e?.message ?? '변경 실패') }
  }
  const setDry = async (dry: boolean) => {
    try { await naverAdsAPI.setDaypartingDryRun(dry); await reload() } catch (e: any) { setError(e?.message ?? '변경 실패') }
  }
  const onCnt = data.items.filter(i => i.enabled !== false).length

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h3 className="font-bold text-gray-900">데이파팅 적용 키워드 <span className="text-xs font-normal text-gray-400">(적용 {onCnt}/{data.items.length})</span></h3>
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">실제 반영</span>
            <Toggle on={!data.dry_run} onClick={() => setDry(!data.dry_run)} />
            <span className={`text-xs font-bold ${!data.dry_run ? 'text-green-600' : 'text-amber-600'}`}>{data.dry_run ? '모의' : '실반영'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">전체 데이파팅</span>
            <Toggle on={data.global_enabled} onClick={() => setGlobal(!data.global_enabled)} />
            <span className={`text-xs font-bold ${data.global_enabled ? 'text-green-600' : 'text-gray-400'}`}>{data.global_enabled ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      </div>
      {data.dry_run && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><b>모의(dry-run)</b> 상태입니다. 데이파팅·키워드 시간표·임시 예약 <b>모두 실제 입찰가가 변경되지 않습니다.</b> 위 ‘실제 반영’을 켜세요.</div>}
      {!data.global_enabled && <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">전체 데이파팅이 꺼져 있어 키워드별 설정과 무관하게 적용되지 않습니다.</div>}

      {data.items.length === 0 ? (
        <p className="text-sm text-gray-400">기준가(base)로 등록된 키워드가 없습니다. ‘광고 운영’ 탭에서 데이파팅 설정 저장 시 현재 입찰가가 기준가로 캡처됩니다.</p>
      ) : (
        <>
          <div className="flex gap-2 mb-2">
            <button onClick={() => toggleAll(true)} className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 hover:bg-green-50">전체 켜기</button>
            <button onClick={() => toggleAll(false)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">전체 끄기</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  {['적용', '키워드', '캠페인 · 광고그룹', '기준가', ''].map(h => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.items.map(k => {
                  const on = k.enabled !== false
                  return (
                    <tr key={k.keyword_id} className="border-t border-gray-50 hover:bg-gray-50/60">
                      <td className="px-3 py-2"><Toggle on={on} onClick={() => toggleKw(k.keyword_id, !on)} /></td>
                      <td className="px-3 py-2 font-semibold text-gray-900 max-w-[160px] truncate" title={k.keyword ?? ''}>{k.keyword || k.keyword_id}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate">{[k.campaign_name, k.adgroup_name].filter(Boolean).join(' · ') || '-'}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-600">{won(k.bid)}</td>
                      <td className="px-3 py-2"><button onClick={() => navigate(`/naver-ads/keyword/${k.keyword_id}`)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">상세</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
