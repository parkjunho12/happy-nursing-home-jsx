import { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Tag, Eye, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '히스토리 | 행복한요양원 녹양역점',
  description: '행복한요양원의 다양한 활동과 소식을 확인하세요.',
}

export default function HistoryPage() {
  // 임시 데이터 (실제로는 API에서 가져옴)
  const posts = [
    {
      id: '1',
      title: '2024년 설날 특별 행사',
      slug: '2024-lunar-new-year',
      category: 'PROGRAM',
      categoryLabel: '프로그램',
      excerpt: '온 가족이 함께한 즐거운 설날 행사. 떡국 나누기, 윷놀이, 복주머니 만들기 등 다양한 활동을 진행했습니다.',
      publishedAt: '2024-02-10',
      imageUrl: null,
      viewCount: 145,
    },
    {
      id: '2',
      title: '크리스마스 특별 콘서트',
      slug: '2023-christmas-concert',
      category: 'EVENT',
      categoryLabel: '행사',
      excerpt: '지역 합창단을 초대하여 따뜻한 크리스마스 캐럴 콘서트를 진행했습니다. 어르신들께서 함께 노래 부르시며 즐거운 시간을 보내셨습니다.',
      publishedAt: '2023-12-25',
      imageUrl: null,
      viewCount: 198,
    },
    {
      id: '3',
      title: '가을 단풍 나들이',
      slug: '2023-autumn-outing',
      category: 'PROGRAM',
      categoryLabel: '프로그램',
      excerpt: '아름다운 가을 단풍을 감상하며 인근 공원으로 나들이를 다녀왔습니다. 어르신들께서 신선한 공기를 마시며 행복한 시간을 보내셨습니다.',
      publishedAt: '2023-10-15',
      imageUrl: null,
      viewCount: 176,
    },
    {
      id: '4',
      title: '건강 검진 실시',
      slug: '2023-health-checkup',
      category: 'NEWS',
      categoryLabel: '소식',
      excerpt: '전 입소자 대상 정기 건강 검진을 실시했습니다. 전문 의료진이 방문하여 종합 건강 상태를 점검했습니다.',
      publishedAt: '2023-09-01',
      imageUrl: null,
      viewCount: 132,
    },
    {
      id: '5',
      title: '자원봉사자 방문',
      slug: '2023-volunteer-visit',
      category: 'VOLUNTEER',
      categoryLabel: '봉사활동',
      excerpt: '지역 대학교 봉사 동아리가 방문하여 어르신들과 함께 즐거운 시간을 보냈습니다. 함께 노래하고 이야기 나누며 따뜻한 시간이었습니다.',
      publishedAt: '2023-08-20',
      imageUrl: null,
      viewCount: 89,
    },
    {
      id: '6',
      title: '여름 특별 프로그램',
      slug: '2023-summer-program',
      category: 'PROGRAM',
      categoryLabel: '프로그램',
      excerpt: '무더운 여름, 시원한 수박 파티와 부채 만들기, 물놀이 등 다양한 여름 특별 프로그램을 진행했습니다.',
      publishedAt: '2023-07-15',
      imageUrl: null,
      viewCount: 203,
    },
  ]

  const categories = [
    { value: 'ALL', label: '전체', count: posts.length },
    { value: 'PROGRAM', label: '프로그램', count: 3 },
    { value: 'EVENT', label: '행사', count: 1 },
    { value: 'NEWS', label: '소식', count: 1 },
    { value: 'VOLUNTEER', label: '봉사활동', count: 1 },
  ]

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'PROGRAM':
        return 'bg-blue-100 text-blue-700'
      case 'EVENT':
        return 'bg-purple-100 text-purple-700'
      case 'NEWS':
        return 'bg-green-100 text-green-700'
      case 'VOLUNTEER':
        return 'bg-orange-100 text-orange-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-brown to-primary-orange text-white py-20">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            히스토리
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
            행복한요양원의 다양한 활동과<br />
            따뜻한 이야기들을 확인하세요
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category.value}
                className="px-6 py-3 bg-white border-2 border-gray-300 rounded-full font-semibold text-gray-700 hover:border-primary-orange hover:text-primary-orange transition-colors"
              >
                {category.label} ({category.count})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/history/${post.slug}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Image */}
                <div className="relative h-48 bg-gradient-to-br from-primary-orange/20 to-primary-green/20 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl">📸</span>
                  </div>
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(post.category)}`}>
                      {post.categoryLabel}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-primary-orange transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(post.publishedAt).toLocaleDateString('ko-KR')}</span>
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
            ))}
          </div>

          {/* Load More */}
          <div className="mt-12 text-center">
            <button className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors">
              더 보기
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}