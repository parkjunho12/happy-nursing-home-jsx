"""인수인계 AI 리포트 — 사진 판독·이력·공유·체크리스트 생성

접근: ADMIN · 시설장 · 간호사 · 간호조무사 · 사회복지사 · 지정 직원(users.handover_access)
"""
from __future__ import annotations
import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.handover import HandoverReport
from app.schemas.response import ApiResponse
from app.services.handover_ai import analyze_handover
from app.services.staff_notify import notify_all_staff

router = APIRouter()

UPLOAD_SUBDIR = "uploads/handover"
MAX_SIZE = 10 * 1024 * 1024
MAX_FILES = 6
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".heic": "image/jpeg"}
ALLOWED_POS = ("시설장", "간호사", "간호조무사", "사회복지사")


def _role_pos(u: User):
    role = u.role.value if hasattr(u.role, "value") else str(u.role)
    pos = getattr(u, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    return role, pos


def _can_use(current_user: User = Depends(get_current_user)) -> User:
    role, pos = _role_pos(current_user)
    if role == "ADMIN" or pos in ALLOWED_POS or bool(getattr(current_user, "handover_access", False)):
        return current_user
    raise HTTPException(403, "인수인계 AI 접근 권한이 없습니다. 관리자에게 요청해 주세요.")


def _admin_only(current_user: User = Depends(get_current_user)) -> User:
    role, _ = _role_pos(current_user)
    if role != "ADMIN":
        raise HTTPException(403, "관리자만 가능합니다.")
    return current_user


def _view(r: HandoverReport) -> dict:
    return {
        "id": r.id, "images": r.images or [], "report": r.report or {},
        "model": r.model, "author": r.author,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/analyze")
async def analyze(
    images: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_can_use),
):
    if not images:
        raise HTTPException(400, "사진을 1장 이상 올려주세요.")
    if len(images) > MAX_FILES:
        raise HTTPException(400, f"사진은 최대 {MAX_FILES}장까지 가능합니다.")

    os.makedirs(UPLOAD_SUBDIR, exist_ok=True)
    blobs: List[bytes] = []
    mts: List[str] = []
    urls: List[str] = []
    for f in images:
        ext = os.path.splitext(f.filename or "")[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"허용되지 않는 이미지 형식입니다: {ext}")
        data = await f.read()
        if len(data) > MAX_SIZE:
            raise HTTPException(400, "이미지가 너무 큽니다(최대 10MB).")
        disk = f"{uuid.uuid4()}{ext}"
        with open(os.path.join(UPLOAD_SUBDIR, disk), "wb") as out:
            out.write(data)
        blobs.append(data); mts.append(MIME.get(ext, "image/jpeg"))
        urls.append(f"/uploads/handover/{disk}")

    report = analyze_handover(blobs, mts)
    row = HandoverReport(
        images=urls, report=report, model=report.get("model"),
        author=getattr(current_user, "name", None),
    )
    db.add(row); db.commit(); db.refresh(row)
    return ApiResponse(success=True, data=_view(row))


@router.get("/history")
def history(db: Session = Depends(get_db), _: User = Depends(_can_use)):
    rows = (db.query(HandoverReport)
            .order_by(HandoverReport.created_at.desc()).limit(30).all())
    return ApiResponse(success=True, data=[_view(r) for r in rows])


@router.get("/history/{rid}")
def history_item(rid: str, db: Session = Depends(get_db), _: User = Depends(_can_use)):
    r = db.query(HandoverReport).filter(HandoverReport.id == rid).first()
    if not r:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")
    return ApiResponse(success=True, data=_view(r))


@router.delete("/history/{rid}")
def delete_item(rid: str, db: Session = Depends(get_db), _: User = Depends(_admin_only)):
    r = db.query(HandoverReport).filter(HandoverReport.id == rid).first()
    if not r:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@router.post("/history/{rid}/push")
def push_report(rid: str, db: Session = Depends(get_db), current_user: User = Depends(_can_use)):
    """요약과 주요 알림을 직원앱으로 발송."""
    r = db.query(HandoverReport).filter(HandoverReport.id == rid).first()
    if not r:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")
    rep = r.report or {}
    alerts = rep.get("alerts") or []
    title = "🔔 인수인계 요약" + (f" · 주의 {len(alerts)}건" if alerts else "")
    body = (rep.get("summary") or "인수인계 리포트가 등록되었습니다.").strip()
    if len(body) > 120:
        body = body[:119] + "…"
    result = notify_all_staff(db, title, body,
                              data={"type": "handover", "handover_id": r.id},
                              exclude_user_id=getattr(current_user, "id", None))
    return ApiResponse(success=True, data=result, message=f"{result.get('sent', 0)}건 발송")


class ChecklistPick(BaseModel):
    title: str
    frequency: str = "one_time"
    person_name: Optional[str] = None
    due_date: Optional[str] = None      # one_time 기한 (YYYY-MM-DD)
    memo: Optional[str] = None


@router.post("/history/{rid}/checklists")
def create_checklists(rid: str, items: List[ChecklistPick],
                      db: Session = Depends(get_db), current_user: User = Depends(_can_use)):
    """AI가 제안한 항목 중 선택한 것만 체크리스트로 생성."""
    r = db.query(HandoverReport).filter(HandoverReport.id == rid).first()
    if not r:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")
    if not items:
        raise HTTPException(400, "생성할 항목을 선택해 주세요.")

    from app.schemas.eval import ChecklistItemCreate
    from app.api.v1.endpoints.eval_checklists import create_checklists_bulk

    payload = [ChecklistItemCreate(
        title=i.title.strip(),
        frequency=i.frequency or "one_time",
        due_date=(i.due_date or None),
        person_name=(i.person_name or None),
        person_type=("resident" if (i.person_name or "").strip() else "facility"),
        memo=(i.memo or f"인수인계 AI 제안 ({r.created_at.strftime('%m-%d') if r.created_at else ''})"),
    ) for i in items if (i.title or "").strip()]
    if not payload:
        raise HTTPException(400, "유효한 항목이 없습니다.")
    return create_checklists_bulk(payload, db=db, _=current_user)


# ── 접근 권한(지정 직원) 관리 — ADMIN 전용 ──────────────────────────
@router.get("/access")
def list_access(db: Session = Depends(get_db), _: User = Depends(_admin_only)):
    users = db.query(User).order_by(User.name).all()
    out = []
    for u in users:
        role, pos = _role_pos(u)
        out.append({
            "id": u.id, "name": u.name, "position": pos or None, "role": role,
            "always": role == "ADMIN" or pos in ALLOWED_POS,   # 직책상 항상 허용
            "granted": bool(getattr(u, "handover_access", False)),
        })
    return ApiResponse(success=True, data=out)


class AccessBody(BaseModel):
    granted: bool


@router.patch("/access/{user_id}")
def set_access(user_id: str, body: AccessBody,
               db: Session = Depends(get_db), _: User = Depends(_admin_only)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "직원을 찾을 수 없습니다.")
    u.handover_access = bool(body.granted)
    db.commit()
    return ApiResponse(success=True, message="변경되었습니다.")
