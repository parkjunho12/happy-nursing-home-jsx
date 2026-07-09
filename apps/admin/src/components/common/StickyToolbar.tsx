import { type ReactNode } from 'react'

/**
 * 긴 목록 페이지에서 필터/탭/검색 바를 상단에 고정.
 * - 모바일: 고정 헤더(56px) 아래 top-14 / 데스크톱: 본문 스크롤 상단 top-0
 * - edge: 루트 여백에 맞춰 풀블리드
 *   · 'main'      → space-y-* 루트(본문 패딩 사용): -mx-3 md:-mx-6
 *   · 'container' → p-4 md:p-6 max-w-* 루트: -mx-4 md:-mx-6
 */
export default function StickyToolbar({
  children,
  edge = 'main',
  className = '',
}: {
  children: ReactNode
  edge?: 'main' | 'container'
  className?: string
}) {
  const bleed = edge === 'container'
    ? '-mx-4 md:-mx-6 px-4 md:px-6'
    : '-mx-3 md:-mx-6 px-3 md:px-6'
  return (
    <div className={`sticky top-14 md:top-0 z-20 ${bleed} py-2 bg-gray-50/90 backdrop-blur border-b border-gray-100 ${className}`}>
      {children}
    </div>
  )
}
