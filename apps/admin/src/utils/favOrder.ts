/** 즐겨찾기 차례 바꾸기.
 *
 *  즐겨찾기는 적힌 차례대로 맨 위에 붙는다. 그런데 별을 누른 순서대로만
 *  쌓여서, 날마다 여는 메뉴가 세 번째에 있고 어쩌다 한 번 쓰는 것이 맨 위에
 *  있는 일이 생긴다. 그걸 손으로 올릴 수 있게 한다.
 *
 *  차례는 목록 그 자체다 — 따로 순번을 매기지 않는다. 순번을 두면 지웠다
 *  넣었다 할 때 빈 번호가 생기고, 그걸 다시 메우는 코드가 또 필요해진다.
 */

/** 한 칸 위로. 맨 위면 그대로 둔다 — 없는 자리로 밀면 목록이 비뚤어진다. */
export function moveUp(list: string[], to: string): string[] {
  const i = list.indexOf(to)
  if (i <= 0) return list
  const n = [...list]
  ;[n[i - 1], n[i]] = [n[i], n[i - 1]]
  return n
}

/** 한 칸 아래로. 맨 아래면 그대로. */
export function moveDown(list: string[], to: string): string[] {
  const i = list.indexOf(to)
  if (i < 0 || i >= list.length - 1) return list
  const n = [...list]
  ;[n[i], n[i + 1]] = [n[i + 1], n[i]]
  return n
}

/** 즐겨찾기에서 빼기 */
export function removeFav(list: string[], to: string): string[] {
  return list.filter(x => x !== to)
}

/**
 * 별 누르기 — 없으면 넣고 있으면 뺀다.
 *
 * 새로 넣은 것은 맨 뒤에 붙인다. 맨 앞에 넣으면 방금 누른 것이 늘 1번이
 * 되어, 애써 맞춰둔 차례가 별 하나 누를 때마다 흐트러진다.
 */
export function toggleFav(list: string[], to: string): string[] {
  return list.includes(to) ? removeFav(list, to) : [...list, to]
}

/**
 * 저장된 값 읽기 — 글자 배열이 아닌 것은 버린다.
 *
 * localStorage 는 사람이 손댈 수 있고, 예전 형식이 남아 있을 수도 있다.
 * 이상한 값이 들어오면 메뉴가 통째로 안 뜨므로 조용히 빈 목록으로 돌아간다.
 */
export function parseFavs(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw || '[]')
    if (!Array.isArray(v)) return []
    return [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))]
  } catch {
    return []
  }
}
