import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'
import { getHistoryPostBySlug, getRelatedPosts } from '@/lib/history'
import { CATEGORY_CONFIG } from '@/types/history'
import { formatHistoryDate } from '@/lib/history'
import HistoryCard from '@/components/history/HistoryCard'
import { ArrowLeft, Calendar, Eye, Tag } from 'lucide-react'

interface HistoryDetailPageProps {
  params: {
    slug: string
  }
}

// Generate metadata
export async function generateMetadata({
  params,
}: HistoryDetailPageProps): Promise<Metadata> {
  const post = await getHistoryPostBySlug(params.slug)

  if (!post || !post.isPublished) {
    return {
      title: '게시물을 찾을 수 없습니다',
    }
  }

  return {
    title: `${post.title} | 행복한요양원`,
    description: post.excerpt || post.content.slice(0, 160),
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      images: post.thumbnail ? [post.thumbnail] : undefined,
    },
  }
}

export default async function HistoryDetailPage({
  params,
}: HistoryDetailPageProps) {
  const post = await getHistoryPostBySlug(params.slug)

  if (!post || !post.isPublished) {
    notFound()
  }

  const relatedPosts = await getRelatedPosts(params.slug, post.category, 3)
  const categoryConfig = CATEGORY_CONFIG[post.category]

  return (
    <div className="min-h-screen bg-bg-cream pt-20">
      {/* Header */}
      <div className="bg-white border-b border-border-light">
        <div className="max-w-[900px] mx-auto px-6 py-8">
          {/* Back Button */}
          <Link
            href="/history"
            className="inline-flex items-center gap-2 text-primary-brown hover:text-primary-orange transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">목록으로</span>
          </Link>

          {/* Category Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-bg-cream rounded-full text-sm font-semibold text-primary-brown mb-4">
            <span>{categoryConfig.emoji}</span>
            {categoryConfig.label}
          </div>

          {/* Title */}
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary-brown mb-6">
            {post.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-text-gray">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {post.publishedAt && formatHistoryDate(post.publishedAt)}
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              조회 {post.viewCount}
            </div>
            {post.author && (
              <div className="flex items-center gap-2">
                <span>작성자:</span>
                {post.author}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[900px] mx-auto px-6 py-12">
        <article className="bg-white rounded-3xl border-2 border-border-light overflow-hidden">
          {/* Thumbnail */}
          {post.thumbnail && (
            <div className="relative aspect-video">
              <Image
                src={post.thumbnail}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Content */}
          <div className="p-8 md:p-12">
            <div
              className="prose prose-lg max-w-none
                prose-headings:font-serif prose-headings:text-primary-brown
                prose-p:text-text-dark prose-p:leading-relaxed
                prose-a:text-primary-orange prose-a:no-underline hover:prose-a:underline
                prose-img:rounded-2xl prose-img:shadow-md
                prose-strong:text-primary-brown
                prose-blockquote:border-l-4 prose-blockquote:border-primary-orange prose-blockquote:pl-6 prose-blockquote:italic"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="px-8 md:px-12 pb-8">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-5 h-5 text-text-gray" />
                <span className="font-semibold text-primary-brown">태그</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/history?tag=${encodeURIComponent(tag)}`}
                    className="px-4 py-2 bg-bg-cream hover:bg-primary-orange/10 text-primary-brown hover:text-primary-orange rounded-full text-sm font-medium transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-16">
            <h2 className="font-serif text-2xl font-bold text-primary-brown mb-8">
              관련 게시물
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <HistoryCard key={relatedPost.id} post={relatedPost} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-primary-orange to-accent-lightOrange text-white font-semibold rounded-full hover:shadow-lg transition-all"
          >
            상담 신청하기
          </Link>
        </div>
      </div>
    </div>
  )
}