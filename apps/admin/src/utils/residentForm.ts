/**
 * 수급자 등록·수정 폼 검사.
 *
 * 원래는 이렇게 돼 있었다.
 *
 *   if (!form.name || !form.birthDate) return
 *
 * 조건에 걸리면 아무 말 없이 끝난다. 간단 등록으로 만든 입소 예정자는
 * 생년월일이 비어 있어서, 수정 창을 열고 '수정' 을 눌러도 아무 일도
 * 일어나지 않았다. 그 예정자는 입소일이 되면 그대로 입소자가 되므로,
 * 입소자에서도 똑같이 먹통이었다.
 *
 * 두 가지를 고친다.
 *  · 막을 거면 왜 막는지 말한다. 조용히 끝내지 않는다.
 *  · 수정할 때는 생년월일을 요구하지 않는다. 생년월일을 채우러 들어온
 *    사람이 생년월일이 없어서 저장을 못 하면 영영 못 채운다.
 */

export interface ResidentFormLike {
  name: string
  birthDate: string
}

export interface ValidateOpts {
  /** 기존 수급자를 고치는 중인가(새로 등록하는 것이 아니라) */
  isEdit: boolean
}

/** 문제가 있으면 사람에게 보여줄 말, 없으면 null */
export function validateResidentForm(
  f: ResidentFormLike, { isEdit }: ValidateOpts,
): string | null {
  if (!f.name?.trim()) return '성함을 입력해주세요.'
  // 새로 등록할 때만 요구한다 — 위 주석 참고
  if (!isEdit && !f.birthDate) return '생년월일을 입력해주세요.'
  return null
}
