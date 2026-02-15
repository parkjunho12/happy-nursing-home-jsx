'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Phone } from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import Image from 'next/image'

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { href: '/', label: '홈' },
    { href: '/about', label: '시설 소개' },
    { href: '/services', label: '서비스' },
    { href: '/pricing', label: '요금 안내' },
    { href: '/reviews', label: '이용 후기' },
    { href: '/history', label: '히스토리' },
    { href: '/contact', label: '상담 신청' },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white shadow-md'
          : 'bg-white/95 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
          <div className="w-12 h-12 relative">
            <Image
              src="/assets/logo/logo.png"
              alt={`${SITE_INFO.name} 로고`}
              fill
              priority
              className="object-contain"
            />
          </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {SITE_INFO.name}
              </h1>
              <p className="text-xs text-gray-600">{SITE_INFO.slogan}</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-primary-orange font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Phone Button */}
          <a
            href={`tel:${SITE_INFO.phone}`}
            className="hidden lg:flex items-center gap-2 px-6 py-3 bg-primary-orange text-white rounded-full font-semibold hover:bg-primary-orange/90 transition-all hover:scale-105"
          >
            <Phone className="w-4 h-4" />
            {SITE_INFO.phone}
          </a>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100">
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={`tel:${SITE_INFO.phone}`}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-orange text-white rounded-lg font-semibold mt-4"
            >
              <Phone className="w-4 h-4" />
              {SITE_INFO.phone}
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}