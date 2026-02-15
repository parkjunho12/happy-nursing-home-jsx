import { Metadata } from 'next'
import { Phone, Mail, MapPin, Clock, MessageCircle } from 'lucide-react'
import ContactForm from '@/components/forms/ContactForm'
import { SITE_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: '상담 신청 | 행복한요양원 녹양역점',
  description: '행복한요양원 상담 신청 및 문의. 전화, 카카오톡, 온라인 문의로 편리하게 상담받으세요.',
}

export default function ContactPage() {
  const contactMethods = [
    {
      icon: <Phone className="w-8 h-8" />,
      title: '전화 상담',
      description: '빠른 상담을 원하시면 전화주세요',
      content: SITE_INFO.phone,
      action: '전화하기',
      href: `tel:${SITE_INFO.phone}`,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: '카카오톡 상담',
      description: '편한 시간에 1:1 채팅 상담',
      content: '카카오톡 채널',
      action: '채팅하기',
      href: `http://pf.kakao.com/${SITE_INFO.kakaoChannelId}`,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      icon: <Mail className="w-8 h-8" />,
      title: '이메일 문의',
      description: '상세한 문의는 이메일로',
      content: SITE_INFO.email,
      action: '메일 보내기',
      href: `mailto:${SITE_INFO.email}`,
      color: 'bg-green-100 text-green-600',
    },
  ]

  const visitHours = [
    { day: '평일', time: '09:00 - 18:00' },
    { day: '주말', time: '10:00 - 17:00' },
    { day: '공휴일', time: '사전 예약 필수' },
  ]

  const faqQuestions = [
    {
      question: '입소 상담은 어떻게 받나요?',
      answer: '전화, 카카오톡, 온라인 문의 중 편한 방법으로 먼저 상담 신청을 해주시면 전문 상담원이 연락드립니다.',
    },
    {
      question: '시설 견학이 가능한가요?',
      answer: '네, 사전 예약 후 방문하시면 시설을 둘러보시고 자세한 설명을 들으실 수 있습니다.',
    },
    {
      question: '상담 비용이 있나요?',
      answer: '상담은 무료입니다. 부담 없이 문의해 주세요.',
    },
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            상담 신청
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
            전문 상담원이 친절하게 안내해 드립니다<br />
            편한 방법으로 문의해 주세요
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900">
              상담 방법 선택
            </h2>
            <p className="text-xl text-gray-600">
              편한 방법으로 상담받으세요
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {contactMethods.map((method, index) => (
              <a
                key={index}
                href={method.href}
                target={method.href.startsWith('http') ? '_blank' : undefined}
                rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="block bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-primary-orange hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-16 h-16 rounded-xl ${method.color} flex items-center justify-center mb-6`}>
                  {method.icon}
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  {method.title}
                </h3>
                <p className="text-gray-600 mb-4 text-sm">
                  {method.description}
                </p>
                <div className="text-lg font-semibold text-gray-900 mb-4">
                  {method.content}
                </div>
                <div className="inline-flex items-center gap-2 text-primary-orange font-semibold">
                  {method.action}
                  <span>→</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900">
              온라인 상담 신청
            </h2>
            <p className="text-xl text-gray-600">
              양식을 작성해 주시면 빠르게 연락드립니다
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 lg:p-12 shadow-lg">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Visit Info */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Location Info */}
            <div>
              <h2 className="text-3xl font-bold mb-8 text-gray-900">
                방문 안내
              </h2>
              
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <MapPin className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">주소</div>
                    <div className="text-gray-700">{SITE_INFO.address.full}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <Clock className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-gray-900 mb-3">방문 가능 시간</div>
                    <div className="space-y-2">
                      {visitHours.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-gray-700">{item.day}</span>
                          <span className="font-medium text-gray-900">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <p className="text-sm text-gray-700">
                  <strong className="text-blue-900">안내:</strong> 시설 견학을 원하시면 
                  사전에 연락 주셔야 더 자세한 안내를 받으실 수 있습니다.
                </p>
              </div>
            </div>

            {/* Map */}
            <div>
              <h2 className="text-3xl font-bold mb-8 text-gray-900">
                오시는 길
              </h2>
              <div className="h-96 bg-gray-200 rounded-2xl overflow-hidden shadow-lg">
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 mx-auto mb-4 text-primary-orange" />
                    <p className="text-lg font-medium">지도가 표시됩니다</p>
                    <p className="text-sm text-gray-400 mt-2">Google Maps API 연동</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900">
              자주 묻는 질문
            </h2>
          </div>

          <div className="space-y-4">
            {faqQuestions.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Q. {item.question}
                </h3>
                <p className="text-gray-700">
                  A. {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}