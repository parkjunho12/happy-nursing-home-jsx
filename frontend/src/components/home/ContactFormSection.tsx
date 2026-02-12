import React from 'react'
import ContactForm from '@/components/forms/ContactForm'

export default function ContactFormSection() {
  return (
    <section id="contact" className="bg-gradient-to-br from-primary-brown to-[#6B4A2E] py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            CONTACT
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            무료 상담으로 시작하세요
          </h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            궁금하신 점이나 방문 예약을 원하시면 아래 양식을 작성해주세요
            <br />
            빠른 시일 내에 연락드리겠습니다
          </p>
        </div>

        {/* Form Container */}
        <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          <ContactForm />
        </div>
      </div>
    </section>
  )
}