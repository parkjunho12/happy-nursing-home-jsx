import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin,
  Phone,
  Clock3,
  Train,
  Car,
  Bus,
  Navigation,
  ChevronRight,
  Heart,
  CalendarCheck,
} from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import KakaoMap from '@/components/map/KaKaoMap'

const BASE_URL = 'https://www.행복한요양원녹양역.com'
const PATH = '/location'
const GEO = { lat: 37.76774123217728, lng: 127.04359415733941 }
const KAKAO_MAP_URL = `https://map.kakao.com/?q=${encodeURIComponent(
  SITE_INFO.address.full,
)}`

export const metadata: Metadata = {
  title: '오시는 길 | 행복한요양원 녹양역점 (녹양역 인근·의정부 차로 5분)',
  description:
    '행복한요양원 녹양역점 오시는 길을 안내드립니다. 주소, 지도, 지하철 1호선 녹양역 접근, 의정부에서 차로 약 5분 거리, 면회·상담 시간(09:00~18:00)을 확인하세요. 문의 031-856-8090.',
  keywords: [
    '행복한요양원 녹양역점 오시는 길',
    '녹양역요양원 위치',
    '양주요양원 위치',
    '의정부요양원 오시는 길',
    '녹양역 요양원 주소',
  ],
  alternates: { canonical: `${BASE_URL}${PATH}` },
  openGraph: {
    title: '오시는 길 | 행복한요양원 녹양역점',
    description:
      '녹양역 인근, 의정부에서 차로 약 5분. 주소·지도·교통편·면회 시간 안내.',
    url: `${BASE_URL}${PATH}`,
    type: 'website',
    locale: 'ko_KR',
    siteName: '행복한요양원 녹양역점',
  },
  robots: { index: true, follow: true },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'NursingHome',
  '@id': `${BASE_URL}${PATH}#nursinghome`,
  name: '행복한요양원 녹양역점',
  description:
    '녹양역 인근 단독건물형 요양원. 의정부에서 차로 약 5분 거리로 면회와 상담이 편리합니다.',
  url: `${BASE_URL}${PATH}`,
  telephone: SITE_INFO.phone,
  email: SITE_INFO.email,
  hasMap: KAKAO_MAP_URL,
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
    latitude: GEO.lat,
    longitude: GEO.lng,
  },
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
  areaServed: ['양주시', '의정부시', '녹양동', '가능동', '경기북부'],
}

const transit = [
  {
    icon: <Train className="w-7 h-7" />,
    title: '지하철',
    color: 'bg-blue-50 text-blue-600',
    desc: '수도권 전철 1호선 녹양역 인근에 있어 대중교통으로 방문하기 편합니다. 역에서의 도보 경로는 전화로 안내드립니다.',
  },
  {
    icon: <Car className="w-7 h-7" />,
    title: '자가용',
    color: 'bg-emerald-50 text-emerald-600',
    desc: '의정부 시내에서 차로 약 5분 거리입니다. 내비게이션에 "행복한요양원 녹양역점" 또는 아래 주소를 입력해 오시면 됩니다.',
  },
  {
    icon: <Bus className="w-7 h-7" />,
    title: '버스',
    color: 'bg-amber-50 text-amber-600',
    desc: '녹양역·인근 정류장을 경유하는 버스로도 접근하실 수 있습니다. 출발 위치에 따른 노선은 방문 전 문의 주시면 안내드립니다.',
  },
]

export default function LocationPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative h-[160px] sm:h-[220px] lg:h-[300px]">
          <Image
            src="/assets/images/hero-8-image.png"
            alt="행복한요양원 녹양역점 오시는 길 안내 배경 이미지"
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
                  녹양역 인근 · 의정부에서 차로 약 5분
                </span>
              </div>
              <h1 className="text-balance text-3xl font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
                오시는 길
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                행복한요양원 녹양역점은 녹양역 인근에 자리한 단독건물형 요양원입니다.
                방문과 면회가 편하도록 위치와 교통편을 안내드립니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 기본 정보 카드 */}
      <section className="py-14 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="font-bold text-gray-900 mb-1">주소</div>
              <p className="text-gray-700 leading-relaxed">
                {SITE_INFO.address.full}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                녹양역 인근 · 의정부에서 차로 약 5분
              </p>
            </div>

            <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Phone className="w-6 h-6" />
              </div>
              <div className="font-bold text-gray-900 mb-1">전화 문의</div>
              <a
                href={`tel:${SITE_INFO.phone}`}
                className="text-gray-700 hover:text-primary-orange transition-colors"
              >
                {SITE_INFO.phone} (856.8090)
              </a>
              <p className="text-sm text-gray-500 mt-1">
                길 안내·방문 예약 문의 환영
              </p>
            </div>

            <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4">
                <Clock3 className="w-6 h-6" />
              </div>
              <div className="font-bold text-gray-900 mb-1">면회·상담 시간</div>
              <p className="text-gray-700 leading-relaxed">매일 09:00 ~ 18:00</p>
              <p className="text-sm text-gray-500 mt-1">
                방문 전 연락 주시면 더 여유롭게 안내드립니다
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 지도 */}
      <section className="pb-4 lg:pb-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">
              지도로 위치 확인
            </h2>
            <a
              href={KAKAO_MAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-orange font-semibold hover:text-primary-orange/80 transition-colors"
            >
              <Navigation className="w-5 h-5" />
              카카오맵에서 길찾기
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <div className="h-[380px] lg:h-[520px] rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.12)] bg-gray-100">
            <KakaoMap
              lat={GEO.lat}
              lng={GEO.lng}
              level={3}
              markerTitle="행복한요양원 녹양역점"
              height="100%"
            />
          </div>
        </div>
      </section>

      {/* 교통편 */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              교통편 안내
            </h2>
            <p className="text-lg text-gray-600">
              대중교통과 자가용 모두 접근이 편리한 위치입니다.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {transit.map((t) => (
              <div
                key={t.title}
                className="rounded-3xl bg-white p-7 shadow-sm border border-gray-100"
              >
                <div
                  className={`w-14 h-14 rounded-2xl ${t.color} flex items-center justify-center mb-5`}
                >
                  {t.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-orange-100 bg-orange-50 p-6 flex items-start gap-4">
            <CalendarCheck className="w-6 h-6 text-primary-orange mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-gray-900 mb-1">방문 전 연락을 권장드립니다</p>
              <p className="text-gray-700 leading-relaxed">
                출발 위치에 맞는 가장 빠른 경로와 주차 안내를 도와드리고,
                면회·상담 시간을 여유 있게 잡아드릴 수 있습니다. 부담 없이
                전화 주세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold mb-4">
            방문이나 면회를 계획 중이시라면
          </h2>
          <p className="text-lg mb-8 text-white/90 leading-relaxed">
            길 안내와 방문 예약을 전화로 편하게 도와드립니다.
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
    </div>
  )
}
