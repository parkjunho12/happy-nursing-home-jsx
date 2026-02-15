import { Metadata } from 'next'
import Link from 'next/link'
import { Clock, Users, Award, Heart, Shield, Sparkles, MapPin, Phone, Mail, ChevronRight } from 'lucide-react'
import { SITE_INFO, TRUST_INDICATORS } from '@/lib/constants'
import KakaoMap from '@/components/map/KaKaoMap'

export const metadata: Metadata = {
  title: '시설 소개 | 행복한요양원 녹양역점',
  description: '15년 전통의 행복한요양원 녹양역점을 소개합니다. 전문 간호사 24시간 상주, 쾌적한 환경, A등급 인증 시설.',
}

export default function AboutPage() {
  const features = [
    {
      icon: <Clock className="w-8 h-8" />,
      title: '24시간 전문 케어',
      description: '간호사와 요양보호사가 24시간 상주하여 안전하고 전문적인 케어를 제공합니다',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: '1:5 직원 비율',
      description: '일반 요양원보다 2배 많은 인력으로 더욱 세심한 케어를 제공합니다',
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: 'A등급 인증 시설',
      description: '양주시 노인요양시설 평가에서 최고 등급을 획득한 검증된 시설입니다',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: '개별 맞춤 케어',
      description: '입소자 개개인의 건강 상태와 생활 습관을 고려한 맞춤형 케어 계획',
      color: 'bg-pink-100 text-pink-600',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: '안전한 환경',
      description: '낙상 방지, CCTV 모니터링, 응급 콜 시스템 등 안전 시스템 완비',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: '쾌적한 시설',
      description: '깨끗하고 밝은 환경, 개인 및 공용 공간의 쾌적한 유지 관리',
      color: 'bg-yellow-100 text-yellow-600',
    },
  ]

  const timeline = [
    { year: '2010', event: '행복한요양원 개원', icon: '🏥' },
    { year: '2012', event: '양주시 우수 요양시설 선정', icon: '🏆' },
    { year: '2015', event: 'A등급 인증 획득', icon: '⭐' },
    { year: '2018', event: '증축 및 리모델링', icon: '🏗️' },
    { year: '2020', event: '우수 프로그램 운영 시설 선정', icon: '🎯' },
    { year: '2024', event: '15주년 감사 이벤트', icon: '🎉' },
  ]

  const facilities = [
    { name: '침실', description: '1인실, 2인실, 4인실 선택 가능' },
    { name: '식당', description: '밝고 쾌적한 공용 식당' },
    { name: '물리치료실', description: '전문 재활 치료 시설' },
    { name: '프로그램실', description: '다양한 활동 공간' },
    { name: '정원', description: '산책과 휴식을 위한 정원' },
    { name: '의무실', description: '간호사 상주 의무실' },
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20 lg:py-32">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              행복한요양원 녹양역점
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
              {SITE_INFO.slogan}
            </p>
            <div className="flex flex-wrap justify-center gap-8 lg:gap-16 mt-12">
              {TRUST_INDICATORS.map((indicator) => (
                <div key={indicator.id} className="text-center">
                  <div className="text-4xl lg:text-5xl font-bold mb-2">
                    {indicator.value}
                    <span className="text-2xl lg:text-3xl ml-1">{indicator.unit}</span>
                  </div>
                  <div className="text-white/80 text-sm lg:text-base">{indicator.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-gray-900">
                어르신을 가족처럼<br />모십니다
              </h2>
              <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                <p>
                  행복한요양원 녹양역점은 2010년 개원 이래 <strong className="text-primary-orange">15년간</strong> 어르신들의 행복하고 건강한 노후를 위해 최선을 다해왔습니다.
                </p>
                <p>
                  우리는 단순히 요양 서비스를 제공하는 것이 아니라, <strong className="text-primary-orange">어르신 한 분 한 분을 가족처럼 모시며</strong> 존엄과 행복을 지켜드리는 것을 최우선 가치로 삼고 있습니다.
                </p>
                <p>
                  전문 간호사와 요양보호사가 24시간 상주하며, 개별 맞춤형 케어 플랜을 통해 어르신의 건강 상태와 생활 습관을 세심하게 관리합니다.
                </p>
                <p>
                  양주시 노인요양시설 평가에서 <strong className="text-primary-orange">A등급</strong>을 획득한 검증된 시설로서, 안전하고 쾌적한 환경에서 질 높은 요양 서비스를 제공하고 있습니다.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors"
                >
                  상담 신청하기
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors"
                >
                  서비스 보기
                </Link>
              </div>
            </div>
            <div className="order-1 lg:order-2 relative h-96 lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-orange/20 to-primary-green/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-8xl lg:text-9xl">🏥</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              행복한요양원의 특별함
            </h2>
            <p className="text-xl text-gray-600">
              어르신의 행복한 노후를 위한 6가지 핵심 가치
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-16 h-16 rounded-xl ${feature.color} flex items-center justify-center mb-6`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              15년의 역사
            </h2>
            <p className="text-xl text-gray-600">
              함께 걸어온 감사한 시간들
            </p>
          </div>

          <div className="space-y-8">
            {timeline.map((item, index) => (
              <div
                key={index}
                className="relative flex items-center gap-6 group"
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-primary-orange to-primary-brown rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                
                {/* Content */}
                <div className="flex-1 bg-gray-50 rounded-xl p-6 group-hover:bg-white group-hover:shadow-md transition-all">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-2xl font-bold text-primary-orange">
                      {item.year}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <p className="text-lg text-gray-700 font-medium">
                    {item.event}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facilities */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              주요 시설
            </h2>
            <p className="text-xl text-gray-600">
              어르신의 편안한 생활을 위한 다양한 시설
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilities.map((facility, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  {facility.name}
                </h3>
                <p className="text-gray-600">{facility.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location & Contact */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-8 text-gray-900">
                오시는 길
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <MapPin className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">주소</div>
                    <div className="text-gray-700">{SITE_INFO.address.full}</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <Phone className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">전화번호</div>
                    <a 
                      href={`tel:${SITE_INFO.phone}`} 
                      className="text-gray-700 hover:text-primary-orange transition-colors"
                    >
                      {SITE_INFO.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <Mail className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">이메일</div>
                    <a 
                      href={`mailto:${SITE_INFO.email}`}
                      className="text-gray-700 hover:text-primary-orange transition-colors"
                    >
                      {SITE_INFO.email}
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors w-full md:w-auto justify-center"
                >
                  상담 신청하기
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>

            {/* Map */}
            <div className="h-96 bg-gray-200 rounded-2xl overflow-hidden shadow-lg">
                <KakaoMap
                  lat={37.76774123217728}
                  lng={127.04359415733941}
                  level={3}
                  markerTitle="행복한요양원 (녹양역 근처)"
                  height="100%"   // ✅ 부모 높이에 맞추기
                />
              </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            지금 바로 상담 받아보세요
          </h2>
          <p className="text-xl mb-8 text-white/90">
            전문 상담원이 친절하게 안내해 드립니다
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`tel:${SITE_INFO.phone}`}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              <Phone className="w-5 h-5" />
              전화 상담
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
            >
              온라인 상담
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}