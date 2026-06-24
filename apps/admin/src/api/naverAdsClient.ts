import { apiClient } from './client'

const BASE = '/api/v1/admin/naver-ads'

function unwrap<T>(res: any): T {
  if (res?.data?.success) return res.data.data
  throw new Error(res?.data?.message ?? res?.data?.error ?? 'API error')
}

export type Tier = 1 | 2 | 3 | null

export interface KeywordPerf {
  keyword_id: string
  keyword: string
  current_bid: number
  status?: string
  campaign_name?: string | null
  adgroup_name?: string | null
  adgroup_id?: string | null
  impressions: number
  clicks: number
  ctr: number
  avg_cpc: number
  cost: number
  conversions: number
  conversion_rate: number
  cost_per_conversion: number | null
  tier?: Tier
}

export interface PerformanceData {
  impressions: number
  clicks: number
  cost: number
  ctr: number
  avg_cpc: number
  conversions: number
  conversion_rate: number
  cost_per_conversion: number | null
  keywords: KeywordPerf[]
  configured: boolean
}

export interface BidSuggestion {
  keyword_id: string
  keyword: string
  current_bid: number
  recommended_bid: number
  change_rate: number
  action: 'increase' | 'decrease' | 'hold'
  severity: 'high' | 'medium' | 'low'
  reason: string
  expected_effect: string
  needs_creative_review: boolean
  source?: string
  tier?: Tier
  campaign_name?: string | null
  adgroup_name?: string | null
}

export interface AiSummary {
  summary: string
  key_findings: string[]
  recommended_actions: string[]
  warnings: string[]
}

export interface DaypartBucket {
  hour?: number
  day?: string
  clicks: number
  bounce: number
  inquiry: number
  dwell: number
  multiplier: number
}
export interface DaypartingPlan {
  hours: DaypartBucket[]
  weekdays: DaypartBucket[]
  current: { hour: number; weekday: string; hour_multiplier: number; weekday_multiplier: number; multiplier: number }
  summary: string
  key_findings: string[]
  recommended_actions: string[]
}

export interface KeywordDetail {
  keyword_id: string
  keyword: string | null
  current_bid: number
  campaign_name?: string | null
  adgroup_name?: string | null
  adgroup_id?: string | null
  tier?: 1 | 2 | 3 | null
  configured: boolean
  schedule: { exists: boolean; enabled: boolean; hourly_bids: Record<string, number> }
}

export interface KeywordSchedule {
  keyword_id: string
  keyword: string
  campaign_name?: string | null
  adgroup_name?: string | null
  adgroup_id?: string | null
  current_bid: number
  enabled: boolean
  hourly_bids: Record<string, number>
}

export interface DaypartingConfig {
  enabled: boolean
  campaign_id?: string | null
  adgroup_id?: string | null
  hour_multipliers: Record<string, number>
  weekday_multipliers: Record<string, number>
  dry_run: boolean
  min_bid: number
  base_keyword_count: number
  last_run_at?: string | null
  last_run_summary?: any
  current_multiplier?: number
}

export interface ApplyResultItem {
  keyword_id: string
  keyword: string
  old_bid: number
  new_bid: number
  status: 'applied' | 'failed' | 'dry_run' | 'skipped'
  message: string
}

export interface ApplyResult {
  dry_run: boolean
  applied: number
  failed: number
  results: ApplyResultItem[]
}

export interface Campaign { campaign_id: string; name: string; campaign_type?: string; status?: string }
export interface AdGroup { adgroup_id: string; campaign_id?: string; name: string; status?: string }

export const naverAdsAPI = {
  campaigns: () =>
    apiClient.get(`${BASE}/campaigns`).then(unwrap<{ configured: boolean; campaigns: Campaign[] }>),

  adgroups: (campaignId?: string) =>
    apiClient
      .get(`${BASE}/adgroups`, { params: campaignId ? { campaign_id: campaignId } : {} })
      .then(unwrap<{ configured: boolean; adgroups: AdGroup[] }>),

  performance: (params: {
    start_date: string
    end_date: string
    campaign_id?: string
    adgroup_id?: string
    keyword?: string
  }) => apiClient.get(`${BASE}/performance`, { params }).then(unwrap<PerformanceData>),

  bidSuggestions: (body: {
    start_date: string
    end_date: string
    campaign_id?: string
    adgroup_id?: string
    keyword?: string
  }) =>
    apiClient
      .post(`${BASE}/bid-suggestions`, body)
      .then(unwrap<{ configured: boolean; suggestions: BidSuggestion[]; engine?: string; generated_at: string }>),

  applyBidSuggestions: (body: {
    items: Array<Partial<BidSuggestion> & { keyword_id: string; keyword: string; current_bid: number; recommended_bid: number }>
    dry_run?: boolean
    time_multiplier?: number
  }) => apiClient.post(`${BASE}/apply-bid-suggestions`, body).then(unwrap<ApplyResult>),

  daypartingPlan: (raw_text: string) =>
    apiClient.post(`${BASE}/dayparting-plan`, { raw_text }).then(unwrap<DaypartingPlan>),

  getDaypartingConfig: () =>
    apiClient.get(`${BASE}/dayparting-config`).then(unwrap<DaypartingConfig>),

  saveDaypartingConfig: (body: {
    enabled: boolean
    campaign_id?: string | null
    adgroup_id?: string | null
    hour_multipliers?: Record<string, number>
    weekday_multipliers?: Record<string, number>
    dry_run: boolean
    min_bid: number
    recapture_base?: boolean
  }) => apiClient.post(`${BASE}/dayparting-config`, body).then(unwrap<DaypartingConfig>),

  daypartingRunNow: () =>
    apiClient.post(`${BASE}/dayparting-run-now`).then(unwrap<any>),

  keywordDetail: (keyword_id: string) =>
    apiClient.get(`${BASE}/keyword-detail/${encodeURIComponent(keyword_id)}`).then(unwrap<KeywordDetail>),

  getKeywordSchedule: (keyword_id: string) =>
    apiClient.get(`${BASE}/keyword-schedule/${encodeURIComponent(keyword_id)}`).then(unwrap<{ exists: boolean; enabled: boolean; hourly_bids: Record<string, number> }>),

  listKeywordSchedules: (params: { campaign_id?: string; adgroup_id?: string }) =>
    apiClient.get(`${BASE}/keyword-schedules`, { params }).then(unwrap<{ configured: boolean; keywords: KeywordSchedule[] }>),

  saveKeywordSchedules: (items: Array<{
    keyword_id: string; keyword?: string; campaign_name?: string | null; adgroup_name?: string | null;
    adgroup_id?: string | null; enabled: boolean; hourly_bids: Record<string, number>
  }>) => apiClient.post(`${BASE}/keyword-schedules`, { items }).then(unwrap<{ saved: number }>),

  aiSummary: (body: {
    performance?: Partial<PerformanceData>
    keywords?: KeywordPerf[]
    suggestions?: BidSuggestion[]
    use_llm?: boolean
  }) => apiClient.post(`${BASE}/ai-summary`, body).then(unwrap<AiSummary>),

  changeLogs: (limit = 50) =>
    apiClient.get(`${BASE}/change-logs`, { params: { limit } }).then(unwrap<any[]>),

  statsDebug: (params: { start_date: string; end_date: string; limit?: number }) =>
    apiClient.get(`${BASE}/stats-debug`, { params }).then(unwrap<{
      configured: boolean
      requested_fields?: string[]
      returned_keys?: string[]
      has_conversion_field?: boolean
      sample_count?: number
      rows?: any[]
      note?: string
    }>),
}
