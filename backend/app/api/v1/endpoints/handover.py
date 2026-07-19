"""인수인계 AI 리포트 — 사진 판독·이력·공유·체크리스트 생성

접근: ADMIN · 시설장 · 간호사 · 간호조무사 · 사회복지사 · 지정 직원(users.handover_access)
"""
from __future__ import annotations
import copy
import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.handover import HandoverReport
from app.schemas.response import ApiResponse
from app.services.handover_ai import analyze_handover, regenerate_summary
from app.services.resident_match import apply_matching
from app.models.eval import LtcResident, LtcStaffMember
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

    # 판독은 명단 없이 '있는 그대로' — 이름 확정은 아래 매칭 단계에서만 수행
    report = analyze_handover(blobs, mts)

    # 판독된 어르신 이름을 등록 수급자 명단과 대조(오독 교정·연동)
    try:
        roster = [{"id": r.id, "name": r.name}
                  for r in db.query(LtcResident).filter(LtcResident.status == "active").all()]
        staff = [{"id": st.id, "name": st.name}
                 for st in db.query(LtcStaffMember).filter(LtcStaffMember.status == "active").all()]
        report = apply_matching(report, roster, staff)
    except Exception:
        pass   # 매칭 실패해도 판독 결과는 그대로 저장

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


@router.post("/history/{rid}/regenerate")
def regenerate(rid: str, db: Session = Depends(get_db), _: User = Depends(_can_use)):
    """확정된 어르신 이름으로 요약·주의·후속조치를 다시 만든다.

    이름을 고쳐도 요약문은 AI가 쓴 문장이라 이름이 그대로 남는다.
    구조화된 필드만 갱신할 수 없으므로, 문장 자체를 다시 생성한다.
    """
    row = db.query(HandoverReport).filter(HandoverReport.id == rid).first()
    if not row:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")

    rep = copy.deepcopy(row.report or {})
    entries = rep.get("entries") or []
    result, err = regenerate_summary(entries)
    if not result:
        raise HTTPException(502, f"요약 재생성에 실패했습니다. ({err})")

    for k in ("summary", "key_points", "alerts", "suggested_checklists"):
        if k in result:
            rep[k] = result[k]

    # 재생성된 제안에도 확정된 수급자 연결을 복원
    id_by_name = {}
    for e in entries:
        nm = (e.get("resident_matched") or "").strip()
        if nm and e.get("resident_id"):
            id_by_name[nm] = e["resident_id"]
    for c in rep.get("suggested_checklists") or []:
        pn = (c.get("person_name") or "").strip()
        if pn in id_by_name:
            c["resident_id"] = id_by_name[pn]

    pipe = rep.get("pipeline") or {}
    pipe["claude_calls"] = (pipe.get("claude_calls") or 0) + 1
    pipe["regenerated"] = True
    rep["pipeline"] = pipe

    row.report = rep
    db.commit(); db.refresh(row)
    return ApiResponse(success=True, data=_view(row))


class MatchConfirm(BaseModel):
    entry_index: int
    resident_id: Optional[str] = None      # None 이면 '명단에 없음'으로 확정
    resident_name: Optional[str] = None


@router.patch("/history/{rid}/match")
def confirm_match(rid: str, body: MatchConfirm,
                  db: Session = Depends(get_db), _: User = Depends(_can_use)):
    """담당자가 어르신 이름을 직접 확정한다(AI 제안 → 사람 승인)."""
    row = db.query(HandoverReport).filter(HandoverReport.id == rid).first()
    if not row:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")

    rep = copy.deepcopy(row.report or {})
    entries = rep.get("entries") or []
    if not (0 <= body.entry_index < len(entries)):
        raise HTTPException(400, "잘못된 항목 번호입니다.")

    # 선택한 '그 행'만 변경한다.
    # 같은 이름으로 보여도 실제로는 다른 어르신일 수 있으므로 다른 행에는 적용하지 않는다.
    target = entries[body.entry_index]
    raw = (target.get("resident") or "").strip()
    prev = (target.get("resident_matched") or "").strip()

    target["resident_id"] = body.resident_id
    target["resident_matched"] = body.resident_name
    target["match"] = "confirmed" if body.resident_id else "none"
    target.pop("match_suggest", None)
    target.pop("match_candidates", None)

    # 이 행에서 파생된 후속 조치 제안은 확정된 이름으로 함께 갱신한다.
    # (제안의 대상자 이름은 판독 당시 이름을 그대로 쓰므로, 교정되면 따라가야 한다)
    aliases = {n for n in (raw, prev) if n}
    if aliases and body.resident_name:
        for c in rep.get("suggested_checklists") or []:
            pn = (c.get("person_name") or "").strip()
            if pn and pn in aliases:
                c["person_name"] = body.resident_name
                c["resident_id"] = body.resident_id

    m = rep.get("matching") or {}
    m["matched"] = sum(1 for e in entries if e.get("resident_id"))
    m["ambiguous"] = sum(1 for e in entries if e.get("match") == "ambiguous")
    m["unmatched_names"] = sorted({(e.get("resident") or "").strip() for e in entries
                                   if (e.get("resident") or "").strip() and not e.get("resident_id")})
    rep["matching"] = m

    row.report = rep          # JSON 컬럼은 재할당해야 변경이 감지된다
    db.commit(); db.refresh(row)
    return ApiResponse(success=True, data=_view(row))


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
