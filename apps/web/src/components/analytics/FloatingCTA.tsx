'use client'

import { Phone, MessageCircle } from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import TrackedCTA from '@/components/analytics/TrackedCTA'

/**
 * 데스크톱 우하단 플로팅 CTA (전화 / 카카오톡). 모바일은 MobileCTA가 담당.
 * 클릭은 광고 유입 시 CTA 추적(FloatingCTA / FloatingButton)된다.
 */
export default function FloatingCTA() {
  return (
    <div className="hidden lg:flex fixed bottom-6 left-6 z-40 flex-col gap-2">
      <TrackedCTA
        eventType="kakao_click"
        componentName="FloatingCTA"
        sectionName="FloatingButton"
        buttonLabel="카카오톡 상담"
        destination="kakao"
        target="_blank"
        className="flex items-center gap-2 px-4 py-3 rounded-full bg-[#FEE500] text-[#3C1E1E] font-bold shadow-lg hover:scale-105 transition-transform"
      >
        <MessageCircle className="w-5 h-5" /> 카카오톡 상담
      </TrackedCTA>
      <TrackedCTA
        eventType="phone_click"
        componentName="FloatingCTA"
        sectionName="FloatingButton"
        buttonLabel={`${SITE_INFO.phone} 전화상담`}
        destination={`tel:${SITE_INFO.phone}`}
        className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-primary-orange to-amber-500 text-white font-bold shadow-lg hover:scale-105 transition-transform"
      >
        <Phone className="w-5 h-5" /> {SITE_INFO.phone}
      </TrackedCTA>
    </div>
  )
}
