import React from 'react'
import Link from 'next/link'
import { SITE_INFO, FOOTER_LINKS } from '@/lib/constants'
import { Facebook, Instagram, Youtube } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-primary-brown text-white/80">
      <div className="max-w-[1400px] mx-auto px-6 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* About Section */}
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-bold text-white mb-4">
              {SITE_INFO.name}
            </h3>
            <p className="leading-relaxed mb-6">
              13년 전통의 전문 노인요양시설
              <br />
              {SITE_INFO.slogan}
              <br />
              행복한 노후를 함께 만들어갑니다
            </p>

            {/* Social Links */}
            <div className="flex gap-3">
              <a
                href={SITE_INFO.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 hover:bg-primary-orange rounded-full flex items-center justify-center transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href={SITE_INFO.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 hover:bg-primary-orange rounded-full flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={SITE_INFO.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 hover:bg-primary-orange rounded-full flex items-center justify-center transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold text-white mb-4">바로가기</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-primary-orange transition-colors inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-bold text-white mb-4">상담/문의</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.contact.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-primary-orange transition-colors inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-8 border-t border-white/10">
          <div className="text-sm leading-relaxed text-center md:text-left">
            <p className="mb-2">
              <strong>상호:</strong> {SITE_INFO.name} | <strong>대표:</strong>{' '}
              {SITE_INFO.businessInfo.owner} | <strong>사업자등록번호:</strong>{' '}
              {SITE_INFO.businessInfo.registrationNumber}
            </p>
            <p className="mb-2">
              <strong>주소:</strong> {SITE_INFO.address.full} (우:{' '}
              {SITE_INFO.address.zipCode})
            </p>
            <p className="mb-4">
              <strong>Tel:</strong>{' '}
              <a
                href={`tel:${SITE_INFO.phone}`}
                className="hover:text-primary-orange transition-colors"
              >
                {SITE_INFO.phone}
              </a>{' '}
              | <strong>Email:</strong>{' '}
              <a
                href={`mailto:${SITE_INFO.email}`}
                className="hover:text-primary-orange transition-colors"
              >
                {SITE_INFO.email}
              </a>
            </p>
            <p className="text-white/60">
              © {currentYear} {SITE_INFO.name}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}