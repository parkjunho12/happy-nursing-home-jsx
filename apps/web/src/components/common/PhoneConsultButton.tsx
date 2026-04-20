'use client'

import { Phone } from 'lucide-react'
import type { ReactNode } from 'react'

declare global {
  interface Window {
    hpt_trace_info?: {
      _mode: string
      _memid: string
      _total_price?: string
    }
  }
}

type PhoneConsultButtonProps = {
  phoneNumber: string
  children: ReactNode
  className?: string
  showIcon?: boolean
}

export default function PhoneConsultButton({
  phoneNumber,
  children,
  className = '',
  showIcon = true,
}: PhoneConsultButtonProps) {
  return (
    <a
      href={`tel:${phoneNumber}`}
      onClick={(e) => {
        e.preventDefault()

        window.hpt_trace_info = {
          _mode: 'q',
          _memid: '',
        }

        setTimeout(() => {
          window.location.href = `tel:${phoneNumber}`
        }, 150)
      }}
      className={className}
    >
      {showIcon && <Phone className="h-5 w-5" />}
      {children}
    </a>
  )
}