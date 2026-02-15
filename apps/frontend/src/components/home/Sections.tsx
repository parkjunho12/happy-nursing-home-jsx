import React from 'react'
import Link from 'next/link'
import { 
  QUICK_CONTACTS, 
  SERVICES, 
  DIFFERENTIATORS 
} from '@/lib/constants'
import { Card } from '@/components/ui/Modal'
import { Phone, MessageCircle, FileText } from 'lucide-react'

// QuickContact Component
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

// ServicesSection Component
export function ServicesSection() {
  return (
    <section id="services" className="py-20 md:py-28">
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

        {/* Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {SERVICES.map((service, index) => (
            <div
              key={service.id}
              className="group bg-white border-2 border-border-light rounded-3xl p-8 hover:border-primary-orange hover:-translate-y-2 hover:shadow-large transition-all duration-300 relative overflow-hidden"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Top Border Animation */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-orange to-primary-green transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

              {/* Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-accent-peach to-[#FFE8D6] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                {service.icon}
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-primary-brown mb-3 text-center">
                {service.title}
              </h3>
              <p className="text-text-gray text-sm leading-relaxed text-center">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// DifferentiatorsSection Component
export function DifferentiatorsSection() {
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
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown">
            왜 행복한요양원을 선택해야 할까요?
          </h2>
        </div>

        {/* Differentiators Grid */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {DIFFERENTIATORS.map((item, index) => (
            <div
              key={item.id}
              className="group bg-white rounded-3xl p-8 md:p-10 flex gap-6 hover:translate-x-2 transition-all duration-300 shadow-soft hover:shadow-large"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className={`w-16 h-16 bg-gradient-to-br ${getColorClass(item.color)} rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                {item.icon}
              </div>

              {/* Content */}
              <div>
                <h3 className="text-xl font-bold text-primary-brown mb-2">
                  {item.title}
                </h3>
                <p className="text-text-gray leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

