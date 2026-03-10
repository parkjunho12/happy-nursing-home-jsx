import Head from 'next/head'

interface NaverSEOProps {
  title: string
  description: string
  url: string
  imageUrl?: string
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  keywords?: string
}

export default function NaverSEO({
  title,
  description,
  url,
  imageUrl = 'https://www.행복한요양원녹양역.com/og-image.jpg',
  type = 'website',
  publishedTime,
  modifiedTime,
  keywords = '요양원, 노인요양, 의정부요양원, 녹양역요양원, 행복한요양원, 장기요양, 노인돌봄',
}: NaverSEOProps) {
  const siteName = '행복한요양원 녹양역점'
  const fullUrl = `https://www.행복한요양원녹양역.com${url}`

  return (
    <>
      {/* 기본 메타 태그 */}
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={siteName} />
      
      {/* 네이버 전용 메타 태그 */}
      <meta name="naver-site-verification" content="0681d688b8f58007d39fc3e823d6ea4eaf6a947a" />
      
      {/* Open Graph (네이버가 선호) */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="ko_KR" />
      
      {/* Article 타입일 경우 */}
      {type === 'article' && publishedTime && (
        <>
          <meta property="article:published_time" content={publishedTime} />
          {modifiedTime && (
            <meta property="article:modified_time" content={modifiedTime} />
          )}
          <meta property="article:author" content={siteName} />
        </>
      )}
      
      {/* Twitter Card (부가적) */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />
    </>
  )
}