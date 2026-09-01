/** 한국식 시각 표기 ↔ 24시각 변환.
 *
 *  헷갈리기 쉬운 곳이 하나 있다 — 12시다.
 *    오전 12시 = 00시 (자정)
 *    오후 12시 = 12시 (정오)
 *  이걸 틀리면 정오 예약이 자정으로 저장된다. 외래 일정에서 그건
 *  어르신을 한밤중에 모시고 나가는 것으로 적히는 셈이다.
 *  그래서 따로 떼어 테스트를 붙인다.
 */

export type Ampm = '오전' | '오후'

export interface KoreanTime {
  ampm: Ampm
  /** 1~12 — 사람이 말하는 그대로 */
  hour12: number
  minute: number
}

/** '14:40' → { 오후, 2, 40 } */
export function toKorean(hhmm: string): KoreanTime | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim())
  if (!m) return null
  const h = Number(m[1]), mi = Number(m[2])
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null
  return {
    ampm: h < 12 ? '오전' : '오후',
    hour12: h % 12 === 0 ? 12 : h % 12,
    minute: mi,
  }
}

/** { 오후, 2, 40 } → '14:40' */
export function toHHMM(t: KoreanTime): string {
  const h12 = Math.min(12, Math.max(1, Math.round(t.hour12)))
  const mi = Math.min(59, Math.max(0, Math.round(t.minute)))
  // 오전 12시는 0시, 오후 12시는 12시. 나머지는 오후면 +12.
  let h = h12 % 12
  if (t.ampm === '오후') h += 12
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}

/** '14:40' → '오후 2:40' — 화면에 보여줄 문구 */
export function koreanLabel(hhmm: string): string {
  const k = toKorean(hhmm)
  return k ? `${k.ampm} ${k.hour12}:${String(k.minute).padStart(2, '0')}` : hhmm
}
