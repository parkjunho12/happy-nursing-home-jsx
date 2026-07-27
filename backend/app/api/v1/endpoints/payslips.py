"""급여명세서 API — 관리자 업로드 → 직원 확인·서명.

권한: 업로드·목록·삭제 = ADMIN·시설장 (급여는 민감 정보)
      본인 명세서 열람·서명 = 그 직원 본인만
"""
from __future__ import annotations
import re
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.payslip import Payslip, now_kst
from app.models.eval import LtcStaffMember
from app.schemas.response import ApiResponse
from app.services.staff_notify import notify_user

router = APIRouter()
_YM = re.compile(r"^\d{4}-\d{2}$")


def _manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN" and (getattr(current_user, "position", None) or "") != "시설장":
        raise HTTPException(403, "급여명세서 관리 권한이 없습니다. (관리자·시설장)")
    return current_user


def _view(p: Payslip) -> dict:
    return {
        "id": p.id, "staff_id": p.staff_id, "staff_name": p.staff_name,
        "year_month": p.year_month, "image_url": p.image_url,
        "uploaded_by": p.uploaded_by,
        "signed": bool(p.signature_url),
        "signature_url": p.signature_url,
        "signed_at": p.signed_at.isoformat() if p.signed_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.post("")
async def upload_payslip(month: str = Form(...), staff_id: str = Form(...),
                         file: UploadFile = File(...),
                         db: Session = Depends(get_db),
                         current_user: User = Depends(_manager)):
    """명세서 사진 업로드 — 같은 직원·같은 달이면 교체(서명은 리셋)."""
    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    st = db.query(LtcStaffMember).filter(LtcStaffMember.id == staff_id).first()
    if not st:
        raise HTTPException(404, "직원을 찾을 수 없습니다.")
    data = await file.read()
    from app.services.storage import save_upload
    url = save_upload(data, "payslips", file.filename or "payslip.jpg", file.content_type)

    row = db.query(Payslip).filter(Payslip.staff_id == staff_id,
                                   Payslip.year_month == month).first()
    if row:
        from app.services.storage import delete_upload
        delete_upload(row.image_url)
        row.image_url = url
        row.signature_url = None            # 새 명세서 = 다시 확인·서명
        row.signed_at = None
        row.uploaded_by = getattr(current_user, "name", None)
    else:
        row = Payslip(staff_id=staff_id, staff_name=st.name, year_month=month,
                      image_url=url, uploaded_by=getattr(current_user, "name", None))
        db.add(row)
    db.commit(); db.refresh(row)

    if st.user_id:
        y, m = month.split("-")
        notify_user(db, st.user_id, "급여명세서 도착",
                    f"{int(m)}월 급여명세서가 올라왔습니다. 내 근무표에서 확인하고 서명해주세요.",
                    data={"type": "my-schedule"})
    return ApiResponse(success=True, data=_view(row))


@router.get("")
def list_payslips(month: str = Query(...), db: Session = Depends(get_db),
                  _: User = Depends(_manager)):
    rows = (db.query(Payslip).filter(Payslip.year_month == month)
            .order_by(Payslip.staff_name).all())
    return ApiResponse(success=True, data=[_view(r) for r in rows])


@router.delete("/{pid}")
def delete_payslip(pid: str, db: Session = Depends(get_db), _: User = Depends(_manager)):
    row = db.query(Payslip).filter(Payslip.id == pid).first()
    if not row:
        raise HTTPException(404, "명세서를 찾을 수 없습니다.")
    from app.services.storage import delete_upload
    delete_upload(row.image_url)
    db.delete(row); db.commit()
    return ApiResponse(success=True, message="삭제했습니다.")


# ── 직원 본인 ─────────────────────────────────────────────

@router.get("/mine")
def my_payslip(month: str = Query(...), db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    from app.services.staff_link import resolve_staff_for_user
    staff = resolve_staff_for_user(db, current_user)
    row = db.query(Payslip).filter(Payslip.staff_id == staff.id,
                                   Payslip.year_month == month).first()
    return ApiResponse(success=True, data=_view(row) if row else None)


class SignBody(BaseModel):
    signature: Optional[str] = None
    use_saved_signature: Optional[bool] = None
    save_signature: Optional[bool] = None


@router.post("/mine/sign")
def sign_payslip(month: str = Query(...), body: SignBody = None,   # type: ignore[assignment]
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    """수령 확인 서명 — 연차 신청과 같은 저장 서명 재사용 지원."""
    from app.services.staff_link import resolve_staff_for_user
    staff = resolve_staff_for_user(db, current_user)
    row = db.query(Payslip).filter(Payslip.staff_id == staff.id,
                                   Payslip.year_month == month).first()
    if not row:
        raise HTTPException(404, "이 달 급여명세서가 아직 올라오지 않았습니다.")
    if row.signature_url:
        raise HTTPException(409, "이미 서명했습니다.")
    from app.api.v1.endpoints.leave import _resolve_signature
    body = body or SignBody()
    row.signature_url = _resolve_signature(db, current_user, staff.name, body.signature,
                                           bool(body.use_saved_signature), bool(body.save_signature))
    row.signed_at = now_kst()
    db.commit()
    return ApiResponse(success=True, data=_view(row))
