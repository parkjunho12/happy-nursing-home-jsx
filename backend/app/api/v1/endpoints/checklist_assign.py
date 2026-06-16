"""
체크리스트 다중 담당자 지정 API

GET    /eval/checklists/:id/assignees          — 담당자 목록 조회
PUT    /eval/checklists/:id/assignees          — 담당자 일괄 교체
POST   /eval/checklists/:id/assignees/:uid     — 담당자 추가
DELETE /eval/checklists/:id/assignees/:uid     — 담당자 제거
GET    /eval/checklists/my-tasks               — 내 담당 업무
GET    /eval/checklists/staff-progress         — 직원별 진행률
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.eval import ChecklistItem, ChecklistOccurrence, ChecklistItemAssignee
from app.schemas.response import ApiResponse

router = APIRouter()
KST = timezone(timedelta(hours=9))


def _check_active(u: User):
    if not (u.is_active if u.is_active is not None else True):
        raise HTTPException(403, "비활성화된 계정입니다")

def _require_manager(u: User):
    if u.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(403, "관리자/팀장 권한이 필요합니다")

def _assignee_info(db: Session, item_id: str) -> List[dict]:
    rows = db.query(ChecklistItemAssignee).filter(
        ChecklistItemAssignee.checklist_item_id == item_id
    ).all()
    result = []
    for row in rows:
        u = db.query(User).filter(User.id == row.user_id).first()
        if u:
            result.append({
                "user_id":  u.id,
                "name":     u.name,
                "position": u.position,
                "role":     u.role.value if hasattr(u.role, 'value') else u.role,
            })
    return result


# ── 담당자 조회 ────────────────────────────────────────────────────────────────
@router.get("/{item_id}/assignees")
def get_assignees(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_active(current_user)
    return ApiResponse(success=True, data=_assignee_info(db, item_id))


# ── 담당자 일괄 교체 (PUT) ─────────────────────────────────────────────────────
class AssignBulkBody(BaseModel):
    user_ids: List[str]

@router.put("/{item_id}/assignees")
def set_assignees(
    item_id: str,
    body: AssignBulkBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """담당자 목록을 통째로 교체. 빈 배열 전달 시 전체 해제."""
    _check_active(current_user)
    _require_manager(current_user)

    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item: raise HTTPException(404, "체크리스트 항목을 찾을 수 없습니다")

    # 기존 전체 삭제
    db.query(ChecklistItemAssignee).filter(
        ChecklistItemAssignee.checklist_item_id == item_id
    ).delete()

    # 새로 추가
    for uid in body.user_ids:
        u = db.query(User).filter(User.id == uid).first()
        if not u: continue
        db.add(ChecklistItemAssignee(
            id=str(uuid.uuid4()),
            checklist_item_id=item_id,
            user_id=uid,
            assigned_by=current_user.id,
            assigned_at=datetime.now(KST),
        ))

    # 기존 assignee 문자열도 동기화 (하위 호환)
    users = [db.query(User).filter(User.id == uid).first() for uid in body.user_ids]
    item.assignee = ", ".join(u.name for u in users if u)

    db.commit()
    return ApiResponse(success=True, data=_assignee_info(db, item_id))


# ── 담당자 추가 (POST) ─────────────────────────────────────────────────────────
@router.post("/{item_id}/assignees/{user_id}")
def add_assignee(
    item_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_active(current_user)
    _require_manager(current_user)

    # 중복 체크
    exists = db.query(ChecklistItemAssignee).filter(
        ChecklistItemAssignee.checklist_item_id == item_id,
        ChecklistItemAssignee.user_id == user_id,
    ).first()
    if exists:
        return ApiResponse(success=True, data=_assignee_info(db, item_id))

    target = db.query(User).filter(User.id == user_id).first()
    if not target: raise HTTPException(404, "직원을 찾을 수 없습니다")

    db.add(ChecklistItemAssignee(
        id=str(uuid.uuid4()),
        checklist_item_id=item_id,
        user_id=user_id,
        assigned_by=current_user.id,
        assigned_at=datetime.now(KST),
    ))

    # assignee 문자열 동기화
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if item:
        current_names = [n.strip() for n in (item.assignee or "").split(",") if n.strip()]
        if target.name not in current_names:
            current_names.append(target.name)
        item.assignee = ", ".join(current_names)

    db.commit()
    return ApiResponse(success=True, data=_assignee_info(db, item_id))


# ── 담당자 제거 (DELETE) ───────────────────────────────────────────────────────
@router.delete("/{item_id}/assignees/{user_id}")
def remove_assignee(
    item_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_active(current_user)
    _require_manager(current_user)

    row = db.query(ChecklistItemAssignee).filter(
        ChecklistItemAssignee.checklist_item_id == item_id,
        ChecklistItemAssignee.user_id == user_id,
    ).first()
    if row:
        db.delete(row)

    # assignee 문자열에서 해당 이름 제거
    target = db.query(User).filter(User.id == user_id).first()
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if item and target:
        names = [n.strip() for n in (item.assignee or "").split(",")
                 if n.strip() and n.strip() != target.name]
        item.assignee = ", ".join(names)

    db.commit()
    return ApiResponse(success=True, data=_assignee_info(db, item_id))


# ── 내 담당 업무 ───────────────────────────────────────────────────────────────
@router.get("/my-tasks")
def my_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_active(current_user)

    # 이 직원이 담당자로 지정된 체크리스트 항목 ID 목록
    my_item_ids = [
        row.checklist_item_id
        for row in db.query(ChecklistItemAssignee).filter(
            ChecklistItemAssignee.user_id == current_user.id
        ).all()
    ]

    if not my_item_ids:
        return ApiResponse(success=True, data=[])

    items = db.query(ChecklistItem).filter(
        ChecklistItem.id.in_(my_item_ids),
        ChecklistItem.active == True,
    ).all()

    result = []
    for item in items:
        # 미완료 occurrence만
        pending_occs = [
            o for o in item.occurrences
            if o.status in ("pending", "overdue")
        ]
        result.append({
            "item_id":    item.id,
            "title":      item.title,
            "frequency":  item.frequency,
            "risk_level": item.risk_level,
            "due_date":   getattr(item, "due_date", None),
            "pending_count": len(pending_occs),
            "assignees":  _assignee_info(db, item.id),
        })

    return ApiResponse(success=True, data=result)


# ── 직원별 진행률 ──────────────────────────────────────────────────────────────
@router.get("/staff-progress")
def staff_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_active(current_user)
    _require_manager(current_user)

    users = db.query(User).filter(User.is_active != False).all()
    all_assignments = db.query(ChecklistItemAssignee).all()
    active_item_ids = {
        i.id for i in db.query(ChecklistItem).filter(ChecklistItem.active == True).all()
    }
    all_occs = db.query(ChecklistOccurrence).all()

    result = []
    for u in users:
        my_item_ids = {
            a.checklist_item_id for a in all_assignments
            if a.user_id == u.id and a.checklist_item_id in active_item_ids
        }
        my_occs = [o for o in all_occs if o.checklist_item_id in my_item_ids]
        total     = len(my_occs)
        completed = sum(1 for o in my_occs if o.status == "completed")
        overdue   = sum(1 for o in my_occs if o.status == "overdue")
        result.append({
            "user_id":   u.id,
            "name":      u.name,
            "position":  u.position,
            "role":      u.role.value if hasattr(u.role, 'value') else u.role,
            "items":     len(my_item_ids),
            "total":     total,
            "completed": completed,
            "overdue":   overdue,
            "rate":      round(completed / total * 100) if total else 0,
        })

    return ApiResponse(success=True, data=sorted(result, key=lambda x: -x["items"]))
