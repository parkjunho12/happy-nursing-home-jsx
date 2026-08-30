"""근무 코드 → 시간. 화면(TypeScript)과 같은 규칙을 파이썬으로 옮긴 것.

■ 왜 두 벌이 필요한가

  총시간은 화면에서 계산해 저장할 때 함께 담는다. 엑셀은 그 값을 읽는다.
  그런데 이 기능이 생기기 전에 저장된 달에는 그 값이 없다. 급여와 직결되는
  숫자를 '한 번 저장하셔야 나옵니다' 로 둘 수는 없다. 그래서 값이 없을 때만
  여기서 계산한다.

■ 갈라지지 않게 하는 법

  같은 계산을 두 곳에 적으면 언젠가 어긋난다. 예전에 그렇게 어긋난 적이
  있고, 그때 어느 쪽이 맞는지 아무도 몰랐다.

  그래서 검증표(app/data/shift_hours_fixture.json)를 하나 두고 양쪽이 같은
  표를 통과하게 한다.
    · 이 파일의 테스트가 그 표를 확인한다
    · apps/admin 의 테스트도 같은 표를 확인한다
  누가 한쪽 규칙을 바꾸면 그쪽 테스트가 먼저 깨진다. 표를 고치면 반대쪽
  테스트가 깨진다. 한쪽만 조용히 바뀌는 길이 없다.

  기준이 되는 것은 언제나 화면 쪽(apps/admin/src/utils/shiftCodes.ts)이다.
  여기는 그것을 따라간다.
"""
from __future__ import annotations

import re
from typing import Dict, Iterable, Optional

# 근무 코드별 시간 — shiftCodes.ts 의 SHIFT_CODES 와 같아야 한다
CODE_HOURS: Dict[str, float] = {
    "D": 8,        # 주간 08:50~18:00 (휴게 70분)
    "M": 8,        # 모닝 06:50~16:00
    "AD": 4,       # 오전 09:00~13:30
    "PD": 4,       # 오후 13:30~18:00
    "N": 9,        # 야간 17:50~익일 09:00
    "休": 8,       # 연차 — 유급이라 근무한 것과 같이 총시간에 든다
    "대휴": 0,
    "초과휴": 0,
    "◆병": 0,
    "◆": 0,
}

# '0850 1600' 처럼 직접 적은 시간대
_TIME_RE = re.compile(r"^(\d{1,2})[:\s]?(\d{2})\s*[-~\s]\s*(\d{1,2})[:\s]?(\d{2})$")

FACILITY_BREAK_MIN = 70


def break_minutes(span_minutes: int) -> int:
    """근무폭에 따른 휴게시간(분).

    시설 기준은 1시간 10분. 다만 2~4시간짜리 짧은 근무에까지 70분을 빼면
    실근무가 비현실적으로 줄어들어, 그 구간은 법정 최소치를 따른다.
    """
    if span_minutes >= 300:
        return FACILITY_BREAK_MIN
    if span_minutes > 240:
        return 30
    return 0


def resolve_hours(overrides: Optional[Dict[str, float]] = None) -> Dict[str, float]:
    """설정에서 고친 값을 기본값 위에 얹는다.

    설정에 없는 코드는 기본값 그대로. 모르는 코드가 들어와도 무시한다 —
    설정이 잘못됐다고 계산이 멈추면 그게 더 나쁘다.
    """
    table = dict(CODE_HOURS)
    _put(table, overrides)
    return table


def _put(table: Dict[str, float], o) -> None:
    """아는 코드만, 말이 되는 값만 덮는다.

    화면(shiftCodes.ts 의 resolveCodeHours)과 같은 규칙이어야 한다.
    한쪽만 범위를 안 보면 99시간짜리 설정을 한쪽만 받아들여, 근무표와
    급여 대장의 숫자가 갈라진다.
    """
    for k, v in (o or {}).items():
        if k not in table:
            continue
        try:
            n = float(v)
        except (TypeError, ValueError):
            continue
        if 0 <= n <= 24:
            table[k] = n


def resolve_for_month(month: Optional[str],
                      base: Optional[Dict[str, float]] = None,
                      rules: Optional[list] = None) -> Dict[str, float]:
    """그 달에 쓸 코드별 시간.

    기본값 → 전체 기간 설정(base) → 시점 설정(rules) 순서로 덮는다.
    시점 설정은 [{"from": "2026-09", "hours": {"N": 10}}, …] 모양이고,
    'from' 이 그 달 이하인 것만 오래된 순서로 적용한다.

    왜 시점이 필요한가: 야간이 9시간에서 10시간으로 바뀌면 바뀐 달부터
    그렇게 세야 한다. 하나의 값으로 두면 이미 급여를 지급한 지난달 숫자까지
    함께 달라진다.

    month 가 없으면 시점 설정은 건너뛴다 — 어느 달인지 모르면서 특정 달의
    규칙을 적용할 수는 없다.
    """
    table = resolve_hours(base)
    if not month or not rules:
        return table
    picked = []
    for r in rules:
        if not isinstance(r, dict):
            continue
        frm = str(r.get("from") or "")
        if frm and frm <= month:
            picked.append((frm, r.get("hours") or {}))
    for _frm, hrs in sorted(picked, key=lambda x: x[0]):
        _put(table, hrs)
    return table


def hours_of(raw: Optional[str], overrides: Optional[Dict[str, float]] = None) -> float:
    """정규 근무 코드의 시간만. 직접 입력한 시간대는 extra_hours_of 가 센다."""
    v = (raw or "").strip()
    if not v:
        return 0.0
    table = resolve_hours(overrides) if overrides else CODE_HOURS
    return float(table.get(v, 0))


def extra_hours_of(raw: Optional[str]) -> float:
    """직접 적은 시간대('0850 1600')의 근무시간."""
    v = (raw or "").strip()
    if not v or v in CODE_HOURS:
        return 0.0
    m = _TIME_RE.match(v.replace("\n", " "))
    if not m:
        return 0.0
    st = int(m.group(1)) * 60 + int(m.group(2))
    en = int(m.group(3)) * 60 + int(m.group(4))
    mins = (en - st + 1440) % 1440
    return max(0.0, round((mins - break_minutes(mins)) / 60, 1))


def month_total(codes: Optional[Dict[str, str]], days: Iterable[int],
                overrides: Optional[Dict[str, float]] = None) -> float:
    """한 달 총시간 (정규 + 추가근무). 기준시간과 견줄 때 쓰는 숫자."""
    row = codes or {}
    table = resolve_hours(overrides)
    hours = 0.0
    extra = 0.0
    for d in days:
        v = (row.get(str(d)) or "").strip()
        if not v:
            continue
        hours += float(table.get(v, 0))
        extra += extra_hours_of(v)
    return round(round(hours, 1) + round(extra, 1), 1)
