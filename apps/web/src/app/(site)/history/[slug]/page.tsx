import { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Tag, Eye, ChevronLeft, ChevronRight, Share2 } from 'lucide-react'

export const metadata: Metadata = {
  title: '히스토리 상세 | 행복한요양원 녹양역점',
}

export default function HistoryDetailPage({ params }: { params: { slug: string } }) {
  // 임시 데이터 (실제로는 API에서 가져옴)
  const post = {
    id: '1',
    title: '2024년 설날 특별 행사',
    slug: '2024-lunar-new-year',
    category: 'PROGRAM',
    categoryLabel: '프로그램',
    content: `
      <p>2024년 설날을 맞이하여 어르신들과 함께 특별한 시간을 보냈습니다.</p>
      
      <h2>행사 내용</h2>
      <p>이번 설날 행사는 어르신들께서 전통 명절의 의미를 되새기고 즐거운 시간을 보내실 수 있도록 다양한 프로그램으로 구성되었습니다.</p>
      
      <h3>1. 전통 떡국 나누기</h3>
      <p>아침 일찍부터 영양사님과 조리사님들이 정성껏 준비한 떡국을 모든 어르신들께 대접했습니다. 손수 빚은 떡으로 만든 따뜻한 떡국은 어르신들께 큰 호평을 받았습니다.</p>
      
      <h3>2. 전통 놀이 한마당</h3>
      <p>윷놀이, 제기차기, 투호 등 전통 놀이를 함께 즐겼습니다. 특히 윷놀이는 모든 어르신들께서 적극적으로 참여하셔서 웃음꽃이 피었습니다.</p>
      
      <h3>3. 복주머니 만들기</h3>
      <p>색색의 천과 실로 복주머니를 만드는 시간을 가졌습니다. 어르신들께서 직접 만드신 복주머니는 새해의 복을 담아 가족들께 선물하셨습니다.</p>
      
      <h2>어르신들의 반응</h2>
      <p>"예전 생각이 나서 너무 좋았어요. 우리 때는 이런 놀이를 많이 했는데..." - 김OO 어르신</p>
      <p>"떡국이 정말 맛있었어요. 가족들이랑 같이 먹는 것 같았어요." - 박OO 어르신</p>
      
      <h2>마무리</h2>
      <p>이번 설날 행사를 통해 어르신들께서 명절의 따뜻함을 느끼시고, 즐거운 추억을 만드실 수 있어서 의미 있는 시간이었습니다. 앞으로도 계속해서 다양한 프로그램을 준비하여 어르신들의 행복한 생활을 돕겠습니다.</p>
    `,
    publishedAt: '2024-02-10',
    viewCount: 145,
    tags: ['설날', '전통행사', '프로그램', '명절'],
  }

  const relatedPosts = [
    {
      id: '2',
      title: '크리스마스 특별 콘서트',
      slug: '2023-christmas-concert',
      publishedAt: '2023-12-25',
    },
    {
      id: '3',
      title: '가을 단풍 나들이',
      slug: '2023-autumn-outing',
      publishedAt: '2023-10-15',
    },
    {
      id: '6',
      title: '여름 특별 프로그램',
      slug: '2023-summer-program',
      publishedAt: '2023-07-15',
    },
  ]

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
            <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
              {post.categoryLabel}
            </span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <span>{new Date(post.publishedAt).toLocaleDateString('ko-KR')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              <span>조회 {post.viewCount}</span>
            </div>
            <button className="flex items-center gap-2 hover:text-primary-orange transition-colors">
              <Share2 className="w-5 h-5" />
              <span>공유하기</span>
            </button>
          </div>
        </div>
      </section>

      {/* Content */}
      <article className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Featured Image */}
          <div className="mb-12 rounded-2xl overflow-hidden">
            <div className="relative h-96 bg-gradient-to-br from-primary-orange/20 to-primary-green/20">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-9xl">📸</span>
              </div>
            </div>
          </div>

          {/* Post Content */}
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
            style={{
              lineHeight: '1.8',
            }}
          />

          {/* Tags */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex items-center gap-3 flex-wrap">
              <Tag className="w-5 h-5 text-gray-400" />
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-primary-orange hover:text-white transition-colors cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* Related Posts */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8 text-gray-900">
            관련 게시물
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.id}
                href={`/history/${relatedPost.slug}`}
                className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
              >
                <h3 className="font-bold text-gray-900 mb-2 group-hover:text-primary-orange transition-colors line-clamp-2">
                  {relatedPost.title}
                </h3>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(relatedPost.publishedAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Navigation */}
      <section className="py-8 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-2 text-gray-600 hover:text-primary-orange transition-colors">
              <ChevronLeft className="w-5 h-5" />
              <span>이전 글</span>
            </button>
            <Link
              href="/history"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              목록
            </Link>
            <button className="flex items-center gap-2 text-gray-600 hover:text-primary-orange transition-colors">
              <span>다음 글</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}