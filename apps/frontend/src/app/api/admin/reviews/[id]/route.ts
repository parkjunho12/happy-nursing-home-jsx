import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/admin/reviews/[id]
 * 후기 상태 변경 (승인, 추천, 인증)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()

    const body = await request.json()

    // 후기 확인
    const review = await prisma.review.findUnique({
      where: { id: params.id },
    })

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          message: '후기를 찾을 수 없습니다',
        },
        { status: 404 }
      )
    }

    // 업데이트
    const updated = await prisma.review.update({
      where: { id: params.id },
      data: {
        ...body,
      },
    })

    return NextResponse.json({
      success: true,
      message: '후기가 업데이트되었습니다',
      data: updated,
    })
  } catch (error) {
    console.error('Update review error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '후기 업데이트 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/reviews/[id]
 * 후기 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()

    // 후기 확인
    const review = await prisma.review.findUnique({
      where: { id: params.id },
    })

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          message: '후기를 찾을 수 없습니다',
        },
        { status: 404 }
      )
    }

    // 삭제
    await prisma.review.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: '후기가 삭제되었습니다',
    })
  } catch (error) {
    console.error('Delete review error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '후기 삭제 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}