"""식이 현황 — 어느 어르신이 무엇을 드시는가.

보기는 전 직원이 한다. 밥을 나르는 사람이 봐야 하는 정보다.
고치는 것은 식이를 판단하는 자리(간호·영양·사회복지 라인)까지만 연다.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.eval import LtcResident
from app.models.resident_diet import DietChange
from app.models.user import User
from app.schemas.response import ApiResponse
from app.services import diet_state as ds

logger = logging.getLogger(__name__)
router = APIRouter()

KST = timezone(timedelta(hours=9))
_D = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# 식이를 바꿀 수 있는 자리. 삼킴 상태를 보고 판단하는 사람들이다.
EDIT_POSITIONS = ("시설장", "대표", "이사", "사회복지사", "영양사",
                  "간호팀장", "간호사", "간호조무사")


def _today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def _pos(u) -> str:
    p = getattr(u, "position", None)
    return p.value if hasattr(p, "value") else str(p or "")


def _role(u) -> str:
    r = getattr(u, "role", None)
    return r.value if hasattr(r, "value") else str(r or "")


def can_edit_diet(role: str, pos: Optional[str]) -> bool:
    """식이를 바꿀 수 있는가. 보기는 모든 직원이 한다 — 배식하는 손이 봐야 한다."""
    return role == "ADMIN" or (pos or "") in EDIT_POSITIONS


def _editor(current_user: User = Depends(get_current_user)) -> User:
    if not can_edit_diet(_role(current_user), _pos(current_user)):
        raise HTTPException(403, "식이를 바꿀 권한이 없습니다. (관리자·시설장·사회복지사·영양사·간호팀)")
    return current_user


def _importer(current_user: User = Depends(get_current_user)) -> User:
    """엑셀 가져오기는 한 번에 수백 건을 쓴다 — 관리자·시설장만."""
    if _role(current_user) != "ADMIN" and _pos(current_user) != "시설장":
        raise HTTPException(403, "가져오기 권한이 없습니다. (관리자·시설장)")
    return current_user


def _in_house(r: LtcResident, on: str) -> bool:
    """그날 재원 중인 어르신인가 — 식수 정산과 같은 기준."""
    if (r.status or "") == "pending":
        return False
    adm = (r.admission_date or "")[:10]
    if not adm or adm > on:
        return False
    dis = (r.discharge_date or "")[:10]
    return not (dis and dis < on)


def _rows(c: DietChange) -> Dict[str, Any]:
    return {"id": c.id, "resident_id": c.resident_id, "name": c.resident_name,
            "effective_date": c.effective_date, "rice": c.rice, "side": c.side,
            "tube": bool(c.tube), "note": c.note, "source": c.source,
            "changed_by": c.changed_by,
            "created_at": c.created_at.isoformat() if c.created_at else None}


def _by_resident(db: Session) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = {}
    for c in db.query(DietChange).all():
        out.setdefault(c.resident_id, []).append(_rows(c))
    return out


@router.get("")
def current(date: Optional[str] = Query(None), floor: Optional[str] = Query(None),
            db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """그날 기준 식이 현황 + 주방에 넘길 집계.

    날짜를 주면 그날로 되감아 본다 — 시트를 넘기지 않고 '6월 3일엔 뭘
    드셨나' 를 바로 답한다.
    """
    on = date or _today()
    if not _D.match(on):
        raise HTTPException(400, "date 는 YYYY-MM-DD 형식이어야 합니다.")

    changes = _by_resident(db)
    people = []
    for r in db.query(LtcResident).all():
        if not _in_house(r, on):
            continue
        if floor and (r.floor or "") != floor:
            continue
        mine = changes.get(r.id, [])
        st = ds.state_at(mine, on)
        nxt = ds.next_change(mine, on)
        people.append({
            "resident_id": r.id, "name": r.name,
            "floor": r.floor, "room": r.room,
            "rice": (st or {}).get("rice"), "side": (st or {}).get("side"),
            # 경관식은 어르신 기록(tube_feeding)이 먼저다 — 경관식 재고·반출이 그 값을 쓴다
            "tube": bool(r.tube_feeding) or bool((st or {}).get("tube")),
            "since": (st or {}).get("effective_date"),
            "note": (st or {}).get("note"),
            "changed_by": (st or {}).get("changed_by"),
            "unset": st is None,
            "upcoming": {"date": nxt["effective_date"], "rice": nxt["rice"],
                         "side": nxt["side"], "tube": nxt["tube"]} if nxt else None,
        })

    people.sort(key=lambda p: ((p["floor"] or "9"), (p["room"] or "999"), p["name"] or ""))
    states = [None if p["unset"] else
              {"rice": p["rice"], "side": p["side"], "tube": p["tube"]} for p in people]
    return ApiResponse(success=True, data={
        "date": on,
        "residents": people,
        "counts": ds.counts(states),
        "rice_types": ds.RICE_TYPES,
        "side_types": ds.SIDE_TYPES,
        "can_edit": can_edit_diet(_role(current_user), _pos(current_user)),
    })


@router.post("/import")
async def import_excel(file: UploadFile = File(...), dry_run: bool = Query(True),
                       db: Session = Depends(get_db),
                       current_user: User = Depends(_importer)):
    """쓰시던 「식수현황」 엑셀을 그대로 읽어 이력으로 옮긴다.

    기본은 미리보기(dry_run)다. 무엇이 들어가고 누가 명단에 없는지 먼저
    보여주고, 확인을 받은 뒤에만 쓴다.
    """
    import io
    try:
        import openpyxl
    except Exception:
        raise HTTPException(500, "엑셀을 읽을 수 없습니다. (openpyxl 없음)")
    from app.services import diet_import as di

    raw = await file.read()
    if len(raw) > 30 * 1024 * 1024:
        raise HTTPException(400, "파일이 너무 큽니다. (30MB 이하)")
    try:
        wb = openpyxl.load_workbook(io.BytesIO(raw), data_only=True)
    except Exception:
        raise HTTPException(400, "엑셀 파일을 열지 못했습니다. (.xlsx 인지 확인해 주세요)")

    snaps = di.snapshots(wb)
    if not snaps:
        raise HTTPException(400, "날짜 시트를 찾지 못했습니다. (시트 이름이 '26.09.07' 같은 형식이어야 합니다)")
    changes, stat = di.to_changes(snaps)

    # 이름으로 어르신을 찾는다. 없으면 만들지 않고 알리기만 한다.
    by_name: Dict[str, List[LtcResident]] = {}
    for r in db.query(LtcResident).all():
        by_name.setdefault((r.name or "").strip(), []).append(r)

    unmatched, ambiguous, ready = set(), set(), []
    for c in changes:
        cands = by_name.get(c["name"], [])
        if not cands:
            unmatched.add(c["name"])
            continue
        if len(cands) > 1:
            ambiguous.add(c["name"])       # 동명이인 — 사람이 정해야 한다
            continue
        ready.append((cands[0], c))

    have = {(c.resident_id, c.effective_date) for c in db.query(DietChange).all()}
    fresh = [(r, c) for r, c in ready if (r.id, c["effective_date"]) not in have]

    result = {
        "dry_run": dry_run,
        "sheets": stat["sheets"], "rows_read": stat["rows"], "people_in_file": stat["people"],
        "changes_found": len(changes),
        "will_add": len(fresh),
        "already_have": len(ready) - len(fresh),
        "unmatched_count": len(unmatched), "unmatched": sorted(unmatched)[:30],
        "ambiguous_count": len(ambiguous), "ambiguous": sorted(ambiguous)[:10],
        "first_date": snaps[0][0], "last_date": snaps[-1][0],
    }
    if dry_run:
        return ApiResponse(success=True, data=result)

    who = getattr(current_user, "name", None)
    for r, c in fresh:
        db.add(DietChange(resident_id=r.id, resident_name=r.name,
                          effective_date=c["effective_date"],
                          rice=None if c["tube"] else c["rice"],
                          side=None if c["tube"] else c["side"],
                          tube=bool(c["tube"]), note=c["note"],
                          source="import", changed_by=who))
    # 마지막 상태의 경관식 여부를 어르신 기록에 맞춘다
    last_tube: Dict[str, bool] = {}
    for r, c in ready:
        last_tube[r.id] = bool(c["tube"])
    for r in db.query(LtcResident).filter(LtcResident.id.in_(list(last_tube))).all():
        if bool(r.tube_feeding) != last_tube[r.id]:
            r.tube_feeding = last_tube[r.id]
    db.commit()
    result["added"] = len(fresh)
    return ApiResponse(success=True, data=result)


class ChangeBody(BaseModel):
    effective_date: Optional[str] = None      # 비우면 오늘부터
    rice: Optional[str] = None
    side: Optional[str] = None
    tube: bool = False
    note: Optional[str] = None


@router.post("/{resident_id}")
def set_diet(resident_id: str, body: ChangeBody, db: Session = Depends(get_db),
             current_user: User = Depends(_editor)):
    """이 어르신의 식이를 바꾼다 — 덮어쓰지 않고 한 줄을 더한다."""
    r = db.query(LtcResident).filter(LtcResident.id == resident_id).first()
    if not r:
        raise HTTPException(404, "그 어르신을 찾을 수 없습니다.")
    on = (body.effective_date or _today()).strip()
    if not _D.match(on):
        raise HTTPException(400, "적용일은 YYYY-MM-DD 형식이어야 합니다.")
    if not ds.valid_rice(body.rice):
        raise HTTPException(400, f"밥은 {' · '.join(ds.RICE_TYPES)} 중 하나여야 합니다.")
    if not ds.valid_side(body.side):
        raise HTTPException(400, f"반찬은 {' · '.join(ds.SIDE_TYPES)} 중 하나여야 합니다.")

    # 경관식은 밥·반찬을 고르지 않는다. 둘 다 남겨 두면 집계가 두 번 센다.
    rice, side = (None, None) if body.tube else (body.rice, body.side)
    if not body.tube and not rice and not side:
        raise HTTPException(400, "밥이나 반찬 중 하나는 정해 주세요. (경관식이면 경관식으로 표시)")

    c = DietChange(resident_id=r.id, resident_name=r.name, effective_date=on,
                   rice=rice, side=side, tube=bool(body.tube),
                   note=(body.note or "").strip()[:200] or None,
                   source="manual", changed_by=getattr(current_user, "name", None))
    db.add(c)
    # 경관식 여부는 어르신 기록에도 반영한다 — 경관식 재고·반출이 그 값을 본다
    if bool(r.tube_feeding) != bool(body.tube):
        r.tube_feeding = bool(body.tube)
    db.commit()
    db.refresh(c)
    return ApiResponse(success=True, data=_rows(c))


@router.get("/log")
def change_log(limit: int = Query(100), db: Session = Depends(get_db),
               _: User = Depends(get_current_user)):
    """전체 변경 이력 — 최근 것부터. 날짜별로 묶어 보여주기 좋게 그대로 준다."""
    rows = (db.query(DietChange)
            .order_by(DietChange.effective_date.desc(), DietChange.created_at.desc())
            .limit(max(1, min(limit, 500))).all())
    return ApiResponse(success=True, data=[_rows(c) for c in rows])


@router.get("/{resident_id}/history")
def history(resident_id: str, db: Session = Depends(get_db),
            _: User = Depends(get_current_user)):
    """한 어르신의 식이 내력 — 오래된 것부터. 무엇이 무엇으로 바뀌었는지 붙여 준다."""
    rows = (db.query(DietChange)
            .filter(DietChange.resident_id == resident_id)
            .order_by(DietChange.effective_date.asc(), DietChange.created_at.asc()).all())
    out, prev = [], None
    for c in rows:
        cur = _rows(c)
        cur["diff"] = ds.diff(prev, cur)
        out.append(cur)
        prev = cur
    out.reverse()          # 화면은 최근 것부터 본다
    return ApiResponse(success=True, data=out)


@router.delete("/changes/{change_id}")
def remove_change(change_id: str, db: Session = Depends(get_db),
                  _: User = Depends(_editor)):
    """잘못 넣은 한 줄을 지운다 — 이력이지 사실이 아닌 기록이 남으면 안 된다."""
    c = db.query(DietChange).filter(DietChange.id == change_id).first()
    if not c:
        raise HTTPException(404, "그 기록을 찾을 수 없습니다.")
    db.delete(c)
    db.commit()
    return ApiResponse(success=True, data={"deleted": change_id})
