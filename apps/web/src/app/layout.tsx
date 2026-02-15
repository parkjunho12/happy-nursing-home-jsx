// src/app/layout.tsx
import type { Metadata } from 'next'
import { Noto_Sans_KR, Nanum_Myeongjo } from 'next/font/google'
import './globals.css'
import { DEFAULT_METADATA, SITE_INFO } from '@/lib/constants'
import GTM from '@/components/analytics/GTM'

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
    url: 'https://happynursinghome.com',
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
  icons: {
    icon: "./logo.png",
    shortcut: "./logo.png",
    apple: "./logo.png",
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
  verification: { google: 'your-google-site-verification' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['NursingHome', 'MedicalBusiness', 'LocalBusiness'],
    name: SITE_INFO.name,
    description: DEFAULT_METADATA.description,
    url: 'https://happynursinghome.com',
    telephone: SITE_INFO.phone,
    email: SITE_INFO.email,
    image: '/og-image.jpg',
    logo: '/logo.png',
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
  }

  return (
    <html lang="ko" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>

      <body className={`${notoSansKr.variable} ${nanumMyeongjo.variable} font-sans antialiased`}>
        <GTM />
        {children}

      </body>
    </html>
  )
}
