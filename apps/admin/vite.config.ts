import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { inspectorPlugin } from './vite-plugin-inspector'

export default defineConfig({
  // 배포 확인용 빌드 시각 — '운영에 어떤 버전이 떠 있나'를 화면에서 바로 본다
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  // inspectorPlugin 은 VITE_INSPECTOR=1 일 때만 동작하고 운영 빌드에는 들어가지 않는다.
  // AI 페이지 편집기의 미리보기에서 화면 요소 → 소스 위치를 잇는 데 쓴다.
  plugins: [react(), inspectorPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.PORT) || 3001,
    host: true,            // 0.0.0.0 바인딩 → 에뮬레이터(10.0.2.2)·실기기(LAN IP)에서 접근 가능
    allowedHosts: true,    // 외부 Host(10.0.2.2 등) 차단("Blocked request") 해제 — 로컬 테스트용
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8010',
        changeOrigin: true,
      },
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react'],
          charts: ['recharts'],
        },
      },
    },
  },
})