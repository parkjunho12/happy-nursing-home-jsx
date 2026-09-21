"""수가(급여) 계산기 — 비공개 원본 스냅샷 + 월별 시나리오. ADMIN 전용.

접근 통제: `get_current_admin_user` 하나만 쓴다. 시설장 등 직군 예외(bypass) 없음 —
스프레드시트 원본(수식 포함)과 시나리오 입력값은 민감한 경영 정보라 ADMIN 만 본다.

계약(contract):
- GET  /source            : 최신 스냅샷 1건. 없으면 `null`.
- PUT  /source             : 스냅샷 저장(upsert, 항상 최신 1건만 유지). 요청 바디와 같은
                             필드에 `updated_at`(및 `updated_by`)이 붙어 돌아온다.
- GET  /scenarios          : 월별 시나리오 배열. `[{month, inputs, updated_at, updated_by}, ...]`
- PUT  /scenarios/{month}  : 월별 시나리오 upsert. `expected_updated_at` 로 낙관적 잠금.
                             서버에 저장된 `updated_at` 과 다르면(동시 수정 충돌) 409.
                             `inputs` 는 `apps/admin/src/utils/feeCalculator.ts` 의
                             `FeeInputs`/`validateInputs()` 규칙을 그대로 서버에서도 검사한다
                             — 여기서 막지 않으면 나중에 다른 화면의 계산 엔진이 죽는다.
- GET  /context (optional) : 현재 재원 중인 어르신의 등급별 인원수만 집계. 이름 등 개인정보 없음.

모든 엔드포인트는 `app/core/security.py::get_current_admin_user` 로만 보호한다.

동시성:
- 행이 있을 때는 `SELECT ... FOR UPDATE` 로 잠가 같은 행을 향한 읽기·수정 경쟁을 직렬화한다
  (SQLite 는 FOR UPDATE 를 지원하지 않아 조용히 무시된다 — 테스트는 되지만 실제 잠금 효과는
  Postgres 운영 DB에서만 있다).
- 행이 아직 없을 때 두 요청이 동시에 처음 생성을 시도하면 고유 제약 위반(IntegrityError)이
  나는 쪽이 있다 — 그 요청은 롤백 후 409 로 "다시 시도해달라"고 응답한다(조용히 죽지 않는다).
"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.models.user import User
from app.models.fee_calculator import FeeCalculatorSource, FeeCalculatorScenario
from app.models.carefor import CareforResident
from app.services.fee_calculator_validation import validate_fee_inputs

router = APIRouter()

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")

# 원본 스냅샷 행은 하나만 둔다(싱글턴) — 이 고정 id 로 upsert·동시성 처리를 단순하게 만든다.
SOURCE_SINGLETON_ID = "fee_calculator_source_singleton"

# ── 입력 상한 ────────────────────────────────────────────────────────────
# 원본 스냅샷(스프레드시트)은 시트 여러 개 · 셀 수천 개까지 있을 수 있어 넉넉히,
# 그래도 DB 한 행이 무한정 커지지 않도록 상한을 둔다.
MAX_SHEETS = 50
MAX_CELLS_TOTAL = 50_000
MAX_CELL_STR_LEN = 4_000          # value/formula 각각 최대 길이(문자)
MAX_SHEET_NAME_LEN = 200
# app/models/fee_calculator.py::FeeCalculatorSource.source_url 컬럼(String(1000))과 맞춘다
MAX_SOURCE_URL_LEN = 1_000
MAX_SOURCE_PAYLOAD_BYTES = 8 * 1024 * 1024   # 스냅샷 전체 직렬화 크기 상한(8MB)
MAX_SCENARIO_PAYLOAD_BYTES = 512 * 1024      # 시나리오 입력값 상한(512KB)
MAX_INPUTS_KEYS = 200

# source_url 은 구글 스프레드시트만 허용한다 — 비공개 원본 링크가 임의 외부 URL로
# 새 나가거나(SSRF성 오·남용), 프론트가 알 수 없는 링크를 열어버리는 것을 막는다.
_SOURCE_URL_RE = re.compile(r"^https://docs\.google\.com/spreadsheets/", re.IGNORECASE)

# 셀 값은 스칼라만 허용한다(중첩 dict/list 금지) — 스프레드시트 셀 값은 원래 스칼라이고,
# 중첩 구조를 허용하면 크기 상한을 우회하거나 프론트 렌더링이 예기치 않게 깨질 수 있다.
CellValue = Union[str, int, float, bool, None]


def _is_bad_number(x: Any) -> bool:
    """NaN·Infinity 는 JSON 표준에 없고 DB/프론트 양쪽에서 사고를 낸다 — 명시적으로 막는다."""
    return isinstance(x, float) and (math.isnan(x) or math.isinf(x))


def _walk_reject_nan(value: Any, path: str = "$") -> None:
    """중첩 dict/list 를 순회하며 NaN·Infinity 값이 있으면 400 으로 거절한다."""
    if _is_bad_number(value):
        raise HTTPException(400, f"{path}: NaN/Infinity 값은 저장할 수 없습니다.")
    if isinstance(value, dict):
        for k, v in value.items():
            _walk_reject_nan(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _walk_reject_nan(v, f"{path}[{i}]")


def _json_size(value: Any) -> int:
    try:
        return len(json.dumps(value, ensure_ascii=False, allow_nan=False))
    except ValueError:
        # allow_nan=False 가 NaN/Infinity 를 먼저 잡아준다 — 여기 걸리면 확실히 거절
        raise HTTPException(400, "NaN/Infinity 값은 저장할 수 없습니다.")


def _parse_dt(value: str, field: str) -> datetime:
    try:
        v = value.strip()
        if v.endswith("Z"):
            v = v[:-1] + "+00:00"
        return datetime.fromisoformat(v)
    except Exception:
        raise HTTPException(400, f"{field} 은(는) ISO 8601 날짜/시각 형식이어야 합니다.")


# ── 스키마 ───────────────────────────────────────────────────────────────
class SourceCell(BaseModel):
    cell: str = Field(..., min_length=1, max_length=20)   # 예: 'A1'
    value: CellValue = None
    formula: Optional[str] = None

    @field_validator("cell")
    @classmethod
    def _cell_ref(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[A-Za-z]{1,3}\d{1,7}$", v):
            raise ValueError("cell 은 'A1' 같은 셀 참조 형식이어야 합니다.")
        return v.upper()

    @field_validator("value")
    @classmethod
    def _value_bounds(cls, v: CellValue) -> CellValue:
        # NaN/Infinity 는 여기서 ValueError 로 막지 않는다 — pydantic 이 필드
        # 검증 실패로 만드는 기본 422 응답은 실패한 '원래 입력값'을 그대로 JSON에
        # 싣는데, Starlette 의 기본 JSONResponse 는 NaN 을 직렬화하지 못해
        # (allow_nan=False) 그 순간 500 으로 죽는다 — 결과적으로 막으려던 값이
        # 오히려 서버를 죽인다. 그래서 타입 통과는 허용해 두고, NaN/Infinity 는
        # 파싱이 끝난 뒤 `_walk_reject_nan()` 이 평문 메시지로 400 을 낸다.
        if isinstance(v, str) and len(v) > MAX_CELL_STR_LEN:
            raise ValueError(f"셀 값은 {MAX_CELL_STR_LEN}자를 넘을 수 없습니다.")
        return v

    @field_validator("formula")
    @classmethod
    def _formula_bounds(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > MAX_CELL_STR_LEN:
            raise ValueError(f"formula 는 {MAX_CELL_STR_LEN}자를 넘을 수 없습니다.")
        return v


class SourceSheet(BaseModel):
    name: str = Field(..., min_length=1, max_length=MAX_SHEET_NAME_LEN)
    gid: Optional[str] = None
    cells: List[SourceCell] = Field(default_factory=list)

    @field_validator("gid", mode="before")
    @classmethod
    def _gid_to_str(cls, v: Any) -> Optional[str]:
        return None if v is None else str(v)


class SourceBody(BaseModel):
    sheets: List[SourceSheet] = Field(default_factory=list)
    captured_at: str
    source_url: Optional[str] = Field(default=None, max_length=MAX_SOURCE_URL_LEN)

    @field_validator("sheets")
    @classmethod
    def _sheets_bounds(cls, v: List[SourceSheet]) -> List[SourceSheet]:
        if len(v) > MAX_SHEETS:
            raise ValueError(f"시트는 {MAX_SHEETS}개를 넘을 수 없습니다.")
        total_cells = sum(len(s.cells) for s in v)
        if total_cells > MAX_CELLS_TOTAL:
            raise ValueError(f"전체 셀 수는 {MAX_CELLS_TOTAL}개를 넘을 수 없습니다.")
        return v

    @field_validator("source_url")
    @classmethod
    def _source_url_ok(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if len(v) > MAX_SOURCE_URL_LEN:
            raise ValueError(f"source_url 은 {MAX_SOURCE_URL_LEN}자를 넘을 수 없습니다.")
        if not _SOURCE_URL_RE.match(v):
            raise ValueError("source_url 은 'https://docs.google.com/spreadsheets/...' 형식만 허용합니다.")
        return v


class SourceResponse(BaseModel):
    sheets: List[SourceSheet]
    captured_at: str
    source_url: Optional[str] = None
    updated_at: str
    updated_by: Optional[str] = None


class ScenarioBody(BaseModel):
    inputs: Dict[str, Any] = Field(default_factory=dict)
    # 낙관적 잠금 — 클라이언트가 마지막으로 읽은 updated_at. 새 시나리오면 null.
    expected_updated_at: Optional[str] = None

    @field_validator("inputs")
    @classmethod
    def _inputs_bounds(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if len(v) > MAX_INPUTS_KEYS:
            raise ValueError(f"inputs 키는 {MAX_INPUTS_KEYS}개를 넘을 수 없습니다.")
        return v


class ScenarioResponse(BaseModel):
    month: str
    inputs: Dict[str, Any]
    updated_at: str
    updated_by: Optional[str] = None


class ContextResponse(BaseModel):
    total: int
    by_grade: Dict[str, int]
    as_of: str


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _source_view(row: FeeCalculatorSource) -> dict:
    return {
        "sheets": row.sheets or [],
        "captured_at": row.captured_at,
        "source_url": row.source_url,
        "updated_at": _iso(row.updated_at),
        "updated_by": row.updated_by,
    }


def _scenario_view(row: FeeCalculatorScenario) -> dict:
    return {
        "month": row.month,
        "inputs": row.inputs or {},
        "updated_at": _iso(row.updated_at),
        "updated_by": row.updated_by,
    }


def _actor_name(user: User) -> Optional[str]:
    return getattr(user, "name", None) or getattr(user, "login_id", None)


# ── /source ──────────────────────────────────────────────────────────────
@router.get("/source", response_model=Optional[SourceResponse])
def get_source(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    """최신 원본 스냅샷 1건. 없으면 `null`."""
    row = db.query(FeeCalculatorSource).filter(FeeCalculatorSource.id == SOURCE_SINGLETON_ID).first()
    if not row:
        return None
    return _source_view(row)


@router.put("/source", response_model=SourceResponse)
def put_source(
    body: SourceBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """원본 스냅샷 저장(upsert) — 고정 id 로 항상 한 행만 유지한다.

    존재하면 SELECT FOR UPDATE 로 잠가 놓고 갱신해 동시 갱신을 직렬화하고,
    존재하지 않아 두 요청이 동시에 처음 만들려고 하면(IntegrityError) 뒤에
    실패한 요청은 롤백 후 409 를 돌려준다.
    """
    payload = body.model_dump()
    _walk_reject_nan(payload)
    if _json_size(payload) > MAX_SOURCE_PAYLOAD_BYTES:
        raise HTTPException(400, "스냅샷 크기가 너무 큽니다(최대 8MB).")

    _parse_dt(body.captured_at, "captured_at")  # 형식 검증만, 저장은 원문 문자열로

    row = (
        db.query(FeeCalculatorSource)
        .filter(FeeCalculatorSource.id == SOURCE_SINGLETON_ID)
        .with_for_update()
        .first()
    )
    if row is None:
        row = FeeCalculatorSource(id=SOURCE_SINGLETON_ID, sheets=[], captured_at=body.captured_at)
        db.add(row)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "동시에 다른 요청이 먼저 스냅샷을 생성했습니다. 다시 시도해주세요.")

    row.sheets = [s.model_dump() for s in body.sheets]
    row.captured_at = body.captured_at
    row.source_url = body.source_url
    row.updated_by = _actor_name(current_user)
    db.commit()
    db.refresh(row)
    return _source_view(row)


# ── /scenarios ───────────────────────────────────────────────────────────
@router.get("/scenarios", response_model=List[ScenarioResponse])
def list_scenarios(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    rows = db.query(FeeCalculatorScenario).order_by(FeeCalculatorScenario.month.asc()).all()
    return [_scenario_view(r) for r in rows]


@router.put("/scenarios/{month}", response_model=ScenarioResponse)
def upsert_scenario(
    month: str,
    body: ScenarioBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """월별 시나리오 upsert.

    검증 순서:
    1. 경로의 month 형식
    2. NaN/Infinity, 페이로드 크기(구조적 상한)
    3. `validate_fee_inputs()` — FeeInputs 전체 구조(타입·범위·연도 2026·자릿수 등),
       `inputs.month` 가 경로의 month 와 같은지까지 확인한다.
    4. 낙관적 잠금(expected_updated_at) → 불일치 시 409
    5. 신규 생성 경쟁(IntegrityError) → 409
    """
    if not _MONTH_RE.match(month):
        raise HTTPException(400, "month 는 'YYYY-MM' 형식이어야 합니다.")

    _walk_reject_nan(body.inputs)
    if _json_size(body.inputs) > MAX_SCENARIO_PAYLOAD_BYTES:
        raise HTTPException(400, "시나리오 입력값 크기가 너무 큽니다(최대 512KB).")

    errors = validate_fee_inputs(body.inputs, path_month=month)
    if errors:
        raise HTTPException(
            422,
            detail={"message": "시나리오 입력값이 올바르지 않습니다.", "errors": errors},
        )

    row = (
        db.query(FeeCalculatorScenario)
        .filter(FeeCalculatorScenario.month == month)
        .with_for_update()
        .first()
    )

    if row is None:
        # 새로 만드는 경우 — expected_updated_at 이 채워져 있으면 이미 있는 줄 알고 온 것이므로 충돌
        if (body.expected_updated_at or "").strip():
            raise HTTPException(
                409,
                detail={
                    "message": "이미 존재하지 않는 시나리오에 대해 기존 수정 시각이 지정되었습니다.",
                    "existing": None,
                },
            )
        row = FeeCalculatorScenario(month=month, inputs={})
        db.add(row)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                409,
                detail={
                    "message": "동시에 다른 요청이 먼저 이 달의 시나리오를 생성했습니다. 다시 시도해주세요.",
                    "existing": None,
                },
            )
    else:
        current_iso = _iso(row.updated_at)
        expected = (body.expected_updated_at or "").strip() or None
        if expected != current_iso:
            raise HTTPException(
                409,
                detail={
                    "message": "다른 곳에서 먼저 저장되어 최신 상태가 아닙니다. 새로고침 후 다시 시도해주세요.",
                    "existing": _scenario_view(row),
                },
            )

    row.inputs = body.inputs
    row.updated_by = _actor_name(current_user)
    db.commit()
    db.refresh(row)
    return _scenario_view(row)


# ── /context (선택) ────────────────────────────────────────────────────────
@router.get("/context", response_model=ContextResponse)
def get_context(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    """수가 계산에 참고할 현재 재원 어르신의 '등급별 인원수'만 집계한다.
    이름 등 개인 식별 정보는 절대 포함하지 않는다."""
    rows = (
        db.query(CareforResident.care_grade, func.count(CareforResident.id))
        .filter(CareforResident.status == "active")
        .group_by(CareforResident.care_grade)
        .all()
    )
    by_grade: Dict[str, int] = {}
    total = 0
    for grade, cnt in rows:
        key = (grade or "미상").strip() or "미상"
        by_grade[key] = by_grade.get(key, 0) + int(cnt)
        total += int(cnt)
    return {"total": total, "by_grade": by_grade, "as_of": datetime.now().isoformat()}
