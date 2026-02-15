import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateContactForm, sanitizeFormData } from '@/lib/validation'
import type { ContactFormData } from '@/types'
import { sendEmail, renderContactReceivedEmail } from '@/lib/notify/email'
import { sendSms } from '@/lib/notify/sms'

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json()

    const validation = validateContactForm(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: '입력 데이터가 유효하지 않습니다', errors: validation.errors },
        { status: 400 }
      )
    }

    const data = sanitizeFormData(body)
    const inquiryType = (data as any).inquiryType?.trim() || '기타'

    const created = await prisma.contact.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        inquiryType,
        message: data.message,
        ipAddress: request.headers.get('x-forwarded-for') ?? request.ip ?? null,
        userAgent: request.headers.get('user-agent') ?? null,
        referrer: request.headers.get('referer') ?? null,
      },
    })

    // ✅ (A) 접수 확인 이메일: 이메일 있는 경우만
    if (created.email) {
      await sendEmail({
        to: created.email,
        subject: `[행복한요양원] 상담 신청이 접수되었습니다 (${created.id})`,
        html: renderContactReceivedEmail({
          name: created.name,
          inquiryType: created.inquiryType,
          message: created.message,
          ticketId: created.id,
        }),
      })
    }

    // ✅ (B) 접수 확인 문자: 짧게(권장)
    // 필요 없으면 이 블록 제거
    // await sendSms({
    //   to: created.phone,
    //   content: `[행복한요양원] 상담 접수 완료. 접수번호: ${created.id}. 24시간 이내 연락드리겠습니다.`,
    // })

    return NextResponse.json(
      {
        success: true,
        message: '상담 신청이 접수되었습니다',
        data: {
          id: created.id,
          estimatedResponseTime: '24시간 이내',
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Contact API Error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
