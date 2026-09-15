export interface VerifiedSuspiciousIP {
  ip_hash: string
  click_count: number
  last_click: string
}

export const SUSPICIOUS_IP_RESPONSE_NOTICE =
  '현재 이 API 응답에는 IP hash, 클릭 수, 마지막 클릭만 포함됩니다. 유입 소스·방문 페이지·기기 정보는 이 응답에 포함되지 않으므로 이 화면만으로 부정클릭을 확정하지 마세요.'

export function keepVerifiedSuspiciousIPFields(
  rows: readonly VerifiedSuspiciousIP[],
): VerifiedSuspiciousIP[] {
  return rows.map(({ ip_hash, click_count, last_click }) => ({
    ip_hash,
    click_count,
    last_click,
  }))
}

export function buildSuspiciousIPsCsv(
  rows: readonly VerifiedSuspiciousIP[],
  formatLastClick: (value: string) => string,
): string {
  const headers = ['IP Hash', '총 클릭', '마지막 클릭']
  const values = rows.map(ip => [
    ip.ip_hash,
    ip.click_count,
    formatLastClick(ip.last_click),
  ])

  return [headers, ...values].map(row => row.join(',')).join('\n')
}
