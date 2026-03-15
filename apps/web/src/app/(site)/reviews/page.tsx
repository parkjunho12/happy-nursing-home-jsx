import { Metadata } from 'next'
import Link from 'next/link'
import {
  Star,
  CheckCircle,
  ChevronRight,
  MessageCircle,
  Phone,
  Clock3,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react'

export const metadata: Metadata = {
  title: '보호자 상담 후기 | 행복한요양원 녹양역점',
  description:
    '행복한요양원 녹양역점 상담 후 보호자분들이 남겨주신 반응과 상담 안내 내용을 확인해보세요.',
}

export default function ReviewsPage() {
  const consultationStats = {
    total: 18,
    average: 4.9,
    distribution: [
      { stars: 5, count: 16, percentage: 89 },
      { stars: 4, count: 2, percentage: 11 },
      { stars: 3, count: 0, percentage: 0 },
      { stars: 2, count: 0, percentage: 0 },
      { stars: 1, count: 0, percentage: 0 },
    ],
  }

  const consultationReviews = [
    {
      id: '1',
      author: '김**님',
      relation: '딸',
      rating: 5,
      date: '2026년 2월',
      title: '설명을 차분하게 잘 해주셔서 마음이 놓였습니다',
      content:
        '처음 요양원을 알아보는 입장이라 모르는 것이 많았는데, 장기요양등급부터 비용까지 하나씩 차분하게 설명해주셔서 부담이 덜했습니다. 급하게 결정하라고 하지 않고 보호자 입장에서 안내해주시는 점이 좋았습니다.',
      verified: true,
      helpful: 12,
    },
    {
      id: '2',
      author: '박**님',
      relation: '아들',
      rating: 5,
      date: '2026년 2월',
      title: '비용 부분을 솔직하게 알려주셔서 좋았습니다',
      content:
        '요양원 비용이 가장 걱정이었는데 본인부담금과 비급여 항목을 구분해서 쉽게 설명해주셔서 이해가 잘 됐습니다. 과장 없이 현실적으로 안내해주셔서 신뢰가 갔습니다.',
      verified: true,
      helpful: 10,
    },
    {
      id: '3',
      author: '이**님',
      relation: '며느리',
      rating: 5,
      date: '2026년 1월',
      title: '입소 절차가 정리되는 상담이었습니다',
      content:
        '무엇을 준비해야 하는지 막막했는데 상담을 받고 나니 입소 절차와 준비서류가 머릿속에 정리됐습니다. 보호자가 어떤 부분을 먼저 확인해야 하는지도 알려주셔서 도움이 많이 됐습니다.',
      verified: true,
      helpful: 8,
    },
    {
      id: '4',
      author: '최**님',
      relation: '딸',
      rating: 5,
      date: '2026년 1월',
      title: '부모님 모시는 마음을 이해해주는 상담이었습니다',
      content:
        '시설 설명만 하는 상담이 아니라 보호자의 걱정과 상황을 먼저 들어주셔서 좋았습니다. 바로 결정하라고 하지 않고 충분히 생각해보시라고 해주셔서 오히려 더 믿음이 갔습니다.',
      verified: true,
      helpful: 9,
    },
    {
      id: '5',
      author: '정**님',
      relation: '아들',
      rating: 4,
      date: '2026년 2월',
      title: '처음 문의하는 분들에게 도움이 될 것 같습니다',
      content:
        '요양원 상담이 처음이라 긴장했는데 어렵지 않게 설명해주셔서 편하게 상담받을 수 있었습니다. 장기요양보험, 등급, 비용 같은 내용도 쉽게 말씀해주셔서 처음 알아보는 분들에게 도움이 될 것 같습니다.',
      verified: true,
      helpful: 6,
    },
    {
      id: '6',
      author: '강**님',
      relation: '손녀',
      rating: 5,
      date: '2026년 2월',
      title: '편하게 질문할 수 있는 상담이었습니다',
      content:
        '질문이 많았는데도 하나하나 친절하게 답해주셔서 감사했습니다. 보호자 입장에서 궁금한 부분을 편하게 물어볼 수 있었고, 전체적으로 상담 분위기가 편안해서 좋았습니다.',
      verified: true,
      helpful: 7,
    },
  ]

  const trustPoints = [
    '장기요양등급, 비용, 입소 절차를 쉽게 설명해드립니다.',
    '아직 개원 전이므로 실제 이용후기가 아닌 상담 반응만 정리해 안내드립니다.',
    '과장된 표현보다 보호자 입장에서 필요한 정보를 정확하게 말씀드립니다.',
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20 lg:py-28">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-sm font-medium mb-6">
            <Clock3 className="w-4 h-4" />
            현재 개원 준비 중 · 보호자 상담 가능
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            보호자 상담 후기
          </h1>

          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            행복한요양원 녹양역점 상담 후
            <br />
            보호자분들이 남겨주신 반응을 소개합니다
          </p>
        </div>
      </section>

      {/* Honest notice */}
      <section className="py-10 bg-amber-50 border-b border-amber-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white border border-amber-200 p-6 lg:p-8 shadow-sm">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
              안내드립니다
            </h2>
            <p className="text-gray-700 leading-relaxed">
              행복한요양원 녹양역점은 현재 개원 준비 중입니다. 아래 내용은
              <strong className="text-gray-900"> 실제 이용후기</strong>가 아니라,
              <strong className="text-gray-900"> 입소 상담 및 문의 과정에서 보호자분들이 남겨주신 반응</strong>
              을 바탕으로 정리한 상담 후기입니다.
            </p>
          </div>
        </div>
      </section>

      {/* Trust points */}
      <section className="py-14 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-50 text-primary-orange mb-4">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                보호자 중심 상담
              </h3>
              <p className="text-gray-700 leading-relaxed">
                처음 요양원을 알아보시는 분도 이해하기 쉽도록 차분하게 안내해드립니다.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                솔직한 비용 설명
              </h3>
              <p className="text-gray-700 leading-relaxed">
                본인부담금과 비급여 항목을 구분해 실제 부담하실 비용을 쉽게 설명합니다.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-50 text-green-600 mb-4">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                무리한 권유 없는 안내
              </h3>
              <p className="text-gray-700 leading-relaxed">
                충분히 비교하고 생각하실 수 있도록 필요한 정보부터 정직하게 안내드립니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-block">
                <div className="text-6xl font-bold text-gray-900 mb-2">
                  {consultationStats.average}
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-8 h-8 ${
                        i < Math.floor(consultationStats.average)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-gray-600">
                  총{' '}
                  <strong className="text-gray-900">
                    {consultationStats.total}건
                  </strong>
                  의 상담 반응
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {consultationStats.distribution.map((item) => (
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
                    {item.count}건
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              아래 평점과 반응은{' '}
              <strong className="text-gray-900">상담 만족도 기준</strong>으로
              정리한 내용이며, 실제 시설 이용 후기가 아닙니다.
            </p>
          </div>
        </div>
      </section>

      {/* Reviews List */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              상담 후 남겨주신 말씀
            </h2>
            <p className="text-lg text-gray-600">
              실제 상담 과정에서 보호자분들이 자주 말씀해주신 내용을 정리했습니다.
            </p>
          </div>

          <div className="space-y-6">
            {consultationReviews.map((review) => (
              <div
                key={review.id}
                className="bg-gray-50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">
                        {review.author}
                      </span>
                      <span className="text-gray-500">({review.relation})</span>

                      {review.verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          상담 확인
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

                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {review.title}
                </h3>

                <p className="text-gray-700 leading-relaxed mb-4">
                  {review.content}
                </p>

                <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                  <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-orange transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    공감돼요 ({review.helpful})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why 상담 먼저 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white p-8 lg:p-10 shadow-sm border border-gray-100">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 text-center">
              이런 분들께 상담이 도움이 됩니다
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              {trustPoints.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4"
                >
                  <CheckCircle className="w-5 h-5 text-primary-orange mt-0.5 shrink-0" />
                  <p className="text-gray-700 leading-relaxed">{item}</p>
                </div>
              ))}
              <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4">
                <CheckCircle className="w-5 h-5 text-primary-orange mt-0.5 shrink-0" />
                <p className="text-gray-700 leading-relaxed">
                  부모님 상태에 맞는 입소 준비 방향을 미리 상담받고 싶은 분께
                  적합합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            입소 상담은 지금 가능합니다
          </h2>
          <p className="text-xl mb-8 text-white/90 leading-relaxed">
            비용, 등급, 입소 절차가 궁금하시면
            <br className="hidden sm:block" />
            편하게 문의주세요. 차분하게 안내드리겠습니다.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              상담 문의하기
              <ChevronRight className="w-5 h-5" />
            </Link>

            <a
              href="tel:031-856-8090"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
            >
              <Phone className="w-5 h-5" />
              031-856-8090
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}