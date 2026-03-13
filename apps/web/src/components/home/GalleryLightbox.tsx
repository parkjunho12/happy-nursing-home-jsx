'use client'

import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

type Item = {
  id: number
  src: string
  title: string
}

type Props = {
  items: Item[]
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
}: Props) {
  if (openIndex === null) return null

  const item = items[openIndex]

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 z-50 rounded-full bg-white/10 p-2 text-white"
        aria-label="닫기"
      >
        <X className="h-6 w-6" />
      </button>

      <button
        type="button"
        onClick={onPrev}
        className="absolute left-4 md:left-6 z-50 rounded-full bg-white/10 p-2 text-white"
        aria-label="이전 이미지"
      >
        <ChevronLeft className="h-7 w-7" />
      </button>

      <div className="relative w-[92vw] h-[78vh] max-w-6xl">
        <Image
          src={item.src}
          alt={item.title}
          fill
          className="object-contain"
          sizes="100vw"
          priority
        />
      </div>

      <button
        type="button"
        onClick={onNext}
        className="absolute right-4 md:right-6 z-50 rounded-full bg-white/10 p-2 text-white"
        aria-label="다음 이미지"
      >
        <ChevronRight className="h-7 w-7" />
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-2 text-white text-sm md:text-base">
        {item.title}
      </div>
    </div>
  )
}