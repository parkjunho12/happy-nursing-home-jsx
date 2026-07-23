"""휴무 신청 API — 직원이 내고, 관리자가 승인하면 근무표에 반영된다."""
from __future__ import annotations
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.leave import LeaveRequest, SwapRequest, now_kst
from app.models.eval import LtcStaffMember
from app.models.work_schedule import WorkSchedule
from app.schemas.response import ApiResponse
from app.services.staff_notify import notify_user

router = APIRouter()
_D = re.compile(r"^\d{4}-\d{2}-\d{2}$")
KINDS = ("연차", "희망휴무")                 # 반차 제도는 없음
MAX_HOPE_PER_MONTH = 2                        # 희망휴무 월 상한 — 전원이 무제한으로 내면 편성이 안 된다
KIND_CODE = {"연차": "休"}                    # 희망휴무는 코드 없음(편성 힌트)


def _manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "휴무 승인 권한이 없습니다. (관리자·시설장)")
    return current_user


def _my_staff(db: Session, user: User) -> LtcStaffMember:
    """로그인 계정 → 직원 매칭 (계정 연동 우선, 이름 매칭 fallback)"""
    from app.services.staff_link import resolve_staff_for_user
    return resolve_staff_for_user(db, user)


def _view(r: LeaveRequest) -> dict:
    return {
        "id": r.id, "staff_id": r.staff_id, "staff_name": r.staff_name,
        "date": r.date, "kind": r.kind, "reason": r.reason, "status": r.status,
        "use_annual": bool(r.use_annual) if r.use_annual is not None else None,
        "decided_by": r.decided_by,
        "signature_url": r.signature_url,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


class CreateBody(BaseModel):
    dates: List[str]
    kind: str
    reason: Optional[str] = None
    use_annual: Optional[bool] = None   # 희망휴무: 근무표 짤 때 연차(休)로 우선 반영 (기본 켬)
    signature: Optional[str] = None     # data:image/png;base64,... — 모든 신청에 필수


@router.post("/requests")
def create_requests(body: CreateBody, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    """휴무 신청 — 날짜 하나가 한 건. 같은 날 중복 신청은 막는다."""
    if body.kind not in KINDS:
        raise HTTPException(400, "종류는 연차 또는 희망휴무여야 합니다.")
    dates = [d.strip() for d in (body.dates or []) if d.strip()]
    if not dates:
        raise HTTPException(400, "날짜를 하나 이상 선택해주세요.")
    if len(dates) > 31:
        raise HTTPException(400, "한 번에 31일까지만 신청할 수 있습니다.")
    for d in dates:
        if not _D.match(d):
            raise HTTPException(400, f"날짜 형식이 잘못됐습니다: {d}")
    staff = _my_staff(db, current_user)

    # 희망휴무의 연차 반영 여부 — 명시 안 하면 켬(기본). 연차 자체는 항상 연차.
    use_annual = True if body.use_annual is None else bool(body.use_annual)
    counts_as_annual = body.kind == "연차" or (body.kind == "희망휴무" and use_annual)

    # ★ 연차 사용불가월 하드 차단 — 1일 입사자는 입사달, 그 외는 입사달+다음 달
    if counts_as_annual:
        hire = (staff.hire_date or "")[:10]
        bad = [d for d in dates
               if int(d[5:7]) in _blocked_months(hire, int(d[:4]))]
        if bad:
            hint = ("" if body.kind == "연차"
                    else " '연차로 반영'을 끄면 희망휴무로는 신청할 수 있습니다.")
            raise HTTPException(400,
                f"입사 첫 달(★)에는 연차를 쓸 수 없습니다: {', '.join(sorted(bad))}.{hint}")

    # 연간 발생 한도 초과 차단 — 사용 + 대기 중 + 이번 신청이 올해 발생을 넘으면 안 된다
    if counts_as_annual:
        by_year: dict = {}
        for d in dates:
            by_year[int(d[:4])] = by_year.get(int(d[:4]), 0) + 1
        for yy, n in by_year.items():
            summ = _my_annual_summary(db, staff, yy)
            if summ["used"] + summ["pending"] + n > summ["entitle"]:
                left = max(0, summ["entitle"] - summ["used"] - summ["pending"])
                raise HTTPException(400,
                    f"{yy}년 연차가 부족합니다. 올해 발생 {summ['entitle']}개 중 "
                    f"사용 {summ['used']}개·대기 {summ['pending']}개로 {left}개만 더 신청할 수 있어요.")

    # 연차는 근무를 休로 바꾸는 것이라, 근무표에 실제 근무가 있는 날에만 쓸 수 있다
    if body.kind == "연차":
        for d in dates:
            ym = d[:7]
            w = db.query(WorkSchedule).filter(WorkSchedule.year_month == ym).first()
            if not w:
                raise HTTPException(400,
                    f"{int(ym[5:7])}월 근무표가 아직 없습니다. 근무표가 나온 뒤 연차를 신청해주세요. "
                    f"(미리 쉬고 싶은 날은 '희망휴무'로 내주세요)")
            if not _is_work(_cell(db, staff.id, d)):
                raise HTTPException(400,
                    f"{d}에는 내 근무가 없습니다. 근무표에 근무가 있는 날만 연차를 쓸 수 있어요.")

    # 모든 신청은 서면(전자서명) — 나중에 "신청한 적 없다" 분쟁을 막는 근거가 된다
    sig_url = _save_signature(staff.name, body.signature)

    dup = db.query(LeaveRequest).filter(
        LeaveRequest.staff_id == staff.id,
        LeaveRequest.date.in_(dates),
        LeaveRequest.status.in_(["pending", "approved"]),
    ).all()
    if dup:
        raise HTTPException(409, f"이미 신청된 날짜가 있습니다: {', '.join(sorted(x.date for x in dup))}")

    # 희망휴무는 한 달에 최대 2일 — 기존(대기·승인) + 이번 신청을 월별로 합산해 검사
    if body.kind == "희망휴무":
        new_by_month: dict = {}
        for d in dates:
            new_by_month[d[:7]] = new_by_month.get(d[:7], 0) + 1
        for ym, n in new_by_month.items():
            existing = db.query(LeaveRequest).filter(
                LeaveRequest.staff_id == staff.id,
                LeaveRequest.kind == "희망휴무",
                LeaveRequest.status.in_(["pending", "approved"]),
                LeaveRequest.date.like(f"{ym}-%"),
            ).count()
            if existing + n > MAX_HOPE_PER_MONTH:
                y, m = ym.split("-")
                raise HTTPException(400,
                    f"희망휴무는 한 달에 최대 {MAX_HOPE_PER_MONTH}일까지입니다. "
                    f"{int(m)}월은 이미 {existing}일 신청돼 있어 {max(0, MAX_HOPE_PER_MONTH - existing)}일만 더 가능합니다.")
    made = []
    for d in dates:
        r = LeaveRequest(staff_id=staff.id, staff_name=staff.name,
                         user_id=getattr(current_user, "id", None),
                         date=d, kind=body.kind, reason=(body.reason or "").strip() or None,
                         use_annual=use_annual if body.kind == "희망휴무" else None,
                         signature_url=sig_url)
        db.add(r); made.append(r)
    db.commit()
    return ApiResponse(success=True, data=[_view(r) for r in made])


def _my_annual_summary(db: Session, staff: LtcStaffMember, year: int) -> dict:
    """내 연차 현황 — 대장(/ledger)과 같은 규칙으로 한 사람만 계산.

    사용 = 승인된 연차·연차반영 희망휴무 ∪ 근무표의 休.
    쓸 수 있는 연차 = 지금까지 발생(1년차는 월할) − 사용 − 대기 중 신청."""
    today = now_kst()
    month_now = today.month if today.year == year else (12 if today.year > year else 0)

    used_dates = set()
    for r in db.query(LeaveRequest).filter(
            LeaveRequest.staff_id == staff.id, LeaveRequest.status == "approved",
            LeaveRequest.date.like(f"{year}-%")).all():
        if r.kind == "연차" or (r.kind == "희망휴무" and r.use_annual):
            used_dates.add(r.date)
    for w in db.query(WorkSchedule).filter(WorkSchedule.year_month.like(f"{year}-%")).all():
        row = (w.data or {}).get(staff.id) or {}
        for day, code in row.items():
            if code == "休":
                used_dates.add(f"{w.year_month}-{int(day):02d}")
    pending_n = db.query(LeaveRequest).filter(
        LeaveRequest.staff_id == staff.id, LeaveRequest.status == "pending",
        LeaveRequest.date.like(f"{year}-%"),
        (LeaveRequest.kind == "연차") | ((LeaveRequest.kind == "희망휴무") & (LeaveRequest.use_annual == True)),  # noqa: E712
    ).count()

    hire = (staff.hire_date or "")[:10]
    hy = int(hire[:4]) if len(hire) >= 4 and hire[:4].isdigit() else None
    service_year = (year - hy + 1) if hy else 1
    entitle = ENTITLE_BY_YEAR.get(service_year, ENTITLE_MAX) if service_year >= 1 else 0
    accrued = _accrued_first_year(hire, year, month_now) if (service_year == 1 and hy) else entitle
    used = len(used_dates)
    return {
        "year": year, "service_year": service_year,
        "entitle": entitle,               # 올해 발생 (1년차는 만근 시 최대 11)
        "accrued": accrued,               # 지금까지 발생
        "used": used,                     # 사용 (승인·근무표 기준)
        "pending": pending_n,             # 대기 중 신청
        "available": accrued - used - pending_n,   # 지금 쓸 수 있는 연차
        "blocked_months": _blocked_months(hire, year),
        # 소멸일 — 1년 이상은 12/31, 1년 미만은 입사 1년 되는 날 전날
        "expire_on": _promotion_schedule(hire, year, service_year)["expire_on"],
    }


@router.get("/requests/my-annual")
def my_annual(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    staff = _my_staff(db, current_user)
    return ApiResponse(success=True, data=_my_annual_summary(db, staff, now_kst().year))


@router.get("/requests/my-shifts")
def my_shifts(month: str, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    """저장된 근무표에서 내 '실제 근무' 칸만 — 연차는 근무 날짜에만 쓸 수 있다."""
    me = _my_staff(db, current_user)
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == month).first()
    out = {}
    for day, code in (((w.data if w else None) or {}).get(me.id) or {}).items():
        c = (code or "").strip()
        if _is_work(c):
            out[f"{month}-{int(day):02d}"] = c
    return ApiResponse(success=True, data={"month": month, "saved": bool(w),
                                           "shifts": dict(sorted(out.items()))})


@router.get("/requests/mine")
def my_requests(year: Optional[str] = None, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    staff = _my_staff(db, current_user)
    q = db.query(LeaveRequest).filter(LeaveRequest.staff_id == staff.id)
    if year:
        q = q.filter(LeaveRequest.date.like(f"{year}-%"))
    rows = q.order_by(LeaveRequest.date.desc()).limit(200).all()
    # 올해 사용 연차(승인 기준): 연차 1일 · 반차 0.5일
    y = year or now_kst().strftime("%Y")
    used = 0.0
    for r in db.query(LeaveRequest).filter(
            LeaveRequest.staff_id == staff.id, LeaveRequest.status == "approved",
            LeaveRequest.date.like(f"{y}-%")).all():
        used += 1.0 if (r.kind == "연차" or (r.kind == "희망휴무" and r.use_annual)) else 0.0
    return ApiResponse(success=True, data={"requests": [_view(r) for r in rows],
                                           "used_annual": used, "year": y})


@router.delete("/requests/{rid}")
def cancel_request(rid: str, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """본인 신청 취소 — 대기 중일 때만."""
    staff = _my_staff(db, current_user)
    r = db.query(LeaveRequest).filter(LeaveRequest.id == rid,
                                      LeaveRequest.staff_id == staff.id).first()
    if not r:
        raise HTTPException(404, "신청을 찾을 수 없습니다.")
    if r.status != "pending":
        raise HTTPException(400, "이미 처리된 신청은 취소할 수 없습니다. 관리자에게 문의하세요.")
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="취소했습니다.")


@router.get("/requests")
def list_requests(month: Optional[str] = None, status: Optional[str] = "pending",
                  db: Session = Depends(get_db), _: User = Depends(_manager)):
    q = db.query(LeaveRequest)
    if month:
        q = q.filter(LeaveRequest.date.like(f"{month}-%"))
    if status:
        q = q.filter(LeaveRequest.status == status)
    rows = q.order_by(LeaveRequest.date.asc()).limit(300).all()
    return ApiResponse(success=True, data=[_view(r) for r in rows])


class DecideBody(BaseModel):
    approve: bool
    note: Optional[str] = None


@router.patch("/requests/{rid}")
def decide(rid: str, body: DecideBody, db: Session = Depends(get_db),
           current_user: User = Depends(_manager)):
    """승인/반려. 연차·반차 승인은 그 달 근무표에 休·반을 바로 적는다 —
    사람이 옮겨 적는 단계가 남아 있으면 거기서 누락이 난다."""
    r = db.query(LeaveRequest).filter(LeaveRequest.id == rid).first()
    if not r:
        raise HTTPException(404, "신청을 찾을 수 없습니다.")
    if r.status != "pending":
        raise HTTPException(400, "이미 처리된 신청입니다.")

    r.status = "approved" if body.approve else "rejected"
    r.decided_by = getattr(current_user, "name", None)
    r.decided_at = now_kst()

    written = False
    writes_hyu = r.kind in KIND_CODE or (r.kind == "희망휴무" and r.use_annual)
    if body.approve and writes_hyu:
        ym = r.date[:7]
        w = db.query(WorkSchedule).filter(WorkSchedule.year_month == ym).first()
        if not w:
            w = WorkSchedule(year_month=ym, data={})
            db.add(w)
        data = dict(w.data or {})
        row = dict(data.get(r.staff_id) or {})
        row[str(int(r.date[8:10]))] = KIND_CODE.get(r.kind, "休")
        data[r.staff_id] = row
        w.data = data                      # JSON 컬럼은 재할당해야 변경이 감지된다
        written = True
    db.commit()

    # 신청자에게 결과 푸시 (실패해도 처리 자체는 유지)
    kind_txt = r.kind
    if body.approve:
        msg = f"{r.date} {kind_txt} 신청이 승인되었습니다."
    else:
        msg = f"{r.date} {kind_txt} 신청이 반려되었습니다." + (f" ({body.note})" if body.note else "")
    notify_user(db, r.user_id, "휴무 신청 결과", msg, data={"type": "my-schedule"})

    return ApiResponse(success=True, data={**_view(r), "schedule_written": written})


# ═══════════════════════ 맞교대 ═══════════════════════

def _save_signature(name: str, signature: Optional[str]) -> str:
    """전자서명 검증·저장 (연차와 동일 규칙)"""
    if not signature or not signature.startswith("data:image"):
        raise HTTPException(400, "서명이 필요합니다.")
    import base64
    try:
        raw = base64.b64decode(signature.split(",", 1)[1])
    except Exception:
        raise HTTPException(400, "서명 데이터를 읽지 못했습니다. 다시 서명해주세요.")
    if len(raw) < 200:
        raise HTTPException(400, "서명이 비어 있습니다. 이름을 서명해주세요.")
    from app.services.storage import save_upload
    return save_upload(raw, "signatures", f"{name}.png", "image/png")


def _swap_view(r: SwapRequest, my_staff_id: Optional[str] = None) -> dict:
    return {
        "id": r.id,
        "requester_staff_id": r.requester_staff_id, "requester_name": r.requester_name,
        "partner_staff_id": r.partner_staff_id, "partner_name": r.partner_name,
        "dates": r.dates or [], "shift_code": getattr(r, "shift_code", None),
        "reason": r.reason, "status": r.status,
        "requester_signature_url": r.requester_signature_url,
        "partner_signature_url": r.partner_signature_url,
        "decided_by": r.decided_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "i_am": ("requester" if my_staff_id == r.requester_staff_id
                 else "partner" if my_staff_id == r.partner_staff_id else None),
    }


# 근무가 아닌 코드 — 휴가·보상휴가·병가 칸은 맞교대 대상이 아니다
NON_WORK_CODES = {"休", "대휴", "초과휴", "◆", "◆병", "반", "AD반", "반PD"}


def _cell(db: Session, staff_id: str, date: str) -> Optional[str]:
    """저장된 근무표에서 그 사람·그 날짜 칸의 코드 (없으면 None)"""
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == date[:7]).first()
    if not w:
        return None
    v = ((w.data or {}).get(staff_id) or {}).get(str(int(date[8:10])))
    return (v or "").strip() or None


def _is_work(code: Optional[str]) -> bool:
    return bool(code) and code not in NON_WORK_CODES


@router.get("/swaps/partners")
def swap_partners(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """맞교대 가능한 상대 — 같은 직종의 재직자만.

    직종이 다르면 하는 일이 달라 근무를 대신할 수 없으므로
    목록에서부터 아예 보여주지 않는다."""
    me = _my_staff(db, current_user)
    rows = (db.query(LtcStaffMember)
            .filter(LtcStaffMember.status == "active",
                    LtcStaffMember.position == me.position,
                    LtcStaffMember.id != me.id)
            .order_by(LtcStaffMember.name).all())
    return ApiResponse(success=True, data={
        "my_position": me.position,
        "partners": [{"id": r.id, "name": r.name, "position": r.position} for r in rows],
    })


@router.get("/swaps/shifts")
def swap_shifts(partner_staff_id: str, month: str, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    """맞교대용 — 저장된 근무표에서 나와 상대의 '실제 근무' 칸만 돌려준다.

    화면은 이 목록에서만 고르게 해서, 근무표에 없는 날을 바꾸자는
    신청 자체가 만들어지지 않게 한다."""
    me = _my_staff(db, current_user)
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == month).first()
    data = (w.data if w else None) or {}

    def works(sid: str) -> dict:
        out = {}
        for day, code in (data.get(sid) or {}).items():
            c = (code or "").strip()
            if _is_work(c):
                out[f"{month}-{int(day):02d}"] = c
        return dict(sorted(out.items()))

    return ApiResponse(success=True, data={
        "month": month, "saved": bool(w),
        "mine": works(me.id), "partner": works(partner_staff_id),
    })


class SwapCreateBody(BaseModel):
    my_date: str                     # 내가 내놓는 근무일 (근무표에 실제 근무가 있어야 함)
    partner_date: str                # 상대가 내놓는 근무일 — 같은 코드끼리만 교환
    partner_staff_id: str
    reason: Optional[str] = None
    signature: Optional[str] = None


@router.post("/swaps")
def create_swap(body: SwapCreateBody, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    me = _my_staff(db, current_user)
    if body.partner_staff_id == me.id:
        raise HTTPException(400, "본인과는 교대할 수 없습니다.")
    partner = db.query(LtcStaffMember).filter(LtcStaffMember.id == body.partner_staff_id).first()
    if not partner or (partner.status or "active") != "active":
        raise HTTPException(404, "상대 직원을 찾을 수 없습니다.")
    if (partner.position or "") != (me.position or ""):
        raise HTTPException(400,
            f"같은 직종끼리만 근무를 바꿀 수 있습니다. "
            f"(나: {me.position or '미지정'} / {partner.name}: {partner.position or '미지정'})")
    my_date, their_date = body.my_date.strip(), body.partner_date.strip()
    if not _D.match(my_date) or not _D.match(their_date):
        raise HTTPException(400, "날짜 형식이 잘못됐습니다.")
    if my_date == their_date:
        raise HTTPException(400, "같은 날 같은 근무끼리는 바꿀 것이 없습니다. 서로 다른 날을 골라주세요.")

    # 실제 근무표 기준 검증 — 화면에서 걸러도 서버가 최종 판단한다
    my_code = _cell(db, me.id, my_date)
    their_code = _cell(db, partner.id, their_date)
    if not _is_work(my_code):
        raise HTTPException(400, f"{my_date}에 내 근무가 없습니다. 근무표에 있는 근무만 바꿀 수 있어요.")
    if not _is_work(their_code):
        raise HTTPException(400, f"{their_date}에 {partner.name} 선생님 근무가 없습니다.")
    if my_code != their_code:
        raise HTTPException(400,
            f"같은 근무끼리만 바꿀 수 있습니다. 내 근무는 {my_code}, "
            f"상대 근무는 {their_code}예요. (D↔D, N↔N)")
    # 받는 자리가 비어 있어야 한다 — 이미 근무·휴가가 있는 날로는 못 옮긴다
    if _cell(db, partner.id, my_date):
        raise HTTPException(400, f"{partner.name} 선생님은 {my_date}에 이미 '{_cell(db, partner.id, my_date)}'가 있어 바꿀 수 없습니다.")
    if _cell(db, me.id, their_date):
        raise HTTPException(400, f"나는 {their_date}에 이미 '{_cell(db, me.id, their_date)}'가 있어 바꿀 수 없습니다.")
    sig = _save_signature(me.name, body.signature)

    r = SwapRequest(
        requester_staff_id=me.id, requester_name=me.name,
        requester_user_id=getattr(current_user, "id", None),
        partner_staff_id=partner.id, partner_name=partner.name,
        partner_user_id=partner.user_id,
        dates=[my_date, their_date],      # [내 근무일, 상대 근무일] 순서 보존
        shift_code=my_code,
        reason=(body.reason or "").strip() or None,
        requester_signature_url=sig, status="partner_wait",
    )
    db.add(r); db.commit(); db.refresh(r)

    if partner.user_id:
        notify_user(db, partner.user_id, "근무 교대 동의 요청",
                    f"{me.name} 선생님이 {my_code} 근무 교대({my_date} ↔ {their_date})를 요청했습니다. 앱에서 확인해주세요.",
                    data={"type": "my-schedule"})
    return ApiResponse(success=True, data=_swap_view(r, me.id))


@router.get("/swaps/mine")
def my_swaps(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    me = _my_staff(db, current_user)
    rows = (db.query(SwapRequest)
            .filter((SwapRequest.requester_staff_id == me.id) | (SwapRequest.partner_staff_id == me.id))
            .order_by(SwapRequest.created_at.desc()).limit(50).all())
    return ApiResponse(success=True, data=[_swap_view(r, me.id) for r in rows])


class SwapConsentBody(BaseModel):
    agree: bool
    signature: Optional[str] = None   # 동의 시 필수


@router.post("/swaps/{rid}/consent")
def consent_swap(rid: str, body: SwapConsentBody, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    """상대방의 동의/거절 — 합의 증빙으로 동의에도 서명을 받는다."""
    me = _my_staff(db, current_user)
    r = db.query(SwapRequest).filter(SwapRequest.id == rid).first()
    if not r:
        raise HTTPException(404, "요청을 찾을 수 없습니다.")
    if r.partner_staff_id != me.id:
        raise HTTPException(403, "이 요청의 상대방이 아닙니다.")
    if r.status != "partner_wait":
        raise HTTPException(400, "이미 처리된 요청입니다.")

    if body.agree:
        r.partner_signature_url = _save_signature(me.name, body.signature)
        r.partner_user_id = getattr(current_user, "id", None) or r.partner_user_id
        r.status = "pending"
        msg = f"{me.name} 선생님이 교대에 동의했습니다. 관리자 승인을 기다립니다."
    else:
        r.status = "declined"
        msg = f"{me.name} 선생님이 교대 요청을 거절했습니다."
    db.commit()
    notify_user(db, r.requester_user_id, "근무 교대", msg, data={"type": "my-schedule"})
    return ApiResponse(success=True, data=_swap_view(r, me.id))


@router.get("/swaps")
def list_swaps(status: Optional[str] = "pending",
               db: Session = Depends(get_db), _: User = Depends(_manager)):
    q = db.query(SwapRequest)
    if status:
        q = q.filter(SwapRequest.status == status)
    rows = q.order_by(SwapRequest.created_at.asc()).limit(200).all()
    return ApiResponse(success=True, data=[_swap_view(r) for r in rows])


@router.patch("/swaps/{rid}")
def decide_swap(rid: str, body: DecideBody, db: Session = Depends(get_db),
                current_user: User = Depends(_manager)):
    """관리자 승인 — 근무표에서 두 사람의 해당 날짜 칸을 서로 교환한다."""
    r = db.query(SwapRequest).filter(SwapRequest.id == rid).first()
    if not r:
        raise HTTPException(404, "요청을 찾을 수 없습니다.")
    if r.status != "pending":
        raise HTTPException(400, "동의 대기 중이거나 이미 처리된 요청입니다.")

    r.status = "approved" if body.approve else "rejected"
    r.decided_by = getattr(current_user, "name", None)
    r.decided_at = now_kst()

    swapped = []
    if body.approve:
        for d in (r.dates or []):
            ym = d[:7]
            w = db.query(WorkSchedule).filter(WorkSchedule.year_month == ym).first()
            if not w:
                continue                     # 근무표가 아직 없으면 바꿀 것도 없다
            data = dict(w.data or {})
            a_row = dict(data.get(r.requester_staff_id) or {})
            b_row = dict(data.get(r.partner_staff_id) or {})
            day = str(int(d[8:10]))
            a_val, b_val = a_row.get(day), b_row.get(day)
            # 서로 교환 — 빈 칸(휴무)과의 교환도 그대로 성립한다
            if b_val is None: a_row.pop(day, None)
            else: a_row[day] = b_val
            if a_val is None: b_row.pop(day, None)
            else: b_row[day] = a_val
            data[r.requester_staff_id] = a_row
            data[r.partner_staff_id] = b_row
            w.data = data                    # JSON 재할당으로 변경 감지
            swapped.append(d)
    db.commit()

    verdict = "승인되어 근무표가 바뀌었습니다" if body.approve else               ("반려되었습니다" + (f" ({body.note})" if body.note else ""))
    for uid in {r.requester_user_id, r.partner_user_id}:
        if uid:
            notify_user(db, uid, "근무 교대 결과",
                        f"{', '.join(r.dates or [])} 교대가 {verdict}.",
                        data={"type": "my-schedule"})
    return ApiResponse(success=True, data={**_swap_view(r), "swapped_dates": swapped})


# ═══════════════════════ 연차 관리대장 ═══════════════════════

# 근속연차별 발생 개수 — 시설 기준표 (1년차 11 · 2~3년차 15 · 4~5년차 16 · 6~7년차 17 · 8년차~ 18)
ENTITLE_BY_YEAR = {1: 11, 2: 15, 3: 15, 4: 16, 5: 16, 6: 17, 7: 17}
ENTITLE_MAX = 18


def _blocked_months(hire: str, year: int) -> list:
    """연차 사용불가월(★).

    시설 규칙: 매월 1일 입사자는 입사한 그달만 불가.
    1일이 아닌 입사자는 입사달과 그다음 달, 두 달 불가."""
    if not hire or len(hire) < 10:
        return []
    hy, hm, hd = int(hire[:4]), int(hire[5:7]), int(hire[8:10])
    if hy != year:
        return []
    months = [hm] if hd == 1 else [hm, hm + 1]
    return [m for m in months if 1 <= m <= 12]


def _first_accrual_month(hire: str) -> int:
    """1년차 월차의 첫 발생월.

    규칙: 한 달을 만근하고, 그다음 달에 하루라도 근무하면 그때 월차 1개 발생.
    · 1일 입사 → 입사달부터 만근 가능 → 첫 발생 = 입사달 + 1
    · 그 외 입사 → 첫 만근달 = 입사달 + 1 → 첫 발생 = 입사달 + 2"""
    hm, hd = int(hire[5:7]), int(hire[8:10])
    return hm + 1 if hd == 1 else hm + 2


def _accrued_first_year(hire: str, year: int, month_now: int) -> int:
    """1년차 발생 누계 — 만근 가정, 매월 1개 (연간 최대 11).

    최대 11은 입사 1년이 될 때까지 계속 쌓이는 법정 상한이라,
    연중 입사자도 발생분이 이월 개념 없이 다음 해 초까지 이어져 11을 채운다.
    (대장은 해당 연도 안에서 발생한 만큼만 누계로 보여준다)"""
    hy = int(hire[:4])
    if hy != year:
        return 11
    first = _first_accrual_month(hire)
    return max(0, min(11, month_now - first + 1))


def _hr_viewer(current_user: User = Depends(get_current_user)) -> User:
    """연차 대장 열람 — 직원 관리(/staff-hr) 접근 권한과 동일하게 맞춘다."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "대표", "이사"):
        raise HTTPException(403, "연차 대장 열람 권한이 없습니다.")
    return current_user


def _shift_months(y: int, m: int, d: int, delta: int) -> tuple:
    """(y,m,d)에서 delta개월 이동 — 말일 넘침은 그 달 말일로 당긴다."""
    import calendar
    t = (y * 12 + (m - 1)) + delta
    ny, nm = divmod(t, 12)
    nm += 1
    nd = min(d, calendar.monthrange(ny, nm)[1])
    return ny, nm, nd


def _promotion_schedule(hire: str, year: int, service_year: int) -> dict:
    """연차 사용촉진 일정 (근로기준법 61조).

    일괄 연말 공지는 법적 효력이 없다 — 사람·기준마다 서면 통지 시기가 다르다.
    · 1년 이상(회계연도 1/1 부여): 1차 촉구 7/1~7/10, 2차(시기 지정 통보) 10/31까지, 12/31 소멸
    · 1년 미만(입사일 기준): 입사 1년 되는 날 기준 역산 —
      1차 촉구 = 3개월 전부터 10일간, 2차 = 2개월 전까지, 소멸 = 1년 되는 날 전날"""
    from datetime import date, timedelta
    if service_year >= 2 or not hire or len(hire) < 10:
        return {
            "basis": "fiscal",
            "first_notice": [f"{year}-07-01", f"{year}-07-10"],
            "second_deadline": f"{year}-10-31",
            "expire_on": f"{year}-12-31",
        }
    hy, hm, hd = int(hire[:4]), int(hire[5:7]), int(hire[8:10])
    ay, am, ad = _shift_months(hy, hm, hd, 12)          # 입사 1년 되는 날
    anniv = date(ay, am, ad)
    f1y, f1m, f1d = _shift_months(ay, am, ad, -3)       # 1차: 3개월 전부터 10일
    first_start = date(f1y, f1m, f1d)
    s2y, s2m, s2d = _shift_months(ay, am, ad, -2)       # 2차: 2개월 전까지
    return {
        "basis": "hire",
        "first_notice": [first_start.isoformat(), (first_start + timedelta(days=10)).isoformat()],
        "second_deadline": date(s2y, s2m, s2d).isoformat(),
        "expire_on": (anniv - timedelta(days=1)).isoformat(),
    }


@router.get("/ledger")
def annual_leave_ledger(year: int, db: Session = Depends(get_db), _: User = Depends(_hr_viewer)):
    """연차휴가 관리대장 — 시트로 관리하던 것을 그대로 화면에 올린 것.

    연차 사용촉진제 적용: 이월 없음, 미사용분은 연말 소멸(수당 전환 없음).
    따라서 대장의 목적은 정산이 아니라 '소멸 전에 쓰게 만드는 것'이다.

    사용 내역은 두 곳의 합집합: 승인된 연차 신청 + 근무표에 직접 칠한 休.
    (신청 제도 도입 전 수기 기록도 대장에 빠지지 않게)"""
    staff = (db.query(LtcStaffMember)
             .filter(LtcStaffMember.status == "active").all())

    # ① 승인된 연차 신청
    approved = db.query(LeaveRequest).filter(
        LeaveRequest.kind == "연차",
        LeaveRequest.status == "approved",
        LeaveRequest.date.like(f"{year}-%"),
    ).all()
    used: dict = {}
    for r in approved:
        used.setdefault(r.staff_id, set()).add(r.date)

    # ② 근무표의 休 칸
    for w in db.query(WorkSchedule).filter(WorkSchedule.year_month.like(f"{year}-%")).all():
        ym = w.year_month
        for sid, row in (w.data or {}).items():
            for day, code in (row or {}).items():
                if code == "休":
                    used.setdefault(sid, set()).add(f"{ym}-{int(day):02d}")

    today = now_kst()
    month_now = today.month if today.year == year else (12 if today.year > year else 0)

    rows = []
    for st in staff:
        hire = (st.hire_date or "")[:10]
        hy = int(hire[:4]) if len(hire) >= 4 and hire[:4].isdigit() else None
        service_year = (year - hy + 1) if hy else 1
        entitle = (ENTITLE_BY_YEAR.get(service_year, ENTITLE_MAX)
                   if service_year >= 1 else 0)          # 1년차는 최대 11
        first_year = service_year == 1
        accrued = _accrued_first_year(hire, year, month_now) if (first_year and hy) else entitle

        my = sorted(used.get(st.id, set()))
        by_month: dict = {}
        for d in my:
            by_month.setdefault(int(d[5:7]), []).append(d)

        rows.append({
            "staff_id": st.id, "name": st.name, "position": st.position,
            "hire_date": hire or None,
            "service_year": service_year,
            "entitle": entitle,               # 연간 발생 (1년차는 최대치)
            "accrued": accrued,               # 현재까지 발생 (1년차만 월할)
            "used_total": len(my),
            "remaining": accrued - len(my),
            "blocked_months": _blocked_months(hire, year),
            "used_by_month": {str(m): ds for m, ds in by_month.items()},
            "promotion": _promotion_schedule(hire, year, service_year),
        })
    rows.sort(key=lambda r: (r["hire_date"] or "9999", r["name"]))
    return ApiResponse(success=True, data={"year": year, "month_now": month_now, "rows": rows})
