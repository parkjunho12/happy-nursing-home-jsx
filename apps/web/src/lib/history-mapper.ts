// src/lib/history-mapper.ts
import type { HistoryPost, HistoryListItem, HistoryCategory } from '@/types/history'

export type HistoryResponseRaw = {
  id: string
  title: string
  slug: string
  category?: string | null
  content?: string | null
  excerpt?: string | null
  thumbnail?: string | null
  tags?: string[] | null
  author?: string | null
  view_count?: number | null
  is_published?: boolean | null
  published_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const ALLOWED: HistoryCategory[] = ['NOTICE', 'PROGRAM', 'MEAL', 'FACILITY', 'FAMILY', 'ARCHIVE']

function toCategory(v?: string | null): HistoryCategory {
  const u = (v || '').toUpperCase()
  return (ALLOWED as string[]).includes(u) ? (u as HistoryCategory) : 'ARCHIVE'
}

function toDate(s?: string | null): Date | null {
  return s ? new Date(s) : null
}

export function toHistoryPost(r: HistoryResponseRaw): HistoryPost {
  const createdAt = toDate(r.created_at) ?? new Date()
  const updatedAt = toDate(r.updated_at) ?? createdAt
  const publishedAt = toDate(r.published_at)

  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    category: toCategory(r.category),
    content: r.content ?? '',
    excerpt: r.excerpt ?? undefined,
    thumbnail: r.thumbnail ?? undefined,
    tags: r.tags ?? [],
    author: r.author ?? undefined,
    viewCount: r.view_count ?? 0,
    isPublished: r.is_published ?? false,
    publishedAt,
    createdAt,
    updatedAt,
  }
}

export function toHistoryListItem(p: HistoryPost): HistoryListItem {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    category: p.category,
    excerpt: p.excerpt,
    thumbnail: p.thumbnail,
    tags: p.tags,
    publishedAt: p.publishedAt ?? p.createdAt,
    viewCount: p.viewCount,
  }
}