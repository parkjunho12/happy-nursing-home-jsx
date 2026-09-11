"""식이 현황 — 무엇을 드시는가, 그리고 그 값이 언제부터인가.

■ 왜 '변경 기록'만 쌓는가

  종이는 바뀔 때마다 그날짜 시트를 새로 떠서 보관했다. 다섯 달 치가 시트
  55장이다. 그렇게 두면 '지금 뭘 드시나' 를 보려고 마지막 시트를 찾아야 하고,
  '언제부터 죽이었나' 를 보려면 55장을 거꾸로 넘겨야 한다.

  그래서 스냅샷 대신 바뀐 순간만 적는다. 지금 상태도, 지난 6월 3일 상태도
  같은 기록에서 계산해 낸다. 둘이 어긋날 수가 없다.

■ 적용일이 따로 있는 이유

  오늘 적어도 '내일 점심부터' 인 경우가 있다. 언제 적었는지(created_at)와
  언제부터 드시는지(effective_date)는 다른 날이다. 주방은 후자를 본다.

■ 여기에 없는 것 — 입원·외박

  자리를 비우는 것은 일정(외출·외박·외래)에 이미 있다. 여기에 또 적으면
  두 곳이 어긋나고, 그때는 어느 쪽이 맞는지 아무도 모른다. 이 파일은
  '무엇을 드시는가' 만 안다.

  표준 라이브러리만 쓴다 — 배포 전 검사가 설치 없이 이 규칙을 확인한다.
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

# 밥 — 한 분에 하나. 경관식은 밥을 고르지 않는다(tube=True, rice=None).
RICE_TYPES = ["일반식", "당뇨식", "죽", "미음"]
# 반찬 — 한 분에 하나.
SIDE_TYPES = ["일반찬", "다진찬", "갈찬"]

# 주방이 보는 순서대로. 화면·인쇄·집계가 모두 이 차례를 쓴다.
COUNT_ORDER = RICE_TYPES + SIDE_TYPES


def valid_rice(v: Optional[str]) -> bool:
    return v is None or v in RICE_TYPES


def valid_side(v: Optional[str]) -> bool:
    return v is None or v in SIDE_TYPES


def _key(ch: Dict[str, Any]) -> tuple:
    """같은 날 두 번 고쳤을 때 뒤에 적은 것이 이긴다."""
    return (ch.get("effective_date") or "", ch.get("created_at") or "")


def state_at(changes: Iterable[Dict[str, Any]], on: str) -> Optional[Dict[str, Any]]:
    """그날(포함) 기준으로 적용 중인 식이. 아직 아무것도 없으면 None.

    앞으로 적용될 변경(적용일이 그날보다 뒤)은 보지 않는다 — 주방이 오늘
    차려야 하는 것만 답한다.
    """
    applied = [c for c in changes if (c.get("effective_date") or "") <= on]
    if not applied:
        return None
    return max(applied, key=_key)


def next_change(changes: Iterable[Dict[str, Any]], after: str) -> Optional[Dict[str, Any]]:
    """아직 오지 않은 변경 중 가장 이른 것 — '내일부터 죽' 을 미리 알린다."""
    future = [c for c in changes if (c.get("effective_date") or "") > after]
    if not future:
        return None
    return min(future, key=_key)


def counts(states: Iterable[Optional[Dict[str, Any]]]) -> Dict[str, int]:
    """주방에 넘길 숫자.

    '미정' 을 따로 세는 이유 — 아무도 식이를 정해 주지 않은 분을 0으로 묻으면
    그 어르신 몫은 아예 안 올라간다. 빈칸은 빈칸이라고 말해야 누가 채운다.
    """
    out = {k: 0 for k in COUNT_ORDER}
    out.update({"경관식": 0, "미정": 0, "합계": 0})
    for s in states:
        out["합계"] += 1
        if s is None:
            out["미정"] += 1
            continue
        if s.get("tube"):
            out["경관식"] += 1
            continue
        r, sd = s.get("rice"), s.get("side")
        if r in out:
            out[r] += 1
        if sd in out:
            out[sd] += 1
        if not r and not sd:
            out["미정"] += 1
    return out


def diff(before: Optional[Dict[str, Any]], after: Dict[str, Any]) -> List[str]:
    """무엇이 바뀌었는지 사람 말로. 이력 한 줄이 된다."""
    def show(s: Optional[Dict[str, Any]]) -> str:
        if s is None:
            return "미정"
        if s.get("tube"):
            return "경관식"
        return " · ".join(x for x in (s.get("rice"), s.get("side")) if x) or "미정"

    b, a = show(before), show(after)
    return [] if b == a else [f"{b} → {a}"]
