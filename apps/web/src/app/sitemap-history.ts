import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.행복한요양원녹양역.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function getHistoryPosts() {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/history?limit=100`, {
      cache: 'no-store',
    })
    
    if (!res.ok) {
      return []
    }
    
    const data = await res.json()
    return data.items || []
  } catch (error) {
    console.error('Failed to fetch history posts for sitemap:', error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getHistoryPosts()

  return posts.map((post: any) => ({
    url: `${BASE_URL}/history/${post.slug}`,
    lastModified: new Date(post.updated_at || post.published_at || post.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))
}