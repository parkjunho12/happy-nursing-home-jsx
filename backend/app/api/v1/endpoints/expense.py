"""
지출결의(회계 결제 서류) API.
- 제출: 앨범담당 제외 전 직원
- 승인/반려: ADMIN · 대표 · 이사 · 사무국장
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.expense import (
    ExpenseRequest, ExpenseAttachment,
    EXPENSE_CATEGORIES, PAYMENT_METHODS, now_kst,
)
from app.schemas.response import ApiResponse

router = APIRouter()

KST = timezone(timedelta(hours=9))
APPROVER_POSITIONS = {"대표", "이사", "사무국장"}
UPLOAD_SUBDIR = "uploads/expenses"
MAX_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".heic"}


def _role_pos(u: User):
    role = u.role.value if hasattr(u.role, "value") else str(u.role)
    pos = getattr(u, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    return role, pos


def _require_submitter(current_user: User = Depends(get_current_user)) -> User:
    _, pos = _role_pos(current_user)
    if pos == "앨범담당":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    return current_user


def _is_approver(u: User) -> bool:
    role, pos = _role_pos(u)
    return role == "ADMIN" or pos in APPROVER_POSITIONS


def _require_approver(current_user: User = Depends(get_current_user)) -> User:
    if not _is_approver(current_user):
        raise HTTPException(status_code=403, detail="승인 권한이 없습니다.")
    return current_user


def _kst(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=KST)
    return dt.astimezone(KST)


def _att_view(a: ExpenseAttachment) -> dict:
    return {
        "id": a.id, "file_name": a.file_name, "file_url": a.file_url,
        "content_type": a.content_type, "file_size": a.file_size,
        "is_image": (a.content_type or "").startswith("image/"),
    }


def _view(e: ExpenseRequest, viewer: User) -> dict:
    return {
        "id": e.id, "title": e.title, "amount": e.amount, "vendor": e.vendor,
        "category": e.category, "payment_method": e.payment_method,
        "purchased_at": e.purchased_at, "memo": e.memo,
        "status": e.status, "reject_reason": e.reject_reason,
        "requester_id": e.requester_id, "requester_name": e.requester_name,
        "approver_name": e.approver_name,
        "approved_at": _kst(e.approved_at).isoformat() if e.approved_at else None,
        "created_at": _kst(e.created_at).isoformat() if e.created_at else None,
        "attachments": [_att_view(a) for a in (e.attachments or [])],
        "can_approve": _is_approver(viewer) and e.status == "pending",
        "can_edit": (e.requester_id == viewer.id and e.status == "pending") or _is_approver(viewer),
        "is_mine": e.requester_id == viewer.id,
    }


def _save_files(files: List[UploadFile], request_id: str, db: Session):
    os.makedirs(UPLOAD_SUBDIR, exist_ok=True)
    for f in files:
        if not f or not f.filename:
            continue
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"허용되지 않는 파일 형식입니다: {ext}")
        data = f.file.read()
        if len(data) > MAX_SIZE:
            raise HTTPException(400, f"파일이 너무 큽니다(최대 10MB): {f.filename}")
        fid = str(uuid.uuid4())
        disk_name = f"{fid}{ext}"
        with open(os.path.join(UPLOAD_SUBDIR, disk_name), "wb") as out:
            out.write(data)
        db.add(ExpenseAttachment(
            id=fid, request_id=request_id, file_name=f.filename,
            file_url=f"/uploads/expenses/{disk_name}",
            content_type=f.content_type, file_size=len(data),
        ))


@router.get("/meta")
def meta(current_user: User = Depends(_require_submitter)):
    return ApiResponse(success=True, data={
        "categories": EXPENSE_CATEGORIES,
        "payment_methods": PAYMENT_METHODS,
        "is_approver": _is_approver(current_user),
    })


@router.get("/requests")
def list_requests(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),  # created_at 기준 YYYY-MM-DD
    end_date: Optional[str] = Query(None),
    mine: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_submitter),
):
    q = db.query(ExpenseRequest)
    # 승인권자가 아니면 본인 것만
    if not _is_approver(current_user) or mine:
        q = q.filter(ExpenseRequest.requester_id == current_user.id)
    if status:
        q = q.filter(ExpenseRequest.status == status)
    if category:
        q = q.filter(ExpenseRequest.category == category)
    if start_date:
        q = q.filter(ExpenseRequest.created_at >= datetime.fromisoformat(start_date + "T00:00").replace(tzinfo=KST))
    if end_date:
        q = q.filter(ExpenseRequest.created_at <= datetime.fromisoformat(end_date + "T23:59").replace(tzinfo=KST))
    rows = q.order_by(ExpenseRequest.created_at.desc()).all()
    return ApiResponse(success=True, data=[_view(e, current_user) for e in rows])


@router.get("/requests/{rid}")
def get_request(rid: str, db: Session = Depends(get_db),
                current_user: User = Depends(_require_submitter)):
    e = db.query(ExpenseRequest).filter(ExpenseRequest.id == rid).first()
    if not e:
        raise HTTPException(404, "지출결의를 찾을 수 없습니다.")
    if not _is_approver(current_user) and e.requester_id != current_user.id:
        raise HTTPException(403, "권한이 없습니다.")
    return ApiResponse(success=True, data=_view(e, current_user))


@router.post("/requests")
def create_request(
    title: str = Form(...),
    amount: int = Form(0),
    vendor: Optional[str] = Form(None),
    category: str = Form("기타"),
    payment_method: Optional[str] = Form(None),
    purchased_at: Optional[str] = Form(None),
    memo: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_submitter),
):
    if not title.strip():
        raise HTTPException(400, "품목/제목을 입력해주세요.")
    if amount < 0:
        raise HTTPException(400, "금액이 올바르지 않습니다.")
    e = ExpenseRequest(
        title=title.strip(), amount=amount,
        vendor=(vendor or "").strip() or None,
        category=category if category in EXPENSE_CATEGORIES else "기타",
        payment_method=payment_method or None,
        purchased_at=purchased_at or None,
        memo=(memo or "").strip() or None,
        status="pending",
        requester_id=current_user.id,
        requester_name=getattr(current_user, "name", None),
    )
    db.add(e)
    db.flush()
    if files:
        _save_files(files, e.id, db)
    db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e, current_user))


@router.patch("/requests/{rid}")
def update_request(
    rid: str,
    title: Optional[str] = Form(None),
    amount: Optional[int] = Form(None),
    vendor: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    payment_method: Optional[str] = Form(None),
    purchased_at: Optional[str] = Form(None),
    memo: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    remove_attachment_ids: Optional[str] = Form(None),  # comma-separated
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_submitter),
):
    e = db.query(ExpenseRequest).filter(ExpenseRequest.id == rid).first()
    if not e:
        raise HTTPException(404, "지출결의를 찾을 수 없습니다.")
    # 본인(대기 상태) 또는 승인권자만 수정
    if not ((e.requester_id == current_user.id and e.status == "pending") or _is_approver(current_user)):
        raise HTTPException(403, "수정 권한이 없습니다.")
    if title is not None and title.strip():
        e.title = title.strip()
    if amount is not None and amount >= 0:
        e.amount = amount
    if vendor is not None:
        e.vendor = vendor.strip() or None
    if category is not None and category in EXPENSE_CATEGORIES:
        e.category = category
    if payment_method is not None:
        e.payment_method = payment_method or None
    if purchased_at is not None:
        e.purchased_at = purchased_at or None
    if memo is not None:
        e.memo = memo.strip() or None
    if remove_attachment_ids:
        ids = [x for x in remove_attachment_ids.split(",") if x.strip()]
        for a in list(e.attachments):
            if a.id in ids:
                _unlink(a.file_url)
                db.delete(a)
    if files:
        _save_files(files, e.id, db)
    e.updated_at = now_kst()
    db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e, current_user))


def _unlink(file_url: str):
    try:
        if file_url and file_url.startswith("/uploads/expenses/"):
            p = file_url.lstrip("/")
            if os.path.exists(p):
                os.remove(p)
    except Exception:
        pass


@router.post("/requests/{rid}/approve")
def approve_request(rid: str, db: Session = Depends(get_db),
                    current_user: User = Depends(_require_approver)):
    e = db.query(ExpenseRequest).filter(ExpenseRequest.id == rid).first()
    if not e:
        raise HTTPException(404, "지출결의를 찾을 수 없습니다.")
    if e.status != "pending":
        raise HTTPException(400, "이미 처리된 건입니다.")
    e.status = "approved"
    e.approver_id = current_user.id
    e.approver_name = getattr(current_user, "name", None)
    e.approved_at = now_kst()
    e.reject_reason = None
    db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e, current_user))


@router.post("/requests/{rid}/reject")
def reject_request(rid: str, reason: str = Form(...), db: Session = Depends(get_db),
                   current_user: User = Depends(_require_approver)):
    e = db.query(ExpenseRequest).filter(ExpenseRequest.id == rid).first()
    if not e:
        raise HTTPException(404, "지출결의를 찾을 수 없습니다.")
    if e.status != "pending":
        raise HTTPException(400, "이미 처리된 건입니다.")
    if not reason.strip():
        raise HTTPException(400, "반려 사유를 입력해주세요.")
    e.status = "rejected"
    e.approver_id = current_user.id
    e.approver_name = getattr(current_user, "name", None)
    e.approved_at = now_kst()
    e.reject_reason = reason.strip()
    db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e, current_user))


@router.delete("/requests/{rid}")
def delete_request(rid: str, db: Session = Depends(get_db),
                   current_user: User = Depends(_require_submitter)):
    e = db.query(ExpenseRequest).filter(ExpenseRequest.id == rid).first()
    if not e:
        raise HTTPException(404, "지출결의를 찾을 수 없습니다.")
    if not ((e.requester_id == current_user.id and e.status == "pending") or _is_approver(current_user)):
        raise HTTPException(403, "삭제 권한이 없습니다.")
    for a in list(e.attachments):
        _unlink(a.file_url)
    db.delete(e); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@router.get("/summary")
def summary(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_approver),
):
    start = datetime(year, month, 1, tzinfo=KST)
    end = datetime(year + (month == 12), (month % 12) + 1, 1, tzinfo=KST)
    base = db.query(ExpenseRequest).filter(
        ExpenseRequest.created_at >= start,
        ExpenseRequest.created_at < end,
    )
    rows = base.all()
    approved = [r for r in rows if r.status == "approved"]
    pending = [r for r in rows if r.status == "pending"]
    rejected = [r for r in rows if r.status == "rejected"]

    by_cat = {}
    for r in approved:
        by_cat[r.category] = by_cat.get(r.category, 0) + (r.amount or 0)
    by_category = [{"category": c, "amount": a} for c, a in
                   sorted(by_cat.items(), key=lambda x: -x[1])]

    return ApiResponse(success=True, data={
        "year": year, "month": month,
        "approved_total": sum(r.amount or 0 for r in approved),
        "approved_count": len(approved),
        "pending_total": sum(r.amount or 0 for r in pending),
        "pending_count": len(pending),
        "rejected_count": len(rejected),
        "by_category": by_category,
    })
