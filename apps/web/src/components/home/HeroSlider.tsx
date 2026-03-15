'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Phone,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Award,
  MapPin,
  ShieldCheck,
} from 'lucide-react'

const slides = [
  {
    image: '/assets/images/hero-6-image.png',
    alt: '어르신들이 함께 운동 프로그램에 참여하는 모습',
    position: 'object-center',
  },
  {
    image: '/assets/images/hero-7-image.png',
    alt: '어르신들이 즐겁게 대화하며 식사하는 모습',
    position: 'object-[58%_center]',
  },
  {
    image: '/assets/images/hero-8-image.png',
    alt: '케어 선생님과 어르신이 함께 웃는 모습',
    position: 'object-center',
  },
  {
    image: '/assets/images/hero-9-image.png',
    alt: '어르신들이 원예 활동을 즐기는 모습',
    position: 'object-[56%_center]',
  },
]

export default function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5200)

    return () => clearInterval(timer)
  }, [])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  return (
    <section className="relative min-h-[800px] overflow-hidden bg-[#f8f4ee]">
      {/* Background */}
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.image}
            className={`absolute inset-0 transition-opacity duration-[1400ms] ${
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
              className={`object-cover brightness-[1.08] ${slide.position}`}
            />
          </div>
        ))}

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,243,236,0.78)_0%,rgba(248,243,236,0.56)_20%,rgba(255,255,255,0.20)_42%,rgba(255,255,255,0.04)_64%,rgba(255,255,255,0)_80%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0)_72%,rgba(0,0,0,0.04)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-20 flex min-h-[800px] items-center">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10">
          <div className="max-w-[680px] pt-20 pb-20">
            {/* Badge */}
            <div className="hero-animate hero-delay-1 mb-6 inline-flex items-center gap-2 rounded-full border border-[#fed7aa] bg-white/86 px-4 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
              <Award className="h-4 w-4 text-orange-500" />
              <span className="font-body text-[13px] font-semibold text-[#8a5418]">
                A등급 자매시설 운영 노하우
              </span>
            </div>

            {/* Headline */}
            <div className="max-w-[620px]">
              <div className="hero-animate hero-delay-2 mb-4 h-px w-16 bg-gradient-to-r from-orange-300 to-transparent" />

              <h1 className="hero-animate hero-delay-2 font-hero text-balance text-[2.35rem] font-bold leading-[1.06] tracking-[-0.045em] text-[#142132] sm:text-[3rem] lg:text-[3.7rem]">
                어르신을 가족처럼 모시는
                <br />
                <span className="text-orange-500">행복한요양원</span>
              </h1>

              <p className="hero-animate hero-delay-3 font-body mt-4 inline-flex items-center gap-2 rounded-full bg-white/72 px-3.5 py-2 text-[13px] font-semibold text-[#334155] shadow-[0_4px_12px_rgba(15,23,42,0.04)] backdrop-blur-sm sm:text-[14px]">
                <MapPin className="h-4 w-4 text-orange-500" />
                녹양역 도보 8분 · 생활 중심 케어
              </p>
            </div>

            {/* Soft content panel */}
            <div className="hero-animate-soft hero-delay-4 mt-6 max-w-[560px] rounded-[24px] border border-white/80 bg-[rgba(255,250,245,0.76)] px-5 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.07)] backdrop-blur-md sm:px-6 sm:py-6">
              <p className="font-body text-[15px] leading-[1.8] text-[#334155] sm:text-[16px]">
                전문 요양보호사가 함께하는
                편안한 생활 중심 케어를 제공합니다.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="font-body inline-flex items-center gap-2 rounded-full bg-white/88 px-3.5 py-2 text-[13px] font-medium text-[#475569] shadow-[0_4px_10px_rgba(15,23,42,0.03)]">
                  <ShieldCheck className="h-4 w-4 text-orange-500" />
                  정부 기준 준수
                </span>

                <span className="font-body inline-flex items-center gap-2 rounded-full bg-white/88 px-3.5 py-2 text-[13px] font-medium text-[#475569] shadow-[0_4px_10px_rgba(15,23,42,0.03)]">
                  최신 시설
                </span>
              </div>

              <div className="mt-5 border-t border-[#e7ded4] pt-4">
                <p className="font-body text-[13px] font-semibold tracking-[0.01em] text-[#475569]">
                  입소 상담 문의
                </p>

                <a
                  href="tel:0318568090"
                  className="group mt-2 inline-flex items-end gap-2.5 transition"
                >
                  <Phone className="mb-1 h-7 w-7 text-orange-500 transition group-hover:scale-105" />
                  <span className="font-body text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-orange-600 transition group-hover:text-orange-700 sm:text-[2.35rem] lg:text-[2.7rem]">
                    031-856-8090
                  </span>
                </a>

                <p className="font-body mt-2 text-[13px] text-[#64748b]">
                  24시간 상담가능
                </p>

                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <a
                    href="tel:0318568090"
                    className="font-body inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-[15px] font-bold text-white shadow-[0_10px_22px_rgba(249,115,22,0.20)] transition hover:bg-orange-600"
                  >
                    <Phone className="h-4.5 w-4.5" />
                    전화 상담
                  </a>

                  <a
                    href="#contact"
                    target="_self"
                    rel="noopener noreferrer"
                    className="font-body inline-flex items-center gap-2 text-[14px] font-medium text-[#475569] transition hover:text-[#1f2937]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    온라인 상담 문의
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom note */}
            <div className="hero-animate-soft hero-delay-5 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="font-body text-[12px] font-medium text-[#64748b]">
                2025년 4월 오픈
              </span>
              <span className="hidden h-3.5 w-px bg-[#cbd5e1] sm:block" />
              <span className="font-body text-[12px] font-medium text-[#64748b]">
                A등급 운영 경험
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Slider controls */}
      <div className="absolute bottom-8 right-6 z-30 sm:right-8 lg:right-10">
        <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-2 shadow-[0_8px_22px_rgba(15,23,42,0.05)] backdrop-blur-md">
          <button
            onClick={prevSlide}
            className="rounded-full p-2 text-[#374151] transition hover:bg-white/75"
            aria-label="이전 이미지"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>

          <div className="flex items-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                aria-label={`${index + 1}번째 이미지로 이동`}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? 'w-7 bg-orange-500'
                    : 'w-2 bg-[#cbd5e1] hover:bg-[#94a3b8]'
                }`}
              />
            ))}
          </div>

          <button
            onClick={nextSlide}
            className="rounded-full p-2 text-[#374151] transition hover:bg-white/75"
            aria-label="다음 이미지"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </section>
  )
}