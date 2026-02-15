import { Metadata } from 'next'
import Link from 'next/link'
import { Star, CheckCircle, ChevronRight, MessageCircle } from 'lucide-react'
import { REVIEWS } from '@/lib/constants'

export const metadata: Metadata = {
  title: '이용 후기 | 행복한요양원 녹양역점',
  description: '행복한요양원을 이용하신 가족분들의 솔직한 후기를 확인하세요.',
}

export default function ReviewsPage() {
  const stats = {
    total: 127,
    average: 4.8,
    distribution: [
      { stars: 5, count: 98, percentage: 77 },
      { stars: 4, count: 24, percentage: 19 },
      { stars: 3, count: 5, percentage: 4 },
      { stars: 2, count: 0, percentage: 0 },
      { stars: 1, count: 0, percentage: 0 },
    ],
  }

  const detailedReviews = [
    {
      id: '1',
      author: '김**님',
      relation: '딸',
      rating: 5,
      date: '2024년 2월',
      title: '어머니가 너무 좋아하세요',
      content: '어머니를 모시기 위해 여러 요양원을 둘러봤는데, 행복한요양원의 시설과 직원분들의 태도가 가장 인상적이었습니다. 입소 후 3개월이 지났는데 어머니도 많이 편안해하시고, 정기적으로 보내주시는 사진과 건강 상태 리포트 덕분에 저희도 안심하고 있습니다. 특히 요양보호사님들이 정말 친절하시고 세심하게 케어해 주셔서 감사합니다.',
      verified: true,
      helpful: 24,
    },
    {
      id: '2',
      author: '박**님',
      relation: '아들',
      rating: 5,
      date: '2024년 1월',
      title: '전문적인 치매 케어에 만족합니다',
      content: '아버지께서 치매가 있으셔서 많이 걱정했는데, 전문적인 인지 프로그램과 세심한 케어 덕분에 증상이 많이 안정되었습니다. 요양보호사님들이 진심으로 대해주시는 것이 느껴져서 가족으로서 너무 감사합니다. 주말에 방문할 때마다 깨끗하고 정돈된 시설에 감탄하게 됩니다.',
      verified: true,
      helpful: 18,
    },
    {
      id: '3',
      author: '이**님',
      relation: '며느리',
      rating: 5,
      date: '2023년 12월',
      title: '시설이 정말 깨끗하고 프로그램이 다양해요',
      content: '시설이 너무 깨끗하고 직원분들도 친절하세요. 특히 식사가 정말 맛있다고 어머니께서 매번 칭찬하십니다. 다양한 프로그램 덕분에 요양원에서도 즐겁게 지내시는 것 같아 마음이 놓입니다. 가족들과의 소통도 원활하게 해주셔서 감사합니다.',
      verified: true,
      helpful: 15,
    },
    {
      id: '4',
      author: '최**님',
      relation: '손녀',
      rating: 5,
      date: '2023년 11월',
      title: '할머니가 행복해하세요',
      content: '할머니를 모시고 계신데 전에는 자주 우울해하셨는데, 요양원에 오신 후로는 친구들도 생기시고 매일 프로그램에 참여하셔서 활기차게 지내십니다. 간호사분들도 건강을 세심하게 체크해 주시고, 정기적인 병원 진료도 함께 가주셔서 안심이 됩니다.',
      verified: true,
      helpful: 12,
    },
    {
      id: '5',
      author: '정**님',
      relation: '아들',
      rating: 4,
      title: '전반적으로 만족합니다',
      content: '아버지께서 입소하신 지 6개월이 되었습니다. 직원분들이 정성껏 돌봐주시고, 시설도 깨끗하고 좋습니다. 다만 주말에 방문객이 많을 때는 조금 혼잡한 느낌이 있지만, 전반적으로는 매우 만족합니다. 정기적인 가족 상담도 도움이 됩니다.',
      verified: true,
      helpful: 9,
    },
    {
      id: '6',
      author: '강**님',
      relation: '딸',
      rating: 5,
      title: '가족처럼 돌봐주셔서 감사합니다',
      content: '홀로 계시던 어머니를 모시기로 결정했는데, 행복한요양원을 선택하길 정말 잘한 것 같습니다. 요양보호사님들이 진짜 가족처럼 대해주시고, 어머니의 작은 변화도 세심하게 알려주십니다. 식사도 영양사님이 직접 관리하셔서 건강이 좋아지셨어요.',
      verified: true,
      helpful: 21,
    },
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20 lg:py-32">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            이용 후기
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
            행복한요양원을 이용하신<br />
            가족분들의 솔직한 이야기
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Rating Summary */}
            <div className="text-center lg:text-left">
              <div className="inline-block">
                <div className="text-6xl font-bold text-gray-900 mb-2">
                  {stats.average}
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-8 h-8 ${
                        i < Math.floor(stats.average)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-gray-600">
                  총 <strong className="text-gray-900">{stats.total}개</strong>의 후기
                </div>
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-3">
              {stats.distribution.map((item) => (
                <div key={item.stars} className="flex items-center gap-4">
                  <div className="flex items-center gap-1 w-20">
                    <span className="text-sm font-medium text-gray-700">
                      {item.stars}점
                    </span>
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm text-gray-600">
                    {item.count}개
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reviews List */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {detailedReviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">
                        {review.author}
                      </span>
                      <span className="text-gray-500">({review.relation})</span>
                      {review.verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          인증됨
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {review.title}
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  {review.content}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                  <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-orange transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    도움이 되었어요 ({review.helpful})
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Load More */}
          <div className="mt-12 text-center">
            <button className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors">
              후기 더보기
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            직접 방문하여 확인해 보세요
          </h2>
          <p className="text-xl mb-8 text-white/90">
            시설 견학 및 상담을 원하시면 언제든 연락주세요
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              방문 예약하기
              <ChevronRight className="w-5 h-5" />
            </Link>
            <a
              href="tel:02-1234-5678"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
            >
              전화 문의하기
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}