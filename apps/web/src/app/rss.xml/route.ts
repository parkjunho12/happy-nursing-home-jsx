import { NextResponse } from 'next/server'

const BASE_URL = 'https://www.행복한요양원녹양역.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function getHistoryPosts() {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/history?limit=50`, {
      cache: 'no-store',
    })
    
    if (!res.ok) {
      return []
    }
    
    const data = await res.json()
    return data.items || []
  } catch (error) {
    console.error('Failed to fetch history posts for RSS:', error)
    return []
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const posts = await getHistoryPosts()

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>행복한요양원 녹양역점 - 히스토리</title>
    <link>${BASE_URL}</link>
    <description>행복한요양원의 다양한 활동과 소식을 전해드립니다</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    ${posts
      .map(
        (post: any) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/history/${post.slug}</link>
      <description>${escapeXml(post.excerpt || post.title)}</description>
      <pubDate>${new Date(post.published_at || post.created_at).toUTCString()}</pubDate>
      <guid isPermaLink="true">${BASE_URL}/history/${post.slug}</guid>
      ${post.image_url ? `<enclosure url="${post.image_url}" type="image/jpeg"/>` : ''}
      ${post.tags && post.tags.length > 0 ? post.tags.map((tag: string) => `<category>${escapeXml(tag)}</category>`).join('\n      ') : ''}
    </item>`
      )
      .join('')}
  </channel>
</rss>`

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}