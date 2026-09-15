import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SUSPICIOUS_IP_RESPONSE_NOTICE,
  buildSuspiciousIPsCsv,
  keepVerifiedSuspiciousIPFields,
} from '../src/utils/suspiciousIPs'

const API_PAYLOAD_WITH_UNVERIFIED_DETAILS = [{
  ip_hash: 'abcdef0123456789...',
  click_count: 42,
  last_click: '2026-09-15T05:30:00',
  source_breakdown: { naver: 31 },
  recent_clicks: [{ timestamp: '2026-09-15T05:29:00', source: 'naver' }],
  user_agents: ['fabricated-user-agent'],
  pages: ['/fabricated-page'],
  arbitrary_detail: 'fabricated-arbitrary-detail',
}]

const EXPECTED_RESPONSE_NOTICE =
  '현재 이 API 응답에는 IP hash, 클릭 수, 마지막 클릭만 포함됩니다. 유입 소스·방문 페이지·기기 정보는 이 응답에 포함되지 않으므로 이 화면만으로 부정클릭을 확정하지 마세요.'

test('미보증 상세 필드가 있는 API 응답으로 화면 행을 만들면 세 필드만 남긴다', () => {
  const rows = keepVerifiedSuspiciousIPFields(API_PAYLOAD_WITH_UNVERIFIED_DETAILS)

  assert.deepEqual(rows, [{
    ip_hash: 'abcdef0123456789...',
    click_count: 42,
    last_click: '2026-09-15T05:30:00',
  }])
})

test('미보증 상세 필드가 있는 API 응답을 CSV로 만들면 세 필드만 내보낸다', () => {
  const csv = buildSuspiciousIPsCsv(
    API_PAYLOAD_WITH_UNVERIFIED_DETAILS,
    (value: string) => `formatted:${value}`,
  )

  assert.equal(
    csv,
    'IP Hash,총 클릭,마지막 클릭\nabcdef0123456789...,42,formatted:2026-09-15T05:30:00',
  )
  assert.equal(
    /naver|fabricated|source_breakdown|recent_clicks|user_agents|pages|arbitrary_detail/.test(csv),
    false,
  )
})

test('화면 안내를 표시하면 세 필드 계약과 API 응답 범위만 설명한다', () => {
  assert.equal(SUSPICIOUS_IP_RESPONSE_NOTICE, EXPECTED_RESPONSE_NOTICE)
  assert.equal(/수집되지/.test(SUSPICIOUS_IP_RESPONSE_NOTICE), false)
})
