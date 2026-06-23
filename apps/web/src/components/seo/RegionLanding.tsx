import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Heart,
  ShieldCheck,
  Sparkles,
  Users,
  MapPin,
  Phone,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Home,
  Building2,
  BedDouble,
  Footprints,
  CalendarCheck,
  HelpCircle,
  Route,
} from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import KakaoMap from '@/components/map/KaKaoMap'

export const SITE_GEO = {
  lat: 37.76774123217728,
  lng: 127.04359415733941,
} as const

export const BASE_URL = 'https://www.행복한요양원녹양역.com'

export interface RegionFaq {
  question: string
  answer: string
}

export interface RegionAccessPoint {
  title: string
  description: string
}

export interface RegionContent {
  /** 페이지 경로 (앞 슬래시 포함, 예: /uijeongbu-nursing-home) */
  path: string
  /** JSON-LD description */
  description: string
  /** Hero 배지 */
  badge: string
  /** Hero 제목 (줄바꿈 가능) */
  heroTitle: ReactNode
  /** Hero 부제 */
  heroSubtitle: string
  /** Hero 칩 3개 */
  heroChips: string[]
  /** 보호자가 고민하는 상황 */
  concerns: string[]
  /** 지역 접근성 리드 문장 */
  accessLead: string
  /** 지역 접근성 포인트 */
  accessPoints: RegionAccessPoint[]
  /** 이런 보호자에게 적합 */
  fitItems: string[]
  /** 자주 묻는 질문 */
  faqs: RegionFaq[]
  /** 구조화 데이터 areaServed */
  areaServed: string[]
  /** 지역명 키워드(섹션 제목용, 예: 의정부요양원) */
  regionLabel: string
}

/** 모든 지역 랜딩에 공통으로 노출되는 시설 특징 */
const facilityFeatures = [
  {
    icon: <Building2 className="w-7 h-7" />,
    title: '단독건물형 요양원',
    description:
      '다른 시설과 공간을 나눠 쓰지 않는 단독건물 구조로, 어르신의 생활 동선과 위생 관리를 독립적으로 운영합니다.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: <BedDouble className="w-7 h-7" />,
    title: '1인실·2인실·4인실 운영',
    description:
      '어르신의 상태와 보호자님의 상황에 맞춰 1인실, 2인실, 4인실 중 선택해 상담하실 수 있습니다.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: <Footprints className="w-7 h-7" />,
    title: '하네스 레일 보행 공간',
    description:
      '천장 레일과 하네스를 활용한 보행 공간을 두어, 거동이 불편한 어르신도 안전하게 보행 연습을 이어갈 수 있습니다.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    title: '새롭게 문을 연 신설 시설',
    description:
      '신설 시설로 생활실, 공용 공간, 위생 공간이 깨끗하게 정돈되어 있어 쾌적한 환경에서 생활하실 수 있습니다.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: <Users className="w-7 h-7" />,
    title: '보호자 상담 진행',
    description:
      '입소 절차, 비용, 장기요양등급, 생활 환경까지 보호자님이 궁금해하시는 내용을 차분하게 안내드립니다.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: <CalendarCheck className="w-7 h-7" />,
    title: '면회·상담 09:00~18:00',
    description:
      '평일과 주말 09:00부터 18:00까지 면회와 상담이 가능합니다. 방문 전 연락 주시면 더 여유롭게 안내드립니다.',
    color: 'bg-sky-50 text-sky-600',
  },
]

const facilityPhotos = [
  {
    src: '/assets/images/introduce-1.png',
    alt: '행복한요양원 녹양역점에서 어르신들이 함께 식사하며 대화하는 생활 공간',
    title: '밝고 편안한 생활 분위기',
    description:
      '어르신들이 일상 속에서 편안하게 지내실 수 있는 분위기를 가장 중요하게 생각합니다.',
  },
  {
    src: '/assets/images/introduce-2.png',
    alt: '어르신들이 무리하지 않는 운동 프로그램에 참여하는 모습',
    title: '활동과 보행을 고려한 프로그램',
    description:
      '하네스 레일 보행 공간과 함께 무리하지 않는 생활 프로그램을 준비합니다.',
  },
  {
    src: '/assets/images/introduce-3.png',
    alt: '케어 선생님과 어르신이 함께 웃으며 시간을 보내는 모습',
    title: '따뜻한 케어 관계',
    description: '시설의 분위기는 결국 사람에게서 만들어진다고 생각합니다.',
  },
  {
    src: '/assets/images/introduce-4.png',
    alt: '어르신들이 원예 등 여가 활동을 즐기는 모습',
    title: '정서적 안정과 여가 시간',
    description: '생활의 안정감과 소소한 즐거움을 함께 드릴 수 있도록 준비합니다.',
  },
]

const sameAs = [
  SITE_INFO.social.facebook,
  SITE_INFO.social.instagram,
  SITE_INFO.social.blog,
  SITE_INFO.social.youtube,
]

export default function RegionLanding({ content }: { content: RegionContent }) {
  const url = `${BASE_URL}${content.path}`

  const businessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NursingHome',
    '@id': `${url}#nursinghome`,
    name: '행복한요양원 녹양역점',
    description: content.description,
    url,
    telephone: SITE_INFO.phone,
    email: SITE_INFO.email,
    image: `${BASE_URL}/assets/images/hero-8-image.png`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE_INFO.address.street,
      addressLocality: '양주시',
      addressRegion: '경기도',
      postalCode: SITE_INFO.address.zipCode,
      addressCountry: 'KR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: SITE_GEO.lat,
      longitude: SITE_GEO.lng,
    },
    areaServed: content.areaServed.map((name) => ({
      '@type': 'Place',
      name,
    })),
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '09:00',
      closes: '18:00',
    },
    openingHours: 'Mo-Su 09:00-18:00',
    sameAs,
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* JSON-LD (서버 렌더링되어 크롤러가 바로 수집) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative h-[160px] sm:h-[220px] lg:h-[340px]">
          <Image
            src="/assets/images/hero-8-image.png"
            alt={`${content.regionLabel} 보호자님을 위한 행복한요양원 녹양역점 전경`}
            fill
            priority
            quality={92}
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,28,38,0.55)_0%,rgba(18,28,38,0.30)_45%,rgba(18,28,38,0.10)_100%)]" />
        </div>

        <div className="absolute inset-0 z-10 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <Heart className="h-4 w-4 text-orange-300" />
                <span className="text-sm font-semibold text-white/90">
                  {content.badge}
                </span>
              </div>

              <h1 className="text-balance text-3xl font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
                {content.heroTitle}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                {content.heroSubtitle}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {content.heroChips.map((chip, i) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm"
                  >
                    {i === 0 ? (
                      <MapPin className="h-4 w-4 text-orange-300" />
                    ) : i === 1 ? (
                      <ShieldCheck className="h-4 w-4 text-orange-300" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-orange-300" />
                    )}
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href={`tel:${SITE_INFO.phone}`}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary-orange text-white rounded-xl font-semibold hover:bg-primary-orange/90 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  전화 상담 {SITE_INFO.phone}
                </a>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 backdrop-blur-sm border-2 border-white/70 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors"
                >
                  온라인 상담 신청
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 보호자가 고민하는 상황 */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 mb-6">
            <Clock3 className="w-4 h-4" />
            이런 고민을 하고 계신가요
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold leading-tight text-gray-900 mb-6">
            부모님 요양원을 알아보는 일은
            <br className="hidden sm:block" />
            누구에게나 처음이고 어렵습니다
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl leading-relaxed mb-10">
            아래와 같은 고민을 가지고 계신다면, 행복한요양원 녹양역점에서 상황에 맞는
            현실적인 안내를 받아보실 수 있습니다.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {content.concerns.map((c) => (
              <div
                key={c}
                className="flex items-start gap-3 rounded-2xl bg-gray-50 px-5 py-5 border border-gray-100"
              >
                <HelpCircle className="w-5 h-5 text-primary-orange mt-0.5 shrink-0" />
                <span className="text-gray-700 leading-relaxed">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 지역 접근성 */}
      <section className="py-16 lg:py-24 bg-[#faf7f3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 mb-6">
                <Route className="w-4 h-4" />
                지역 접근성
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                방문하고 상담하기 편한 위치입니다
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                {content.accessLead}
              </p>

              <div className="space-y-3">
                {content.accessPoints.map((p) => (
                  <div
                    key={p.title}
                    className="flex items-start gap-3 rounded-2xl bg-white px-5 py-4 border border-gray-100"
                  >
                    <MapPin className="w-5 h-5 text-primary-orange mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 mb-1">
                        {p.title}
                      </div>
                      <div className="text-gray-600 leading-relaxed">
                        {p.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative h-[360px] lg:h-[480px] rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                <Image
                  src="/assets/images/exterior.png"
                  alt="행복한요양원 녹양역점 단독건물 외관"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-6 left-6 right-6 rounded-3xl border border-white/80 bg-white/90 backdrop-blur-md p-5 shadow-xl">
                <div className="flex items-start gap-3">
                  <Home className="w-6 h-6 text-primary-orange mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-gray-900 mb-1">
                      녹양역 인근 단독건물형 요양원
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      의정부에서 차로 약 5분 거리로, 면회와 정기적인 방문이
                      부담스럽지 않은 위치에 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 시설 특징 */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              행복한요양원 녹양역점의 시설 특징
            </h2>
            <p className="text-lg lg:text-xl text-gray-600">
              거리만큼 중요한 것은 어르신이 매일 생활하실 환경입니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilityFeatures.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl bg-white p-7 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300"
              >
                <div
                  className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center mb-5`}
                >
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo gallery */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              이런 분위기의 생활을 준비합니다
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl leading-relaxed">
              어르신의 일상은 시설만이 아니라 분위기와 사람, 생활 리듬에서
              만들어집니다. 따뜻하고 안정된 환경을 가장 중요하게 생각합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {facilityPhotos.map((photo) => (
              <div
                key={photo.title}
                className="group overflow-hidden rounded-[28px] bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="relative h-64 lg:h-80 overflow-hidden">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {photo.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {photo.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 이런 보호자에게 적합 */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              이런 보호자님께 도움이 됩니다
            </h2>
            <p className="text-lg text-gray-600">
              아래 상황에 해당하신다면 부담 없이 상담을 신청해보세요.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {content.fitItems.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl bg-orange-50/60 px-5 py-5 border border-orange-100"
              >
                <CheckCircle2 className="w-5 h-5 text-primary-orange mt-0.5 shrink-0" />
                <span className="text-gray-700 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 상담 안내 CTA (중간) */}
      <section className="py-14 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold mb-4">
            상담은 어르신 상태를 확인하는 것에서 시작합니다
          </h2>
          <p className="text-lg mb-8 text-white/90 leading-relaxed">
            장기요양등급, 건강 상태, 현재 돌봄 상황을 함께 확인한 뒤
            <br className="hidden sm:block" />
            입소 가능 여부와 준비 서류를 안내드립니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`tel:${SITE_INFO.phone}`}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-xl font-semibold hover:bg-gray-100 transition-colors"
            >
              <Phone className="w-5 h-5" />
              전화 상담 {SITE_INFO.phone}
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-xl font-semibold hover:bg-white/20 transition-colors"
            >
              온라인 상담 신청
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              상담 전 자주 묻는 질문
            </h2>
            <p className="text-lg text-gray-600">
              보호자님들이 상담 전에 많이 궁금해하시는 내용을 정리했습니다.
            </p>
          </div>

          <div className="space-y-4">
            {content.faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 오시는 길 + 지도 + 전화 */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-14 items-start">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-8 text-gray-900">
                오시는 길
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-2xl bg-white p-5 border border-gray-100">
                  <MapPin className="w-6 h-6 text-primary-orange mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">주소</div>
                    <div className="text-gray-700 leading-relaxed">
                      {SITE_INFO.address.full}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      녹양역 인근 · 의정부에서 차로 약 5분
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-white p-5 border border-gray-100">
                  <Phone className="w-6 h-6 text-primary-orange mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">
                      전화번호
                    </div>
                    <a
                      href={`tel:${SITE_INFO.phone}`}
                      className="text-gray-700 hover:text-primary-orange transition-colors"
                    >
                      {SITE_INFO.phone} (856.8090)
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-white p-5 border border-gray-100">
                  <Clock3 className="w-6 h-6 text-primary-orange mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">
                      면회·상담 시간
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      매일 09:00 ~ 18:00 (방문 전 연락 권장)
                    </div>
                  </div>
                </div>
              </div>

              <a
                href={`tel:${SITE_INFO.phone}`}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 px-6 py-4 bg-primary-orange text-white rounded-xl font-semibold hover:bg-primary-orange/90 transition-colors"
              >
                <Phone className="w-5 h-5" />
                바로 전화 상담하기
              </a>
            </div>

            <div className="h-[380px] lg:h-[520px] rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.12)] bg-gray-100">
              <KakaoMap
                lat={SITE_GEO.lat}
                lng={SITE_GEO.lng}
                level={3}
                markerTitle="행복한요양원 녹양역점"
                height="100%"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 다른 지역 안내 (내부 링크) */}
      <section className="py-14 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            지역별 안내 페이지
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { href: '/yangju-nursing-home', label: '양주요양원 안내' },
              { href: '/uijeongbu-nursing-home', label: '의정부요양원 안내' },
              { href: '/nogyang-station-nursing-home', label: '녹양역요양원 안내' },
              {
                href: '/nursing-home-near-uijeongbu-yangju',
                label: '의정부·양주 인근 요양원 안내',
              },
            ]
              .filter((l) => l.href !== content.path)
              .map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 px-5 py-4 text-gray-800 font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors"
                >
                  {l.label}
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </Link>
              ))}
          </div>
        </div>
      </section>
    </div>
  )
}
