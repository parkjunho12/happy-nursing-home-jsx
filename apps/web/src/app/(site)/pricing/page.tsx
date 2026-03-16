import { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertCircle,
  Calculator,
  CheckCircle,
  ChevronRight,
  CreditCard,
  FileText,
  Phone,
  ShieldCheck,
} from 'lucide-react'
import Image from 'next/image'

export const metadata: Metadata = {
  title: '입소 비용 | 행복한요양원 녹양역점',
  description:
    '행복한요양원 녹양역점의 2026년 입소비용 안내입니다. 장기요양등급별 본인부담금, 감경 대상자 기준, 비급여 항목을 확인하세요.',
}

const paymentTypes = [
  {
    title: '일반 어르신',
    highlight: '본인부담금 20%',
    description:
      '장기요양보험 적용 후 본인부담금 20%와 비급여 비용을 부담합니다.',
    notes: ['비급여 별도', '식비, 간식비 등 추가'],
    icon: CreditCard,
    tone: 'orange',
  },
  {
    title: '의료급여 수급권 어르신',
    highlight: '본인부담금 8% 또는 12%',
    description:
      '의료급여 수급권자는 감경 대상에 따라 본인부담금이 8% 또는 12%로 줄어듭니다.',
    notes: ['비급여 별도', '식비, 간식비 등 추가'],
    icon: ShieldCheck,
    tone: 'blue',
  },
  {
    title: '기초생활수급자',
    highlight: '본인부담금 없음',
    description:
      '시설급여는 전액 지원되며, 본인부담금과 식재료비도 국가 및 지자체에서 지원됩니다.',
    notes: ['상급 침실료 등 일부 비급여 가능'],
    icon: CheckCircle,
    tone: 'green',
  },
]

const pricingTable = [
  {
    type: '일반 (20%)',
    note: '기초수급자 외',
    values: ['₩558,420', '₩518,040', '₩489,240', '₩489,240', '₩489,240'],
  },
  {
    type: '감경 I (12%)',
    note: '차상위계층 등',
    values: ['₩335,052', '₩310,824', '₩293,544', '₩293,544', '₩293,544'],
  },
  {
    type: '감경 II (8%)',
    note: '감경 대상자',
    values: ['₩223,368', '₩207,216', '₩195,696', '₩195,696', '₩195,696'],
  },
]

const includedItems = [
  '24시간 요양보호 서비스',
  '간호 인력 건강 관리',
  '투약 관리',
  '기본 생활 케어',
  '목욕 서비스',
  '세탁 서비스',
  '인지 활동 프로그램',
  '여가 프로그램',
  '물리치료 및 재활 프로그램',
  '응급 대응 체계',
]

const excludedItems = [
  '식비',
  '간식비'
]

const faqItems = [
  {
    question: '요양원 비용은 누가 얼마나 부담하나요?',
    answer:
      '장기요양보험이 적용되면 대부분의 비용은 건강보험공단이 부담하고, 보호자께서는 본인부담금과 일부 비급여 항목만 부담하시면 됩니다.',
  },
  {
    question: '기초생활수급자는 정말 무료인가요?',
    answer:
      '시설급여에 대해서는 본인부담금이 없으며, 식재료비도 국가 및 지자체에서 지원됩니다. 다만 상급 침실료 등 일부 비급여 항목은 별도로 발생할 수 있습니다.',
  },
  {
    question: '비급여 항목은 어떤 것이 있나요?',
    answer:
      '대표적으로 식비, 간식비가 있으며, 사용량이나 상황에 따라 달라질 수 있습니다.',
  },
  {
    question: '정확한 월 비용은 어떻게 알 수 있나요?',
    answer:
      '어르신의 장기요양등급, 감경 여부, 개인 상태, 필요한 물품에 따라 실제 부담액이 달라질 수 있으므로 상담을 통해 정확하게 안내해드립니다.',
  },
]

function toneClasses(tone: 'orange' | 'blue' | 'green') {
  if (tone === 'orange') {
    return {
      icon: 'bg-orange-50 text-primary-orange',
      border: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-700',
    }
  }

  if (tone === 'blue') {
    return {
      icon: 'bg-blue-50 text-blue-600',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-700',
    }
  }

  return {
    icon: 'bg-green-50 text-green-600',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
  }
}

export default function PricingPage() {
  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}

      <section className="relative overflow-hidden">
        <div className="relative h-[120px] sm:h-[180px] lg:h-[320px]">
          <Image
            src="/assets/images/introduce-3.png"
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

              <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-7xl">
              입소비용 안내
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8 lg:text-xl">
              요양원 비용은 대부분 국가에서 지원됩니다.
                <br className="hidden sm:block" />
                보호자분께서는 본인부담금과 일부 비급여만 부담하시면 됩니다.
              </p>

            </div>
          </div>
        </div>
      </section>

      {/* Quick summary */}
      <section className="py-10 bg-amber-50 border-b border-amber-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white border border-amber-200 p-6 lg:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              먼저 이렇게 보시면 쉽습니다
            </h2>
            <p className="text-gray-700 leading-relaxed text-base md:text-lg">
              일반 어르신은 보통 <strong className="text-gray-900">본인부담금 20%</strong>,
              의료급여 수급권 어르신은 <strong className="text-gray-900">8% 또는 12%</strong>,
              기초생활수급자는 <strong className="text-gray-900">본인부담금이 없습니다.</strong>
              <br className="hidden sm:block" />
              실제 비용은 등급과 감경 대상 여부에 따라 달라지며, 아래 표에서 바로 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* Payment types */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              본인부담 기준
            </h2>
            <p className="text-lg text-gray-600">
              보호자분이 실제로 부담하시는 기준입니다
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {paymentTypes.map((item) => {
              const Icon = item.icon
              const tone = toneClasses(item.tone as 'orange' | 'blue' | 'green')

              return (
                <div
                  key={item.title}
                  className={`rounded-2xl border-2 ${tone.border} bg-white p-8 shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${tone.icon} mb-5`}>
                    <Icon className="w-7 h-7" />
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {item.title}
                  </h3>

                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${tone.badge} mb-4`}>
                    {item.highlight}
                  </div>

                  <p className="text-gray-700 leading-relaxed mb-5">
                    {item.description}
                  </p>

                  <ul className="space-y-2">
                    {item.notes.map((note) => (
                      <li key={note} className="flex items-start gap-2 text-gray-600">
                        <CheckCircle className="w-4 h-4 mt-0.5 text-primary-orange shrink-0" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing table */}
      <section className="py-16 lg:py-20 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              등급별 본인부담금
            </h2>
            <p className="text-lg text-gray-600">
              인력배치 기준 2.1 대 1 · 30일 기준
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-[980px] w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th
                    rowSpan={2}
                    className="px-6 py-5 text-center text-base font-bold text-gray-900 border-b border-r border-gray-200"
                  >
                    구분
                  </th>
                  <th
                    colSpan={5}
                    className="px-6 py-5 text-center text-base font-bold text-gray-900 border-b border-r border-gray-200"
                  >
                    등급
                  </th>
                  <th
                    rowSpan={2}
                    className="px-6 py-5 text-center text-base font-bold text-gray-900 border-b border-gray-200"
                  >
                    비고
                  </th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-center font-semibold text-gray-900 border-b border-r border-gray-200">
                    1등급
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-900 border-b border-r border-gray-200">
                    2등급
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-900 border-b border-r border-gray-200">
                    3등급
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-900 border-b border-r border-gray-200">
                    4등급
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-900 border-b border-r border-gray-200">
                    5등급
                  </th>
                </tr>
              </thead>

              <tbody>
                {pricingTable.map((row, index) => (
                  <tr key={row.type} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-5 text-center border-r border-b border-gray-200">
                      <div className="font-semibold text-gray-900">{row.type}</div>
                      <div className="text-sm text-gray-500 mt-1">(30일 기준)</div>
                    </td>

                    {row.values.map((value, idx) => (
                      <td
                        key={`${row.type}-${idx}`}
                        className="px-6 py-5 text-center text-xl font-bold text-gray-900 border-r border-b border-gray-200"
                      >
                        {value}
                      </td>
                    ))}

                    <td className="px-6 py-5 text-center text-gray-700 border-b border-gray-200">
                      {row.note}
                    </td>
                  </tr>
                ))}

                <tr className="bg-white">
                  <td className="px-6 py-6 text-center border-r border-gray-200">
                    <div className="font-semibold text-gray-900">기초생활수급자</div>
                    <div className="text-sm text-gray-500 mt-1">(시설급여 전액급여)</div>
                  </td>
                  <td
                    colSpan={5}
                    className="px-6 py-6 text-center text-xl font-bold text-gray-900 border-r border-gray-200"
                  >
                    본인부담금 없음
                  </td>
                  <td className="px-6 py-6 text-center text-gray-700">
                    건강보험공단 전액 지원
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
            <ul className="space-y-2 text-gray-700 leading-relaxed">
              <li>※ 위 금액은 <strong>30일 기준</strong>이며, 공휴일 수에 따라 월별 총액이 변동될 수 있습니다.</li>
              <li>※ 31일 기준 금액은 월별로 일부 변동됩니다.</li>
              <li>※ <strong>비급여 항목</strong>(기저귀, 간식, 개인용품 등)은 별도입니다.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Included / excluded */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="rounded-3xl border border-green-200 bg-green-50/50 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-5">
                기본 제공 서비스
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {includedItems.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-white p-4 border border-green-100"
                  >
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-gray-700 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-orange-200 bg-orange-50/50 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-5">
                비급여
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {excludedItems.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-white p-4 border border-orange-100"
                  >
                    <AlertCircle className="w-5 h-5 text-primary-orange mt-0.5 shrink-0" />
                    <span className="text-gray-700 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>

              
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
              자주 묻는 질문
            </h2>
            <p className="text-lg text-gray-600">
              비용 관련하여 많이 물어보시는 내용을 정리했습니다
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl bg-white p-6 shadow-sm border border-gray-100"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="text-lg font-semibold text-gray-900">
                    {item.question}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90 shrink-0" />
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
          <p className="text-xl mb-8 text-white/90 leading-relaxed">
            어르신의 등급과 상황에 맞는 실제 부담 비용을
            <br className="hidden sm:block" />
            상담을 통해 자세히 안내해드립니다.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-xl font-semibold hover:bg-gray-100 transition-colors"
            >
              <FileText className="w-5 h-5" />
              맞춤 상담 신청
            </Link>

            <a
              href="tel:031-856-8090"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-xl font-semibold hover:bg-white/20 transition-colors"
            >
              <Phone className="w-5 h-5" />
              031-856-8090
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}