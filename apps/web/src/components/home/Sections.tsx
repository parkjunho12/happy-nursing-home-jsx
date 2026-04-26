import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  QUICK_CONTACTS, 
  SERVICES, 
  DIFFERENTIATORS 
} from '@/lib/constants'
import { Phone, MessageCircle, FileText, ArrowRight } from 'lucide-react'

// QuickContact Component (기존 유지)
export function QuickContact() {
  const getIcon = (iconStr: string) => {
    switch (iconStr) {
      case '📞': return <Phone className="w-6 h-6" />
      case '💬': return <MessageCircle className="w-6 h-6" />
      case '📝': return <FileText className="w-6 h-6" />
      default: return iconStr
    }
  }

  return (
    <section className="bg-white border-y border-border-light py-8">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-6">
          {QUICK_CONTACTS.map((contact) => (
            <Link
              key={contact.id}
              href={contact.href}
              target={contact.type === 'kakao' ? '_blank' : undefined}
              rel={contact.type === 'kakao' ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-4 px-6 md:px-8 py-4 bg-bg-cream rounded-2xl hover:border-primary-orange border-2 border-transparent transition-all hover:-translate-y-1 hover:shadow-md group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-primary-orange to-accent-lightOrange rounded-xl flex items-center justify-center text-white shadow-md group-hover:shadow-lg transition-shadow">
                {getIcon(contact.icon)}
              </div>
              <div>
                <h3 className="text-sm font-medium text-text-gray">
                  {contact.title}
                </h3>
                <p className="text-lg font-bold text-primary-brown">
                  {contact.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ServicesSection Component - 사진 카드 형태로 완전 개선
export function ServicesSection() {
  const services = [
    {
      id: 1,
      title: '일상생활 케어',
      description: '식사, 이동, 위생, 생활 리듬까지 어르신의 하루를 세심하게 돕습니다',
      image: '/assets/images/17_massage.png',
      alt: '요양보호사가 어르신을 돌보는 모습',
      icon: '🏠',
    },
    {
      id: 2,
      title: '재활 감성 돌봄',
      description: '워크메이트와 물리치료 공간을 기반으로 신체 기능 유지를 돕습니다',
      image: '/assets/images/37_care_physics.jpg',
      alt: '행복한요양원 재활 케어 모습',
      icon: '♿',
    },
    {
      id: 3,
      title: '간호 및 건강관리',
      description: '어르신의 건강 상태를 꾸준히 살피고 필요한 관리를 이어갑니다',
      image: '/assets/images/29_care_nursing.png',
      alt: '요양원 간호 케어 모습',
      icon: '⚕️',
    },
    {
      id: 4,
      title: '인지·정서 프로그램',
      description: '어르신의 웃음과 교류를 위한 다양한 프로그램을 운영합니다',
      image: '/assets/images/08_programs.jpg',
      alt: '요양원 프로그램 활동 모습',
      icon: '🎨',
    },
    {
      id: 5,
      title: '균형 잡힌 식사',
      description: '어르신의 건강 상태와 식사 습관을 고려한 따뜻한 식사를 제공합니다',
      image: '/assets/images/diet2.png',
      alt: '요양원 식사와 식단',
      icon: '🍚',
    },
    {
      id: 6,
      title: '청결한 위생관리',
      description: '생활실, 목욕, 세탁 등 일상 위생을 깨끗하고 안전하게 관리합니다',
      image: '/assets/images/bathroom.png',
      alt: '요양원 위생 관리 공간',
      icon: '🛁',
    },
  ]

  return (
    <section id="services" className="py-20 md:py-28 bg-white">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            OUR SERVICES
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
            행복한 일상을 위한 맞춤 케어
          </h2>
          <p className="text-lg text-text-gray max-w-2xl mx-auto leading-relaxed">
            입소자 한 분 한 분의 건강 상태와 필요에 맞춘
            <br className="hidden md:block" />
            전문적이고 세심한 돌봄 서비스를 제공합니다
          </p>
        </div>

        {/* Services Grid - 사진 카드 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={service.id}
              className="group bg-white border-2 border-border-light rounded-3xl overflow-hidden hover:border-primary-orange hover:-translate-y-2 hover:shadow-large transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.alt}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                
                {/* Icon Badge */}
                <div className="absolute top-4 left-4 w-14 h-14 bg-white/90 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                  {service.icon}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-primary-brown mb-3">
                  {service.title}
                </h3>
                <p className="text-text-gray text-sm leading-relaxed mb-4">
                  {service.description}
                </p>
          
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// DifferentiatorsSection Component - 차별점 강화
export function DifferentiatorsSection() {
  const differentiators = [
    {
      id: 1,
      icon: '🚶‍♂️',
      title: '워크메이트 하네스 레일 보행 재활',
      description: '국내 요양원 중 드물게 갖춘 워크메이트 보행 재활 시스템으로 안전한 보행 훈련과 하지 근력 강화를 돕습니다. 어르신의 신체 기능 유지에 실질적인 도움을 드립니다.',
      color: 'orange',
    },
    {
      id: 2,
      icon: '🏢',
      title: '지하 1층~4층 단독 건물 운영',
      description: '쾌적한 단독 건물에서 체계적으로 운영되는 요양원입니다. 녹양역 1번 출구 도보 10분 거리로 접근성이 뛰어나며, 보호자님의 방문이 편리합니다.',
      color: 'brown',
    },
    {
      id: 3,
      icon: '🛏️',
      title: '1·2·4인실 맞춤 생활 공간',
      description: '어르신의 생활 패턴과 선호에 맞춰 선택할 수 있는 생활실을 갖추었습니다. 밝고 깨끗한 환경에서 편안하게 지내실 수 있도록 정성껏 관리합니다.',
      color: 'green',
    },
    {
      id: 4,
      icon: '🤝',
      title: 'A등급 자매시설 운영 노하우',
      description: 'A등급 요양원 운영 경험을 바탕으로 체계적이고 전문적인 케어를 제공합니다. 규정이 아닌 어르신의 삶을 기준으로 운영하는 것이 우리의 철학입니다.',
      color: 'orange',
    },
  ]

  const getColorClass = (color?: string) => {
    switch (color) {
      case 'green':
        return 'from-primary-green to-[#96C97E]'
      case 'orange':
        return 'from-primary-orange to-accent-lightOrange'
      case 'brown':
        return 'from-primary-brown to-[#6B4A2E]'
      default:
        return 'from-primary-orange to-accent-lightOrange'
    }
  }

  return (
    <section className="bg-bg-cream py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            WHY US
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
            왜 행복한요양원을 선택해야 할까요?
          </h2>
          <p className="text-lg text-text-gray max-w-2xl mx-auto leading-relaxed">
            단순히 규정을 따르는 것이 아닌,
            <br className="hidden md:block" />
            어르신의 행복한 삶을 위해 노력하는 요양원입니다
          </p>
        </div>

        {/* Differentiators Grid */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {differentiators.map((item, index) => (
            <div
              key={item.id}
              className="group bg-white rounded-3xl p-8 md:p-10 flex gap-6 hover:translate-x-2 transition-all duration-300 shadow-soft hover:shadow-large border-2 border-transparent hover:border-primary-orange"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className={`w-20 h-20 bg-gradient-to-br ${getColorClass(item.color)} rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                {item.icon}
              </div>

              {/* Content */}
              <div>
                <h3 className="text-xl font-bold text-primary-brown mb-3">
                  {item.title}
                </h3>
                <p className="text-text-gray leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <Link
            href="#contact"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-orange to-accent-lightOrange text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            <Phone className="h-5 w-5" />
            상담 신청하기
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  )
}