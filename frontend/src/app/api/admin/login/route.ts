import { NextRequest, NextResponse } from 'next/server'
import { login, createSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      )
    }

    const user = await login(email, password)

    if (!user) {
      return NextResponse.json(
        { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      )
    }

    // ✅ 중요: route handler에서 cookies()로 set하려면
    // createSession이 next/headers cookies()를 쓰는 형태여야 함(너가 올린 형태면 OK)
    await createSession(user)

    return NextResponse.json({
      success: true,
      message: '로그인 성공',
      user: { name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('Login API Error:', error)
    return NextResponse.json(
      { success: false, message: '로그인 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
