import { useState, useEffect } from 'react'
import { trackAPI } from '@/api/client'
import { Eye, Users, TrendingUp, Clock } from 'lucide-react'

interface PageViewStat {
  page: string
  views: number
  unique_ips: number
  avg_per_ip: number
}

export default function PageViewStat() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [pageViews, setPageViews] = useState<PageViewStat[]>([])
  const [period, setPeriod] = useState(7)

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    try {
      setLoading(true)
  
      const statsRes = await trackAPI.stats(period)
      setStats(statsRes)
  
      const allRes = await trackAPI.all(period)
  
      // 페이지뷰만 필터링
      const pageViewEvents = allRes.filter((e: any) =>
        e.event_type.startsWith('page_view_')
      )
  
      // 페이지별 집계
      const pageData: Record<string, { count: number; ips: Set<string> }> = {}
  
      pageViewEvents.forEach((e: any) => {
        const page = e.event_type.replace('page_view_', '')
  
        if (!pageData[page]) {
          pageData[page] = { count: 0, ips: new Set() }
        }
  
        pageData[page].count++
        pageData[page].ips.add(e.ip_hash)
      })
  
      const pageViewStats: PageViewStat[] = Object.entries(pageData).map(
        ([page, data]) => ({
          page,
          views: data.count,
          unique_ips: data.ips.size,
          avg_per_ip: parseFloat((data.count / data.ips.size).toFixed(1)),
        })
      )
  
      pageViewStats.sort((a, b) => b.views - a.views)
      setPageViews(pageViewStats)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return <div className="p-8">로딩 중...</div>
  }

  const totalPageViews = pageViews.reduce((sum, pv) => sum + pv.views, 0)
  const avgPagesPerVisitor =
    stats.unique_ips > 0 ? (totalPageViews / stats.unique_ips).toFixed(1) : '0'

  const formatPageName = (page: string): string => {
    const names: Record<string, string> = {
      home: '홈',
      about: '소개',
      facilities: '시설',
      programs: '프로그램',
      costs: '비용',
      location: '오시는 길',
      contact: '문의',
      history: '히스토리',
      videos: '영상',
      'risk-assessment': '요양 진단',
    }
    return names[page] || page
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">페이지뷰 분석</h1>
        <p className="text-gray-600">페이지별 방문자 통계</p>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value={1}>최근 1일</option>
          <option value={7}>최근 7일</option>
          <option value={30}>최근 30일</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">전체 페이지뷰</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalPageViews}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">고유 방문자</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.unique_ips}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-600">페이지/방문자</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{avgPagesPerVisitor}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-gray-600">인기 페이지</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {pageViews[0] ? formatPageName(pageViews[0].page) : '-'}
          </p>
        </div>
      </div>

      {/* Page Stats Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">페이지별 상세 통계</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  순위
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  페이지
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  총 조회수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  고유 방문자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  재방문율
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  비중
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pageViews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    페이지뷰 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                pageViews.map((pv, index) => {
                  const revisitRate = ((pv.avg_per_ip - 1) * 100).toFixed(0)
                  const percentage = ((pv.views / totalPageViews) * 100).toFixed(1)

                  return (
                    <tr key={pv.page} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {formatPageName(pv.page)}
                          </span>
                          <span className="text-xs text-gray-500">/{pv.page}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-600">
                        {pv.views}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {pv.unique_ips}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900">{revisitRate}%</span>
                          {Number(revisitRate) > 50 && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              높음
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12">
                            {percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      {pageViews.length > 0 && (
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="font-bold text-lg mb-3 text-blue-900">📊 주요 인사이트</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>
                • 가장 인기있는 페이지:{' '}
                <strong>{formatPageName(pageViews[0].page)}</strong> (
                {pageViews[0].views}회)
              </li>
              <li>
                • 평균 페이지/방문자:{' '}
                <strong>{avgPagesPerVisitor}</strong>페이지
              </li>
              <li>
                • 재방문이 많은 페이지:{' '}
                <strong>
                  {formatPageName(
                    pageViews.reduce((max, pv) =>
                      pv.avg_per_ip > max.avg_per_ip ? pv : max
                    ).page
                  )}
                </strong>
              </li>
            </ul>
          </div>

          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h3 className="font-bold text-lg mb-3 text-green-900">💡 개선 제안</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li>• 조회수가 낮은 페이지는 메뉴 위치 변경 고려</li>
              <li>• 재방문율이 높은 페이지에 CTA 버튼 추가</li>
              <li>• 인기 페이지에서 다른 페이지로 유도하는 링크 추가</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}