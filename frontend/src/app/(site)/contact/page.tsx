import React from 'react'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ContactForm from '@/components/forms/ContactForm'
import { Phone, Mail, MapPin, Clock, MessageCircle, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: '상담 신청 | 행복한요양원',
  description: '전화, 카카오톡, 온라인 상담 신청. 24시간 이내 빠른 답변을 약속드립니다.',
}

// ✅ 설정이 자주 바뀌면 캐시 끄는게 안전
export const dynamic = 'force-dynamic'
// 또는 export const revalidate = 0

type SettingsMap = Record<string, string>

function toSettingsMap(settings: { key: string; value: string }[]): SettingsMap {
  const map: SettingsMap = {}
  for (const s of settings) map[s.key] = s.value
  return map
}

export default async function ContactPage() {
  // ✅ 필요한 필드만 가져오기 (payload 최소화)
  const settings = await prisma.siteSetting.findMany({
    select: { key: true, value: true },
  })
  const settingsMap = toSettingsMap(settings)

  const siteName = settingsMap.site_name || '행복한요양원'
  const sitePhone = settingsMap.site_phone || '031-856-8090'
  const siteEmail = settingsMap.site_email || 'info@happynursinghome.com'
  const siteAddress = settingsMap.site_address || '경기 양주시 외미로20번길 34'
  const kakaoChannelId = (settingsMap.kakao_channel_id || '_xaXXXX').trim()

  // ✅ https 권장
  const kakaoUrl = `https://pf.kakao.com/${kakaoChannelId}`

  return (
    <div className="min-h-screen bg-bg-cream pt-20">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20">
        <div className="max-w-[1400px] mx-auto px-6 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6">
            언제든 문의하세요
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-95">
            전문 상담원이 24시간 이내 답변드립니다
          </p>
        </div>
      </section>

      {/* Quick Contact Methods */}
      <section className="py-12">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Phone */}
            <a
              href={`tel:${sitePhone}`}
              className="bg-gradient-to-br from-primary-orange to-accent-lightOrange text-white rounded-3xl p-8 text-center hover:shadow-xl transition-all hover:-translate-y-2"
              aria-label={`${siteName} 전화 상담 ${sitePhone}`}
            >
              <Phone className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">전화 상담</h3>
              <p className="text-lg opacity-90 mb-3">{sitePhone}</p>
              <p className="text-sm opacity-75">평일 09:00 - 18:00</p>
            </a>

            {/* KakaoTalk */}
            <a
              href={kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-br from-primary-green to-primary-green/80 text-white rounded-3xl p-8 text-center hover:shadow-xl transition-all hover:-translate-y-2"
              aria-label={`${siteName} 카카오톡 상담`}
            >
              <MessageCircle className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">카카오톡 상담</h3>
              <p className="text-lg opacity-90 mb-3">1:1 채팅 상담</p>
              <p className="text-sm opacity-75">실시간 답변</p>
            </a>

            {/* Online Form */}
            <a
              href="#contact-form"
              className="bg-gradient-to-br from-primary-brown to-primary-brown/80 text-white rounded-3xl p-8 text-center hover:shadow-xl transition-all hover:-translate-y-2"
              aria-label="온라인 상담 신청 폼으로 이동"
            >
              <Calendar className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">온라인 신청</h3>
              <p className="text-lg opacity-90 mb-3">상담 예약</p>
              <p className="text-sm opacity-75">24시간 접수</p>
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div id="contact-form">
              <div className="mb-8">
                <h2 className="font-serif text-3xl font-bold text-primary-brown mb-4">
                  상담 신청하기
                </h2>
                <p className="text-text-gray">
                  아래 양식을 작성해주시면 빠르게 연락드리겠습니다
                </p>
              </div>

              <div className="bg-white rounded-3xl border-2 border-border-light p-8">
                <ContactForm />
              </div>

              <div className="mt-6 bg-gradient-to-r from-primary-orange/10 to-accent-peach/10 rounded-2xl p-6">
                <h4 className="font-bold text-primary-brown mb-2">📌 상담 안내</h4>
                <ul className="space-y-2 text-sm text-text-gray">
                  <li>• 평일 접수 건: 당일 또는 익일 답변</li>
                  <li>• 주말/공휴일 접수: 다음 영업일 답변</li>
                  <li>• 급한 문의는 전화 상담을 이용해주세요</li>
                  <li>• 모든 상담 내용은 비공개로 처리됩니다</li>
                </ul>
              </div>
            </div>

            {/* Contact Info & Map */}
            <div className="space-y-8">
              {/* Contact Information */}
              <div>
                <h2 className="font-serif text-3xl font-bold text-primary-brown mb-8">
                  연락처 정보
                </h2>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-primary-orange/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-primary-orange" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary-brown mb-1">주소</h3>
                      <p className="text-text-gray">{siteAddress}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-primary-green/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-primary-green" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary-brown mb-1">전화번호</h3>
                      <a
                        href={`tel:${sitePhone}`}
                        className="text-text-gray hover:text-primary-orange transition-colors"
                      >
                        {sitePhone}
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-primary-brown/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-primary-brown" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary-brown mb-1">이메일</h3>
                      <a
                        href={`mailto:${siteEmail}`}
                        className="text-text-gray hover:text-primary-orange transition-colors"
                      >
                        {siteEmail}
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-accent-lightOrange/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-accent-lightOrange" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary-brown mb-1">운영 시간</h3>
                      <div className="text-text-gray space-y-1">
                        <p>24시간 운영</p>
                        <p className="text-sm">상담: 평일 09:00 - 18:00</p>
                        <p className="text-sm">면회: 매일 10:00 - 18:00</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div>
                <h3 className="font-bold text-primary-brown mb-4 text-xl">오시는 길</h3>
                <div className="bg-gray-200 rounded-3xl overflow-hidden aspect-square flex items-center justify-center">
                  <div className="text-center p-8">
                    <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 text-lg font-semibold">
                      지도 API 연동 영역
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Kakao Map 또는 Google Maps
                    </p>
                  </div>
                </div>

                <div className="mt-6 bg-white rounded-2xl border-2 border-border-light p-6">
                  <h4 className="font-bold text-primary-brown mb-3">교통편</h4>
                  <ul className="space-y-2 text-sm text-text-gray">
                    <li className="flex gap-2">
                      <span className="text-primary-orange">🚇</span>
                      <span>지하철 2호선 강남역 3번 출구 도보 10분</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary-orange">🚌</span>
                      <span>버스 146, 242, 472 이용 가능</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary-orange">🚗</span>
                      <span>무료 주차장 완비 (방문 시 2시간 무료)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              자주 묻는 질문
            </h2>
            <p className="text-lg text-text-gray">
              상담 전 미리 확인해보세요
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            <details className="bg-bg-cream rounded-2xl border-2 border-border-light p-6 hover:border-primary-orange transition-colors">
              <summary className="font-bold text-primary-brown cursor-pointer list-none flex justify-between items-center">
                <span>시설 견학은 언제 가능한가요?</span>
                <span className="text-primary-orange">+</span>
              </summary>
              <p className="mt-4 text-text-gray text-sm leading-relaxed">
                평일과 주말 모두 가능합니다. 사전 예약을 하시면 더욱 자세한 안내를 받으실 수 있습니다.
                전화 또는 온라인으로 예약해주세요.
              </p>
            </details>

            <details className="bg-bg-cream rounded-2xl border-2 border-border-light p-6 hover:border-primary-orange transition-colors">
              <summary className="font-bold text-primary-brown cursor-pointer list-none flex justify-between items-center">
                <span>상담 비용이 있나요?</span>
                <span className="text-primary-orange">+</span>
              </summary>
              <p className="mt-4 text-text-gray text-sm leading-relaxed">
                상담은 완전 무료입니다. 전화, 카카오톡, 방문 상담 모두 비용이 들지 않으니 편하게 문의해주세요.
              </p>
            </details>

            <details className="bg-bg-cream rounded-2xl border-2 border-border-light p-6 hover:border-primary-orange transition-colors">
              <summary className="font-bold text-primary-brown cursor-pointer list-none flex justify-between items-center">
                <span>입소 대기 기간은 얼마나 되나요?</span>
                <span className="text-primary-orange">+</span>
              </summary>
              <p className="mt-4 text-text-gray text-sm leading-relaxed">
                현재 입소 가능 여부는 실시간으로 변동됩니다. 상담 시 정확한 대기 기간을 안내해드리겠습니다.
              </p>
            </details>

            <details className="bg-bg-cream rounded-2xl border-2 border-border-light p-6 hover:border-primary-orange transition-colors">
              <summary className="font-bold text-primary-brown cursor-pointer list-none flex justify-between items-center">
                <span>어떤 서류가 필요한가요?</span>
                <span className="text-primary-orange">+</span>
              </summary>
              <p className="mt-4 text-text-gray text-sm leading-relaxed">
                장기요양인정서, 건강진단서, 주민등록등본 등이 필요합니다.
                상담 시 필요 서류에 대해 자세히 안내해드립니다.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-primary-green to-primary-green/80">
        <div className="max-w-[1400px] mx-auto px-6 text-center text-white">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6">
            지금 바로 상담받으세요
          </h2>
          <p className="text-xl mb-8 opacity-95">
            전문 상담원이 친절하게 안내해드립니다
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={`tel:${sitePhone}`}
              className="px-8 py-4 bg-white text-primary-green rounded-full font-bold text-lg hover:shadow-xl transition-all hover:-translate-y-1"
              aria-label={`${siteName} 전화 상담 ${sitePhone}`}
            >
              전화 상담 {sitePhone}
            </a>
            <a
              href={kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-white/20 backdrop-blur-sm border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/30 transition-all"
              aria-label={`${siteName} 카카오톡 상담`}
            >
              카카오톡 상담
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
