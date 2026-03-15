'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Phone, Calendar, MessageCircle, MapPin, Clock, Star, Shield } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-care.jpg"
          alt="따뜻한 미소로 어르신을 돌보는 전문 케어 인력"
          fill
          priority
          className="object-cover object-center"
          quality={90}
        />
        
        {/* Gradient Overlay - 자연스러운 그라데이션 */}
        <div className="hero-overlay" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Main Content */}
          <div className="space-y-8">
            {/* Trust Badge - Floating Animation */}
            <div className="inline-flex items-center gap-2 glass-badge animate-float">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700">
                보호자 만족도 4.9/5.0
              </span>
            </div>

            {/* Main Headline - Glass Panel */}
            <div className="glass-panel space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-shadow-premium">
                <span className="text-gray-900">어르신은 편안하게,</span>
                <br />
                <span className="text-orange-600">보호자는 안심하게</span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-gray-700 leading-relaxed">
                24시간 전문 케어와 가족같은 따뜻함으로
                <br />
                행복한 노후를 함께 만들어갑니다
              </p>
            </div>

            {/* Key Features */}
            <div className="glass-panel-light grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">정부 인증</div>
                  <div className="text-sm text-gray-600">장기요양기관</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">24시간</div>
                  <div className="text-sm text-gray-600">전문 간호</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">녹양역</div>
                  <div className="text-sm text-gray-600">도보 5분</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Star className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">234명</div>
                  <div className="text-sm text-gray-600">보호자 후기</div>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Primary CTA */}
              <a
                href="tel:0318568090"
                className="cta-primary group"
              >
                <Phone className="w-5 h-5 group-hover:animate-pulse" />
                <div className="text-left">
                  <div className="font-bold">전화 상담</div>
                  <div className="text-sm opacity-90">031-856-8090</div>
                </div>
              </a>

              {/* Secondary CTA */}
              <Link
                href="/contact#visit"
                className="cta-secondary group"
              >
                <Calendar className="w-5 h-5" />
                <span className="font-semibold">방문 예약</span>
              </Link>
            </div>

            {/* Tertiary CTA */}
            <div className="flex items-center gap-4">
              <a
                href="http://pf.kakao.com/_xoVxexj/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-orange-600 transition-colors flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>카카오톡 상담하기</span>
              </a>
              <span className="text-gray-300">|</span>
              <p className="text-sm text-gray-600">
                평일 9시~6시 상담 가능
              </p>
            </div>
          </div>

          {/* Right Column: Trust Indicators */}
          <div className="hidden lg:block space-y-6">
            {/* Stats Card - Pulse Animation */}
            <div className="glass-card animate-pulse-soft">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-600 mb-2">50+</div>
                  <div className="text-sm text-gray-600">현재 입소 어르신</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">15+</div>
                  <div className="text-sm text-gray-600">전문 케어 인력</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">100%</div>
                  <div className="text-sm text-gray-600">정부 인증 시설</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600 mb-2">4.9</div>
                  <div className="text-sm text-gray-600">보호자 만족도</div>
                </div>
              </div>
            </div>

            {/* Certifications */}
            <div className="glass-card space-y-4">
              <h3 className="font-bold text-gray-900 mb-4">인증 현황</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-700">장기요양기관 인증</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-700">의료법인 운영</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-700">소방안전 인증</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-700">위생 우수 등급</span>
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="glass-card-light p-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
                <div className="text-sm">
                  <div className="font-semibold text-gray-900 mb-1">
                    의정부시 녹양동
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    녹양역 1번 출구 도보 5분
                    <br />
                    주차 가능 · 대중교통 편리
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator - Bounce Animation */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce-soft">
        <div className="flex flex-col items-center gap-2 text-white">
          <span className="text-sm font-medium text-shadow-sm">아래로 스크롤</span>
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>
    </section>
  )
}