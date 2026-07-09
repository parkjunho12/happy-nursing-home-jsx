import { useEffect, useState, type RefObject } from 'react'
import { ArrowUp } from 'lucide-react'

/**
 * 긴 페이지에서 "맨 위로" 플로팅 버튼.
 * - containerRef 있으면 그 요소의 스크롤(데스크톱 main), 없으면 window 스크롤(모바일) 추적
 * - 300px 이상 내리면 노출, 터치 영역 44px
 */
export default function BackToTop({
  containerRef,
  bottomClass = 'bottom-6',
}: {
  containerRef?: RefObject<HTMLElement | null>
  bottomClass?: string
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = containerRef?.current ?? null
    const target: HTMLElement | Window = el ?? window
    const getTop = () => (el ? el.scrollTop : window.scrollY)
    const onScroll = () => setShow(getTop() > 300)
    target.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => target.removeEventListener('scroll', onScroll)
  }, [containerRef])

  const toTop = () => {
    const el = containerRef?.current
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!show) return null

  return (
    <button
      onClick={toTop}
      aria-label="맨 위로 이동"
      className={`fixed right-4 ${bottomClass} z-30 w-11 h-11 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-gray-600 hover:text-primary-orange hover:border-primary-orange active:scale-95 transition-all`}
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  )
}
