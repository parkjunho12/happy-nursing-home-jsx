import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Shield, Clock, Activity, RefreshCw } from 'lucide-react'
import { trackAPI } from '@/api/client'
import type { SuspiciousIP, TrackStatsResponse } from '@/api/client'

export default function SuspiciousIPPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(7)

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

      setSuspiciousIPs(suspiciousRes)
      setStats(statsRes)
    } catch (err: any) {
      console.error('Failed to fetch suspicious IP data:', err)
      setError('의심 IP 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const suspiciousRate = useMemo(() => {
    if (!stats || stats.total_clicks <= 0) return '0.0'
    return ((stats.suspicious_clicks / stats.total_clicks) * 100).toFixed(1)
  }, [stats])

  const normalClicks = useMemo(() => {
    if (!stats) return 0
    return Math.max(0, stats.total_clicks - stats.suspicious_clicks)
  }, [stats])

  const topSuspicious = suspiciousIPs[0]

  const getRiskMeta = (clickCount: number) => {
    if (clickCount >= 50) {
      return {
        label: '매우 높음',
        className: 'bg-red-100 text-red-800',
      }
    }
    if (clickCount >= 20) {
      return {
        label: '높음',
        className: 'bg-orange-100 text-orange-800',
      }
    }
    return {
      label: '중간',
      className: 'bg-yellow-100 text-yellow-800',
    }
  }

  const shortHash = (hash: string) => {
    if (!hash) return '-'
    if (hash.length <= 16) return hash
    return `${hash.slice(0, 10)}...${hash.slice(-6)}`
  }

  if (loading) {
    return <div className="p-8">로딩 중...</div>
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-red-900">데이터를 불러오지 못했습니다</h2>
          <p className="mb-4 text-sm text-red-700">{error || '알 수 없는 오류가 발생했습니다.'}</p>
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
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">의심 IP 모니터링</h1>
          <p className="text-gray-600">부정클릭 감지 및 반복 클릭 패턴 모니터링</p>
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
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
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
            <span className="text-sm text-gray-600">의심 IP 수</span>
          </div>
          <p className="text-3xl font-bold text-purple-600">{suspiciousIPs.length}</p>
        </div>
      </div>

      {/* Alert Banner */}
      {suspiciousIPs.length > 0 ? (
        <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-red-900">부정클릭 의심 패턴이 감지되었습니다</h3>
              <p className="text-sm text-red-800">
                현재 <strong>{suspiciousIPs.length}개</strong>의 해시 IP에서 반복 클릭 패턴이 감지되었습니다.
                서버 로그와 광고 플랫폼의 IP 제외 목록을 함께 점검하세요.
              </p>
              {topSuspicious && (
                <p className="mt-2 text-sm text-red-700">
                  가장 높은 반복 클릭: <strong>{shortHash(topSuspicious.ip_hash)}</strong> ·{' '}
                  <strong>{topSuspicious.click_count}회</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-green-600" />
            <div>
              <h3 className="mb-1 font-semibold text-green-900">현재 의심 트래픽이 많지 않습니다</h3>
              <p className="text-sm text-green-800">
                선택한 기간 동안 반복 클릭 패턴이 심한 IP가 감지되지 않았습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detection Rules */}
      <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="mb-3 font-semibold text-blue-900">부정클릭 감지 기준</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• 1시간 내 5회 이상 클릭 시 의심 플래그 처리</li>
          <li>• 하루 내 10회 이상 반복 클릭 시 의심도 상승</li>
          <li>• IP는 해시로만 저장되며, 실제 IP는 서버 로그에서 확인해야 합니다</li>
        </ul>
      </div>

      {/* Suspicious IPs Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">의심스러운 IP 목록</h2>
          <p className="mt-1 text-sm text-gray-500">반복 클릭 횟수 기준으로 정렬된 목록입니다</p>
        </div>

        {suspiciousIPs.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="mx-auto mb-3 h-12 w-12 text-green-600" />
            <p className="text-gray-600">현재 의심스러운 IP가 없습니다</p>
            <p className="mt-1 text-sm text-gray-500">정상적인 트래픽만 감지되고 있습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">순위</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">IP Hash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">클릭 수</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">마지막 클릭</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">위험도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {suspiciousIPs.map((ip, index) => {
                  const riskMeta = getRiskMeta(ip.click_count)

                  return (
                    <tr key={ip.ip_hash} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{index + 1}</td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm text-gray-900">{shortHash(ip.ip_hash)}</span>
                          <span className="mt-1 text-xs text-gray-500 break-all">{ip.ip_hash}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-red-600">{ip.click_count}회</span>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(ip.last_click).toLocaleString('ko-KR')}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${riskMeta.className}`}>
                          {riskMeta.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Guide */}
      {suspiciousIPs.length > 0 && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h3 className="mb-3 font-semibold text-gray-900">대응 방법</h3>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="font-bold text-gray-900">1.</span>
              <div>
                <strong>서버 로그 확인</strong>
                <p className="mt-1 text-gray-600">
                  track/click 요청 로그에서 해시와 대응되는 실제 IP를 확인하세요.
                </p>
                <p className="mt-2">
                  <code className="rounded bg-gray-200 px-2 py-1 text-xs">
                    tail -f /var/log/nginx/access.log | grep "POST /api/v1/track/click"
                  </code>
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-bold text-gray-900">2.</span>
              <div>
                <strong>광고 플랫폼에서 IP 제외</strong>
                <p className="mt-1 text-gray-600">
                  네이버/구글 광고 설정에서 반복 클릭 IP를 제외 목록에 추가하세요.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-bold text-gray-900">3.</span>
              <div>
                <strong>반복 패턴 모니터링</strong>
                <p className="mt-1 text-gray-600">
                  특정 시간대나 특정 랜딩페이지에서 반복적으로 발생하는지 함께 확인하세요.
                </p>
              </div>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}