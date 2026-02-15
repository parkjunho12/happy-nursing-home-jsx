import { NextResponse } from 'next/server'
import { logout } from '@/lib/auth'

export async function POST() {
  try {
    await logout()

    return NextResponse.json({
      success: true,
      message: '로그아웃 되었습니다',
    })
  } catch (error) {
    console.error('Logout API Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '로그아웃 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}