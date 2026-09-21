"""수가(급여) 계산기 — 시나리오 입력값(FeeInputs) 서버측 검증.

`apps/admin/src/utils/feeCalculator.ts` 의 `validateInputs()` 를 그대로 옮긴 것이다.
프론트가 같은 검증을 하고 있지만, 서버에 저장되는 값이 그 검증을 거치지 않고
들어오면(다른 클라이언트·버그·수동 API 호출 등) 나중에 GET 으로 불러온 다른
브라우저의 `calculateFee()` 가 `throw` 로 죽는다 — 그래서 저장 시점에 여기서도
같은 규칙으로 한 번 더 막는다.

의존성 없이(표준 라이브러리만으로) 돌아야 한다 — FastAPI/SQLAlchemy 를 몰라도
검증 로직만 따로 테스트할 수 있게.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any, Dict, List, Optional

SUPPORTED_YEAR = 2026

FEE_TIERS = {"enhanced", "standard"}

# frontend NUMERIC_KEYS
NUMERIC_KEYS = [
    "days",
    "averageResidents",
    "capacity",
    "copayRate",
    "mealPrice",
    "mealsPerDay",
    "snackPrice",
    "snacksPerDay",
    "noncoveredDays",
    "extraNursing",
    "extraSocial",
    "extraTherapy",
    "registeredNurses",
    "dayStaff",
    "nightStaff",
    "programPoints",
    "temporaryPoints",
    "caregiverFte",
    "payroll",
    "laborBasis",
    "otherCosts",
    "hireCost",
]

INTEGER_KEYS = {
    "days",
    "capacity",
    "mealsPerDay",
    "snacksPerDay",
    "noncoveredDays",
    "registeredNurses",
    "dayStaff",
    "nightStaff",
}

BOOLEAN_KEYS = ["programConfirmed", "staffingConfirmed", "nightConfirmed", "temporaryConfirmed"]

# frontend BOUNDS — 오타(0 하나 더 붙음)를 잡기 위한 계획용 경계
BOUNDS: Dict[str, float] = {
    "averageResidents": 1000,
    "capacity": 1000,
    "copayRate": 0.2,
    "mealPrice": 100000,
    "mealsPerDay": 5,
    "snackPrice": 100000,
    "snacksPerDay": 5,
    "extraNursing": 100,
    "extraSocial": 100,
    "extraTherapy": 100,
    "registeredNurses": 100,
    "dayStaff": 500,
    "nightStaff": 500,
    "temporaryPoints": 20,
    "caregiverFte": 500,
}

PROGRAM_POINT_OPTIONS = (0, 0.25, 0.5)

_MONTH_RE = re.compile(r"^(\d{4})-(\d{2})$")

# 이 시나리오 API 가 저장을 허용하는 필드 전체(허용 목록) — 이 밖의 알 수 없는
# 키는 오타·프론트 버전 불일치를 조용히 저장하지 않도록 거절한다.
ALLOWED_KEYS = {
    "month",
    "tier",
    "counts",
    *NUMERIC_KEYS,
    *BOOLEAN_KEYS,
}


def days_in_month(month: str) -> Optional[int]:
    m = _MONTH_RE.match(month or "")
    if not m:
        return None
    year, mon = int(m.group(1)), int(m.group(2))
    if mon < 1 or mon > 12:
        return None
    if mon == 12:
        nxt = date(year + 1, 1, 1)
    else:
        nxt = date(year, mon + 1, 1)
    return (nxt - date(year, mon, 1)).days


def _is_finite_number(v: Any) -> bool:
    """bool 은 int 의 서브클래스라 True/False 가 숫자로 새는 것을 막는다."""
    if isinstance(v, bool):
        return False
    if not isinstance(v, (int, float)):
        return False
    # math.isfinite 없이도 판별(표준 라이브러리 math 를 쓰지만 순환 걱정 없음)
    import math

    return math.isfinite(v)


def validate_fee_inputs(x: Any, *, path_month: Optional[str] = None) -> List[str]:
    """FeeInputs 구조를 검증한다. 문제가 없으면 빈 리스트.

    `path_month` 를 주면 `x['month']` 와 URL 경로의 월이 같은지도 확인한다
    (다른 달로 잘못 저장되는 것을 막는다).
    """
    errors: List[str] = []
    if not isinstance(x, dict):
        return ["입력이 없습니다"]

    # 허용되지 않은 키 — 프론트 스키마에 없는 필드가 조용히 저장되는 것을 막는다
    unknown = sorted(set(x.keys()) - ALLOWED_KEYS)
    if unknown:
        errors.append(f"알 수 없는 필드: {', '.join(unknown)}")

    month = x.get("month")
    if not isinstance(month, str) or not _MONTH_RE.match(month):
        errors.append("month: 'YYYY-MM' 형식이어야 합니다")
    else:
        dim = days_in_month(month)
        if dim is None:
            errors.append("month: 존재하지 않는 달입니다")
        elif int(month[:4]) != SUPPORTED_YEAR:
            errors.append(f"month: {SUPPORTED_YEAR}년 수가만 지원합니다")
        elif path_month is not None and month != path_month:
            errors.append(f"month: 요청 경로({path_month})와 inputs.month({month})가 다릅니다")

    tier = x.get("tier")
    if tier not in FEE_TIERS:
        errors.append("tier: 'enhanced' 또는 'standard'여야 합니다")

    counts = x.get("counts")
    if not isinstance(counts, list) or len(counts) != 3:
        errors.append("counts: [1등급, 2등급, 3~5등급] 세 칸이어야 합니다")
    else:
        for i, c in enumerate(counts):
            if not _is_finite_number(c) or c < 0 or float(c) != int(c):
                errors.append(f"counts[{i}]: 0 이상 정수여야 합니다")
            elif c > 1000:
                errors.append(f"counts[{i}]: 1000 이하여야 합니다")

    for key in NUMERIC_KEYS:
        v = x.get(key)
        if not _is_finite_number(v):
            errors.append(f"{key}: 숫자여야 합니다")
            continue
        if v < 0:
            errors.append(f"{key}: 음수일 수 없습니다")
        if key in INTEGER_KEYS and float(v) != int(v):
            errors.append(f"{key}: 정수여야 합니다")
        max_ = BOUNDS.get(key)
        if max_ is not None and v > max_:
            errors.append(f"{key}: {max_} 이하여야 합니다")

    for key in BOOLEAN_KEYS:
        if not isinstance(x.get(key), bool):
            errors.append(f"{key}: true/false여야 합니다")

    dim = days_in_month(month) if isinstance(month, str) else None
    if dim is not None:
        days = x.get("days")
        if _is_finite_number(days) and days > dim:
            errors.append(f"days: {month}은 {dim}일까지입니다")
        noncovered_days = x.get("noncoveredDays")
        if _is_finite_number(noncovered_days) and noncovered_days > dim:
            errors.append(f"noncoveredDays: {month}은 {dim}일까지입니다")

    program_points = x.get("programPoints")
    if _is_finite_number(program_points) and not any(
        abs(program_points - p) < 1e-9 for p in PROGRAM_POINT_OPTIONS
    ):
        errors.append("programPoints: 0, 0.25, 0.5 중 하나여야 합니다")

    return errors
