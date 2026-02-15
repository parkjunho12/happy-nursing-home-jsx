import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/contacts
 * 상담 목록 조회 (검색/필터/페이지네이션)
 *
 * Query:
 * - q: string (이름/이메일/전화/내용 검색)
 * - status: NEW | IN_PROGRESS | DONE | ... (네 enum에 맞게)
 * - page: number (default 1)
 * - pageSize: number (default 20, max 100)
 * - sort: newest|oldest (default newest)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'STAFF'])) {
      return NextResponse.json({ success: false, message: '권한이 없습니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') ?? '').trim()
    const status = (searchParams.get('status') ?? '').trim()
    const sort = (searchParams.get('sort') ?? 'newest').trim()

    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const pageSizeRaw = Number(searchParams.get('pageSize') ?? '20') || 20
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw))

    const where: any = {}

    if (status) where.status = status

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        // 필요하면 추가: { reply: { contains: q, mode: 'insensitive' } },
      ]
    }

    const orderBy =
      sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : { createdAt: 'desc' as const }

    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          createdAt: true,
          repliedAt: true,
          repliedBy: true,
          // message는 리스트에서 길 수 있으니 snippet 처리하거나 제외 가능
          message: true,
        },
      }),
      prisma.contact.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (e) {
    console.error('List contacts error:', e)
    return NextResponse.json(
      { success: false, message: '상담 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
