import { Metadata } from 'next'
import Link from 'next/link'
import { Check, ChevronRight, AlertCircle, Calculator, FileText, CreditCard } from 'lucide-react'

export const metadata: Metadata = {
  title: '요금 안내 | 행복한요양원 녹양역점',
  description: '투명하고 합리적인 요금 체계. 장기요양보험 적용, 다양한 객실 옵션을 안내합니다.',
}

export default function PricingPage() {
  const pricingPlans = [
    {
      name: '4인실',
      grade: '1~5등급',
      price: '월 120만원',
      priceNote: '(장기요양보험 적용 후)',
      features: [
        '쾌적한 4인 공용 침실',
        '개인 침대 및 수납장',
        '냉난방 완비',
        '24시간 간호',
        '3식 제공',
        '프로그램 참여',
      ],
      popular: false,
      color: 'border-gray-300',
    },
    {
      name: '2인실',
      grade: '1~5등급',
      price: '월 150만원',
      priceNote: '(장기요양보험 적용 후)',
      features: [
        '프라이빗한 2인 침실',
        '개인 침대 및 수납장',
        '개인 화장실',
        '냉난방 완비',
        '24시간 간호',
        '3식 제공',
        '프로그램 참여',
        '넓은 공간',
      ],
      popular: true,
      color: 'border-primary-orange',
    },
    {
      name: '1인실',
      grade: '1~5등급',
      price: '월 200만원',
      priceNote: '(장기요양보험 적용 후)',
      features: [
        '프라이빗 1인 침실',
        '개인 침대 및 가구',
        '개인 화장실',
        '냉난방 완비',
        '24시간 간호',
        '3식 제공',
        '프로그램 참여',
        '넓은 공간',
        '개인 TV',
      ],
      popular: false,
      color: 'border-gray-300',
    },
  ]

  const includedServices = [
    '24시간 전문 간호',
    '영양사 식단 관리',
    '물리 치료',
    '인지 프로그램',
    '여가 활동',
    '세탁 서비스',
    '목욕 서비스',
    '정기 건강 체크',
    '응급 대응 시스템',
    '가족 상담',
  ]

  const insuranceGrades = [
    {
      grade: '1등급',
      condition: '완전 와상 상태',
      benefit: '월 최대 1,538,200원',
      selfPay: '약 20% 본인부담',
    },
    {
      grade: '2등급',
      condition: '중증 상태',
      benefit: '월 최대 1,356,000원',
      selfPay: '약 20% 본인부담',
    },
    {
      grade: '3등급',
      condition: '중등도 장애',
      benefit: '월 최대 1,260,900원',
      selfPay: '약 20% 본인부담',
    },
    {
      grade: '4등급',
      condition: '경증 장애',
      benefit: '월 최대 1,161,200원',
      selfPay: '약 20% 본인부담',
    },
    {
      grade: '5등급',
      condition: '치매 전담',
      benefit: '월 최대 1,068,800원',
      selfPay: '약 20% 본인부담',
    },
  ]

  const faqItems = [
    {
      question: '장기요양보험이 무엇인가요?',
      answer: '고령이나 노인성 질병 등으로 일상생활이 어려운 어르신에게 신체 활동 및 가사 지원 등의 서비스를 제공하여 노후 생활의 안정과 가족의 부담을 덜어드리기 위한 사회보험 제도입니다.',
    },
    {
      question: '등급 판정은 어떻게 받나요?',
      answer: '국민건강보험공단에 신청하시면 방문 조사를 통해 등급을 판정받으실 수 있습니다. 저희 요양원에서 신청 절차를 도와드립니다.',
    },
    {
      question: '본인부담금은 어떻게 되나요?',
      answer: '장기요양보험 급여 비용의 약 20%가 본인부담금입니다. 나머지 80%는 장기요양보험에서 지원됩니다. (기초생활수급자는 무료)',
    },
    {
      question: '추가 비용이 있나요?',
      answer: '기본 서비스 외 개인 용품(기저귀, 물티슈 등), 병원 진료비, 이미용 등은 별도 비용이 발생할 수 있습니다.',
    },
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20 lg:py-32">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            요금 안내
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
            투명하고 합리적인 요금 체계<br />
            장기요양보험 적용으로 부담을 덜어드립니다
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              객실별 요금
            </h2>
            <p className="text-xl text-gray-600">
              어르신의 상태와 선호에 맞는 객실을 선택하세요
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white border-2 ${plan.color} rounded-2xl p-8 ${
                  plan.popular ? 'shadow-2xl scale-105' : 'shadow-sm'
                } transition-all duration-300 hover:shadow-xl`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="px-6 py-2 bg-gradient-to-r from-primary-orange to-primary-brown text-white text-sm font-bold rounded-full shadow-lg">
                      인기
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <div className="text-sm text-gray-500 mb-4">{plan.grade}</div>
                  <div className="text-4xl font-bold text-primary-orange mb-2">
                    {plan.price}
                  </div>
                  <div className="text-sm text-gray-600">{plan.priceNote}</div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-primary-green flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/contact"
                  className={`block w-full text-center py-4 rounded-lg font-semibold transition-colors ${
                    plan.popular
                      ? 'bg-primary-orange text-white hover:bg-primary-orange/90'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  상담 신청하기
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-gray-700 leading-relaxed">
                  <strong className="text-blue-900">안내:</strong> 위 요금은 장기요양보험 적용 후 본인부담금 기준이며, 
                  등급과 소득 수준에 따라 달라질 수 있습니다. 정확한 요금은 상담을 통해 안내해 드립니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Included Services */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              포함 서비스
            </h2>
            <p className="text-xl text-gray-600">
              추가 비용 없이 제공되는 기본 서비스
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {includedServices.map((service, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary-green flex-shrink-0" />
                  <span className="text-gray-700 font-medium">{service}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Insurance Grades */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              장기요양보험 등급별 혜택
            </h2>
            <p className="text-xl text-gray-600">
              등급에 따른 급여 한도액 안내
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">등급</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">상태</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">월 급여 한도</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">본인부담</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {insuranceGrades.map((grade, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white font-bold text-lg rounded-xl">
                        {grade.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{grade.condition}</td>
                    <td className="px-6 py-4 text-gray-900 font-semibold">{grade.benefit}</td>
                    <td className="px-6 py-4 text-gray-700">{grade.selfPay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
            <p className="text-center text-gray-700">
              ※ 2024년 기준이며, 매년 변동될 수 있습니다. 기초생활수급자는 본인부담금이 면제됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              자주 묻는 질문
            </h2>
            <p className="text-xl text-gray-600">
              요금 관련 궁금하신 점을 확인하세요
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <details
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="text-lg font-semibold text-gray-900 pr-4">
                    {item.question}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                </summary>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-gray-700 leading-relaxed">{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Calculator className="w-16 h-16 mx-auto mb-6 text-white/90" />
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            정확한 비용이 궁금하신가요?
          </h2>
          <p className="text-xl mb-8 text-white/90">
            개인별 상황에 맞는 정확한 요금을 안내해 드립니다
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              <FileText className="w-5 h-5" />
              맞춤 상담 신청
            </Link>
            <a
              href="tel:02-1234-5678"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
            >
              전화 문의하기
              <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}