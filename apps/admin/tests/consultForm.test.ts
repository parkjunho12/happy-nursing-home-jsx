import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONSULT_FIELDS, CONSULT_SECTIONS, REQUIRED_KEYS, COUPLE_REQUIRED_KEYS, FIELD_BY_KEY,
  appendNote, consultMissing, consultTitle, filled, firstMissingKey, hasChip,
  isRequiredKey, sectionProgress, showValue, toggleChip, visibleSections, consultShareText,
  PRINT_KEY_FIELDS,
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


/* 부부 — 한 통화에서 두 분을 상담하지만 기록은 한 분에 한 장이다. */

test('부부가 아니면 부부 대목은 안 나온다', () => {
  assert.equal(visibleSections(false).some(s => s.key === 'couple'), false)
  assert.equal(visibleSections(true).some(s => s.key === 'couple'), true)
  // 부부 대목을 빼도 나머지 대목은 그대로다
  assert.equal(visibleSections(true).length, visibleSections(false).length + 1)
})

test('부부면 같은 방·합산 금액도 여쭐 것에 든다', () => {
  const full = Object.fromEntries(REQUIRED_KEYS.map(k => [k, '값']))
  assert.deepEqual(consultMissing(full, false), [])
  assert.deepEqual(consultMissing(full, true).map(f => f.key), [...COUPLE_REQUIRED_KEYS])
})

test('부부 필수 칸은 부부일 때만 필수로 표시한다', () => {
  assert.equal(isRequiredKey('couple_room', true), true)
  assert.equal(isRequiredKey('couple_room', false), false)
  assert.equal(isRequiredKey('grade', false), true)
  assert.equal(isRequiredKey('height_cm', true), false)
})

test('안 여쭌 첫 칸을 짚어준다 — 누르면 그리로 간다', () => {
  assert.equal(firstMissingKey({}), 'resident_name')
  assert.equal(firstMissingKey({ resident_name: '홍길동' }), 'gender')
  const full = Object.fromEntries(REQUIRED_KEYS.map(k => [k, '값']))
  assert.equal(firstMissingKey(full), null)
  assert.equal(firstMissingKey(full, true), 'couple_room')
})

test('대목마다 몇 칸이 찼는지 센다', () => {
  const head = CONSULT_SECTIONS[0]
  assert.deepEqual(sectionProgress({}, head), { done: 0, total: head.fields.length })
  const two = { [head.fields[0].key]: 'a', [head.fields[1].key]: 'b' }
  assert.equal(sectionProgress(two, head).done, 2)
})

test('값이 들어 있는지 — 0 과 공백을 가른다', () => {
  assert.equal(filled({ age: 0 }, 'age'), true)
  assert.equal(filled({ age: '' }, 'age'), false)
  assert.equal(filled({ age: '  ' }, 'age'), false)
  assert.equal(filled({}, 'age'), false)
})

test('빠르게 적기 — 특이사항 맨 뒤에 한 줄씩 쌓인다', () => {
  let v = appendNote('', '1인실 문의')
  assert.equal(v, '1인실 문의')
  v = appendNote(v, '목욕 거부하심')
  assert.equal(v, '1인실 문의\n목욕 거부하심')
  assert.equal(appendNote(v, '   '), v, '빈 줄은 안 쌓는다')
  assert.equal(appendNote(null, '첫 줄'), '첫 줄')
  assert.equal(appendNote('앞줄\n\n', '뒷줄'), '앞줄\n뒷줄', '끝의 빈 줄은 정리한다')
})


/* 카톡 공유 — 톡방은 시설 밖으로 나가는 길이다. 보낼 것과 안 보낼 것을 가른다. */

const FULL = {
  resident_name: '박순자', gender: '여', age: 84,
  grade: '3등급', benefit: '시설급여', copay: '감경 12%',
  living: '요양병원', mobility: '지팡이·워커', eating: '부분 도움',
  wish_date: '2026-10-05', status: 'visit',
  counselor: '김복지', consulted_on: '2026-09-19',
  guardian_phone: '010-1234-5678', address: '의정부시 녹양동',
  diagnosis: '알츠하이머 치매', behavior: '배회 · 공격성',
}

test('공유 글에 필요한 것이 담긴다', () => {
  const t = consultShareText(FULL)
  for (const v of ['박순자', '3등급', '시설급여', '감경 12%', '요양병원', '지팡이·워커', '희망 입소 10/05', '방문 예정', '김복지'])
    assert.ok(t.includes(v), `${v} 가 없다`)
})

test('연락처·주소·진단명·정신행동은 보내지 않는다', () => {
  const t = consultShareText(FULL)
  for (const v of ['010-1234-5678', '의정부시', '알츠하이머', '배회'])
    assert.ok(!t.includes(v), `${v} 가 새어나간다`)
  assert.ok(t.includes('관리자 「입소 상담」에서'), '어디를 보라는 안내가 없다')
})

test('부부면 배우자를 적는다', () => {
  assert.ok(consultShareText(FULL, { resident_name: '김철수' }).includes('배우자 김철수'))
  assert.ok(!consultShareText(FULL).includes('배우자'))
  assert.ok(!consultShareText(FULL, null).includes('배우자'))
})

test('배우자 성함을 아직 못 여쭸어도 부부라는 것은 알린다', () => {
  const t = consultShareText(FULL, { resident_name: null })
  assert.ok(t.includes('부부'), '부부라는 사실이 빠졌다')
  assert.ok(t.includes('성함 미상'))
})

test('빈 상담도 보낼 글이 된다 — 등급을 아직 모른다고 적는다', () => {
  const t = consultShareText({ status: 'open' })
  assert.ok(t.includes('성함 미상'))
  assert.ok(t.includes('등급 미확인'))
})

test('카카오 글자 수(200자)를 넘지 않는다', () => {
  const long = { ...FULL, resident_name: '가'.repeat(60), living: '나'.repeat(60), mobility: '다'.repeat(60) }
  assert.ok(consultShareText(long, { resident_name: '라'.repeat(40) }).length <= 200)
})


/* 진단명·건강검진 — 통화 중에 누를 수 있어야 하고, 고를 것이 적어야 한다 */

test('진단명은 눌러서 담는다 — 자주 있는 병과 기타', () => {
  const f = FIELD_BY_KEY.diagnosis
  assert.equal(f.type, 'chips')
  for (const d of ['치매', '당뇨', '고혈압', '저혈압', '고관절', '파킨슨', '척추질환', '기타'])
    assert.ok(f.options!.includes(d), `${d} 가 없다`)
  assert.equal(f.options![f.options!.length - 1], '기타', '기타는 맨 뒤')
})

test('진단명은 여러 개를 담을 수 있다', () => {
  let v = toggleChip('', '치매')
  v = toggleChip(v, '고혈압')
  assert.equal(v, '치매 · 고혈압')
  assert.equal(hasChip(v, '당뇨'), false)
})

test('건강검진은 세 가지만 고른다 — 검진 메모 칸은 없앴다', () => {
  const f = FIELD_BY_KEY.checkup
  assert.deepEqual(f.options, ['안내함', '완료', '해당 없음'])
  assert.equal(FIELD_BY_KEY.checkup_note, undefined)
})


/* 방문 권유 — 전화만으로 정하시는 분은 드물다. 이 통화의 목적이다. */

test('방문 권유 칸이 있고 꼭 여쭐 것에 든다', () => {
  const f = FIELD_BY_KEY.visit_plan
  assert.ok(f, '방문 상담 칸이 없다')
  assert.deepEqual(f.options, ['날짜 잡음', '권유함', '어려워하심', '아직'])
  assert.ok(FIELD_BY_KEY.visit_date, '방문 예정일 칸이 없다')
  assert.equal(isRequiredKey('visit_plan'), true)
})

test('마무리 대목 멘트가 방문을 권한다', () => {
  const sec = CONSULT_SECTIONS.find(s => s.key === 'next')!
  assert.ok(sec.script.includes('오셔서'), '오시라는 말이 없다')
  assert.ok(/언제|날|시간/.test(sec.script), '언제 오실지 묻지 않는다')
  assert.equal(sec.key_point, true, '눈에 띄어야 하는 대목이다')
})

test('방문 날짜가 잡히면 공유 글에도 적힌다', () => {
  const t = consultShareText({ ...FULL, visit_date: '2026-10-02' })
  assert.ok(t.includes('방문 10/02'))
})

/* 종이 — 집어 든 사람이 3초 안에 읽어야 하는 것 */

test('맨 위 띠에 낼 칸은 모두 실재하고, 결정에 필요한 것들이다', () => {
  for (const k of PRINT_KEY_FIELDS) assert.ok(FIELD_BY_KEY[k], `${k} 가 표에 없다`)
  for (const k of ['grade', 'benefit', 'copay', 'guardian_phone'])
    assert.ok((PRINT_KEY_FIELDS as readonly string[]).includes(k), `${k} 가 띠에 없다`)
  assert.equal(PRINT_KEY_FIELDS.length, 5, '띠가 길어지면 한 칸씩 좁아져 커 보이지 않는다')
})
