"""
시간대/요일별 방문·문의 데이터 → 입찰 가중치(dayparting) 분석.

입력: 네이버 프리미엄 로그 분석의 시간대/요일 리포트.
  컬럼: 라벨 | 클릭(전체) | 이탈률(%) | 회원가입 | 문의 | 주문 | 매출 | 방문당 체류시간(초)
출력: 시간/요일별 입찰 가중치(0.7~1.3)와 현재 시각 가중치, 분석 요약.

가중치 산식(베이스 1.0):
  multiplier = 0.15 + 0.60*클릭비율 + 0.25*체류비율 + 문의보너스 - 이탈패널티
  - 클릭비율 = 해당버킷 클릭 / 평균 클릭 (수요/트래픽)
  - 체류비율 = 해당버킷 체류 / 평균 체류 (참여도)
  - 문의보너스 = 문의>0 이면 +0.15 (상담 전환 신호)
  - 이탈패널티 = max(0, 이탈률-평균이탈률)/100 * 0.5
  → 0.7~1.3 으로 클램프
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Tuple

KST = timezone(timedelta(hours=9))
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]

MULT_MIN = 0.7
MULT_MAX = 1.3


def _to_int(x: str) -> int:
    try:
        return int(float(str(x).replace("%", "").replace("₩", "").replace(",", "")))
    except (TypeError, ValueError):
        return 0


def _row_from_parts(parts: List[str]) -> Dict[str, int]:
    # parts: label, clicks, bounce%, signup, inquiry, order, revenue, dwell
    return {
        "clicks": _to_int(parts[1]) if len(parts) > 1 else 0,
        "bounce": _to_int(parts[2]) if len(parts) > 2 else 0,
        "inquiry": _to_int(parts[4]) if len(parts) > 4 else 0,
        "dwell": _to_int(parts[7]) if len(parts) > 7 else 0,
    }


def parse_dayparting(text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """붙여넣은 리포트 텍스트 → (hours, weekdays)."""
    hours: List[Dict[str, Any]] = []
    weekdays: List[Dict[str, Any]] = []
    for raw in (text or "").splitlines():
        parts = raw.replace("₩", "").replace(",", "").split()
        if len(parts) < 5:
            continue
        label = parts[0]
        if label.isdigit() and 0 <= int(label) <= 23:
            row = _row_from_parts(parts)
            row["hour"] = int(label)
            hours.append(row)
        elif label in WEEKDAYS:
            row = _row_from_parts(parts)
            row["day"] = label
            weekdays.append(row)
    return hours, weekdays


def _mean(vals: List[float]) -> float:
    vals = [v for v in vals]
    return (sum(vals) / len(vals)) if vals else 0.0


def _multiplier(row: Dict[str, Any], mean_clicks: float, mean_dwell: float, mean_bounce: float) -> float:
    click_ratio = (row["clicks"] / mean_clicks) if mean_clicks else 1.0
    dwell_ratio = (row["dwell"] / mean_dwell) if mean_dwell else 1.0
    inquiry_bonus = 0.15 if row.get("inquiry", 0) > 0 else 0.0
    bounce_penalty = max(0.0, (row["bounce"] - mean_bounce)) / 100.0 * 0.5
    m = 0.15 + 0.60 * click_ratio + 0.25 * dwell_ratio + inquiry_bonus - bounce_penalty
    return round(max(MULT_MIN, min(MULT_MAX, m)), 2)


def _annotate(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    mean_clicks = _mean([r["clicks"] for r in rows])
    mean_dwell = _mean([r["dwell"] for r in rows])
    mean_bounce = _mean([r["bounce"] for r in rows])
    for r in rows:
        r["multiplier"] = _multiplier(r, mean_clicks, mean_dwell, mean_bounce)
    return rows


def compute_dayparting_plan(hours: List[Dict[str, Any]], weekdays: List[Dict[str, Any]]) -> Dict[str, Any]:
    hours = _annotate(list(hours))
    weekdays = _annotate(list(weekdays))

    hour_map = {h["hour"]: h["multiplier"] for h in hours}
    day_map = {w["day"]: w["multiplier"] for w in weekdays}

    now = datetime.now(KST)
    cur_hour = now.hour
    cur_day = WEEKDAYS[now.weekday()]
    hm = hour_map.get(cur_hour, 1.0)
    wm = day_map.get(cur_day, 1.0)
    cur_mult = round(max(MULT_MIN, min(MULT_MAX, hm * wm)), 2)

    # 분석 요약
    top_hours = sorted(hours, key=lambda r: r["multiplier"], reverse=True)[:3]
    low_hours = sorted(hours, key=lambda r: r["multiplier"])[:3]
    top_days = sorted(weekdays, key=lambda r: r["multiplier"], reverse=True)[:2]
    inquiry_hours = [h["hour"] for h in hours if h.get("inquiry", 0) > 0]
    inquiry_days = [w["day"] for w in weekdays if w.get("inquiry", 0) > 0]

    key_findings = []
    if top_hours:
        key_findings.append("방문/참여가 높은 시간대: " + ", ".join(f"{h['hour']}시(x{h['multiplier']})" for h in top_hours))
    if low_hours:
        key_findings.append("약한 시간대: " + ", ".join(f"{h['hour']}시(x{h['multiplier']})" for h in low_hours))
    if top_days:
        key_findings.append("강한 요일: " + ", ".join(f"{w['day']}(x{w['multiplier']})" for w in top_days))
    if inquiry_hours:
        key_findings.append("문의 발생 시간대: " + ", ".join(f"{h}시" for h in inquiry_hours))
    if inquiry_days:
        key_findings.append("문의 발생 요일: " + ", ".join(inquiry_days))

    recommended_actions = [
        f"피크 시간대({', '.join(str(h['hour'])+'시' for h in top_hours)})에는 입찰가를 가중치만큼 상향",
        f"약한 시간대({', '.join(str(h['hour'])+'시' for h in low_hours)})에는 입찰가를 하향해 예산 절약",
    ]
    if inquiry_days:
        recommended_actions.append(f"문의가 나온 {', '.join(inquiry_days)} 요일 가중치를 우선 반영")

    summary = (
        f"현재({cur_day} {cur_hour}시) 권장 입찰 가중치는 x{cur_mult} 입니다. "
        "방문 집중·문의 발생 시간대에 예산을 집중하고, 한가한 시간대는 절감하도록 시간대/요일 가중치를 산출했습니다."
    )

    return {
        "hours": hours,
        "weekdays": weekdays,
        "current": {
            "hour": cur_hour,
            "weekday": cur_day,
            "hour_multiplier": hm,
            "weekday_multiplier": wm,
            "multiplier": cur_mult,
        },
        "summary": summary,
        "key_findings": key_findings,
        "recommended_actions": recommended_actions,
    }


def current_multiplier(hours: List[Dict[str, Any]], weekdays: List[Dict[str, Any]]) -> float:
    plan = compute_dayparting_plan(hours, weekdays)
    return plan["current"]["multiplier"]
