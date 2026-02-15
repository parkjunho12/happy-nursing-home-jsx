import { useEffect, useState } from 'react'
import { Users, UserCog, MessageSquare, TrendingUp, Calendar, Activity } from 'lucide-react'
import { dashboardAPI } from '@/api/client'
import type { DashboardStats } from '@/types'

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await dashboardAPI.stats()
      setStats(response || null)
    } catch (error: any) {
      console.error('Failed to load stats:', error)
      setError(error.response?.data?.message || 'Failed to load dashboard data')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  const statCards = stats ? [
    {
      title: '전체 입소자',
      value: stats.totalResidents,
      change: '+3',
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: '활동 중 입소자',
      value: stats.activeResidents,
      change: `${stats.activeResidents}/${stats.totalResidents}`,
      icon: Activity,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: '전체 직원',
      value: stats.totalStaff,
      change: 'Active',
      icon: UserCog,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: '대기 상담',
      value: stats.pendingContacts,
      change: 'Pending',
      icon: MessageSquare,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
    {
      title: '오늘 입소',
      value: stats.todayAdmissions,
      change: 'Today',
      icon: Calendar,
      color: 'bg-pink-500',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600',
    },
    {
      title: '이번 달 입소',
      value: stats.monthlyAdmissions,
      change: '+5',
      icon: TrendingUp,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
  ] : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-900 text-lg font-semibold mb-2">데이터를 불러올 수 없습니다</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadStats}
            className="px-6 py-2 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600 text-lg">데이터가 없습니다</p>
          <button
            onClick={loadStats}
            className="mt-4 px-6 py-2 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors"
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">대시보드</h1>
        <p className="text-gray-600">행복한요양원 운영 현황</p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-14 h-14 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
                <stat.icon className={`w-7 h-7 ${stat.textColor}`} />
              </div>
              <span className="text-sm font-semibold text-gray-500">
                {stat.change}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">
              {stat.title}
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">최근 활동</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">새 입소자 등록</p>
                <p className="text-sm text-gray-500">김**님 - 2시간 전</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">새 상담 신청</p>
                <p className="text-sm text-gray-500">박**님 - 5시간 전</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">건강 체크 완료</p>
                <p className="text-sm text-gray-500">정기 검진 - 1일 전</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">대기 중인 작업</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">상담 답변 대기</p>
                <p className="text-sm text-gray-600">8건</p>
              </div>
              <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-semibold hover:bg-yellow-700 transition-colors">
                확인
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">후기 승인 대기</p>
                <p className="text-sm text-gray-600">3건</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                확인
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">히스토리 작성</p>
                <p className="text-sm text-gray-600">2건</p>
              </div>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
                작성
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage