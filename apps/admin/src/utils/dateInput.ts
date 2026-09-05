/** 키보드로 친 날짜를 ISO 로 바꾸기.
 *
 *  '19350412' 처럼 숫자만 치면 '1935-04-12' 가 된다.
 *  생년월일은 나이 계산과 급여·평가로 이어지는 값이라, 조용히 틀린 날짜가
 *  들어가면 안 된다. 2월 30일 같은 없는 날은 받지 않는다.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** 친 글자를 'YYYY.MM.DD' 모양으로 다듬는다(보여주기용) */
export function maskDate(raw: string): string {
  const dg = (raw || '').replace(/\D/g, '').slice(0, 8)
  if (dg.length > 6) return `${dg.slice(0, 4)}.${dg.slice(4, 6)}.${dg.slice(6)}`
  if (dg.length > 4) return `${dg.slice(0, 4)}.${dg.slice(4)}`
  return dg
}

/** 여덟 자리가 다 차고 실제로 있는 날이면 ISO, 아니면 null.
 *
 *  null 을 주면 화면이 값을 바꾸지 않는다 — 치는 도중에 값이 튀지 않게.
 */
export function digitsToISO(raw: string): string | null {
  const dg = (raw || '').replace(/\D/g, '')
  if (dg.length !== 8) return null
  const y = +dg.slice(0, 4), mo = +dg.slice(4, 6), da = +dg.slice(6)
  if (y < 1900) return null
  // Date 는 2월 30일을 3월 2일로 넘겨 버린다. 넘어갔는지 되짚어 확인한다.
  const dt = new Date(y, mo - 1, da)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return null
  return `${y}-${pad(mo)}-${pad(da)}`
}
