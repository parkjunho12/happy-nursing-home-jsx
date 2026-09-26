"""간호기록 점검 — findings 검증·요약 계산 (DB 비의존 순수 함수).

findings 한 건: {id, date, weekday?, resident, resident_id?, room?, floor?, area, item,
                 kind: error|check|info, issue, staff?, time?, evidence?, exception?, residents?}
"""
from __future__ import annotations

import re
from typing import Any, Iterable

KINDS = ("error", "check", "info")
REQUIRED = ("id", "date", "resident", "area", "item", "kind", "issue")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_findings(findings: Any) -> list[str]:
    errors: list[str] = []
    if findings is None:
        return errors
    if not isinstance(findings, list):
        return ["findings 는 배열이어야 합니다."]
    seen: set[str] = set()
    for i, f in enumerate(findings):
        if not isinstance(f, dict):
            errors.append(f"[{i}] 객체가 아닙니다.")
            continue
        for k in REQUIRED:
            if f.get(k) in (None, ""):
                errors.append(f"[{i}] {k} 누락")
        if f.get("kind") not in KINDS:
            errors.append(f"[{i}] kind={f.get('kind')!r} (error/check/info 만 허용)")
        if f.get("date") and not DATE_RE.match(str(f["date"])):
            errors.append(f"[{i}] date 형식 오류: {f.get('date')!r}")
        fid = str(f.get("id"))
        if fid in seen:
            errors.append(f"[{i}] id 중복: {fid}")
        seen.add(fid)
    return errors


def _kind_bucket() -> dict[str, int]:
    return {"error": 0, "check": 0, "info": 0}


def build_summary(findings: Iterable[dict], home_nursing: Iterable[dict] | None = None) -> dict[str, Any]:
    """월 스냅샷 또는 날짜로 잘라낸 부분집합의 요약을 같은 규칙으로 다시 만든다."""
    rows = [f for f in (findings or []) if isinstance(f, dict)]
    by_kind = _kind_bucket()
    by_area: dict[str, int] = {}
    by_item: dict[str, int] = {}
    by_date: dict[str, dict[str, int]] = {}
    res: dict[str, dict[str, Any]] = {}
    staff: dict[str, dict[str, Any]] = {}
    for f in rows:
        k = f.get("kind") if f.get("kind") in KINDS else "check"
        by_kind[k] += 1
        area = str(f.get("area") or "기타")
        by_area[area] = by_area.get(area, 0) + 1
        item = f"{area} · {f.get('item') or ''}"
        by_item[item] = by_item.get(item, 0) + 1
        d = str(f.get("date") or "")
        by_date.setdefault(d, _kind_bucket())[k] += 1
        rid = f.get("resident_id")
        if rid:
            r = res.setdefault(str(rid), {"resident": f.get("resident"), "room": f.get("room"), **_kind_bucket(), "total": 0})
            r[k] += 1
            r["total"] += 1
        s = f.get("staff")
        if s:
            row = staff.setdefault(str(s), {"staff": str(s), **_kind_bucket(), "total": 0})
            row[k] += 1
            row["total"] += 1
    by_resident = sorted(res.values(), key=lambda r: (-r["error"], -r["check"], -r["total"], str(r["resident"])))
    by_staff = sorted(staff.values(), key=lambda r: (-r["error"], -r["total"], r["staff"]))
    hn = [h for h in (home_nursing or []) if isinstance(h, dict)]
    home = {t: sum(1 for h in hn if h.get("type") == t and h.get("home_nursing")) for t in ("욕창간호", "비위관", "도뇨관")}
    return {
        "total": len(rows), "by_kind": by_kind, "by_area": by_area, "by_item": by_item,
        "by_date": by_date, "by_resident": by_resident, "by_staff": by_staff, "home_nursing": home,
    }


def slice_by_date(rows: Iterable[dict], start: str, end: str) -> list[dict]:
    out = []
    for f in rows or []:
        d = str((f or {}).get("date") or "")
        if start <= d <= end:
            out.append(f)
    return out
