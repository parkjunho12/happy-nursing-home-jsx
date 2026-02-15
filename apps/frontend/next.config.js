// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
  
    images: {
      formats: ["image/avif", "image/webp"],
      // ⚠️ hostname: '**' 는 너무 광범위해서 권장되지 않음.
      // 필요 도메인만 허용하는 게 안전하고, 경고/예외를 줄임.
      remotePatterns: [
        {
          protocol: "https",
          hostname: "images.unsplash.com",
        },
        {
          protocol: "https",
          hostname: "cdn.pixabay.com",
        }
        // 필요하면 여기에 추가
        // { protocol: "https", hostname: "your-cdn.com" }
      ],
    },
  
    experimental: {
      // Next 14에서 optimizeCss는 환경에 따라 문제 생길 수 있음.
      // 필요 없으면 끄는 게 안정적.
      // optimizeCss: true,
    },
  
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            { key: "X-DNS-Prefetch-Control", value: "on" },
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
          ],
        },
      ];
    },
  };
  
  module.exports = nextConfig;
  