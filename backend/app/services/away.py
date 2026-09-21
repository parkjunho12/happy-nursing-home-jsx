"""그날 자리를 비우신 분 — 일정에 적힌 외박에서 읽어 낸다.

■ 왜 식이 표에 따로 적지 않는가

  자리 비움은 일정에 있다(resident_diet 모델 주석과 같은 원칙). 식이 표에
  '외박중' 칸을 따로 두면 일정과 두 곳에 적히고, 언젠가 어긋난다. 어긋나면
  주방은 틀린 쪽을 보고 차린다.

  그래서 식이 현황은 일정을 읽어서 보여주기만 한다. 식이 화면에서 외박을
  누르면 일정에 한 줄이 생긴다 — 적히는 곳은 언제나 한 곳이다.

■ 언제부터 언제까지 자리를 비운 것으로 보는가

  출발일 ~ 귀원일(실제 귀원이 있으면 그것, 없으면 예정 귀원)까지다.

  귀원을 아예 모를 때는 '언제 오실지 모른 채 나가 계신 것' 으로 본다 —
  출발일부터 귀원을 적을 때까지 계속. 오늘 안 계신 분의 상을 차릴 수는 없다.

  ※ 식수 정산(meals.py)은 이 경우를 출발 당일까지만 센다. 일부러 다르다.
    - 정산은 한 달치 돈이 걸린 계산이라, 귀원 기록이라는 근거 없이 끼니를
      빼지 않는다. 대신 '귀원 미기록' 으로 경고를 낸다.
    - 여기는 오늘 몇 인분을 차릴지 정하는 표다. 안 계신 분을 세면 그날
      음식이 남는다. 틀려도 그날로 끝나고, 다음 날 고치면 된다.
    그래서 귀원을 안 적으면 이 화면이 날마다 '귀원 미정 N일째' 로 조른다.
    조르는 쪽이 조용히 틀리는 쪽보다 낫다.

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
        s_day = st.strftime("%Y-%m-%d")
        if ret is None:
            # 언제 오실지 모른 채 나가 계신다 — 귀원을 적을 때까지 계속 비움
            if on < s_day:
                continue
            e_day = None
        else:
            e_day = ret.strftime("%Y-%m-%d")
            if not (s_day <= on <= e_day):
                continue
        name = resident_name_of(getattr(e, "title", None))
        if not name:
            continue
        info = {
            "event_id": getattr(e, "id", None),
            "category": e.category,
            "start": st.isoformat(),
            "end": ret.isoformat() if ret else None,
            "start_day": s_day,
            "end_day": e_day,
            # 떠나는 날·돌아오는 날은 한 끼 이상 드셔서 주방 숫자에 든다.
            # 귀원을 모르면 출발 다음 날부터 하루를 통째로 비우신 것으로 본다.
            "full_day": (s_day < on < e_day) if e_day else (s_day < on),
            "leaving_today": s_day == on,
            "returning_today": bool(e_day) and e_day == on,
            "returned": getattr(e, "returned_at", None) is not None,
            # 귀원이 정해지지 않았다 — 며칠째인지 함께 내려 화면이 조르게 한다
            "unknown_return": ret is None,
            "days": (_days_between(s_day, on) if ret is None else 0),
        }
        prev = out.get(name)
        if prev is None or info["start"] < prev["start"]:
            out[name] = info
    return out


def _days_between(a: str, b: str) -> int:
    """a 일부터 b 일까지 며칠째인가 — 같은 날이면 1일째."""
    d0 = datetime.strptime(a, "%Y-%m-%d")
    d1 = datetime.strptime(b, "%Y-%m-%d")
    return (d1 - d0).days + 1


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
    # 귀원을 모르면 며칠째인지 함께 적는다 — 숫자가 늘어나야 눈에 걸린다
    if a.get("unknown_return"):
        return f"외박중 · 귀원 미정 {a.get('days', 1)}일째"
    return "외박중"
