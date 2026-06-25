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
  ChevronDown,
  Navigation,
  Quote,
  PhoneCall,
  Award,
  Car,
  Bus,
} from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import { FACILITY, MAP_LINKS, TRANSIT_NOTE, CAR_TIME_DISCLAIMER, BUS_EXAMPLES } from '@/lib/region'
import KakaoMap from '@/components/map/KaKaoMap'
import TrackedCTA from '@/components/analytics/TrackedCTA'

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
  /** 지역 특성 소개 문단 (선택) — 지역별 차별화 */
  regionIntro?: string
  /** 자가용 도로 경로 안내 (선택) — 지역별 */
  routeCar?: string
  /** 이 지역 보호자님께 적합한 이유 (선택) — 지역별 */
  suitability?: string
  /** 방문 장점 카드 3개 (선택, 미지정 시 기본값) */
  advantages?: { title: string; desc: string }[]
  /** 차량 예상 시간 (예: '약 10~20분 내외') — 지역별 */
  carTime?: string
  /** 대중교통 생활권 표기 (선택) */
  transitArea?: string
  /** 접근성·면회 편의 한 줄 (선택) — 지역별 */
  accessAdvantage?: string
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
    icon: <Award className="w-7 h-7" />,
    title: 'A등급 자매시설 운영 노하우',
    description:
      '자매시설에서 8년간 장기요양기관 A등급을 유지해 온 운영 노하우를 바탕으로 어르신을 안정적으로 돌봅니다.',
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
    src: '/assets/images/album/album-band-exercise.jpg',
    alt: '어르신들이 색색의 밴드를 들어올리며 체조 프로그램에 참여하는 모습',
    title: '활기찬 신체 프로그램',
    description:
      '색색의 밴드로 함께하는 체조처럼, 무리하지 않으면서 즐겁게 몸을 움직이는 시간을 마련합니다.',
  },
  {
    src: '/assets/images/album/album-harness-rail.jpg',
    alt: '하네스 레일을 활용해 어르신이 안전하게 보행 재활을 하는 모습',
    title: '하네스 레일 보행 재활',
    description:
      '천장 레일과 하네스를 활용해 거동이 불편한 어르신도 안전하게 보행을 연습할 수 있습니다.',
  },
  {
    src: '/assets/images/album/album-cognition-1to1.jpg',
    alt: '요양보호사가 어르신과 손을 맞잡고 인지 활동을 함께하는 모습',
    title: '1:1 인지·정서 케어',
    description:
      '손을 맞잡고 함께하는 인지 활동으로 정서적 안정과 교류의 시간을 드립니다.',
  },
  {
    src: '/assets/images/album/album-block-program.jpg',
    alt: '어르신들이 한글 블록 교구로 인지 프로그램에 참여하는 모습',
    title: '인지 자극 프로그램',
    description:
      '한글 블록 같은 교구 활동으로 기억력과 인지 기능 유지를 돕습니다.',
  },
  {
    src: '/assets/images/album/album-meal-care.jpg',
    alt: '요양보호사가 어르신들께 식사를 차려드리는 모습',
    title: '정성스러운 식사',
    description:
      '어르신의 건강 상태와 기호를 살펴 균형 잡힌 식사를 정성껏 준비합니다.',
  },
  {
    src: '/assets/images/album/album-ring-toss.jpg',
    alt: '어르신들이 고리 던지기 여가 활동을 즐기는 모습',
    title: '함께 즐기는 여가',
    description:
      '고리 던지기 같은 가벼운 놀이로 웃음과 활력을 더하는 여가 시간을 보냅니다.',
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

  const advantages = content.advantages ?? [
    { title: '가까운 방문 상담', desc: '보호자님이 직접 방문해 시설 분위기와 생활 공간을 확인하실 수 있습니다.' },
    { title: '녹양역 인근 접근성', desc: '의정부·양주 생활권에서 접근하기 좋은 위치로, 면회와 상담이 부담스럽지 않습니다.' },
    { title: '단독 건물형 요양원', desc: '다른 시설과 공간을 나눠 쓰지 않고, 어르신 생활 공간을 요양원 용도에 맞게 운영합니다.' },
  ]

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
      streetAddress: FACILITY.street,
      addressLocality: '양주시',
      addressRegion: '경기도',
      postalCode: SITE_INFO.address.zipCode,
      addressCountry: 'KR',
    },
    hasMap: MAP_LINKS.kakao,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative h-[380px] sm:h-[460px] lg:h-[540px]">
          <Image
            src="/assets/images/hero-8-image.png"
            alt={`${content.regionLabel} 보호자님을 위한 행복한요양원 녹양역점 전경`}
            fill priority quality={92}
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(108deg,rgba(18,28,38,0.82)_0%,rgba(18,28,38,0.55)_42%,rgba(18,28,38,0.15)_100%)]" />
        </div>

        <div className="absolute inset-0 z-10 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 backdrop-blur-md">
                <Heart className="h-4 w-4 text-orange-300" />
                <span className="text-sm font-semibold text-white/90">{content.badge}</span>
              </div>

              <h1 className="text-balance text-3xl font-bold leading-[1.16] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.4rem]">
                {content.heroTitle}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                {content.heroSubtitle}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                {content.heroChips.map((chip, i) => (
                  <span key={chip} className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm ring-1 ring-white/10">
                    {i === 0 ? <MapPin className="h-4 w-4 text-orange-300" /> : i === 1 ? <ShieldCheck className="h-4 w-4 text-orange-300" /> : <Sparkles className="h-4 w-4 text-orange-300" />}
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <TrackedCTA eventType="phone_click" componentName="HeroCTA" sectionName="Hero" buttonLabel={`${SITE_INFO.phone} 상담`} destination={`tel:${SITE_INFO.phone}`} className="group inline-flex items-center justify-center gap-2.5 pl-3 pr-6 py-3 bg-gradient-to-r from-primary-orange to-amber-500 text-white rounded-full font-bold shadow-xl shadow-orange-900/20 hover:scale-[1.03] transition-transform">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"><Phone className="h-4 w-4" /></span>
                  {SITE_INFO.phone}
                </TrackedCTA>
                <TrackedCTA eventType="consultation_click" componentName="HeroCTA" sectionName="Hero" buttonLabel="온라인 상담 신청" destination="/contact" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 backdrop-blur-md border border-white/40 text-white rounded-full font-semibold hover:bg-white/20 transition-colors">
                  온라인 상담 신청 <ChevronRight className="h-5 w-5" />
                </TrackedCTA>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 빠른 정보 바 */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
          <div className="grid sm:grid-cols-3 gap-3 rounded-3xl bg-white p-3 shadow-[0_20px_50px_rgba(184,110,40,0.14)] border border-orange-50">
            {[
              { icon: <MapPin className="h-5 w-5" />, label: '위치', value: '녹양역 인근 · 의정부 차로 5분' },
              { icon: <Phone className="h-5 w-5" />, label: '상담 문의', value: `${SITE_INFO.phone}` },
              { icon: <Clock3 className="h-5 w-5" />, label: '면회·상담', value: '매일 09:00 ~ 18:00' },
            ].map((it) => (
              <div key={it.label} className="flex items-center gap-3 rounded-2xl px-4 py-3.5 hover:bg-orange-50/50 transition-colors">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary-orange">{it.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{it.label}</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{it.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 지역 특성 소개 */}
      {content.regionIntro && (
        <section className="pt-16 lg:pt-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-5">
              <MapPin className="h-3.5 w-3.5" /> {content.regionLabel}
            </span>
            <p className="text-lg sm:text-[22px] text-gray-700 leading-relaxed sm:leading-relaxed font-medium">
              {content.regionIntro}
            </p>
          </div>
        </section>
      )}

      {/* 이 지역 보호자님께 적합한 이유 */}
      {content.suitability && (
        <section className="pt-12 lg:pt-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl bg-gradient-to-br from-[#fff5ec] to-white border border-orange-100 p-7 sm:p-9 shadow-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4 shadow-sm">
                <Heart className="h-3.5 w-3.5" /> 이 지역 보호자님께 적합한 이유
              </span>
              <p className="text-lg sm:text-xl text-gray-800 leading-relaxed font-medium">{content.suitability}</p>
            </div>
          </div>
        </section>
      )}

      {/* 보호자가 고민하는 상황 */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4">
              <HelpCircle className="h-3.5 w-3.5" /> 보호자님의 고민
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight text-gray-900">
              부모님 요양원을 알아보는 일은<br className="hidden sm:block" /> 누구에게나 처음이고 어렵습니다
            </h2>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">
              아래와 같은 고민을 하고 계신다면, 행복한요양원 녹양역점에서 상황에 맞는 현실적인 안내를 받아보실 수 있습니다.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {content.concerns.map((c) => (
              <div key={c} className="group flex items-start gap-3.5 rounded-2xl bg-gray-50 px-5 py-5 border border-gray-100 hover:border-orange-200 hover:bg-orange-50/40 transition-colors">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-orange shadow-sm group-hover:bg-primary-orange group-hover:text-white transition-colors">
                  <HelpCircle className="h-[18px] w-[18px]" />
                </span>
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
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4 shadow-sm">
                <Route className="h-3.5 w-3.5" /> 지역 접근성
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-5">
                방문하고 상담하기<br className="hidden sm:block" /> 편한 위치입니다
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">{content.accessLead}</p>
              <div className="space-y-3">
                {content.accessPoints.map((p) => (
                  <div key={p.title} className="flex items-start gap-4 rounded-2xl bg-white px-5 py-4 border border-gray-100 shadow-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary-orange"><MapPin className="h-5 w-5" /></span>
                    <div>
                      <div className="font-bold text-gray-900 mb-0.5">{p.title}</div>
                      <div className="text-sm text-gray-600 leading-relaxed">{p.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7">
                <p className="text-sm font-bold text-gray-500 mb-2.5">이런 동네에서 많이 찾아주세요</p>
                <div className="flex flex-wrap gap-2">
                  {content.areaServed.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-white border border-orange-100 px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm">
                      <MapPin className="h-3.5 w-3.5 text-primary-orange" /> {a}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative h-[380px] lg:h-[500px] rounded-[32px] overflow-hidden shadow-[0_24px_60px_rgba(184,110,40,0.18)]">
                <Image src="/assets/images/exterior.png" alt="행복한요양원 녹양역점 단독건물 외관" fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-6 left-6 right-6 rounded-3xl border border-white/80 bg-white/95 backdrop-blur-md p-5 shadow-xl">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary-orange"><Home className="h-5 w-5" /></span>
                  <div>
                    <p className="font-bold text-gray-900 mb-0.5">녹양역 인근 단독건물형 요양원</p>
                    <p className="text-sm text-gray-600 leading-relaxed">의정부에서 차로 약 5분 거리로, 면회와 정기적인 방문이 부담스럽지 않은 위치에 있습니다.</p>
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
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4">
              <ShieldCheck className="h-3.5 w-3.5" /> 시설 특징
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">행복한요양원 녹양역점의 차이</h2>
            <p className="text-lg text-gray-600">거리만큼 중요한 것은 어르신이 매일 생활하실 환경입니다.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilityFeatures.map((item) => (
              <div key={item.title} className="group rounded-3xl bg-white p-7 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo gallery */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> 어르신의 하루
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">이런 분위기의 생활을 준비합니다</h2>
            <p className="text-lg text-gray-600 leading-relaxed">어르신의 일상은 시설만이 아니라 분위기와 사람, 생활 리듬에서 만들어집니다.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilityPhotos.map((photo) => (
              <div key={photo.title} className="group relative aspect-[4/3] overflow-hidden rounded-3xl shadow-sm">
                <Image src={photo.src} alt={photo.alt} fill loading="lazy" sizes="(max-width:1024px) 50vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="text-lg font-bold text-white drop-shadow">{photo.title}</h3>
                  <p className="mt-1 text-sm text-white/85 leading-relaxed max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 transition-all duration-300">{photo.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 이런 보호자에게 적합 */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4">
              <Heart className="h-3.5 w-3.5" /> 이런 보호자님께
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">이런 보호자님께 도움이 됩니다</h2>
            <p className="text-lg text-gray-600">아래 상황에 해당하신다면 부담 없이 상담을 신청해보세요.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {content.fitItems.map((item) => (
              <div key={item} className="flex items-start gap-3.5 rounded-2xl bg-orange-50/50 px-5 py-5 border border-orange-100">
                <CheckCircle2 className="h-6 w-6 text-primary-orange mt-0.5 shrink-0" />
                <span className="text-gray-700 leading-relaxed font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 방문 장점 카드 */}
      <section className="py-16 lg:py-20 bg-[#faf7f3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> 방문 전 알아두면 좋은 점
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">이 위치를 선택하면 좋은 점</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {advantages.map((a, i) => (
              <div key={a.title} className="group rounded-3xl bg-white p-7 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-primary-orange flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  {i === 0 ? <Users className="h-6 w-6" /> : i === 1 ? <MapPin className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{a.title}</h3>
                <p className="text-gray-600 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 상담 안내 CTA (중간) */}
      <section className="py-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white relative overflow-hidden">
        <Quote className="absolute -top-2 left-6 h-24 w-24 text-white/10" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-2xl lg:text-3xl font-bold mb-4">상담은 어르신 상태를 확인하는 것에서 시작합니다</h2>
          <p className="text-lg mb-8 text-white/90 leading-relaxed">
            장기요양등급, 건강 상태, 현재 돌봄 상황을 함께 확인한 뒤<br className="hidden sm:block" /> 입소 가능 여부와 준비 서류를 안내드립니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <TrackedCTA eventType="phone_click" componentName="MidCTA" sectionName="MidSection" buttonLabel="전화 상담" destination={`tel:${SITE_INFO.phone}`} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-2xl font-bold hover:bg-gray-100 transition-colors">
              <PhoneCall className="h-5 w-5" /> 전화 상담 {SITE_INFO.phone}
            </TrackedCTA>
            <TrackedCTA eventType="consultation_click" componentName="MidCTA" sectionName="MidSection" buttonLabel="온라인 상담 신청" destination="/contact" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-2xl font-bold hover:bg-white/20 transition-colors">
              온라인 상담 신청 <ChevronRight className="h-5 w-5" />
            </TrackedCTA>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4">FAQ</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">상담 전 자주 묻는 질문</h2>
            <p className="text-lg text-gray-600">보호자님들이 상담 전에 많이 궁금해하시는 내용을 정리했습니다.</p>
          </div>
          <div className="space-y-3">
            {content.faqs.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border border-gray-100 bg-gray-50 px-5 sm:px-6 open:bg-orange-50/40 open:border-orange-100 transition-colors">
                <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none text-lg font-bold text-gray-900">
                  {faq.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-primary-orange transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-gray-600 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 오시는 길 + 지도 + 전화 */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-14 items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-4 shadow-sm">
                <Navigation className="h-3.5 w-3.5" /> 오시는 길
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold mb-7 text-gray-900">행복한요양원 녹양역점 찾아오시는 길</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-4 rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary-orange"><MapPin className="h-5 w-5" /></span>
                  <div>
                    <div className="font-bold text-gray-900 mb-0.5">주소</div>
                    <div className="text-gray-700 leading-relaxed">{FACILITY.address}</div>
                    <div className="text-sm text-gray-500 mt-1">녹양역 인근 · 의정부에서 차로 약 5분</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary-orange"><Phone className="h-5 w-5" /></span>
                  <div>
                    <div className="font-bold text-gray-900 mb-0.5">전화번호</div>
                    <a href={`tel:${SITE_INFO.phone}`} className="text-gray-700 hover:text-primary-orange transition-colors">{SITE_INFO.phone} (856.8090)</a>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-2xl bg-white p-5 border border-gray-100 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary-orange"><Clock3 className="h-5 w-5" /></span>
                  <div>
                    <div className="font-bold text-gray-900 mb-0.5">면회·상담 시간</div>
                    <div className="text-gray-700 leading-relaxed">매일 09:00 ~ 18:00 (방문 전 연락 권장)</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-white p-5 sm:p-6 border border-gray-100 shadow-sm space-y-4">
                <div>
                  <p className="font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-primary-orange"><Car className="h-4 w-4" /></span>
                    차량으로 오시는 길
                  </p>
                  {content.carTime && (
                    <p className="text-sm text-gray-700">
                      차량 기준 <span className="font-bold text-primary-orange">{content.carTime}</span>{' '}
                      <span className="text-xs text-gray-400">({CAR_TIME_DISCLAIMER})</span>
                    </p>
                  )}
                  {content.routeCar && <p className="mt-1 text-sm text-gray-600 leading-relaxed">{content.routeCar}</p>}
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <p className="font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-primary-orange"><Bus className="h-4 w-4" /></span>
                    대중교통으로 오시는 길
                  </p>
                  <p className="text-sm text-gray-700">{content.transitArea ?? '수도권 전철 1호선 녹양역 생활권'}</p>
                  <p className="mt-1.5 text-xs text-gray-500">인근을 지나는 대표 버스 (예시) · {BUS_EXAMPLES.join(' · ')}</p>
                  <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{TRANSIT_NOTE}</p>
                </div>
                {content.accessAdvantage && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-primary-orange"><CheckCircle2 className="h-4 w-4" /></span>
                      방문·면회 편의
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">{content.accessAdvantage}</p>
                  </div>
                )}
              </div>

              <p className="mt-5 text-center text-base font-bold text-gray-800">
                생각보다 가까운 거리에서 부모님의 생활을 직접 확인해보세요.
              </p>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <a href={MAP_LINKS.naver} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl border border-gray-200 text-gray-800 font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors">
                  <Navigation className="h-4 w-4" /> 네이버지도
                </a>
                <a href={MAP_LINKS.kakao} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl border border-gray-200 text-gray-800 font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors">
                  <Navigation className="h-4 w-4" /> 카카오맵
                </a>
                <TrackedCTA eventType="phone_click" componentName="LocationCTA" sectionName="LocationSection" buttonLabel="전화 상담" destination={`tel:${FACILITY.phone}`} className="inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-primary-orange to-amber-500 text-white font-bold shadow-lg shadow-orange-200 hover:scale-[1.01] transition-transform">
                  <Phone className="h-4 w-4" /> 전화 상담
                </TrackedCTA>
              </div>
            </div>

            <div className="h-[380px] lg:h-[560px] rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.12)] bg-gray-100">
              <KakaoMap lat={SITE_GEO.lat} lng={SITE_GEO.lng} level={3} markerTitle="행복한요양원 녹양역점" height="100%" />
            </div>
          </div>
        </div>
      </section>

      {/* 하단 상담 CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary-orange to-primary-brown text-white p-8 sm:p-10 text-center shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">부모님 요양원 선택, 직접 방문해보시고 결정하세요</h2>
            <p className="text-white/90 mb-7">전화 한 통이면 방문 상담 일정을 편하게 잡아드립니다. · {FACILITY.address}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <TrackedCTA eventType="phone_click" componentName="FinalCTA" sectionName="BottomCTA" buttonLabel={`${FACILITY.phone} 상담하기`} destination={`tel:${FACILITY.phone}`} className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-primary-orange rounded-2xl font-bold hover:bg-gray-100 transition-colors">
                <Phone className="h-5 w-5" /> {FACILITY.phone} 상담하기
              </TrackedCTA>
              <a href={MAP_LINKS.naver} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-2xl font-bold hover:bg-white/20 transition-colors">
                <Navigation className="h-5 w-5" /> 네이버지도 길찾기
              </a>
              <a href={MAP_LINKS.kakao} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-2xl font-bold hover:bg-white/20 transition-colors">
                <Navigation className="h-5 w-5" /> 카카오맵 길찾기
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 다른 지역 안내 (내부 링크) */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">지역별 안내 페이지</h2>
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-3">경기 북부</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {[
                  { href: '/yangju-nursing-home', label: '양주요양원' },
                  { href: '/uijeongbu-nursing-home', label: '의정부요양원' },
                  { href: '/nogyang-station-nursing-home', label: '녹양역요양원' },
                  { href: '/nursing-home-near-uijeongbu-yangju', label: '의정부·양주 인근' },
                ].filter((l) => l.href !== content.path).map((l) => (
                  <Link key={l.href} href={l.href} className="group flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 font-semibold hover:border-primary-orange hover:bg-orange-50/50 hover:text-primary-orange transition-colors">
                    {l.label}
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-3">서울 북부에서 오시는 분</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {[
                  { href: '/seoul-northern-nursing-home', label: '서울 북부 전체' },
                  { href: '/dobong-nursing-home', label: '도봉구요양원' },
                  { href: '/nowon-nursing-home', label: '노원구요양원' },
                  { href: '/gangbuk-nursing-home', label: '강북구요양원' },
                  { href: '/jungnang-nursing-home', label: '중랑구요양원' },
                  { href: '/seongbuk-nursing-home', label: '성북구요양원' },
                  { href: '/gangdong-nursing-home', label: '강동구요양원' },
                ].filter((l) => l.href !== content.path).map((l) => (
                  <Link key={l.href} href={l.href} className="group flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 font-semibold hover:border-primary-orange hover:bg-orange-50/50 hover:text-primary-orange transition-colors">
                    {l.label}
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
