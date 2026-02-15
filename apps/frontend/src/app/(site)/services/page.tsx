import React from 'react'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Check, ArrowRight, Clock, Users, Heart, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: '서비스 | 행복한요양원',
  description: '24시간 전문 간호, 영양 맞춤 식단, 다양한 프로그램, 쾌적한 환경. 차별화된 서비스로 최상의 케어를 제공합니다.',
}

export default async function ServicesPage() {
  // DB에서 서비스 가져오기
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
  })

  // 차별화 포인트 가져오기
  const differentiators = await prisma.differentiator.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
  })

  return (
    <div className="min-h-screen bg-bg-cream pt-20">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20">
        <div className="max-w-[1400px] mx-auto px-6 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6">
            최상의 케어를 제공합니다
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-95 max-w-3xl mx-auto">
            전문성과 진심이 담긴 서비스로
            <br />
            어르신들의 행복한 삶을 지원합니다
          </p>
        </div>
      </section>

      {/* Main Services */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              주요 서비스
            </h2>
            <p className="text-lg text-text-gray">
              행복한요양원의 핵심 서비스를 소개합니다
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <div
                key={service.id}
                className="bg-white rounded-3xl border-2 border-border-light p-8 hover:border-primary-orange hover:shadow-large transition-all duration-300 hover:-translate-y-2"
              >
                <div className="text-6xl mb-6">{service.icon}</div>
                <h3 className="text-2xl font-bold text-primary-brown mb-4">
                  {service.title}
                </h3>
                <p className="text-text-gray leading-relaxed mb-6">
                  {service.description}
                </p>
                {service.imageUrl && (
                  <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden">
                    <img
                      src={service.imageUrl}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Service Breakdown */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              상세 서비스 안내
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* 24시간 전문 간호 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary-orange rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-primary-brown">24시간 전문 간호</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">간호사 24시간 상주 시스템</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">요양보호사 1:5 비율 유지</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">정기 건강 체크 및 기록</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">응급 상황 즉시 대응</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">약물 관리 및 투약</span>
                </li>
              </ul>
            </div>

            {/* 영양 맞춤 식단 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary-green rounded-full flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-primary-brown">영양 맞춤 식단</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">영양사 설계 균형 식단</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">개인별 식이 조절 (당뇨, 고혈압 등)</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">제철 식재료 사용</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">특식 및 간식 제공</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">월간 식단표 공유</span>
                </li>
              </ul>
            </div>

            {/* 다양한 프로그램 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-accent-lightOrange rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-primary-brown">다양한 프로그램</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">인지 활동 프로그램 (회상, 퍼즐, 보드게임)</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">작업 치료 (원예, 미술, 공예)</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">음악 치료 및 레크리에이션</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">물리 치료 및 재활 운동</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">계절별 특별 행사</span>
                </li>
              </ul>
            </div>

            {/* 쾌적한 환경 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary-brown rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-primary-brown">쾌적한 환경</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">넓고 깨끗한 개인/공용 공간</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">냉난방 완비 쾌적한 실내 온도</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">매일 청소 및 소독</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">안전 손잡이 및 미끄럼 방지</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">정원 및 산책로</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              차별화된 강점
            </h2>
            <p className="text-lg text-text-gray">
              행복한요양원만의 특별함
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {differentiators.map((diff) => {
              const colorClasses = {
                orange: 'from-primary-orange/10 to-accent-peach/10 border-primary-orange/20',
                green: 'from-primary-green/10 to-primary-green/5 border-primary-green/20',
                brown: 'from-primary-brown/10 to-primary-brown/5 border-primary-brown/20',
              }
              
              return (
                <div
                  key={diff.id}
                  className={`bg-gradient-to-br ${colorClasses[diff.color as keyof typeof colorClasses] || colorClasses.orange} border-2 rounded-3xl p-8`}
                >
                  <div className="text-5xl mb-4">{diff.icon}</div>
                  <h3 className="text-xl font-bold text-primary-brown mb-3">
                    {diff.title}
                  </h3>
                  <p className="text-text-gray leading-relaxed">
                    {diff.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Weekly Schedule */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              주간 프로그램 일정
            </h2>
            <p className="text-lg text-text-gray">
              매일 다양한 활동으로 활기찬 생활
            </p>
          </div>

          <div className="bg-bg-cream rounded-3xl border-2 border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary-brown text-white">
                    <th className="px-6 py-4 text-left font-semibold">시간</th>
                    <th className="px-6 py-4 text-left font-semibold">월</th>
                    <th className="px-6 py-4 text-left font-semibold">화</th>
                    <th className="px-6 py-4 text-left font-semibold">수</th>
                    <th className="px-6 py-4 text-left font-semibold">목</th>
                    <th className="px-6 py-4 text-left font-semibold">금</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  <tr className="bg-white">
                    <td className="px-6 py-4 font-semibold text-primary-brown">10:00</td>
                    <td className="px-6 py-4">인지활동</td>
                    <td className="px-6 py-4">회상치료</td>
                    <td className="px-6 py-4">인지활동</td>
                    <td className="px-6 py-4">미술치료</td>
                    <td className="px-6 py-4">음악치료</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-6 py-4 font-semibold text-primary-brown">14:00</td>
                    <td className="px-6 py-4">원예활동</td>
                    <td className="px-6 py-4">작업치료</td>
                    <td className="px-6 py-4">체조/운동</td>
                    <td className="px-6 py-4">레크리에이션</td>
                    <td className="px-6 py-4">특별행사</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-6 py-4 font-semibold text-primary-brown">15:30</td>
                    <td className="px-6 py-4" colSpan={5} className="px-6 py-4 text-center text-text-gray">
                      간식 시간 및 휴식
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-text-gray">
            * 프로그램 일정은 상황에 따라 변경될 수 있습니다
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-primary-orange to-accent-lightOrange">
        <div className="max-w-[1400px] mx-auto px-6 text-center text-white">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6">
            더 자세한 정보가 필요하신가요?
          </h2>
          <p className="text-xl mb-8 opacity-95">
            상담을 통해 맞춤형 서비스를 안내해드립니다
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-full font-bold text-lg hover:shadow-xl transition-all hover:-translate-y-1"
            >
              상담 신청하기
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 bg-white/20 backdrop-blur-sm border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/30 transition-all"
            >
              요금 안내 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}