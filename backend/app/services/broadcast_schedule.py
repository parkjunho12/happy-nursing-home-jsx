"""방송 예약의 '언제' 를 계산하는 곳.

반복 규칙 해석은 오직 여기에만 있다. Agent에는 계산된 회차 시각만 내려간다 —
규칙이 서버와 Agent 두 곳에 있으면 언젠가 서로 어긋나고, 그때는 방송이
안 나가거나 두 번 나간다.

시간은 전부 Asia/Seoul 기준으로 다룬다. DB에는 tz 가 붙은 값으로 넣고,
비교할 때도 tz 를 붙여서 비교한다(naive 와 aware 를 섞으면 바로 터진다).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone, date
from typing import Any, Dict, List, Optional

KST = timezone(timedelta(hours=9))

FREQ_ONCE = "once"
FREQ_DAILY = "daily"
FREQ_WEEKDAYS = "weekdays"   # 월~금
FREQ_WEEKLY = "weekly"       # days: [0=월 … 6=일]
FREQUENCIES = (FREQ_ONCE, FREQ_DAILY, FREQ_WEEKDAYS, FREQ_WEEKLY)

WEEK_KO = ["월", "화", "수", "목", "금", "토", "일"]


def now_kst() -> datetime:
    return datetime.now(KST)


def to_kst(dt: Optional[datetime]) -> Optional[datetime]:
    """naive 로 읽혀 온 값(sqlite 등)도 KST 로 맞춰준다."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=KST)
    return dt.astimezone(KST)


def normalize_rule(rule: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """저장·비교하기 좋은 형태로 정리. 모르는 값은 once 로 떨어뜨린다."""
    r = dict(rule or {})
    freq = str(r.get("freq") or FREQ_ONCE).lower()
    if freq not in FREQUENCIES:
        freq = FREQ_ONCE
    out: Dict[str, Any] = {"freq": freq}
    if freq == FREQ_WEEKLY:
        days = [int(d) for d in (r.get("days") or []) if isinstance(d, (int, str)) and str(d).isdigit()]
        days = sorted({d for d in days if 0 <= d <= 6})
        # 요일을 안 고르면 반복할 수 없다 — 1회성으로 본다
        if not days:
            return {"freq": FREQ_ONCE}
        out["days"] = days
    if r.get("until"):
        out["until"] = str(r["until"])[:10]
    return out


def describe_rule(rule: Optional[Dict[str, Any]]) -> str:
    """화면·로그에 쓸 사람 말."""
    r = normalize_rule(rule)
    f = r["freq"]
    if f == FREQ_DAILY:
        base = "매일"
    elif f == FREQ_WEEKDAYS:
        base = "평일(월~금)"
    elif f == FREQ_WEEKLY:
        base = "매주 " + "·".join(WEEK_KO[d] for d in r.get("days", []))
    else:
        base = "1회"
    if r.get("until"):
        base += f" · {r['until']}까지"
    return base


def _matches(rule: Dict[str, Any], d: date, first: date) -> bool:
    f = rule["freq"]
    if f == FREQ_ONCE:
        return d == first
    if f == FREQ_DAILY:
        return True
    if f == FREQ_WEEKDAYS:
        return d.weekday() <= 4        # 0=월 … 4=금
    if f == FREQ_WEEKLY:
        return d.weekday() in rule.get("days", [])
    return False


def occurrences(
    scheduled_at: datetime,
    repeat_rule: Optional[Dict[str, Any]],
    *,
    start: datetime,
    end: datetime,
    limit: int = 500,
) -> List[datetime]:
    """[start, end] 구간에 실제로 방송될 시각들.

    scheduled_at 의 '시:분'이 매 회차의 시각이 된다.
    시작 이전(첫 예약일 전)에는 울리지 않는다.
    """
    base = to_kst(scheduled_at)
    if base is None:
        return []
    rule = normalize_rule(repeat_rule)
    start, end = to_kst(start), to_kst(end)
    if start is None or end is None or end < start:
        return []

    until: Optional[date] = None
    if rule.get("until"):
        try:
            until = date.fromisoformat(rule["until"])
        except ValueError:
            until = None

    first_day = base.date()
    # 훑기 시작할 날 — 첫 예약일보다 앞설 수는 없다
    day = max(start.date(), first_day)
    last_day = end.date()
    if until and until < last_day:
        last_day = until

    out: List[datetime] = []
    while day <= last_day and len(out) < limit:
        if _matches(rule, day, first_day):
            at = datetime(day.year, day.month, day.day,
                          base.hour, base.minute, base.second, tzinfo=KST)
            if start <= at <= end:
                out.append(at)
        day += timedelta(days=1)
    return out


def next_occurrence(scheduled_at: datetime, repeat_rule: Optional[Dict[str, Any]],
                    *, after: Optional[datetime] = None, horizon_days: int = 400) -> Optional[datetime]:
    """다음 방송 시각 — 없으면 None(끝난 1회성 예약 등)."""
    after = to_kst(after) or now_kst()
    occ = occurrences(scheduled_at, repeat_rule,
                      start=after + timedelta(seconds=1),
                      end=after + timedelta(days=horizon_days), limit=1)
    return occ[0] if occ else None
