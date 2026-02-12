'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAVIGATION, SITE_INFO } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Close mobile menu on route change
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    // Prevent body scroll when mobile menu is open
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          'bg-white/95 backdrop-blur-md border-b border-border-light',
          scrolled && 'shadow-medium'
        )}
      >
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 relative">
            <Image
              src="/assets/logo/logo.png"
              alt={`${SITE_INFO.name} 로고`}
              fill
              priority
              className="object-contain"
            />
          </div>
          <span className="text-xl md:text-2xl font-bold text-primary-brown"> {SITE_INFO.name} </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAVIGATION.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'relative text-base font-medium transition-colors',
                    'hover:text-primary-orange',
                    'after:absolute after:bottom-[-8px] after:left-0 after:w-0 after:h-0.5',
                    'after:bg-primary-orange after:transition-all after:duration-300',
                    'hover:after:w-full',
                    pathname === item.href
                      ? 'text-primary-orange after:w-full'
                      : 'text-text-dark'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-primary-brown hover:bg-primary-orange/10 rounded-lg transition-colors"
              aria-label="메뉴"
            >
              {mobileMenuOpen ? (
                <X className="w-7 h-7" />
              ) : (
                <Menu className="w-7 h-7" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div className="absolute top-20 left-0 right-0 bg-white shadow-2xl animate-fade-in">
            <nav className="flex flex-col">
              {NAVIGATION.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'px-6 py-4 text-lg font-medium transition-colors',
                    'border-b border-border-light',
                    'active:bg-primary-orange/10',
                    pathname === item.href
                      ? 'text-primary-orange bg-primary-orange/5'
                      : 'text-text-dark'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}

              {/* Quick Contact in Mobile Menu */}
              <div className="p-6 bg-bg-cream">
                <p className="text-sm font-semibold text-text-gray mb-3">
                  빠른 문의
                </p>
                <a
                  href={`tel:${SITE_INFO.phone}`}
                  className="block w-full px-6 py-3 bg-gradient-to-r from-primary-orange to-accent-lightOrange text-white font-semibold rounded-full text-center shadow-md"
                >
                  📞 {SITE_INFO.phone}
                </a>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}