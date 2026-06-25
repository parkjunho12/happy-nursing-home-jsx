import { useEffect, useMemo, useRef, useState } from 'react'
import CtaTrackingPanel from './CtaTrackingPanel'
import { useNavigate } from 'react-router-dom'
import {
  naverAdsAPI,
  type PerformanceData,
  type KeywordPerf,
  type BidSuggestion,
  type AiSummary,
  type Campaign,
  type AdGroup,
  type ApplyResult,
  type DaypartingPlan,
  type DaypartingConfig,
} from '@/api/naverAdsClient'

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'custom'

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function rangeFor(p: Period, customStart: string, customEnd: string): { start: string; end: string } {
  const today = new Date()
  const d = (n: number) => { const x = new Date(today); x.setDate(x.getDate() - n); return x }
  switch (p) {
    case 'today': return { start: fmtDate(today), end: fmtDate(today) }
    case 'yesterday': return { start: fmtDate(d(1)), end: fmtDate(d(1)) }
    case '7d': return { start: fmtDate(d(6)), end: fmtDate(today) }
    case '30d': return { start: fmtDate(d(29)), end: fmtDate(today) }
    case 'custom': return { start: customStart || fmtDate(d(6)), end: customEnd || fmtDate(today) }
  }
}

const won = (n: number | null | undefined) => (n == null ? '-' : `${Math.round(n).toLocaleString()}원`)
const pct = (n: number | null | undefined) => (n == null ? '-' : `${(n * 100).toFixed(2)}%`)
const num = (n: number | null | undefined) => (n == null ? '-' : Math.round(n).toLocaleString())

const actionStyle: Record<string, string> = {
  increase: 'bg-blue-50 text-blue-700 border-blue-200',
  decrease: 'bg-orange-50 text-orange-700 border-orange-200',
  hold: 'bg-gray-100 text-gray-500 border-gray-200',
}
const actionLabel: Record<string, string> = { increase: '인상', decrease: '인하', hold: '유지' }

// 페이지 이탈(키워드 상세 진입) 후 복귀 시 직전 데이터를 유지하기 위한 모듈 캐시
let pageCache: any = null

export default function NaverAdsPage() {
  const cache = pageCache
  const navigate = useNavigate()
  const [view, setView] = useState<'ads' | 'cta'>('ads')
  const [period, setPeriod] = useState<Period>(cache?.period ?? '7d')
  const [customStart, setCustomStart] = useState<string>(cache?.customStart ?? '')
  const [customEnd, setCustomEnd] = useState<string>(cache?.customEnd ?? '')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adgroups, setAdgroups] = useState<AdGroup[]>([])
  const [campaignId, setCampaignId] = useState<string>(cache?.campaignId ?? '')
  const [adgroupId, setAdgroupId] = useState<string>(cache?.adgroupId ?? '')
  const [search, setSearch] = useState<string>(cache?.search ?? '')

  const [perf, setPerf] = useState<PerformanceData | null>(cache?.perf ?? null)
  const [suggestions, setSuggestions] = useState<Record<string, BidSuggestion>>(cache?.suggestions ?? {})
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(cache?.aiSummary ?? null)
  const [engine, setEngine] = useState<string>(cache?.engine ?? '')
  const [daypartText, setDaypartText] = useState<string>(cache?.daypartText ?? '')
  const [dayparting, setDayparting] = useState<DaypartingPlan | null>(cache?.dayparting ?? null)
  const [daypartLoading, setDaypartLoading] = useState(false)
  const [applyDayparting, setApplyDayparting] = useState(false)
  const [cfg, setCfg] = useState<DaypartingConfig | null>(null)
  const [schedEnabled, setSchedEnabled] = useState(false)
  const [schedDryRun, setSchedDryRun] = useState(true)
  const [schedMinBid, setSchedMinBid] = useState(70)
  const [schedSaving, setSchedSaving] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>(cache?.selected ?? {})

  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null)
  const [error, setError] = useState('')
  const [convCheck, setConvCheck] = useState<any | null>(cache?.convCheck ?? null)
  const [convChecking, setConvChecking] = useState(false)

  const { start, end } = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd])

  // 캠페인 로드
  useEffect(() => {
    naverAdsAPI.campaigns().then(r => {
      setCampaigns(r.campaigns)
      // 기본 조회 범위: '모바일' 캠페인 우선 선택(없으면 첫 캠페인) — 조회 부담 완화
      if (r.campaigns.length > 0) {
        const mobile = r.campaigns.find(c => /모바일|mobile|^mo|_mo/i.test(c.name || ''))
        const def = mobile?.campaign_id || r.campaigns[0].campaign_id
        setCampaignId(prev => prev || def)
      }
    }).catch(() => {})
  }, [])
  const didInitAdgroupRef = useRef(false)
  useEffect(() => {
    if (!campaignId) { setAdgroups([]); setAdgroupId(''); return }
    naverAdsAPI.adgroups(campaignId).then(r => {
      setAdgroups(r.adgroups)
      // 초기 진입 1회: 첫 번째 광고그룹만 보여주도록 자동 선택 (조회 범위 최소화)
      if (!didInitAdgroupRef.current && !adgroupId && r.adgroups.length > 0) {
        setAdgroupId(r.adgroups[0].adgroup_id)
        didInitAdgroupRef.current = true
      }
    }).catch(() => setAdgroups([]))
  }, [campaignId])

  const loadPerformance = async () => {
    setLoading(true); setError('')
    try {
      const data = await naverAdsAPI.performance({
        start_date: start, end_date: end,
        campaign_id: campaignId || undefined,
        adgroup_id: adgroupId || undefined,
        keyword: search || undefined,
      })
      setPerf(data)
      if (!data.configured) setError('네이버 광고 API가 아직 설정되지 않았습니다. (백엔드 환경변수 NAVER_ADS_* 필요)')
    } catch (e: any) {
      setError(e?.message ?? '성과 데이터를 불러오지 못했습니다.')
      setPerf(null)
    } finally { setLoading(false) }
  }

  // 성과/stats 조회는 자동으로 하지 않고 '조회' 버튼을 눌렀을 때만 실행한다.
  // (필터 변경/진입 시 자동 API 호출 없음 → 불필요한 대량 호출·429 방지)

  const checkConversions = async () => {
    setConvChecking(true); setError('')
    try {
      const d = await naverAdsAPI.statsDebug({ start_date: start, end_date: end, limit: 5 })
      setConvCheck(d)
    } catch (e: any) {
      setError(e?.message ?? '전환 데이터 점검에 실패했습니다.')
    } finally { setConvChecking(false) }
  }

  const analyzeDayparting = async () => {
    if (!daypartText.trim()) return
    setDaypartLoading(true); setError('')
    try {
      const plan = await naverAdsAPI.daypartingPlan(daypartText)
      setDayparting(plan)
      setApplyDayparting(true)
    } catch (e: any) {
      setError(e?.message ?? '시간대 분석에 실패했습니다.')
    } finally { setDaypartLoading(false) }
  }

  useEffect(() => {
    naverAdsAPI.getDaypartingConfig().then(c => {
      setCfg(c); setSchedEnabled(c.enabled); setSchedDryRun(c.dry_run); setSchedMinBid(c.min_bid)
    }).catch(() => {})
  }, [])

  const saveSchedule = async () => {
    setSchedSaving(true); setError('')
    try {
      const body: any = {
        enabled: schedEnabled,
        campaign_id: campaignId || null,
        adgroup_id: adgroupId || null,
        dry_run: schedDryRun,
        min_bid: schedMinBid,
        recapture_base: true,
      }
      if (dayparting) {
        body.hour_multipliers = Object.fromEntries(dayparting.hours.map(h => [String(h.hour), h.multiplier]))
        body.weekday_multipliers = Object.fromEntries(dayparting.weekdays.map(w => [String(w.day), w.multiplier]))
      }
      const c = await naverAdsAPI.saveDaypartingConfig(body)
      setCfg(c); setSchedEnabled(c.enabled); setSchedDryRun(c.dry_run); setSchedMinBid(c.min_bid)
      alert(`자동 입찰 설정 저장 완료\n활성: ${c.enabled ? 'ON' : 'OFF'} · 기준 키워드 ${c.base_keyword_count}개 · 현재 가중치 x${c.current_multiplier}`)
    } catch (e: any) {
      setError(e?.message ?? '자동 입찰 설정 저장에 실패했습니다.')
    } finally { setSchedSaving(false) }
  }

  const runScheduleNow = async () => {
    try {
      const r = await naverAdsAPI.daypartingRunNow()
      if (!r?.ran) { alert(`실행 안 됨: ${r?.reason ?? '알 수 없음'}`); return }
      alert(`실행 완료 (x${r.multiplier}, ${r.weekday} ${r.hour}시)\n${r.dry_run ? '모의 ' : ''}적용 ${r.applied} · 실패 ${r.failed} · 변경없음 ${r.skipped}`)
      await naverAdsAPI.getDaypartingConfig().then(setCfg).catch(() => {})
      if (!r.dry_run) await loadPerformance()
    } catch (e: any) {
      setError(e?.message ?? '실행에 실패했습니다.')
    }
  }

  const openKeyword = (r: KeywordPerf) => {
    navigate(`/naver-ads/keyword/${encodeURIComponent(r.keyword_id)}`, {
      state: { keyword: r.keyword, current_bid: r.current_bid, campaign_name: r.campaign_name, adgroup_name: r.adgroup_name, adgroup_id: r.adgroup_id, tier: r.tier },
    })
  }

  const generateSuggestions = async () => {
    setGenerating(true); setError('')
    try {
      const s = await naverAdsAPI.bidSuggestions({ start_date: start, end_date: end, campaign_id: campaignId || undefined, adgroup_id: adgroupId || undefined, keyword: search || undefined })
      const map: Record<string, BidSuggestion> = {}
      s.suggestions.forEach(x => { map[x.keyword_id] = x })
      setSuggestions(map)
      setEngine((s as any).engine ?? '')
      const sum = await naverAdsAPI.aiSummary({ performance: perf ?? undefined, keywords: perf?.keywords, suggestions: s.suggestions })
      setAiSummary(sum)
      // 기본 선택: 변경(action!=hold) 항목 자동 체크 해제 상태로 시작
      setSelected({})
    } catch (e: any) {
      setError(e?.message ?? 'AI 제안 생성에 실패했습니다.')
    } finally { setGenerating(false) }
  }

  const rows = perf?.keywords ?? []
  const selectedItems = useMemo(
    () => rows.map(r => suggestions[r.keyword_id]).filter(s => s && selected[s.keyword_id] && s.action !== 'hold'),
    [rows, suggestions, selected],
  )

  // ── 정렬 ──
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>(cache?.sort ?? { key: 'cost', dir: 'desc' })
  const sortValue = (r: typeof rows[number], key: string): number | string => {
    const s = suggestions[r.keyword_id]
    switch (key) {
      case 'keyword': return r.keyword ?? ''
      case 'campaign_name': return r.campaign_name ?? ''
      case 'adgroup_name': return r.adgroup_name ?? ''
      case 'current_bid': return r.current_bid ?? 0
      case 'impressions': return r.impressions ?? 0
      case 'clicks': return r.clicks ?? 0
      case 'ctr': return r.ctr ?? 0
      case 'avg_cpc': return r.avg_cpc ?? 0
      case 'cost': return r.cost ?? 0
      case 'conversions': return r.conversions ?? 0
      case 'cost_per_conversion': return r.cost_per_conversion ?? -1
      case 'sug_change': return s ? s.change_rate : -999
      case 'sug_recommended': return s ? s.recommended_bid : -1
      default: return 0
    }
  }
  const sortedRows = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const va = sortValue(a, sort.key), vb = sortValue(b, sort.key)
      let cmp = 0
      if (typeof va === 'string' || typeof vb === 'string') cmp = String(va).localeCompare(String(vb), 'ko')
      else cmp = (va as number) - (vb as number)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [rows, suggestions, sort])
  const onSort = (key: string) =>
    setSort(p => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  // 현재 상태를 모듈 캐시에 저장 → 키워드 상세 갔다 뒤로 와도 데이터 유지
  useEffect(() => {
    pageCache = {
      period, customStart, customEnd, campaignId, adgroupId, search,
      perf, suggestions, aiSummary, engine, dayparting, daypartText, convCheck, selected, sort,
    }
  })

  // ── 전체 선택 ──
  const selectableIds = useMemo(
    () => rows.filter(r => { const s = suggestions[r.keyword_id]; return s && s.action !== 'hold' }).map(r => r.keyword_id),
    [rows, suggestions],
  )
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected[id])
  const toggleAll = () => {
    if (allSelected) setSelected({})
    else { const next: Record<string, boolean> = {}; selectableIds.forEach(id => { next[id] = true }); setSelected(next) }
  }

  const toggle = (id: string) => setSelected(p => ({ ...p, [id]: !p[id] }))
  const holdAll = () => setSelected({})

  const confirmApply = async () => {
    try {
      const res = await naverAdsAPI.applyBidSuggestions({
        items: selectedItems.map(s => ({
          keyword_id: s.keyword_id, keyword: s.keyword, current_bid: s.current_bid,
          recommended_bid: s.recommended_bid, change_rate: s.change_rate, reason: s.reason,
          campaign_name: s.campaign_name, adgroup_name: s.adgroup_name,
        })),
        dry_run: dryRun,
        time_multiplier: applyDayparting && dayparting ? dayparting.current.multiplier : undefined,
      })
      setApplyResult(res)
      setModalOpen(false)
      if (!dryRun) { await loadPerformance() } // 반영 후 갱신
    } catch (e: any) {
      setError(e?.message ?? '적용에 실패했습니다.')
      setModalOpen(false)
    }
  }

  const kpis = perf ? [
    { label: '총 노출수', value: num(perf.impressions) },
    { label: '클릭수', value: num(perf.clicks) },
    { label: 'CTR', value: pct(perf.ctr) },
    { label: '총 광고비', value: won(perf.cost) },
    { label: '평균 CPC', value: won(perf.avg_cpc) },
    { label: '전환수', value: num(perf.conversions) },
    { label: '전환율', value: pct(perf.conversion_rate) },
    { label: 'CPA', value: won(perf.cost_per_conversion) },
  ] : []

  const TabBar = (
    <div className="flex gap-2 mb-5 border-b border-gray-200">
      {([['ads', '광고 운영'], ['cta', 'CTA 추적']] as ['ads' | 'cta', string][]).map(([v, label]) => (
        <button key={v} onClick={() => setView(v)}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${view === v ? 'border-primary-orange text-primary-orange' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
          {label}
        </button>
      ))}
    </div>
  )

  if (view === 'cta') {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">네이버 광고 관리</h1>
        {TabBar}
        <CtaTrackingPanel />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {TabBar}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">네이버 광고 관리</h1>
          <p className="text-sm text-gray-500 mt-1">AI가 입찰가 조정안을 제안하면, 관리자가 승인한 항목만 실제 계정에 반영됩니다.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      )}

      {/* 필터 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {([['today','오늘'],['yesterday','어제'],['7d','최근 7일'],['30d','최근 30일'],['custom','직접 선택']] as [Period,string][]).map(([p,label]) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${period===p ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1" />
              <span>~</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1" />
            </div>
          )}
          <span className="text-xs text-gray-400 ml-1">{start} ~ {end}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={campaignId} onChange={e => { setCampaignId(e.target.value); setAdgroupId('') }} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="">전체 캠페인</option>
            {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
          </select>
          <select value={adgroupId} onChange={e => setAdgroupId(e.target.value)} disabled={!campaignId} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm disabled:bg-gray-50">
            <option value="">전체 광고그룹</option>
            {adgroups.map(a => <option key={a.adgroup_id} value={a.adgroup_id}>{a.name}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==='Enter' && loadPerformance()} placeholder="키워드 검색" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          <button onClick={loadPerformance} className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">조회</button>
          {!campaignId && <span className="text-xs text-amber-600">전체 캠페인은 자동 조회하지 않습니다(과부하 방지). ‘조회’를 누르면 전체를 불러옵니다.</span>}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
        {(kpis.length ? kpis : Array.from({length:8}).map(()=>({label:'-',value:'-'}))).map((k, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className="text-lg font-bold text-gray-900">{loading ? '…' : k.value}</p>
          </div>
        ))}
      </div>

      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={generateSuggestions} disabled={generating || !perf?.configured}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-orange text-white hover:bg-primary-orange/90 disabled:opacity-50">
          {generating ? '생성 중…' : 'AI 입찰가 제안 생성'}
        </button>
        {engine && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">엔진: {engine === 'claude' ? 'Claude AI' : '룰 기반'}</span>}
        <button onClick={() => setModalOpen(true)} disabled={selectedItems.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          선택 항목 적용 ({selectedItems.length})
        </button>
        <button onClick={holdAll} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">전체 보류</button>
        <button onClick={checkConversions} disabled={convChecking || !perf?.configured} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50">{convChecking ? '점검 중…' : '전환 데이터 점검'}</button>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-2">
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
          모의 적용(dry-run) — 실제 미반영
        </label>
      </div>

      {/* 시간대·요일 입찰 가중치 (방문 집중 분석) */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm mb-5">
        <h2 className="font-bold text-gray-900 mb-1">시간대·요일 입찰 가중치 (방문 집중 분석)</h2>
        <p className="text-xs text-gray-500 mb-3">네이버 프리미엄 로그 분석의 시간대/요일 리포트를 그대로 붙여넣고 분석하세요. 방문·문의·체류가 높은 시간대에 입찰가를 가중합니다.</p>
        <textarea value={daypartText} onChange={e => setDaypartText(e.target.value)}
          placeholder="시간/요일별 리포트를 붙여넣기 (시간 클릭 전환 ... 형식)"
          className="w-full h-24 border border-gray-200 rounded-lg p-2 text-xs font-mono" />
        <div className="flex items-center gap-2 mt-2">
          <button onClick={analyzeDayparting} disabled={daypartLoading || !daypartText.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50">
            {daypartLoading ? '분석 중…' : '시간대 분석'}
          </button>
          {dayparting && (
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={applyDayparting} onChange={e => setApplyDayparting(e.target.checked)} />
              적용 시 현재 가중치(x{dayparting.current.multiplier}) 반영
            </label>
          )}
        </div>

        {dayparting && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 text-sm font-bold">
                현재 {dayparting.current.weekday} {dayparting.current.hour}시 · 가중치 x{dayparting.current.multiplier}
              </span>
              <span className="text-sm text-gray-600">{dayparting.summary}</span>
            </div>

            {/* 시간대 막대 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">시간대별 가중치</p>
              <div className="flex items-end gap-[2px] h-20">
                {dayparting.hours.sort((a,b)=>(a.hour??0)-(b.hour??0)).map(h => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center justify-end" title={`${h.hour}시 · 클릭 ${h.clicks} · 문의 ${h.inquiry} · x${h.multiplier}`}>
                    <div className={`w-full rounded-t ${h.multiplier >= 1 ? 'bg-blue-400' : 'bg-orange-300'} ${h.inquiry>0 ? 'ring-1 ring-green-500' : ''}`}
                      style={{ height: `${((h.multiplier - 0.7) / 0.6) * 100}%` }} />
                    <span className="text-[8px] text-gray-400 mt-0.5">{h.hour}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 요일 막대 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">요일별 가중치</p>
              <div className="flex items-end gap-2 h-16">
                {dayparting.weekdays.map(w => (
                  <div key={w.day} className="flex flex-col items-center justify-end" style={{ width: 36 }} title={`${w.day} · 클릭 ${w.clicks} · 문의 ${w.inquiry} · x${w.multiplier}`}>
                    <div className={`w-full rounded-t ${w.multiplier >= 1 ? 'bg-blue-400' : 'bg-orange-300'} ${w.inquiry>0 ? 'ring-1 ring-green-500' : ''}`}
                      style={{ height: `${((w.multiplier - 0.7) / 0.6) * 100}%` }} />
                    <span className="text-[10px] text-gray-500 mt-0.5">{w.day}</span>
                    <span className="text-[9px] text-gray-400">x{w.multiplier}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <Panel title="분석" items={dayparting.key_findings} color="text-gray-700" />
              <Panel title="권장 조치" items={dayparting.recommended_actions} color="text-blue-700" />
            </div>
            <p className="text-xs text-gray-400">초록 테두리 = 문의 발생 시간대/요일. 가중치는 선택 항목 적용 시 권장 입찰가에 곱해진 뒤 ±20% 안전범위로 클램프됩니다.</p>
          </div>
        )}

        {/* 매시간 자동 적용 설정 */}
        <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900 text-sm">매시간 자동 입찰 조정</h3>
            {cfg && (
              <span className="text-xs text-gray-500">
                현재: {cfg.enabled ? '🟢 ON' : '⚪ OFF'} · 기준 {cfg.base_keyword_count}개 · 가중치 x{cfg.current_multiplier ?? '-'}
                {cfg.last_run_at ? ` · 마지막 ${new Date(cfg.last_run_at).toLocaleString('ko-KR')}` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">현재 입찰가를 기준(가중치 1.0)으로 저장하고, 매시 정각마다 해당 시각 가중치를 곱해 자동으로 입찰가를 조정합니다. 조정 범위는 현재 선택된 캠페인/광고그룹입니다.</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm font-semibold"><input type="checkbox" checked={schedEnabled} onChange={e => setSchedEnabled(e.target.checked)} /> 자동 적용 켜기</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={schedDryRun} onChange={e => setSchedDryRun(e.target.checked)} /> 모의(dry-run)</label>
            <label className="flex items-center gap-1.5 text-sm">최소 입찰가 <input type="number" value={schedMinBid} onChange={e => setSchedMinBid(Number(e.target.value))} className="w-20 border border-gray-200 rounded px-2 py-1" /> 원</label>
            <button onClick={saveSchedule} disabled={schedSaving} className="px-4 py-2 rounded-lg text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">{schedSaving ? '저장 중…' : '설정 저장'}</button>
            <button onClick={runScheduleNow} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">지금 실행</button>
          </div>
          <p className="text-xs text-amber-600 mt-2">⚠️ 저장 시 현재 입찰가가 '기준값'으로 캡처됩니다. 시간대 가중치를 갱신하려면 위에서 다시 분석한 뒤 저장하세요. 실제 반영은 모의(dry-run) 체크 해제 시에만 됩니다.</p>
        </div>
      </div>

      {convCheck && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm mb-5">
          <h2 className="font-bold text-gray-900 mb-2">전환 데이터 점검</h2>
          {convCheck.configured === false ? (
            <p className="text-sm text-amber-700">네이버 광고 API가 설정되지 않았습니다.</p>
          ) : (
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                전환 필드 존재:{' '}
                <span className={convCheck.has_conversion_field ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                  {convCheck.has_conversion_field ? '있음 ✅' : '없음 ❌'}
                </span>
              </p>
              <p className="text-xs text-gray-500">네이버가 돌려준 필드: {(convCheck.returned_keys ?? []).join(', ') || '-'}</p>
              {convCheck.rows && convCheck.rows.length > 0 && (
                <pre className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs overflow-x-auto">{JSON.stringify(convCheck.rows[0], null, 2)}</pre>
              )}
              <p className="text-xs text-gray-400">{convCheck.note}</p>
            </div>
          )}
        </div>
      )}

      {/* AI 제안 패널 */}
      {aiSummary && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm mb-5">
          <h2 className="font-bold text-gray-900 mb-2">이번 기간 광고 요약</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{aiSummary.summary}</p>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <Panel title="핵심 지표" items={aiSummary.key_findings} color="text-gray-700" />
            <Panel title="권장 조치" items={aiSummary.recommended_actions} color="text-blue-700" />
            <Panel title="주의" items={aiSummary.warnings} color="text-orange-700" />
          </div>
        </div>
      )}

      {/* 키워드 테이블 */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {([
                ['키워드','keyword'],['캠페인','campaign_name'],['광고그룹','adgroup_name'],
                ['현재 입찰가','current_bid'],['노출','impressions'],['클릭','clicks'],
                ['CTR','ctr'],['CPC','avg_cpc'],['비용','cost'],['전환','conversions'],
                ['CPA','cost_per_conversion'],['AI 제안','sug_change'],['권장 입찰가','sug_recommended'],
                ['예상 영향',''],
              ] as [string,string][]).map(([h,key]) => (
                <th key={h}
                    onClick={key ? () => onSort(key) : undefined}
                    className={`px-3 py-2.5 text-left font-semibold whitespace-nowrap ${key ? 'cursor-pointer select-none hover:text-gray-800' : ''}`}>
                  {h}{key && sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={selectableIds.length === 0} />
                  <span>전체</span>
                </label>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={15} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : '데이터가 없습니다. 기간/필터를 확인하세요.'}</td></tr>
            )}
            {sortedRows.map(r => {
              const s = suggestions[r.keyword_id]
              const sev = s?.severity === 'high'
              return (
                <tr key={r.keyword_id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    <button onClick={() => openKeyword(r)} title="키워드 상세·시간별 입찰가 설정" className="text-gray-900 hover:text-primary-orange hover:underline">
                      {r.keyword}
                    </button>
                    {r.tier ? <span className="ml-1.5 text-[10px] font-bold text-gray-400">T{r.tier}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.campaign_name ?? '-'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.adgroup_name ?? '-'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{won(r.current_bid)}</td>
                  <td className="px-3 py-2.5">{num(r.impressions)}</td>
                  <td className="px-3 py-2.5">{num(r.clicks)}</td>
                  <td className="px-3 py-2.5">{pct(r.ctr)}</td>
                  <td className="px-3 py-2.5">{won(r.avg_cpc)}</td>
                  <td className="px-3 py-2.5">{won(r.cost)}</td>
                  <td className="px-3 py-2.5">{num(r.conversions)}</td>
                  <td className="px-3 py-2.5">{won(r.cost_per_conversion)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {s ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${actionStyle[s.action]} ${sev ? 'ring-1 ring-red-300' : ''}`} title={s.reason}>
                        {actionLabel[s.action]}{s.action!=='hold' ? ` ${(s.change_rate*100).toFixed(0)}%` : ''}
                      </span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold">{s ? won(s.recommended_bid) : '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[180px] truncate" title={s?.expected_effect}>{s?.expected_effect ?? '-'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {s && s.action !== 'hold' ? (
                      <input type="checkbox" checked={!!selected[r.keyword_id]} onChange={() => toggle(r.keyword_id)} />
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 적용 결과 */}
      {applyResult && (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold mb-2">
            적용 결과 {applyResult.dry_run ? '(모의 적용 — 실제 미반영)' : ''} · 성공 {applyResult.applied} · 실패 {applyResult.failed}
          </p>
          <div className="space-y-1 text-sm">
            {applyResult.results.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`inline-block w-14 text-xs font-bold ${r.status==='applied'?'text-green-600':r.status==='failed'?'text-red-600':r.status==='dry_run'?'text-gray-500':'text-amber-600'}`}>{r.status}</span>
                <span className="text-gray-800">{r.keyword}</span>
                <span className="text-gray-400">{won(r.old_bid)} → {won(r.new_bid)}</span>
                <span className="text-gray-400 text-xs">{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">입찰가 변경 확인</h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              선택한 <b>{selectedItems.length}개</b> 키워드의 입찰가를 변경합니다.{' '}
              {dryRun
                ? '현재 모의 적용(dry-run) 모드로 실제 계정에는 반영되지 않습니다.'
                : '실제 네이버 광고 계정에 반영됩니다.'} 계속하시겠습니까?
            </p>
            <div className="max-h-40 overflow-y-auto text-sm mb-4 space-y-1">
              {selectedItems.map(s => (
                <div key={s.keyword_id} className="flex justify-between"><span className="text-gray-700">{s.keyword}</span><span className="text-gray-500">{won(s.current_bid)} → {won(s.recommended_bid)} ({(s.change_rate*100).toFixed(0)}%)</span></div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">취소</button>
              <button onClick={confirmApply} className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${dryRun ? 'bg-gray-700 hover:bg-gray-800' : 'bg-red-600 hover:bg-red-700'}`}>
                {dryRun ? '모의 적용' : '실제 반영'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Panel({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
      <p className="text-xs font-bold text-gray-500 mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => <li key={i} className={`text-xs leading-relaxed ${color}`}>· {it}</li>)}
        {items.length === 0 && <li className="text-xs text-gray-400">-</li>}
      </ul>
    </div>
  )
}
