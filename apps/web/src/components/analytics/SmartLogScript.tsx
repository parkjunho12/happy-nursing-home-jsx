'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

/**
 * 스마트로그(부정클릭 방지/분석) — 마케팅 사이트에서만 로드.
 * 보호자 앨범(/family) 영역에서는 로드하지 않는다.
 */
export default function SmartLogScript() {
  const pathname = usePathname()
  if (pathname?.startsWith('/family')) return null

  return (
    <>
      <Script id="smartlog-init" strategy="afterInteractive">
        {`
          var hpt_info = {'_account':'UHPT-38356', '_server':'a31'};
        `}
      </Script>
      <Script
        id="smartlog-loader"
        src="//cdn.smlog.co.kr/core/smart.js"
        strategy="afterInteractive"
        charSet="utf-8"
      />
    </>
  )
}
