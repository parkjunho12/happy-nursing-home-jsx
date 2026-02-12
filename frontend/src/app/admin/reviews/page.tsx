import React from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminLayout from '@/components/admin/AdminLayout'
import { Star } from 'lucide-react'
import ReviewActions from '@/components/admin/ReviewActions'

export default async function AdminReviewsPage() {
  const user = await getSession()
  if (!user) {
    redirect('/admin/login')
  }

  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const stats = {
    total: reviews.length,
    pending: reviews.filter(r => !r.approved).length,
    approved: reviews.filter(r => r.approved).length,
    featured: reviews.filter(r => r.featured).length,
  }

  return (
    <AdminLayout user={user}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            후기 관리
          </h1>
          <p className="text-gray-600">
            총 {stats.total}개의 후기
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Star className="w-5 h-5 text-gray-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
            </div>
            <p className="text-sm text-gray-600">전체</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-yellow-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-2xl font-bold text-yellow-600">{stats.pending}</span>
            </div>
            <p className="text-sm text-gray-600">승인 대기</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-green-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-green-600">{stats.approved}</span>
            </div>
            <p className="text-sm text-gray-600">승인됨</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-primary-orange/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary-orange/10 rounded-lg">
                <Star className="w-5 h-5 text-primary-orange" />
              </div>
              <span className="text-2xl font-bold text-primary-orange">{stats.featured}</span>
            </div>
            <p className="text-sm text-gray-600">추천 후기</p>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100 hover:border-primary-orange transition-colors"
            >
              {/* Rating */}
              <div className="flex items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= review.rating
                        ? 'fill-primary-orange text-primary-orange'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>

              {/* Content */}
              <p className="text-gray-700 mb-4 line-clamp-4 leading-relaxed">
                {review.content}
              </p>

              {/* Author & Date */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="font-semibold text-gray-900">{review.author}</p>
                  <p className="text-xs text-gray-500">{review.date}</p>
                </div>
                <div className="flex gap-2">
                  {review.verified && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                      인증
                    </span>
                  )}
                  {review.featured && (
                    <span className="px-2 py-1 bg-primary-orange/10 text-primary-orange text-xs font-semibold rounded">
                      추천
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="mb-4">
                {review.approved ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    ✓ 승인됨
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                    ⏱ 승인 대기
                  </span>
                )}
              </div>

              {/* Actions */}
              <ReviewActions reviewId={review.id} currentState={{
                approved: review.approved,
                featured: review.featured,
                verified: review.verified,
              }} />
            </div>
          ))}
        </div>

        {reviews.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-500">
            아직 후기가 없습니다
          </div>
        )}
      </div>
    </AdminLayout>
  )
}