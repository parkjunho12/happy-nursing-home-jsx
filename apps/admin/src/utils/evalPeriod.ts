/** 직원 평가의 반기 계산.
 *
 *  여기가 틀리면 지난 평가를 못 찾거나, 엉뚱한 반기에 평가를 저장하게 된다.
 *  인사 기록이라 조용히 어긋나면 안 되므로 따로 떼어 테스트를 붙인다.
 *  (서버도 같은 형식을 쓴다 — '2026-H1' / '2026-H2')
 */

/** 지금이 몇 반기인지 — 화면을 열면 이번 반기가 보여야 한다 */
export function currentPeriod(d = new Date()): string {
  return `${d.getFullYear()}-H${d.getMonth() < 6 ? 1 : 2}`
}

/** '2026-H2' → '2026년 하반기'. 형식이 아니면 그대로 돌려준다 */
export function periodLabel(p: string): string {
  const m = /^(\d{4})-H([12])$/.exec(p)
  return m ? `${m[1]}년 ${m[2] === '1' ? '상' : '하'}반기` : p
}

/** 앞뒤 반기로 이동. 형식이 아니면 손대지 않는다 —
 *  임의로 고쳐서 엉뚱한 반기로 보내면 그 평가를 다시 찾지 못한다. */
export function shiftPeriod(p: string, delta: number): string {
  const m = /^(\d{4})-H([12])$/.exec(p)
  if (!m) return p
  let y = Number(m[1])
  let h = Number(m[2]) + delta
  while (h > 2) { h -= 2; y += 1 }
  while (h < 1) { h += 2; y -= 1 }
  return `${y}-H${h}`
}
