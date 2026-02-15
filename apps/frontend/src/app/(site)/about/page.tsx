import React from 'react'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Mail, Clock, Award, Users, Heart, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: '소개 | 행복한요양원',
  description: '15년 전통의 행복한요양원. 전문 간호사 24시간 상주, 개별 맞춤 케어, 지자체 A등급 인증.',
}

export default async function AboutPage() {
  // DB에서 설정 가져오기
  const settings = await prisma.siteSetting.findMany()
  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value
    return acc
  }, {} as Record<string, string>)

  const siteName = settingsMap.site_name || '행복한요양원'
  const sitePhone = settingsMap.site_phone || '031-856-8090'
  const siteEmail = settingsMap.site_email || 'info@happynursinghome.com'
  const siteAddress = settingsMap.site_address || '경기 양주시 외미로20번길 34'
  const operatingYears = settingsMap.operating_years || '15'
  const staffCount = settingsMap.staff_count || '25'
  const satisfactionRate = settingsMap.satisfaction_rate || '98'

  return (
    <div className="min-h-screen bg-bg-cream pt-20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-brown via-primary-orange to-accent-peach text-white py-20">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-[1400px] mx-auto px-6 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6">
            가족처럼 따뜻하게,
            <br />
            전문가처럼 안전하게
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-95">
            {operatingYears}년 전통의 {siteName}
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-8 py-6">
              <div className="text-4xl font-bold mb-2">{operatingYears}년</div>
              <div className="text-lg">운영 경력</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-8 py-6">
              <div className="text-4xl font-bold mb-2">{staffCount}명</div>
              <div className="text-lg">전문 인력</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-8 py-6">
              <div className="text-4xl font-bold mb-2">{satisfactionRate}%</div>
              <div className="text-lg">만족도</div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              우리의 가치
            </h2>
            <p className="text-lg text-text-gray">
              행복한요양원이 가장 중요하게 생각하는 것들
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-8 rounded-3xl bg-gradient-to-br from-primary-orange/10 to-accent-peach/10 border-2 border-primary-orange/20">
              <div className="w-16 h-16 mx-auto mb-6 bg-primary-orange rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-primary-brown mb-3">진심</h3>
              <p className="text-text-gray">
                가족을 대하듯 진심으로 모시는 마음
              </p>
            </div>

            <div className="text-center p-8 rounded-3xl bg-gradient-to-br from-primary-green/10 to-primary-green/5 border-2 border-primary-green/20">
              <div className="w-16 h-16 mx-auto mb-6 bg-primary-green rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-primary-brown mb-3">안전</h3>
              <p className="text-text-gray">
                24시간 전문 인력의 철저한 케어
              </p>
            </div>

            <div className="text-center p-8 rounded-3xl bg-gradient-to-br from-primary-brown/10 to-primary-brown/5 border-2 border-primary-brown/20">
              <div className="w-16 h-16 mx-auto mb-6 bg-primary-brown rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-primary-brown mb-3">소통</h3>
              <p className="text-text-gray">
                가족과의 투명하고 열린 소통
              </p>
            </div>

            <div className="text-center p-8 rounded-3xl bg-gradient-to-br from-accent-lightOrange/30 to-accent-peach/20 border-2 border-accent-lightOrange/30">
              <div className="w-16 h-16 mx-auto mb-6 bg-accent-lightOrange rounded-full flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-primary-brown mb-3">전문성</h3>
              <p className="text-text-gray">
                끊임없는 교육과 최신 케어 기법
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              인증 및 수상
            </h2>
            <p className="text-lg text-text-gray">
              검증된 시설, 신뢰할 수 있는 서비스
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl border-2 border-border-light p-8 text-center hover:border-primary-orange transition-colors">
              <div className="text-5xl mb-4">🏆</div>
              <h3 className="text-xl font-bold text-primary-brown mb-2">
                지자체 A등급 인증
              </h3>
              <p className="text-text-gray">
                양주시 노인요양시설 평가 최고 등급
              </p>
              <div className="mt-4 text-sm text-primary-orange font-semibold">
                2024년 인증
              </div>
            </div>

            <div className="bg-white rounded-3xl border-2 border-border-light p-8 text-center hover:border-primary-orange transition-colors">
              <div className="text-5xl mb-4">⭐</div>
              <h3 className="text-xl font-bold text-primary-brown mb-2">
                우수 요양기관 선정
              </h3>
              <p className="text-text-gray">
                보건복지부 우수 요양기관
              </p>
              <div className="mt-4 text-sm text-primary-orange font-semibold">
                2023년 선정
              </div>
            </div>

            <div className="bg-white rounded-3xl border-2 border-border-light p-8 text-center hover:border-primary-orange transition-colors">
              <div className="text-5xl mb-4">💝</div>
              <h3 className="text-xl font-bold text-primary-brown mb-2">
                고객 만족도 1위
              </h3>
              <p className="text-text-gray">
                양주시 요양시설 만족도 조사
              </p>
              <div className="mt-4 text-sm text-primary-orange font-semibold">
                3년 연속
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              연혁
            </h2>
            <p className="text-lg text-text-gray">
              {operatingYears}년간 쌓아온 신뢰와 경험
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-32 text-right">
                  <div className="text-2xl font-bold text-primary-orange">2024</div>
                </div>
                <div className="flex-1 pb-8 border-l-4 border-primary-orange pl-6">
                  <h3 className="text-xl font-bold text-primary-brown mb-2">
                    지자체 A등급 인증 획득
                  </h3>
                  <p className="text-text-gray">
                    양주시 노인요양시설 평가에서 최고 등급 획득
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-32 text-right">
                  <div className="text-2xl font-bold text-primary-brown">2020</div>
                </div>
                <div className="flex-1 pb-8 border-l-4 border-primary-brown pl-6">
                  <h3 className="text-xl font-bold text-primary-brown mb-2">
                    시설 확장 및 리모델링
                  </h3>
                  <p className="text-text-gray">
                    침실 및 공용 공간 전면 리모델링, 최신 설비 도입
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-32 text-right">
                  <div className="text-2xl font-bold text-primary-brown">2015</div>
                </div>
                <div className="flex-1 pb-8 border-l-4 border-primary-brown pl-6">
                  <h3 className="text-xl font-bold text-primary-brown mb-3">
                    정원 확대 (50명)
                  </h3>
                  <p className="text-text-gray">
                    증가하는 수요에 대응하여 정원 확대
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-32 text-right">
                  <div className="text-2xl font-bold text-primary-green">2010</div>
                </div>
                <div className="flex-1 pb-8 border-l-4 border-primary-green pl-6">
                  <h3 className="text-xl font-bold text-primary-brown mb-2">
                    행복한요양원 개원
                  </h3>
                  <p className="text-text-gray">
                    양주시에서 30명 정원으로 개원
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-4">
              오시는 길
            </h2>
            <p className="text-lg text-text-gray">
              편리한 교통, 쾌적한 환경
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Map Placeholder */}
            <div className="bg-gray-200 rounded-3xl overflow-hidden aspect-video lg:aspect-auto flex items-center justify-center">
              <div className="text-center p-8">
                <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">
                  지도 API 연동 영역
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Kakao Map 또는 Google Maps
                </p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border-2 border-border-light p-6 flex gap-4">
                <MapPin className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-primary-brown mb-2">주소</h3>
                  <p className="text-text-gray">{siteAddress}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border-2 border-border-light p-6 flex gap-4">
                <Phone className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-primary-brown mb-2">전화</h3>
                  <a 
                    href={`tel:${sitePhone}`}
                    className="text-text-gray hover:text-primary-orange transition-colors"
                  >
                    {sitePhone}
                  </a>
                </div>
              </div>

              <div className="bg-white rounded-2xl border-2 border-border-light p-6 flex gap-4">
                <Mail className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-primary-brown mb-2">이메일</h3>
                  <a 
                    href={`mailto:${siteEmail}`}
                    className="text-text-gray hover:text-primary-orange transition-colors"
                  >
                    {siteEmail}
                  </a>
                </div>
              </div>

              <div className="bg-white rounded-2xl border-2 border-border-light p-6 flex gap-4">
                <Clock className="w-6 h-6 text-primary-orange flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-primary-brown mb-2">운영 시간</h3>
                  <p className="text-text-gray">24시간 운영</p>
                  <p className="text-sm text-text-gray mt-1">
                    면회: 평일 10:00 - 18:00
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-primary-orange to-accent-lightOrange rounded-2xl p-6 text-white">
                <h3 className="font-bold text-lg mb-2">교통편</h3>
                <ul className="space-y-2 text-sm">
                  <li>• 지하철 2호선 강남역 3번 출구 도보 10분</li>
                  <li>• 버스 146, 242, 472 이용 가능</li>
                  <li>• 무료 주차장 완비 (방문 시 2시간 무료)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary-orange via-accent-lightOrange to-primary-orange">
        <div className="max-w-[1400px] mx-auto px-6 text-center text-white">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6">
            직접 방문하여 확인해보세요
          </h2>
          <p className="text-xl mb-8 opacity-95">
            시설 견학 및 상담은 언제든 환영합니다
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="px-8 py-4 bg-white text-primary-orange rounded-full font-bold text-lg hover:shadow-xl transition-all hover:-translate-y-1"
            >
              상담 신청하기
            </Link>
            <a
              href={`tel:${sitePhone}`}
              className="px-8 py-4 bg-white/20 backdrop-blur-sm border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/30 transition-all"
            >
              전화 상담하기
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}