import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Check, X, AlertCircle, Phone, Calculator, FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: '요금안내 | 행복한요양원',
  description: '투명한 요금 체계와 정부 지원금 안내. 장기요양등급별 맞춤 상담을 제공합니다.',
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg-cream pt-20">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20">
        <div className="max-w-[1400px] mx-auto px-6 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6">
            투명한 요금 안내
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-95 max-w-3xl mx-auto">
            정부 지원금과 개인 부담금을
            <br />
            명확하게 안내해드립니다
          </p>
        </div>
      </section>

      {/* Important Notice */}
      <section className="py-12">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="bg-gradient-to-r from-primary-orange/10 to-accent-peach/10 border-2 border-primary-orange/30 rounded-3xl p-8 flex gap-4">
            <AlertCircle className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-bold text-primary-brown mb-2">
                개인별 맞춤 상담 필요
              </h3>
              <p className="text-text-gray leading-relaxed">
                장기요양등급, 선택 서비스, 정부 지원금 등에 따라 실제 부담금이 달라집니다. 
                아래 요금표는 참고용이며, <span className="font-semibold text-primary-orange">정확한 비용은 상담을 통해 안내</span>해드립니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 장기요양등급별 안내 */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              장기요양등급별 안내
            </h2>
            <p className="text-lg text-text-gray">
              등급에 따라 정부 지원 비율이 달라집니다
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* 1-2등급 */}
            <div className="bg-white rounded-3xl border-2 border-border-light p-8 hover:border-primary-orange hover:shadow-large transition-all">
              <div className="inline-block px-4 py-2 bg-primary-orange/10 text-primary-orange rounded-full text-sm font-semibold mb-4">
                최우선 지원
              </div>
              <h3 className="text-2xl font-bold text-primary-brown mb-2">
                1-2등급
              </h3>
              <p className="text-text-gray mb-6">
                일상생활에 전적인 도움이 필요한 경우
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-gray">정부 지원</span>
                  <span className="font-bold text-primary-green">최대 80%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-gray">본인 부담</span>
                  <span className="font-bold text-primary-brown">약 20%</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">24시간 전문 케어</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">집중 간호 서비스</span>
                </li>
              </ul>
            </div>

            {/* 3등급 */}
            <div className="bg-white rounded-3xl border-2 border-primary-orange p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-4 py-1 bg-primary-orange text-white text-xs font-bold rounded-bl-2xl">
                가장 많은 등급
              </div>
              <div className="inline-block px-4 py-2 bg-primary-green/10 text-primary-green rounded-full text-sm font-semibold mb-4">
                일반 지원
              </div>
              <h3 className="text-2xl font-bold text-primary-brown mb-2">
                3등급
              </h3>
              <p className="text-text-gray mb-6">
                일상생활에 부분적인 도움이 필요한 경우
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-gray">정부 지원</span>
                  <span className="font-bold text-primary-green">최대 60%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-gray">본인 부담</span>
                  <span className="font-bold text-primary-brown">약 40%</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">정기 건강 관리</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">일상 생활 지원</span>
                </li>
              </ul>
            </div>

            {/* 4-5등급 */}
            <div className="bg-white rounded-3xl border-2 border-border-light p-8 hover:border-primary-orange hover:shadow-large transition-all">
              <div className="inline-block px-4 py-2 bg-primary-brown/10 text-primary-brown rounded-full text-sm font-semibold mb-4">
                기본 지원
              </div>
              <h3 className="text-2xl font-bold text-primary-brown mb-2">
                4-5등급
              </h3>
              <p className="text-text-gray mb-6">
                경미한 도움이 필요한 경우
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-gray">정부 지원</span>
                  <span className="font-bold text-primary-green">최대 50%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-gray">본인 부담</span>
                  <span className="font-bold text-primary-brown">약 50%</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">기본 케어 서비스</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span className="text-text-gray">사회 활동 지원</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-text-gray">
              * 기초생활수급자 및 차상위계층은 추가 감면 혜택이 있습니다
            </p>
          </div>
        </div>
      </section>

      {/* 기본 비용 안내 */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              기본 비용 구성
            </h2>
            <p className="text-lg text-text-gray">
              투명한 비용 체계를 안내합니다
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-bg-cream rounded-3xl border-2 border-border-light overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary-brown text-white">
                    <th className="px-6 py-4 text-left font-semibold">항목</th>
                    <th className="px-6 py-4 text-right font-semibold">월 금액</th>
                    <th className="px-6 py-4 text-center font-semibold">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  <tr className="bg-white">
                    <td className="px-6 py-4 font-semibold">기본 요양 서비스</td>
                    <td className="px-6 py-4 text-right">1,500,000원</td>
                    <td className="px-6 py-4 text-center text-sm text-text-gray">정부 지원 대상</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-6 py-4">식비</td>
                    <td className="px-6 py-4 text-right">400,000원</td>
                    <td className="px-6 py-4 text-center text-sm text-text-gray">본인 부담</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-6 py-4">상급침실료 (선택)</td>
                    <td className="px-6 py-4 text-right">300,000원</td>
                    <td className="px-6 py-4 text-center text-sm text-text-gray">1-2인실 선택 시</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-6 py-4">이미용비 (선택)</td>
                    <td className="px-6 py-4 text-right">30,000원</td>
                    <td className="px-6 py-4 text-center text-sm text-text-gray">월 2회</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 bg-gradient-to-r from-primary-orange/10 to-accent-peach/10 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <Calculator className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-primary-brown mb-2">예상 본인 부담금 (3등급 기준)</h4>
                  <ul className="space-y-2 text-sm text-text-gray">
                    <li>• 기본 요양 서비스: 1,500,000원 × 40% = <span className="font-semibold text-primary-brown">600,000원</span></li>
                    <li>• 식비: <span className="font-semibold text-primary-brown">400,000원</span></li>
                    <li>• <span className="font-bold text-primary-orange">총 예상 금액: 약 1,000,000원/월</span></li>
                  </ul>
                  <p className="text-xs text-text-gray mt-3">
                    * 실제 금액은 등급, 선택 서비스에 따라 달라집니다
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 감면 혜택 */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              감면 혜택 안내
            </h2>
            <p className="text-lg text-text-gray">
              경제적 부담을 줄일 수 있는 다양한 혜택
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl border-2 border-border-light p-8">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-primary-brown mb-3">
                기초생활수급자
              </h3>
              <ul className="space-y-2 text-sm text-text-gray">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>본인 부담금 전액 면제</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>식비, 간식비 지원</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>기타 필요 경비 지원 가능</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-3xl border-2 border-border-light p-8">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-primary-brown mb-3">
                차상위계층
              </h3>
              <ul className="space-y-2 text-sm text-text-gray">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>본인 부담금 60% 감면</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>의료비 추가 지원</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>식비 일부 감면</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 입소 절차 */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              입소 절차 및 준비 서류
            </h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-6 mb-12">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-orange rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  1
                </div>
                <h3 className="font-bold text-primary-brown mb-2">상담 신청</h3>
                <p className="text-sm text-text-gray">전화 또는 온라인</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-green rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  2
                </div>
                <h3 className="font-bold text-primary-brown mb-2">시설 방문</h3>
                <p className="text-sm text-text-gray">견학 및 상담</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-brown rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  3
                </div>
                <h3 className="font-bold text-primary-brown mb-2">서류 제출</h3>
                <p className="text-sm text-text-gray">필요 서류 준비</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-accent-lightOrange rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  4
                </div>
                <h3 className="font-bold text-primary-brown mb-2">입소</h3>
                <p className="text-sm text-text-gray">계약 및 입소</p>
              </div>
            </div>

            <div className="bg-bg-cream rounded-3xl border-2 border-border-light p-8">
              <div className="flex gap-4 mb-6">
                <FileText className="w-6 h-6 text-primary-orange flex-shrink-0" />
                <h3 className="text-xl font-bold text-primary-brown">필요 서류</h3>
              </div>
              <ul className="space-y-3 text-sm text-text-gray ml-10">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>장기요양인정서 사본</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>주민등록등본</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>건강진단서 (3개월 이내)</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>보호자 신분증 사본</span>
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-primary-green flex-shrink-0 mt-0.5" />
                  <span>기초생활수급자증명서 (해당 시)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              자주 묻는 질문
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            <details className="bg-white rounded-2xl border-2 border-border-light p-6 hover:border-primary-orange transition-colors group">
              <summary className="font-bold text-primary-brown cursor-pointer list-none flex justify-between items-center">
                <span>장기요양등급이 없어도 입소할 수 있나요?</span>
                <span className="text-primary-orange">+</span>
              </summary>
              <p className="mt-4 text-text-gray text-sm leading-relaxed">
                아니요, 장기요양등급 인정을 받으셔야 입소가 가능합니다. 등급 신청 절차와 방법에 대해서도 안내해드리고 있으니 상담 시 문의해주세요.
              </p>
            </details>

            <details className="bg-white rounded-2xl border-2 border-border-light p-6 hover:border-primary-orange transition-colors group">
              <summary className="font-bold text-primary-brown cursor-pointer list-none flex justify-between items-center">
                <span>비용은 언제 납부하나요?</span>
                <span className="text-primary-orange">+</span>
              </summary>
              <p className="mt-4 text-text-gray text-sm leading-relaxed">
                매월 말일에 다음 달 비용을 청구하며, 계좌이체 또는 카드 자동결제가 가능합니다.
              </p>
            </details>

            <details className="bg-white rounded-2xl border-2 border-border-light p-6 hover:border-primary-orange transition-colors group">
              <summary className="font-bold text-primary-brown cursor-pointer list-none flex justify-between items-center">
                <span>중도 퇴소 시 환불이 가능한가요?</span>
                <span className="text-primary-orange">+</span>
              </summary>
              <p className="mt-4 text-text-gray text-sm leading-relaxed">
                네, 일할 계산하여 환불해드립니다. 자세한 환불 규정은 계약서에 명시되어 있습니다.
              </p>
            </details>

            <details className="bg-white rounded-2xl border-2 border-border-light p-6 hover:border-primary-orange transition-colors group">
              <summary className="font-bold text-primary-brown cursor-pointer list-none flex justify-between items-center">
                <span>의료비는 별도인가요?</span>
                <span className="text-primary-orange">+</span>
              </summary>
              <p className="mt-4 text-text-gray text-sm leading-relaxed">
                네, 병원 진료 및 약제비는 별도로 발생하며, 건강보험이 적용됩니다. 정기 건강 체크는 무료로 제공됩니다.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-primary-green to-primary-green/80">
        <div className="max-w-[1400px] mx-auto px-6 text-center text-white">
          <Phone className="w-16 h-16 mx-auto mb-6" />
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6">
            정확한 비용 상담이 필요하신가요?
          </h2>
          <p className="text-xl mb-8 opacity-95">
            장기요양등급과 상황에 맞는 맞춤 상담을 제공합니다
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="px-8 py-4 bg-white text-primary-green rounded-full font-bold text-lg hover:shadow-xl transition-all hover:-translate-y-1"
            >
              무료 상담 신청
            </Link>
            <a
              href="tel:02-1234-5678"
              className="px-8 py-4 bg-white/20 backdrop-blur-sm border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/30 transition-all"
            >
              02-1234-5678
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}