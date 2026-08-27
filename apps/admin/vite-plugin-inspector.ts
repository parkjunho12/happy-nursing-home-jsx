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

const JSX_EXT = /\.[jt]sx$/

/** 여는 태그의 시작만 고른다. 닫는 태그(`</`)와 조각(`<>`)은 건너뛴다. */
const OPEN_TAG = /<([A-Za-z][\w.]*)(?=[\s/>])/g

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

      // 줄·칸을 세려면 오프셋을 좌표로 바꿔야 한다
      const lineStarts: number[] = [0]
      for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1)
      const posOf = (off: number) => {
        let lo = 0, hi = lineStarts.length - 1
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1
          if (lineStarts[mid] <= off) lo = mid; else hi = mid - 1
        }
        return { line: lo + 1, column: off - lineStarts[lo] + 1 }
      }

      let out = '', last = 0, hit = 0
      for (const m of code.matchAll(OPEN_TAG)) {
        const tag = m[1]
        const at = m.index! + m[0].length
        const { line, column } = posOf(m.index!)
        // 소문자로 시작하면 HTML 태그, 대문자면 컴포넌트다.
        // 컴포넌트에 붙이면 그 컴포넌트가 속성을 안 받을 수 있어 DOM 태그에만 붙인다.
        if (!/^[a-z]/.test(tag)) continue
        out += code.slice(last, at)
        out += ` data-src="${rel}:${line}:${column}" data-comp="${comp}"`
        last = at
        hit++
      }
      if (!hit) return null
      out += code.slice(last)
      return { code: out, map: null }
    },

    /** 미리보기 창에 Inspector 스크립트를 넣는다 */
    transformIndexHtml(html) {
      if (process.env.VITE_INSPECTOR !== '1') return html
      return {
        html,
        tags: [{
          tag: 'script',
          attrs: { type: 'module', src: '/@happy-inspector' },
          injectTo: 'body',
        }],
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
 * 미리보기 안에서 도는 코드.
 * 부모(Admin)와는 postMessage 로만 이야기한다 — 다른 창을 직접 만지지 않는다.
 */
const INSPECTOR_SRC = /* js */ `
const TAG = 'happy-inspector'
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
  parent.postMessage({ source: TAG, type: 'picked', payload: describe(el) }, '*')
  setPicking(false)
}

function setPicking(on) {
  picking = on
  ensureUi()
  document.documentElement.style.cursor = on ? 'crosshair' : ''
  if (!on) { box.style.display = 'none'; label.style.display = 'none' }
  parent.postMessage({ source: TAG, type: 'picking', payload: { on } }, '*')
}

window.addEventListener('message', (e) => {
  const m = e.data
  if (!m || m.source !== TAG + '-host') return
  if (m.type === 'setPicking') setPicking(!!m.on)
  if (m.type === 'navigate' && m.path) location.href = m.path
  if (m.type === 'ping') {
    parent.postMessage({ source: TAG, type: 'ready',
                         payload: { url: location.pathname } }, '*')
  }
})

ensureUi()
document.addEventListener('mousemove', move, true)
document.addEventListener('click', click, true)
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPicking(false) })
// 부모에게 '나 떴다' 를 알린다 — 부모는 이걸 받고 나서 명령을 보낸다
parent.postMessage({ source: TAG, type: 'ready', payload: { url: location.pathname } }, '*')
`
