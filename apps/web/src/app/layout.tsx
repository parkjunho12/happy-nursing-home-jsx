// src/app/layout.tsx
import type { Metadata } from 'next'
import { Noto_Sans_KR, Nanum_Myeongjo } from 'next/font/google'
import { OrganizationSchema } from '../components/seo/StructuredData'
import './globals.css'
import { DEFAULT_METADATA, SITE_INFO } from '@/lib/constants'
import GTM from '@/components/analytics/GTM'
import dynamic from 'next/dynamic'
import NaverWcs from '@/components/analytics/NaverWcs'
import SmartLogScript from '@/components/analytics/SmartLogScript'
import PageTracker from '@/components/analytics/PageViewTracker'
import ConversionTracker from '@/components/analytics/ConversionTracker'
import localFont from 'next/font/local'


const pretendard = localFont({
  src: [
    {
      path: '../../public/fonts/Pretendard-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Pretendard-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Pretendard-SemiBold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Pretendard-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Pretendard-ExtraBold.otf',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-pretendard',
  display: 'swap',
})

const maruburi = localFont({
  src: [
    {
      path: '../../public/fonts/MaruBuri-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/MaruBuri-SemiBold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/MaruBuri-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-maruburi',
  display: 'swap',
})

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
})

const nanumMyeongjo = Nanum_Myeongjo({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  variable: '--font-nanum-myeongjo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: DEFAULT_METADATA.title,
  description: DEFAULT_METADATA.description,
  keywords: DEFAULT_METADATA.keywords,
  authors: [{ name: SITE_INFO.name }],
  creator: SITE_INFO.name,
  publisher: SITE_INFO.name,
  formatDetection: { telephone: true, email: true, address: true },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://www.행복한요양원녹양역.com',
    title: DEFAULT_METADATA.title,
    description: DEFAULT_METADATA.description,
    siteName: SITE_INFO.name,
    images: [
      {
        url: DEFAULT_METADATA.ogImage,
        width: 1200,
        height: 630,
        alt: `${SITE_INFO.name} 외관`,
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_METADATA.title,
    description: DEFAULT_METADATA.description,
    images: [DEFAULT_METADATA.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
  
    google: DEFAULT_METADATA.googleSiteVerification,
    other: {
      'naver-site-verification': DEFAULT_METADATA.naverSiteVerification,
    },
  },
  alternates: {
    canonical: 'https://www.행복한요양원녹양역.com',
    types: {
      'application/rss+xml': 'https://www.행복한요양원녹양역.com/rss.xml',
    },
  },
}
const ChatButton = dynamic(() => import('@/components/chat/ChatButton'), {
  ssr: false,
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['NursingHome', 'MedicalBusiness', 'LocalBusiness'],
    name: SITE_INFO.name,
    description: DEFAULT_METADATA.description,
    url: 'https://www.행복한요양원녹양역.com',
    telephone: SITE_INFO.phone,
    email: SITE_INFO.email,
    image: '/og-image.jpg',
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE_INFO.address.street,
      addressLocality: SITE_INFO.address.district,
      addressRegion: SITE_INFO.address.city,
      postalCode: SITE_INFO.address.zipCode,
      addressCountry: 'KR',
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
    priceRange: '₩₩₩',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '127',
    },
    slogan: SITE_INFO.slogan,
    sameAs: Object.values(SITE_INFO.social),
    icons: {
      icon: [
        { url: '/favicon.ico' },
      ],
      apple: [
        { url: '/apple-touch-icon.png' },
      ],
    },
  
  }

  const SITE_URL = 'https://www.행복한요양원녹양역.com'

  // 사이트 정체성 — 네이버/구글이 사이트명을 정확히 인식하도록
  const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}#website`,
    name: '행복한요양원 녹양역점',
    alternateName: ['양주 행복한요양원 녹양역점', '녹양역요양원', '양주요양원'],
    url: SITE_URL,
    inLanguage: 'ko-KR',
  }

  // 메인 내비게이션 — 네이버 사이트링크(서브 링크) 노출을 돕는 구조화 데이터
  const siteNavItems = [
    { name: '양주요양원', path: '/yangju-nursing-home' },
    { name: '의정부요양원', path: '/uijeongbu-nursing-home' },
    { name: '녹양역요양원', path: '/nogyang-station-nursing-home' },
    { name: '입소비용', path: '/pricing' },
    { name: '입소후기', path: '/reviews' },
    { name: '상담신청', path: '/contact' },
    { name: '오시는 길', path: '/location' },
  ]
  const siteNavJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '행복한요양원 녹양역점 주요 메뉴',
    itemListElement: siteNavItems.map((item, i) => ({
      '@type': 'SiteNavigationElement',
      position: i + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  }

  return (
    <html lang="ko" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="naver-site-verification" content={DEFAULT_METADATA.naverSiteVerification} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavJsonLd) }}
        />
        <OrganizationSchema />
      </head>

      <body className={`${notoSansKr.variable} ${nanumMyeongjo.variable} ${pretendard.variable} ${maruburi.variable} font-sans antialiased`}>
        <GTM />
        <PageTracker />
        <ConversionTracker />
        {children}
        <ChatButton />

        {/* 네이버 애널리틱스 */}
        <NaverWcs/>

        {/* Smartlog (부정클릭 방지) — 보호자 앨범(/family)에서는 미로드 */}
        <SmartLogScript />

      </body>
    </html>
  )
}

