/**
 * 권한 유틸 — null-safe
 * user.position이 string | null 모두 허용
 */
export type RoleUser = {
  role?:     string | null
  position?: string | null
}

/** ADMIN 또는 사회복지사 → 보호자 계정 관리 가능 */
export function canManageFamilyAccounts(user: RoleUser | null): boolean {
  return user?.role === 'ADMIN' || user?.position === '사회복지사'
}

/** STAFF + 요양보호사 → 앨범 업로드만 가능 */
export function isCaregiverOnly(user: RoleUser | null): boolean {
  return user?.role === 'STAFF' && user?.position === '요양보호사'
}
