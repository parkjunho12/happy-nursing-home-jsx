import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Shield,
  Clock,
  Activity,
  RefreshCw,
  Search,
  Download,
} from 'lucide-react'
import { trackAPI } from '@/api/client'
import type { SuspiciousIP, TrackStatsResponse } from '@/api/client'
import {
  SUSPICIOUS_IP_RESPONSE_NOTICE,
  buildSuspiciousIPsCsv,
  keepVerifiedSuspiciousIPFields,
} from '@/utils/suspiciousIPs'

export default function SuspiciousIPPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(7)
  const [searchQuery, setSearchQuery] = useState('')
  const [suspiciousIPs, setSuspiciousIPs] = useState<SuspiciousIP[]>([])
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

      const [suspiciousRes, statsRes] = await Promise.all([
        trackAPI.suspicious(period),
        trackAPI.stats(period),
      ])

      setSuspiciousIPs(keepVerifiedSuspiciousIPFields(suspiciousRes))
      setStats(statsRes)
    } catch (err: unknown) {
      console.error('Failed to fetch suspicious IP data:', err)
      setError('의심 IP 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const filteredIPs = useMemo(() => {
    if (!searchQuery) return suspiciousIPs
    const query = searchQuery.toLowerCase()
    return suspiciousIPs.filter(ip => ip.ip_hash.toLowerCase().includes(query))
  }, [suspiciousIPs, searchQuery])

  const suspiciousRate = useMemo(() => {
    if (!stats || stats.total_clicks <= 0) return '0.0'
    return ((stats.suspicious_clicks / stats.total_clicks) * 100).toFixed(1)
  }, [stats])

  const normalClicks = useMemo(() => {
    if (!stats) return 0
    return Math.max(0, stats.total_clicks - stats.suspicious_clicks)
  }, [stats])

  const downloadCSV = () => {
    const csv = buildSuspiciousIPsCsv(
      filteredIPs,
      value => new Date(value).toLocaleString('ko-KR'),
    )
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `suspicious_ips_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
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
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600" />
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
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">의심 IP 모니터링</h1>
            <p className="text-gray-600">반복 클릭 IP 집계 및 부정클릭 감지 현황</p>
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

        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          {SUSPICIOUS_IP_RESPONSE_NOTICE}
        </div>

        <div className="mb-6">
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

        <div className="space-y-4">
          {filteredIPs.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <Shield className="mx-auto mb-3 h-12 w-12 text-green-600" />
              <p className="text-gray-600">
                {searchQuery ? '검색 조건에 맞는 IP가 없습니다' : '현재 의심스러운 IP가 없습니다'}
              </p>
            </div>
          ) : (
            filteredIPs.map((ip, index) => (
              <div
                key={ip.ip_hash}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="break-all font-mono text-sm font-semibold text-gray-900" title={ip.ip_hash}>
                        {shortHash(ip.ip_hash)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        마지막 클릭 {new Date(ip.last_click).toLocaleString('ko-KR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-2xl font-bold text-red-600">{ip.click_count}회</div>
                    <div className="mt-1 text-xs text-gray-500">집계 클릭</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
