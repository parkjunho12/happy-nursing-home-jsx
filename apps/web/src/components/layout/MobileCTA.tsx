'use client'

import React from 'react'
import Link from 'next/link'
import { SITE_INFO } from '@/lib/constants'
import { Phone, MessageCircle, MessageSquare } from 'lucide-react'
import { trackPhoneClick, trackSocialClick } from '@/lib/api-client'

export default function MobileCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-border-light shadow-2xl">
      <div className="flex gap-2 p-3">
        {/* Phone Button */}
        <a
          href={`tel:${SITE_INFO.phone}`}
          onClick={() => trackPhoneClick('Mobile CTA')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-primary-orange to-accent-lightOrange text-white font-semibold rounded-xl shadow-md active:scale-95 transition-transform"
        >
          <Phone className="w-5 h-5" />
          <span>전화</span>
        </a>

        {/* KakaoTalk Button */}
        <a
          href={`http://pf.kakao.com/${SITE_INFO.kakaoChannelId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSocialClick('KakaoTalk', 'Mobile CTA')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-white border-2 border-primary-brown text-primary-brown font-semibold rounded-xl active:scale-95 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
          <span>카톡</span>
        </a>

        {/* Inquiry Button */}
        <Link
          href="/contact"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-primary-green text-white font-semibold rounded-xl active:scale-95 transition-transform"
        >
          <MessageSquare className="w-5 h-5" />
          <span>상담</span>
        </Link>
      </div>
    </div>
  )
}