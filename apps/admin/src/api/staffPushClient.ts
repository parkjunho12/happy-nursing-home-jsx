import { apiClient } from './client'

/**
 * 직원앱(WebView) FCM 토큰 등록.
 * - 네이티브 브릿지(NativeBridge / HappyCareNative)가 있을 때만 동작(앱 밖에선 no-op)
 * - 로그인(토큰 보유) 상태에서 호출
 */
export function registerStaffPush() {
  try {
    const w = window as any
    const bridge = w.NativeBridge || w.HappyCareNative
    const token: string | undefined = bridge?.getFcmToken?.()
    if (!token) return
    apiClient
      .post('/api/v1/staff/push/register', { token, platform: bridge?.getPlatform?.() ?? 'android' })
      .catch(() => {})
  } catch { /* 앱 밖이면 무시 */ }
}
