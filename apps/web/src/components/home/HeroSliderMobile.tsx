'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Phone, MapPin, Award } from 'lucide-react'

const slides = [
  {
    image: '/assets/images/hero_main.png',
    alt: '행복한요양원 시설 모습',
    position: 'object-[58%_center]',
  },
  {
    image: '/assets/images/hero_6.png',
    alt: '보행 재활 모습',
    position: 'object-center',
  },
  {
    image: '/assets/images/comain_3.jpg',
    alt: '보행 재활 모습',
    position: 'object-center',
  },
  {
    image: '/assets/images/hero_3.png',
    alt: '프로그램 활동 모습',
    position: 'object-[58%_center]',
  },
  {
    image: '/assets/images/37_care_physics.jpg',
    alt: '어르신들이 함께 운동 프로그램에 참여하는 모습',
    position: 'object-center',
  },
  {
    image: '/assets/images/15_sign_wide.png',
    alt: '이지스텝 재활 시스템',
    position: 'object-[56%_center]',
  },
  {
    image: '/assets/images/hero_5.png',
    alt: '이지스텝 재활 시스템',
    position: 'object-[56%_center]',
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
    <section className="relative min-h-[680px] overflow-hidden md:hidden">

      {/* 배경 이미지 */}
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.image}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide
                ? 'opacity-100'
                : 'opacity-0'
            }`}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              priority={index === 0}
              quality={95}
              sizes="100vw"
              className={`object-cover brightness-[1.03] ${slide.position}`}
            />
          </div>
        ))}

        {/* 위쪽은 거의 안가리고 아래만 진하게 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

      </div>

      {/* 내용 */}
      <div className="relative z-20 flex min-h-[680px] items-end px-5 pb-24">

        <div className="w-full">

          {/* 배지 */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md">

            <Award className="h-3.5 w-3.5 text-orange-300"/>

            <span className="text-[11px] font-semibold text-white">
              자매시설 A등급 운영 노하우
            </span>

          </div>


          {/* 메인 제목 */}

          <h2 className="text-[2.2rem] font-bold leading-[1.12] tracking-[-0.04em] text-white">

            가족처럼 모시는
            <br />

            <span className="text-orange-300">
              행복한요양원 녹양역점
            </span>

          </h2>


          {/* 설명 */}

          <p className="mt-3 max-w-[310px] text-[15px] leading-relaxed text-white/90">

            규정이 아닌 어르신의 삶을 기준으로 운영합니다.

          </p>


          {/* 태그 */}

          <div className="mt-5 flex flex-wrap gap-2">

            <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
              삶을 돌보는 요양원
            </span>

            <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
              최신 시설
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">

              <MapPin className="h-3.5 w-3.5"/>

              녹양역 8분

            </span>

          </div>


          {/* 전화버튼 */}

          <a
            href="tel:0318568090"
            onClick={(e) => {
              e.preventDefault()

              try {
                window.hpt_trace_info = {
                  _mode: 'q',
                  _memid: '',
                }
              } catch (err) {
                console.error(err)
              }

              setTimeout(() => {
                window.location.href = 'tel:031-856-8090'
              }, 150)
            }}
            className="
              mt-6
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-orange-500
              px-6
              py-3
              text-[1.2rem]
              font-bold
              text-white
              shadow-xl
            "
          >
            <Phone className="h-5 w-5"/>

            031-856-8090

          </a>

        </div>

      </div>

      {/* 슬라이드 점 */}

      <div className="absolute bottom-8 left-0 right-0 z-30">

        <div className="flex justify-center gap-2">

          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2.5 rounded-full transition-all ${
                currentSlide === index
                  ? 'w-8 bg-white'
                  : 'w-2.5 bg-white/50'
              }`}
            />
          ))}

        </div>

      </div>

    </section>
  )
}