/**
 * 카카오톡 공유 (오픈채팅방 공지용)
 *
 * ⚠ 카카오는 오픈채팅방에 서버가 자동으로 글을 올리는 API를 공식 지원하지 않는다.
 *    유일하게 안정적·합법적인 방법 = 사용자가 공유 시트에서 방을 직접 고르는 "공유(Share)".
 *    이 모듈은 카카오 JavaScript SDK 의 Share.sendDefault 를 감싼다.
 *
 * 준비물 (설정 1회):
 *   1) developers.kakao.com 에서 앱 생성 → JavaScript 키 발급
 *   2) [앱 설정 > 플랫폼 > Web] 에 관리자 도메인 등록 (예: https://admin.행복한요양원.kr)
 *   3) [제품 설정 > 카카오톡 공유] 활성화
 *   4) 관리자 앱 .env 에  VITE_KAKAO_JS_KEY=발급받은_JS_키   추가
 */

const JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY || ''
// 공유 카드가 여는 링크(웹) — 등록된 도메인이어야 함. 없으면 현재 origin.
const SHARE_LINK =
  import.meta.env.VITE_KAKAO_SHARE_LINK ||
  (typeof window !== 'undefined' ? window.location.origin : '')
const SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

/** SDK 사용 가능 여부 = JS 키가 설정돼 있는가 */
export const isKakaoShareEnabled = (): boolean => !!JS_KEY

declare global {
  interface Window { Kakao?: any }
}

let loadPromise: Promise<void> | null = null

/** SDK 스크립트 1회 주입 + init */
function ensureKakao(): Promise<void> {
  if (!JS_KEY) return Promise.reject(new Error('VITE_KAKAO_JS_KEY 가 설정되지 않았습니다.'))
  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    const init = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(JS_KEY)
        resolve()
      } catch (e) { reject(e) }
    }
    if (window.Kakao) return init()

    const s = document.createElement('script')
    s.src = SDK_SRC
    s.async = true
    s.onload = init
    s.onerror = () => { loadPromise = null; reject(new Error('카카오 SDK 로드 실패')) }
    document.head.appendChild(s)
  })
  return loadPromise
}

export interface ShareNoticeInput {
  title: string
  content?: string | null
  level?: 'info' | 'important' | 'urgent'
  link?: string          // 카드 클릭 시 열 URL (기본 SHARE_LINK)
}

const LEVEL_PREFIX: Record<string, string> = { urgent: '[긴급] ', important: '[중요] ', info: '' }

/**
 * 공지를 카카오톡 공유창으로 띄운다. (사용자가 오픈채팅방을 선택해 전송)
 * SDK가 없거나 데스크톱이면 공유창 대신 실패할 수 있으므로 호출측에서 catch 처리.
 */
export async function shareNotice(n: ShareNoticeInput): Promise<void> {
  await ensureKakao()
  const url = n.link || SHARE_LINK
  const title = `${LEVEL_PREFIX[n.level ?? 'info'] ?? ''}공지 · ${n.title}`.trim()
  const desc = (n.content || '').trim() || '행복한요양원 공지사항입니다.'

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title,
      description: desc.length > 400 ? desc.slice(0, 399) + '…' : desc,
      imageUrl: (() => { try { return new URL('/assets/logo/logo.png', url).toString() } catch { return `${SHARE_LINK.replace(/\/$/, '')}/assets/logo/logo.png` } })(),
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '자세히 보기', link: { mobileWebUrl: url, webUrl: url } }],
  })
}

/** 공유 링크로 텍스트만 간단히 보내는 대체 경로(카드 이미지 불필요) */
export async function shareText(text: string, link?: string): Promise<void> {
  await ensureKakao()
  const url = link || SHARE_LINK
  window.Kakao.Share.sendDefault({
    objectType: 'text',
    text: text.length > 190 ? text.slice(0, 189) + '…' : text,
    link: { mobileWebUrl: url, webUrl: url },
  })
}

