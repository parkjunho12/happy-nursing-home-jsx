import json
from datetime import datetime
from typing import Optional, List, Any, Literal
from pydantic import BaseModel, ConfigDict, field_validator

# ══════════════════════════════════════════════════════════════════════════════
# CompletionRecord (기존 — 하위 호환 유지)
# ══════════════════════════════════════════════════════════════════════════════

class CompletionRecordOut(BaseModel):
    period_key:      str
    completed_date:  str
    memo:            str = ""
    attachment_name: str = ""
    model_config = ConfigDict(from_attributes=True)


# ══════════════════════════════════════════════════════════════════════════════
# ChecklistOccurrence (신규)
# ══════════════════════════════════════════════════════════════════════════════

OccurrenceStatus = Literal["pending", "completed", "overdue"]


class OccurrenceOut(BaseModel):
    """ChecklistOccurrence 응답 스키마"""
    id:                str
    checklist_item_id: str
    period_key:        str
    frequency:         str
    scheduled_date:    str
    due_date:          str
    status:            str                  # pending | completed | overdue
    completed_date:    Optional[str] = None
    memo:              str = ""
    attachment_name:   str = ""
    created_at:        datetime
    updated_at:        datetime
    model_config = ConfigDict(from_attributes=True)


class OccurrenceComplete(BaseModel):
    """완료 처리 요청"""
    completed_date:  str
    memo:            str = ""
    attachment_name: str = ""


class OccurrenceSyncResult(BaseModel):
    """sync 엔드포인트 응답"""
    created: int
    overdue: int


# ══════════════════════════════════════════════════════════════════════════════
# ChecklistItem (기존 + occurrences 필드 추가)
# ══════════════════════════════════════════════════════════════════════════════

class ChecklistItemOut(BaseModel):
    id:                   str
    title:                str
    description:          str
    frequency:            str
    related_indicator_id: Optional[str] = None
    related_category_id:  Optional[str] = None
    related_domain_id:    Optional[str] = None
    assignee:             str
    evidence_required:    str
    storage_location:     str
    how_to:               str
    eval_note:            str
    risk_level:           str
    active:               bool
    memo:                 str
    attachment_name:      str
    # 기존 호환 필드 — 이벤트성은 여기서, 반복 주기는 completion_history/occurrences 사용
    completed:            bool
    completed_date:       Optional[str] = None
    last_checked_date:    Optional[str] = None
    person_id:            Optional[str] = None
    person_name:          Optional[str] = None
    person_type:          Optional[str] = None
    template_id:          Optional[str] = None
    due_date:             Optional[str] = None   # one_time 기한
    recur_weekday:        Optional[int] = None
    recur_week_of_month:  Optional[int] = None
    recur_day:            Optional[int] = None
    recur_due_day:        Optional[int] = None
    created_at:           datetime
    # 완료 이력 (기존 CompletionRecord 기반 — 하위 호환)
    completion_history:   List[CompletionRecordOut] = []
    # occurrence 이력 (신규 — 없으면 빈 리스트, 있으면 우선 사용)
    occurrences:          List[OccurrenceOut] = []
    model_config = ConfigDict(from_attributes=True)


class ChecklistItemCreate(BaseModel):
    title:                str
    description:          str = ""
    frequency:            str
    related_indicator_id: str = ""
    related_category_id:  str = ""
    related_domain_id:    str = ""
    assignee:             str = ""
    evidence_required:    str = ""
    storage_location:     str = ""
    how_to:               str = ""
    eval_note:            str = ""
    risk_level:           str = "medium"
    memo:                 str = ""
    attachment_name:      str = ""
    person_id:            Optional[str] = None
    person_name:          Optional[str] = None
    person_type:          Optional[str] = "facility"
    template_id:          Optional[str] = None
    due_date:             Optional[str] = None
    assigned_user_id:     Optional[str] = None   # 담당자 계정(조회/소유). 미지정 시 STAFF는 본인 자동 배정
    recur_weekday:        Optional[int] = None
    recur_week_of_month:  Optional[int] = None
    recur_day:            Optional[int] = None
    recur_due_day:        Optional[int] = None


class ChecklistItemUpdate(BaseModel):
    title:                Optional[str] = None
    description:          Optional[str] = None
    frequency:            Optional[str] = None
    related_indicator_id: Optional[str] = None
    related_category_id:  Optional[str] = None
    related_domain_id:    Optional[str] = None
    assignee:             Optional[str] = None
    assigned_user_id:     Optional[str] = None
    recur_weekday:        Optional[int] = None
    recur_week_of_month:  Optional[int] = None
    recur_day:            Optional[int] = None
    recur_due_day:        Optional[int] = None
    evidence_required:    Optional[str] = None
    storage_location:     Optional[str] = None
    how_to:               Optional[str] = None
    eval_note:            Optional[str] = None
    risk_level:           Optional[str] = None
    memo:                 Optional[str] = None
    attachment_name:      Optional[str] = None
    active:               Optional[bool] = None
    completed:            Optional[bool] = None
    completed_date:       Optional[str] = None
    person_id:            Optional[str] = None
    person_name:          Optional[str] = None
    person_type:          Optional[str] = None
    due_date:             Optional[str] = None


class ToggleRequest(BaseModel):
    """toggle API — 서버가 KST 기준으로 period_key와 completed_date를 결정
    completed 를 주면 '설정'(멱등), 없으면 기존처럼 '토글'."""
    memo:            str = ""
    attachment_name: str = ""
    completed:       Optional[bool] = None


# ══════════════════════════════════════════════════════════════════════════════
# 평가 지표
# ══════════════════════════════════════════════════════════════════════════════

class EvalDomainOut(BaseModel):
    id:     str
    name:   str
    color:  str
    active: bool
    model_config = ConfigDict(from_attributes=True)


class EvalCategoryOut(BaseModel):
    id:             str
    domain_id:      str
    name:           str
    question_count: int
    total_score:    int
    active:         bool
    model_config = ConfigDict(from_attributes=True)


class EvalSubIndicatorOut(BaseModel):
    id:            str
    category_id:   str
    name:          str
    score:         int
    criteria:      str
    evidence_list: List[str] = []
    active:        bool

    @field_validator("evidence_list", mode="before")
    @classmethod
    def parse_evidence_list(cls, v: Any) -> List[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return []

    model_config = ConfigDict(from_attributes=True)


# ══════════════════════════════════════════════════════════════════════════════
# 수급자
# ══════════════════════════════════════════════════════════════════════════════

class LtcResidentCreate(BaseModel):
    name:                  str
    birth_date:            str
    gender:                str
    admission_date:        str
    admission_time:        Optional[str] = None
    care_grade_start_date: str
    floor:                 Optional[str] = None
    room:                  Optional[str] = None
    religion:              Optional[str] = None
    group_cognitive:       Optional[str] = None
    group_leisure:         Optional[str] = None
    group_physical:        Optional[str] = None
    tube_feeding:          Optional[bool] = None
    certifications:        Optional[List[dict]] = None   # 입소 시 장기요양인정서(등급·기간·급여) → 서류현황 seed용
    contract_lines:        Optional[List[dict]] = None   # 자동 생성된 계약서 일시
    plan_lines:            Optional[List[dict]] = None   # 자동 생성된 계획서 일시
    eval_lines:            Optional[List[dict]] = None   # 자동 생성된 평가 일시
    memo:                  str = ""
    status:                Optional[str] = None   # active | pending(입소 예정)
    allow_over_capacity:   Optional[bool] = None  # 정원이 찬 방에도 배정(화면에서 확인받음)


class LtcResidentUpdate(BaseModel):
    name:                  Optional[str] = None
    birth_date:            Optional[str] = None
    gender:                Optional[str] = None
    admission_date:        Optional[str] = None
    admission_time:        Optional[str] = None
    care_grade_start_date: Optional[str] = None
    floor:                 Optional[str] = None
    room:                  Optional[str] = None
    religion:              Optional[str] = None
    group_cognitive:       Optional[str] = None
    group_leisure:         Optional[str] = None
    group_physical:        Optional[str] = None
    tube_feeding:          Optional[bool] = None
    memo:                  Optional[str] = None
    # 정원이 찬 방으로도 옮긴다(교체·임시 배정). 화면에서 한 번 더 확인받고 보낸다.
    allow_over_capacity:   Optional[bool] = None


class LtcResidentOut(BaseModel):
    id:                    str
    name:                  str
    birth_date:            str
    gender:                str
    admission_date:        str
    admission_time:        Optional[str] = None
    discharge_date:        Optional[str] = None
    discharge_time:        Optional[str] = None
    care_grade_start_date: str
    floor:                 Optional[str] = None
    room:                  Optional[str] = None
    religion:              Optional[str] = None
    group_cognitive:       Optional[str] = None
    group_leisure:         Optional[str] = None
    group_physical:        Optional[str] = None
    tube_feeding:          Optional[bool] = None
    status:                str
    memo:                  str
    created_at:            datetime
    model_config = ConfigDict(from_attributes=True)


class DischargeRequest(BaseModel):
    discharge_date: str
    discharge_time: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# 직원
# ══════════════════════════════════════════════════════════════════════════════

class LtcStaffCreate(BaseModel):
    name:         str
    birth_date:   str
    gender:       str
    hire_date:    str
    position:     Optional[str] = None
    resident_no:  Optional[str] = None
    address:      Optional[str] = None
    address_detail: Optional[str] = None
    phone:        Optional[str] = None
    license_date: Optional[str] = None
    license_no:   Optional[str] = None
    bank_account: Optional[str] = None
    leaves:       Optional[List[dict]] = None
    memo:         str = ""


class LtcStaffUpdate(BaseModel):
    name:         Optional[str] = None
    birth_date:   Optional[str] = None
    gender:       Optional[str] = None
    hire_date:    Optional[str] = None
    position:     Optional[str] = None
    resident_no:  Optional[str] = None
    address:      Optional[str] = None
    address_detail: Optional[str] = None
    phone:        Optional[str] = None
    license_date: Optional[str] = None
    license_no:   Optional[str] = None
    bank_account: Optional[str] = None
    leaves:       Optional[List[dict]] = None
    memo:         Optional[str] = None


class LtcStaffOut(BaseModel):
    id:           str
    name:         str
    birth_date:   str
    gender:       str
    hire_date:    str
    resign_date:  Optional[str] = None
    position:     Optional[str] = None
    resident_no:  Optional[str] = None
    address:      Optional[str] = None
    address_detail: Optional[str] = None
    phone:        Optional[str] = None
    license_date: Optional[str] = None
    license_no:   Optional[str] = None
    bank_account: Optional[str] = None
    leaves:       Optional[List[dict]] = None
    status:       str
    memo:         str
    created_at:   datetime
    model_config = ConfigDict(from_attributes=True)


class ResignRequest(BaseModel):
    resign_date: str
# ══════════════════════════════════════════════════════════════════════════════
# 설정
# ══════════════════════════════════════════════════════════════════════════════

class EvalSettingOut(BaseModel):
    facility_name:                str
    eval_year:                    int
    alert_days_before_due:        int
    long_inactive_threshold_days: int
    model_config = ConfigDict(from_attributes=True)


class EvalSettingUpdate(BaseModel):
    facility_name:                Optional[str] = None
    eval_year:                    Optional[int] = None
    alert_days_before_due:        Optional[int] = None
    long_inactive_threshold_days: Optional[int] = None
