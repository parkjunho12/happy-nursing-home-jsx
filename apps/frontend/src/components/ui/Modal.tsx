import React from 'react'
import { cn } from '@/lib/utils'

// Card Component
export interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover = false, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white border-2 border-border-light rounded-3xl p-8',
        'transition-all duration-300',
        hover && 'hover:border-primary-orange hover:-translate-y-2 hover:shadow-large cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// Modal Component
export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ isOpen, onClose, children, title, size = 'md' }: ModalProps) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className={cn(
          'relative bg-white rounded-3xl shadow-2xl w-full animate-fade-in-up',
          sizeStyles[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
          aria-label="닫기"
        >
          ✕
        </button>

        {/* Title */}
        {title && (
          <div className="px-8 pt-8 pb-4 border-b border-border-light">
            <h3 className="text-2xl font-bold text-primary-brown">{title}</h3>
          </div>
        )}

        {/* Body */}
        <div className={cn('p-8', title && 'pt-6')}>{children}</div>
      </div>
    </div>
  )
}

// Success Modal Component
export interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message?: string
}

export function SuccessModal({
  isOpen,
  onClose,
  title = '완료!',
  message = '요청이 성공적으로 처리되었습니다.',
}: SuccessModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary-orange to-accent-lightOrange rounded-full flex items-center justify-center text-5xl shadow-lg">
          ✅
        </div>
        <h3 className="text-2xl font-bold text-primary-brown mb-3">{title}</h3>
        <p className="text-text-gray mb-8 leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className="w-full px-8 py-4 bg-gradient-to-r from-primary-orange to-accent-lightOrange text-white font-semibold rounded-full hover:shadow-lg transition-all"
        >
          확인
        </button>
      </div>
    </Modal>
  )
}

// Error Modal Component
export interface ErrorModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message?: string
}

export function ErrorModal({
  isOpen,
  onClose,
  title = '오류 발생',
  message = '요청 처리 중 오류가 발생했습니다.',
}: ErrorModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-500 rounded-full flex items-center justify-center text-5xl shadow-lg">
          ⚠️
        </div>
        <h3 className="text-2xl font-bold text-primary-brown mb-3">{title}</h3>
        <p className="text-text-gray mb-8 leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className="w-full px-8 py-4 bg-primary-brown text-white font-semibold rounded-full hover:bg-primary-brown/90 transition-all"
        >
          확인
        </button>
      </div>
    </Modal>
  )
}