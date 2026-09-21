import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONSULT_FIELDS, CONSULT_SECTIONS, REQUIRED_KEYS, FIELD_BY_KEY,
  consultMissing, consultTitle, hasChip, showValue, toggleChip,
} from '../src/utils/consultForm'

/* 상담 기록지는 통화하면서 채우는 표다. 화면과 종이가 같은 목록을 읽어야
   항목이 하나 늘 때 한쪽만 늘어나는 일이 없다. */

test('칸 이름이 겹치지 않는다 — 겹치면 한 칸이 다른 칸을 덮어쓴다', () => {
  const keys = CONSULT_FIELDS.map(f => f.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('고르는 칸에는 보기가 있고, 보기가 겹치지 않는다', () => {
  for (const f of CONSULT_FIELDS) {
    if (f.type === 'choice' || f.type === 'chips') {
      assert.ok(f.options && f.options.length > 1, `${f.key} 보기 없음`)
      assert.equal(new Set(f.options).size, f.options!.length, `${f.key} 보기 중복`)
    }
  }
})

test('모든 대목에 멘트가 있다 — 처음 받는 사람이 보는 줄이다', () => {
  for (const s of CONSULT_SECTIONS) {
    assert.ok(s.script.length > 10, `${s.key} 멘트 없음`)
    assert.ok(s.fields.length > 0, `${s.key} 칸 없음`)
  }
})

test('꼭 여쭐 것은 모두 실재하는 칸이다', () => {
  for (const k of REQUIRED_KEYS) assert.ok(FIELD_BY_KEY[k], `${k} 가 표에 없다`)
})

test('덜 여쭌 것을 짚어준다', () => {
  assert.equal(consultMissing({}).length, REQUIRED_KEYS.length)
  const full = Object.fromEntries(REQUIRED_KEYS.map(k => [k, '값']))
  assert.deepEqual(consultMissing(full), [])
  assert.deepEqual(consultMissing({ ...full, guardian_phone: '  ' }).map(f => f.key), ['guardian_phone'])
})

test('연령 0 은 빈칸이 아니다 — 숫자 0 을 빈칸으로 치면 안 된다', () => {
  const full: Record<string, any> = Object.fromEntries(REQUIRED_KEYS.map(k => [k, '값']))
  full.age = 0
  assert.deepEqual(consultMissing(full), [])
})

test('여러 개 고르기 — 누르면 담기고 다시 누르면 빠진다', () => {
  let v = toggleChip('', '배회')
  assert.equal(v, '배회')
  v = toggleChip(v, '우울')
  assert.equal(v, '배회 · 우울')
  assert.equal(hasChip(v, '우울'), true)
  v = toggleChip(v, '배회')
  assert.equal(v, '우울')
  assert.equal(hasChip(v, '배회'), false)
  assert.equal(toggleChip(v, '우울'), '')
})

test('손으로 덧붙인 말은 건드리지 않는다', () => {
  const v = toggleChip('배회 · 새벽 3시쯤 나가려 하심', '배회')
  assert.equal(v, '새벽 3시쯤 나가려 하심')
})

test('빈 값과 공백은 무시한다', () => {
  assert.equal(toggleChip(null, '우울'), '우울')
  assert.equal(toggleChip('  ·  ', '우울'), '우울')
})

test('목록 제목 — 성함이 없어도 줄이 비지 않는다', () => {
  assert.equal(consultTitle({ resident_name: '홍길동', gender: '여', age: 85 }), '홍길동 어르신 (여 · 85세)')
  assert.equal(consultTitle({ resident_name: '홍길동' }), '홍길동 어르신')
  assert.equal(consultTitle({ gender: '남' }), '성함 미상 (남)')
  assert.equal(consultTitle({}), '성함 미상')
  assert.equal(consultTitle(null), '성함 미상')
})

test('종이에서 빈칸은 —, 단위는 붙여서', () => {
  const age = FIELD_BY_KEY.age
  assert.equal(showValue({ age: 85 }, age), '85세')
  assert.equal(showValue({}, age), '—')
  assert.equal(showValue({ age: '  ' }, age), '—')
  assert.equal(showValue({ resident_name: '홍길동' }, FIELD_BY_KEY.resident_name), '홍길동')
})
