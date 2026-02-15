"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

export default function KakaoMap({
  lat,
  lng,
  level = 3,
}: {
  lat: number;
  lng: number;
  level?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key) return;

    const scriptId = "kakao-map-sdk";
    if (document.getElementById(scriptId)) {
      window.kakao.maps.load(() => {
        const map = new window.kakao.maps.Map(ref.current, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level,
        });
        new window.kakao.maps.Marker({
          map,
          position: new window.kakao.maps.LatLng(lat, lng),
        });
      });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.onload = () => {
      window.kakao.maps.load(() => {
        const map = new window.kakao.maps.Map(ref.current, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level,
        });
        new window.kakao.maps.Marker({
          map,
          position: new window.kakao.maps.LatLng(lat, lng),
        });
      });
    };
    document.head.appendChild(script);
  }, [lat, lng, level]);

  return <div ref={ref} className="w-full h-full" />;
}
