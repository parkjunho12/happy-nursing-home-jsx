import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Shield,
  Clock,
  Activity,
  RefreshCw,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react'
import { trackAPI } from '@/api/client'
import type { SuspiciousIP, TrackStatsResponse } from '@/api/client'

// 확장된 IP 정보 (API에서 추가로 받아올 데이터)
interface EnhancedSuspiciousIP extends SuspiciousIP {
  // 유입 소스별 클릭 분포
  source_breakdown?: {
    naver?: number
    google?: number
    direct?: number
    other?: number
  }
  // 최근 클릭 이력
  recent_clicks?: Array<{
    timestamp: string
    source: string
    utm_campaign?: string
    utm_term?: string
    page?: string
  }>
  // User Agent 정보
  user_agents?: string[]
  // 방문 페이지
  pages?: string[]
}

type SourceFilter = 'all' | 'naver' | 'google' | 'direct' | 'other'

export default function SuspiciousIPPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(7)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIPs, setExpandedIPs] = useState<Set<string>>(new Set())

  const [suspiciousIPs, setSuspiciousIPs] = useState<EnhancedSuspiciousIP[]>([])
  const [stats, setStats] = useState<TrackStatsResponse | null>(null)

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async (isManualRefresh = false) => {
    try {
      setError(null)

      if (isManualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // 기존 API 호출
      const [suspiciousRes, statsRes] = await Promise.all([
        trackAPI.suspicious(period),
        trackAPI.stats(period),
      ])

      // 각 IP에 대한 상세 정보 추가 (별도 API 엔드포인트 필요)
      // const enhancedIPs = await Promise.all(
      //   suspiciousRes.map(ip => trackAPI.ipDetail(ip.ip_hash))
      // )

      // 임시로 mock 데이터 추가
      const enhancedIPs = suspiciousRes.map(ip => ({
        ...ip,
        source_breakdown: generateMockSourceBreakdown(),
        recent_clicks: generateMockRecentClicks(),
        user_agents: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)...'],
        pages: ['/', '/about', '/contact'],
      }))

      setSuspiciousIPs(enhancedIPs)
      setStats(statsRes)
    } catch (err: any) {
      console.error('Failed to fetch suspicious IP data:', err)
      setError('의심 IP 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 소스별 통계
  const sourceStats = useMemo(() => {
    const stats = {
      naver: { ips: 0, clicks: 0 },
      google: { ips: 0, clicks: 0 },
      direct: { ips: 0, clicks: 0 },
      other: { ips: 0, clicks: 0 },
    }

    suspiciousIPs.forEach(ip => {
      if (ip.source_breakdown) {
        Object.entries(ip.source_breakdown).forEach(([source, count]) => {
          if (count && count > 0) {
            stats[source as keyof typeof stats].ips += 1
            stats[source as keyof typeof stats].clicks += count
          }
        })
      }
    })

    return stats
  }, [suspiciousIPs])

  // 필터링
  const filteredIPs = useMemo(() => {
    let filtered = suspiciousIPs

    // 소스 필터
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(ip => {
        const breakdown = ip.source_breakdown
        return breakdown && breakdown[sourceFilter] && breakdown[sourceFilter]! > 0
      })
    }

    // 검색 필터
    if (searchQuery) {
      filtered = filtered.filter(ip =>
        ip.ip_hash.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [suspiciousIPs, sourceFilter, searchQuery])

  const suspiciousRate = useMemo(() => {
    if (!stats || stats.total_clicks <= 0) return '0.0'
    return ((stats.suspicious_clicks / stats.total_clicks) * 100).toFixed(1)
  }, [stats])

  const normalClicks = useMemo(() => {
    if (!stats) return 0
    return Math.max(0, stats.total_clicks - stats.suspicious_clicks)
  }, [stats])

  const toggleExpanded = (ipHash: string) => {
    const newSet = new Set(expandedIPs)
    if (newSet.has(ipHash)) {
      newSet.delete(ipHash)
    } else {
      newSet.add(ipHash)
    }
    setExpandedIPs(newSet)
  }

  const downloadCSV = () => {
    const headers = ['IP Hash', '총 클릭', '네이버', '구글', '직접', '기타', '마지막 클릭']
    const rows = filteredIPs.map(ip => [
      ip.ip_hash,
      ip.click_count,
      ip.source_breakdown?.naver || 0,
      ip.source_breakdown?.google || 0,
      ip.source_breakdown?.direct || 0,
      ip.source_breakdown?.other || 0,
      new Date(ip.last_click).toLocaleString('ko-KR'),
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `suspicious_ips_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const getRiskMeta = (clickCount: number) => {
    if (clickCount >= 50) {
      return { label: '매우 높음', className: 'bg-red-100 text-red-800' }
    }
    if (clickCount >= 20) {
      return { label: '높음', className: 'bg-orange-100 text-orange-800' }
    }
    return { label: '중간', className: 'bg-yellow-100 text-yellow-800' }
  }

  const shortHash = (hash: string) => {
    if (!hash) return '-'
    if (hash.length <= 16) return hash
    return `${hash.slice(0, 10)}...${hash.slice(-6)}`
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-red-900">데이터 오류</h2>
          <p className="mb-4 text-sm text-red-700">{error || '알 수 없는 오류'}</p>
          <button
            onClick={() => fetchData(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">의심 IP 모니터링</h1>
            <p className="text-gray-600">네이버/구글 광고 IP별 상세 분석 및 부정클릭 감지</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-4 py-2"
            >
              <option value={1}>최근 1일</option>
              <option value={7}>최근 7일</option>
              <option value={30}>최근 30일</option>
            </select>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              새로고침
            </button>

            <button
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              <Download className="h-4 w-4" />
              CSV 다운로드
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded bg-red-100 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-sm text-gray-600">의심 클릭</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.suspicious_clicks}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded bg-green-100 p-2">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-600">정상 클릭</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{normalClicks}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded bg-orange-100 p-2">
                <Activity className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-sm text-gray-600">의심률</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{suspiciousRate}%</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded bg-purple-100 p-2">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm text-gray-600">의심 IP</span>
            </div>
            <p className="text-3xl font-bold text-purple-600">{suspiciousIPs.length}</p>
          </div>
        </div>

        {/* Source Stats - Clickable Filters */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">유입 소스별 통계</h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <button
              onClick={() => setSourceFilter(sourceFilter === 'naver' ? 'all' : 'naver')}
              className={`rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${
                sourceFilter === 'naver'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm font-semibold text-gray-900">네이버</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{sourceStats.naver.ips}</div>
              <div className="mt-1 text-xs text-gray-600">{sourceStats.naver.clicks}회 클릭</div>
            </button>

            <button
              onClick={() => setSourceFilter(sourceFilter === 'google' ? 'all' : 'google')}
              className={`rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${
                sourceFilter === 'google'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-sm font-semibold text-gray-900">구글</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{sourceStats.google.ips}</div>
              <div className="mt-1 text-xs text-gray-600">{sourceStats.google.clicks}회 클릭</div>
            </button>

            <button
              onClick={() => setSourceFilter(sourceFilter === 'direct' ? 'all' : 'direct')}
              className={`rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${
                sourceFilter === 'direct'
                  ? 'border-gray-500 bg-gray-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-500" />
                <span className="text-sm font-semibold text-gray-900">직접 유입</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{sourceStats.direct.ips}</div>
              <div className="mt-1 text-xs text-gray-600">{sourceStats.direct.clicks}회 클릭</div>
            </button>

            <button
              onClick={() => setSourceFilter(sourceFilter === 'other' ? 'all' : 'other')}
              className={`rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${
                sourceFilter === 'other'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-500" />
                <span className="text-sm font-semibold text-gray-900">기타</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{sourceStats.other.ips}</div>
              <div className="mt-1 text-xs text-gray-600">{sourceStats.other.clicks}회 클릭</div>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="IP Hash 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
          
          {sourceFilter !== 'all' && (
            <button
              onClick={() => setSourceFilter('all')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              <Filter className="h-4 w-4" />
              필터 초기화
            </button>
          )}
        </div>

        {/* IP List */}
        <div className="space-y-4">
          {filteredIPs.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <Shield className="mx-auto mb-3 h-12 w-12 text-green-600" />
              <p className="text-gray-600">
                {sourceFilter !== 'all' ? '필터 조건에 맞는 IP가 없습니다' : '현재 의심스러운 IP가 없습니다'}
              </p>
            </div>
          ) : (
            filteredIPs.map((ip, index) => (
              <IPCard
                key={ip.ip_hash}
                ip={ip}
                index={index}
                expanded={expandedIPs.has(ip.ip_hash)}
                onToggle={() => toggleExpanded(ip.ip_hash)}
                getRiskMeta={getRiskMeta}
                shortHash={shortHash}
              />
            ))
          )}
        </div>

        {/* Action Guide */}
        {suspiciousIPs.length > 0 && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
            <h3 className="mb-3 font-semibold text-gray-900">대응 방법</h3>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="font-bold">1.</span>
                <div>
                  <strong>네이버/구글별 IP 분석</strong>
                  <p className="mt-1 text-gray-600">
                    유입 소스별 통계 카드를 클릭하여 특정 광고 플랫폼의 의심 IP만 확인하세요.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-bold">2.</span>
                <div>
                  <strong>상세 클릭 패턴 확인</strong>
                  <p className="mt-1 text-gray-600">
                    각 IP 카드를 클릭하여 시간대별 클릭 패턴과 UTM 파라미터를 확인하세요.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-bold">3.</span>
                <div>
                  <strong>광고 플랫폼에서 IP 차단</strong>
                  <p className="mt-1 text-gray-600">
                    네이버/구글 광고 관리에서 반복 클릭 IP를 제외 목록에 추가하세요.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

// IP Card Component
function IPCard({ ip, index, expanded, onToggle, getRiskMeta, shortHash }: any) {
  const riskMeta = getRiskMeta(ip.click_count)
  
  const sourceColors = {
    naver: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    google: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    direct: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' },
    other: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div
        className="cursor-pointer p-6 hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                {index + 1}
              </span>
              <div>
                <div className="font-mono text-sm font-semibold text-gray-900">
                  {shortHash(ip.ip_hash)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {new Date(ip.last_click).toLocaleString('ko-KR')}
                </div>
              </div>
            </div>

            {/* Source Breakdown */}
            {ip.source_breakdown && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(ip.source_breakdown).map(([source, count]) => {
                  if (!count || count === 0) return null
                  const colors = sourceColors[source as keyof typeof sourceColors]
                  return (
                    <div
                      key={source}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}
                    >
                      <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
                      {source.toUpperCase()} · {count}회
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-2xl font-bold text-red-600">{ip.click_count}회</div>
              <div className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-medium ${riskMeta.className}`}>
                {riskMeta.label}
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && ip.recent_clicks && (
        <div className="border-t border-gray-200 bg-gray-50 p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            
            {/* Recent Clicks Timeline */}
            <div>
              <h4 className="mb-4 font-semibold text-gray-900">최근 클릭 이력</h4>
              <div className="space-y-3">
                {ip.recent_clicks.slice(0, 10).map((click: any, idx: number) => {
                  const colors = sourceColors[click.source as keyof typeof sourceColors]
                  return (
                    <div key={idx} className="rounded-lg bg-white p-3 text-sm">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${colors.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{click.source.toUpperCase()}</span>
                            {click.page && (
                              <>
                                <span className="text-gray-400">·</span>
                                <span className="text-gray-600">{click.page}</span>
                              </>
                            )}
                          </div>
                          {click.utm_campaign && (
                            <div className="mt-1 text-xs text-gray-500">
                              캠페인: {click.utm_campaign}
                              {click.utm_term && ` · 키워드: ${click.utm_term}`}
                            </div>
                          )}
                          <div className="mt-1 text-xs text-gray-500">
                            {new Date(click.timestamp).toLocaleString('ko-KR')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Additional Info */}
            <div>
              <h4 className="mb-4 font-semibold text-gray-900">추가 정보</h4>
              
              <div className="space-y-4">
                {/* Full Hash */}
                <div>
                  <div className="mb-2 text-xs font-medium text-gray-500">IP Hash (전체)</div>
                  <div className="break-all rounded-lg bg-white p-3 font-mono text-xs text-gray-900">
                    {ip.ip_hash}
                  </div>
                </div>

                {/* User Agents */}
                {ip.user_agents && ip.user_agents.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-gray-500">User Agent</div>
                    <div className="space-y-2">
                      {ip.user_agents.map((ua: string, idx: number) => (
                        <div key={idx} className="rounded-lg bg-white p-2 text-xs text-gray-700">
                          {ua.slice(0, 80)}...
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pages */}
                {ip.pages && ip.pages.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-gray-500">방문 페이지</div>
                    <div className="flex flex-wrap gap-2">
                      {ip.pages.map((page: string, idx: number) => (
                        <span key={idx} className="rounded bg-white px-2 py-1 text-xs text-gray-700">
                          {page}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mock 데이터 생성 함수들
function generateMockSourceBreakdown() {
  const sources = ['naver', 'google', 'direct', 'other']
  const numSources = Math.floor(Math.random() * 3) + 1
  const selectedSources = sources.slice(0, numSources)
  
  const breakdown: any = {}
  selectedSources.forEach(source => {
    breakdown[source] = Math.floor(Math.random() * 30) + 1
  })
  
  return breakdown
}

function generateMockRecentClicks() {
  const sources = ['naver', 'google', 'direct', 'other']
  const clicks = []
  
  for (let i = 0; i < 15; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)]
    clicks.push({
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      source,
      utm_campaign: `campaign_${source}`,
      utm_term: `키워드${i}`,
      page: '/',
    })
  }
  
  return clicks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}