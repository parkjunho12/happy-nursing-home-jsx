'use client'

import Link from 'next/link'
import type { ReactNode, MouseEvent } from 'react'
import { trackCtaEvent, type CtaEventType } from '@/lib/analytics/naverAdTracking'

const KAKAO_URL = 'https://open.kakao.com/o/svXNViii'

function resolveHref(destination?: string, href?: string): string | undefined {
  if (href) return href
  if (!destination) return undefined
  if (destination === 'kakao') return KAKAO_URL
  return destination // tel:..., /path, https://...
}

export interface TrackedCTAProps {
  eventType: CtaEventType
  componentName: string
  sectionName: string
  buttonLabel: string
  destination?: string
  /** 실제 이동 링크(미지정 시 destination에서 유추) */
  href?: string
  target?: string
  className?: string
  children: ReactNode
  onClick?: (e: MouseEvent) => void
}

/**
 * 클릭 시 CTA 이벤트를 비동기 전송(sendBeacon)하고, 기본 이동은 막지 않는다.
 * - 전화(tel:)·카카오 외부 링크는 그대로 이동
 * - 폼 제출/액션형은 button 으로 렌더
 */
export default function TrackedCTA({
  eventType, componentName, sectionName, buttonLabel, destination, href, target, className, children, onClick,
}: TrackedCTAProps) {
  const fire = () => trackCtaEvent(eventType, { componentName, sectionName, buttonLabel, destination })
  const resolved = resolveHref(destination, href)

  // 폼 제출/내부 액션 (이동 링크 없음)
  if (eventType === 'consultation_submit' || !resolved) {
    return (
      <button type="button" data-cta-tracked="1" className={className} onClick={(e) => { fire(); onClick?.(e) }}>
        {children}
      </button>
    )
  }

  const isExternal = resolved.startsWith('http') || resolved.startsWith('tel:') || target === '_blank'
  if (isExternal) {
    return (
      <a
        href={resolved}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        data-cta-tracked="1"
        className={className}
        onClick={(e) => { fire(); onClick?.(e) }}
      >
        {children}
      </a>
    )
  }

  // 내부 경로 (Next Link)
  return (
    <Link href={resolved} data-cta-tracked="1" className={className} onClick={(e) => { fire(); onClick?.(e) }}>
      {children}
    </Link>
  )
}
