import json
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, field_validator


# ── 공통 ──────────────────────────────────────────────────────────────────

class CompletionRecordOut(BaseModel):
    period_key:      str
    completed_date:  str
    memo:            str = ""
    attachment_name: str = ""
    model_config = ConfigDict(from_attributes=True)


# ── 체크리스트 ──────────────────────────────────────────────────────────────

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
    completed:            bool
    completed_date:       Optional[str] = None
    last_checked_date:    Optional[str] = None
    person_id:            Optional[str] = None
    person_name:          Optional[str] = None
    person_type:          Optional[str] = None
    template_id:          Optional[str] = None
    created_at:           datetime
    completion_history:   List[CompletionRecordOut] = []
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


class ChecklistItemUpdate(BaseModel):
    title:             Optional[str] = None
    description:       Optional[str] = None
    frequency:         Optional[str] = None
    related_indicator_id: Optional[str] = None
    related_category_id:  Optional[str] = None
    related_domain_id:    Optional[str] = None
    assignee:          Optional[str] = None
    evidence_required: Optional[str] = None
    storage_location:  Optional[str] = None
    how_to:            Optional[str] = None
    eval_note:         Optional[str] = None
    risk_level:        Optional[str] = None
    memo:              Optional[str] = None
    attachment_name:   Optional[str] = None
    active:            Optional[bool] = None
    completed:         Optional[bool] = None
    completed_date:    Optional[str] = None
    person_id:         Optional[str] = None
    person_name:       Optional[str] = None
    person_type:       Optional[str] = None


class ToggleRequest(BaseModel):
    period_key:      str
    completed_date:  str
    memo:            str = ""
    attachment_name: str = ""
    is_event:        bool = False


# ── 평가 지표 ──────────────────────────────────────────────────────────────

class EvalDomainOut(BaseModel):
    id:    str
    name:  str
    color: str
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


# ── 수급자 ─────────────────────────────────────────────────────────────────

class LtcResidentCreate(BaseModel):
    name:                  str
    birth_date:            str
    gender:                str
    admission_date:        str
    care_grade_start_date: str
    memo:                  str = ""


class LtcResidentUpdate(BaseModel):
    name:                  Optional[str] = None
    birth_date:            Optional[str] = None
    gender:                Optional[str] = None
    admission_date:        Optional[str] = None
    care_grade_start_date: Optional[str] = None
    memo:                  Optional[str] = None


class LtcResidentOut(BaseModel):
    id:                    str
    name:                  str
    birth_date:            str
    gender:                str
    admission_date:        str
    discharge_date:        Optional[str] = None
    care_grade_start_date: str
    status:                str
    memo:                  str
    created_at:            datetime
    model_config = ConfigDict(from_attributes=True)


class DischargeRequest(BaseModel):
    discharge_date: str


# ── 직원 ──────────────────────────────────────────────────────────────────

class LtcStaffCreate(BaseModel):
    name:       str
    birth_date: str
    gender:     str
    hire_date:  str
    memo:       str = ""


class LtcStaffUpdate(BaseModel):
    name:       Optional[str] = None
    birth_date: Optional[str] = None
    gender:     Optional[str] = None
    hire_date:  Optional[str] = None
    memo:       Optional[str] = None


class LtcStaffOut(BaseModel):
    id:          str
    name:        str
    birth_date:  str
    gender:      str
    hire_date:   str
    resign_date: Optional[str] = None
    status:      str
    memo:        str
    created_at:  datetime
    model_config = ConfigDict(from_attributes=True)


class ResignRequest(BaseModel):
    resign_date: str


# ── 설정 ──────────────────────────────────────────────────────────────────

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
