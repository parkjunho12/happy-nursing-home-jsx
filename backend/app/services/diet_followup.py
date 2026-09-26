"""식이가 바뀌면 할 일을 만들어야 하는가 — 그 판단만.

■ 순수 함수만 둔다

  DB·ORM·설정을 모르고, 넘겨받은 값만 읽는다. 그래야 배포 전 검사에서
  설치 없이 이 규칙을 확인할 수 있다(services/diet_absence.py 와 같은 결).
  표를 만들고 고치는 일은 부르는 쪽(endpoints/diet.py)이 한다.

■ 언제 만드는가

  실제로 드시는 것이 달라졌을 때만. 같은 값을 다시 적은 것(사유만 고친 경우
  등)에는 만들지 않는다 — 할 일이 아닌 줄이 쌓이면 목록을 아무도 안 보게 된다.

■ 이름 짓기

  화면·종이에 같은 말이 나가도록 라벨을 여기서 만든다. 경관식은 밥·반찬을
  고르지 않으므로 그 한 단어로 끝난다.
"""
from __future__ import annotations

from typing import Any, Dict, Optional


def label_of(st: Optional[Dict[str, Any]]) -> str:
    """식이 한 줄을 사람이 읽는 말로. 없으면 '미정'."""
    if not st:
        return "미정"
    if st.get("tube"):
        return "경관식"
    parts = [str(st.get("rice") or "").strip(), str(st.get("side") or "").strip()]
    out = " · ".join(p for p in parts if p)
    return out or "미정"


def _key(s: Optional[Dict[str, Any]]):
    """견주기 위한 값. 경관식이면 밥·반찬은 보지 않는다 — 고르지 않는 칸이다.

    빈 문자열과 None 을 같게 본다. 다르게 보면 '미정 → 미정' 에도 할 일이 생긴다.
    """
    s = s or {}
    if s.get("tube"):
        return ("tube",)
    return (str(s.get("rice") or "").strip(), str(s.get("side") or "").strip())


def changed(before: Optional[Dict[str, Any]], after: Optional[Dict[str, Any]]) -> bool:
    """실제로 드시는 것이 달라졌는가 — 사유(note)만 고친 것은 아니다."""
    return _key(before) != _key(after)
