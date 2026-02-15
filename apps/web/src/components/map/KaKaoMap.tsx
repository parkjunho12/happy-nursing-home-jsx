'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    kakao: any
  }
}

type KakaoMapProps = {
  lat: number
  lng: number
  level?: number
  markerTitle?: string
  height?: number | string
}

export default function KakaoMap({
  lat,
  lng,
  level = 8,
  markerTitle = '행복한요양원',
  height = 360,
}: KakaoMapProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null) // ✅ 클리핑 래퍼
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
    if (!appKey) {
      console.error('NEXT_PUBLIC_KAKAO_MAP_KEY is missing')
      return
    }

    const initMap = () => {
      if (!mapRef.current) return
      const kakao = window.kakao
      if (!kakao?.maps) return

      const center = new kakao.maps.LatLng(lat, lng)
      const options = { center, level }

      const map = new kakao.maps.Map(mapRef.current, options)
      mapInstanceRef.current = map

      // ✅ 지도 조작 전부 막기 (이동/줌/더블클릭줌)
      map.setDraggable(false)                // 드래그 이동 금지
      map.setZoomable(false)                 // 줌(휠/핀치/컨트롤) 금지
      const zoomControl = new kakao.maps.ZoomControl()
      map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT)
      const marker = new kakao.maps.Marker({
        position: center,
        title: markerTitle,
      })
      marker.setMap(map)

      setTimeout(() => {
        map.relayout()
        map.setCenter(center)
      }, 0)

      if (wrapperRef.current) {
          const ro = new ResizeObserver(() => {
            map.relayout()
            map.setCenter(center)
          })
          ro.observe(wrapperRef.current)
          // cleanup을 위해 mapInstance에 붙여둠
          ;(map as any).__ro = ro
        }
      
    }

    

    // 이미 로드되어 있으면 바로 초기화
    if (window.kakao?.maps?.load) {
      window.kakao.maps.load(initMap)
      return
    }

    // 스크립트 동적 로드 (autoload=false + load() 사용)
    const scriptId = 'kakao-map-sdk'
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => window.kakao.maps.load(initMap))
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.onload = () => window.kakao.maps.load(initMap)
    script.onerror = () => {
      console.error('Failed to load Kakao Map SDK')
      console.error('src =', script.src)
    
      // 네트워크 차단/정책 차단일 때 흔히 같이 뜸
      fetch(script.src, { method: 'GET', mode: 'no-cors' })
        .then(() => console.error('fetch: request sent (no-cors)'))
        .catch((err) => console.error('fetch error:', err))
    }
    document.head.appendChild(script)

    return () => {
      // 언마운트 시 특별히 제거할 건 없음(스크립트는 재사용)
      mapInstanceRef.current = null
    }
  }, [lat, lng, level, markerTitle])

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: '12px',
        overflow: 'hidden',      // ✅ 클리핑은 바깥에서
        position: 'relative',    // ✅ 컨트롤 기준 안정화
      }}
    >
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          touchAction: 'none',   // ✅ (선택) 모바일 핀치/드래그 억제
        }}
      />
    </div>
  )
}
