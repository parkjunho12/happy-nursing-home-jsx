"""퇴직연금(DC) 적립 관리 API — ADMIN·시설장·대표·이사.

GET /?month=YYYY-MM : 그 달 재직 직원 전원 + 해당 월 기록 + 누적 집계.
                      임금이 비어 있으면 직전 기록의 임금을 미리 채워 제안(prefill).
PUT /{month}/{staff_id} : 한 행 저장(upsert). 발생액이 비면 임금/12로 자동 계산.
"""
from __future__ import annotations
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import LtcStaffMember
from app.models.pension import PensionEntry
from app.schemas.response import ApiResponse

router = APIRouter()
_YM = re.compile(r"^\d{4}-\d{2}$")


def _hr(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "대표", "이사"):
        raise HTTPException(403, "퇴직연금 관리 권한이 없습니다.")
    return current_user


@router.get("")
def list_month(month: str = Query(...), db: Session = Depends(get_db), _: User = Depends(_hr)):
    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    month_end = f"{month}-31"
    month_start = f"{month}-01"
    staff = db.query(LtcStaffMember).all()
    # 그 달 재직자(입사~퇴사 기간에 걸친 사람)만
    rows = []
    ids = []
    for s in staff:
        hire = (s.hire_date or "")[:10]
        resign = (s.resign_date or "")[:10]
        if not hire or hire > month_end:
            continue
        if resign and resign < month_start:
            continue
        ids.append(s.id)
        rows.append(s)

    entries = {e.staff_id: e for e in db.query(PensionEntry)
               .filter(PensionEntry.month == month, PensionEntry.staff_id.in_(ids)).all()} if ids else {}
    # 누적(이번 달 포함까지) 발생·입금
    cum = {}
    if ids:
        for sid, acc, dep in (db.query(PensionEntry.staff_id,
                                       func.coalesce(func.sum(PensionEntry.accrued), 0),
                                       func.coalesce(func.sum(PensionEntry.deposited), 0))
                              .filter(PensionEntry.staff_id.in_(ids), PensionEntry.month <= month)
                              .group_by(PensionEntry.staff_id).all()):
            cum[sid] = (int(acc or 0), int(dep or 0))
    # 임금 프리필 — 이 달 기록이 없으면 직전 기록의 임금
    prev_wage = {}
    if ids:
        prev_rows = (db.query(PensionEntry)
                     .filter(PensionEntry.staff_id.in_(ids), PensionEntry.month < month,
                             PensionEntry.wage.isnot(None))
                     .order_by(PensionEntry.staff_id, PensionEntry.month).all())
        for e in prev_rows:
            prev_wage[e.staff_id] = e.wage   # 마지막 것이 남는다

    out = []
    for s in rows:
        e = entries.get(s.id)
        ca, cd = cum.get(s.id, (0, 0))
        out.append({
            "staff_id": s.id, "name": s.name, "position": s.position,
            "hire_date": s.hire_date, "status": s.status,
            "wage": e.wage if e else None,
            "suggest_wage": None if e and e.wage is not None else prev_wage.get(s.id),
            "accrued": e.accrued if e else None,
            "deposited": e.deposited if e else None,
            "deposit_date": e.deposit_date if e else None,
            "memo": e.memo if e else None,
            "cum_accrued": ca, "cum_deposited": cd,
        })
    out.sort(key=lambda x: ((x["hire_date"] or "9999"), x["name"] or ""))
    return ApiResponse(success=True, data={"month": month, "rows": out})


class EntryBody(BaseModel):
    wage: Optional[int] = None
    accrued: Optional[int] = None      # 비우면 wage/12 자동
    deposited: Optional[int] = None
    deposit_date: Optional[str] = None
    memo: Optional[str] = None


@router.put("/{month}/{staff_id}")
def upsert_entry(month: str, staff_id: str, body: EntryBody,
                 db: Session = Depends(get_db), current_user: User = Depends(_hr)):
    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    e = (db.query(PensionEntry)
         .filter(PensionEntry.staff_id == staff_id, PensionEntry.month == month).first())
    if not e:
        e = PensionEntry(staff_id=staff_id, month=month)
        db.add(e)
    e.wage = body.wage
    # DC 부담금 자동 계산 — 월 임금의 1/12, 1의 자리 반올림(10원 단위). 직접 입력하면 그 값을 존중.
    if body.accrued is not None:
        e.accrued = body.accrued
    elif body.wage:
        e.accrued = round(body.wage / 12 / 10) * 10
    else:
        e.accrued = None
    e.deposited = body.deposited
    e.deposit_date = (body.deposit_date or "").strip() or None
    e.memo = (body.memo or "").strip() or None
    e.updated_by = getattr(current_user, "name", None)
    db.commit()
    return ApiResponse(success=True, data={
        "staff_id": staff_id, "month": month, "wage": e.wage, "accrued": e.accrued,
        "deposited": e.deposited, "deposit_date": e.deposit_date, "memo": e.memo,
    })
