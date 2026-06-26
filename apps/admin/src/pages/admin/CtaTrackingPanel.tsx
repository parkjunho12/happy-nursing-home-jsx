import { useEffect, useMemo, useState } from 'react'
import { naverAdsAPI, type CtaDashboard } from '@/api/naverAdsClient'

type Period = 'today' | '7d' | '30d' | 'all'
const fmt = (d: Date) => d.toISOString().slice(0, 10)
function range(p: Period): { start_date?: string; end_date?: string } {
  const today = new Date()
  const d = (n: number) => { const x = new Date(today); x.setDate(x.getDate() - n); return x }
  if (p === 'today') return { start_date: fmt(today), end_date: fmt(today) }
  if (p === '7d') return { start_date: fmt(d(6)), end_date: fmt(today) }
  if (p === '30d') return { start_date: fmt(d(29)), end_date: fmt(today) }
  return {}
}

const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-')

const ETLABEL: Record<string, string> = {
  phone_click: '전화 클릭', consultation_click: '상담 신청 클릭', consultation_submit: '상담 폼 제출', kakao_click: '카카오 클릭',
}
const ETBADGE: Record<string, string> = {
  phone_click: 'bg-orange-50 text-orange-700 ring-orange-200',
  consultation_click: 'bg-blue-50 text-blue-700 ring-blue-200',
  consultation_submit: 'bg-green-50 text-green-700 ring-green-200',
  kakao_click: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
}

/* ───────────────── 공용 정렬·페이지네이션 테이블 ───────────────── */
interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  sortable?: boolean
  cell: (r: T) => React.ReactNode
  sort?: (r: T) => number | string
}
function Num({ v, strong }: { v: number; strong?: boolean }) {
  return <span className={`tabular-nums ${v === 0 ? 'text-gray-300' : strong ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{v.toLocaleString()}</span>
}
function SortIcon({ state }: { state: 'asc' | 'desc' | null }) {
  if (state === null) return <span className="text-gray-300">↕</span>
  return <span className="text-primary-orange">{state === 'asc' ? '▲' : '▼'}</span>
}
function DataTable<T>({ columns, rows, empty, initialSortKey, loading }: {
  columns: Column<T>[]; rows: T[]; empty: string; initialSortKey?: string; loading?: boolean
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [pageSize, setPageSize] = useState<number>(25)
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sortKey)
    if (!col?.sort) return rows
    const arr = [...rows]
    arr.sort((a, b) => {
      const av = col.sort!(a), bv = col.sort!(b)
      const cmp = (typeof av === 'number' && typeof bv === 'number')
        ? av - bv : String(av).localeCompare(String(bv), 'ko')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [rows, sortKey, sortDir, columns])

  useEffect(() => { setPage(1) }, [rows, sortKey, sortDir, pageSize])

  const total = sorted.length
  const size = pageSize === 0 ? (total || 1) : pageSize
  const pages = Math.max(1, Math.ceil(total / size))
  const cur = Math.min(page, pages)
  const start = (cur - 1) * size
  const view = sorted.slice(start, start + size)

  const onSort = (c: Column<T>) => {
    if (!c.sortable) return
    if (sortKey === c.key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(c.key); setSortDir(c.align === 'right' ? 'desc' : 'asc') }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {columns.map(c => (
                <th key={c.key}
                  onClick={() => onSort(c)}
                  className={`px-3 py-2.5 font-semibold whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.sortable ? 'cursor-pointer select-none hover:text-gray-800' : ''}`}>
                  <span className="inline-flex items-center gap-1">
                    {c.align === 'right' && c.sortable && <SortIcon state={sortKey === c.key ? sortDir : null} />}
                    {c.header}
                    {c.align !== 'right' && c.sortable && <SortIcon state={sortKey === c.key ? sortDir : null} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : empty}</td></tr>
            )}
            {view.map((r, i) => (
              <tr key={start + i} className="border-t border-gray-50 hover:bg-gray-50/60">
                {columns.map(c => (
                  <td key={c.key} className={`px-3 py-2.5 whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* 푸터: 건수 + 페이지 크기 + 페이지 이동 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-3 py-2.5 text-xs text-gray-500">
        <div>
          총 <b className="text-gray-700">{total.toLocaleString()}</b>건
          {total > 0 && <span className="text-gray-400"> · {start + 1}–{Math.min(start + size, total)} 표시</span>}
        </div>
        <div className="flex items-center gap-2">
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1">
            <option value={10}>10개씩</option>
            <option value={25}>25개씩</option>
            <option value={50}>50개씩</option>
            <option value={0}>전체</option>
          </select>
          <div className="flex items-center gap-1">
            <button disabled={cur <= 1} onClick={() => setPage(cur - 1)}
              className="px-2 py-1 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50">이전</button>
            <span className="px-1 tabular-nums">{cur} / {pages}</span>
            <button disabled={cur >= pages} onClick={() => setPage(cur + 1)}
              className="px-2 py-1 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50">다음</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CtaTrackingPanel() {
  const [period, setPeriod] = useState<Period>('30d')
  const [page, setPage] = useState('')
  const [eventType, setEventType] = useState('')
  const [campaign, setCampaign] = useState('')
  const [keyword, setKeyword] = useState('')
  const [component, setComponent] = useState('')
  const [source, setSource] = useState<'ad' | 'all' | 'organic'>('ad')
  const [platform, setPlatform] = useState<'' | 'pc' | 'mobile'>('')
  const [data, setData] = useState<CtaDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const params = useMemo(() => ({
    ...range(period),
    page: page || undefined, event_type: eventType || undefined,
    campaign: campaign || undefined, keyword: keyword || undefined, component: component || undefined,
    source, platform: platform || undefined,
  }), [period, page, eventType, campaign, keyword, component, source, platform])

  const load = async () => {
    setLoading(true); setError('')
    try { setData(await naverAdsAPI.ctaEvents(params)) }
    catch (e: any) { setError(e?.message ?? '불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [period, page, eventType, campaign, keyword, component, source, platform])

  const test = async (et: string) => {
    try { await naverAdsAPI.sendTestCtaEvent(et); setTimeout(load, 400) }
    catch (e: any) { setError(e?.message ?? '테스트 전송 실패') }
  }

  const kpi = data?.kpi
  const kpis = [
    { label: '총 CTA 클릭', value: kpi?.total ?? 0, color: 'text-gray-900' },
    { label: '전화 클릭', value: kpi?.phone_click ?? 0, color: 'text-orange-600' },
    { label: '상담 신청 클릭', value: kpi?.consultation_click ?? 0, color: 'text-blue-600' },
    { label: '상담 폼 제출', value: kpi?.consultation_submit ?? 0, color: 'text-green-600' },
    { label: '카카오톡 클릭', value: kpi?.kakao_click ?? 0, color: 'text-yellow-600' },
  ]
  const f = data?.filters

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">CTA 클릭을 모두 수집하되 기본은 <b>광고 유입만</b> 표시합니다. 표 헤더를 클릭하면 정렬되고, 하단에서 페이지를 넘길 수 있습니다.</p>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      {data?.channel_summary && (
        <div className="mb-4 text-sm text-gray-600">
          현재 기간 분포 ·{' '}
          <b className="text-blue-600">네이버 광고 {data.channel_summary.naver_ad.toLocaleString()}건</b>
          {' ('}
          <span className="text-gray-700">PC {(data.channel_summary.naver_ad_pc ?? 0).toLocaleString()}</span>{' · '}
          <span className="text-gray-700">모바일 {(data.channel_summary.naver_ad_mobile ?? 0).toLocaleString()}</span>
          {(data.channel_summary.naver_ad_etc ?? 0) > 0 ? <>{' · '}<span className="text-gray-400">기타 {(data.channel_summary.naver_ad_etc ?? 0).toLocaleString()}</span></> : null}
          {') / '}
          <b className="text-gray-700">비광고 {data.channel_summary.organic.toLocaleString()}건</b>{' / '}
          전체 {data.channel_summary.total.toLocaleString()}건
        </div>
      )}

      {/* 필터 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-5 flex flex-wrap items-center gap-2">
        {(['today', '7d', '30d', 'all'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${period === p ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {p === 'today' ? '오늘' : p === '7d' ? '7일' : p === '30d' ? '30일' : '전체'}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        {(['ad', 'all', 'organic'] as const).map(sv => (
          <button key={sv} onClick={() => setSource(sv)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${source === sv ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {sv === 'ad' ? '광고 유입만' : sv === 'all' ? '전체' : '비광고'}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        {([['', '전체기기'], ['pc', 'PC'], ['mobile', '모바일']] as const).map(([pv, label]) => (
          <button key={pv} onClick={() => setPlatform(pv)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${platform === pv ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
        <select value={page} onChange={e => setPage(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">전체 페이지</option>
          {f?.pages.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={eventType} onChange={e => setEventType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">전체 이벤트</option>
          {(data?.event_types ?? []).map(et => <option key={et} value={et}>{ETLABEL[et] ?? et}</option>)}
        </select>
        <select value={campaign} onChange={e => setCampaign(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">전체 캠페인</option>
          {f?.campaigns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={component} onChange={e => setComponent(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">전체 컴포넌트</option>
          {f?.components.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="검색어/키워드" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36" />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.color}`}>{loading ? '…' : k.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* 퍼널 + 전화 시간대 */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <FunnelView funnel={data?.funnel} loading={loading} />
        <HourlyChart hourly={data?.phone_hourly} loading={loading} />
      </div>

      {/* 표0: 최근 클릭 로그 (개별 시간) */}
      <Section title="최근 클릭 로그 (클릭 시간)">
        <DataTable
          loading={loading}
          rows={data?.recent ?? []}
          initialSortKey="time"
          empty="클릭 기록이 없습니다."
          columns={[
            { key: 'time', header: '클릭 시간', sortable: true, sort: r => r.created_at || '', cell: r => <span className="font-semibold text-gray-900 tabular-nums">{fmtDateTime(r.created_at)}</span> },
            { key: 'event', header: '이벤트', sortable: true, sort: r => r.event_type, cell: r => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${ETBADGE[r.event_type] ?? 'bg-gray-50 text-gray-600 ring-gray-200'}`}>{ETLABEL[r.event_type] ?? r.event_type}</span> },
            { key: 'page', header: '페이지', sortable: true, sort: r => r.page_path || '', cell: r => <span className="text-gray-600">{r.page_path || '-'}</span> },
            { key: 'component', header: '컴포넌트', sortable: true, sort: r => r.component_name || '', cell: r => <span className="text-gray-600">{r.component_name || '-'}{r.section_name ? <span className="text-gray-400"> · {r.section_name}</span> : null}</span> },
            { key: 'keyword', header: '검색어', sortable: true, sort: r => r.keyword || '', cell: r => <span className="text-gray-500">{r.keyword || '-'}</span> },
            { key: 'device', header: '기기', sortable: true, sort: r => r.platform || r.device_type || '', cell: r => {
              const plat = r.platform === 'pc' ? 'PC' : r.platform === 'mobile' ? '모바일' : null
              return plat
                ? <span className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-bold ${plat === 'PC' ? 'bg-slate-100 text-slate-700' : 'bg-violet-50 text-violet-700'}`}>{plat}</span>
                : <span className="text-gray-400">{r.device_type || '-'}</span>
            } },
          ]}
        />
      </Section>

      {/* 표1: 페이지별 */}
      <Section title="페이지별 전환 CTA">
        <DataTable
          loading={loading}
          rows={data?.by_page ?? []}
          initialSortKey="total"
          empty="데이터가 없습니다."
          columns={[
            { key: 'page', header: '페이지', sortable: true, sort: r => r.page_title || r.page_path, cell: r => <span className="font-semibold text-gray-900">{r.page_title || r.page_path}</span> },
            { key: 'phone_click', header: '전화', align: 'right', sortable: true, sort: r => r.phone_click, cell: r => <Num v={r.phone_click} /> },
            { key: 'consultation_click', header: '상담클릭', align: 'right', sortable: true, sort: r => r.consultation_click, cell: r => <Num v={r.consultation_click} /> },
            { key: 'consultation_submit', header: '폼제출', align: 'right', sortable: true, sort: r => r.consultation_submit, cell: r => <Num v={r.consultation_submit} /> },
            { key: 'kakao_click', header: '카카오', align: 'right', sortable: true, sort: r => r.kakao_click, cell: r => <Num v={r.kakao_click} /> },
            { key: 'total', header: '총 CTA', align: 'right', sortable: true, sort: r => r.total, cell: r => <Num v={r.total} strong /> },
          ]}
        />
      </Section>

      {/* 표2: 컴포넌트별 */}
      <Section title="컴포넌트별 CTA (어떤 버튼이 눌리나)">
        <DataTable
          loading={loading}
          rows={data?.by_component ?? []}
          initialSortKey="count"
          empty="데이터가 없습니다."
          columns={[
            { key: 'component_name', header: '컴포넌트', sortable: true, sort: r => r.component_name, cell: r => <span className="font-semibold text-gray-900">{r.component_name}</span> },
            { key: 'section_name', header: '섹션', sortable: true, sort: r => r.section_name, cell: r => <span className="text-gray-500">{r.section_name || '-'}</span> },
            { key: 'button_label', header: '버튼', cell: r => <span className="text-gray-600">{r.button_label || '-'}</span> },
            { key: 'event_type', header: '이벤트', sortable: true, sort: r => r.event_type, cell: r => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${ETBADGE[r.event_type] ?? 'bg-gray-50 text-gray-600 ring-gray-200'}`}>{ETLABEL[r.event_type] ?? r.event_type}</span> },
            { key: 'count', header: '클릭 수', align: 'right', sortable: true, sort: r => r.count, cell: r => <Num v={r.count} strong /> },
            { key: 'ratio', header: '비율', align: 'right', sortable: true, sort: r => r.ratio, cell: r => (
              <div className="flex items-center justify-end gap-2">
                <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-orange" style={{ width: `${Math.min(100, r.ratio)}%` }} />
                </div>
                <span className="tabular-nums text-gray-600 w-12 text-right">{r.ratio}%</span>
              </div>
            ) },
          ]}
        />
      </Section>

      {/* 표3: 키워드별 */}
      <Section title="검색어·키워드별 CTA (네이버 광고)">
        <DataTable
          loading={loading}
          rows={data?.by_keyword ?? []}
          initialSortKey="total"
          empty="데이터가 없습니다."
          columns={[
            { key: 'keyword', header: '검색어', sortable: true, sort: r => r.keyword, cell: r => <span className="font-semibold text-gray-900">{r.keyword}</span> },
            { key: 'keyword_text', header: '등록키워드', sortable: true, sort: r => r.keyword_text || '', cell: r => <span className="text-gray-600">{r.keyword_text || '-'}</span> },
            { key: 'rank_best', header: '최고순위', align: 'right', sortable: true, sort: r => (r.rank_best ?? 9999), cell: r => r.rank_best != null
              ? <span className="inline-flex rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-bold text-indigo-700 tabular-nums">{r.rank_best}위</span>
              : <span className="text-gray-300">-</span> },
            { key: 'media', header: '매체', sortable: true, sort: r => r.media || '', cell: r => <span className="text-gray-500 tabular-nums">{r.media || '-'}</span> },
            { key: 'page_path', header: '페이지', sortable: true, sort: r => r.page_path, cell: r => <span className="text-gray-500">{r.page_path}</span> },
            { key: 'phone_click', header: '전화', align: 'right', sortable: true, sort: r => r.phone_click, cell: r => <Num v={r.phone_click} /> },
            { key: 'consultation_click', header: '상담클릭', align: 'right', sortable: true, sort: r => r.consultation_click, cell: r => <Num v={r.consultation_click} /> },
            { key: 'kakao_click', header: '카카오', align: 'right', sortable: true, sort: r => r.kakao_click, cell: r => <Num v={r.kakao_click} /> },
            { key: 'total', header: '총 CTA', align: 'right', sortable: true, sort: r => r.total, cell: r => <Num v={r.total} strong /> },
          ]}
        />
      </Section>

      {/* 테스트 */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-gray-400">테스트 이벤트:</span>
        <button onClick={() => test('phone_click')} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">phone_click</button>
        <button onClick={() => test('kakao_click')} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">kakao_click</button>
        <button onClick={() => test('consultation_click')} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">consultation_click</button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      {children}
    </div>
  )
}

/* ─────────────────── 퍼널 (광고 유입 → 전환) ─────────────────── */
function FunnelView({ funnel, loading }: { funnel?: CtaDashboard['funnel']; loading?: boolean }) {
  const f = funnel
  const stages = [
    { key: 'visits', label: '광고 유입(랜딩)', value: f?.visits ?? 0, rate: f?.visits ? 100 : 0, color: 'bg-orange-500' },
    { key: 'any', label: 'CTA 클릭(전체)', value: f?.any_cta ?? 0, rate: f?.any_cta_rate ?? 0, color: 'bg-indigo-500' },
    { key: 'phone', label: '전화 클릭', value: f?.phone_click ?? 0, rate: f?.phone_rate ?? 0, color: 'bg-blue-600', primary: true },
    { key: 'cclick', label: '상담 신청 클릭', value: f?.consultation_click ?? 0, rate: f?.consultation_click_rate ?? 0, color: 'bg-sky-500' },
    { key: 'csubmit', label: '상담 폼 제출', value: f?.consultation_submit ?? 0, rate: f?.consultation_submit_rate ?? 0, color: 'bg-green-600' },
    { key: 'kakao', label: '카카오 클릭', value: f?.kakao_click ?? 0, rate: f?.kakao_rate ?? 0, color: 'bg-amber-500' },
  ]
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">광고 유입 → 전환 퍼널</h3>
          <p className="text-xs text-gray-400 mt-0.5">세션 기준 · 광고 유입(네이버)만</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">전화 전환율</p>
          <p className="text-3xl font-bold text-blue-600 tabular-nums leading-none">{loading ? '…' : `${f?.phone_rate ?? 0}%`}</p>
          <p className="text-[11px] text-gray-400 mt-1 tabular-nums">{(f?.visits ?? 0).toLocaleString()}명 → {(f?.phone_click ?? 0).toLocaleString()}명</p>
        </div>
      </div>

      <div className="space-y-2">
        {stages.map(s => (
          <div key={s.key} className="flex items-center gap-3">
            <span className={`w-24 shrink-0 text-xs ${s.primary ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{s.label}</span>
            <div className="flex-1 h-6 rounded-md bg-gray-100 overflow-hidden">
              <div className={`h-full ${s.color} rounded-md transition-all flex items-center`} style={{ width: `${Math.max(s.rate, s.value > 0 ? 4 : 0)}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-gray-600">
              <b className="text-gray-900">{s.value.toLocaleString()}</b> · {s.rate}%
            </span>
          </div>
        ))}
      </div>

      {f && !f.has_landing && (
        <p className="mt-3 text-[11px] text-amber-600 leading-relaxed">
          ※ 아직 랜딩 데이터가 없어 분모(유입수)를 ‘CTA를 누른 세션 수’로 근사했습니다. 광고 URL 재방문이 쌓이면 정확한 유입수 기준으로 자동 보정됩니다.
        </p>
      )}
    </div>
  )
}

/* ─────────────────── 전화 클릭 시간대 (24h) ─────────────────── */
function HourlyChart({ hourly, loading }: { hourly?: number[]; loading?: boolean }) {
  const data = hourly && hourly.length === 24 ? hourly : new Array(24).fill(0)
  const max = Math.max(...data, 1)
  const total = data.reduce((a, b) => a + b, 0)
  const peakH = data.indexOf(Math.max(...data))
  const peakV = data[peakH] ?? 0

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">전화 클릭 시간대</h3>
          <p className="text-xs text-gray-400 mt-0.5">광고 유입 · KST 기준</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">피크 시간</p>
          <p className="text-xl font-bold text-orange-600 tabular-nums leading-none">{total > 0 ? `${peakH}시` : '-'}</p>
          <p className="text-[11px] text-gray-400 mt-1 tabular-nums">{total > 0 ? `${peakV}건` : '데이터 없음'}</p>
        </div>
      </div>

      <div className="flex items-end gap-[2px] h-28">
        {data.map((v, h) => (
          <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}시 · ${v}건`}>
            <div
              className={`w-full rounded-t ${v > 0 && h === peakH ? 'bg-orange-500' : v > 0 ? 'bg-blue-500' : 'bg-gray-100'}`}
              style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 4 : 2 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-gray-400 tabular-nums px-[1px]">
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => <span key={h}>{h}</span>)}
        <span>23</span>
      </div>
      <p className="mt-2 text-[11px] text-gray-400 tabular-nums">총 전화 클릭 {loading ? '…' : `${total}건`}</p>
    </div>
  )
}
