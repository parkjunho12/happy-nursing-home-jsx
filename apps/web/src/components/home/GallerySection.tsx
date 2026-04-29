'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import GalleryLightbox from '@/components/home/GalleryLightbox'

interface GalleryImage {
  id: number
  src: string
  category: string
  title: string
  description?: string
  alt: string
  span?: string
  featured?: boolean // 대표 이미지 여부
}

interface Category {
  id: string
  name: string
  description: string
  tagline?: string
  anchor: string 
}

const categories: Category[] = [
  {
    id: '전체',
    name: '전체',
    description: '행복한요양원의 모든 공간',
    tagline: '어르신의 행복한 일상이 있는 곳',
    anchor: 'gallery', // ← 추가
  },
  {
    id: '시설 전경',
    name: '시설 전경',
    description: '쾌적한 단독 건물과 편안한 분위기',
    tagline: '녹양역 가까운 단독 건물',
    anchor: 'gallery-facility', // ← 추가
  },
  {
    id: '생활 공간',
    name: '생활 공간',
    description: '어르신이 실제로 머무시는 편안한 공간',
    tagline: '집처럼 편안한 우리 집',
    anchor: 'gallery-living', // ← 추가
  },
  {
    id: '재활 공간',
    name: '재활 공간',
    description: '이지스텝 보행 재활과 전문 물리치료',
    tagline: '우리의 핵심 경쟁력',
    anchor: 'gallery-rehab', // ← 추가
  },
  {
    id: '프로그램',
    name: '프로그램',
    description: '웃음과 활력이 있는 일상 활동',
    tagline: '매일매일 활기찬 하루',
    anchor: 'gallery-program', // ← 추가
  },
  {
    id: '식사/위생',
    name: '식사/위생',
    description: '청결하고 안전한 생활 환경',
    tagline: '위생과 안전을 최우선으로',
    anchor: 'gallery-dining', // ← 추가
  },
  {
    id: '상담/입소',
    name: '상담/입소',
    description: '보호자님과의 따뜻한 소통 공간',
    tagline: '가족의 마음으로 상담합니다',
    anchor: 'gallery-consultation', // ← 추가
  },
]
const galleryImages: GalleryImage[] = [
  // ===== 전체 (대표/브랜드 이미지) =====
  {
    id: 101,
    src: '/assets/images/01_top.png',
    category: '전체',
    title: '따뜻한 돌봄',
    description: '어르신과 직원이 함께 웃는 순간',
    alt: '행복한요양원 직원과 어르신이 함께 웃는 모습',
    featured: true,
  },
  {
    id: 102,
    src: '/assets/images/04_easystep2.jpg',
    category: '전체',
    title: '이지스텝 재활',
    description: '전문 보행 재활 시스템',
    alt: '행복한요양원 이지스텝 물리치료실',
    span: 'col-span-2 row-span-2',
    featured: true,
  },
  {
    id: 103,
    src: '/assets/images/07_lobby_wide.jpg',
    category: '전체',
    title: '밝은 로비',
    description: '쾌적하고 따뜻한 공용 공간',
    alt: '행복한요양원 로비 내부',
    featured: true,
  },
  {
    id: 104,
    src: '/assets/images/15_sign_wide.png',
    category: '전체',
    title: '입구 간판',
    description: '녹양역 도보 10분 거리',
    alt: '행복한요양원 녹양역점 입구',
    featured: true,
  },
  {
    id: 105,
    src: '/assets/images/39_program.jpg',
    category: '전체',
    title: '활기찬 프로그램',
    description: '어르신들의 웃음 가득한 활동',
    alt: '행복한요양원 운동 프로그램',
    featured: true,
  },

  // ===== 시설 전경 =====
  {
    id: 201,
    src: '/assets/images/18_sign.png',
    category: '시설 전경',
    title: '정문 및 입구',
    description: '녹양역 1번 출구 도보 10분',
    alt: '행복한요양원 녹양역점 정문',
  },
  {
    id: 202,
    src: '/assets/images/06_lobby.jpg',
    category: '시설 전경',
    title: '1층 로비',
    description: '밝고 쾌적한 입구 공간',
    alt: '행복한요양원 1층 로비',
  },
  {
    id: 203,
    src: '/assets/images/09_cafeteria.jpg',
    category: '시설 전경',
    title: '공용 공간',
    description: '어르신들의 만남과 교류 공간',
    alt: '행복한요양원 카페 공용 공간',
  },

  // ===== 생활 공간 =====
  {
    id: 301,
    src: '/assets/images/19_one.jpg',
    category: '생활 공간',
    title: '1인실',
    description: '개인 생활을 선호하시는 어르신을 위한 공간',
    alt: '행복한요양원 1인실 생활실',
    span: 'col-span-2',
  },
  {
    id: 302,
    src: '/assets/images/22_two2.jpg',
    category: '생활 공간',
    title: '2인실',
    description: '편안함과 교류를 함께 고려한 생활실',
    alt: '행복한요양원 2인실 생활실',
  },
  {
    id: 303,
    src: '/assets/images/25_four.jpg',
    category: '생활 공간',
    title: '4인실',
    description: '안전하고 쾌적한 다인실 공간',
    alt: '행복한요양원 4인실 생활실',
  },
  {
    id: 304,
    src: '/assets/images/cafe.png',
    category: '생활 공간',
    title: '휴게 공간',
    description: '어르신들의 담소와 여가 시간',
    alt: '행복한요양원 휴게실',
  },
  {
    id: 305,
    src: '/assets/images/21_one_toilet.jpg',
    category: '생활 공간',
    title: '화장실',
    description: '안전하고 청결한 위생 공간',
    alt: '행복한요양원 화장실',
  },

  // ===== 재활 공간 =====
  {
    id: 401,
    src: '/assets/images/02_easystep.jpg',
    category: '재활 공간',
    title: '이지스텝 물리치료실',
    description: '하네스 레일 기반 안전한 보행 훈련',
    alt: '행복한요양원 이지스텝 보행 재활 시스템',
    span: 'col-span-2 row-span-2',
  },
  {
    id: 402,
    src: '/assets/images/easystep1.jpg',
    category: '재활 공간',
    title: '이지스텝 이용사진',
    description: '하네스 레일 기반 안전한 보행 훈련',
    alt: '행복한요양원 이지스텝 보행 재활 시스템 이용 모습',
  },
  {
    id: 403,
    src: '/assets/images/05_easystep.jpg',
    category: '재활 공간',
    title: '이지스텝 이용사진',
    description: '하네스 레일 기반 안전한 보행 훈련',
    alt: '행복한요양원 이지스텝 보행 재활 시스템 이용 모습',
  },
  {
    id: 404,
    src: '/assets/images/physics_room.jpg',
    category: '재활 공간',
    title: '물리치료실',
    description: '적외선, 온열, 마사지 등 다양한 재활 기기',
    alt: '행복한요양원 물리치료실 재활 공간',
  },
  {
    id: 405,
    src: '/assets/images/31_physical_treatment.jpg',
    category: '재활 공간',
    title: '물리치료실 이용사진',
    description: '적외선, 온열, 마사지 등 다양한 재활 기기 이용 모습',
    alt: '행복한요양원 물리치료실 재활 공간 이용 모습',
  },
  {
    id: 406,
    src: '/assets/images/28_walking.jpg',
    category: '재활 공간',
    title: '물리치료실 걸음 보조기구',
    description: '보행 보조기구와 재활 관리 공간',
    alt: '행복한요양원 물리치료실 걸음 보조기구 재활 공간',
  },
  {
    id: 407,
    src: '/assets/images/32_physic_treat.jpg',
    category: '재활 공간',
    title: '온열기구 이용사진',
    description: '적외선, 온열, 마사지 등 다양한 재활 기기 이용 모습',
    alt: '행복한요양원 물리치료실 온열기구 재활 공간 이용 모습',
  },
  {
    id: 408,
    src: '/assets/images/34_healing.jpg',
    category: '재활 공간',
    title: '힐링룸',
    description: '손마사지와 발마사지와 재활 관리 공간',
    alt: '행복한요양원 힐링룸 재활 공간',
  },

  // ===== 프로그램 =====
  {
    id: 501,
    src: '/assets/images/36_easystep_use.jpg',
    category: '프로그램',
    title: '운동 프로그램',
    description: '함께하는 즐거운 신체 활동',
    alt: '행복한요양원 운동 프로그램 활동',
    span: 'col-span-2',
  },
  {
    id: 502,
    src: '/assets/images/hero-7-image.png',
    category: '프로그램',
    title: '원예 활동',
    description: '정서 안정과 인지 향상 프로그램',
    alt: '행복한요양원 원예 프로그램',
  },
  {
    id: 503,
    src: '/assets/images/40_throwing.jpg',
    category: '프로그램',
    title: '프로그램실',
    description: '다양한 활동이 이루어지는 공간',
    alt: '행복한요양원 프로그램 활동실',
  },
  {
    id: 504,
    src: '/assets/images/41_recognize.png',
    category: '프로그램',
    title: '인지 프로그램',
    description: '어르신의 웃음과 활력',
    alt: '행복한요양원 인지 활동 프로그램',
  },
  {
    id: 505,
    src: '/assets/images/hero-9-image.png',
    category: '프로그램',
    title: '즐거운 식사 시간',
    description: '함께하는 따뜻한 식사',
    alt: '행복한요양원 식사 시간',
  },

  // ===== 식사/위생 =====
  {
    id: 601,
    src: '/assets/images/44_restaurant.jpg',
    category: '식사/위생',
    title: '자체 식당',
    description: '영양 균형을 고려한 식사 만드는 공간',
    alt: '행복한요양원 식당',
    span: 'col-span-2',
  },
  {
    id: 602,
    src: '/assets/images/foods.png',
    category: '식사/위생',
    title: '영양잡힌 식단',
    description: '어르신의 건강과 기호를 고려한 균형 잡힌 식사',
    alt: '행복한요양원 식단과 식사',
  },
  {
    id: 603,
    src: '/assets/images/common_toilet.jpg',
    category: '식사/위생',
    title: '공용 화장실',
    description: '안전하고 청결한 위생 공간',
    alt: '행복한요양원 화장실',
  },
  {
    id: 604,
    src: '/assets/images/33_haircut.jpg',
    category: '식사/위생',
    title: '미용실',
    description: '어르신의 단정한 외모 관리',
    alt: '행복한요양원 미용실',
  },

  // ===== 상담/입소 안내 =====
  {
    id: 701,
    src: '/assets/images/councel.jpg',
    category: '상담/입소',
    title: '보호자 상담실',
    description: '편안한 분위기에서 차분히 상담드립니다',
    alt: '행복한요양원 보호자 상담실',
    span: 'col-span-2',
  },
  {
    id: 702,
    src: '/assets/images/councel2.jpg',
    category: '상담/입소',
    title: '입소 상담 공간',
    description: '입소 절차와 생활 안내를 세심히 설명드립니다',
    alt: '행복한요양원 입소 상담 공간',
  },
  {
    id: 703,
    src: '/assets/images/06_lobby2.jpg',
    category: '상담/입소',
    title: '로비 안내',
    description: '처음 방문하시는 보호자님을 따뜻하게 맞이합니다',
    alt: '행복한요양원 로비 안내 공간',
  },
]

export function GallerySection() {
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      const matchedCategory = categories.find((cat) => cat.anchor === hash)
      
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.id)
        setTimeout(() => {
          const element = document.getElementById('gallery')
          if (element) {
            const yOffset = -100
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
            window.scrollTo({ top: y, behavior: 'smooth' })
          }
        }, 100)
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const currentCategory = categories.find((cat) => cat.id === selectedCategory)

  const filteredImages =
    selectedCategory === '전체'
      ? galleryImages.filter((img) => img.featured) // 전체는 대표 이미지만
      : galleryImages.filter((img) => img.category === selectedCategory)

  const handleCategoryChange = (categoryId: string) => {
  setSelectedCategory(categoryId)
  const category = categories.find((cat) => cat.id === categoryId)
  if (category) {
    window.history.replaceState(null, '', `#${category.anchor}`)
  }
}

  const handleClose = () => setOpenIndex(null)

  const handlePrev = () => {
    if (openIndex === null) return
    const allImages = galleryImages
    setOpenIndex((openIndex - 1 + allImages.length) % allImages.length)
  }

  const handleNext = () => {
    if (openIndex === null) return
    const allImages = galleryImages
    setOpenIndex((openIndex + 1) % allImages.length)
  }

  return (
    <section id="gallery" className="bg-bg-cream py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            FACILITY GALLERY
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-6">
            깨끗하고 쾌적한 우리 시설
          </h2>
          <p className="text-lg text-text-gray max-w-2xl mx-auto mb-10">
            어르신이 편안하게 생활하실 수 있도록 정성껏 관리하는 공간입니다
          </p>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  selectedCategory === category.id
                    ? 'bg-primary-orange text-white shadow-md scale-105'
                    : 'bg-white text-text-gray hover:bg-orange-50 border border-border-light'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Category Description */}
          {currentCategory && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white/60 backdrop-blur-sm border border-orange-200 rounded-2xl px-6 py-4 shadow-soft">
                {currentCategory.tagline && (
                  <p className="text-sm font-bold text-primary-orange mb-1">
                    {currentCategory.tagline}
                  </p>
                )}
                <p className="text-base text-text-gray">
                  {currentCategory.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Gallery Grid */}
        {filteredImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filteredImages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const globalIndex = galleryImages.findIndex((img) => img.id === item.id)
                  setOpenIndex(globalIndex)
                }}
                className={`relative overflow-hidden group rounded-2xl ${
                  item.span || 'aspect-square'
                }`}
                aria-label={`${item.title} 크게 보기`}
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300" />

                {/* Text Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-white font-bold text-base md:text-lg mb-1 drop-shadow-lg">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-white/90 text-xs md:text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 drop-shadow">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Hover Icon */}
                <div className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-text-gray text-lg">해당 카테고리의 이미지가 없습니다</p>
          </div>
        )}

        {/* Gallery Stats */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 text-center">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-soft">
            <div className="text-3xl font-bold text-primary-orange mb-1">
              {galleryImages.length}+
            </div>
            <div className="text-sm text-text-gray">실제 시설 사진</div>
          </div>
          <div className="bg-white rounded-2xl px-6 py-4 shadow-soft">
            <div className="text-3xl font-bold text-primary-orange mb-1">
              {categories.length - 1}
            </div>
            <div className="text-sm text-text-gray">시설 카테고리</div>
          </div>
          <div className="bg-white rounded-2xl px-6 py-4 shadow-soft">
            <div className="text-3xl font-bold text-primary-orange mb-1">100%</div>
            <div className="text-sm text-text-gray">실사 공개</div>
          </div>
        </div>

        <p className="text-center text-text-gray text-sm mt-8">
          ※ 모든 사진은 행복한요양원 녹양역점의 실제 시설 사진입니다
        </p>
      </div>

      <GalleryLightbox
        items={galleryImages}
        openIndex={openIndex}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </section>
  )
}