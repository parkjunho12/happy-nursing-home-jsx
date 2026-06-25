import type { Metadata } from 'next'
import { Briefcase, Phone, HeartHandshake, Users2, Sparkles } from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import CareersClient from './CareersClient'

const BASE_URL = 'https://www.행복한요양원녹양역.com'

export const metadata: Metadata = {
  title: '채용정보 | 행복한요양원 녹양역점',
  description:
    '행복한요양원 녹양역점에서 함께 성장할 따뜻한 동료를 모십니다. 요양보호사·사회복지사·간호조무사·시설장 채용. 온라인 3분 지원, 이력서는 이메일로 접수.',
  alternates: { canonical: `${BASE_URL}/careers` },
  openGraph: {
    title: '채용정보 | 행복한요양원 녹양역점',
    description: '어르신을 진심으로 돌볼 인재를 기다립니다. 온라인 간편 지원.',
    url: `${BASE_URL}/careers`,
    type: 'website',
    locale: 'ko_KR',
    siteName: '행복한요양원 녹양역점',
  },
  robots: { index: true, follow: true },
}

const perks = [
  { icon: HeartHandshake, title: '진심을 나누는 일', desc: '어르신의 하루를 따뜻하게 채우는 보람 있는 일터입니다.' },
  { icon: Users2, title: '함께 배우는 동료', desc: '경력과 무관하게 서로 돕고 성장하는 팀 문화를 지향합니다.' },
  { icon: Sparkles, title: '합리적인 처우', desc: '경력·자격에 따라 처우를 협의하며, 안정적으로 근무할 수 있습니다.' },
]

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#fff5ec] via-[#fff9f4] to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 mb-6 shadow-sm">
            <Briefcase className="w-4 h-4" /> 인재 채용
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.8rem] font-bold leading-[1.25] tracking-[-0.02em] text-gray-900">
            함께 성장할 <span className="text-primary-orange">따뜻한 동료</span>를<br className="hidden sm:block" /> 기다립니다
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            행복한요양원 녹양역점은 어르신을 진심으로 돌볼 수 있는 요양보호사와
            함께 성장할 인재를 기다립니다.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#positions" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary-orange text-white rounded-2xl font-bold hover:bg-primary-orange/90 transition-colors shadow-lg shadow-orange-200">
              채용공고 보기
            </a>
            <a href="#apply" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white border-2 border-orange-200 text-orange-600 rounded-2xl font-bold hover:bg-orange-50 transition-colors">
              지원하기
            </a>
          </div>
          <a href={`tel:${SITE_INFO.phone}`} className="mt-6 inline-flex items-center gap-2 text-gray-600 font-semibold">
            <Phone className="w-4 h-4 text-primary-orange" /> 채용 문의 {SITE_INFO.phone}
          </a>

          <div className="mt-12 grid sm:grid-cols-3 gap-4 text-left">
            {perks.map(p => {
              const Icon = p.icon
              return (
                <div key={p.title} className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 text-primary-orange flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{p.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 공고 목록 + 지원 폼 (client) */}
      <CareersClient />
    </div>
  )
}
