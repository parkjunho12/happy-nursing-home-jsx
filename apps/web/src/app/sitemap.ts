import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.행복한요양원녹양역.com'

export default function sitemap(): MetadataRoute.Sitemap {
  // 정적 페이지
  const staticPages = [
    '',
    '/about',
    '/facilities',
    '/programs',
    '/costs',
    '/location',
    '/contact',
    '/history',
    '/risk-assessment',
  ]

  const staticRoutes = staticPages.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }))

  // 지역별 랜딩 페이지
  const localPages = [
    '/local/gangnam',
    '/local/seocho',
    '/local/songpa',
    '/local/gangdong',
    '/local/nowon',
    '/local/dobong',
    '/local/eujungbu',
    '/local/nokyang',
    '/local/yangju',
  ]

  const localRoutes = localPages.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...localRoutes]
}