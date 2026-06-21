"""
케어포 데이터 연동 API
흐름: 파서 → PII 마스킹 → OpenAI 정규화 → fallback → DB 저장
"""
import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
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
    resident_name: Optional[str] = Query(None),
    start_date:    Optional[str] = Query(None),
    end_date:      Optional[str] = Query(None),
    current_user:  User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(CareforLeaveRecord)
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
        prefix = f"{year}-{month:02d}-"
        q = q.filter(StaffWorkSchedule.work_date.like(f"{prefix}%"))
    q.delete(synchronize_session=False)
    db.commit()
    return ApiResponse(success=True, data=None)
