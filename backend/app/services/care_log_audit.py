"""주간 급여제공 기록지 점검 — 순수 계산 helper (DB 없음).

외부 루틴이 findings(케어포 판정 결과)를 올리면, summary 가 비어 있을 때
서버가 여기서 by_kind/by_staff/by_area/by_date/total 을 계산해 채운다.
"""
from __future__ import annotations
from typing import Any, Optional

REQUIRED_KEYS = ("id", "date", "resident", "area", "item", "kind", "issue")
VALID_KINDS = ("error", "blank", "check")


def validate_findings(findings: Optional[list]) -> list[str]:
    """findings 를 검증해 문제 문구 목록을 돌려준다. 비어 있으면 통과(빈 리스트)."""
    errors: list[str] = []
    if findings is None:
        return errors
    if not isinstance(findings, list):
        return ["findings 는 배열이어야 합니다."]
    for i, f in enumerate(findings):
        no = i + 1
        if not isinstance(f, dict):
            errors.append(f"{no}번째 항목: 객체가 아닙니다.")
            continue
        for key in REQUIRED_KEYS:
            if not f.get(key):
                errors.append(f"{no}번째 항목: {key} 이(가) 비어 있습니다.")
        kind = f.get("kind")
        if kind and kind not in VALID_KINDS:
            errors.append(f"{no}번째 항목: kind 값이 올바르지 않습니다({kind}). error/blank/check 중 하나여야 합니다.")
    return errors


def build_summary(findings: Optional[list]) -> dict[str, Any]:
    """findings 로 요약을 계산한다. 각 finding 은 위 필수키를 갖는다고 본다."""
    findings = findings or []

    total = len(findings)
    by_kind: dict[str, int] = {"error": 0, "blank": 0, "check": 0}
    by_area: dict[str, int] = {}
    by_date: dict[str, int] = {}
    by_resident: dict[str, dict[str, Any]] = {}
    staff_rows: dict[str, dict[str, Any]] = {}

    def _staff_row(name: str) -> dict[str, Any]:
        return staff_rows.setdefault(name, {
            "staff": name, "error": 0, "blank_owner": 0, "shared": 0, "check": 0,
        })

    for f in findings:
        kind = f.get("kind")
        if kind in by_kind:
            by_kind[kind] += 1

        area = f.get("area") or "기타"
        by_area[area] = by_area.get(area, 0) + 1

        date = f.get("date")
        if date:
            by_date[date] = by_date.get(date, 0) + 1

        resident = f.get("resident")
        if resident:
            row = by_resident.setdefault(resident, {
                "resident": resident, "room": f.get("room") or "", "total": 0,
            })
            row["total"] += 1

        if kind == "error":
            staff = f.get("staff")
            if staff:
                _staff_row(staff)["error"] += 1
            else:
                # 하루 합계 기준(교체 6회 등)은 한 사람 오류가 아니라 당일 담당자 공동 항목
                for owner in (f.get("owner_candidates") or []):
                    if owner:
                        _staff_row(owner)["shared"] += 1
        elif kind == "blank":
            for owner in (f.get("owner_candidates") or []):
                if owner:
                    _staff_row(owner)["blank_owner"] += 1
        elif kind == "check":
            staff = f.get("staff")
            if staff:
                _staff_row(staff)["check"] += 1

    by_staff = []
    for row in staff_rows.values():
        row = dict(row)
        row["total"] = row["error"] + row["blank_owner"] + row.get("shared", 0) + row["check"]
        by_staff.append(row)
    by_staff.sort(key=lambda r: (-(r["error"] + r["blank_owner"] + r.get("shared", 0)), r["staff"]))

    by_resident_list = sorted(by_resident.values(), key=lambda r: (-r["total"], r["resident"]))

    return {
        "total": total,
        "by_kind": by_kind,
        "by_staff": by_staff,
        "by_area": by_area,
        "by_resident": by_resident_list,
        "by_date": by_date,
    }


def top_staff(summary: Optional[dict], n: int = 3) -> list[dict[str, Any]]:
    """상위 n 명 — 화면·대시보드 카드에서 그대로 쓸 형태."""
    rows = (summary or {}).get("by_staff") or []
    return [{
        "staff": r.get("staff"),
        "error": r.get("error", 0),
        "blank_owner": r.get("blank_owner", 0),
        "shared": r.get("shared", 0),
        "total": r.get("total", 0),
    } for r in rows[:n]]
