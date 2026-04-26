'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface GalleryItem {
  id: number
  src: string
  title: string
  alt: string
}

interface GalleryLightboxProps {
  items: GalleryItem[]
  openIndex: number | null
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

export default function GalleryLightbox({
  items,
  openIndex,
  onClose,
  onPrev,
  onNext,
}: GalleryLightboxProps) {
  useEffect(() => {
    if (openIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [openIndex, onClose, onPrev, onNext])

  if (openIndex === null) return null

  const currentItem = items[openIndex]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition hover:bg-white/20"
        aria-label="닫기"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Previous Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPrev()
        }}
        className="absolute left-4 z-50 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition hover:bg-white/20"
        aria-label="이전 이미지"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Next Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onNext()
        }}
        className="absolute right-4 z-50 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition hover:bg-white/20"
        aria-label="다음 이미지"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Image Container */}
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={currentItem.src}
          alt={currentItem.alt}
          width={1200}
          height={800}
          className="h-auto max-h-[90vh] w-auto max-w-[90vw] object-contain"
          priority
        />

        {/* Image Info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <h3 className="text-xl font-bold text-white">{currentItem.title}</h3>
          <p className="mt-1 text-sm text-white/80">
            {openIndex + 1} / {items.length}
          </p>
        </div>
      </div>
    </div>
  )
}