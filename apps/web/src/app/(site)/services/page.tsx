import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Stethoscope,
  Utensils,
  Activity,
  Home,
  Heart,
  Users,
  Brain,
  Music,
  Palette,
  Leaf,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Clock3,
} from 'lucide-react'

export const metadata: Metadata = {
  title: '서비스 안내 | 행복한요양원 녹양역점',
  description:
    '24시간 전문 간호, 영양 맞춤 식단, 재활 프로그램, 쾌적한 생활 환경까지. 행복한요양원 녹양역점의 체계적인 서비스를 소개합니다.',
}

export default function ServicesPage() {
  const coreServices = [
    {
      icon: <Stethoscope className="w-10 h-10" />,
      title: '24시간 전문 간호',
      description:
        '간호사와 요양보호사가 상주하며 어르신의 건강 상태를 세심하게 살피고 일상 속 변화를 꾸준히 확인합니다.',
      features: [
        '혈압, 혈당 등 정기 건강 체크',
        '투약 관리 및 복약 지원',
        '응급 상황 즉시 대응',
        '정기 병원 진료 연계',
      ],
      color: 'from-sky-500 to-blue-600',
      image: '/assets/images/service-1.png',
    },
    {
      icon: <Utensils className="w-10 h-10" />,
      title: '영양 맞춤 식단',
      description:
        '어르신의 건강 상태와 식사 특성을 고려해 균형 잡힌 식단을 제공하고, 식사 시간도 편안하게 돕습니다.',
      features: [
        '당뇨식, 저염식 등 맞춤 식단',
        '신선한 재료로 정성껏 조리',
        '계절을 반영한 다양한 메뉴',
        '식사 상태 관찰 및 관리',
      ],
      color: 'from-emerald-500 to-green-600',
      image: '/assets/images/service-2.png',
    },
    {
      icon: <Activity className="w-10 h-10" />,
      title: '재활 프로그램',
      description:
        '무리하지 않으면서도 꾸준히 참여할 수 있는 생활 중심 재활 프로그램으로 일상 기능 유지를 돕습니다.',
      features: [
        '개별 맞춤 운동 프로그램',
        '관절 운동 및 근력 강화',
        '보행 훈련 및 균형 감각 지원',
        '일상생활 동작 훈련',
      ],
      color: 'from-violet-500 to-purple-600',
      image: '/assets/images/service-3.png',
    },
    {
      icon: <Home className="w-10 h-10" />,
      title: '쾌적한 생활 환경',
      description:
        '안전과 청결, 생활 편의를 함께 고려한 환경 속에서 어르신이 편안하게 지내실 수 있도록 준비합니다.',
      features: [
        '1인실, 2인실, 4인실 선택 가능',
        '냉난방 완비',
        '안전 손잡이 및 미끄럼 방지',
        '정기 소독 및 청결 관리',
      ],
      color: 'from-amber-500 to-orange-600',
      image: '/assets/images/service-4.png',
    },
  ]

  const programs = [
    {
      icon: <Brain className="w-7 h-7" />,
      title: '인지 활동',
      description: '기억력과 집중력 유지에 도움이 되는 활동을 진행합니다.',
      activities: ['회상 활동', '퍼즐', '숫자 놀이', '글쓰기'],
      color: 'bg-rose-50 text-rose-600 border-rose-100',
    },
    {
      icon: <Music className="w-7 h-7" />,
      title: '음악 활동',
      description: '음악을 통해 정서적 안정과 즐거운 시간을 돕습니다.',
      activities: ['노래 교실', '악기 활동', '음악 감상', '리듬 활동'],
      color: 'bg-sky-50 text-sky-600 border-sky-100',
    },
    {
      icon: <Palette className="w-7 h-7" />,
      title: '미술 활동',
      description: '창작 활동을 통해 표현과 성취의 즐거움을 느끼실 수 있습니다.',
      activities: ['그림 그리기', '만들기', '서예', '색칠하기'],
      color: 'bg-violet-50 text-violet-600 border-violet-100',
    },
    {
      icon: <Leaf className="w-7 h-7" />,
      title: '원예 활동',
      description: '자연과 함께하며 편안함과 활력을 느끼는 시간을 제공합니다.',
      activities: ['화분 가꾸기', '텃밭 체험', '꽃꽂이', '산책'],
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      icon: <Heart className="w-7 h-7" />,
      title: '여가 활동',
      description: '하루를 보다 즐겁고 활기차게 보내실 수 있도록 돕습니다.',
      activities: ['영화 감상', '보드게임', '생일 축하', '계절 행사'],
      color: 'bg-orange-50 text-orange-600 border-orange-100',
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: '사회 활동',
      description: '교류와 소속감을 느낄 수 있는 다양한 참여 기회를 제공합니다.',
      activities: ['단체 활동', '나들이', '가족 행사', '봉사 연계'],
      color: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    },
  ]

  const dailySchedule = [
    { time: '07:00', activity: '기상 및 세면' },
    { time: '08:00', activity: '아침 식사' },
    { time: '09:00', activity: '건강 체크' },
    { time: '10:00', activity: '오전 프로그램' },
    { time: '12:00', activity: '점심 식사' },
    { time: '13:00', activity: '휴식 시간' },
    { time: '14:00', activity: '오후 프로그램' },
    { time: '16:00', activity: '간식 시간' },
    { time: '18:00', activity: '저녁 식사' },
    { time: '19:00', activity: '여가 활동' },
    { time: '21:00', activity: '취침 준비' },
  ]

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative h-[180px] sm:h-[240px] lg:h-[360px]">
          <Image
            src="/assets/images/hero-6-image.png"
            alt="행복한요양원 녹양역점 서비스 안내 배경 이미지"
            fill
            priority
            quality={92}
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(34,25,20,0.58)_0%,rgba(34,25,20,0.38)_35%,rgba(34,25,20,0.16)_65%,rgba(34,25,20,0.06)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.12)_100%)]" />
        </div>

        <div className="absolute inset-0 z-10 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-white" />
                어르신의 편안한 일상을 위한 체계적인 돌봄 서비스
              </div>

              <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-7xl">
                서비스 안내
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8 lg:text-xl">
                건강 관리부터 일상 케어, 생활 프로그램까지
                <br className="hidden sm:block" />
                어르신께 꼭 필요한 서비스를 세심하게 준비합니다
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Intro visual band */}
      <section className="relative bg-[#fffaf6] py-14 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex rounded-full bg-primary-orange/10 px-4 py-2 text-sm font-semibold text-primary-orange">
                행복한요양원 서비스 철학
              </span>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-gray-900 lg:text-4xl">
                단순한 돌봄을 넘어
                <br />
                편안한 생활과 신뢰를 함께 제공합니다
              </h2>
              <p className="mt-5 text-lg leading-8 text-gray-600">
                보호자분들이 중요하게 생각하시는 것은 결국
                <strong className="text-gray-900"> 건강 관리, 안전, 생활의 편안함, 그리고 정서적 안정</strong>입니다.
                행복한요양원 녹양역점은 이 네 가지가 균형 있게 이루어질 수 있도록
                기본 서비스와 생활 프로그램을 함께 설계합니다.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-primary-orange">건강 관리</p>
                  <p className="mt-2 text-gray-700">정기 체크와 일상 관찰을 통해 작은 변화도 놓치지 않도록 돕습니다.</p>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-primary-orange">생활 케어</p>
                  <p className="mt-2 text-gray-700">식사, 위생, 휴식, 활동까지 생활 흐름 전반을 세심하게 지원합니다.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative h-56 overflow-hidden rounded-3xl shadow-lg sm:h-64">
                <Image
                  src="/assets/images/dining.JPG"
                  alt="어르신 생활 공간 이미지"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative mt-8 h-56 overflow-hidden rounded-3xl shadow-lg sm:h-64">
                <Image
                  src="/assets/images/hero-7-image.png"
                  alt="케어 장면 이미지"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Services */}
      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">핵심 서비스</h2>
            <p className="mt-4 text-lg text-gray-600 lg:text-xl">
              전문성과 정성을 바탕으로 일상을 안정적으로 지원합니다
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {coreServices.map((service, index) => (
              <div
                key={index}
                className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="relative min-h-[240px]">
                    <Image
                      src={service.image}
                      alt={service.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/5 to-transparent" />
                  </div>

                  <div className="p-7 lg:p-8">
                    <div
                      className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${service.color} text-white shadow-md`}
                    >
                      {service.icon}
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900">{service.title}</h3>
                    <p className="mt-3 leading-7 text-gray-600">{service.description}</p>

                    <ul className="mt-6 space-y-3">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-green" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-end gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">다양한 생활 프로그램</h2>
              <p className="mt-4 text-lg leading-8 text-gray-600">
                매일의 생활이 단조롭지 않도록,
                어르신의 흥미와 참여를 고려한 프로그램을 준비합니다.
              </p>
            </div>

            <div className="relative h-56 overflow-hidden rounded-3xl shadow-lg lg:h-72">
              <Image
                src="/assets/images/service-5.png"
                alt="행복한요양원 프로그램 활동 이미지"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/35 to-transparent" />
              <div className="absolute left-6 top-6 max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 text-white backdrop-blur-md">
                <p className="text-sm font-semibold text-white/85">생활 프로그램</p>
                <p className="mt-2 text-lg font-bold">인지·정서·여가 활동을 균형 있게 운영합니다</p>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program, index) => (
              <div
                key={index}
                className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className={`mb-4 inline-flex rounded-2xl border p-4 ${program.color}`}>
                  {program.icon}
                </div>

                <h3 className="text-xl font-bold text-gray-900">{program.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{program.description}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {program.activities.map((activity, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700"
                    >
                      {activity}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Schedule */}
      {/* <section className="bg-white py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-orange/10 px-4 py-2 text-sm font-semibold text-primary-orange">
              <Clock3 className="h-4 w-4" />
              하루 일과 예시
            </div>

            <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">규칙적이고 편안한 생활 리듬</h2>
            <p className="mt-4 text-lg text-gray-600 lg:text-xl">
              무리하지 않는 일상 흐름 속에서 건강한 생활을 돕습니다
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {dailySchedule.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-[#fffaf6] p-4 transition-all hover:border-primary-orange/30 hover:bg-white hover:shadow-md"
              >
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-orange to-primary-brown text-white shadow-sm">
                  <span className="text-sm font-bold">{item.time}</span>
                </div>

                <div className="flex-1">
                  <p className="text-lg font-semibold text-gray-900">{item.activity}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-center text-gray-700">
              ※ 실제 일과는 어르신의 건강 상태와 생활 필요에 따라 조정될 수 있습니다.
            </p>
          </div>
        </div>
      </section> */}

      {/* Bottom CTA */}
      <section className="relative overflow-hidden py-16 text-white lg:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-orange to-primary-brown" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_30%)]" />

        <div className="relative max-w-4xl mx-auto px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-5 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            상담 전 방문 전에도 편하게 문의하실 수 있습니다
          </div>

          <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
            더 자세한 서비스가 궁금하신가요?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/90">
            어르신의 상태와 필요한 돌봄 방향에 맞춰
            보호자분이 이해하기 쉬운 상담으로 차근차근 안내해 드립니다.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-primary-orange transition-colors hover:bg-gray-100"
            >
              상담 신청하기
              <ChevronRight className="h-5 w-5" />
            </Link>

            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-8 py-4 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              입소비용 안내 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}