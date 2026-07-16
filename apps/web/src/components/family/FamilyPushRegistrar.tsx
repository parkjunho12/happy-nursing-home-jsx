'use client'

import { useEffect } from 'react'
import { resolveApiBase } from '@/lib/api-client'

/**
 * 보호자 앱(WebView) 공통 FCM 토큰 등록기.
 * - family 레이아웃에 마운트 → 앨범/시설소식 등 어느 화면에서 로그인해도 토큰이 서버에 등록된다.
 * - 앱이 아니거나(브릿지 없음) 미로그인 상태면 조용히 대기했다가 준비되면 등록한다.
 * - 동일 토큰 중복 등록은 서버가 upsert 처리하므로 안전(재시도 포함).
 */
export default function FamilyPushRegistrar() {
  useEffect(() => {
    let done = false
    let tries = 0

    const register = async (): Promise<boolean> => {
      if (typeof window === 'undefined') return false
      const bridge = (window as any).NativeBridge
      if (!bridge || typeof bridge.getFcmToken !== 'function') return false // 앱 아님
      const jwt = localStorage.getItem('family_token')
      if (!jwt) return false // 아직 미로그인
      const fcm: string = bridge.getFcmToken() || ''
      if (!fcm) return false // 토큰 준비 전
      try {
        await fetch(`${resolveApiBase()}/api/v1/family/push/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ token: fcm, platform: 'android' }),
        })
        return true
      } catch {
        return false // 네트워크 실패 → 재시도
      }
    }

    // 즉시 1회 후, 로그인/토큰 준비 지연을 대비해 3초 간격으로 최대 10회 재시도
    const tick = async () => {
      if (done) return
      tries += 1
      if (await register()) { done = true; clearInterval(timer); return }
      if (tries >= 10) clearInterval(timer)
    }
    tick()
    const timer = setInterval(tick, 3000)
    return () => clearInterval(timer)
  }, [])

  return null
}
