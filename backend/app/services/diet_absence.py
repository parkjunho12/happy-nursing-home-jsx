"""식이 현황에 붙는 「외박」 표시 — 케어포 외출·외박 기록이 근거다.

밥을 나르는 손이 알아야 하는 것은 하나다: 이 어르신이 오늘 자리에 계신가.
그 답은 케어포(장기요양 급여기록)의 외박 기록에서 온다. 우리 일정표의
외박 일정은 '계획'이라 근거로 쓰지 않고, 귀원 기록이 케어포와 어긋날 때
그 사실만 알린다 — 어느 쪽도 고쳐 쓰지 않는다.

순수 함수만 둔다. DB·ORM 을 모르고, 넘겨받은 객체의 속성만 읽는다.
그래서 SimpleNamespace 로 바로 시험할 수 있다.

규칙
  · 외박만 본다. 외출·병원외출·기타는 외박 표시 대상이 아니므로 여기서는 제외한다.
  · 이름 매칭은 공백 정규화 후 완전 일치만. 비슷한 이름으로 짐작하지 않는다.
    같은 이름이 둘이면(재원자 동명이인, 또는 케어포 쪽 코드가 둘) 아무에게도
    붙이지 않는다 — 틀린 사람에게 '외박중' 을 붙이는 것이 가장 나쁘다.
  · 수급자 코드가 양쪽에 다 있으면 코드로 먼저 맞춘다.
  · 시각은 모두 KST 로 본다.
      - 오늘 보기: 아직 출발 시각 전이면 '외박예정', 돌아온 시각이 지났으면
        '외박·복귀', 그 사이면 '외박중'.
      - 지난 날 보기: 그날 돌아오셨으면 '외박·복귀'(그날 일부는 안 계셨다),
        아니면 '외박중'.
      - 앞날 보기: 실제가 아니라 계획이므로 모두 '외박예정'.
  · 일정표(ScheduleEvent) 는 같은 어르신 + 같은 출발 '날짜'(시각은 달라도)
    인 외박 일정만 짝으로 본다. 취소된 일정은 없는 것으로 친다. 귀원 기록이
    케어포 복귀 기록과 어긋나면 conflict 로 알리기만 한다.

응답 한 줄의 모양(absence)
  {label: '외박중'|'외박·복귀'|'외박예정', source: '케어포',
   start_date, start_time, end_date, end_time,
   conflict: bool, conflict_message?: str, observed_at?: str}
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

KST = timezone(timedelta(hours=9))
SOURCE = "케어포"

LABEL_AWAY = "외박중"
LABEL_RETURNED = "외박·복귀"
LABEL_PLANNED = "외박예정"

OVERNIGHT = "외박"
SCHEDULE_CATEGORY = "외박"
CANCELED = ("canceled", "cancelled")

_WS = re.compile(r"\s+")
_BRACKET_PREFIX = re.compile(r"^\s*\[[^\]]*\]\s*")
_HONORIFIC = re.compile(r"\s*어르신\s*$")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME = re.compile(r"^(\d{1,2}):(\d{2})")


# ── 이름 ────────────────────────────────────────────────────────────────
def norm_name(s: Any) -> str:
    """공백(전각·NBSP 포함)을 모두 걷어낸 이름. '가 상다' 과 '가상다' 은 같은 분이다."""
    if s is None:
        return ""
    return _WS.sub("", str(s).replace("\u3000", " ").replace("\xa0", " ")).strip()


def schedule_title_name(title: Any) -> str:
    """일정 제목에서 어르신 이름만 남긴다.

    '[외박] 가상나 어르신' → '가상나', '가상가' → '가상가', '[외박] 가 상다 어르신' → '가상다'.
    이름 뒤에 다른 말이 붙은 제목('가상가G 갱신')은 이름으로 보지 않는다 —
    그런 제목은 외박 일정이 아니었다.
    """
    t = _BRACKET_PREFIX.sub("", str(title or ""))
    t = _HONORIFIC.sub("", t)
    return norm_name(t)


def _code(o: Any) -> str:
    return str(getattr(o, "resident_code", None) or "").strip()


# ── 시각 ────────────────────────────────────────────────────────────────
def to_kst(dt: Optional[datetime]) -> Optional[datetime]:
    """어느 시간대로 들어와도 KST 로. naive 는 KST 로 적힌 것으로 본다."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=KST)
    return dt.astimezone(KST)


def _hhmm(t: Any, default: str) -> Tuple[int, int]:
    m = _TIME.match(str(t or "").strip())
    if not m:
        m = _TIME.match(default)
    h, mi = int(m.group(1)), int(m.group(2))
    return (min(max(h, 0), 23), min(max(mi, 0), 59))


def _dt(d: Optional[str], t: Any, default_time: str) -> Optional[datetime]:
    if not d or not _DATE.match(str(d)[:10]):
        return None
    y, mo, da = int(d[:4]), int(d[5:7]), int(d[8:10])
    h, mi = _hhmm(t, default_time)
    return datetime(y, mo, da, h, mi, tzinfo=KST)


def _date_str(d: Any) -> Optional[str]:
    s = str(d or "")[:10]
    if not _DATE.match(s):
        return None
    try:
        date.fromisoformat(s)
    except ValueError:
        return None
    return s


# ── 기록 고르기 ──────────────────────────────────────────────────────────
def is_overnight(rec: Any) -> bool:
    return norm_name(getattr(rec, "leave_type", None)) == OVERNIGHT


def covers(rec: Any, on: str) -> bool:
    """그 기록이 그날에 걸쳐 있는가. 달이 바뀌어도 날짜 문자열 비교로 충분하다."""
    start = _date_str(getattr(rec, "start_date", None))
    if not start or start > on:
        return False
    end = _date_str(getattr(rec, "end_date", None))
    return end is None or end >= on


def _observed(rec: Any) -> Optional[str]:
    """이 기록을 케어포에서 언제 받아왔나 — raw_data 에 적혀 있으면 그것, 없으면 저장 시각."""
    raw = getattr(rec, "raw_data", None)
    if isinstance(raw, dict):
        for k in ("capturedAt", "captured_at", "observed_at", "observedAt"):
            v = raw.get(k)
            if v:
                return str(v)
    for k in ("updated_at", "created_at"):
        v = getattr(rec, k, None)
        if isinstance(v, datetime):
            return to_kst(v).isoformat()
        if v:
            return str(v)
    return None


def label_for(rec: Any, on: str, now: datetime) -> Optional[str]:
    """그날·지금 기준으로 이 외박 기록에 붙일 말. 해당 없으면 None."""
    if not covers(rec, on):
        return None
    now = to_kst(now)
    today = now.date().isoformat()
    start = _date_str(getattr(rec, "start_date", None))
    end = _date_str(getattr(rec, "end_date", None))

    if on > today:                      # 앞날 — 실제가 아니라 계획
        return LABEL_PLANNED

    if on == today:
        start_dt = _dt(start, getattr(rec, "start_time", None), "00:00")
        if start == on and start_dt and start_dt > now:
            return LABEL_PLANNED        # 오늘 나가실 예정이지만 아직 계신다
        if end == on:
            end_dt = _dt(end, getattr(rec, "end_time", None), "23:59")
            if end_dt and end_dt <= now:
                return LABEL_RETURNED   # 돌아오셨다 — 그래도 오늘 일부는 안 계셨다
            return LABEL_AWAY           # 오늘 돌아올 예정이나 아직
        return LABEL_AWAY

    # 지난 날
    if end == on:
        return LABEL_RETURNED
    return LABEL_AWAY


def pick(records: Iterable[Any], on: str) -> Optional[Any]:
    """한 어르신의 여러 기록 중 그날에 걸친 것 하나 — 가장 최근 출발을 고른다."""
    cands = [r for r in records if is_overnight(r) and covers(r, on)]
    if not cands:
        return None
    cands.sort(key=lambda r: (_date_str(getattr(r, "start_date", None)) or "",
                              str(getattr(r, "start_time", None) or "")))
    return cands[-1]


# ── 일정표와 맞춰 보기 ───────────────────────────────────────────────────
def _is_active_overnight_event(ev: Any) -> bool:
    if norm_name(getattr(ev, "category", None)) != SCHEDULE_CATEGORY:
        return False
    return str(getattr(ev, "status", "") or "").lower() not in CANCELED


def matching_event(events: Iterable[Any], name_key: str, start_date: str) -> Optional[Any]:
    """같은 어르신·같은 출발 날짜(KST)의 외박 일정. 시각이 달라도 같은 외박으로 본다."""
    for ev in events:
        if not _is_active_overnight_event(ev):
            continue
        if schedule_title_name(getattr(ev, "title", None)) != name_key:
            continue
        s = to_kst(getattr(ev, "start_at", None))
        if s is None or s.date().isoformat() != start_date:
            continue
        return ev
    return None


def conflict_of(rec: Any, ev: Optional[Any], on: str) -> Tuple[bool, Optional[str]]:
    """일정표의 실제 귀원 기록이 케어포 복귀 기록과 어긋나는가.

    보는 날짜에 영향이 있을 때만 어긋남으로 친다: 어느 한쪽이 그날 또는
    그 전에 돌아오셨다고 하는데 다른 쪽은 다르게 말할 때다. 둘 다 '그날엔
    안 계셨다' 로 같은 말을 하면 날짜만 다른 복귀 기록도 그날의 밥상에는
    문제가 아니다.
    """
    if ev is None:
        return False, None
    ret = to_kst(getattr(ev, "returned_at", None))
    if ret is None:
        return False, None
    ret_date = ret.date().isoformat()
    end = _date_str(getattr(rec, "end_date", None))
    end_time = str(getattr(rec, "end_time", None) or "").strip()
    time_diff = end == ret_date and on == end and bool(end_time) and end_time[:5] != ret.strftime("%H:%M")
    if end == ret_date and not time_diff:
        return False, None
    if not (ret_date <= on or (end is not None and end <= on)):
        return False, None
    sched = f"일정표 귀원 {ret.month}/{ret.day} {ret.strftime('%H:%M')}"
    if end is None:
        care = "케어포 복귀 미기록"
    else:
        et = str(getattr(rec, "end_time", None) or "").strip()
        care = f"케어포 복귀 {int(end[5:7])}/{int(end[8:10])}" + (f" {et}" if et else "")
    return True, f"귀원기록상이 — {sched} · {care}"


# ── 한 줄로 ─────────────────────────────────────────────────────────────
def absence_row(rec: Any, on: str, now: datetime, ev: Optional[Any] = None) -> Optional[Dict[str, Any]]:
    label = label_for(rec, on, now)
    if label is None:
        return None
    conflict, msg = conflict_of(rec, ev, on)
    out: Dict[str, Any] = {
        "label": label,
        "source": SOURCE,
        "start_date": _date_str(getattr(rec, "start_date", None)),
        "start_time": getattr(rec, "start_time", None) or None,
        "end_date": _date_str(getattr(rec, "end_date", None)),
        "end_time": getattr(rec, "end_time", None) or None,
        "conflict": conflict,
    }
    if msg:
        out["conflict_message"] = msg
    obs = _observed(rec)
    if obs:
        out["observed_at"] = obs
    return out


def build(residents: Iterable[Any], leave_records: Iterable[Any],
          schedule_events: Iterable[Any], on: str,
          now: Optional[datetime] = None) -> Dict[str, Optional[Dict[str, Any]]]:
    """재원 어르신 목록 → {resident.id: absence | None}.

    residents 는 그날 재원 중인 분들 전체를 넘긴다(층 필터 전). 동명이인
    판정이 여기서 이뤄지기 때문이다.
    """
    now = to_kst(now or datetime.now(KST))
    res_list = list(residents)
    leaves = [r for r in leave_records if is_overnight(r)]
    events = list(schedule_events)

    # 재원자 이름이 둘 이상이면 그 이름은 아무에게도 붙이지 않는다
    name_count: Dict[str, int] = {}
    for r in res_list:
        k = norm_name(getattr(r, "name", None))
        if k:
            name_count[k] = name_count.get(k, 0) + 1

    # 케어포 쪽에서 같은 이름에 서로 다른 코드가 붙어 있으면 그 이름도 애매하다
    by_name: Dict[str, List[Any]] = {}
    codes_by_name: Dict[str, set] = {}
    by_code: Dict[str, List[Any]] = {}
    for lr in leaves:
        k = norm_name(getattr(lr, "resident_name", None))
        by_name.setdefault(k, []).append(lr)
        ident = _code(lr) or str(getattr(lr, "resident_id", None) or "").strip()
        if ident:
            codes_by_name.setdefault(k, set()).add(ident)
        if _code(lr):
            by_code.setdefault(_code(lr), []).append(lr)

    out: Dict[str, Optional[Dict[str, Any]]] = {}
    for r in res_list:
        rid = getattr(r, "id", None)
        out[rid] = None
        key = norm_name(getattr(r, "name", None))
        if not key:
            continue

        code = _code(r)
        if code and code in by_code:
            mine = by_code[code]                       # 코드가 양쪽에 있으면 그것이 답
        else:
            if name_count.get(key, 0) != 1:
                continue                               # 재원자 동명이인
            if len(codes_by_name.get(key, ())) > 1:
                continue                               # 케어포에 같은 이름이 둘
            mine = by_name.get(key, [])

        rec = pick(mine, on)
        if rec is None:
            continue
        ev = matching_event(events, key, _date_str(getattr(rec, "start_date", None)) or "")
        out[rid] = absence_row(rec, on, now, ev)
    return out


def earliest_start(records: Iterable[Any]) -> Optional[date]:
    """일정표를 얼마나 거슬러 읽어야 하나 — 걸친 기록 중 가장 이른 출발일."""
    ds = [_date_str(getattr(r, "start_date", None)) for r in records]
    ds = [d for d in ds if d]
    if not ds:
        return None
    d = min(ds)
    return date(int(d[:4]), int(d[5:7]), int(d[8:10]))
