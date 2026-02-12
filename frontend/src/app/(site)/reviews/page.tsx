import React from 'react'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Star, Quote, CheckCircle, MessageCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '이용 후기 | 행복한요양원',
  description: '행복한요양원을 이용하신 가족분들의 진솔한 후기를 확인하세요. 평균 4.8점의 높은 만족도.',
}

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 ${
            star <= rating
              ? 'fill-primary-orange text-primary-orange'
              : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  )
}

export default async function ReviewsPage() {
  // DB에서 승인된 후기 가져오기
  const reviews = await prisma.review.findMany({
    where: { approved: true },
    orderBy: [
      { featured: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  // 통계 계산
  const totalReviews = reviews.length
  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : '0.0'
  const verifiedCount = reviews.filter(r => r.verified).length

  return (
    <div className="min-h-screen bg-bg-cream pt-20">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20">
        <div className="max-w-[1400px] mx-auto px-6 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6">
            가족들의 진솔한 후기
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-95">
            실제로 경험하신 분들의 이야기를 들어보세요
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mt-12">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-8 py-6 min-w-[200px]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="w-8 h-8 fill-white text-white" />
                <div className="text-4xl font-bold">{averageRating}</div>
              </div>
              <div className="text-lg">평균 평점</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-8 py-6 min-w-[200px]">
              <div className="text-4xl font-bold mb-2">{totalReviews}</div>
              <div className="text-lg">총 후기</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-8 py-6 min-w-[200px]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-6 h-6" />
                <div className="text-4xl font-bold">{verifiedCount}</div>
              </div>
              <div className="text-lg">인증 후기</div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Grid */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          {reviews.length === 0 ? (
            <div className="text-center py-20">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-xl text-text-gray">
                아직 등록된 후기가 없습니다
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-3xl border-2 border-border-light p-8 hover:border-primary-orange hover:shadow-large transition-all duration-300 hover:-translate-y-2 flex flex-col"
                >
                  {/* Quote Icon */}
                  <Quote className="w-10 h-10 text-primary-orange/20 mb-4" />

                  {/* Rating & Verified */}
                  <div className="flex items-center justify-between mb-4">
                    <StarRating rating={review.rating} />
                    {review.verified && (
                      <div className="flex items-center gap-1 px-3 py-1 bg-primary-green/10 text-primary-green rounded-full text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        인증
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <p className="text-text-gray leading-relaxed mb-6 flex-grow">
                    {review.content}
                  </p>

                  {/* Author & Date */}
                  <div className="flex items-center justify-between pt-4 border-t border-border-light">
                    <div className="font-semibold text-primary-brown">
                      {review.author}
                    </div>
                    <div className="text-sm text-text-gray">
                      {review.date}
                    </div>
                  </div>

                  {/* Featured Badge */}
                  {review.featured && (
                    <div className="mt-4 text-center">
                      <span className="inline-block px-4 py-1 bg-gradient-to-r from-primary-orange to-accent-lightOrange text-white rounded-full text-xs font-bold">
                        ⭐ 베스트 후기
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Rating Distribution */}
      {reviews.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-[1400px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
                평점 분포
              </h2>
            </div>

            <div className="max-w-2xl mx-auto">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = reviews.filter(r => r.rating === rating).length
                const percentage = (count / reviews.length) * 100

                return (
                  <div key={rating} className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1 w-20">
                      <Star className="w-4 h-4 fill-primary-orange text-primary-orange" />
                      <span className="font-semibold text-primary-brown">{rating}</span>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary-orange to-accent-lightOrange h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-20 text-right text-sm text-text-gray">
                      {count}개 ({percentage.toFixed(0)}%)
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials - 특별 후기 */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              감동 사연
            </h2>
            <p className="text-lg text-text-gray">
              가장 마음이 따뜻해지는 순간들
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-primary-orange/10 to-accent-peach/10 rounded-3xl border-2 border-primary-orange/20 p-8">
              <div className="text-5xl mb-4">💝</div>
              <h3 className="text-xl font-bold text-primary-brown mb-3">
                "어머니가 다시 웃기 시작하셨어요"
              </h3>
              <p className="text-text-gray leading-relaxed mb-4">
                치매로 무표정하시던 어머니께서 행복한요양원에 오신 후 조금씩 표정이 밝아지시더니, 
                이제는 프로그램 시간마다 웃음소리가 들립니다. 요양보호사님들의 정성 어린 케어 덕분입니다.
              </p>
              <div className="text-sm text-primary-orange font-semibold">
                — 이** 님
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-green/10 to-primary-green/5 rounded-3xl border-2 border-primary-green/20 p-8">
              <div className="text-5xl mb-4">🌟</div>
              <h3 className="text-xl font-bold text-primary-brown mb-3">
                "마치 가족이 돌보는 것 같아요"
              </h3>
              <p className="text-text-gray leading-relaxed mb-4">
                아버지의 작은 변화까지 세심하게 관찰하시고 알려주십니다. 
                건강 상태뿐 아니라 기분, 식사량까지 꼼꼼히 체크해주셔서 정말 감사합니다.
              </p>
              <div className="text-sm text-primary-green font-semibold">
                — 박** 님
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Write Review CTA */}
      <section className="py-20 bg-gradient-to-r from-primary-brown to-primary-brown/90">
        <div className="max-w-[1400px] mx-auto px-6 text-center text-white">
          <MessageCircle className="w-16 h-16 mx-auto mb-6" />
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6">
            이용 후기를 남겨주세요
          </h2>
          <p className="text-xl mb-8 opacity-95">
            소중한 후기는 다른 가족들에게 큰 도움이 됩니다
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact?type=review"
              className="px-8 py-4 bg-white text-primary-brown rounded-full font-bold text-lg hover:shadow-xl transition-all hover:-translate-y-1"
            >
              후기 작성하기
            </Link>
            <Link
              href="/contact"
              className="px-8 py-4 bg-white/20 backdrop-blur-sm border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/30 transition-all"
            >
              상담 신청하기
            </Link>
          </div>
          <p className="mt-6 text-sm opacity-75">
            * 후기는 관리자 검토 후 게시됩니다
          </p>
        </div>
      </section>
    </div>
  )
}