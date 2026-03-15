'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Phone, MessageCircle, MapPin, Award } from 'lucide-react'

const slides = [
  {
    image: '/assets/images/hero-6-image.png',
    alt: '어르신들이 함께 운동 프로그램에 참여하는 모습',
    position: 'object-center',
  },
  {
    image: '/assets/images/hero-7-image.png',
    alt: '어르신들이 즐겁게 대화하며 식사하는 모습',
    position: 'object-[60%_center]',
  },
  {
    image: '/assets/images/hero-8-image.png',
    alt: '케어 선생님과 어르신이 함께 웃는 모습',
    position: 'object-center',
  },
  {
    image: '/assets/images/hero-9-image.png',
    alt: '어르신들이 원예 활동을 즐기는 모습',
    position: 'object-[55%_center]',
  },
]

export default function HeroSliderMobile() {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative min-h-[680px] overflow-hidden bg-[#f8f4ee]">
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.image}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={index !== currentSlide}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              priority={index === 0}
              quality={92}
              className={`object-cover brightness-[1.12] ${slide.position}`}
            />
          </div>
        ))}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.00)_0%,rgba(255,255,255,0.00)_48%,rgba(0,0,0,0.08)_100%)]" />
      </div>

      <div className="relative z-20 flex min-h-[680px] items-end px-4 pb-28 pt-24">
        <div className="w-full max-w-[320px]">
          <div className="rounded-[24px] border border-white/70 bg-white/74 p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-[6px]">
            {/* Badge */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#fed7aa] bg-[#fff7ed]/95 px-3 py-1.5">
              <Award className="h-3.5 w-3.5 text-orange-500" />
              <span className="font-body text-[11px] font-semibold text-[#9a5a18]">
                자매시설 A등급 운영 노하우
              </span>
            </div>

            {/* Headline */}
            <div>
              <h1 className="font-hero text-[1.9rem] font-bold leading-[1.18] tracking-[-0.03em] text-[#18212b]">
                가족처럼 모시는
                <br />
                <span className="text-orange-500">행복한요양원 녹양역점</span>
              </h1>

              <p className="mt-3 font-body text-[14px] leading-relaxed text-[#4b5563]">
                따뜻한 돌봄과 편안한 생활 환경을 제공합니다.
              </p>
            </div>

            {/* Quick facts */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#fff7ed]/95 px-3 py-1.5 text-[11px] font-semibold text-[#9a5a18]">
                전문 요양보호사
              </span>
              <span className="rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-medium text-[#4b5563]">
                최신 시설
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-medium text-[#4b5563]">
                <MapPin className="h-3.5 w-3.5" />
                녹양역 8분
              </span>
            </div>

            {/* Phone */}
            <div className="mt-4 rounded-2xl bg-[#fffaf5]/95 px-4 py-3">
              <div className="font-body text-[11px] font-medium text-[#8b95a1]">
                입소 상담 문의
              </div>
              <a
                href="tel:0318568090"
                className="mt-1 inline-flex items-center gap-2 font-body text-[1.5rem] font-extrabold tracking-[-0.03em] text-orange-600"
              >
                <Phone className="h-5 w-5" />
                031-856-8090
              </a>
            </div>

            {/* CTA */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href="tel:0318568090"
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(249,115,22,0.20)] transition active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" />
                전화상담
              </a>

              <a
                href="#contact"
                target="_self"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/85 bg-white/94 px-4 py-3.5 text-sm font-bold text-[#1f2937] shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                온라인 상담
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-8 left-0 right-0 z-30">
        <div className="flex justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              aria-label={`${index + 1}번째 이미지로 이동`}
              className={`h-2.5 rounded-full transition-all ${
                index === currentSlide
                  ? 'w-8 bg-white shadow-md'
                  : 'w-2.5 bg-white/65'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}