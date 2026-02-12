import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { sendEmail, renderContactRepliedEmail } from '@/lib/notify/email'
import { sendSms } from '@/lib/notify/sms'

/**
 * GET /api/admin/contacts/[id]
 * 상담 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()

    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
    })

    if (!contact) {
      return NextResponse.json(
        { success: false, message: '상담을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    console.error('Get contact error:', error)
    // ✅ Unauthorized면 401로 주는게 맞음 (디버깅/UX)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { success: false, message: '상담 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/contacts/[id]
 * 상담 답변 및 상태 변경 + (옵션) 고객 알림 발송
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const { reply, status } = await request.json()

    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
    })

    if (!contact) {
      return NextResponse.json(
        { success: false, message: '상담을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const nextReply = typeof reply === 'string' ? reply : ''
    const nextStatus = typeof status === 'string' ? status : contact.status

    // ✅ 중복발송 방지 기준:
    // - reply가 "이번에 처음으로" 등록되는 순간만 발송
    const isFirstReply =
      nextReply.trim().length > 0 && (contact.reply ?? '').trim().length === 0

    const updated = await prisma.contact.update({
      where: { id: params.id },
      data: {
        reply: nextReply,
        status: nextStatus,
        repliedBy: nextReply.trim().length > 0 ? user.name : contact.repliedBy,
        repliedAt:
          nextReply.trim().length > 0 && !contact.repliedAt
            ? new Date()
            : contact.repliedAt,
      },
    })

    // ✅ (A) 답변 알림 발송: "처음 답변 등록" 때만
    if (!isFirstReply) {
      // 이메일(이메일 있는 경우만)
      if (updated.email) {
        try {
          await sendEmail({
            to: contact.email,
            subject: `[행복한요양원] 상담 답변 안내 (${updated.id})`,
            html: renderContactRepliedEmail({
              name: updated.name,
              inquiryType: updated.inquiryType,
              message: updated.message,
              reply: updated.reply ?? '',
              ticketId: updated.id,
              repliedBy: updated.repliedBy,
            }),
          })
        } catch (e) {
          console.error('Email send failed:', e)
          // ✅ 발송 실패해도 저장은 성공 처리(운영 안정성)
        }
      }

      // 문자(항상 보내려면, 번호가 있으니 가능)
      // try {
      //   await sendSms({
      //     to: updated.phone,
      //     content: `[행복한요양원] 상담 답변이 등록되었습니다. 접수번호: ${updated.id}. (자세한 내용은 이메일을 확인해주세요)`,
      //   })
      // } catch (e) {
      //   console.error('SMS send failed:', e)
      // }
    } 

    return NextResponse.json({
      success: true,
      message: isFirstReply
        ? '상담이 업데이트되었고 고객에게 알림을 발송했습니다'
        : '상담이 업데이트되었습니다',
      data: updated,
    })
  } catch (error) {
    console.error('Update contact error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { success: false, message: '상담 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
