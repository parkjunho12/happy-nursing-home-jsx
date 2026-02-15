import { Metadata } from 'next'
import Link from 'next/link'
import { Stethoscope, Utensils, Activity, Home, Heart, Users, Brain, Music, Palette, Leaf, CheckCircle, ChevronRight } from 'lucide-react'
import { SERVICES } from '@/lib/constants'

export const metadata: Metadata = {
  title: '서비스 안내 | 행복한요양원 녹양역점',
  description: '24시간 전문 간호, 영양 맞춤 식단, 다양한 프로그램 등 행복한요양원의 체계적인 서비스를 소개합니다.',
}

export default function ServicesPage() {
  const coreServices = [
    {
      icon: <Stethoscope className="w-12 h-12" />,
      title: '24시간 전문 간호',
      description: '간호사와 요양보호사가 24시간 상주하여 건강 상태를 모니터링합니다',
      features: [
        '혈압, 혈당 등 정기 건강 체크',
        '투약 관리 및 복약 지도',
        '응급 상황 즉시 대응',
        '정기 병원 진료 동행',
      ],
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: <Utensils className="w-12 h-12" />,
      title: '영양 맞춤 식단',
      description: '영양사가 설계한 균형 잡힌 식단으로 건강한 식사를 제공합니다',
      features: [
        '당뇨식, 저염식 등 개인 맞춤',
        '신선한 재료로 매일 조리',
        '계절별 다양한 메뉴',
        '영양 상담 및 관리',
      ],
      color: 'from-green-500 to-green-600',
    },
    {
      icon: <Activity className="w-12 h-12" />,
      title: '재활 프로그램',
      description: '전문 물리치료사의 체계적인 재활 치료를 제공합니다',
      features: [
        '개별 맞춤 운동 프로그램',
        '관절 운동 및 근력 강화',
        '보행 훈련 및 균형 감각',
        '일상생활 동작 훈련',
      ],
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: <Home className="w-12 h-12" />,
      title: '쾌적한 환경',
      description: '깨끗하고 안전한 시설에서 편안하게 지내실 수 있습니다',
      features: [
        '1인실, 2인실, 4인실 선택',
        '냉난방 완비',
        '안전 손잡이 및 미끄럼 방지',
        '정기 소독 및 청결 관리',
      ],
      color: 'from-orange-500 to-orange-600',
    },
  ]

  const programs = [
    {
      icon: <Brain className="w-8 h-8" />,
      title: '인지 활동',
      description: '기억력 및 인지 기능 향상을 위한 다양한 활동',
      activities: ['회상 치료', '퍼즐 맞추기', '숫자 놀이', '글쓰기'],
      color: 'bg-pink-100 text-pink-600',
    },
    {
      icon: <Music className="w-8 h-8" />,
      title: '음악 치료',
      description: '음악을 통한 정서적 안정과 즐거움',
      activities: ['노래 교실', '악기 연주', '음악 감상', '리듬 활동'],
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: <Palette className="w-8 h-8" />,
      title: '미술 치료',
      description: '창작 활동을 통한 자기 표현과 성취감',
      activities: ['그림 그리기', '만들기', '서예', '색칠하기'],
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: <Leaf className="w-8 h-8" />,
      title: '원예 활동',
      description: '자연과 함께하는 힐링 프로그램',
      activities: ['화분 가꾸기', '텃밭 체험', '꽃꽂이', '산책'],
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: '여가 활동',
      description: '즐겁고 활기찬 일상을 위한 다양한 활동',
      activities: ['영화 감상', '보드게임', '생일 파티', '계절 행사'],
      color: 'bg-orange-100 text-orange-600',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: '사회 활동',
      description: '타인과의 교류를 통한 소속감 증진',
      activities: ['단체 활동', '나들이', '가족 행사', '봉사 방문'],
      color: 'bg-yellow-100 text-yellow-600',
    },
  ]

  const dailySchedule = [
    { time: '07:00', activity: '기상 및 세면' },
    { time: '08:00', activity: '아침 식사' },
    { time: '09:00', activity: '건강 체크' },
    { time: '10:00', activity: '오전 프로그램' },
    { time: '12:00', activity: '점심 식사' },
    { time: '13:00', activity: '휴식' },
    { time: '14:00', activity: '오후 프로그램' },
    { time: '16:00', activity: '간식 시간' },
    { time: '18:00', activity: '저녁 식사' },
    { time: '19:00', activity: '여가 활동' },
    { time: '21:00', activity: '취침 준비' },
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-orange to-primary-brown text-white py-20 lg:py-32">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            서비스 안내
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
            어르신의 건강하고 행복한 생활을 위한<br />
            체계적이고 전문적인 서비스를 제공합니다
          </p>
        </div>
      </section>

      {/* Core Services */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              핵심 서비스
            </h2>
            <p className="text-xl text-gray-600">
              전문성과 정성을 담은 4가지 핵심 서비스
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {coreServices.map((service, index) => (
              <div
                key={index}
                className="bg-white border-2 border-gray-100 rounded-2xl p-8 hover:border-primary-orange transition-all duration-300 hover:shadow-xl"
              >
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${service.color} text-white flex items-center justify-center mb-6`}>
                  {service.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-900">
                  {service.title}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {service.description}
                </p>
                <ul className="space-y-3">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              다양한 프로그램
            </h2>
            <p className="text-xl text-gray-600">
              매일 즐겁고 활기찬 생활을 위한 특별한 프로그램
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((program, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-16 h-16 rounded-xl ${program.color} flex items-center justify-center mb-4`}>
                  {program.icon}
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  {program.title}
                </h3>
                <p className="text-gray-600 mb-4 text-sm">
                  {program.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {program.activities.map((activity, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
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
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              하루 일과
            </h2>
            <p className="text-xl text-gray-600">
              규칙적이고 건강한 생활을 위한 체계적인 일정
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {dailySchedule.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-white hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0 w-20 h-20 bg-gradient-to-br from-primary-orange to-primary-brown text-white rounded-xl flex items-center justify-center">
                  <span className="text-lg font-bold">{item.time}</span>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-medium text-gray-900">
                    {item.activity}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
            <p className="text-center text-gray-700">
              ※ 일과는 개인의 상태와 필요에 따라 조정될 수 있습니다
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            더 자세한 서비스가 궁금하신가요?
          </h2>
          <p className="text-xl mb-8 text-white/90">
            전문 상담원이 맞춤 상담을 도와드립니다
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              상담 신청하기
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
            >
              요금 안내 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}