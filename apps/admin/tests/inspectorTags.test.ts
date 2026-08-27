import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectSources, looksLikeJsx, DOM_TAGS } from '../src/utils/inspectorTags'

/**
 * 미리보기가 통째로 안 뜬 적이 있다.
 *
 *   useState<string>('')  →  useState<string data-src="..." data-comp="X">('')
 *   ERROR: Expected ";" but found "data"
 *
 * `<string>` 이 소문자로 시작한다는 이유로 JSX 태그 취급을 받았다. 이 저장소만
 * 117개 tsx 중 61개가 파싱조차 안 됐다. 규칙을 고쳤으니, 다시 그러지 않도록
 * 여기서 붙잡아 둔다.
 */

const inject = (code: string) => injectSources(code, 'f.tsx', 'X')?.code ?? code

test('제네릭 타입 인자에는 붙이지 않는다 — 미리보기를 깨뜨린 그 버그', () => {
  const 제네릭들 = [
    "const [a, setA] = useState<string>('')",
    'const [n, setN] = useState<number>(0)',
    'const r = useRef<number | null>(null)',
    'const m = useMemo<Record<string, any>>(() => ({}), [])',
    'const x: Array<string> = []',
    'const y = new Map<string, number>()',
    'const z = fn<boolean>(true)',
    'let q: Promise<void>',
    'const w = useState<unknown>(null)',
    'const v = useState<object>({})',
  ]
  for (const src of 제네릭들) {
    assert.equal(inject(src), src, `건드리면 안 된다: ${src}`)
  }
})

test('진짜 DOM 태그에는 붙인다', () => {
  const out = inject('return <div className="a"><span>안녕</span></div>')
  assert.match(out, /<div data-src="f\.tsx:1:8" data-comp="X" className/)
  assert.match(out, /<span data-src="f\.tsx:1:\d+" data-comp="X">/)
})

test('붙일 게 없으면 null 을 돌려준다', () => {
  assert.equal(injectSources('const a = 1', 'f.tsx', 'X'), null)
  assert.equal(injectSources('const [a] = useState<string>("")', 'f.tsx', 'X'), null)
})

test('대문자 컴포넌트에는 붙이지 않는다 — 속성을 안 받을 수 있다', () => {
  const src = 'return <MyThing a={1} />'
  assert.equal(inject(src), src)
})

test('닫는 태그와 조각은 건드리지 않는다', () => {
  const out = inject('return <><p>가</p></>')
  assert.equal((out.match(/data-src/g) || []).length, 1, 'p 하나에만 붙어야 한다')
  assert.ok(!out.includes('</p data-src'), '닫는 태그에 붙었다')
})

test('앞 글자로 JSX 와 제네릭을 가른다', () => {
  // JSX 앞에 오는 것들
  for (const p of [' ', '\n', '(', '{', '>', '&', '=', ',', '?', ':', '']) {
    assert.equal(looksLikeJsx(p), true, `JSX 여야 한다: ${JSON.stringify(p)}`)
  }
  // 제네릭 앞에 오는 것들 — 언제나 식별자 끝
  for (const p of ['e', 'f', 'Z', '0', '_', '$', ')', ']', '.']) {
    assert.equal(looksLikeJsx(p), false, `제네릭이어야 한다: ${p}`)
  }
})

test('HTML 태그 이름이면서 제네릭인 경우도 앞 글자로 걸러진다', () => {
  // td·a·i 는 진짜 HTML 태그다. 목록만으로는 못 거른다.
  const src = 'const c = useRef<td>(null)'
  assert.equal(inject(src), src)
})

test('아이콘(SVG)도 고를 수 있어야 한다', () => {
  const out = inject('return <svg><path d="M0 0" /></svg>')
  assert.match(out, /<svg data-src=/)
  assert.match(out, /<path data-src=/)
})

test('줄·칸은 태그 시작(`<`) 자리를 가리킨다', () => {
  //          1234567
  const out = inject('a\nb\n  <p>x</p>')
  assert.match(out, /<p data-src="f\.tsx:3:3"/)
})

test('목록에 없는 소문자 태그는 조용히 지나간다 — 부수는 것보다 낫다', () => {
  const src = 'return <weird-thing a={1} />'
  assert.equal(inject(src), src)
  assert.ok(!DOM_TAGS.has('weird-thing'))
})
