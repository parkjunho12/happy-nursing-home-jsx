import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcrypt'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF'
}

/**
 * 로그인
 */
export async function login(email: string, password: string): Promise<AdminUser | null> {
  try {
    const admin = await prisma.admin.findUnique({
      where: { email, active: true },
    })

    if (!admin) return null

    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) return null

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    })

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    }
  } catch (error) {
    console.error('Login error:', error)
    return null
  }
}

/**
 * 세션 생성
 */
export async function createSession(user: AdminUser) {
  const sessionToken = Buffer.from(JSON.stringify(user)).toString('base64')

  cookies().set('admin-session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/', // ✅ /admin + /api/admin 둘 다 쿠키 받게
  })
}

/**
 * 세션 가져오기
 */
export async function getSession(): Promise<AdminUser | null> {
  try {
    const sessionToken = cookies().get('admin-session')?.value
    if (!sessionToken) return null

    return JSON.parse(Buffer.from(sessionToken, 'base64').toString())
  } catch {
    return null
  }
}

/**
 * 로그아웃
 */
export async function logout() {
  // ✅ path를 '/'로 저장했으니 지울 때도 명시하는게 안전
  cookies().set('admin-session', '', { path: '/', maxAge: 0 })
  // (delete만으로도 지워지긴 하는데, path 다르면 안 지워질 수 있음)
}

/**
 * 권한 체크
 */
export async function requireAuth(): Promise<AdminUser> {
  const user = await getSession()
  if (!user) throw new Error('Unauthorized')
  return user
}

/**
 * 역할 체크
 */
export function hasRole(user: AdminUser, roles: string[]): boolean {
  return roles.includes(user.role)
}
