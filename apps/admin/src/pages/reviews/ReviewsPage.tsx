import { useEffect, useState } from 'react'
import { Star, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { reviewsAPI } from '@/api/client'
import type { Review } from '@/types'

const ReviewsPage = () => {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL')

  useEffect(() => {
    loadReviews()
  }, [])

  const loadReviews = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await reviewsAPI.list()
      setReviews(response || [])
    } catch (error: any) {
      console.error('Failed to load reviews:', error)
      setError(error.response?.data?.message || '후기 목록을 불러올 수 없습니다')
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await reviewsAPI.approve(id)
      loadReviews()
    } catch (error) {
      alert('승인에 실패했습니다')
    }
  }

  const handleReject = async (id: string) => {
    if (!confirm('정말 거부하시겠습니까? 후기가 삭제됩니다.')) return
    
    try {
      await reviewsAPI.reject(id)
      loadReviews()
    } catch (error) {
      alert('거부에 실패했습니다')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await reviewsAPI.delete(id)
      loadReviews()
    } catch (error) {
      alert('삭제에 실패했습니다')
    }
  }

  const stats = {
    total: reviews.length,
    pending: reviews.filter(r => !r.isApproved).length,
    approved: reviews.filter(r => r.isApproved).length,
    avgRating: reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0',
  }

  const filteredReviews = reviews.filter(r => {
    if (filter === 'PENDING') return !r.isApproved
    if (filter === 'APPROVED') return r.isApproved
    return true
  })

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">후기 목록 로딩 중...</p>
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
            onClick={loadReviews}
            className="px-6 py-2 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">후기 관리</h1>
        <p className="text-gray-600">총 {reviews.length}건의 후기 • 승인 대기 {stats.pending}건</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border-2 border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">전체 후기</span>
            <Star className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}건</p>
        </div>

        <div className="bg-white rounded-xl p-4 border-2 border-yellow-200 bg-yellow-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-yellow-700">승인 대기</span>
            <XCircle className="w-4 h-4 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-900">{stats.pending}건</p>
        </div>

        <div className="bg-white rounded-xl p-4 border-2 border-green-200 bg-green-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-green-700">승인 완료</span>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-900">{stats.approved}건</p>
        </div>

        <div className="bg-white rounded-xl p-4 border-2 border-blue-200 bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-700">평균 평점</span>
            <Star className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-900">{stats.avgRating}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-6 border-2 border-gray-100">
        <div className="flex gap-2">
          {[
            { value: 'ALL', label: '전체' },
            { value: 'PENDING', label: '승인 대기' },
            { value: 'APPROVED', label: '승인 완료' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as any)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === f.value
                  ? 'bg-primary-orange text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.map((review) => (
          <div
            key={review.id}
            className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${
              review.isApproved ? 'border-gray-100' : 'border-yellow-200 bg-yellow-50/30'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{review.author}</h3>
                  {review.residentName && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold">
                      입소자: {review.residentName}
                    </span>
                  )}
                  {review.isApproved ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      <CheckCircle className="w-3 h-3" />
                      승인 완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                      <XCircle className="w-3 h-3" />
                      승인 대기
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {renderStars(review.rating)}
                  <span className="text-sm text-gray-600">
                    {review.rating}.0
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <p className="text-gray-900 leading-relaxed">{review.content}</p>
            </div>

            {review.isApproved && review.approvedAt && review.approvedBy && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                <p className="text-sm text-green-900">
                  <span className="font-semibold">승인 정보:</span> {review.approvedBy} • {new Date(review.approvedAt).toLocaleString('ko-KR')}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                작성일: {new Date(review.createdAt).toLocaleString('ko-KR')}
              </span>
              <div className="flex gap-2">
                {!review.isApproved && (
                  <>
                    <button
                      onClick={() => handleApprove(review.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      승인
                    </button>
                    <button
                      onClick={() => handleReject(review.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      거부
                    </button>
                  </>
                )}
                {review.isApproved && (
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredReviews.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg">
              {filter !== 'ALL' ? '해당 상태의 후기가 없습니다' : '아직 후기가 없습니다'}
            </p>
            {filter !== 'ALL' && (
              <button
                onClick={() => setFilter('ALL')}
                className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                전체 보기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReviewsPage