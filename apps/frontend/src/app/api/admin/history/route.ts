import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/history
 * 새 히스토리 게시물 생성
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    await requireAuth()

    const body = await request.json()
    const {
      title,
      category,
      content,
      excerpt,
      tags = [],
      author = '관리자',
      isPublished = false,
      slug,
    } = body

    // 필수 필드 검증
    if (!title || !category || !content) {
      return NextResponse.json(
        {
          success: false,
          message: '제목, 카테고리, 내용은 필수입니다',
        },
        { status: 400 }
      )
    }

    // 히스토리 생성
    const post = await prisma.historyPost.create({
      data: {
        title,
        category,
        content,
        excerpt: excerpt || content.replace(/<[^>]*>/g, '').substring(0, 150),
        tags,
        author,
        isPublished,
        slug,
        publishedAt: isPublished ? new Date() : null,
      },
    })

    return NextResponse.json({
      success: true,
      message: '게시물이 생성되었습니다',
      data: post,
    })
  } catch (error) {
    console.error('Create history error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '게시물 생성 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}