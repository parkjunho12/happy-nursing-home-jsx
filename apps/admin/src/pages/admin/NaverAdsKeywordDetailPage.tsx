import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { naverAdsAPI, type KeywordDetail } from '@/api/naverAdsClient'

const won = (n: number | null | undefined) => (n == null ? '-' : `${Math.round(n).toLocaleString()}원`)

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
    </div>
  )
}
