import { useEffect, useMemo, useState } from 'react'
import { naverAdsAPI } from '@/api/naverAdsClient'

const won = (n: number | null | undefined) => (n == null ? '-' : `${Math.round(n).toLocaleString()}원`)
const fmtDT = (s?: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-')

const SRC: Record<string, string> = { dayparting: '데이파팅', keyword_schedule: '키워드 시간표', bid_override: '임시 변경', rule_engine: '룰 엔진' }
const SRC_CLS: Record<string, string> = {
  dayparting: 'bg-indigo-50 text-indigo-700', keyword_schedule: 'bg-sky-50 text-sky-700',
  bid_override: 'bg-amber-50 text-amber-700', rule_engine: 'bg-gray-100 text-gray-600',
}
const STATUS: Record<string, { label: string; cls: string }> = {
  applied: { label: '적용됨', cls: 'bg-green-50 text-green-700' },
  dry_run: { label: '모의', cls: 'bg-gray-100 text-gray-500' },
  failed: { label: '실패', cls: 'bg-red-50 text-red-600' },
  pending: { label: '대기', cls: 'bg-amber-50 text-amber-700' },
  skipped: { label: '건너뜀', cls: 'bg-gray-100 text-gray-400' },
}

export default function BidLogsPanel() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [src, setSrc] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(200)

  const load = async () => {
    setLoading(true); setError('')
    try {
      setRows(await naverAdsAPI.bidLogs({
        limit, suggested_by: src || undefined, status: status || undefined, q: q.trim() || undefined,
      }))
    } catch (e: any) { setError(e?.message ?? '로그를 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [src, status, limit])

  const counts = useMemo(() => {
    const c = { applied: 0, failed: 0, dry_run: 0 }
    rows.forEach(r => { if (r.status in c) (c as any)[r.status]++ })
    return c
  }, [rows])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">입찰 변경 로그</h1>
      <p className="text-sm text-gray-500 mb-4">모든 자동/수동 입찰가 변경 기록입니다. 어떤 자동화(출처)가 언제 어떻게 바꿨는지 확인하세요.</p>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Kpi label="적용됨" value={counts.applied} color="text-green-600" />
        <Kpi label="실패" value={counts.failed} color={counts.failed > 0 ? 'text-red-600' : 'text-gray-900'} />
        <Kpi label="모의(dry-run)" value={counts.dry_run} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-4 flex flex-wrap items-center gap-2">
        <select value={src} onChange={e => setSrc(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">전체 출처</option>
          <option value="dayparting">데이파팅</option>
          <option value="keyword_schedule">키워드 시간표</option>
          <option value="bid_override">임시 변경</option>
          <option value="rule_engine">룰 엔진</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">전체 상태</option>
          <option value="applied">적용됨</option>
          <option value="failed">실패</option>
          <option value="dry_run">모의</option>
          <option value="skipped">건너뜀</option>
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }}
          placeholder="키워드/캠페인 검색 후 Enter" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56" />
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          {[100, 200, 500, 1000].map(n => <option key={n} value={n}>최근 {n}건</option>)}
        </select>
        <button onClick={load} className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">새로고침</button>
        <span className="text-xs text-gray-400 ml-auto">{rows.length.toLocaleString()}건</span>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['시각', '출처', '키워드', '캠페인 · 광고그룹', '변경', '사유', '상태'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : '로그가 없습니다.'}</td></tr>
            )}
            {rows.map(r => {
              const st = STATUS[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-2.5 tabular-nums text-gray-600 whitespace-nowrap">{fmtDT(r.applied_at || r.created_at)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${SRC_CLS[r.suggested_by] ?? 'bg-gray-100 text-gray-600'}`}>{SRC[r.suggested_by] ?? r.suggested_by ?? '-'}</span></td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900 max-w-[180px] truncate" title={r.keyword ?? ''}>{r.keyword || '-'}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[200px] truncate" title={`${r.campaign_name ?? ''} · ${r.adgroup_name ?? ''}`}>{[r.campaign_name, r.adgroup_name].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="px-3 py-2.5 tabular-nums text-gray-700 whitespace-nowrap">{won(r.old_bid)} → <b>{won(r.new_bid)}</b></td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[220px] truncate" title={r.reason ?? ''}>{r.reason || '-'}</td>
                  <td className="px-3 py-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</p>
    </div>
  )
}
