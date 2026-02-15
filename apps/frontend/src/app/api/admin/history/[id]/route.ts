import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/admin/history/[id]
 * 히스토리 게시물 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()

    const body = await request.json()
    const {
      title,
      category,
      content,
      excerpt,
      tags,
      author,
      isPublished,
    } = body

    // 기존 게시물 확인
    const existing = await prisma.historyPost.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: '게시물을 찾을 수 없습니다',
        },
        { status: 404 }
      )
    }

    // 업데이트
    const post = await prisma.historyPost.update({
      where: { id: params.id },
      data: {
        title,
        category,
        content,
        excerpt,
        tags,
        author,
        isPublished,
        publishedAt: isPublished && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
    })

    return NextResponse.json({
      success: true,
      message: '게시물이 수정되었습니다',
      data: post,
    })
  } catch (error) {
    console.error('Update history error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '게시물 수정 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/history/[id]
 * 히스토리 게시물 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()

    // 게시물 확인
    const post = await prisma.historyPost.findUnique({
      where: { id: params.id },
    })

    if (!post) {
      return NextResponse.json(
        {
          success: false,
          message: '게시물을 찾을 수 없습니다',
        },
        { status: 404 }
      )
    }

    // 삭제
    await prisma.historyPost.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: '게시물이 삭제되었습니다',
    })
  } catch (error) {
    console.error('Delete history error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '게시물 삭제 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}