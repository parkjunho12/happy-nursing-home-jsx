import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { naverAdsAPI, type KeywordDetail, type BidOverride } from '@/api/naverAdsClient'

const won = (n: number | null | undefined) => (n == null ? '-' : `${Math.round(n).toLocaleString()}원`)
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
const LOG_STATUS: Record<string, { label: string; cls: string }> = {
  applied: { label: '적용됨', cls: 'bg-green-50 text-green-700' },
  dry_run: { label: '모의(dry-run)', cls: 'bg-gray-100 text-gray-500' },
  failed: { label: '실패', cls: 'bg-red-50 text-red-600' },
  pending: { label: '대기', cls: 'bg-amber-50 text-amber-700' },
  skipped: { label: '건너뜀', cls: 'bg-gray-100 text-gray-400' },
}
const LOG_SRC: Record<string, string> = {
  dayparting: '데이파팅', keyword_schedule: '키워드 시간표', bid_override: '임시 변경', rule_engine: '룰 엔진',
}

export default function NaverAdsKeywordDetailPage() {
  const { keywordId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const passed = (location.state || {}) as Partial<KeywordDetail> & { tier?: number }

  const [detail, setDetail] = useState<KeywordDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [bids, setBids] = useState<Record<string, string>>({})
  const [enabled, setEnabled] = useState(true)
  const [hourMult, setHourMult] = useState<Record<string, number>>({})

  const [overrides, setOverrides] = useState<BidOverride[]>([])
  const [ovBid, setOvBid] = useState('')
  const [ovRepeat, setOvRepeat] = useState<'once' | 'daily'>('once')
  const [ovDStart, setOvDStart] = useState('18:00')
  const [ovDEnd, setOvDEnd] = useState('21:00')
  const [ovStart, setOvStart] = useState('')
  const [ovEnd, setOvEnd] = useState('')
  const [ovNote, setOvNote] = useState('')
  const [ovSaving, setOvSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    Promise.all([
      naverAdsAPI.keywordDetail(keywordId),
      naverAdsAPI.getDaypartingConfig().catch(() => null),
    ]).then(([d, cfg]) => {
      if (!alive) return
      setDetail(d)
      setEnabled(d.schedule.enabled)
      const init: Record<string, string> = {}
      Object.entries(d.schedule.hourly_bids || {}).forEach(([h, v]) => { init[h] = String(v) })
      setBids(init)
      if (cfg?.hour_multipliers) setHourMult(cfg.hour_multipliers as any)
      if (!d.configured) setError('네이버 광고 API가 설정되지 않았습니다.')
    }).catch((e: any) => alive && setError(e?.message ?? '키워드 정보를 불러오지 못했습니다.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [keywordId])

  const loadOverrides = () => naverAdsAPI.keywordOverrides(keywordId).then(setOverrides).catch(() => {})
  const loadLogs = () => naverAdsAPI.keywordBidLogs(keywordId).then(setLogs).catch(() => {})
  useEffect(() => {
    loadOverrides()
    loadLogs()
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1)
    setOvStart(toLocalInput(d))
    const e = new Date(d); e.setHours(e.getHours() + 1)
    setOvEnd(toLocalInput(e))
  }, [keywordId])

  const createOverride = async () => {
    const bid = Math.round(Number(ovBid))
    if (!bid || bid <= 0) { setError('변경 입찰가를 입력하세요.'); return }
    if (ovRepeat === 'daily') { if (!ovDStart || !ovDEnd) { setError('반복 시작/종료 시각을 입력하세요.'); return } }
    else if (!ovStart || !ovEnd) { setError('시작/종료 시각을 입력하세요.'); return }
    setOvSaving(true); setError('')
    try {
      const times = ovRepeat === 'daily'
        ? { daily_start: ovDStart, daily_end: ovDEnd }
        : { start_at: ovStart, end_at: ovEnd }
      if (editingId) {
        await naverAdsAPI.updateOverride(editingId, { override_bid: bid, repeat: ovRepeat, note: ovNote || null, ...times })
      } else {
        await naverAdsAPI.createOverride({
          keyword_id: keywordId, keyword: keyword || null,
          adgroup_id: detail?.adgroup_id ?? passed.adgroup_id ?? null,
          adgroup_name: detail?.adgroup_name ?? passed.adgroup_name ?? null,
          campaign_name: detail?.campaign_name ?? passed.campaign_name ?? null,
          override_bid: bid, repeat: ovRepeat, ...times, note: ovNote || null,
        })
      }
      setEditingId(null); setOvBid(''); setOvNote(''); await loadOverrides(); await loadLogs()
    } catch (e: any) { setError(e?.message ?? '예약에 실패했습니다.') }
    finally { setOvSaving(false) }
  }

  const startEdit = (o: BidOverride) => {
    setEditingId(o.id)
    setOvBid(String(o.override_bid))
    setOvNote(o.note || '')
    if (o.repeat === 'daily') {
      setOvRepeat('daily')
      if (o.daily_start) setOvDStart(o.daily_start)
      if (o.daily_end) setOvDEnd(o.daily_end)
    } else {
      setOvRepeat('once')
      if (o.start_at) setOvStart(toLocalInput(new Date(o.start_at)))
      if (o.end_at) setOvEnd(toLocalInput(new Date(o.end_at)))
    }
    document.getElementById('ov-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const cancelEdit = () => { setEditingId(null); setOvBid(''); setOvNote('') }
  const activateNow = async (o: BidOverride) => {
    if (!confirm(`지금 즉시 입찰가를 ${o.override_bid.toLocaleString()}원으로 변경할까요? (종료 시각에 자동 복원)`)) return
    try { await naverAdsAPI.activateOverrideNow(o.id); await loadOverrides(); await loadLogs() } catch (e: any) { setError(e?.message ?? '적용 실패') }
  }
  const cancelOv = async (id: string) => {
    if (!confirm('예약을 취소할까요? 적용 중이면 즉시 원래 입찰가로 복원됩니다.')) return
    try { await naverAdsAPI.cancelOverride(id); await loadOverrides(); await loadLogs() } catch (e: any) { setError(e?.message ?? '취소 실패') }
  }
  const delOv = async (id: string) => {
    if (!confirm('이 예약 내역을 삭제할까요?')) return
    try { await naverAdsAPI.deleteOverride(id); await loadOverrides(); await loadLogs() } catch (e: any) { setError(e?.message ?? '삭제 실패') }
  }
  const runNow = async () => {
    setRunning(true); setRunMsg(''); setError('')
    try {
      const r = await naverAdsAPI.bidOverridesRunNow()
      if (!r || r.ran === false) setRunMsg('지금 적용/복원할 예약이 없습니다.')
      else setRunMsg(`점검 완료 · 적용 ${r.activated ?? 0} · 복원 ${r.reverted ?? 0} · 실패 ${r.failed ?? 0}${r.dry_run ? ' (모의 dry-run)' : ''}`)
      await loadOverrides(); await loadLogs()
    } catch (e: any) { setError(e?.message ?? '점검 실패') }
    finally { setRunning(false) }
  }

  const curBid = detail?.current_bid ?? passed.current_bid ?? 0
  const keyword = detail?.keyword ?? passed.keyword ?? keywordId

  const fillAll = (val: number) => {
    const d: Record<string, string> = {}; for (let h = 0; h < 24; h++) d[String(h)] = String(val); setBids(d)
  }
  const fillByDayparting = () => {
    const d: Record<string, string> = {}
    for (let h = 0; h < 24; h++) {
      const m = hourMult[String(h)] ?? 1
      d[String(h)] = String(Math.max(70, Math.round((curBid * m) / 10) * 10))
    }
    setBids(d)
  }

  const save = async () => {
    setSaving(true); setError('')
    try {
      const hb: Record<string, number> = {}
      Object.entries(bids).forEach(([h, v]) => { const n = Number(v); if (n > 0) hb[h] = Math.round(n) })
      await naverAdsAPI.saveKeywordSchedules([{
        keyword_id: keywordId,
        keyword: keyword || undefined,
        campaign_name: detail?.campaign_name ?? passed.campaign_name ?? null,
        adgroup_name: detail?.adgroup_name ?? passed.adgroup_name ?? null,
        adgroup_id: detail?.adgroup_id ?? passed.adgroup_id ?? null,
        enabled,
        hourly_bids: hb,
      }])
      alert('시간 입찰가 저장 완료')
    } catch (e: any) { setError(e?.message ?? '저장에 실패했습니다.') }
    finally { setSaving(false) }
  }

  const setHours = Object.keys(bids).filter(h => Number(bids[h]) > 0).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/naver-ads')} className="text-sm text-gray-500 hover:text-gray-800 mb-4">← 광고 관리로</button>

      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">{keyword}</h1>
        {detail?.tier ? <span className="text-xs font-bold text-gray-400">T{detail.tier}</span> : null}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        {detail?.campaign_name ?? passed.campaign_name ?? '-'} · {detail?.adgroup_name ?? passed.adgroup_name ?? '-'} · 현재 입찰가 {won(curBid)}
      </p>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">시간별 입찰가 설정</h2>
          <span className="text-xs text-gray-400">{setHours}시간 설정됨</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">0~23시 각 시각의 입찰가를 지정하면, 매시 정각에 그 시각 값으로 자동 설정됩니다. 비워둔 시각은 변경하지 않습니다. (실제 반영은 ‘매시간 자동 입찰 조정’의 dry-run 설정을 따릅니다)</p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="flex items-center gap-1.5 text-sm font-semibold"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> 이 키워드 자동 적용</label>
          <button onClick={() => fillAll(curBid)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">현재가로 전체</button>
          <button onClick={fillByDayparting} disabled={!Object.keys(hourMult).length} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">데이파팅 가중치로 채우기</button>
          <button onClick={() => setBids({})} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">비우기</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="flex flex-col">
                <span className="text-[10px] text-gray-400 mb-0.5">{h}시</span>
                <input type="number" value={bids[String(h)] ?? ''} placeholder="-"
                  onChange={e => setBids(p => ({ ...p, [String(h)]: e.target.value }))}
                  className="border border-gray-200 rounded px-1.5 py-1 text-sm w-full" />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => navigate('/naver-ads')} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">취소</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold bg-primary-orange text-white hover:bg-primary-orange/90 disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>

      {/* 임시 입찰 변경 예약 (지정 시간만 변경 후 복원) */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm mt-5">
        <div id="ov-form" className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-gray-900">임시 입찰 변경 예약{editingId ? ' · 수정' : ''}</h2>
          <button onClick={runNow} disabled={running} className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 disabled:opacity-50">{running ? '점검 중…' : '지금 점검'}</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          지정한 <b>시작~종료 시간 동안만</b> 입찰가를 바꾸고, 종료 시 <b>시작 시점의 입찰가</b>로 자동 복원합니다.
          시간별 설정과는 별개이며 <b>항상 실제 반영</b>됩니다(약 1분 간격 점검). 시작 전에 바로 적용하려면 ‘즉시 적용’을 누르세요.
        </p>
        {runMsg && <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">{runMsg}</div>}

        <div className="flex items-center gap-2 mb-3">
          {(['once', 'daily'] as const).map(rp => (
            <button key={rp} onClick={() => setOvRepeat(rp)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${ovRepeat === rp ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {rp === 'once' ? '한 번만' : '매일 반복'}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">변경 입찰가 (원)</label>
            <input type="number" min={0} value={ovBid} onChange={e => setOvBid(e.target.value)} placeholder="예) 300"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">메모 (선택)</label>
            <input value={ovNote} onChange={e => setOvNote(e.target.value)} placeholder="예) 저녁 상담 집중 시간 상향"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full" />
          </div>
          {ovRepeat === 'daily' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">매일 시작 시각</label>
                <input type="time" value={ovDStart} onChange={e => setOvDStart(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">매일 종료 시각</label>
                <input type="time" value={ovDEnd} onChange={e => setOvDEnd(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">시작 시각</label>
                <input type="datetime-local" value={ovStart} onChange={e => setOvStart(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">종료 시각</label>
                <input type="datetime-local" value={ovEnd} onChange={e => setOvEnd(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full" />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mb-5">
          {editingId && (
            <button onClick={cancelEdit} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">수정 취소</button>
          )}
          <button onClick={createOverride} disabled={ovSaving}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-900 text-white hover:bg-black disabled:opacity-50">{ovSaving ? '저장 중…' : (editingId ? '수정 저장' : '+ 예약 등록')}</button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-sm text-gray-400">예약된 임시 변경이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  {['상태', '반복', '변경가', '원래가', '적용 시간', '메모', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overrides.map(o => {
                  const st = OV_STATUS[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={o.id} className="border-t border-gray-50">
                      <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                      <td className="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">{o.repeat === 'daily' ? '매일' : '한 번'}</td>
                      <td className="px-3 py-2 font-bold tabular-nums text-gray-900">{won(o.override_bid)}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-500">{o.original_bid != null ? won(o.original_bid) : '-'}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{o.repeat === 'daily' ? `매일 ${o.daily_start}~${o.daily_end}` : `${fmtDT(o.start_at)} ~ ${fmtDT(o.end_at)}`}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate" title={o.note ?? ''}>{o.note || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {o.status === 'scheduled' && (
                          <button onClick={() => activateNow(o)} className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 font-semibold hover:bg-green-50 mr-1">즉시 적용</button>
                        )}
                        {o.status === 'scheduled' && (
                          <button onClick={() => startEdit(o)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 mr-1">수정</button>
                        )}
                        {(o.status === 'scheduled' || o.status === 'active') && (
                          <button onClick={() => cancelOv(o.id)} className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-700 hover:bg-amber-50 mr-1">취소</button>
                        )}
                        <button onClick={() => delOv(o.id)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-50">삭제</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 실행 로그 */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-2">실행 로그 <span className="text-xs font-normal text-gray-400">(이 키워드의 최근 입찰 변경)</span></h3>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400">실행 기록이 없습니다. 예약이 시작 시각에 도달하거나 ‘지금 점검’ 시 여기에 표시됩니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    {['시각', '출처', '사유', '변경', '상태'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const ls = LOG_STATUS[l.status] ?? { label: l.status, cls: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={l.id} className="border-t border-gray-50">
                        <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{fmtDT(l.applied_at || l.created_at)}</td>
                        <td className="px-3 py-2 whitespace-nowrap"><span className="text-xs font-semibold text-gray-500">{LOG_SRC[l.suggested_by] ?? l.suggested_by ?? '-'}</span></td>
                        <td className="px-3 py-2 text-gray-600">{l.reason || '-'}</td>
                        <td className="px-3 py-2 tabular-nums text-gray-700 whitespace-nowrap">{won(l.old_bid)} → <b>{won(l.new_bid)}</b></td>
                        <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${ls.cls}`}>{ls.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
