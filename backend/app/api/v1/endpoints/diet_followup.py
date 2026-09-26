"""식이 변경 후속조치 — 욕구사정·급여제공계획서.

식사 형태가 바뀌면 서류도 따라가야 한다. 지도점검에서 보는 것은 '식이가
바뀐 날' 과 '계획서에 반영된 날' 이 맞물리는가다.

주방에 알리려고 식이를 바꾸는 사람과 서류를 쓰는 사람이 달라서, 말로 전하면
잊힌다. 그래서 식이를 바꾸는 순간 할 일이 한 줄 생기고(endpoints/diet 의
_open_followup, 판단은 services/diet_followup), 끝날 때까지 대시보드에 뜬다.

할 일은 셋이다 — 욕구사정을 하고, 계획서에 반영하고, 「어르신 서류현황」에
작성 일시를 적는다. 점검에서 보는 것은 그 일시라, 문서만 고치고 일시를 안
적으면 안 한 것과 같다.

권한: 식이를 바꿀 수 있는 자리와 같다 — 간호팀·복지팀·영양사·시설장·관리자.
      서류를 쓰는 사람들이고, 이 목록에 어르신 성함과 식사 형태가 적힌다.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.diet_followup import DietFollowUp, TASK_LABEL, TASKS
from app.models.user import User
from app.schemas.response import ApiResponse
from app.api.v1.endpoints.diet import can_edit_diet, _pos, _role

router = APIRouter()
KST = timezone(timedelta(hours=9))


def _editor(u: User = Depends(get_current_user)) -> User:
    if not can_edit_diet(_role(u), _pos(u)):
        raise HTTPException(403, "식이 후속조치 권한이 없습니다. (관리자·시설장·사회복지사·영양사·간호팀)")
    return u


def _view(f: DietFollowUp) -> Dict[str, Any]:
    def st(dt: Optional[datetime]) -> Optional[str]:
        return dt.isoformat() if dt else None
    return {
        "id": f.id,
        "resident_id": f.resident_id,
        "resident_name": f.resident_name,
        "floor": f.floor, "room": f.room,
        "effective_date": f.effective_date,
        "before_label": f.before_label,
        "after_label": f.after_label,
        "note": f.note,
        "tasks": [
            {"key": k, "label": TASK_LABEL[k],
             "done_at": st(getattr(f, f"{k}_at")),
             "done_by": getattr(f, f"{k}_by")}
            for k in TASKS
        ],
        "done_at": st(f.done_at), "done_by": f.done_by,
        "skip_reason": f.skip_reason,
        "created_at": st(f.created_at),
    }


@router.get("")
def list_followups(scope: str = Query("open", description="open | done | all"),
                   limit: int = Query(100),
                   db: Session = Depends(get_db), _: User = Depends(_editor)):
    """할 일 목록. 기본은 아직 안 끝난 것 — 오래된 것이 위로.

    오래 묵은 것이 위로 와야 한다. 최근 것부터 보여주면 몇 달 지난 건이
    맨 아래에 깔려 영영 안 끝난다.
    """
    q = db.query(DietFollowUp)
    if scope == "open":
        q = q.filter(DietFollowUp.done_at.is_(None))
    elif scope == "done":
        q = q.filter(DietFollowUp.done_at.isnot(None))
    rows = (q.order_by(DietFollowUp.done_at.isnot(None),
                       DietFollowUp.effective_date.asc(),
                       DietFollowUp.created_at.asc())
            .limit(max(1, min(limit, 500))).all())
    open_count = db.query(DietFollowUp).filter(DietFollowUp.done_at.is_(None)).count()
    return ApiResponse(success=True, data={
        "items": [_view(r) for r in rows],
        "open_count": open_count,
    })


class TaskBody(BaseModel):
    task: str                      # assess | plan | docs
    done: bool = True


@router.post("/{fid}/task")
def set_task(fid: str, body: TaskBody, db: Session = Depends(get_db),
             u: User = Depends(_editor)):
    """할 일 하나를 했다/안 했다로 바꾼다.

    다 끝나면 이 건은 저절로 닫힌다 — 따로 '완료' 를 한 번 더 누르게 하면
    그 한 번을 안 눌러서 목록에 계속 남는다.
    """
    if body.task not in TASKS:
        raise HTTPException(400, f"알 수 없는 항목입니다: {body.task}")
    f = db.query(DietFollowUp).filter(DietFollowUp.id == fid).first()
    if not f:
        raise HTTPException(404, "후속조치를 찾을 수 없습니다.")
    who = getattr(u, "name", None)
    setattr(f, f"{body.task}_at", datetime.now(KST) if body.done else None)
    setattr(f, f"{body.task}_by", who if body.done else None)

    if all(getattr(f, f"{k}_at") for k in TASKS):
        f.done_at = datetime.now(KST)
        f.done_by = who
        f.skip_reason = None       # 다 해서 닫은 건은 '해당 없음' 이 아니다
    else:
        # 하나라도 풀리면 다시 할 일로 돌아온다
        f.done_at = None
        f.done_by = None
    db.commit(); db.refresh(f)
    return ApiResponse(success=True, data=_view(f))


class SkipBody(BaseModel):
    reason: Optional[str] = None


@router.post("/{fid}/skip")
def skip(fid: str, body: SkipBody, db: Session = Depends(get_db),
         u: User = Depends(_editor)):
    """해당 없음으로 접는다 — 까닭을 적어야 접힌다.

    적어 두지 않으면 나중에 '왜 안 했지' 를 따질 수 없다. 접은 건도 지우지
    않고 남긴다.
    """
    reason = (body.reason or "").strip()
    if len(reason) < 2:
        raise HTTPException(400, "접는 까닭을 적어 주세요.")
    f = db.query(DietFollowUp).filter(DietFollowUp.id == fid).first()
    if not f:
        raise HTTPException(404, "후속조치를 찾을 수 없습니다.")
    f.done_at = datetime.now(KST)
    f.done_by = getattr(u, "name", None)
    f.skip_reason = reason[:1000]
    db.commit(); db.refresh(f)
    return ApiResponse(success=True, data=_view(f))


@router.post("/{fid}/reopen")
def reopen(fid: str, db: Session = Depends(get_db), u: User = Depends(_editor)):
    """다시 할 일로 — 잘못 접었을 때."""
    f = db.query(DietFollowUp).filter(DietFollowUp.id == fid).first()
    if not f:
        raise HTTPException(404, "후속조치를 찾을 수 없습니다.")
    f.done_at = None
    f.done_by = None
    f.skip_reason = None
    db.commit(); db.refresh(f)
    return ApiResponse(success=True, data=_view(f))
