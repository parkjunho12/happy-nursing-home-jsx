"""
케어포 데이터 연동 API
흐름: 파서 → PII 마스킹 → OpenAI 정규화 → fallback → DB 저장
"""
import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.carefor import CareforResident, CareforLeaveRecord, StaffWorkSchedule
from app.schemas.response import ApiResponse
from app.services.carefor_import.parser import parse_file, parse_leave_file, parse_5row_file
from app.services.carefor_import.schedule_parser import parse_schedule
from app.services.carefor_import.normalizer import normalize_resident, normalize_leave
from app.services.carefor_import.importer import upsert_residents, upsert_leave_records

router = APIRouter()
logger = logging.getLogger(__name__)
MAX_FILE = 5 * 1024 * 1024


def _is_social_worker(user: User) -> bool:
    pos = getattr(user, 'position', None)
    role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    return role == "ADMIN" or pos == "사회복지사"


def _require_editor(current_user: User = Depends(get_current_user)) -> User:
    """참고자료(수급자·외출외박·근무표) 수정·삭제 — ADMIN · 사회복지사 · 시설장"""
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    pos = getattr(current_user, 'position', None)
    pos = pos.value if hasattr(pos, 'value') else str(pos or '')
    if role != "ADMIN" and pos not in ("사회복지사", "시설장"):
        raise HTTPException(403, "참고자료 수정 권한이 없습니다. (관리자·사회복지사·시설장)")
    return current_user


def _month_prefix(year: Optional[int], month: Optional[int]) -> Optional[str]:
    if year and month:
        return f"{year}-{month:02d}-"
    return None


class ResidentBody(BaseModel):
    name: Optional[str] = None
    birth_date: Optional[str] = None
    care_grade: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    room_name: Optional[str] = None
    status: Optional[str] = None
    resident_code: Optional[str] = None


class LeaveBody(BaseModel):
    resident_name: Optional[str] = None
    leave_type: Optional[str] = None
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    reason: Optional[str] = None
    guardian_name: Optional[str] = None


class ScheduleBody(BaseModel):
    staff_name: Optional[str] = None
    position: Optional[str] = None
    team: Optional[str] = None
    work_date: Optional[str] = None
    shift_code: Optional[str] = None
    shift_label: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_working: Optional[bool] = None


def _apply_body(obj, body: BaseModel):
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(obj, k, (v.strip() or None) if isinstance(v, str) else v)


def _mask_row(row: dict) -> dict:
    """행 데이터 PII 마스킹 (OpenAI 전송 전)"""
    masked = {}
    for k, v in row.items():
        if v is None:
            masked[k] = v
            continue
        s = str(v)
        s = re.sub(r'\d{6}[-–]\d{7}', '[주민번호]', s)
        s = re.sub(r'0\d{1,2}[-–.]?\d{3,4}[-–.]?\d{4}', '[전화번호]', s)
        masked[k] = s
    return masked


def _try_openai_residents(masked_rows: list) -> tuple[list, list, bool]:
    """
    OpenAI로 수급자 정규화 시도
    반환: (normalized_rows, warnings, openai_used)
    """
    try:
        from app.services.carefor_import.openai_normalizer import normalize_residents_with_openai
        result = normalize_residents_with_openai(masked_rows)
        if result.get("openai_failed"):
            return [], result.get("warnings", []), False
        return result.get("rows", []), result.get("warnings", []), True
    except Exception as e:
        logger.warning(f"OpenAI 수급자 정규화 실패 → rule-based fallback: {e}")
        return [], [str(e)], False


def _try_openai_leaves(masked_rows: list) -> tuple[list, list, bool]:
    """OpenAI로 외박/외출 정규화 시도"""
    try:
        from app.services.carefor_import.openai_normalizer import normalize_leave_records_with_openai
        result = normalize_leave_records_with_openai(masked_rows)
        if result.get("openai_failed"):
            return [], result.get("warnings", []), False
        return result.get("rows", []), result.get("warnings", []), True
    except Exception as e:
        logger.warning(f"OpenAI 외박/외출 정규화 실패 → rule-based fallback: {e}")
        return [], [str(e)], False


# ── 수급자 업로드 (ADMIN만) ──────────────────────────────────────────────────
@router.post("/residents/upload")
async def upload_residents(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    content  = await file.read()
    filename = file.filename or "unknown"
    if len(content) > MAX_FILE:
        raise HTTPException(400, "5MB 이하 파일만 허용합니다")

    # 1. 파싱 — 수급자 목록도 5행 헤더, 6행부터 데이터 (OpenAI 없이 결정적 파싱)
    try:
        rows = parse_5row_file(content, filename)
    except Exception as e:
        raise HTTPException(400, f"파일 파싱 실패: {e}")

    if not rows:
        raise HTTPException(400, "데이터가 없거나 5행 헤더를 찾지 못했습니다")

    # 2. 헤더명 기준 매핑 (등급외 포함, 합계/공백행은 파서에서 제외)
    records = []
    warnings: list = []
    for i, row in enumerate(rows):
        try:
            norm = normalize_resident(row)
            if norm:   # 이름 있는 행만 (등급 무관하게 포함)
                records.append(norm)
        except Exception as e:
            warnings.append(f"행 {i + 1}: {str(e)[:80]}")

    # 3. DB 저장
    result = upsert_residents(db, records)
    result["warnings"]     = warnings + result.get("errors", [])
    result["openai_used"]  = False
    result["normalizer"]   = "rule-based(5행 헤더)"

    return ApiResponse(success=True, data=result)


# ── 수급자 목록 ──────────────────────────────────────────────────────────────
@router.get("/residents")
def list_residents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(CareforResident).order_by(CareforResident.name).all()
    return ApiResponse(success=True, data=[{
        "id":             r.id,
        "name":           r.name,
        "birth_date":     r.birth_date,
        "care_grade":     r.care_grade,
        "admission_date": r.admission_date,
        "discharge_date": r.discharge_date,
        "room_name":      r.room_name,
        "status":         r.status,
        "resident_code":  r.resident_code,
    } for r in rows])


@router.delete("/residents")
def delete_residents(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    db.query(CareforResident).delete()
    db.commit()
    return ApiResponse(success=True, data=None)


# ── 외출·외박 업로드 (ADMIN + 사회복지사) ────────────────────────────────────
@router.post("/leave-records/upload")
async def upload_leave_records(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_social_worker(current_user):
        raise HTTPException(403, "관리자 또는 사회복지사만 업로드 가능합니다")

    content  = await file.read()
    filename = file.filename or "unknown"
    if len(content) > MAX_FILE:
        raise HTTPException(400, "5MB 이하 파일만 허용합니다")

    # 1. 파싱 — 외박/외출 엑셀은 5행 헤더, 6행부터 데이터 (OpenAI 없이 결정적 파싱)
    try:
        rows = parse_leave_file(content, filename)
    except Exception as e:
        raise HTTPException(400, f"파일 파싱 실패: {e}")

    if not rows:
        raise HTTPException(400, "데이터가 없거나 5행 헤더를 찾지 못했습니다")

    # 2. 헤더명 기준 컬럼 매핑 (rule-based, 합계행 '* 전체'는 파서에서 제외됨)
    records = []
    warnings: list = []
    for i, row in enumerate(rows):
        try:
            norm = normalize_leave(row)
            if norm and (norm.get("start_date") or norm.get("end_date")):   # 날짜 전무한 잔여행만 제외
                records.append(norm)
        except Exception as e:
            warnings.append(f"행 {i + 1}: {str(e)[:80]}")

    # 3. DB 저장
    result = upsert_leave_records(db, records)
    result["warnings"]    = warnings + result.get("errors", [])
    result["openai_used"] = False
    result["normalizer"]  = "rule-based(5행 헤더)"

    return ApiResponse(success=True, data=result)


# ── 외출·외박 목록 ────────────────────────────────────────────────────────────
@router.get("/leave-records")
def list_leave_records(
    year:          Optional[int] = Query(None),
    month:         Optional[int] = Query(None),
    resident_name: Optional[str] = Query(None),
    start_date:    Optional[str] = Query(None),
    end_date:      Optional[str] = Query(None),
    current_user:  User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(CareforLeaveRecord)
    prefix = _month_prefix(year, month)
    if prefix:
        q = q.filter(CareforLeaveRecord.start_date.like(f"{prefix}%"))
    if resident_name:
        q = q.filter(CareforLeaveRecord.resident_name.contains(resident_name))
    if start_date:
        q = q.filter(CareforLeaveRecord.start_date >= start_date)
    if end_date:
        q = q.filter(CareforLeaveRecord.start_date <= end_date)

    rows = q.order_by(CareforLeaveRecord.start_date.desc()).limit(300).all()
    return ApiResponse(success=True, data=[{
        "id":            r.id,
        "resident_name": r.resident_name,
        "leave_type":    r.leave_type,
        "start_date":    r.start_date,
        "start_time":    r.start_time,
        "end_date":      r.end_date,
        "end_time":      r.end_time,
        "reason":        r.reason,
        "guardian_name": r.guardian_name,
    } for r in rows])


@router.delete("/leave-records")
def delete_leave_records(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    db.query(CareforLeaveRecord).delete()
    db.commit()
    return ApiResponse(success=True, data=None)


# ════════════════════════════════════════════════════════════════════════
# 근무표 API
# ════════════════════════════════════════════════════════════════════════

ALLOWED_SCHEDULE_FIELDS = {
    "staff_name", "user_id", "position", "team",
    "work_date", "shift_code", "shift_label",
    "start_time", "end_time", "is_working", "raw_data",
}


def _match_user_id(staff_name: str, db) -> tuple:
    """DB users 테이블에서 staff_name으로 user_id 매칭"""
    from sqlalchemy import text
    rows = db.execute(text("SELECT id, name FROM users")).fetchall()
    candidates = []
    clean = staff_name.replace(" ", "")
    for row in rows:
        uid, uname = row[0], row[1]
        if uname == staff_name:
            return uid, None   # 완전 일치
        if uname.replace(" ", "") == clean:
            candidates.append((uid, uname))
        elif staff_name in uname or uname in staff_name:
            candidates.append((uid, uname))
    if len(candidates) == 1:
        return candidates[0][0], None
    if len(candidates) > 1:
        return None, f"'{staff_name}' 직원이 여러 명 매칭됨: {[c[1] for c in candidates]}"
    return None, None


@router.post("/work-schedules/upload")
async def upload_work_schedules(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    import uuid

    # year/month — 쿼리 파라미터 또는 Form 필드 둘 다 허용
    qp = request.query_params
    year_raw  = qp.get("year")
    month_raw = qp.get("month")

    # Form에서도 읽기 (multipart/form-data)
    if not year_raw or not month_raw:
        try:
            form_data  = await request.form()
            year_raw  = year_raw  or form_data.get("year")
            month_raw = month_raw or form_data.get("month")
        except Exception:
            pass

    try:
        year  = int(year_raw)  if year_raw  else None
        month = int(month_raw) if month_raw else None
    except (TypeError, ValueError):
        year = month = None

    content  = await file.read()
    filename = file.filename or "unknown"
    if len(content) > MAX_FILE:
        raise HTTPException(400, "5MB 이하 파일만 허용합니다")

    if not year or not month:
        raise HTTPException(400, "year(연도)와 month(월)를 입력하세요. 예: ?year=2026&month=6")

    # ── STEP 1. Rule-based parser 우선 ────────────────────────────────────
    result_raw = parse_schedule(content, filename, year, month)
    rows       = result_raw.get("rows", [])
    warnings   = result_raw.get("warnings", [])
    openai_used = False

    # ── STEP 2. 파싱 결과가 없거나 OpenAI 필요 시 fallback ────────────────
    if not rows or result_raw.get("needs_openai"):
        logger.info("Rule-based 파싱 실패 → OpenAI fallback 시도")
        warnings.append("Rule-based 파서 실패 → OpenAI로 재시도합니다.")
        try:
            from app.services.carefor_import.openai_schedule_normalizer import normalize_work_schedule_with_openai
            from app.services.carefor_import.parser import parse_file as parse_generic
            raw_generic = parse_generic(content, filename)
            masked      = [_mask_row(r) for r in raw_generic]
            oa_result   = normalize_work_schedule_with_openai(masked, year, month)
            if oa_result.get("rows"):
                rows        = oa_result["rows"]
                warnings   += oa_result.get("warnings", [])
                openai_used = oa_result.get("openai_used", True)
        except Exception as e:
            warnings.append(f"OpenAI fallback 실패: {str(e)[:80]}")

    if not rows:
        raise HTTPException(400, f"파싱 결과가 없습니다. {'; '.join(warnings)}")

    imported = updated = skipped = 0
    errors: list = []

    for row in rows:
        try:
            staff_name = (row.get("staff_name") or "").strip()
            work_date  = (row.get("work_date") or "").strip()
            if not staff_name or not work_date:
                skipped += 1
                continue

            # 화이트리스트 필터
            safe = {k: v for k, v in row.items() if k in ALLOWED_SCHEDULE_FIELDS}

            # user_id 매칭
            uid, warn = _match_user_id(staff_name, db)
            safe["user_id"] = uid
            if warn:
                warnings.append(warn)

            # upsert: staff_name + work_date 기준
            existing = db.query(StaffWorkSchedule).filter(
                StaffWorkSchedule.staff_name == staff_name,
                StaffWorkSchedule.work_date  == work_date,
            ).first()

            if existing:
                for k, v in safe.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                safe["id"] = str(uuid.uuid4())
                db.add(StaffWorkSchedule(**safe))
                imported += 1

        except Exception as e:
            errors.append(str(e)[:80])
            skipped += 1

    db.commit()
    return ApiResponse(success=True, data={
        "imported":    imported,
        "updated":     updated,
        "skipped":     skipped,
        "warnings":    warnings,
        "errors":      errors,
        "openai_used": openai_used,
        "normalizer":  "openai" if openai_used else "rule-based",
    })


@router.get("/work-schedules")
def list_work_schedules(
    year:       Optional[int] = Query(None),
    month:      Optional[int] = Query(None),
    staff_name: Optional[str] = Query(None),
    user_id:    Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(StaffWorkSchedule)
    if year and month:
        # 자동 연동 — 근무표 페이지 저장본이 더 새로우면 조용히 복사해온다
        try:
            auto_sync_schedules(db, f"{year}-{month:02d}")
        except Exception:
            db.rollback()
        prefix = f"{year}-{month:02d}-"
        q = q.filter(StaffWorkSchedule.work_date.like(f"{prefix}%"))
    if staff_name:
        q = q.filter(StaffWorkSchedule.staff_name.contains(staff_name))
    if user_id:
        q = q.filter(StaffWorkSchedule.user_id == user_id)

    rows = q.order_by(StaffWorkSchedule.work_date, StaffWorkSchedule.staff_name).limit(500).all()
    return ApiResponse(success=True, data=[{
        "id":          r.id,
        "staff_name":  r.staff_name,
        "user_id":     r.user_id,
        "work_date":   r.work_date,
        "shift_code":  r.shift_code,
        "shift_label": r.shift_label,
        "start_time":  r.start_time,
        "end_time":    r.end_time,
        "is_working":  r.is_working,
    } for r in rows])


@router.delete("/work-schedules")
def delete_work_schedules(
    year:  Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(StaffWorkSchedule)
    if year and month:
        # 자동 연동 — 근무표 페이지 저장본이 더 새로우면 조용히 복사해온다
        try:
            auto_sync_schedules(db, f"{year}-{month:02d}")
        except Exception:
            db.rollback()
        prefix = f"{year}-{month:02d}-"
        q = q.filter(StaffWorkSchedule.work_date.like(f"{prefix}%"))
    q.delete(synchronize_session=False)
    db.commit()
    return ApiResponse(success=True, data=None)


# ════════════════════════════════════════════════════════════════════════
# 참고자료 개별 CRUD (월별 관리 · 수정 · 삭제)
# 권한: ADMIN · 사회복지사 · 시설장
# ════════════════════════════════════════════════════════════════════════

# ── 수급자 ──────────────────────────────────────────────────────────────
@router.post("/residents", status_code=201)
def create_resident(body: ResidentBody, db: Session = Depends(get_db),
                    _: User = Depends(_require_editor)):
    if not (body.name or "").strip():
        raise HTTPException(400, "성함을 입력해주세요.")
    r = CareforResident(name=body.name.strip(), status=body.status or "active")
    _apply_body(r, body)
    db.add(r); db.commit(); db.refresh(r)
    return ApiResponse(success=True, data={"id": r.id})


@router.patch("/residents/{rid}")
def update_resident(rid: str, body: ResidentBody, db: Session = Depends(get_db),
                    _: User = Depends(_require_editor)):
    r = db.query(CareforResident).filter(CareforResident.id == rid).first()
    if not r:
        raise HTTPException(404, "수급자를 찾을 수 없습니다.")
    _apply_body(r, body)
    db.commit(); db.refresh(r)
    return ApiResponse(success=True, data={"id": r.id})


@router.delete("/residents/{rid}")
def delete_resident_one(rid: str, db: Session = Depends(get_db),
                        _: User = Depends(_require_editor)):
    r = db.query(CareforResident).filter(CareforResident.id == rid).first()
    if not r:
        raise HTTPException(404, "수급자를 찾을 수 없습니다.")
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


# ── 외출·외박 ───────────────────────────────────────────────────────────
@router.post("/leave-records", status_code=201)
def create_leave(body: LeaveBody, db: Session = Depends(get_db),
                 _: User = Depends(_require_editor)):
    if not (body.resident_name or "").strip():
        raise HTTPException(400, "수급자 성함을 입력해주세요.")
    l = CareforLeaveRecord(resident_name=body.resident_name.strip())
    _apply_body(l, body)
    db.add(l); db.commit(); db.refresh(l)
    return ApiResponse(success=True, data={"id": l.id})


@router.patch("/leave-records/{lid}")
def update_leave(lid: str, body: LeaveBody, db: Session = Depends(get_db),
                 _: User = Depends(_require_editor)):
    l = db.query(CareforLeaveRecord).filter(CareforLeaveRecord.id == lid).first()
    if not l:
        raise HTTPException(404, "외출·외박 기록을 찾을 수 없습니다.")
    _apply_body(l, body)
    db.commit(); db.refresh(l)
    return ApiResponse(success=True, data={"id": l.id})


@router.delete("/leave-records/{lid}")
def delete_leave_one(lid: str, db: Session = Depends(get_db),
                     _: User = Depends(_require_editor)):
    l = db.query(CareforLeaveRecord).filter(CareforLeaveRecord.id == lid).first()
    if not l:
        raise HTTPException(404, "외출·외박 기록을 찾을 수 없습니다.")
    db.delete(l); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@router.delete("/leave-records/month/{year}/{month}")
def delete_leaves_month(year: int, month: int, db: Session = Depends(get_db),
                        _: User = Depends(_require_editor)):
    prefix = f"{year}-{month:02d}-"
    n = db.query(CareforLeaveRecord).filter(
        CareforLeaveRecord.start_date.like(f"{prefix}%")
    ).delete(synchronize_session=False)
    db.commit()
    return ApiResponse(success=True, message=f"{year}년 {month}월 {n}건 삭제")


# ── 근무표 ──────────────────────────────────────────────────────────────
@router.post("/work-schedules", status_code=201)
def create_schedule(body: ScheduleBody, db: Session = Depends(get_db),
                    _: User = Depends(_require_editor)):
    if not (body.staff_name or "").strip() or not (body.work_date or "").strip():
        raise HTTPException(400, "직원명과 근무일자를 입력해주세요.")
    sc = StaffWorkSchedule(staff_name=body.staff_name.strip(), work_date=body.work_date.strip())
    _apply_body(sc, body)
    if body.is_working is None:
        sc.is_working = (body.shift_code or "").strip() not in ("휴", "휴무", "OFF", "off")
    db.add(sc); db.commit(); db.refresh(sc)
    return ApiResponse(success=True, data={"id": sc.id})


@router.patch("/work-schedules/{sid}")
def update_schedule(sid: str, body: ScheduleBody, db: Session = Depends(get_db),
                    _: User = Depends(_require_editor)):
    sc = db.query(StaffWorkSchedule).filter(StaffWorkSchedule.id == sid).first()
    if not sc:
        raise HTTPException(404, "근무표를 찾을 수 없습니다.")
    _apply_body(sc, body)
    if body.shift_code is not None and body.is_working is None:
        sc.is_working = (body.shift_code or "").strip() not in ("휴", "휴무", "OFF", "off")
    db.commit(); db.refresh(sc)
    return ApiResponse(success=True, data={"id": sc.id})


@router.delete("/work-schedules/{sid}")
def delete_schedule_one(sid: str, db: Session = Depends(get_db),
                        _: User = Depends(_require_editor)):
    sc = db.query(StaffWorkSchedule).filter(StaffWorkSchedule.id == sid).first()
    if not sc:
        raise HTTPException(404, "근무표를 찾을 수 없습니다.")
    db.delete(sc); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


# ── 근무표 페이지(WorkSchedule) → 검수용 근무표 동기화 ──────────────────
# 코드별 시간·성격 — 근무표 페이지(shiftCodes.ts)와 동일 기준
_SHIFT_INFO = {
    "D":  ("주간", "08:50", "18:00", True),
    "M":  ("모닝", "06:50", "16:00", True),
    "N":  ("야간", "18:00", "09:00", True),
    "AD": ("오전", "09:00", "13:00", True),
    "PD": ("오후", "13:00", "18:00", True),
    "休": ("연차", None, None, False),
    "대휴": ("대체휴무", None, None, False),
    "초과휴": ("초과근무휴가", None, None, False),
    "◆": ("경조사", None, None, False),
    "◆병": ("병가", None, None, False),
}
_TIME_RANGE = re.compile(r"^(\d{2})(\d{2})~(\d{2})(\d{2})$")   # 0850~1600 같은 단축 근무


def auto_sync_schedules(db, month: str, force: bool = False):
    """근무표 페이지 저장본 → 검수용 근무표 자동 복사.

    저장본(WorkSchedule)이 검수용보다 새로울 때만 다시 복사한다 —
    버튼을 누르지 않아도 항상 최신이 유지되는 이유. 저장본이 없으면 None."""
    from app.models.work_schedule import WorkSchedule
    from app.models.eval import LtcStaffMember
    from sqlalchemy import func as _f
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == month).first()
    if not w or not (w.data or {}):
        return None
    if not force:
        latest = db.query(_f.max(StaffWorkSchedule.updated_at)).filter(
            StaffWorkSchedule.work_date.like(f"{month}-%")).scalar()
        if latest and w.updated_at and latest >= w.updated_at:
            return {"month": month, "skipped": True}      # 이미 최신

    staff_by_id = {st.id: st for st in db.query(LtcStaffMember).all()}
    if True:
        db.query(StaffWorkSchedule).filter(
            StaffWorkSchedule.work_date.like(f"{month}-%")).delete(synchronize_session=False)

    imported, unknown_staff = 0, []
    for sid, row in (w.data or {}).items():
        st = staff_by_id.get(sid)
        if not st:
            unknown_staff.append(sid)
            continue
        uid, _warn = _match_user_id(st.name, db)
        for day, code in (row or {}).items():
            c = (code or "").strip()
            if not c:
                continue
            label, start, end, working = _SHIFT_INFO.get(c, (None, None, None, None))
            if label is None:
                m2 = _TIME_RANGE.match(c)
                if m2:      # 0850~1600 — 초과근무 상환 단축 근무
                    label, start, end, working = ("주간(단축)",
                        f"{m2.group(1)}:{m2.group(2)}", f"{m2.group(3)}:{m2.group(4)}", True)
                else:       # 모르는 코드는 그대로 기록 (근무로 취급)
                    label, start, end, working = (c, None, None, True)
            db.add(StaffWorkSchedule(
                staff_name=st.name, user_id=uid, position=st.position,
                team=getattr(st, "team", None),
                work_date=f"{month}-{int(day):02d}",
                shift_code=c, shift_label=label,
                start_time=start, end_time=end, is_working=working,
            ))
            imported += 1
    db.commit()
    return {"month": month, "imported": imported,
            "staff_count": len((w.data or {})) - len(unknown_staff),
            "unknown_staff": len(unknown_staff)}


@router.post("/work-schedules/sync-from-admin")
def sync_schedules_from_admin(
    month: str = Query(..., description="YYYY-MM"),
    replace: bool = Query(True, description="(호환용 — 항상 대체)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_editor),
):
    """수동 가져오기 — 자동 연동이 기본이지만 강제로 다시 복사할 때 사용."""
    if not re.match(r"^\d{4}-\d{2}$", month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    r = auto_sync_schedules(db, month, force=True)
    if r is None:
        raise HTTPException(404, f"{month} 근무표가 아직 저장되지 않았습니다. 근무표 페이지에서 먼저 저장해주세요.")
    return ApiResponse(success=True, data=r)


# ── 수급자 관리(LtcResident) → 검수용 수급자 정보 동기화 ─────────────────
@router.post("/residents/sync-from-admin")
def sync_residents_from_admin(
    replace: bool = Query(True, description="기존 검수용 수급자 정보를 대체할지"),
    db: Session = Depends(get_db),
    _: User = Depends(_require_editor),
):
    """
    엑셀 업로드 없이 Admin '수급자 관리'(ltc_residents)의 데이터를 그대로 가져온다.
    인정서 등급은 어르신 서류현황(resident_doc_status.grade)에서 보완한다.
    """
    from app.models.eval import LtcResident
    try:
        from app.models.resident_docs import ResidentDocStatus
        doc_rows = db.query(ResidentDocStatus).all()
        grade_by_rid = {d.resident_id: (d.grade or None) for d in doc_rows if d.resident_id}
    except Exception:
        grade_by_rid = {}

    residents = db.query(LtcResident).all()
    if not residents:
        raise HTTPException(400, "수급자 관리에 등록된 수급자가 없습니다.")

    if replace:
        db.query(CareforResident).delete(synchronize_session=False)
        db.flush()

    existing = {r.name: r for r in db.query(CareforResident).all()} if not replace else {}

    imported, updated = 0, 0
    for r in residents:
        grade = grade_by_rid.get(r.id)
        # "3/시설" 형태 → "3등급" 로 정리
        if grade:
            first = str(grade).split('\n')[0].strip()
            if '/' in first:
                lv = first.split('/')[0].strip()
                grade = f"{lv}등급" if lv.isdigit() else first
            else:
                grade = first

        row = existing.get(r.name)
        if row:
            row.birth_date     = r.birth_date or row.birth_date
            row.care_grade     = grade or row.care_grade
            row.admission_date = r.admission_date or row.admission_date
            row.discharge_date = r.discharge_date
            row.status         = r.status or "active"
            updated += 1
        else:
            db.add(CareforResident(
                name=r.name,
                birth_date=r.birth_date,
                gender=r.gender,
                care_grade=grade,
                admission_date=r.admission_date,
                discharge_date=r.discharge_date,
                status=r.status or "active",
            ))
            imported += 1

    db.commit()
    return ApiResponse(success=True, data={
        "imported": imported, "updated": updated, "total": imported + updated,
    }, message=f"수급자 관리에서 {imported + updated}명을 가져왔습니다.")
