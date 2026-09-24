"""퇴소 시각 기준으로 식이 현황에서 어르신을 빼는 규칙.

퇴소 처리를 했는데 식이 현황에 그대로 남아 있으면 주방은 퇴소한 분의
상까지 차린다. 반대로 퇴소일 아침에 드실 분을 미리 빼면 한 끼가 빈다.
그래서 날짜만 보지 않고 퇴소 시각까지 본다.

  · 퇴소일 이전         → 재원 (그대로 나온다)
  · 퇴소일 다음날부터    → 제외
  · 퇴소일 당일, 시각 있음 → 그 시각이 지나면 제외, 지나기 전엔 '오늘 HH:MM 퇴소' 표시
  · 퇴소일 당일, 시각 없음 → 하루가 끝날 때까지 재원 (기존 동작 유지)
  · 지난 날짜를 되감아 볼 때 퇴소일 당일은 '그날 HH:MM 퇴소' 로 표시만 하고 남긴다
    — 그날 아침을 드셨는지는 시각을 보고 읽는 사람이 판단한다

의존성 없이 돌아야 한다.  python3 backend/tests/test_diet_discharge.py
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, Optional

_HM = re.compile(r"^(\d{1,2}):(\d{2})")


def _hm(v: Optional[str]) -> Optional[str]:
    """'8:00' · '08:00' · '08:00:00' → '08:00'. 못 읽으면 None."""
    m = _HM.match((v or "").strip())
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        return None
    return f"{h:02d}:{mi:02d}"


def discharge_state(r: Any, on: str, now: Optional[datetime] = None) -> Dict[str, Any]:
    """그날 식이 현황에서 이 어르신을 어떻게 다룰지.

    `now` 는 KST 기준 현재 시각. 조회일이 오늘이면 퇴소 시각이 지났는지를
    이 값으로 판정한다.  반환값:
      show     — 명단에 올리는가
      label    — 이름 옆에 붙일 문구 (없으면 None)
      today    — 조회일이 퇴소 당일인가
      time     — 퇴소 시각 'HH:MM' (없으면 None)
    """
    dis = (getattr(r, "discharge_date", None) or "")[:10]
    if not dis:
        return {"show": True, "label": None, "today": False, "time": None}
    if dis < on:
        return {"show": False, "label": None, "today": False, "time": None}
    if dis > on:
        # 퇴소일을 미리 잡아 둔 경우 — 아직 계신다
        return {"show": True, "label": None, "today": False, "time": None}

    t = _hm(getattr(r, "discharge_time", None))
    if t is None:
        return {"show": True, "label": "오늘 퇴소", "today": True, "time": None}

    if now is not None and now.strftime("%Y-%m-%d") == on:
        if now.strftime("%H:%M") >= t:
            return {"show": False, "label": None, "today": True, "time": t}
        return {"show": True, "label": f"오늘 {t} 퇴소", "today": True, "time": t}

    if now is not None and now.strftime("%Y-%m-%d") > on:
        # 지난 날짜 되감기 — 그날 퇴소했다는 사실을 남긴다
        return {"show": True, "label": f"{t} 퇴소", "today": True, "time": t}

    # 앞날을 미리 보는 경우 — 아직 안 지났으니 표시만
    return {"show": True, "label": f"{t} 퇴소 예정", "today": True, "time": t}
