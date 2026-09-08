import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { isChunkLoadError } from '@/components/ChunkGuard'

/**
 * 배포 뒤 옛 파일을 못 받는 경우를 화면 그리기 전에 먼저 잡는다.
 *
 * Vite 는 다음 화면을 미리 받아두려다 실패하면 'vite:preloadError' 를 낸다.
 * 이때는 아직 화면이 안 깨졌으므로, 여기서 조용히 다시 불러오면 사용자는
 * 하얀 화면을 아예 보지 않는다. (ChunkGuard 는 그래도 새는 경우를 받는다)
 *
 * 한 번만 한다 — 계속 실패하는 상황에서 무한히 새로고침하면 화면이 영영
 * 안 뜬다. 두 번째부터는 ChunkGuard 가 안내를 띄운다.
 */
const RELOAD_KEY = 'chunkGuard.reloadedAt'
const COOLDOWN_MS = 20_000

function recoverOnce() {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  if (Date.now() - last < COOLDOWN_MS) return false
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  window.location.reload()
  return true
}

window.addEventListener('vite:preloadError', e => {
  e.preventDefault()          // 기본 동작(오류 던지기)을 막고 우리가 처리한다
  recoverOnce()
})

// 화면 그리는 중이 아닐 때 난 실패도 받는다 (라우터가 미리 부르는 경우 등)
window.addEventListener('unhandledrejection', e => {
  if (isChunkLoadError(e.reason)) {
    e.preventDefault()
    recoverOnce()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
