from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import update

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import LtcResident, LtcStaffMember, ChecklistItem
from app.schemas.eval import (
    LtcResidentCreate, LtcResidentUpdate, LtcResidentOut, DischargeRequest,
    LtcStaffCreate, LtcStaffUpdate, LtcStaffOut, ResignRequest,
)
from app.schemas.response import ApiResponse
from typing import List

residents_router = APIRouter()
staff_router = APIRouter()


# ════════════════════════════════════════════════════════════════
# 평가용 수급자
# ════════════════════════════════════════════════════════════════

@residents_router.get("", response_model=ApiResponse)
def list_ltc_residents(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(LtcResident).order_by(LtcResident.created_at.desc()).all()
    # 입소 예정자(pending)는 입소일이 되면 자동으로 현원(active) 전환 —
    # 사람이 바꿔주길 기다리면 그날 아침 명단이 틀린다
    from datetime import datetime, timezone, timedelta
    today = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")
    flipped = False
    for r in rows:
        if r.status == "pending" and (r.admission_date or "")[:10] <= today:
            r.status = "active"
            flipped = True
    if flipped:
        db.commit()
    return ApiResponse(success=True, data=[LtcResidentOut.model_validate(r).model_dump() for r in rows])


def _check_room_capacity(db: Session, floor, room, exclude_id=None):
    """호실 정원 검증 — 등록·수정 양쪽에서. 설정에 없는 호실은 검사하지 않는다(구버전 자유 입력 호환)."""
    if not room:
        return
    try:
        from app.models.room import RoomConfig
    except Exception:
        return
    cfg = (db.query(RoomConfig)
             .filter(RoomConfig.floor == (floor or ""), RoomConfig.room == room,
                     RoomConfig.active == True).first())  # noqa: E712
    if not cfg:
        return
    q = db.query(LtcResident).filter(
        LtcResident.status.in_(["active", "pending"]),
        LtcResident.room == room, LtcResident.floor == (floor or ""))
    if exclude_id:
        q = q.filter(LtcResident.id != exclude_id)
    n = q.count()
    cap = cfg.capacity or 4
    if n >= cap:
        raise HTTPException(409, f"{floor} {room}호는 정원 {cap}명이 이미 찼습니다. "
                                 f"먼저 기존 어르신을 다른 방으로 옮기거나 설정에서 정원을 조정해주세요.")


@residents_router.post("", response_model=ApiResponse, status_code=201)
def create_ltc_resident(
    payload: LtcResidentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = payload.model_dump()
    _check_room_capacity(db, data.get("floor"), data.get("room"))
    certifications_in = data.pop("certifications", None)
    contract_in = data.pop("contract_lines", None)
    plan_in = data.pop("plan_lines", None)
    eval_in = data.pop("eval_lines", None)
    status = data.pop("status", None)
    # 입소일이 미래면 자동으로 '입소 예정' — 체크 안 해도 실수하지 않게
    from datetime import datetime as _dt, timezone as _tz, timedelta as _td
    _today = _dt.now(_tz(_td(hours=9))).strftime("%Y-%m-%d")
    if status not in ("active", "pending"):
        status = "pending" if (data.get("admission_date") or "")[:10] > _today else "active"
    r = LtcResident(**data, status=status)
    db.add(r)
    _log_group_changes(db, r.name, {},
                       {k: data.get(k) for k in GROUP_LOG_FIELDS}, _)
    db.commit()
    db.refresh(r)

    # 어르신 서류 현황 표에 자동 추가 (급여/등급·인정서 기간 포함)
    try:
        from app.models.resident_docs import ResidentDocStatus
        from app.models.staff_hr import to_iso
        exists = db.query(ResidentDocStatus).filter(ResidentDocStatus.resident_id == r.id).first()
        if not exists:
            from app.api.v1.endpoints.resident_docs import _clean_certs, _derive_from_certs
            # 입력 인정서 날짜를 ISO 정규화
            raw_certs = []
            for c in (certifications_in or []):
                if not isinstance(c, dict):
                    continue
                raw_certs.append({
                    "grade": (c.get("grade") or None),
                    "cert_no": (c.get("cert_no") or None),
                    "start": to_iso(c.get("start")),
                    "end": to_iso(c.get("end")),
                    "benefits": [
                        {"type": (b.get("type") or None), "from": to_iso(b.get("from"))}
                        for b in (c.get("benefits") or []) if isinstance(b, dict)
                    ],
                })
            certs = _clean_certs(raw_certs)
            periods, grade, cbase = _derive_from_certs(certs)
            base = cbase or to_iso(getattr(r, "care_grade_start_date", None))
            def _clean_events(raw):
                out = []
                for x in (raw or []):
                    if not isinstance(x, dict):
                        continue
                    d = to_iso(x.get("date"))
                    mm = (x.get("memo") or "").strip() or None
                    k = (x.get("kind") or "").strip() or None
                    if d or mm:
                        out.append({"date": d, "memo": mm, "kind": k})
                return out or None
            db.add(ResidentDocStatus(
                resident_id=r.id, name=r.name,
                floor=(getattr(r, "floor", None) or "2층"),
                admission_date=to_iso(getattr(r, "admission_date", None)),
                base_date=base,
                grade=grade,
                cert_periods=(periods or None),
                certifications=(certs or None),
                contract_lines=_clean_events(contract_in),
                plan_lines=_clean_events(plan_in),
                eval_lines=_clean_events(eval_in),
            ))
            db.commit()
    except Exception:
        db.rollback()

    return ApiResponse(success=True, data=LtcResidentOut.model_validate(r).model_dump())


@residents_router.get("/{rid}", response_model=ApiResponse)
def get_ltc_resident(rid: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(LtcResident).filter(LtcResident.id == rid).first()
    if not r:
        raise HTTPException(404, "Not found")
    return ApiResponse(success=True, data=LtcResidentOut.model_validate(r).model_dump())


GROUP_LOG_FIELDS = {"group_cognitive": "인지", "group_leisure": "여가",
                    "group_physical": "신체", "religion": "종교"}


def _log_group_changes(db, name: str, before: dict, after: dict, who):
    """그룹·종교가 실제로 바뀐 것만 이력으로 남긴다."""
    from app.models.program import ProgramGroupLog
    for key, label in GROUP_LOG_FIELDS.items():
        b = (before.get(key) or None) or None
        a = (after.get(key) or None) or None
        if b != a:
            db.add(ProgramGroupLog(resident_name=name, field=label,
                                   before=b, after=a,
                                   changed_by=getattr(who, "name", None)))


@residents_router.patch("/{rid}", response_model=ApiResponse)
def update_ltc_resident(
    rid: str,
    payload: LtcResidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(LtcResident).filter(LtcResident.id == rid).first()
    if not r:
        raise HTTPException(404, "Not found")
    # 방 변경이면 정원부터 확인
    if payload.room is not None and payload.room:
        _check_room_capacity(db, payload.floor if payload.floor is not None else r.floor,
                             payload.room, exclude_id=rid)
    before = {k: getattr(r, k, None) for k in GROUP_LOG_FIELDS}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    _log_group_changes(db, r.name, before,
                       {k: getattr(r, k, None) for k in GROUP_LOG_FIELDS}, current_user)
    db.commit()
    db.refresh(r)
    # 층 변경 시 연동된 서류현황에도 반영
    if payload.floor is not None:
        try:
            from app.models.resident_docs import ResidentDocStatus
            db.query(ResidentDocStatus).filter(ResidentDocStatus.resident_id == rid).update({"floor": payload.floor})
            db.commit()
        except Exception:
            db.rollback()
    return ApiResponse(success=True, data=LtcResidentOut.model_validate(r).model_dump())


@residents_router.post("/{rid}/discharge", response_model=ApiResponse)
def discharge_ltc_resident(
    rid: str,
    payload: DischargeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = db.query(LtcResident).filter(LtcResident.id == rid).first()
    if not r:
        raise HTTPException(404, "Not found")
    r.status = "discharged"
    r.discharge_date = payload.discharge_date
    r.discharge_time = payload.discharge_time
    try:
        from app.models.resident_docs import ResidentDocStatus
        db.query(ResidentDocStatus).filter(ResidentDocStatus.resident_id == rid).update({"active": False})
    except Exception:
        pass
    # 미완료 입소 체크리스트 비활성화
    db.execute(
        update(ChecklistItem)
        .where(ChecklistItem.person_id == rid, ChecklistItem.completed == False)
        .values(active=False)
    )
    db.commit()
    db.refresh(r)
    return ApiResponse(success=True, data=LtcResidentOut.model_validate(r).model_dump())


@residents_router.delete("/{rid}", response_model=ApiResponse)
def delete_ltc_resident(rid: str, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    """수급자 완전 삭제 — 연관 데이터(체크리스트·수행기록·서류현황)도 함께 정리."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("사회복지사", "시설장", "대표", "이사"):
        raise HTTPException(403, "수급자 삭제 권한이 없습니다.")
    r = db.query(LtcResident).filter(LtcResident.id == rid).first()
    if not r:
        raise HTTPException(404, "Not found")
    from app.models.resident_docs import ResidentDocStatus
    from app.models.eval import ChecklistItem, ChecklistOccurrence, CompletionRecord
    try:
        # 1) 어르신 서류 현황 (resident_id 연동분)
        db.query(ResidentDocStatus).filter(
            ResidentDocStatus.resident_id == rid
        ).delete(synchronize_session=False)

        # 2) 개인 체크리스트 및 하위 데이터(수행/발생)
        item_ids = [i.id for i in db.query(ChecklistItem.id).filter(ChecklistItem.person_id == rid).all()]
        if item_ids:
            db.query(ChecklistOccurrence).filter(ChecklistOccurrence.checklist_item_id.in_(item_ids)).delete(synchronize_session=False)
            db.query(CompletionRecord).filter(CompletionRecord.checklist_id.in_(item_ids)).delete(synchronize_session=False)
            db.query(ChecklistItem).filter(ChecklistItem.person_id == rid).delete(synchronize_session=False)

        # 3) 수급자 본체
        db.delete(r)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"수급자 삭제 중 오류가 발생했습니다: {e}")

    return ApiResponse(success=True, message="Deleted")


# ════════════════════════════════════════════════════════════════
# 평가용 직원
# ════════════════════════════════════════════════════════════════

@staff_router.get("", response_model=ApiResponse)
def list_ltc_staff(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(LtcStaffMember).order_by(LtcStaffMember.created_at.desc()).all()
    # 입사 예정자 — 입사일이 되면 자동으로 현직 전환
    from datetime import datetime as _dt, timezone as _tz, timedelta as _td
    today = _dt.now(_tz(_td(hours=9))).strftime("%Y-%m-%d")
    changed = False
    for m in rows:
        if m.status == "pending" and (m.hire_date or "")[:10] <= today:
            m.status = "active"
            changed = True
    if changed:
        db.commit()
    return ApiResponse(success=True, data=[LtcStaffOut.model_validate(s).model_dump() for s in rows])


@staff_router.post("", response_model=ApiResponse, status_code=201)
def create_ltc_staff(
    payload: LtcStaffCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = payload.model_dump()
    from datetime import datetime as _dt2, timezone as _tz2, timedelta as _td2
    _today = _dt2.now(_tz2(_td2(hours=9))).strftime("%Y-%m-%d")
    status = "pending" if (data.get("hire_date") or "")[:10] > _today else "active"
    s = LtcStaffMember(**data, status=status)
    db.add(s)
    db.commit()
    db.refresh(s)

    # 근로계약·서류(HR) 표에 자동 추가 (중복 방지)
    try:
        from app.models.staff_hr import StaffHrRecord, to_iso, contract_end_3m, minus_one_month
        exists = db.query(StaffHrRecord).filter(StaffHrRecord.staff_id == s.id).first()
        if not exists:
            mx = db.query(StaffHrRecord).order_by(StaffHrRecord.seq.desc()).first()
            hd = to_iso(getattr(s, "hire_date", None))
            contracts = None
            renewal = None
            if hd:
                end = contract_end_3m(hd)
                contracts = [{"start": hd, "end": end}]
                renewal = minus_one_month(end) if end else None
            db.add(StaffHrRecord(
                staff_id=s.id, name=s.name,
                position=getattr(s, "position", None),
                hire_date=hd or getattr(s, "hire_date", None),
                seq=((mx.seq + 1) if (mx and mx.seq) else 1),
                contract_written=False,
                contracts=contracts, renewal_date=renewal,
            ))
            db.commit()
    except Exception:
        db.rollback()

    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())


@staff_router.get("/{sid}", response_model=ApiResponse)
def get_ltc_staff(sid: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    s = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    if not s:
        raise HTTPException(404, "Not found")
    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())


@staff_router.patch("/{sid}", response_model=ApiResponse)
def update_ltc_staff(
    sid: str,
    payload: LtcStaffUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    s = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    if not s:
        raise HTTPException(404, "Not found")
    fields = payload.model_dump(exclude_none=True)
    for k, v in fields.items():
        setattr(s, k, v)
    # 재직/퇴사 상태가 바뀌면 HR 표시 동기화
    if "status" in fields:
        try:
            from app.models.staff_hr import StaffHrRecord
            db.query(StaffHrRecord).filter(StaffHrRecord.staff_id == sid).update(
                {"active": fields["status"] != "resigned"})
        except Exception:
            pass
    db.commit()
    db.refresh(s)
    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())


@staff_router.post("/{sid}/unresign", response_model=ApiResponse)
def unresign_ltc_staff(sid: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """퇴사 취소 — 재직으로 복귀. 퇴사 때 비활성화된 미완료 체크리스트·HR 행도 되살린다."""
    s = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    if not s:
        raise HTTPException(404, "Not found")
    if s.status != "resigned":
        raise HTTPException(409, "퇴사 상태가 아닙니다.")
    from datetime import datetime as _dt, timezone as _tz, timedelta as _td
    today = _dt.now(_tz(_td(hours=9))).strftime("%Y-%m-%d")
    s.status = "pending" if (s.hire_date or "")[:10] > today else "active"
    s.resign_date = None
    # 퇴사 처리 때 껐던 미완료 체크리스트 복구 (퇴사 업무 체크리스트는 제외)
    db.execute(
        update(ChecklistItem)
        .where(ChecklistItem.person_id == sid, ChecklistItem.completed == False,
               ChecklistItem.active == False, ChecklistItem.frequency != "on_resign")
        .values(active=True)
    )
    # 퇴사 취소면 퇴사 업무 체크리스트는 더 이상 유효하지 않다
    db.execute(
        update(ChecklistItem)
        .where(ChecklistItem.person_id == sid, ChecklistItem.frequency == "on_resign",
               ChecklistItem.completed == False)
        .values(active=False)
    )
    try:
        from app.models.staff_hr import StaffHrRecord
        db.query(StaffHrRecord).filter(StaffHrRecord.staff_id == sid).update({"active": True})
    except Exception:
        pass
    db.commit()
    db.refresh(s)
    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())


@staff_router.delete("/{sid}", response_model=ApiResponse)
def delete_ltc_staff(sid: str, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    """직원 완전 삭제 — 입사 예정 취소 등. 재직 중 직원은 ADMIN만 지울 수 있다."""
    s = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    if not s:
        raise HTTPException(404, "Not found")
    if s.status == "active":
        role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if role != "ADMIN":
            raise HTTPException(403, "재직 중인 직원 삭제는 ADMIN만 가능합니다. (퇴사 처리를 이용해주세요)")
    try:
        item_ids = [i.id for i in db.query(ChecklistItem.id)
                    .filter(ChecklistItem.person_id == sid).all()]
        if item_ids:
            from app.models.eval import ChecklistOccurrence, CompletionRecord
            db.query(CompletionRecord).filter(CompletionRecord.checklist_id.in_(item_ids)).delete(synchronize_session=False)
            db.query(ChecklistOccurrence).filter(ChecklistOccurrence.checklist_item_id.in_(item_ids)).delete(synchronize_session=False)
            db.query(ChecklistItem).filter(ChecklistItem.id.in_(item_ids)).delete(synchronize_session=False)
    except Exception:
        db.rollback()
        raise HTTPException(500, "연관 체크리스트 정리에 실패했습니다.")
    try:
        from app.models.staff_hr import StaffHrRecord
        db.query(StaffHrRecord).filter(StaffHrRecord.staff_id == sid).delete(synchronize_session=False)
    except Exception:
        pass
    db.delete(s)
    db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@staff_router.post("/{sid}/resign", response_model=ApiResponse)
def resign_ltc_staff(
    sid: str,
    payload: ResignRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    s = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    if not s:
        raise HTTPException(404, "Not found")
    s.status = "resigned"
    s.resign_date = payload.resign_date
    db.execute(
        update(ChecklistItem)
        .where(ChecklistItem.person_id == sid, ChecklistItem.completed == False)
        .values(active=False)
    )
    # 근로계약·서류 표에서 숨김
    try:
        from app.models.staff_hr import StaffHrRecord
        db.query(StaffHrRecord).filter(StaffHrRecord.staff_id == sid).update({"active": False})
    except Exception:
        pass
    db.commit()
    db.refresh(s)
    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())
