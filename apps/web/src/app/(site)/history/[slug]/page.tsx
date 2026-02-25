import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Calendar,
  Tag,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { getHistoryPost, getPublishedHistory } from '@/lib/api-client'
import { CATEGORY_CONFIG, type HistoryCategory } from '@/types/history'
import ShareButton from './_components/ShareButton'

type PageParams = { slug: string }

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(
  { params }: { params: PageParams }
): Promise<Metadata> {
  return {
    title: `히스토리 상세 | 행복한요양원 녹양역점`,
  }
}

type HistoryDetailRaw = {
  id: string
  title: string
  slug: string
  category: HistoryCategory | string
  content: string
  excerpt?: string | null
  thumbnail?: string | null
  tags?: string[] | null
  publishedAt?: string | null
  viewCount?: number | null
}

type HistoryListItemRaw = {
  id: string
  title: string
  slug: string
  category: HistoryCategory | string
  excerpt?: string | null
  thumbnail?: string | null
  tags?: string[] | null
  publishedAt?: string | null
  viewCount?: number | null
}

function toDateSafe(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function normalizeCategory(v: any): HistoryCategory {
  const key = String(v || '').toUpperCase()
  return Object.prototype.hasOwnProperty.call(CATEGORY_CONFIG, key)
    ? (key as HistoryCategory)
    : 'ARCHIVE'
}

function colorClass(category: HistoryCategory) {
  switch (CATEGORY_CONFIG[category].color) {
    case 'orange':
      return 'bg-orange-100 text-orange-700'
    case 'green':
      return 'bg-green-100 text-green-700'
    case 'brown':
      return 'bg-amber-100 text-amber-800'
    case 'blue':
      return 'bg-blue-100 text-blue-700'
    case 'pink':
      return 'bg-pink-100 text-pink-700'
    case 'gray':
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export default async function HistoryDetailPage({ params }: { params: PageParams }) {
  const slug = params.slug

  // ✅ 1) 상세 호출 (백엔드에서 조회수 증가)
  const detailRes = await getHistoryPost<HistoryDetailRaw>(slug)
  if (!detailRes.success || !detailRes.data) return notFound()

  const raw = detailRes.data

  const category = normalizeCategory(raw.category)
  const cfg = CATEGORY_CONFIG[category]

  const publishedAt = toDateSafe(raw.publishedAt)
  const viewCount = raw.viewCount ?? 0
  const tags = raw.tags ?? []
  const thumbnail = raw.thumbnail ?? null

  // ✅ 2) related posts (목록 1회 호출)
  const listRes = await getPublishedHistory<HistoryListItemRaw[]>()
  const relatedPosts =
    listRes.success && Array.isArray(listRes.data)
      ? listRes.data
          .filter((x) => x.slug !== slug)
          .filter((x) => normalizeCategory(x.category) === category)
          .sort(
            (a, b) =>
              (toDateSafe(b.publishedAt)?.getTime() ?? 0) -
              (toDateSafe(a.publishedAt)?.getTime() ?? 0)
          )
          .slice(0, 3)
      : []

  const html = (raw.content || '').trim() || `<p>본문이 준비 중입니다.</p>`

  return (
    <div className="min-h-screen pt-20">
      {/* Header */}
      <section className="py-12 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/history"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-orange transition-colors mb-8"
          >
            <ChevronLeft className="w-5 h-5" />
            목록으로 돌아가기
          </Link>

          <div className="mb-6">
            <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${colorClass(category)}`}>
              {cfg.label}
            </span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
            {raw.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <span>{publishedAt ? publishedAt.toLocaleDateString('ko-KR') : '날짜 미정'}</span>
            </div>

            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              <span>조회 {viewCount}</span>
            </div>

            {/* ✅ client component */}
            <ShareButton title={raw.title} />
          </div>
        </div>
      </section>

      {/* Content */}
      <article className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Featured Image */}
          <div className="mb-12 rounded-2xl overflow-hidden">
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt={raw.title}
                className="w-full h-96 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="relative h-96 bg-gradient-to-br from-primary-orange/20 to-primary-green/20">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-9xl">{cfg.emoji}</span>
                </div>
              </div>
            )}
          </div>

          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ lineHeight: '1.8' }}
          />

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center gap-3 flex-wrap">
                <Tag className="w-5 h-5 text-gray-400" />
                {tags.map((t, index) => (
                  <Link
                    key={`${t}-${index}`}
                    href={`/history?tag=${encodeURIComponent(t)}`}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-primary-orange hover:text-white transition-colors"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-8 text-gray-900">관련 게시물</h2>

            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((p) => {
                const d = toDateSafe(p.publishedAt)
                return (
                  <Link
                    key={p.id}
                    href={`/history/${p.slug}`}
                    className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                  >
                    <h3 className="font-bold text-gray-900 mb-2 group-hover:text-primary-orange transition-colors line-clamp-2">
                      {p.title}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{d ? d.toLocaleDateString('ko-KR') : '날짜 미정'}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Navigation placeholder */}
      <section className="py-8 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 inline-flex items-center gap-2">
              <ChevronLeft className="w-5 h-5" />
              이전 글
            </span>

            <Link
              href="/history"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              목록
            </Link>

            <span className="text-gray-400 inline-flex items-center gap-2">
              다음 글
              <ChevronRight className="w-5 h-5" />
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}