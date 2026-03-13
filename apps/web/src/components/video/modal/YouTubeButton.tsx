'use client'

import { useMemo, useState } from 'react'
import { Play, Youtube } from 'lucide-react'
import YouTubeModal from './YouTubeModal'

interface YouTubeButtonProps {
  videoId: string
  title?: string
  thumbnail?: string
  buttonText?: string
  variant?: 'primary' | 'secondary' | 'thumbnail'
  className?: string
}

export default function YouTubeButton({
  videoId,
  title = '영상 보기',
  thumbnail,
  buttonText = '영상 보기',
  variant = 'primary',
  className = '',
}: YouTubeButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  const openModal = () => setIsModalOpen(true)
  const closeModal = () => setIsModalOpen(false)

  const thumbnailUrl = useMemo(() => {
    if (thumbnail) return thumbnail
    return imageError
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  }, [thumbnail, imageError, videoId])

  const buttonStyles: Record<'primary' | 'secondary', string> = {
    primary:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/50',
    secondary:
      'border-2 border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-400/40',
  }

  if (variant === 'thumbnail') {
    return (
      <>
        <button
          type="button"
          onClick={openModal}
          aria-label={`${title} 재생`}
          title={title}
          className={`group relative block overflow-hidden rounded-2xl shadow-lg transition-all duration-300 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-red-500/50 ${className}`}
        >
          <div className="relative">
            <img
              src={thumbnailUrl}
              alt={title}
              loading="lazy"
              onError={() => {
                if (!thumbnail && !imageError) {
                  setImageError(true)
                }
              }}
              className="h-auto w-full transition-transform duration-300 group-hover:scale-105"
            />

            {/* 오버레이 */}
            <div className="absolute inset-0 bg-black/30 transition-colors duration-300 group-hover:bg-black/45" />

            {/* 재생 버튼 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 shadow-xl transition-transform duration-300 group-hover:scale-110">
                <Play className="ml-1 h-10 w-10 text-white" fill="white" />
              </div>
            </div>

            {/* 제목 */}
            {title && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <h3 className="text-lg font-bold text-white">{title}</h3>
              </div>
            )}
          </div>
        </button>

        <YouTubeModal
          videoId={videoId}
          isOpen={isModalOpen}
          onClose={closeModal}
          title={title}
        />
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label={`${buttonText}: ${title}`}
        title={title}
        className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold shadow-md transition-all hover:shadow-lg focus:outline-none focus:ring-2 ${buttonStyles[variant]} ${className}`}
      >
        <Youtube className="h-5 w-5" />
        <span>{buttonText}</span>
      </button>

      <YouTubeModal
        videoId={videoId}
        isOpen={isModalOpen}
        onClose={closeModal}
        title={title}
      />
    </>
  )
}