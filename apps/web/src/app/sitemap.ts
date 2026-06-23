import type { MetadataRoute } from 'next'
import { SEO_PAGES } from '@/lib/seo-pages'

const BASE_URL = 'https://www.행복한요양원녹양역.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // 핵심 페이지 (홈 + 상담)
  const core: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
  ]

  // 지역 SEO 랜딩페이지 (4종)
  const regionLandings = [
    '/yangju-nursing-home',
    '/uijeongbu-nursing-home',
    '/nogyang-station-nursing-home',
    '/nursing-home-near-uijeongbu-yangju',
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  // 정보/소개 페이지 (실제 존재하는 라우트만 포함)
  const infoPages = [
    '/services',
    '/pricing',
    '/reviews',
    '/why',
    '/history',
    '/councel',
    '/calculator',
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // 블로그
  const blog: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
  ]

  // SEO 키워드 랜딩 (/seo/[slug])
  const seoRoutes = SEO_PAGES.map((page) => ({
    url: `${BASE_URL}/seo/${page.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...core, ...regionLandings, ...infoPages, ...blog, ...seoRoutes]
}
