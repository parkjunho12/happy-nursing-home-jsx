'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

interface YouTubeModalProps {
  videoId: string
  isOpen: boolean
  onClose: () => void
  title?: string
  autoplay?: boolean
}

export default function YouTubeModal({
  videoId,
  isOpen,
  onClose,
  title = '영상 보기',
  autoplay = true,
}: YouTubeModalProps) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    // 모달 열리면 닫기 버튼에 포커스
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  })

  if (autoplay) {
    params.set('autoplay', '1')
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?${params.toString()}`

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {/* 상단 헤더 */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4">
          <div className="min-w-0 pr-12">
            {title && (
              <h3
                id={titleId}
                className="truncate text-lg font-bold text-white md:text-xl"
              >
                {title}
              </h3>
            )}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/80"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 16:9 영상 */}
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </div>
  )
}