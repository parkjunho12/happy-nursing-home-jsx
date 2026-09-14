"""조 편성(직종·조·층)이 다음 달로 어떻게 따라가는가.

■ 무엇이 문제였나

  조 편성은 '이번 달이 비어 있으면 지난달 것을 물려받는다' 였다. 그런데 근무표는
  한 달 앞서 만들어 두므로, 10월 표를 이미 저장한 뒤 9월에서 조를 바꾸면 10월은
  옛 편성 그대로 남는다. 저장은 달마다 자기 복사본을 갖기 때문이다. 바꾼 사람은
  바뀐 줄 알고, 다음 달 표를 여는 사람은 옛 조를 본다.

■ 규칙

  어느 달의 조 편성을 저장하면, 그 뒤의 달 가운데 '지금까지 이 달을 따라오던'
  달에도 같은 편성을 적는다. 따라오던 달이란, 두 달에 모두 있는 사람들의
  편성이 저장 직전의 이 달 편성과 같았던 달이다. 다음 달에만 있는 사람(입사
  예정)이나 이 달에만 있는 사람(퇴사)은 비교에서 뺀다 — 사람이 드나든 것은
  편성을 따로 짠 것이 아니다. 따로 손본 달(같은 사람의 조·층이 달랐던 달)은
  건드리지 않는다 — 그 달은 그 달 나름의 이유가 있어 다르게 짠 것이다.
  확정 잠금이 걸린 달도 건드리지 않고 '못 바꿨다' 고 알린다.

  달마다 다른 값(총시간·추가근무 같은 집계)은 그 달 것을 그대로 두고 편성
  칸만 바꾼다. 이 달에 없는 사람이 다음 달 표에 있으면(입사 예정) 그 줄은 둔다.
  이 달에서 빠진 사람(퇴사)이 다음 달 표에 남아 있어도 지우지 않는다 — 화면은
  그 달의 재직자 목록으로 표를 그리므로 남은 줄은 보이지 않고, 잘못 지우면
  되돌릴 수 없다.

■ 편성이란 직종·조·층이다

  순서(order)는 화면의 정렬(기본·이름순·입사순)에 따라 매번 다시 매겨지는
  값이라 편성이 아니다. 여기에 넣으면 이름순으로 잠깐 보고 저장했을 뿐인데
  '편성이 바뀌었다' 고 뒤 달을 건드리고, 반대로 신규 입사자 한 명 때문에
  번호가 밀린 뒤 달은 '따로 손본 달' 로 오해해 놓친다.

  비고(note)도 편성이 아니다. 그 달의 이야기다. 9월 비고를 10월에 덮어쓰면
  읽는 사람은 그것이 10월 이야기인 줄 안다(WorkScheduleMemo 의 설명과 같은
  이유). 비어 있는 달이 지난달 것을 통째로 물려받는 것(_inherit_rows)과는
  다른 문제다.

■ 표준 라이브러리만

  배포 전 검사에서 설치 없이 부른다.
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# 편성을 이루는 칸. 이 칸들이 같으면 '같은 편성' 이다. 순서·비고는 넣지 않는다(위 설명).
ASSIGN_KEYS = ("position", "team", "floor")


def assignment_key(rows: Optional[Sequence[Dict[str, Any]]]) -> Tuple:
    """편성만 뽑아 비교할 수 있는 값으로 만든다. 집계 칸은 무시한다."""
    out = []
    for r in rows or []:
        sid = r.get("staff_id")
        if not sid:
            continue
        out.append((sid,) + tuple(_norm(r.get(k)) for k in ASSIGN_KEYS))
    return tuple(sorted(out))


def _norm(v: Any) -> Any:
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    return v


def same_assignment(a: Optional[Sequence[Dict[str, Any]]],
                    b: Optional[Sequence[Dict[str, Any]]]) -> bool:
    """편성이 같은가 — 사람이 늘거나 줄어도 다른 편성이다(이 달을 저장할 때의 기준)."""
    return assignment_key(a) == assignment_key(b)


def _by_staff(rows: Optional[Sequence[Dict[str, Any]]]) -> Dict[str, Tuple]:
    return {k[0]: k[1:] for k in assignment_key(rows)}


def following(old_rows: Optional[Sequence[Dict[str, Any]]],
              later_rows: Optional[Sequence[Dict[str, Any]]]) -> bool:
    """뒤 달이 이 달(저장 직전 편성)을 따라오고 있었는가.

    두 달에 모두 있는 사람의 직종·조·층이 전부 같으면 따라오던 것이다.
    한쪽에만 있는 사람(입사 예정·퇴사)은 보지 않는다. 겹치는 사람이 없으면
    따라온다고 할 근거가 없다.
    """
    a, b = _by_staff(old_rows), _by_staff(later_rows)
    shared = a.keys() & b.keys()
    if not shared:
        return False
    return all(a[s] == b[s] for s in shared)


def apply_assignment(target: Optional[Sequence[Dict[str, Any]]],
                     source: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """source 의 편성을 target 에 입힌다. target 의 다른 칸(집계)은 그대로.

    source 에 있는 사람은 편성 칸(직종·조·층)만 덮고, source 에 없는 사람은
    target 의 줄을 그대로 둔다. target 에 없는 사람은 source 줄(편성 칸만)로
    끝에 넣는다. 그 달의 줄 순서·비고·집계는 건드리지 않는다.
    """
    out: List[Dict[str, Any]] = []
    seen = set()
    src_by_id = {r["staff_id"]: r for r in source if r.get("staff_id")}
    for r in target or []:
        row = dict(r)
        sid = row.get("staff_id")
        if sid in src_by_id:
            for k in ASSIGN_KEYS:
                if k in src_by_id[sid]:
                    row[k] = src_by_id[sid][k]
        if sid:
            seen.add(sid)
        out.append(row)
    for sid, r in src_by_id.items():
        if sid not in seen:
            out.append({k: v for k, v in r.items() if k == "staff_id" or k in ASSIGN_KEYS})
    return out


def should_follow(new_rows: Optional[Sequence[Dict[str, Any]]],
                  old_rows: Optional[Sequence[Dict[str, Any]]],
                  wanted: Optional[bool]) -> bool:
    """이번 저장이 뒤 달을 건드려도 되는가.

      · 화면이 '이번 달만' 이라고 했으면(wanted=False) 안 한다
      · 빈 편성을 저장하는 것은 편성 변경이 아니다 — 목록을 못 불러온 채 저장한 것일 수 있다
      · 저장 직전에 편성이 없었으면 아무 달도 이 달을 따라오고 있지 않았다
      · 편성이 그대로면 할 일이 없다
    """
    if wanted is False:
        return False
    if not new_rows or not assignment_key(old_rows):
        return False
    return not same_assignment(old_rows, new_rows)


def follow_targets(old_rows: Optional[Sequence[Dict[str, Any]]],
                   later: Iterable[Tuple[str, Optional[Sequence[Dict[str, Any]]], bool]],
                   ) -> Tuple[List[str], List[str]]:
    """저장 직전 편성(old_rows)을 따라오던 뒤 달을 고른다.

    later: (달, 그 달의 rows, 잠겼는가) — 오래된 달부터.
    돌려주는 것: (편성을 적을 달들, 따라오던 것인데 잠겨서 못 적는 달들)
    편성이 없는 달(rows 가 비어 있음)은 조회 때 이 달 것을 물려받으므로 건드릴 게 없다.
    """
    todo: List[str] = []
    locked: List[str] = []
    for ym, rows, is_locked in later:
        if not rows:
            continue
        if not following(old_rows, rows):
            continue                      # 따로 손본 달 — 그 달의 뜻을 존중한다
        (locked if is_locked else todo).append(ym)
    return todo, locked
