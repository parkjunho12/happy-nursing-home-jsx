/**
 * Rate Limiter (속도 제한)
 * IP 기반으로 요청 횟수 제한
 * 
 * In-Memory 방식 (단순 서버용)
 * Production: Redis 사용 권장
 */

interface RateLimitEntry {
    count: number
    resetAt: number
  }
  
  // In-Memory 저장소
  const rateLimitStore = new Map<string, RateLimitEntry>()
  
  // 설정 (환경 변수에서 가져오기)
  const RATE_LIMIT_PER_MIN = parseInt(process.env.CHAT_RATE_LIMIT_PER_MIN || '10')
  const RATE_LIMIT_PER_DAY = parseInt(process.env.CHAT_RATE_LIMIT_PER_DAY || '100')
  
  /**
   * IP 주소 정규화
   */
  function normalizeIP(ip: string): string {
    // IPv6 형식을 IPv4로 변환
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7)
    }
    return ip
  }
  
  /**
   * Rate Limit 체크 (분 단위)
   */
  export function checkRateLimitPerMinute(ip: string): {
    allowed: boolean
    remaining: number
    resetAt: number
  } {
    const normalizedIP = normalizeIP(ip)
    const key = `${normalizedIP}:minute`
    const now = Date.now()
    const oneMinute = 60 * 1000
    
    const entry = rateLimitStore.get(key)
    
    // 기존 기록이 없거나 만료된 경우
    if (!entry || now > entry.resetAt) {
      const resetAt = now + oneMinute
      rateLimitStore.set(key, { count: 1, resetAt })
      return {
        allowed: true,
        remaining: RATE_LIMIT_PER_MIN - 1,
        resetAt
      }
    }
    
    // 제한 초과
    if (entry.count >= RATE_LIMIT_PER_MIN) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt
      }
    }
    
    // 카운트 증가
    entry.count++
    rateLimitStore.set(key, entry)
    
    return {
      allowed: true,
      remaining: RATE_LIMIT_PER_MIN - entry.count,
      resetAt: entry.resetAt
    }
  }
  
  /**
   * Rate Limit 체크 (일 단위)
   */
  export function checkRateLimitPerDay(ip: string): {
    allowed: boolean
    remaining: number
    resetAt: number
  } {
    const normalizedIP = normalizeIP(ip)
    const key = `${normalizedIP}:day`
    const now = Date.now()
    
    // 오늘 자정까지의 시간 계산
    const tomorrow = new Date()
    tomorrow.setHours(24, 0, 0, 0)
    const resetAt = tomorrow.getTime()
    
    const entry = rateLimitStore.get(key)
    
    // 기존 기록이 없거나 만료된 경우
    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt })
      return {
        allowed: true,
        remaining: RATE_LIMIT_PER_DAY - 1,
        resetAt
      }
    }
    
    // 제한 초과
    if (entry.count >= RATE_LIMIT_PER_DAY) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt
      }
    }
    
    // 카운트 증가
    entry.count++
    rateLimitStore.set(key, entry)
    
    return {
      allowed: true,
      remaining: RATE_LIMIT_PER_DAY - entry.count,
      resetAt: entry.resetAt
    }
  }
  
  /**
   * 전체 Rate Limit 체크 (분 + 일)
   */
  export function checkRateLimit(ip: string): {
    allowed: boolean
    reason?: string
    resetAt?: number
    remaining?: number
  } {
    // 1. 분 단위 체크
    const minuteLimit = checkRateLimitPerMinute(ip)
    if (!minuteLimit.allowed) {
      return {
        allowed: false,
        reason: '1분당 요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
        resetAt: minuteLimit.resetAt,
        remaining: 0
      }
    }
    
    // 2. 일 단위 체크
    const dayLimit = checkRateLimitPerDay(ip)
    if (!dayLimit.allowed) {
      return {
        allowed: false,
        reason: '오늘 요청 횟수를 모두 사용했습니다. 내일 다시 이용해주세요.',
        resetAt: dayLimit.resetAt,
        remaining: 0
      }
    }
    
    return {
      allowed: true,
      remaining: Math.min(minuteLimit.remaining, dayLimit.remaining)
    }
  }
  
  /**
   * 정리 (메모리 절약)
   * 주기적으로 만료된 항목 제거
   */
  export function cleanupExpiredEntries() {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    rateLimitStore.forEach((entry, key) => {
      if (now > entry.resetAt) {
        keysToDelete.push(key)
      }
    })
    
    keysToDelete.forEach(key => {
      rateLimitStore.delete(key)
    })
    
    return keysToDelete.length
  }
  
  // 10분마다 정리
  if (typeof window === 'undefined') {
    setInterval(() => {
      const cleaned = cleanupExpiredEntries()
      if (cleaned > 0) {
        console.log(`[Rate Limiter] Cleaned ${cleaned} expired entries`)
      }
    }, 10 * 60 * 1000)
  }
  
  /**
   * 클라이언트 IP 추출 (Next.js Request)
   */
  export function getClientIP(request: Request): string {
    // Vercel/Cloudflare 등의 프록시 헤더 확인
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim()
    }
    
    const realIP = request.headers.get('x-real-ip')
    if (realIP) {
      return realIP
    }
    
    // Fallback
    return 'unknown'
  }