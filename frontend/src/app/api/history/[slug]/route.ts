import { NextRequest, NextResponse } from 'next/server'
import { getHistoryPostBySlug, getRelatedPosts } from '@/lib/history'

/**
 * GET /api/history/[slug]
 * History 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    const post = await getHistoryPostBySlug(slug)

    if (!post) {
      return NextResponse.json(
        {
          success: false,
          message: '게시물을 찾을 수 없습니다',
        },
        { status: 404 }
      )
    }

    if (!post.isPublished) {
      return NextResponse.json(
        {
          success: false,
          message: '비공개 게시물입니다',
        },
        { status: 403 }
      )
    }

    // 연관 포스트 조회
    const relatedPosts = await getRelatedPosts(slug, post.category, 3)

    return NextResponse.json({
      success: true,
      data: {
        post,
        relatedPosts,
      },
    })
  } catch (error) {
    console.error('History Detail API Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '게시물을 불러오는 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}