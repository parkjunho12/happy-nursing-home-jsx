'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Phone, MessageCircle } from 'lucide-react'

interface HelpPopupProps {
  show: boolean
  page: string
  onClose: () => void
}

const PAGE_MESSAGES: Record<string, { title: string; message: string }> = {
  costs: {
    title: '비용 때문에 고민이시군요',
    message:
      '정확한 비용은 어르신의 상태와 장기요양등급에 따라 달라질 수 있습니다.\n전문 상담원이 자세히 안내해드릴까요?',
  },
  facilities: {
    title: '시설이 궁금하신가요?',
    message:
      '실제 시설을 둘러보시면 더 확실하게 결정하실 수 있습니다.\n방문 예약을 도와드릴까요?',
  },
  programs: {
    title: '프로그램이 궁금하신가요?',
    message:
      '어르신 상태에 맞는 프로그램을 안내해드립니다.\n상담원과 이야기 나눠보시겠어요?',
  },
  risk_assessment: {
    title: '장기요양 등급 때문에 고민이시군요',
    message:
      '장기요양 신청부터 입소 상담까지 차근차근 도와드립니다.\n무료 상담을 받아보시겠어요?',
  },
  contact: {
    title: '상담을 도와드릴까요?',
    message:
      '궁금하신 내용을 바로 안내해드릴 수 있습니다.\n전화 또는 카카오톡으로 편하게 문의해 주세요.',
  },
  home: {
    title: '도움이 필요하신가요?',
    message:
      '입소 상담, 비용 안내, 방문 예약까지 편하게 도와드립니다.\n부담 없이 문의해 주세요.',
  },
  default: {
    title: '도움이 필요하신가요?',
    message:
      '궁금하신 점이 있으시면 언제든 연락주세요.\n친절하게 안내해드리겠습니다.',
  },
}

/**
 * page 문자열을 팝업 메시지용 key로 정규화
 */
function normalizePageKey(rawPage: string): string {
  if (!rawPage) return 'default'

  let value = rawPage.trim().toLowerCase()

  // 쿼리스트링 제거
  value = value.split('?')[0]

  // page_view_ 접두어 제거
  value = value.replace(/^page_view_/, '')

  // 슬래시를 언더스코어로 통일
  value = value.replace(/\//g, '_')

  // 연속 언더스코어 정리
  value = value.replace(/_+/g, '_')

  // 앞뒤 언더스코어 제거
  value = value.replace(/^_+|_+$/g, '')

  // 구체 페이지 -> 대표 카테고리 매핑
  if (value.includes('fees') || value.includes('cost') || value.includes('admission_fees')) {
    return 'costs'
  }

  if (
    value.includes('facility') ||
    value.includes('facilities') ||
    value.includes('overview') ||
    value.includes('location')
  ) {
    return 'facilities'
  }

  if (
    value.includes('program') ||
    value.includes('cognitive') ||
    value.includes('special_events') ||
    value.includes('schedule')
  ) {
    return 'programs'
  }

  if (
    value.includes('risk_assessment') ||
    value.includes('risk-assessment') ||
    value.includes('grade')
  ) {
    return 'risk_assessment'
  }

  if (value.includes('contact') || value.includes('inquiry')) {
    return 'contact'
  }

  if (value === '' || value === 'home' || value === 'index') {
    return 'home'
  }

  return value
}

export default function HelpPopup({ show, page, onClose }: HelpPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const normalizedPage = useMemo(() => normalizePageKey(page), [page])
  const content = PAGE_MESSAGES[normalizedPage] || PAGE_MESSAGES.default

  useEffect(() => {
    if (!show) {
      setIsVisible(false)
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    const popupShownKey = `help_popup_shown_${normalizedPage}`
    const lastShown = localStorage.getItem(popupShownKey)

    if (lastShown) {
      const hoursSince = (Date.now() - parseInt(lastShown, 10)) / (1000 * 60 * 60)
      if (hoursSince < 24) {
        return
      }
    }

    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true)
      localStorage.setItem(popupShownKey, Date.now().toString())
    }, 1000)

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [show, normalizedPage])

  const handleClose = () => {
    setIsVisible(false)
    window.setTimeout(() => {
      onClose()
    }, 300)
  }

  const handlePhoneClick = () => {
    if (typeof window !== 'undefined' && (window as any).trackPhoneClickWithIP) {
      ;(window as any).trackPhoneClickWithIP()
    }

    window.location.href = 'tel:0318568090'
    handleClose()
  }

  const handleKakaoClick = () => {
    if (typeof window !== 'undefined' && (window as any).trackKakaoClickWithIP) {
      ;(window as any).trackKakaoClickWithIP()
    }

    window.open('https://open.kakao.com/o/svXNViii', '_blank', 'noopener,noreferrer')
    handleClose()
  }

  if (!isVisible) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/45 animate-fade-in"
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl pointer-events-auto animate-slide-up md:p-7"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleClose}
            aria-label="팝업 닫기"
            className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-5 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
              <span className="text-3xl">🤝</span>
            </div>
          </div>

          <h3 className="mb-3 text-center text-2xl font-bold tracking-[-0.02em] text-gray-900">
            {content.title}
          </h3>

          <p className="mb-6 whitespace-pre-line text-center leading-relaxed text-gray-600">
            {content.message}
          </p>

          <div className="space-y-3">
            <button
              onClick={handlePhoneClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-4 font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <Phone className="h-5 w-5" />
              전화로 상담하기
            </button>

            <button
              onClick={handleKakaoClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-4 font-semibold text-gray-900 transition-colors hover:bg-yellow-500"
            >
              <MessageCircle className="h-5 w-5" />
              카카오톡으로 상담하기
            </button>

            <button
              onClick={handleClose}
              className="w-full px-6 py-3 text-gray-600 transition-colors hover:text-gray-900"
            >
              괜찮아요, 계속 둘러볼게요
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            💡 평일 9시~6시 언제든 편하게 문의해 주세요
          </p>
          <p className="mt-4 text-center text-xs text-gray-400">
            정상 상담 보호를 위해 반복적 비정상 클릭은 자동 감지됩니다
            </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.25s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  )
}