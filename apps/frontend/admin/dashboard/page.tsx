import React from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminLayout from '@/components/admin/AdminLayout'
import Link from 'next/link'
import { 
  FileText, 
  MessageSquare, 
  Star, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

export default async function AdminDashboardPage() {
  // 인증 체크
  const user = await getSession()
  if (!user) {
    redirect('/admin/login')
  }

  // 통계 데이터 조회
  const [
    totalHistory,
    publishedHistory,
    totalContacts,
    pendingContacts,
    totalReviews,
    pendingReviews,
    recentContacts,
    recentHistory,
  ] = await Promise.all([
    prisma.historyPost.count(),
    prisma.historyPost.count({ where: { isPublished: true } }),
    prisma.contact.count(),
    prisma.contact.count({ where: { status: 'PENDING' } }),
    prisma.review.count(),
    prisma.review.count({ where: { approved: false } }),
    prisma.contact.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.historyPost.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const stats = [
    {
      label: '히스토리',
      value: totalHistory,
      subValue: `${publishedHistory}개 공개`,
      icon: FileText,
      color: 'orange',
      href: '/admin/history',
    },
    {
      label: '상담 신청',
      value: totalContacts,
      subValue: `${pendingContacts}개 대기`,
      icon: MessageSquare,
      color: 'green',
      href: '/admin/contacts',
      alert: pendingContacts > 0,
    },
    {
      label: '후기',
      value: totalReviews,
      subValue: `${pendingReviews}개 대기`,
      icon: Star,
      color: 'blue',
      href: '/admin/reviews',
      alert: pendingReviews > 0,
    },
    {
      label: '조회수',
      value: recentHistory.reduce((sum, post) => sum + post.viewCount, 0),
      subValue: '총 조회수',
      icon: TrendingUp,
      color: 'purple',
    },
  ]

  return (
    <AdminLayout user={user}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            대시보드
          </h1>
          <p className="text-gray-600">
            안녕하세요, {user.name}님! 👋
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            const colorClasses = {
              orange: 'from-orange-500 to-orange-600',
              green: 'from-green-500 to-green-600',
              blue: 'from-blue-500 to-blue-600',
              purple: 'from-purple-500 to-purple-600',
            }

            return (
              <Link
                key={stat.label}
                href={stat.href || '#'}
                className="relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border-2 border-gray-100 hover:border-primary-orange group"
              >
                {stat.alert && (
                  <div className="absolute top-4 right-4">
                    <span className="flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>

                <div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </p>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stat.subValue}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recent Contacts */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  최근 상담 신청
                </h2>
                <Link
                  href="/admin/contacts"
                  className="text-sm text-primary-orange hover:text-primary-orange/80 font-medium"
                >
                  전체 보기 →
                </Link>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {recentContacts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  아직 상담 신청이 없습니다
                </div>
              ) : (
                recentContacts.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/admin/contacts/${contact.id}`}
                    className="block p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {contact.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {contact.inquiryType}
                        </p>
                      </div>
                      {contact.status === 'PENDING' ? (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                          대기
                        </span>
                      ) : contact.status === 'REPLIED' ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          답변완료
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                          종료
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                      {contact.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(contact.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent History */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  최근 히스토리
                </h2>
                <Link
                  href="/admin/history"
                  className="text-sm text-primary-orange hover:text-primary-orange/80 font-medium"
                >
                  전체 보기 →
                </Link>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {recentHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  아직 히스토리가 없습니다
                </div>
              ) : (
                recentHistory.map((post) => (
                  <Link
                    key={post.id}
                    href={`/admin/history/${post.id}/edit`}
                    className="block p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                          {post.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {post.category}
                        </p>
                      </div>
                      {post.isPublished ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          공개
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          비공개
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        조회 {post.viewCount}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}