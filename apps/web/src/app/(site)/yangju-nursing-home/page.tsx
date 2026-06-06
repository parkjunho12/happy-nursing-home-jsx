import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import {
  Heart,
  ShieldCheck,
  Sparkles,
  Users,
  Stethoscope,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Home,
} from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import KakaoMap from '@/components/map/KaKaoMap'

export const metadata: Metadata = {
  title: '양주요양원 찾으신다면 | 행복한요양원 녹양역점',
  description:
    '양주요양원을 찾는 보호자님께 행복한요양원 녹양역점을 안내드립니다. 양주·의정부 인근 접근성, 장기요양등급 입소상담, 치매·거동불편 어르신 케어, 낙상 예방 중심의 생활관리와 보행재활 환경을 확인해보세요.',
  keywords: [
    '양주요양원',
    '의정부요양원',
    '녹양역요양원',
    '양주 근처 요양원',
    '양주 치매 요양원',
    '양주 장기요양등급 요양원',
    '거동불편 요양원',
    '행복한요양원 녹양역점',
  ],
  openGraph: {
    title: '양주요양원 찾으신다면 | 행복한요양원 녹양역점',
    description:
      '양주·의정부 인근 보호자님을 위한 요양원 입소상담, 생활환경, 안전관리, 보행재활 안내.',
    type: 'website',
    locale: 'ko_KR',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const coreValues = [
  {
    icon: <Heart className="w-7 h-7" />,
    title: '가족 같은 돌봄',
    description:
      '어르신 한 분 한 분의 생활 리듬과 성향을 존중하며 편안한 생활을 돕습니다.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: <ShieldCheck className="w-7 h-7" />,
    title: '안전 중심 운영',
    description:
      '생활 동선, 낙상 예방, 응급 대응 체계를 중심으로 안전한 환경을 준비합니다.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: <Stethoscope className="w-7 h-7" />,
    title: '건강 관리 체계',
    description:
      '간호 및 건강관리 체계를 바탕으로 어르신 상태를 세심하게 살핍니다.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: <Users className="w-7 h-7" />,
    title: '보호자 소통',
    description:
      '보호자분들이 궁금해하시는 비용, 절차, 생활 안내를 쉽게 설명해드립니다.',
    color: 'bg-amber-50 text-amber-600',
  },
]

const highlights = [
  '녹양역 인근으로 접근이 편리한 위치',
  '편안한 생활 중심의 요양 환경',
  '밝고 정돈된 공용 공간과 생활 공간',
  '입소 전 상담부터 차분하게 안내',
]

const seoHighlights = [
  '양주·의정부 인근 보호자님 방문 상담 가능',
  '장기요양등급 입소 절차 및 준비서류 안내',
  '치매·거동불편 어르신 생활 케어 상담',
  '낙상 예방과 보행 상태를 고려한 안전 중심 운영',
]

const admissionFaqs = [
  {
    question: '양주에 거주 중인데 행복한요양원 녹양역점 입소 상담이 가능한가요?',
    answer:
      '가능합니다. 어르신의 장기요양등급, 건강 상태, 현재 돌봄 상황을 확인한 뒤 입소 가능 여부와 준비서류를 안내드립니다.',
  },
  {
    question: '양주요양원을 알아볼 때 무엇을 먼저 확인해야 하나요?',
    answer:
      '거리뿐 아니라 낙상 위험 관리, 식사·배설·목욕 등 일상생활 지원, 간호 관찰 체계, 보호자 소통 방식을 함께 확인하는 것이 좋습니다.',
  },
  {
    question: '치매 어르신도 상담 가능한가요?',
    answer:
      '상담 가능합니다. 배회, 불안, 수면, 식사, 배설, 낙상 위험도 등을 함께 확인하여 시설 생활 가능 여부를 안내드립니다.',
  },
  {
    question: '방문 상담은 예약해야 하나요?',
    answer:
      '보호자님께 충분한 상담 시간을 드리기 위해 방문 전 전화 또는 온라인 상담 예약을 권장드립니다.',
  },
]

const facilityPhotos = [
  {
    src: '/assets/images/introduce-1.png',
    alt: '어르신들이 함께 식사하고 대화하는 공간 이미지',
    title: '밝고 편안한 생활 분위기',
    description: '어르신들이 일상 속에서 편안하게 지내실 수 있는 분위기를 중요하게 생각합니다.',
  },
  {
    src: '/assets/images/introduce-2.png',
    alt: '어르신들이 함께 운동 프로그램에 참여하는 모습',
    title: '활동과 재활을 고려한 프로그램',
    description: '무리하지 않으면서도 꾸준히 참여할 수 있는 생활 프로그램을 준비합니다.',
  },
  {
    src: '/assets/images/introduce-3.png',
    alt: '케어 선생님과 어르신이 함께 웃는 모습',
    title: '따뜻한 케어 관계',
    description: '시설의 분위기는 결국 사람에게서 만들어진다고 생각합니다.',
  },
  {
    src: '/assets/images/introduce-4.png',
    alt: '어르신들이 원예 활동을 즐기는 모습',
    title: '정서적 안정과 여가 시간',
    description: '생활의 안정감과 소소한 즐거움을 함께 드릴 수 있도록 준비합니다.',
  },
]

const facilitySpaces = [
  {
    title: '생활실',
    description: '어르신께서 편안하게 쉬실 수 있도록 정돈된 생활 공간을 제공합니다.',
  },
  {
    title: '공용 생활 공간',
    description: '식사, 대화, 휴식이 자연스럽게 이어질 수 있는 공용 공간을 운영합니다.',
  },
  {
    title: '프로그램 공간',
    description: '인지 활동, 여가 활동, 생활 프로그램이 가능한 공간을 준비합니다.',
  },
  {
    title: '간호·건강 관리 공간',
    description: '기본 건강 상태 확인과 일상적인 건강 관리를 위한 체계를 갖춥니다.',
  },
  {
    title: '위생 관리 공간',
    description: '청결과 위생 관리가 유지될 수 있도록 일상 운영 기준을 적용합니다.',
  },
  {
    title: '보호자 상담 공간',
    description: '입소 상담과 안내를 차분히 받으실 수 있도록 상담 환경을 준비합니다.',
  },
]

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'NursingHome',
  name: '행복한요양원 녹양역점',
  description:
    '양주·의정부 인근 보호자님을 위한 요양원 입소상담, 장기요양등급 상담, 치매·거동불편 어르신 케어, 낙상 예방 중심 생활관리 안내.',
  telephone: SITE_INFO.phone,
  email: SITE_INFO.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: SITE_INFO.address.full,
    addressCountry: 'KR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 37.76774123217728,
    longitude: 127.04359415733941,
  },
  areaServed: ['양주시', '의정부시', '녹양동', '가능동', '덕계동', '옥정동'],
  keywords:
    '양주요양원, 의정부요양원, 녹양역요양원, 장기요양등급 요양원, 치매 요양원, 거동불편 요양원',
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: admissionFaqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      <Script
        id="local-business-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Script
        id="faq-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      {/* Hero */}
      <section className="relative overflow-hidden">
      <div className="relative h-[120px] sm:h-[180px] lg:h-[320px]">
          <Image
            src="/assets/images/hero-8-image.png"
            alt="행복한요양원 녹양역점 시설 소개 배경 이미지"
            fill
            priority
            quality={92}
            className="object-cover object-center"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,28,38,0.30)_0%,rgba(18,28,38,0.18)_34%,rgba(18,28,38,0.08)_62%,rgba(18,28,38,0.03)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.03)_0%,rgba(0,0,0,0.06)_100%)]" />
        </div>

        <div className="absolute inset-0 z-10 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <Heart className="h-4 w-4 text-orange-300" />
                <span className="text-sm font-semibold text-white/90">
                  편안한 생활과 따뜻한 돌봄
                </span>
              </div>

              <h2 className="text-balance text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-7xl">
                양주요양원을 찾는
                <br />
                보호자님께
              </h2>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8 lg:text-xl">
                행복한요양원 녹양역점은 양주·의정부 인근 보호자님들이
                방문 상담하기 편한 위치에서 어르신의 안전, 건강관리, 생활 적응을
                세심하게 돕는 요양시설입니다.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
                  <MapPin className="h-4 w-4 text-orange-300" />
                  녹양역 인근
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
                  <ShieldCheck className="h-4 w-4 text-orange-300" />
                  양주요양원, 의정부요양원 안전 중심 환경
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
                  <Sparkles className="h-4 w-4 text-orange-300" />
                  쾌적한 생활 공간
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 mb-6">
                <Clock3 className="w-4 h-4" />
                보호자 중심으로 차분하게 안내드립니다
              </div>

              <h2 className="text-3xl lg:text-5xl font-bold leading-tight text-gray-900 mb-6">
                양주요양원 선택,
                <br />
                위치보다 중요한 것은
                <br />
                매일의 돌봄입니다
              </h2>

              <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                <p>
                  양주요양원을 알아보실 때는 거리뿐 아니라 어르신의 상태를 얼마나
                  세심하게 살피는지, 낙상 예방과 건강 관찰 체계가 갖춰져 있는지
                  함께 확인해야 합니다.
                </p>
                <p>
                  행복한요양원 녹양역점은 양주·의정부 인근 보호자님께
                  <strong className="text-primary-orange"> 입소 상담, 생활 환경, 비용 안내, 장기요양등급 관련 절차</strong>를
                  차분하게 설명드립니다.
                </p>
                <p>
                  치매, 거동불편, 낙상 위험, 식사·배설·목욕 도움이 필요한 어르신의
                  생활 상태를 확인하고 보호자님께 현실적인 입소 방향을 안내합니다.
                </p>
              </div>

              <div className="mt-8 grid sm:grid-cols-2 gap-3">
                {seoHighlights.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-gray-50 px-4 py-4"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary-orange mt-0.5 shrink-0" />
                    <span className="text-gray-700 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-orange text-white rounded-xl font-semibold hover:bg-primary-orange/90 transition-colors"
                >
                  상담 신청하기
                  <ChevronRight className="w-5 h-5" />
                </Link>

                <a
                  href={`tel:${SITE_INFO.phone}`}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-gray-300 text-gray-800 rounded-xl font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  전화 상담
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="relative h-[420px] lg:h-[540px] rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                <Image
                  src="/assets/images/exterior.png"
                  alt="행복한요양원의 따뜻한 돌봄 분위기를 보여주는 이미지"
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
                      편안한 생활 환경을 갖추고 있습니다
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      생활 공간, 프로그램 운영, 보호자 상담 체계를 포함해
                      어르신과 가족 모두 안심할 수 있는 환경을 만들어가고 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core values */}
      <section className="py-16 lg:py-24 bg-[#faf7f3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              행복한요양원이 중요하게 생각하는 것
            </h2>
            <p className="text-lg lg:text-xl text-gray-600">
              요양원 선택에서 가장 중요한 기준을 중심으로 운영합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl bg-white p-7 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center mb-5`}>
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
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                이런 분위기의 생활을 준비합니다
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl leading-relaxed">
                어르신의 일상은 단순히 시설이 아니라 분위기와 사람, 생활 리듬에서
                결정됩니다. 따뜻하고 안정된 환경을 가장 중요하게 생각합니다.
              </p>
            </div>

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-primary-orange font-semibold hover:text-primary-orange/80 transition-colors"
            >
              상담 예약하기
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {facilityPhotos.map((photo) => (
              <div
                key={photo.title}
                className="group overflow-hidden rounded-[28px] bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="relative h-72 lg:h-80 overflow-hidden">
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

      {/* Spaces */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              주요 공간 안내
            </h2>
            <p className="text-lg lg:text-xl text-gray-600">
              생활과 케어에 필요한 공간을 균형 있게 준비합니다
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilitySpaces.map((space) => (
              <div
                key={space.title}
                className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {space.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {space.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location & Contact */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-14 items-start">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-8 text-gray-900">
                오시는 길
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-2xl bg-gray-50 p-5">
                  <MapPin className="w-6 h-6 text-primary-orange mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">주소</div>
                    <div className="text-gray-700 leading-relaxed">
                      {SITE_INFO.address.full}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-gray-50 p-5">
                  <Phone className="w-6 h-6 text-primary-orange mt-1 shrink-0" />
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

                <div className="flex items-start gap-4 rounded-2xl bg-gray-50 p-5">
                  <Mail className="w-6 h-6 text-primary-orange mt-1 shrink-0" />
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

              <div className="mt-8 rounded-3xl border border-orange-100 bg-orange-50 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  방문 전 상담 예약을 추천드립니다
                </h3>
                <p className="text-gray-700 leading-relaxed mb-5">
                  어르신 상태와 상담 목적에 맞춰 보다 차분하게 안내드릴 수 있도록
                  방문 전 연락을 주시면 더욱 원활하게 상담받으실 수 있습니다.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-orange text-white rounded-xl font-semibold hover:bg-primary-orange/90 transition-colors"
                  >
                    상담 신청하기
                    <ChevronRight className="w-5 h-5" />
                  </Link>

                  <a
                    href={`tel:${SITE_INFO.phone}`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-orange-200 text-gray-800 rounded-xl font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                    전화 상담
                  </a>
                </div>
              </div>
            </div>

            <div className="h-[420px] lg:h-[560px] rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.12)] bg-gray-100">
              <KakaoMap
                lat={37.76774123217728}
                lng={127.04359415733941}
                level={3}
                markerTitle="행복한요양원 녹양역점"
                height="100%"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ for SEO */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              양주요양원 상담 전 자주 묻는 질문
            </h2>
            <p className="text-lg text-gray-600">
              보호자님들이 상담 전에 많이 궁금해하시는 내용을 정리했습니다.
            </p>
          </div>

          <div className="space-y-4">
            {admissionFaqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            양주요양원 상담이 필요하시다면
          </h2>
          <p className="text-xl mb-8 text-white/90 leading-relaxed">
            입소 절차, 비용, 생활 환경까지
            <br className="hidden sm:block" />
            궁금하신 내용을 차분하게 안내해드립니다.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`tel:${SITE_INFO.phone}`}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-xl font-semibold hover:bg-gray-100 transition-colors"
            >
              <Phone className="w-5 h-5" />
              전화 상담
            </a>

            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-xl font-semibold hover:bg-white/20 transition-colors"
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