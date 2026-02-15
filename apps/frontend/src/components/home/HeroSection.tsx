import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SITE_INFO, TRUST_INDICATORS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Phone, CalendarCheck } from 'lucide-react'

export default function HeroSection() {
  const telHref = `tel:${SITE_INFO.phone}`

  return (
    <section
      className="relative mt-20 min-h-[700px] bg-gradient-to-br from-bg-cream via-[#FFF8F3] to-[#FFE8D6] overflow-hidden"
      aria-label="행복한요양원 소개"
    >
      {/* Decorative Background Circle */}
      <div
        className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-primary-orange/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-[1400px] mx-auto px-6 py-20 md:py-32 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="text-center md:text-left animate-fade-in-up">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary-brown leading-tight mb-6">
              <span className="text-primary-orange">가족처럼 따뜻하게</span>,
              <br />
              전문가처럼 안전하게
            </h1>

            <p className="text-lg md:text-xl text-text-gray mb-10">
              {SITE_INFO.name}에서 행복한 노후를 시작하세요
            </p>

            {/* Trust Indicators */}
            <dl className="flex justify-center md:justify-start gap-6 md:gap-8 mb-12">
              {TRUST_INDICATORS.map((indicator) => (
                <div key={indicator.id} className="text-center">
                  <dt className="sr-only">{indicator.label}</dt>
                  <dd className="text-3xl md:text-4xl font-bold text-primary-orange font-serif">
                    {indicator.value}
                    {indicator.unit}
                  </dd>
                  <p className="text-xs md:text-sm text-text-gray mt-1">
                    {indicator.label}
                  </p>
                </div>
              ))}
            </dl>

            {/* CTA Buttons (NO onClick - Server friendly) */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              {/* 전화 상담: tel 링크 */}
              <a href={telHref} aria-label={`전화 상담: ${SITE_INFO.phone}`}>
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon={<Phone className="w-5 h-5" />}
                >
                  전화 상담
                </Button>
              </a>

              {/* 방문 예약: contact 섹션 앵커 이동 */}
              <a href="#contact" aria-label="상담/방문 예약 섹션으로 이동">
                <Button
                  variant="secondary"
                  size="lg"
                  leftIcon={<CalendarCheck className="w-5 h-5" />}
                >
                  방문 예약
                </Button>
              </a>
            </div>

            {/* 보조 링크(선택): 문의 페이지로 이동 */}
            <div className="mt-4 text-sm text-text-gray">
              또는{' '}
              <Link
                href="/contact"
                className="text-primary-orange font-semibold underline underline-offset-4"
              >
                온라인 상담 신청
              </Link>
              도 가능합니다.
            </div>
          </div>

          {/* Right Image */}
          <div className="relative h-[400px] md:h-[500px] animate-fade-in">
            <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl relative group">
              <Image
                src="/assets/images/exterior.png"
                alt="행복한요양원 외관 전경"
                fill
                priority
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 50vw"
              />

              {/* Overlay Gradient (가독성 + 고급감) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

              {/* Badge */}
              <div className="absolute top-6 right-6 bg-white px-6 py-3 rounded-full font-bold text-primary-orange shadow-xl">
                ⭐ 지자체 A등급
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Wave */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 bg-white"
        style={{ clipPath: 'polygon(0 50%, 100% 0, 100% 100%, 0 100%)' }}
        aria-hidden="true"
      />
    </section>
  )
}
