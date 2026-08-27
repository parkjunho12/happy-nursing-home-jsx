import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateResidentForm } from '../src/utils/residentForm'
import { genderLabel, genderAvatarClass, genderUnknown } from '../src/utils/gender'

/**
 * 수급자 관리에서 실제로 났던 두 가지.
 *
 *  1) 간단 등록한 입소 예정자가 전부 '남' 으로 보였다.
 *     성별 입력이 아예 없어 빈 값으로 저장됐는데, 화면이 빈 값을 '남' 으로
 *     그렸다.
 *  2) 그 어르신들은 '수정' 을 눌러도 아무 일도 일어나지 않았다.
 *     생년월일이 비어 있으면 검사에서 조용히 return 했다. 예정자는 입소일이
 *     되면 그대로 입소자가 되므로, 입소자에서도 똑같이 먹통이었다.
 */

test('모르는 성별을 남자로 단정하지 않는다 — 예정자가 전부 남자로 보이던 버그', () => {
  assert.equal(genderLabel('female'), '여')
  assert.equal(genderLabel('male'), '남')
  // 간단 등록이 남기는 값들
  assert.equal(genderLabel(''), '—')
  assert.equal(genderLabel(null), '—')
  assert.equal(genderLabel(undefined), '—')
  // 뜻밖의 값도 남자로 만들지 않는다
  assert.equal(genderLabel('M'), '—')
  assert.equal(genderLabel('여'), '—')
})

test('모르는 성별은 분홍도 파랑도 아니다', () => {
  assert.match(genderAvatarClass('female'), /pink/)
  assert.match(genderAvatarClass('male'), /blue/)
  for (const g of ['', null, undefined, 'M']) {
    const c = genderAvatarClass(g)
    assert.match(c, /gray/, `모르면 회색이어야 한다: ${String(g)}`)
    assert.ok(!/pink|blue/.test(c))
  }
})

test('성별을 아는지 판별한다', () => {
  assert.equal(genderUnknown('female'), false)
  assert.equal(genderUnknown('male'), false)
  assert.equal(genderUnknown(''), true)
  assert.equal(genderUnknown(undefined), true)
})

test('수정할 때는 생년월일이 없어도 저장된다 — 수정 버튼이 먹통이던 버그', () => {
  // 간단 등록한 예정자: 이름만 있고 생년월일이 없다
  const 예정자 = { name: '홍길동', birthDate: '' }
  assert.equal(validateResidentForm(예정자, { isEdit: true }), null,
    '생년월일을 채우러 들어온 사람이 생년월일이 없어서 막히면 영영 못 채운다')
})

test('새로 등록할 때는 생년월일을 요구한다', () => {
  const r = validateResidentForm({ name: '홍길동', birthDate: '' }, { isEdit: false })
  assert.ok(r, '막아야 한다')
  assert.match(r!, /생년월일/)
})

test('막을 때는 반드시 이유를 돌려준다 — 조용히 끝내지 않는다', () => {
  const 경우들 = [
    [{ name: '', birthDate: '1930-01-01' }, { isEdit: false }],
    [{ name: '', birthDate: '1930-01-01' }, { isEdit: true }],
    [{ name: '   ', birthDate: '1930-01-01' }, { isEdit: true }],
    [{ name: '', birthDate: '' }, { isEdit: false }],
  ] as const
  for (const [f, o] of 경우들) {
    const r = validateResidentForm(f, o)
    assert.ok(r && r.length > 0,
      `이유 없이 막으면 안 된다: ${JSON.stringify(f)} ${JSON.stringify(o)}`)
  }
})

test('정상 입력은 통과한다', () => {
  assert.equal(validateResidentForm({ name: '홍길동', birthDate: '1930-01-01' }, { isEdit: false }), null)
  assert.equal(validateResidentForm({ name: '홍길동', birthDate: '1930-01-01' }, { isEdit: true }), null)
})

test('공백만 있는 이름은 이름으로 치지 않는다', () => {
  for (const blank of ['   ', '\t', '\n', ' \t\n ']) {
    assert.ok(validateResidentForm({ name: blank, birthDate: '1930-01-01' }, { isEdit: true }),
      `공백만 있는 이름은 막아야 한다: ${JSON.stringify(blank)}`)
  }
})
