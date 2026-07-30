'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X, Phone, ChevronDown, ChevronRight,
  Home, Building2, Sparkles, Wallet, MapPin, Map, TrainFront,
  Star, BookOpen, HeartHandshake, Images, MessageCircle,
  type LucideIcon,
  Briefcase, Youtube } from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import Image from 'next/image'

type NavLink = { href: string; label: string; icon: LucideIcon; desc?: string }
type NavGroup = { label: string; href?: string; children?: NavLink[] }

const NAV: NavGroup[] = [
  { label: '홈', href: '/' },
  {
    label: '시설 안내',
    children: [
      { href: '/yangju-nursing-home', label: '시설 소개', icon: Building2, desc: '단독건물형 · A등급 자매시설' },
      { href: '/services', label: '서비스', icon: Sparkles, desc: '맞춤 케어·프로그램' },
      { href: '/pricing', label: '입소비용', icon: Wallet, desc: '비용·등급 안내' },
      { href: '/location', label: '오시는 길', icon: MapPin, desc: '녹양역 인근' },
    ],
  },
  {
    label: '지역별 안내',
    children: [
      { href: '/yangju-nursing-home', label: '양주요양원', icon: MapPin, desc: '양주 인근 보호자님' },
      { href: '/uijeongbu-nursing-home', label: '의정부요양원', icon: MapPin, desc: '의정부 차로 5분' },
      { href: '/nogyang-station-nursing-home', label: '녹양역요양원', icon: TrainFront, desc: '대중교통 편리' },
      { href: '/nursing-home-near-uijeongbu-yangju', label: '의정부·양주 인근', icon: Map, desc: '경기북부' },
      { href: '/seoul-northern-nursing-home', label: '서울 북부 (도봉·노원 등)', icon: Building2, desc: '서울에서 가까워요' },
    ],
  },
  {
    label: '후기·블로그',
    children: [
      { href: '/reviews', label: '이용 후기', icon: Star, desc: '보호자님들의 이야기' },
      { href: '/blog', label: '블로그', icon: BookOpen, desc: '일상·소식' },
      { href: '/videos', label: '영상', icon: Youtube, desc: '어르신 일상 영상' },
    ],
  },
  {
    label: '함께하기',
    children: [
      { href: '/volunteer', label: '자원봉사 신청', icon: HeartHandshake, desc: '작은 손길, 큰 행복' },
      { href: '/careers', label: '채용정보', icon: Briefcase, desc: '함께할 동료를 찾습니다' },
      { href: '/family', label: '보호자 앨범', icon: Images, desc: '어르신 일상 사진' },
    ],
  },
  { label: '상담 신청', href: '/contact' },
]

export default function Header() {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMobile = () => { setIsMobileMenuOpen(false); setOpenGroup(null) }
  const groupActive = (g: NavGroup) =>
    g.href ? pathname === g.href : !!g.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/85 backdrop-blur-xl shadow-[0_6px_30px_rgba(184,110,40,0.10)]'
          : 'bg-white/70 backdrop-blur-md'
      }`}
    >
      {/* 따뜻한 상단 헤어라인 */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary-orange via-amber-400 to-primary-orange/60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[77px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group/logo">
            <div className="w-12 h-12 relative transition-transform duration-300 group-hover/logo:scale-105">
              <Image src="/assets/logo/logo.png" alt={`${SITE_INFO.name} 로고`} fill priority className="object-contain" />
            </div>
            <div>
              <h1 className="text-lg xl:text-xl font-bold text-gray-900 leading-tight">{SITE_INFO.name}</h1>
              <p className="text-[11px] text-gray-500">{SITE_INFO.slogan}</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((group) => {
              const active = groupActive(group)
              if (!group.children) {
                return (
                  <Link
                    key={group.label}
                    href={group.href!}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-semibold transition-all ${
                      active ? 'bg-orange-50 text-primary-orange' : 'text-gray-700 hover:bg-orange-50/70 hover:text-primary-orange'
                    }`}
                  >
                    {group.label}
                  </Link>
                )
              }
              return (
                <div key={group.label} className="relative group">
                  <button
                    className={`flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-semibold transition-all ${
                      active ? 'bg-orange-50 text-primary-orange' : 'text-gray-700 group-hover:bg-orange-50/70 group-hover:text-primary-orange'
                    }`}
                  >
                    {group.label}
                    <ChevronDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
                  </button>

                  {/* dropdown */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible translate-y-2 scale-[0.98] group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200 ease-out">
                    <div className="relative min-w-[270px] rounded-2xl border border-orange-100/70 bg-white/95 backdrop-blur-xl p-2.5 shadow-[0_20px_60px_rgba(184,110,40,0.18)]">
                      <span className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rotate-45 bg-white border-l border-t border-orange-100/70" />
                      <p className="whitespace-nowrap px-2.5 pt-1 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-orange-400">{group.label}</p>
                      {group.children.map((link) => {
                        const Icon = link.icon
                        const linkActive = pathname === link.href
                        return (
                          <Link
                            key={link.href + link.label}
                            href={link.href}
                            className={`group/item flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors ${linkActive ? 'bg-orange-50' : 'hover:bg-orange-50/70'}`}
                          >
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${linkActive ? 'bg-gradient-to-br from-primary-orange to-amber-500 text-white shadow-md shadow-orange-200' : 'bg-orange-50 text-primary-orange group-hover/item:bg-gradient-to-br group-hover/item:from-primary-orange group-hover/item:to-amber-500 group-hover/item:text-white group-hover/item:shadow-md group-hover/item:shadow-orange-200'}`}>
                              <Icon className="h-[19px] w-[19px]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block whitespace-nowrap text-sm font-bold ${linkActive ? 'text-primary-orange' : 'text-gray-800'}`}>{link.label}</span>
                              {link.desc && <span className="block text-xs text-gray-400 truncate">{link.desc}</span>}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 -translate-x-1 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all" />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          {/* 우측 버튼 */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <Link
              href="/family"
              className="flex items-center gap-1.5 px-4 py-2.5 border border-orange-200 text-orange-600 rounded-full font-semibold hover:bg-orange-50 hover:border-orange-300 transition-all text-sm"
            >
              🌸 보호자 앨범
            </Link>
            <a
              href={`tel:${SITE_INFO.phone}`}
              className="group/cta flex items-center gap-2.5 pl-3 pr-5 py-2 bg-gradient-to-r from-primary-orange to-amber-500 text-white rounded-full font-semibold shadow-lg shadow-orange-200/70 hover:shadow-xl hover:shadow-orange-300/60 transition-all hover:scale-[1.03]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Phone className="w-4 h-4" />
              </span>
              <span className="leading-tight text-left">
                <span className="block text-[10px] font-medium text-white/80">언제든 편하게</span>
                <span className="block text-sm font-bold -mt-0.5">{SITE_INFO.phone}</span>
              </span>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 max-h-[80vh] overflow-y-auto">
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {NAV.map((group) =>
              group.children ? (
                <div key={group.label} className="rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 font-semibold rounded-2xl transition-colors ${openGroup === group.label ? 'bg-orange-50 text-primary-orange' : 'text-gray-800 hover:bg-gray-50'}`}
                  >
                    {group.label}
                    <ChevronDown className={`w-4 h-4 transition-transform ${openGroup === group.label ? 'rotate-180' : ''}`} />
                  </button>
                  {openGroup === group.label && (
                    <div className="pl-2 pb-1 pt-0.5 space-y-0.5">
                      {group.children.map((link) => {
                        const Icon = link.icon
                        return (
                          <Link
                            key={link.href + link.label}
                            href={link.href}
                            onClick={closeMobile}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-orange-50 transition-colors"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary-orange">
                              <Icon className="h-[18px] w-[18px]" />
                            </span>
                            <span>
                              <span className="block whitespace-nowrap text-sm font-semibold text-gray-800">{link.label}</span>
                              {link.desc && <span className="block text-[11px] text-gray-400">{link.desc}</span>}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={group.label}
                  href={group.href!}
                  onClick={closeMobile}
                  className="block px-4 py-3 text-gray-800 font-semibold rounded-2xl hover:bg-gray-50"
                >
                  {group.label}
                </Link>
              )
            )}

            <a
              href={`tel:${SITE_INFO.phone}`}
              className="flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-primary-orange to-amber-500 text-white rounded-2xl font-bold mt-3 shadow-lg shadow-orange-200/60"
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
