"""그날 자리를 비우신 분 — 일정에 적힌 외박에서 읽어 낸다.

■ 왜 식이 표에 따로 적지 않는가

  자리 비움은 일정에 있다(resident_diet 모델 주석과 같은 원칙). 식이 표에
  '외박중' 칸을 따로 두면 일정과 두 곳에 적히고, 언젠가 어긋난다. 어긋나면
  주방은 틀린 쪽을 보고 차린다.

  그래서 식이 현황은 일정을 읽어서 보여주기만 한다. 식이 화면에서 외박을
  누르면 일정에 한 줄이 생긴다 — 적히는 곳은 언제나 한 곳이다.

■ 언제부터 언제까지 자리를 비운 것으로 보는가

  출발일 ~ 귀원일(실제 귀원이 있으면 그것, 없으면 예정 귀원)까지다.
  귀원이 아예 없으면 출발 당일까지만 본다 — 식수 정산(meals.py)과 같은
  규칙이다. 그러지 않으면 귀원을 안 적은 한 건 때문에 그분이 영영 자리를
  비운 것으로 남는다.

■ 떠나는 날과 돌아오는 날

  떠나는 날 아침·점심은 드셨고, 돌아오는 날 저녁은 드신다. 그래서 그 이틀은
  '외박중' 으로 보여주되 주방 숫자에서는 빼지 않는다. 가운데 날만 뺀다.
  하루 단위로 뺐다 넣었다 하면 그 이틀치가 통째로 틀린다.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, Optional

KST = timezone(timedelta(hours=9))

# 자리 비움으로 보는 분류. 외출·외래는 당일에 돌아오셔서 끼니가 통째로
# 빠지지는 않는다 — 그건 식수 정산이 시간대로 따진다.
AWAY_CATEGORIES = ("외박",)

_TAG = re.compile(r"^\[[^\]]+\]\s*")


def resident_name_of(title: Optional[str]) -> str:
    """'[외박] 김순자 어르신' → '김순자'.

    일정은 어르신을 이름으로 가리킨다(수급자 id 를 담지 않는다). 화면이
    제목을 만들 때 붙이는 꼬리표를 같은 규칙으로 떼어낸다.
    """
    t = _TAG.sub("", (title or "").strip())
    return t.replace("어르신", "").strip()


def _kst(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=KST)).astimezone(KST)


def away_map(events: Iterable[Any], on: str) -> Dict[str, Dict[str, Any]]:
    """이름 → 그날의 자리 비움.

    같은 분에게 여러 건이 겹치면 먼저 시작한 것을 쓴다 — 실수로 두 번 적은
    경우에도 화면이 흔들리지 않게.
    """
    out: Dict[str, Dict[str, Any]] = {}
    for e in events:
        if getattr(e, "category", None) not in AWAY_CATEGORIES:
            continue
        if getattr(e, "status", None) == "canceled":
            continue
        st = _kst(getattr(e, "start_at", None))
        if st is None:
            continue
        ret = _kst(getattr(e, "returned_at", None)) or _kst(getattr(e, "end_at", None))
        # 귀원이 없으면 출발 당일까지만 — 식수 정산과 같은 규칙
        end = ret or st.replace(hour=23, minute=59)
        s_day, e_day = st.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
        if not (s_day <= on <= e_day):
            continue
        name = resident_name_of(getattr(e, "title", None))
        if not name:
            continue
        info = {
            "event_id": getattr(e, "id", None),
            "category": e.category,
            "start": st.isoformat(),
            "end": end.isoformat() if ret else None,
            "start_day": s_day,
            "end_day": e_day if ret else None,
            # 가운데 날만 주방 숫자에서 뺀다
            "full_day": s_day < on < e_day,
            "leaving_today": s_day == on,
            "returning_today": bool(ret) and e_day == on,
            "returned": getattr(e, "returned_at", None) is not None,
        }
        prev = out.get(name)
        if prev is None or info["start"] < prev["start"]:
            out[name] = info
    return out


def away_label(a: Optional[Dict[str, Any]]) -> str:
    """화면과 종이에 같은 말이 나가게 — 한 줄로 읽히는 말로."""
    if not a:
        return ""
    hm = a["start"][11:16]
    if a.get("leaving_today") and a.get("returning_today"):
        return f"오늘 외박 {hm} 출발 · {(a.get('end') or '')[11:16]} 귀원"
    if a.get("leaving_today"):
        return f"오늘 {hm} 외박 출발"
    if a.get("returning_today"):
        return f"오늘 {(a.get('end') or '')[11:16]} 귀원"
    return "외박중"
