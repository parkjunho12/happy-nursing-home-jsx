import { useEffect, useState } from 'react'

/** CSS 미디어쿼리 구독 훅 (SSR-safe, addEventListener 폴백 포함) */
export function useMediaQuery(query: string): boolean {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false

  const [matches, setMatches] = useState(get)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    // Safari < 14
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [query])

  return matches
}

/** Tailwind `md` 브레이크포인트(768px) 미만 = 모바일 */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')

export default useMediaQuery
