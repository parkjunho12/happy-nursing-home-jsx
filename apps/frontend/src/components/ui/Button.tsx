'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
  fullWidth?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      href,
      variant = 'primary',
      size = 'md',
      children,
      leftIcon,
      rightIcon,
      loading = false,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variantStyles = {
      primary:
        'bg-gradient-to-r from-primary-orange to-accent-lightOrange text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:ring-primary-orange',
      secondary:
        'bg-white text-primary-brown border-2 border-primary-brown hover:bg-primary-brown hover:text-white focus:ring-primary-brown',
      ghost:
        'bg-transparent text-primary-brown hover:bg-primary-orange/10 focus:ring-primary-orange',
      outline:
        'bg-transparent text-primary-orange border-2 border-primary-orange hover:bg-primary-orange hover:text-white focus:ring-primary-orange',
    }

    const sizeStyles = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-8 py-4 text-base',
      lg: 'px-10 py-5 text-lg',
    }

    const classes = cn(
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && 'w-full',
      className
    )

    // ✅ href가 있으면 Link로 렌더 (onClick 필요 없음)
    if (href) {
      return (
        <Link href={href} className={classes}>
          {leftIcon && <span>{leftIcon}</span>}
          {children}
          {rightIcon && <span>{rightIcon}</span>}
        </Link>
      )
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            처리 중...
          </>
        ) : (
          <>
            {leftIcon && <span>{leftIcon}</span>}
            {children}
            {rightIcon && <span>{rightIcon}</span>}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
