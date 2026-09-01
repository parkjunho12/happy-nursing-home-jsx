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
    StaffEvaluation, StaffEvalConfig, EVAL_ITEMS, MAX_SCORE, now_kst,
    MIN_ITEMS, MAX_ITEMS, MIN_MAX_SCORE, MAX_MAX_SCORE,
)
from app.schemas.response import ApiResponse

router = APIRouter()

PERIOD_RE = re.compile(r"^\d{4}-H[12]$")
# 항목 key — 사람이 입력하지 않는다. 화면은 이름만 다루고 key 는 서버가 붙인다.
# key 가 바뀌면 다른 항목이 되어 지난 점수와 이어지지 않기 때문이다.
KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,29}$")
LABEL_MAX = 60


def get_config(db: Session) -> dict:
    """지금 쓰는 항목과 배점. 설정이 없으면 기본값.

    기본값을 DB 에 미리 넣어두지 않는다 — 넣어두면 나중에 기본 항목을
    고쳐도 이미 저장된 값이 그대로 남아 아무도 왜 안 바뀌는지 모른다.
    """
    row = db.query(StaffEvalConfig).filter(StaffEvalConfig.id == 1).first()
    items = (row.items if row and row.items else None) or EVAL_ITEMS
    mx = (row.max_score if row and row.max_score else None) or MAX_SCORE
    return {"items": items, "max_score": mx,
            "full_marks": len(items) * mx,
            "updated_at": row.updated_at.isoformat() if row and row.updated_at else None,
            "updated_by": row.updated_by if row else None}


def _clean_items(raw) -> list:
    """항목 목록을 다듬는다. 잘못된 값은 400 으로 되돌린다.

    조용히 고쳐서 저장하지 않는다 — 관리자가 적은 것과 다른 항목이 표에
    나타나면 그때부터 무엇을 평가한 것인지 알 수 없어진다.
    """
    if not isinstance(raw, list):
        raise HTTPException(400, "항목 목록이 올바르지 않습니다.")
    if not (MIN_ITEMS <= len(raw) <= MAX_ITEMS):
        raise HTTPException(400, f"항목은 {MIN_ITEMS}~{MAX_ITEMS}개여야 합니다.")

    used, out = set(), []
    for i, it in enumerate(raw):
        if not isinstance(it, dict):
            raise HTTPException(400, f"{i + 1}번째 항목이 올바르지 않습니다.")
        label = str(it.get("label") or "").strip()
        if not label:
            raise HTTPException(400, f"{i + 1}번째 항목의 이름이 비어 있습니다.")
        if len(label) > LABEL_MAX:
            raise HTTPException(400, f"항목 이름은 {LABEL_MAX}자를 넘을 수 없습니다.")

        key = str(it.get("key") or "").strip().lower()
        if key and not KEY_RE.match(key):
            # 화면이 보낸 적 없는 모양이면 새 항목으로 본다
            key = ""
        if not key or key in used:
            # 새 항목 — key 를 서버가 붙인다. 지난 평가의 key 와 겹치면
            # 다른 항목의 점수를 이어받은 것처럼 보이므로 겹치지 않게 고른다.
            n = 1
            while f"item{n}" in used or any(x["key"] == f"item{n}" for x in out):
                n += 1
            key = f"item{n}"
        used.add(key)
        out.append({"key": key, "label": label})
    return out


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


def _clean_scores(raw: Optional[dict], items: list, max_score: int) -> dict:
    """아는 항목만, 1~5 만 받는다.

    범위를 안 보면 99점짜리 평가가 저장되고, 합계와 평균이 조용히 망가진다.
    모르는 항목은 버린다 — 화면이 옛 항목을 보내도 계산이 어긋나지 않게.
    """
    keys = {i["key"] for i in items}
    out = {}
    for k, v in (raw or {}).items():
        if k not in keys:
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
        if 1 <= n <= max_score:
            out[k] = n
    return out


def _view(e: Optional[StaffEvaluation]) -> Optional[dict]:
    """평가는 언제나 '그때의 잣대' 로 읽는다.

    항목과 배점은 설정에서 바뀐다. 지금 설정으로 지난 평가를 읽으면 항목
    수가 달라져 '6개 중 4개만 매김' 같은 거짓말이 나오고, 배점이 낮아졌으면
    지난 5점이 만점을 넘는 값이 된다. 그래서 저장된 스냅샷을 쓴다.
    """
    if not e:
        return None
    scores = e.scores or {}
    items = e.items or EVAL_ITEMS
    mx = e.max_score or MAX_SCORE
    return {
        "period": e.period,
        "scores": scores,
        "items": items,
        "max_score": mx,
        "full_marks": len(items) * mx,
        "comment": e.comment or "",
        "total": sum(scores.values()),
        # 다 매겼는지. 빈 칸이 있으면 합계를 신뢰할 수 없다.
        "filled": len(scores),
        "item_count": len(items),
        "evaluator_name": e.evaluator_name,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


class EvalBody(BaseModel):
    scores: dict = Field(default_factory=dict)
    comment: Optional[str] = None


@router.get("/config")
def read_config(db: Session = Depends(get_db), _: User = Depends(_admin_only)):
    """지금 쓰는 평가 항목과 배점."""
    d = get_config(db)
    d["limits"] = {"min_items": MIN_ITEMS, "max_items": MAX_ITEMS,
                   "min_score": MIN_MAX_SCORE, "max_score": MAX_MAX_SCORE,
                   "label_max": LABEL_MAX}
    return ApiResponse(success=True, data=d)


class ConfigBody(BaseModel):
    items: list = Field(default_factory=list)
    max_score: int = MAX_SCORE


@router.put("/config")
def save_config(body: ConfigBody, db: Session = Depends(get_db),
                current_user: User = Depends(_admin_only)):
    """항목·배점을 바꾼다.

    지난 평가는 건드리지 않는다. 평가마다 그때의 항목과 배점을 함께 저장해
    두기 때문에, 여기서 무엇을 바꾸든 지난 기록은 그대로 읽힌다.
    """
    if not (MIN_MAX_SCORE <= body.max_score <= MAX_MAX_SCORE):
        raise HTTPException(400, f"배점은 {MIN_MAX_SCORE}~{MAX_MAX_SCORE} 사이여야 합니다.")
    items = _clean_items(body.items)

    row = db.query(StaffEvalConfig).filter(StaffEvalConfig.id == 1).first()
    if not row:
        row = StaffEvalConfig(id=1)
        db.add(row)
    row.items = items
    row.max_score = body.max_score
    row.updated_by = current_user.name
    row.updated_at = now_kst()
    db.commit()
    return ApiResponse(success=True, data=get_config(db))


@router.get("")
def list_evaluations(period: str = Query(...), db: Session = Depends(get_db),
                     _: User = Depends(_admin_only)):
    """그 기간의 재직 직원 목록 + 각자의 평가(있으면).

    퇴사자는 빼고 입사 예정자도 뺀다. 아직 출근 안 하신 분을 평가할 수 없고,
    그만두신 분은 이 화면에서 할 일이 없다. (지난 평가는 이력에서 본다)
    """
    p = _check_period(period)
    cfg = get_config(db)
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
        "period": p, "items": cfg["items"], "max_score": cfg["max_score"],
        "full_marks": cfg["full_marks"], "rows": rows,
    })


@router.put("/{staff_id}")
def upsert_evaluation(staff_id: str, period: str, body: EvalBody,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_only)):
    p = _check_period(period)
    st = db.query(LtcStaffMember).filter(LtcStaffMember.id == staff_id).first()
    if not st:
        raise HTTPException(404, "직원을 찾을 수 없습니다.")

    cfg = get_config(db)
    e = (db.query(StaffEvaluation)
         .filter(StaffEvaluation.staff_id == staff_id,
                 StaffEvaluation.period == p).first())
    if not e:
        e = StaffEvaluation(staff_id=staff_id, period=p)
        db.add(e)
    # 저장할 때마다 지금 설정을 박아 둔다. 매기는 중에 설정이 바뀌면 그
    # 평가는 새 잣대로 매긴 것이 되고, 저장된 것도 그 잣대로 읽혀야 한다.
    e.items = cfg["items"]
    e.max_score = cfg["max_score"]

    e.scores = _clean_scores(body.scores, cfg["items"], cfg["max_score"])
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
