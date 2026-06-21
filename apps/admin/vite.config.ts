import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: true,            // 0.0.0.0 바인딩 → 에뮬레이터(10.0.2.2)·실기기(LAN IP)에서 접근 가능
    allowedHosts: true,    // 외부 Host(10.0.2.2 등) 차단("Blocked request") 해제 — 로컬 테스트용
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
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