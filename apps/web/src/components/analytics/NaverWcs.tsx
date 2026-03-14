'use client'

import Script from 'next/script'

export default function NaverWcs() {
  return (
    <Script
      id="naver-wcs"
      src="https://wcs.naver.net/wcslog.js"
      strategy="afterInteractive"
      onLoad={() => {
        const w = window as typeof window & {
          wcs?: {
            inflow: (host?: string) => void
          }
          wcs_add?: Record<string, string>
          _nasa?: Record<string, unknown>
          wcs_do?: () => void
        }

        w.wcs_add = w.wcs_add || {}
        w.wcs_add['wa'] = 's_53d5b4f75c34'
        w._nasa = w._nasa || {}

        if (w.wcs) {
          w.wcs.inflow(window.location.hostname)
        }

        if (typeof w.wcs_do === 'function') {
          w.wcs_do()
        }
      }}
    />
  )
}