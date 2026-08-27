import type { Plugin } from 'vite'
import path from 'node:path'

/**
 * 화면 요소 → 소스 위치 연결 (개발/미리보기 전용).
 *
 * AI 페이지 편집기에서 화면의 버튼을 클릭하면 "이건 어느 파일 몇 줄인가"를
 * 알아야 한다. 그 답을 런타임에 추측할 방법은 없으므로, 빌드할 때
 * JSX 태그마다 출처를 붙여 둔다.
 *
 *   <button className="...">  →  <button data-src="src/pages/Foo.tsx:42:5" data-comp="Foo" ...>
 *
 * 왜 이 방식인가
 *  - React DevTools 의 내부 구조(_debugSource)에 기대면 React 버전이 오를 때 깨진다.
 *  - DOM 속성은 브라우저가 그대로 들고 있어, iframe 안에서 클릭 한 번으로 읽을 수 있다.
 *
 * 운영 빌드에는 절대 들어가지 않는다 — apply: 'serve' 와 환경변수로 두 번 잠근다.
 * 속성이 운영에 새면 소스 구조가 그대로 노출된다.
 */

import { injectSources } from './src/utils/inspectorTags'

const JSX_EXT = /\.[jt]sx$/

export function inspectorPlugin(): Plugin {
  return {
    name: 'happy-inspector',
    apply: 'serve',                       // 개발 서버에서만 — 운영 빌드에는 없다
    enforce: 'pre',

    transform(code, id) {
      if (process.env.VITE_INSPECTOR !== '1') return null
      if (!JSX_EXT.test(id.split('?')[0])) return null
      if (id.includes('node_modules')) return null

      const rel = path.relative(process.cwd(), id.split('?')[0]).replace(/\\/g, '/')
      // 이 파일이 내보내는 컴포넌트 이름 — 없으면 파일명으로 대신한다
      const comp =
        /export\s+default\s+function\s+([A-Z]\w*)/.exec(code)?.[1] ??
        /function\s+([A-Z]\w*)\s*\(/.exec(code)?.[1] ??
        path.basename(rel).replace(JSX_EXT, '')

      const r = injectSources(code, rel, comp)
      if (!r) return null
      return { code: r.code, map: null }
    },

    /** 미리보기 창에 넣는 것 둘 — 로그인 씨앗(먼저), Inspector(나중) */
    transformIndexHtml(html) {
      if (process.env.VITE_INSPECTOR !== '1') return html
      return {
        html,
        tags: [
          // 앱보다 먼저 돌아야 한다. type 을 주지 않은 인라인 스크립트는
          // 파싱 중에 그 자리에서 실행되므로, 모듈인 앱보다 확실히 앞선다.
          { tag: 'script', children: BOOT_AUTH_SRC, injectTo: 'head-prepend' },
          { tag: 'script', attrs: { type: 'module', src: '/@happy-inspector' },
            injectTo: 'body' },
        ],
      }
    },

    resolveId(id) {
      return id === '/@happy-inspector' ? '\0happy-inspector' : null
    },

    load(id) {
      if (id !== '\0happy-inspector') return null
      return INSPECTOR_SRC
    },
  }
}

/**
 * 로그인 씨앗 — 앱이 뜨기 전에 심는다.
 *
 * 미리보기는 admin 과 다른 출처(preview.도메인)라 저장소가 따로 논다.
 * 그래서 미리보기 안에서는 늘 로그인 화면만 보였다.
 *
 * 앱이 뜬 뒤에 postMessage 로 넘겨주는 것으로는 늦다. 라우트 감시가
 * 첫 렌더에서 곧바로 /login 으로 replace 해버려서, 뒤늦게 토큰을 심어도
 * 주소는 이미 /login 이다. 그래서 주소의 fragment 로 미리 실어 보내고,
 * 앱보다 먼저 도는 이 스크립트가 심는다.
 *
 * fragment(#) 를 쓰는 이유 — 서버로 전송되지 않는다. 접속 기록이나
 * Referer 에 토큰이 남지 않는다. 심은 뒤에는 주소창에서도 지운다.
 *
 * access_token 만으로는 부족하다. 이 앱은 부팅할 때 토큰을 확인하지 않고
 * 저장된 로그인 상태(auth-storage)만 보므로, 그것도 함께 심어야 한다.
 */
const BOOT_AUTH_SRC = /* js */ `
(function () {
  try {
    var m = /(?:^|#|&)__happy_auth=([^&]*)/.exec(location.hash || '')
    if (!m) return
    var d = JSON.parse(decodeURIComponent(m[1]))
    if (d.t) localStorage.setItem('access_token', d.t)
    else localStorage.removeItem('access_token')
    if (d.a) localStorage.setItem('auth-storage', d.a)
    // 주소창에 토큰이 남을 이유가 없다
    history.replaceState(null, '', location.pathname + location.search)
  } catch (e) { /* 씨앗이 없거나 깨졌으면 그냥 평소대로 — 로그인 화면이 뜬다 */ }
})()
`

/**
 * 미리보기 안에서 도는 코드.
 * 부모(Admin)와는 postMessage 로만 이야기한다 — 다른 창을 직접 만지지 않는다.
 */
const INSPECTOR_SRC = /* js */ `
const TAG = 'happy-inspector'
// 부모(Admin)의 출처. 첫 말을 들은 뒤로는 그쪽으로만 답한다.
// 아직 모를 때만 '*' 로 '나 떴다' 를 알린다 — 그 말에는 알맹이가 없다.
let host = null
let picking = false
let box = null
let label = null

function ensureUi() {
  if (box) return
  box = document.createElement('div')
  box.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483646',
    'border:2px solid #6366f1', 'background:rgba(99,102,241,0.12)',
    'border-radius:4px', 'transition:all .05s linear', 'display:none',
  ].join(';')
  label = document.createElement('div')
  label.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483647',
    'background:#4338ca', 'color:#fff', 'font:11px/1.5 system-ui',
    'padding:2px 6px', 'border-radius:4px', 'white-space:nowrap',
    'display:none', 'max-width:60vw', 'overflow:hidden', 'text-overflow:ellipsis',
  ].join(';')
  document.body.append(box, label)
}

/** 출처가 붙은 가장 가까운 조상을 찾는다 */
function pick(el) {
  let n = el
  while (n && n !== document.body) {
    if (n.getAttribute && n.getAttribute('data-src')) return n
    n = n.parentElement
  }
  return null
}

function describe(el) {
  const src = el.getAttribute('data-src') || ''
  const [file, line, column] = src.split(':')
  // 부모 쪽으로 올라가며 컴포넌트 이름을 모은다 — '어디에 있는 요소인지' 의 맥락
  const pathNames = []
  let n = el
  while (n && n !== document.body && pathNames.length < 8) {
    const c = n.getAttribute && n.getAttribute('data-comp')
    if (c && pathNames[pathNames.length - 1] !== c) pathNames.push(c)
    n = n.parentElement
  }
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const style = {}
  for (const k of ['color', 'backgroundColor', 'fontSize', 'fontWeight',
                   'display', 'flexDirection', 'padding', 'margin', 'borderRadius']) {
    style[k] = cs[k]
  }
  return {
    tag: el.tagName.toLowerCase(),
    componentName: el.getAttribute('data-comp') || null,
    componentPath: pathNames.reverse(),
    text: (el.innerText || '').trim().slice(0, 120),
    className: el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 300) : '',
    selector: buildSelector(el),
    sourceFile: file || null,
    line: line ? Number(line) : null,
    column: column ? Number(column) : null,
    pageUrl: location.pathname + location.search,
    style,
    boundingBox: { x: Math.round(r.x), y: Math.round(r.y),
                   width: Math.round(r.width), height: Math.round(r.height) },
  }
}

/** 사람이 읽을 수 있는 선택자 — 정확한 재현보다 '어디인지' 를 알아보는 용도 */
function buildSelector(el) {
  if (el.id) return '#' + el.id
  const parts = []
  let n = el
  while (n && n !== document.body && parts.length < 4) {
    let p = n.tagName.toLowerCase()
    const cls = String(n.className || '').split(/\\s+/).filter(Boolean).slice(0, 2)
    if (cls.length) p += '.' + cls.join('.')
    parts.unshift(p)
    n = n.parentElement
  }
  return parts.join(' > ')
}

function move(e) {
  if (!picking) return
  const el = pick(e.target)
  if (!el) { box.style.display = label.style.display = 'none'; return }
  const r = el.getBoundingClientRect()
  box.style.display = 'block'
  box.style.left = r.x + 'px'; box.style.top = r.y + 'px'
  box.style.width = r.width + 'px'; box.style.height = r.height + 'px'
  label.style.display = 'block'
  label.textContent = (el.getAttribute('data-comp') || el.tagName.toLowerCase())
    + ' · ' + (el.getAttribute('data-src') || '').split('/').pop()
  label.style.left = r.x + 'px'
  label.style.top = Math.max(0, r.y - 20) + 'px'
}

function click(e) {
  if (!picking) return
  const el = pick(e.target)
  if (!el) return
  e.preventDefault(); e.stopPropagation()
  reply({ type: 'picked', payload: describe(el) })
  setPicking(false)
}

function setPicking(on) {
  picking = on
  ensureUi()
  document.documentElement.style.cursor = on ? 'crosshair' : ''
  if (!on) { box.style.display = 'none'; label.style.display = 'none' }
  reply({ type: 'picking', payload: { on } })
}

/** 부모에게 답한다 — 출처를 알면 그쪽으로만 */
function reply(msg) {
  parent.postMessage({ source: TAG, ...msg }, host || '*')
}

/**
 * 이 말을 믿어도 되는 창인가.
 *
 * 로그인 토큰이 오가므로 아무 창의 말이나 들으면 안 된다. Admin 화면과
 * 개발용 로컬만 받아들인다. 앞단(Caddy)도 frame-ancestors 로 Admin 밖에서는
 * 이 화면을 품지 못하게 막지만, 여기서 한 겹 더 본다.
 */
function trusted(origin) {
  try {
    const u = new URL(origin)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
    return u.protocol === 'https:' && u.hostname.startsWith('admin.')
  } catch (_) { return false }
}

window.addEventListener('message', (e) => {
  const m = e.data
  if (!m || m.source !== TAG + '-host') return
  if (!trusted(e.origin)) return
  host = e.origin
  if (m.type === 'setPicking') setPicking(!!m.on)
  if (m.type === 'navigate' && m.path) location.href = m.path
  if (m.type === 'ping') {
    reply({ type: 'ready', payload: { url: location.pathname } })
  }
})

ensureUi()
document.addEventListener('mousemove', move, true)
document.addEventListener('click', click, true)
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPicking(false) })
// 부모에게 '나 떴다' 를 알린다 — 부모는 이걸 받고 나서 명령을 보낸다
reply({ type: 'ready', payload: { url: location.pathname } })
`
