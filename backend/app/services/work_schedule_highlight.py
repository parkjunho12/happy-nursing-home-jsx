"""근무표 형광펜 — 순수 규칙 (DB·FastAPI 없이 검사할 수 있게 뺐다).

■ 색

  노랑·분홍·초록 셋뿐이다. 색이 많으면 "무슨 색이 무슨 뜻이냐" 가 되고,
  결국 아무도 안 쓴다. 뜻은 옆에 적는 '이유' 가 말한다.

■ 칸 하나 vs 날 전체

  staff_id 가 비어 있으면 그 날 전체를 그은 것이다. 같은 날에 열 표시와
  칸 표시가 둘 다 있으면 칸 쪽이 위에 보인다 — 더 좁게 찍은 것이 더 뜻이 있다.
"""
from __future__ import annotations
from typing import Any, Dict, Iterable, List, Optional, Tuple

COLORS: Tuple[str, ...] = ("yellow", "pink", "green")
DEFAULT_COLOR = "yellow"
NOTE_MAX = 200

# 엑셀에 칠할 색 — 화면 형광펜과 같은 느낌의 옅은 색. 검정 글씨가 읽혀야 한다.
XLSX_FILL = {"yellow": "FFF59D", "pink": "F8BBD0", "green": "C8E6C9"}


def norm_color(c: Optional[str]) -> str:
    """모르는 색은 노랑으로. 비우면(지우기) 빈 문자열."""
    s = (c or "").strip().lower()
    if s == "":
        return ""
    return s if s in COLORS else DEFAULT_COLOR


def norm_note(n: Optional[str]) -> str:
    return (n or "").strip()[:NOTE_MAX]


def norm_day(d: Any) -> Optional[int]:
    """1~31 정수만. 아니면 None — 호출한 쪽이 400 으로 돌려보낸다."""
    try:
        v = int(d)
    except (TypeError, ValueError):
        return None
    return v if 1 <= v <= 31 else None


def key_of(staff_id: Optional[str], day: int) -> str:
    """화면과 같은 규칙의 키 — '<staff_id>:<day>', 열이면 ':<day>'."""
    return f"{(staff_id or '').strip()}:{int(day)}"


def effective(items: Iterable[Dict[str, Any]], staff_id: str, day: int) -> Optional[Dict[str, Any]]:
    """그 칸에 실제로 보일 형광펜 — 칸 표시가 있으면 그것, 없으면 그 날 열 표시."""
    col = None
    for it in items:
        if int(it.get("day", 0)) != int(day):
            continue
        sid = (it.get("staff_id") or "").strip()
        if sid == (staff_id or "").strip() and sid != "":
            return it
        if sid == "":
            col = it
    return col


def legend_lines(items: Iterable[Dict[str, Any]], names: Dict[str, str]) -> List[str]:
    """표 아래 범례 한 줄씩 — '2일 · 전체 · 근무 변경' / '5일 · 김철수 · 대휴'.

    이유가 없는 표시는 범례에 안 올린다. 색만 있는 것은 표에서 이미 보인다.
    날짜 순, 같은 날이면 열(전체)이 먼저."""
    out: List[Tuple[int, int, str]] = []
    for it in items:
        note = norm_note(it.get("note"))
        if not note:
            continue
        sid = (it.get("staff_id") or "").strip()
        d = int(it.get("day", 0))
        who = "전체" if sid == "" else names.get(sid, "(퇴사)")
        out.append((d, 0 if sid == "" else 1, f"{d}일 · {who} · {note}"))
    out.sort(key=lambda t: (t[0], t[1], t[2]))
    return [t[2] for t in out]
