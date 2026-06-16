"""
DB upsert 로직
- CareforResident: resident_code 기준 upsert, 없으면 name+birth_date
- CareforLeaveRecord: name+start_date+start_time+leave_type 기준 중복 방지
"""
import uuid
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.carefor import CareforResident, CareforLeaveRecord


ImportResult = Dict[str, Any]  # {imported, updated, skipped, errors}


def upsert_residents(db: Session, records: List[Dict[str, Any]]) -> ImportResult:
    imported = updated = skipped = 0
    errors: List[str] = []

    for idx, rec in enumerate(records):
        try:
            existing = None

            # 1. resident_code 기준 조회
            if rec.get("resident_code"):
                existing = db.query(CareforResident).filter(
                    CareforResident.resident_code == rec["resident_code"]
                ).first()

            # 2. name + birth_date 기준 조회
            if not existing and rec.get("name"):
                q = db.query(CareforResident).filter(
                    CareforResident.name == rec["name"]
                )
                if rec.get("birth_date"):
                    q = q.filter(CareforResident.birth_date == rec["birth_date"])
                existing = q.first()

            if existing:
                # 업데이트
                for k, v in rec.items():
                    if k != "raw_data" and v is not None:
                        setattr(existing, k, v)
                if rec.get("raw_data"):
                    existing.raw_data = rec["raw_data"]
                updated += 1
            else:
                # 신규 삽입
                obj = CareforResident(id=str(uuid.uuid4()), **rec)
                db.add(obj)
                imported += 1

        except Exception as e:
            errors.append(f"행 {idx+1}: {str(e)[:100]}")
            skipped += 1

    db.commit()
    return {"imported": imported, "updated": updated, "skipped": skipped, "errors": errors}


def upsert_leave_records(db: Session, records: List[Dict[str, Any]]) -> ImportResult:
    imported = updated = skipped = 0
    errors: List[str] = []

    for idx, rec in enumerate(records):
        try:
            name       = rec.get("resident_name", "")
            start_date = rec.get("start_date", "")
            start_time = rec.get("start_time") or ""
            leave_type = rec.get("leave_type", "")

            if not name or not start_date:
                skipped += 1
                continue

            # 중복 체크
            existing = db.query(CareforLeaveRecord).filter(
                CareforLeaveRecord.resident_name == name,
                CareforLeaveRecord.start_date    == start_date,
                CareforLeaveRecord.leave_type    == leave_type,
            ).first()

            if existing:
                for k, v in rec.items():
                    if v is not None:
                        setattr(existing, k, v)
                updated += 1
            else:
                # resident_id 연결 시도
                resident = db.query(CareforResident).filter(
                    CareforResident.name == name
                ).first()
                rec["resident_id"] = resident.id if resident else None
                obj = CareforLeaveRecord(id=str(uuid.uuid4()), **rec)
                db.add(obj)
                imported += 1

        except Exception as e:
            errors.append(f"행 {idx+1}: {str(e)[:100]}")
            skipped += 1

    db.commit()
    return {"imported": imported, "updated": updated, "skipped": skipped, "errors": errors}
