import { NextRequest, NextResponse } from 'next/server'
import { getHistoryPosts, getCategoryCount, getAvailableYears, getAllTags } from '@/lib/history'
import { HistoryCategory } from '@/types/history'

/**
 * GET /api/history
 * History 목록 조회 + 필터
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const category = searchParams.get('category') as HistoryCategory | null
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    const search = searchParams.get('search') || undefined
    const tag = searchParams.get('tag') || undefined
    const meta = searchParams.get('meta') === 'true'

    // 메타 정보 요청
    if (meta) {
      const [categoryCounts, years, tags] = await Promise.all([
        getCategoryCount(),
        getAvailableYears(),
        getAllTags(),
      ])

      return NextResponse.json({
        success: true,
        data: {
          categoryCounts,
          years,
          tags,
        },
      })
    }

    // 포스트 목록 조회
    const posts = await getHistoryPosts({
      category: category || undefined,
      year,
      month,
      search,
      tag,
    })

    return NextResponse.json({
      success: true,
      data: posts,
      count: posts.length,
    })
  } catch (error) {
    console.error('History API Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '히스토리를 불러오는 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}