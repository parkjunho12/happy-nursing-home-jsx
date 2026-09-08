"""내보내야 할 문서 — 목록 · 교부 · 기록.

교부하면 지우지 않는다. 목록에서만 내리고 issued_at 을 채운다.
"그 서류 받으셨나요" 를 나중에 물어올 때 답할 수 있어야 한다.
"""
from __future__ import annotations

import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.eval import LtcResident
from app.models.outgoing_doc import OutgoingDoc, today_kst
from app.models.user import User
from app.schemas.response import ApiResponse

router = APIRouter()

_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# 어디로 나가는가 — 화면의 선택지와 같아야 한다
TARGETS = ("보호자", "어르신", "공단", "병원", "구청·주민센터", "기타")


def _editor(current_user: User = Depends(get_current_user)) -> User:
    """서류를 다루는 사람 — 사회복지사 라인과 간호팀.

    누가 무엇을 내보냈는지가 남는 기록이라, 볼 수 있는 사람과 고칠 수 있는
    사람을 같이 둔다. 시설 전체가 함께 보는 목록이다.
    """
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "사회복지사", "대표", "이사",
                                       "간호팀장", "간호사", "간호조무사", "사무원"):
        raise HTTPException(403, "내보낼 문서를 다룰 권한이 없습니다.")
    return current_user


class DocIn(BaseModel):
    person_id: Optional[str] = None
    title: str
    note: Optional[str] = None
    target: Optional[str] = None
    due_date: Optional[str] = None


class IssueIn(BaseModel):
    issued_to: Optional[str] = None
    issued_at: Optional[str] = None    # 비우면 오늘. 지난 날짜로 적을 수도 있다.


def _view(d: OutgoingDoc) -> dict:
    return {
        "id": d.id,
        "person_id": d.person_id, "person_name": d.person_name,
        "title": d.title, "note": d.note or "",
        "target": d.target, "due_date": d.due_date,
        "issued_at": d.issued_at, "issued_by": d.issued_by, "issued_to": d.issued_to,
        "created_by": d.created_by,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


@router.get("")
def list_docs(issued: Optional[bool] = Query(None, description="true=교부한 것, false=아직, 비우면 전부"),
              limit: int = Query(200),
              db: Session = Depends(get_db), _: User = Depends(_editor)):
    """목록. 기본은 전부 — 화면에서 '내보낼 것' 과 '기록' 으로 나눠 쓴다."""
    q = db.query(OutgoingDoc)
    if issued is True:
        q = q.filter(OutgoingDoc.issued_at.isnot(None))
    elif issued is False:
        q = q.filter(OutgoingDoc.issued_at.is_(None))
    # 아직 안 나간 것은 기한이 급한 순, 교부한 것은 최근 순
    rows = q.order_by(OutgoingDoc.issued_at.desc().nullsfirst(),
                      OutgoingDoc.due_date.asc().nullslast(),
                      OutgoingDoc.created_at.desc()).limit(max(1, min(limit, 500))).all()
    return ApiResponse(success=True, data=[_view(d) for d in rows])


@router.post("")
def add_doc(body: DocIn, db: Session = Depends(get_db), current_user: User = Depends(_editor)):
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(400, "어떤 문서인지 적어주세요.")
    due = (body.due_date or "").strip()
    if due and not _DATE.match(due):
        raise HTTPException(400, "기한은 YYYY-MM-DD 형식이어야 합니다.")

    name = None
    if body.person_id:
        r = db.query(LtcResident).filter(LtcResident.id == body.person_id).first()
        if not r:
            raise HTTPException(404, "그 어르신을 찾을 수 없습니다.")
        name = r.name

    d = OutgoingDoc(
        person_id=body.person_id or None, person_name=name,
        title=title[:200], note=((body.note or "").strip() or None),
        target=(body.target or "").strip() or None,
        due_date=due or None,
        created_by=getattr(current_user, "name", None),
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return ApiResponse(success=True, data=_view(d))


@router.post("/{doc_id}/issue")
def issue(doc_id: str, body: IssueIn, db: Session = Depends(get_db),
          current_user: User = Depends(_editor)):
    """교부 — 목록에서 내리고 날짜를 남긴다. 줄은 지우지 않는다."""
    d = db.query(OutgoingDoc).filter(OutgoingDoc.id == doc_id).first()
    if not d:
        raise HTTPException(404, "그 문서를 찾을 수 없습니다.")
    when = (body.issued_at or "").strip() or today_kst()
    if not _DATE.match(when):
        raise HTTPException(400, "교부일은 YYYY-MM-DD 형식이어야 합니다.")
    d.issued_at = when
    d.issued_by = getattr(current_user, "name", None)
    d.issued_to = (body.issued_to or "").strip() or None
    db.commit()
    db.refresh(d)
    return ApiResponse(success=True, data=_view(d))


@router.post("/{doc_id}/undo")
def undo(doc_id: str, db: Session = Depends(get_db), _: User = Depends(_editor)):
    """교부 취소 — 잘못 눌렀을 때. 되돌릴 길이 없으면 아무도 편히 못 누른다."""
    d = db.query(OutgoingDoc).filter(OutgoingDoc.id == doc_id).first()
    if not d:
        raise HTTPException(404, "그 문서를 찾을 수 없습니다.")
    d.issued_at = None
    d.issued_by = None
    d.issued_to = None
    db.commit()
    db.refresh(d)
    return ApiResponse(success=True, data=_view(d))


@router.delete("/{doc_id}")
def remove(doc_id: str, db: Session = Depends(get_db), _: User = Depends(_editor)):
    """잘못 넣은 줄을 지운다.

    교부한 것은 지우지 못하게 막는다 — 그건 '누구에게 언제 건넸다' 는 기록이고,
    지우면 나중에 확인할 방법이 없어진다. 잘못 교부했으면 취소부터 하면 된다.
    """
    d = db.query(OutgoingDoc).filter(OutgoingDoc.id == doc_id).first()
    if not d:
        raise HTTPException(404, "그 문서를 찾을 수 없습니다.")
    if d.issued_at:
        raise HTTPException(400, "교부한 기록은 지울 수 없습니다. 먼저 교부를 취소해주세요.")
    db.delete(d)
    db.commit()
    return ApiResponse(success=True, data={"deleted": doc_id})
