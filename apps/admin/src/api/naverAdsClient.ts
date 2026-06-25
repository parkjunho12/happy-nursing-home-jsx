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

export interface CtaDashboard {
  channel_summary?: { naver_ad: number; naver_ad_pc?: number; naver_ad_mobile?: number; naver_ad_etc?: number; organic: number; total: number }
  kpi: { total: number; phone_click: number; consultation_click: number; consultation_submit: number; kakao_click: number }
  by_page: Array<{ page_path: string; page_title?: string | null; phone_click: number; consultation_click: number; consultation_submit: number; kakao_click: number; total: number }>
  by_component: Array<{ component_name: string; section_name: string; button_label: string; event_type: string; count: number; ratio: number }>
  by_keyword: Array<{ keyword: string; page_path: string; keyword_text?: string | null; media?: string | null; match_type?: string | null; rank_best?: number | null; phone_click: number; consultation_click: number; consultation_submit: number; kakao_click: number; total: number }>
  filters: { pages: string[]; components: string[]; campaigns: string[]; keywords: string[] }
  event_types: string[]
}

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

  ctaEvents: (params: { start_date?: string; end_date?: string; page?: string; event_type?: string; campaign?: string; keyword?: string; component?: string; source?: string; platform?: string }) =>
    apiClient.get(`${BASE}/cta-events`, { params }).then(unwrap<CtaDashboard>),

  sendTestCtaEvent: (event_type: string) =>
    apiClient.post('/api/v1/public/marketing/cta-event', {
      event_type,
      page_path: '/test-page',
      page_title: '테스트 페이지',
      component_name: 'TestButton',
      section_name: 'AdminTest',
      button_label: '관리자 테스트',
      destination: event_type === 'kakao_click' ? 'kakao' : event_type === 'phone_click' ? 'tel:0318568090' : '/contact',
      utm_source: 'naver', utm_medium: 'cpc', utm_campaign: 'admin_test', utm_term: '테스트키워드', utm_content: 'admin_test',
      naver_query: '도봉구요양원', naver_keyword: '도봉구요양원', naver_rank: '4', naver_media: '27758', naver_match_type: '1', naver_campaign_type: '1',
      naver_adgroup_id: 'grp-test', naver_keyword_id: 'nkw-test', naver_ad_id: 'nad-test',
      session_id: 'admin-test', device_type: 'desktop',
    }).then((r: any) => r.data),

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
