"""직원 평가(인사고과) — ADMIN 만.

■ 권한을 서버에서 막는 이유

  화면의 라우트 가드는 메뉴를 감춰 줄 뿐이다. 주소를 직접 치거나 API 를
  그대로 부르면 그만이다. 인사평가는 본인이 봐서도 안 되고 동료가 봐서도
  안 되는 기록이라, 여기서 role 을 확인한다.

  시설장도 막는다. 시설장은 대부분의 관리 메뉴를 쓰지만 '관리자만'
  이라고 정했고, 권한을 넓힐지는 사람이 정할 일이지 내가 추측할 일이 아니다.

■ 기간

  반기 — '2026-H1'(1~6월) / '2026-H2'(7~12월).
  형식을 서버에서 확인한다. 'H3' 같은 값이 들어오면 그 평가는 어느 화면에도
  다시 나타나지 않아 조용히 사라진다.
"""
from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import LtcStaffMember
from app.models.staff_eval import (
    StaffEvaluation, EVAL_ITEMS, MAX_SCORE, FULL_MARKS, now_kst,
)
from app.schemas.common import ApiResponse

router = APIRouter()

PERIOD_RE = re.compile(r"^\d{4}-H[12]$")
ITEM_KEYS = {i["key"] for i in EVAL_ITEMS}


def _admin_only(current_user: User = Depends(get_current_user)) -> User:
    """관리자만. 인사평가는 본인도 동료도 보면 안 된다."""
    role = getattr(current_user.role, "value", str(current_user.role))
    if role != "ADMIN":
        raise HTTPException(403, "직원 평가는 관리자만 볼 수 있습니다.")
    return current_user


def _check_period(v: str) -> str:
    v = (v or "").strip().upper()
    if not PERIOD_RE.match(v):
        raise HTTPException(400, "기간은 2026-H1 형식이어야 합니다.")
    return v


def _clean_scores(raw: Optional[dict]) -> dict:
    """아는 항목만, 1~5 만 받는다.

    범위를 안 보면 99점짜리 평가가 저장되고, 합계와 평균이 조용히 망가진다.
    모르는 항목은 버린다 — 화면이 옛 항목을 보내도 계산이 어긋나지 않게.
    """
    out = {}
    for k, v in (raw or {}).items():
        if k not in ITEM_KEYS:
            continue
        # 소수는 받지 않는다. int(4.7) 은 4가 되는데, 그렇게 깎아 저장하면
        # 매긴 사람의 뜻과 다른 점수가 인사 기록에 남는다. 차라리 버린다.
        if isinstance(v, bool):
            continue                      # True 가 1 로 새는 것을 막는다
        if isinstance(v, float) and not v.is_integer():
            continue
        try:
            n = int(v)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= MAX_SCORE:
            out[k] = n
    return out


def _view(e: Optional[StaffEvaluation]) -> Optional[dict]:
    if not e:
        return None
    scores = e.scores or {}
    return {
        "period": e.period,
        "scores": scores,
        "items": e.items or EVAL_ITEMS,
        "comment": e.comment or "",
        "total": sum(scores.values()),
        # 다 매겼는지. 빈 칸이 있으면 합계를 신뢰할 수 없다.
        "filled": len(scores),
        "item_count": len(e.items or EVAL_ITEMS),
        "evaluator_name": e.evaluator_name,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


class EvalBody(BaseModel):
    scores: dict = Field(default_factory=dict)
    comment: Optional[str] = None


@router.get("/meta")
def meta(_: User = Depends(_admin_only)):
    """평가 항목과 배점 — 화면이 이걸 보고 표를 그린다."""
    return ApiResponse(success=True, data={
        "items": EVAL_ITEMS, "max_score": MAX_SCORE, "full_marks": FULL_MARKS,
    })


@router.get("")
def list_evaluations(period: str = Query(...), db: Session = Depends(get_db),
                     _: User = Depends(_admin_only)):
    """그 기간의 재직 직원 목록 + 각자의 평가(있으면).

    퇴사자는 빼고 입사 예정자도 뺀다. 아직 출근 안 하신 분을 평가할 수 없고,
    그만두신 분은 이 화면에서 할 일이 없다. (지난 평가는 이력에서 본다)
    """
    p = _check_period(period)
    staff = (db.query(LtcStaffMember)
             .filter(LtcStaffMember.status == "active")
             .order_by(LtcStaffMember.hire_date).all())
    got = {e.staff_id: e for e in db.query(StaffEvaluation)
           .filter(StaffEvaluation.period == p).all()}
    rows = [{
        "staff_id": s.id, "name": s.name, "position": s.position,
        "hire_date": (s.hire_date or "")[:10],
        "evaluation": _view(got.get(s.id)),
    } for s in staff]
    return ApiResponse(success=True, data={
        "period": p, "items": EVAL_ITEMS, "max_score": MAX_SCORE,
        "full_marks": FULL_MARKS, "rows": rows,
    })


@router.put("/{staff_id}")
def upsert_evaluation(staff_id: str, period: str, body: EvalBody,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_only)):
    p = _check_period(period)
    st = db.query(LtcStaffMember).filter(LtcStaffMember.id == staff_id).first()
    if not st:
        raise HTTPException(404, "직원을 찾을 수 없습니다.")

    e = (db.query(StaffEvaluation)
         .filter(StaffEvaluation.staff_id == staff_id,
                 StaffEvaluation.period == p).first())
    if not e:
        e = StaffEvaluation(staff_id=staff_id, period=p)
        db.add(e)
        # 항목은 처음 만들 때의 것으로 박아 둔다. 나중에 항목이 바뀌어도
        # 그때 무엇을 물었는지가 남아야 한다.
        e.items = EVAL_ITEMS

    e.scores = _clean_scores(body.scores)
    e.comment = (body.comment or "").strip()[:2000] or None
    e.evaluator_id = current_user.id
    e.evaluator_name = current_user.name
    e.updated_at = now_kst()
    db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e))


@router.delete("/{staff_id}")
def delete_evaluation(staff_id: str, period: str, db: Session = Depends(get_db),
                      _: User = Depends(_admin_only)):
    p = _check_period(period)
    e = (db.query(StaffEvaluation)
         .filter(StaffEvaluation.staff_id == staff_id,
                 StaffEvaluation.period == p).first())
    if e:
        db.delete(e); db.commit()
    return ApiResponse(success=True, data={"deleted": bool(e)})


@router.get("/history/{staff_id}")
def history(staff_id: str, db: Session = Depends(get_db),
            _: User = Depends(_admin_only)):
    """한 사람의 기간별 평가 — 나아지고 있는지 보려면 한 줄로 늘어놔야 한다."""
    rows = (db.query(StaffEvaluation)
            .filter(StaffEvaluation.staff_id == staff_id)
            .order_by(StaffEvaluation.period.desc()).all())
    return ApiResponse(success=True, data={"rows": [_view(e) for e in rows]})
