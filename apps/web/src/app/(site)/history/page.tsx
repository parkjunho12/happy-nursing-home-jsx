import { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Eye, ChevronRight } from 'lucide-react'

import { getPublishedHistory } from '@/lib/api-client'
import { CATEGORY_CONFIG, type HistoryCategory } from '@/types/history'
import { toHistoryPost, toHistoryListItem, type HistoryResponseRaw } from '@/lib/history-mapper'
import Image from 'next/image'
export const metadata: Metadata = {
  title: '블로그 | 행복한요양원 녹양역점',
  description: '행복한요양원의 다양한 활동과 소식을 확인하세요.',
}

type SearchParams = {
  page?: string
  category?: string
}

const PAGE_SIZE = 12

function isHistoryCategory(v?: string): v is HistoryCategory {
  if (!v) return false
  return Object.prototype.hasOwnProperty.call(CATEGORY_CONFIG, v)
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

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const currentPage = Math.max(1, Number(searchParams.page || '1') || 1)

  const currentCategory: 'ALL' | HistoryCategory =
    isHistoryCategory(searchParams.category) ? searchParams.category : 'ALL'

  // ✅ API는 한 번만 호출
  const res = await getPublishedHistory<HistoryResponseRaw[]>()
  console.log('History API Response:', res)

  const allPosts = (res.success && Array.isArray(res.data) ? res.data : [])
    .map(toHistoryPost)
    // public endpoint면 사실상 필요 없지만 안전장치
    // .filter((x) => x.isPublished)
    // 최신순
    .sort((a, b) => {
      const ta = (a.publishedAt ?? a.createdAt).getTime()
      const tb = (b.publishedAt ?? b.createdAt).getTime()
      return tb - ta
    })

  // ✅ 카테고리별 count는 “한 번 가져온 데이터”에서 계산
  const categoryCounts = allPosts.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, {})
  const totalCount = allPosts.length

  // ✅ 필터 적용
  const filtered = currentCategory === 'ALL'
    ? allPosts
    : allPosts.filter((p) => p.category === currentCategory)

  // ✅ pagination (프론트에서 슬라이스)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  const pageItems = filtered
    .slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    .map(toHistoryListItem)

  const categories = [
    { value: 'ALL' as const, label: '전체', count: totalCount },
    ...(Object.keys(CATEGORY_CONFIG) as HistoryCategory[]).map((k) => ({
      value: k,
      label: CATEGORY_CONFIG[k].label,
      count: categoryCounts[k] || 0,
    })),
  ]

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}

      <section className="relative overflow-hidden">
        <div className="relative h-[120px] sm:h-[180px] lg:h-[320px]">
          <Image
            src="/assets/images/introduce-2.png"
            alt="행복한요양원 녹양역점 시설 소개 배경 이미지"
            fill
            priority
            quality={92}
            className="object-cover object-center"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,28,38,0.30)_0%,rgba(18,28,38,0.18)_34%,rgba(18,28,38,0.08)_62%,rgba(18,28,38,0.03)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.03)_0%,rgba(0,0,0,0.06)_100%)]" />
        </div>

        <div className="absolute inset-0 z-10 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10">
            <div className="max-w-3xl">

              <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-7xl">
              따뜻한 소식들
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8 lg:text-xl">
              행복한요양원의 다양한 활동과
                <br className="hidden sm:block" />
                따뜻한 이야기들을 확인하세요
              </p>

            </div>
          </div>
        </div>
      </section>

      {/* Categories Filter */}
      <section className="py-8 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => {
              const href =
                cat.value === 'ALL'
                  ? '/history'
                  : `/history?category=${cat.value}`

              const active = currentCategory === cat.value

              return (
                <Link
                  key={cat.value}
                  href={href}
                  className={`px-6 py-3 rounded-full font-semibold transition-all ${
                    active
                      ? 'bg-primary-orange text-white shadow-md'
                      : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-primary-orange hover:text-primary-orange'
                  }`}
                >
                  {cat.label} ({cat.count})
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {!res.success && (
            <div className="bg-white rounded-2xl p-6 text-gray-700">
              블로그를 불러오지 못했습니다. {res.message || ''}
            </div>
          )}

          {pageItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg">아직 게시글이 없습니다</p>
              <p className="text-gray-400 text-sm mt-2">
                곧 다양한 소식을 전해드리겠습니다
              </p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {pageItems.map((post) => {
                  const cfg = CATEGORY_CONFIG[post.category]
                  return (
                    <Link
                      key={post.id}
                      href={`/history/${post.slug}`}
                      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                      {/* Image */}
                      <div className="relative h-48 overflow-hidden">
                        {post.thumbnail ? (
                          // next/image로 바꾸면 더 좋음 (추후)
                          <img
                            src={post.thumbnail}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-orange/20 to-primary-green/20 flex items-center justify-center">
                            <span className="text-6xl">{cfg.emoji}</span>
                          </div>
                        )}

                        {/* Category Badge */}
                        <div className="absolute top-4 left-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorClass(post.category)}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-primary-orange transition-colors line-clamp-2">
                          {post.title}
                        </h3>

                        {post.excerpt && (
                          <p className="text-gray-600 mb-4 line-clamp-2 text-sm">
                            {post.excerpt}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{post.publishedAt.toLocaleDateString('ko-KR')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            <span>{post.viewCount}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-primary-orange font-semibold group-hover:gap-3 transition-all">
                            자세히 보기
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  {safePage > 1 && (
                    <Link
                      href={
                        currentCategory === 'ALL'
                          ? `/history?page=${safePage - 1}`
                          : `/history?page=${safePage - 1}&category=${currentCategory}`
                      }
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:border-primary-orange hover:text-primary-orange transition-colors"
                    >
                      이전
                    </Link>
                  )}

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= safePage - 1 && pageNum <= safePage + 1)
                    ) {
                      const href =
                        currentCategory === 'ALL'
                          ? `/history?page=${pageNum}`
                          : `/history?page=${pageNum}&category=${currentCategory}`

                      return (
                        <Link
                          key={pageNum}
                          href={href}
                          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                            pageNum === safePage
                              ? 'bg-primary-orange text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:border-primary-orange hover:text-primary-orange'
                          }`}
                        >
                          {pageNum}
                        </Link>
                      )
                    }
                    if (pageNum === safePage - 2 || pageNum === safePage + 2) {
                      return <span key={pageNum} className="px-2">...</span>
                    }
                    return null
                  })}

                  {safePage < totalPages && (
                    <Link
                      href={
                        currentCategory === 'ALL'
                          ? `/history?page=${safePage + 1}`
                          : `/history?page=${safePage + 1}&category=${currentCategory}`
                      }
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:border-primary-orange hover:text-primary-orange transition-colors"
                    >
                      다음
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}