'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { HistoryListItem, CATEGORY_CONFIG } from '@/types/history'
import { formatHistoryDate, getRelativeTime } from '@/lib/history'
import { Eye } from 'lucide-react'

interface HistoryCardProps {
  post: HistoryListItem
}

export default function HistoryCard({ post }: HistoryCardProps) {
  const categoryConfig = CATEGORY_CONFIG[post.category]

  return (
    <Link
      href={`/history/${post.slug}`}
      className="group block bg-white border-2 border-border-light rounded-3xl overflow-hidden hover:border-primary-orange hover:shadow-large transition-all duration-300 hover:-translate-y-2"
    >
      {/* Thumbnail */}
      {post.thumbnail ? (
        <div className="relative aspect-video overflow-hidden bg-gray-100">
          <Image
            src={post.thumbnail}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {/* Category Badge */}
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full text-sm font-semibold shadow-md">
            <span className="mr-1">{categoryConfig.emoji}</span>
            {categoryConfig.label}
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-accent-peach to-bg-cream flex items-center justify-center">
          <span className="text-6xl">{categoryConfig.emoji}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Date & Views */}
        <div className="flex items-center gap-4 text-sm text-text-gray mb-3">
          <time>{getRelativeTime(post.publishedAt)}</time>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {post.viewCount}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-primary-brown mb-2 line-clamp-2 group-hover:text-primary-orange transition-colors">
          {post.title}
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-text-gray text-sm leading-relaxed line-clamp-3 mb-4">
            {post.excerpt}
          </p>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-bg-cream text-xs font-medium text-primary-brown rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}