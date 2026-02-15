import { prisma } from './prisma'
import { HistoryCategory, HistoryFilter } from '@/types/history'

/**
 * Slug 생성 (한글 지원)
 */
export function generateSlug(title: string, id?: string): string {
  // 한글과 영문을 모두 지원하는 slug
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '') // 특수문자 제거
    .replace(/\s+/g, '-') // 공백을 -로
    .replace(/-+/g, '-') // 중복 - 제거
    .trim()
  
  // ID 추가 (고유성 보장)
  return id ? `${slug}-${id.slice(-6)}` : slug
}

/**
 * History 목록 조회
 */
export async function getHistoryPosts(filter: HistoryFilter = {}) {
  const { category, year, month, search, tag } = filter

  const where: any = {
    isPublished: true,
  }

  // 카테고리 필터
  if (category) {
    where.category = category
  }

  // 연도/월 필터
  if (year || month) {
    where.publishedAt = {}
    
    if (year) {
      const startDate = new Date(year, month ? month - 1 : 0, 1)
      const endDate = month 
        ? new Date(year, month, 0, 23, 59, 59)
        : new Date(year, 11, 31, 23, 59, 59)
      
      where.publishedAt.gte = startDate
      where.publishedAt.lte = endDate
    }
  }

  // 검색
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { excerpt: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ]
  }

  // 태그 필터
  if (tag) {
    where.tags = {
      has: tag
    }
  }

  const posts = await prisma.historyPost.findMany({
    where,
    orderBy: {
      publishedAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      excerpt: true,
      thumbnail: true,
      tags: true,
      publishedAt: true,
      viewCount: true,
    },
  })

  return posts
}

/**
 * History 상세 조회
 */
export async function getHistoryPostBySlug(slug: string) {
  const post = await prisma.historyPost.findUnique({
    where: { slug },
  })

  // 조회수 증가
  if (post && post.isPublished) {
    await prisma.historyPost.update({
      where: { slug },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })
  }

  return post
}

/**
 * 연관 포스트 조회
 */
export async function getRelatedPosts(currentSlug: string, category: HistoryCategory, limit = 3) {
  return await prisma.historyPost.findMany({
    where: {
      isPublished: true,
      category,
      slug: {
        not: currentSlug,
      },
    },
    orderBy: {
      publishedAt: 'desc',
    },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      excerpt: true,
      thumbnail: true,
      publishedAt: true,
    },
  })
}

/**
 * 인기 포스트 조회
 */
export async function getPopularPosts(limit = 5) {
  return await prisma.historyPost.findMany({
    where: {
      isPublished: true,
    },
    orderBy: {
      viewCount: 'desc',
    },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      viewCount: true,
      publishedAt: true,
    },
  })
}

/**
 * 사용 가능한 연도 목록
 */
export async function getAvailableYears(): Promise<number[]> {
  const posts = await prisma.historyPost.findMany({
    where: {
      isPublished: true,
      publishedAt: { not: null },
    },
    select: {
      publishedAt: true,
    },
    orderBy: {
      publishedAt: 'desc',
    },
  })

  const years = posts
    .filter(p => p.publishedAt)
    .map(p => p.publishedAt!.getFullYear())
  
  return Array.from(new Set(years)).sort((a, b) => b - a)
}

/**
 * 모든 태그 조회
 */
export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const posts = await prisma.historyPost.findMany({
    where: {
      isPublished: true,
    },
    select: {
      tags: true,
    },
  })

  const tagCounts: Record<string, number> = {}
  
  posts.forEach(post => {
    post.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * 카테고리별 게시물 수
 */
export async function getCategoryCount() {
  const counts = await prisma.historyPost.groupBy({
    by: ['category'],
    where: {
      isPublished: true,
    },
    _count: true,
  })

  return counts.reduce((acc, item) => {
    acc[item.category] = item._count
    return acc
  }, {} as Record<HistoryCategory, number>)
}

/**
 * Excerpt 생성 (content에서 추출)
 */
export function generateExcerpt(content: string, maxLength = 150): string {
  // HTML 태그 제거
  const text = content.replace(/<[^>]*>/g, '')
  
  if (text.length <= maxLength) {
    return text
  }
  
  return text.slice(0, maxLength).trim() + '...'
}

/**
 * 날짜 포맷팅 (한국어)
 */
export function formatHistoryDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

/**
 * 상대 시간 포맷팅
 */
export function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
  return `${Math.floor(diffDays / 365)}년 전`
}