/**
 * 화면 요소에 출처(data-src)를 붙이는 규칙.
 *
 * vite 플러그인 본체에서 떼어냈다. 플러그인 파일은 vite 타입을 끌고 오는데,
 * 그러면 테스트에서 못 부른다. 그리고 이 규칙은 반드시 테스트가 있어야 한다 —
 * 한 번 틀리면 미리보기가 통째로 안 뜨기 때문이다.
 *
 * 실제로 한 번 그랬다. `useState<string>('')` 의 `<string>` 을 JSX 태그로 보고
 * 속성을 밀어 넣어, 117개 파일 중 61개가 파싱조차 되지 않았다.
 */

/**
 * 여는 태그의 시작만 고른다. 닫는 태그(`</`)와 조각(`<>`)은 건너뛴다.
 * 앞 글자를 함께 잡는 이유는 `looksLikeJsx` 를 보라.
 */
export const OPEN_TAG = /(^|[\s\S])<([A-Za-z][\w.]*)(?=[\s/>])/g

/**
 * 출처를 붙여도 되는 DOM 태그.
 *
 * '소문자로 시작하면 HTML 태그' 만으로는 안 된다 — `<string>` 도 소문자다.
 * 그래서 아는 태그에만 붙인다. 목록에 없으면 그냥 지나간다. 그 요소를 못
 * 고르게 될 뿐, 화면이 깨지지는 않는다. 모르는 것을 건드려 빌드를 부수는
 * 것보다 이쪽이 낫다.
 */
export const DOM_TAGS = new Set([
  // 문서·구획
  'html', 'head', 'body', 'div', 'span', 'main', 'header', 'footer', 'section',
  'article', 'aside', 'nav', 'address', 'hgroup', 'search',
  // 글
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'hr',
  'br', 'wbr', 'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'code', 'kbd',
  'samp', 'var', 'sub', 'sup', 'i', 'b', 'u', 'mark', 'ruby', 'rt', 'rp',
  'bdi', 'bdo', 'time', 'data', 'abbr', 'dfn',
  // 목록
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'menu',
  // 표
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  // 폼
  'form', 'label', 'input', 'button', 'select', 'datalist', 'optgroup', 'option',
  'textarea', 'output', 'progress', 'meter', 'fieldset', 'legend',
  // 미디어·삽입
  'img', 'picture', 'source', 'video', 'audio', 'track', 'map', 'area',
  'iframe', 'embed', 'object', 'param', 'canvas', 'figure', 'figcaption',
  // 상호작용·기타
  'details', 'summary', 'dialog', 'template', 'slot', 'noscript',
  'ins', 'del', 'script', 'style', 'link', 'meta', 'title', 'base',
  // SVG — 아이콘이 전부 이쪽이라 빼면 정작 눈에 보이는 것을 못 고른다
  'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'rect', 'defs', 'use', 'symbol', 'text', 'tspan', 'textPath', 'marker',
  'mask', 'pattern', 'clipPath', 'filter', 'linearGradient', 'radialGradient',
  'stop', 'foreignObject', 'animate', 'animateTransform',
])

/**
 * 앞 글자로 JSX 인지 제네릭인지 가른다.
 *
 * JSX 여는 태그 앞에는 식별자 글자가 오지 않는다 — `return <div>`,
 * `{cond && <p>`, `(<span>` 처럼 언제나 공백이나 기호가 앞에 온다.
 * 제네릭은 반대로 언제나 식별자 바로 뒤다 — `useState<`, `Record<`, `useRef<`.
 * 이 한 글자가 둘을 확실하게 가른다.
 */
export function looksLikeJsx(prev: string): boolean {
  if (prev === '') return true                 // 파일 맨 앞
  return !/[A-Za-z0-9_$)\].]/.test(prev)
}

/** 오프셋 → 줄·칸 */
function positioner(code: string) {
  const starts: number[] = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') starts.push(i + 1)
  return (off: number) => {
    let lo = 0, hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= off) lo = mid; else hi = mid - 1
    }
    return { line: lo + 1, column: off - starts[lo] + 1 }
  }
}

/**
 * DOM 태그마다 `data-src="파일:줄:칸" data-comp="컴포넌트"` 를 붙인다.
 * 붙일 게 없으면 null 을 준다(그대로 두라는 뜻).
 */
export function injectSources(
  code: string, rel: string, comp: string,
): { code: string; hits: number } | null {
  const posOf = positioner(code)
  let out = '', last = 0, hits = 0
  for (const m of code.matchAll(OPEN_TAG)) {
    const prev = m[1]                        // `<` 바로 앞 글자
    const tag = m[2]
    const at = m.index! + m[0].length        // 태그 이름 바로 뒤
    const lt = m.index! + prev.length        // `<` 의 자리
    if (!DOM_TAGS.has(tag)) continue
    if (!looksLikeJsx(prev)) continue
    const { line, column } = posOf(lt)
    out += code.slice(last, at)
    out += ` data-src="${rel}:${line}:${column}" data-comp="${comp}"`
    last = at
    hits++
  }
  if (!hits) return null
  return { code: out + code.slice(last), hits }
}
