"""운영·계약 관리 — 계약 대장(만료 알림) + 월별 납부 대장.

수기 엑셀(행복한_운영 및 계약내역.xlsx)을 그대로 옮긴 구조:
- 계약: 항목·업체·금액·기간·지출일·메모, 만료 D-day는 프론트 계산
- 납부: 항목×월 매트릭스, 한 달에 여러 건 기록 가능
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.operations import OperationContract, OperationPayItem, OperationPayment
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()

from datetime import timezone as _tz, timedelta as _td  # noqa: E402
KST_OP = _tz(_td(hours=9))

def _guard(current_user: User = Depends(get_current_user)) -> User:
    """운영·계약은 급여 총액 등 민감 정보가 포함되어 ADMIN 전용."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(403, "운영·계약 관리는 ADMIN만 접근할 수 있습니다.")
    return current_user


def _is_admin(u: User) -> bool:
    role = u.role.value if hasattr(u.role, "value") else str(u.role)
    return role == "ADMIN"


def _norm_periods(raw) -> list:
    """기간 이력 정규화 — [{start, end, note, recorded_at}]"""
    out = []
    for x in (raw or []):
        if not isinstance(x, dict):
            continue
        start = str(x.get("start") or "").strip()[:50]
        end = str(x.get("end") or "").strip()[:50]
        if not (start or end):
            continue
        out.append({"start": start, "end": end,
                    "note": (str(x.get("note") or "").strip()[:200] or None),
                    "recorded_at": str(x.get("recorded_at") or "")[:20] or None})
    return out



# ── 계약 → 납부 대장 연동 ───────────────────────────────────────────────
# 계약 대장에 넣은 계약이 납부 대장에 안 나오는 문제가 있었다.
# 두 대장이 아무 관계 없이 따로 놀아, 같은 항목을 두 번 적어야 했다.
#
# 매달 돈이 나가는 계약만 올린다. '업체(참고)'·'점검(정기 검사)' 은
# 납부할 것이 아니라 연락처·일정 참고용이라 올리지 않는다.
PAYABLE_SECTIONS = ("정기", "계약", "보험", "기타")
# 납부 대장의 구분은 세 가지뿐이다 — 계약의 구분을 여기에 맞춰 옮긴다
CONTRACT_TO_PAY_SECTION = {"정기": "정기", "계약": "정기", "보험": "정기", "기타": "기타"}


def _payable(section: Optional[str]) -> bool:
    return (section or "정기") in PAYABLE_SECTIONS


def _sync_pay_item(db: Session, c: OperationContract, *, want: bool) -> Optional[OperationPayItem]:
    """계약에 딸린 납부 항목을 맞춘다.

    want=False 면 내린다. 납부 기록이 있으면 지우지 않고 비활성으로만 둔다 —
    기록을 지우는 것은 되돌릴 수 없다.
    """
    from app.services.operations_groups import infer_group
    item = (db.query(OperationPayItem)
              .filter(OperationPayItem.contract_id == c.id).first())

    if not want:
        if item:
            has_pay = db.query(OperationPayment).filter(
                OperationPayment.item_id == item.id).count() > 0
            if has_pay:
                item.active = False
            else:
                db.delete(item)
        return None

    section = CONTRACT_TO_PAY_SECTION.get(c.section or "정기", "정기")
    grp = c.grp or infer_group(c.category or "", section)
    if item:
        item.section, item.category, item.vendor = section, c.category, c.vendor
        item.grp, item.active = grp, True
        if c.pay_day:
            item.method = c.pay_day
        return item

    item = OperationPayItem(
        contract_id=c.id, section=section, category=c.category, vendor=c.vendor,
        method=c.pay_day, grp=grp,
        sort=db.query(OperationPayItem).count())
    db.add(item)
    db.flush()
    return item


def _c_view(c: OperationContract) -> dict:
    from app.services.operations_groups import infer_group
    return {
        "id": c.id, "section": c.section, "category": c.category, "vendor": c.vendor,
        "grp": c.grp or infer_group(c.category or ""),
        "contact": c.contact, "amount_note": c.amount_note,
        "start_date": c.start_date, "end_date": c.end_date, "pay_day": c.pay_day,
        "periods": _norm_periods(c.periods),
        "memo": c.memo, "active": c.active, "sort": c.sort,
        # 화면에서 '납부 대장에 올라와 있는지'를 보여주기 위한 값
        "on_ledger": bool(getattr(c, "_on_ledger", False)),
        "payable": _payable(c.section),
    }


class ContractBody(BaseModel):
    periods: Optional[list] = None
    grp: Optional[str] = None
    section: Optional[str] = None
    category: Optional[str] = None
    vendor: Optional[str] = None
    contact: Optional[str] = None
    amount_note: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    pay_day: Optional[str] = None
    memo: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None
    # 납부 대장에도 올릴지. 안 보내면 '돈 나가는 계약이면 올린다'가 기본이다.
    on_ledger: Optional[bool] = None


@router.get("/contracts")
def list_contracts(db: Session = Depends(get_db), _: User = Depends(_guard)):
    rows = db.query(OperationContract).order_by(OperationContract.sort, OperationContract.created_at).all()
    linked = {i.contract_id for i in
              db.query(OperationPayItem).filter(OperationPayItem.contract_id.isnot(None)).all()}
    for c in rows:
        c._on_ledger = c.id in linked
    return ApiResponse(success=True, data=[_c_view(c) for c in rows])


@router.post("/contracts")
def create_contract(body: ContractBody, db: Session = Depends(get_db), user: User = Depends(_guard)):
    if not (body.category or "").strip():
        raise HTTPException(400, "항목명은 필수입니다.")
    max_sort = db.query(OperationContract).count()
    c = OperationContract(
        section=body.section or "정기", category=body.category.strip(), grp=body.grp or None,
        vendor=body.vendor, contact=body.contact, amount_note=body.amount_note,
        start_date=body.start_date, end_date=body.end_date, pay_day=body.pay_day,
        memo=body.memo, sort=body.sort if body.sort is not None else max_sort,
        updated_by=getattr(user, "name", None),
    )
    db.add(c)
    db.flush()
    # 계약을 넣었으면 납부 대장에도 올라와야 한다 — 같은 것을 두 번 적게 하지 않는다
    want = body.on_ledger if body.on_ledger is not None else _payable(c.section)
    _sync_pay_item(db, c, want=want)
    db.commit()
    c._on_ledger = want
    return ApiResponse(success=True, data=_c_view(c))


@router.put("/contracts/{cid}")
def update_contract(cid: str, body: ContractBody, db: Session = Depends(get_db), user: User = Depends(_guard)):
    c = db.query(OperationContract).filter(OperationContract.id == cid).first()
    if not c:
        raise HTTPException(404, "계약을 찾을 수 없습니다.")
    for f in ("section", "category", "vendor", "contact", "amount_note",
              "start_date", "end_date", "pay_day", "grp", "memo", "active", "sort"):
        v = getattr(body, f)
        if v is not None:
            setattr(c, f, v)
    if body.periods is not None:
        c.periods = _norm_periods(body.periods)
    c.updated_by = getattr(user, "name", None)
    db.flush()
    # 항목명·업체를 고치면 납부 대장 쪽도 같이 바뀌어야 한다.
    # 올릴지 말지를 안 보냈으면 지금 상태를 유지한다 — 다른 것을 고치다
    # 납부 항목이 말없이 사라지면 안 된다.
    linked = db.query(OperationPayItem).filter(OperationPayItem.contract_id == c.id).first()
    want = body.on_ledger if body.on_ledger is not None else linked is not None
    _sync_pay_item(db, c, want=want and bool(c.active))
    db.commit()
    c._on_ledger = bool(db.query(OperationPayItem)
                          .filter(OperationPayItem.contract_id == c.id,
                                  OperationPayItem.active == True).count())  # noqa: E712
    return ApiResponse(success=True, data=_c_view(c))


@router.delete("/contracts/{cid}")
def delete_contract(cid: str, db: Session = Depends(get_db), user: User = Depends(_guard)):
    if not _is_admin(user):
        raise HTTPException(403, "삭제는 ADMIN만 가능합니다.")
    # 납부 기록이 있으면 항목을 남기고 연결만 끊는다 — 지난 지출 기록은 지우지 않는다
    for it in db.query(OperationPayItem).filter(OperationPayItem.contract_id == cid).all():
        if db.query(OperationPayment).filter(OperationPayment.item_id == it.id).count():
            it.contract_id = None
        else:
            db.delete(it)
    db.query(OperationContract).filter(OperationContract.id == cid).delete()
    db.commit()
    return ApiResponse(success=True, data={"deleted": cid})


# ── 납부 대장 ──────────────────────────────────────────────────────────────

def _i_view(i: OperationPayItem) -> dict:
    from app.services.operations_groups import infer_group
    return {"id": i.id, "section": i.section, "category": i.category,
            "vendor": i.vendor, "method": i.method, "sort": i.sort, "active": i.active,
            "grp": i.grp or infer_group(i.category or "", i.section or "")}


class PayItemBody(BaseModel):
    section: Optional[str] = None
    category: Optional[str] = None
    vendor: Optional[str] = None
    method: Optional[str] = None
    grp: Optional[str] = None
    sort: Optional[int] = None
    active: Optional[bool] = None


@router.get("/pay-items")
def list_pay_items(db: Session = Depends(get_db), _: User = Depends(_guard)):
    rows = db.query(OperationPayItem).order_by(OperationPayItem.sort, OperationPayItem.created_at).all()
    return ApiResponse(success=True, data=[_i_view(i) for i in rows])


@router.post("/pay-items")
def create_pay_item(body: PayItemBody, db: Session = Depends(get_db), _: User = Depends(_guard)):
    if not (body.category or "").strip():
        raise HTTPException(400, "항목명은 필수입니다.")
    max_sort = db.query(OperationPayItem).count()
    from app.services.operations_groups import infer_group
    i = OperationPayItem(section=body.section or "정기", category=body.category.strip(),
                         vendor=body.vendor, method=body.method,
                         grp=body.grp or infer_group(body.category, body.section or ""),
                         sort=body.sort if body.sort is not None else max_sort)
    db.add(i)
    db.commit()
    return ApiResponse(success=True, data=_i_view(i))


@router.put("/pay-items/{iid}")
def update_pay_item(iid: str, body: PayItemBody, db: Session = Depends(get_db), _: User = Depends(_guard)):
    i = db.query(OperationPayItem).filter(OperationPayItem.id == iid).first()
    if not i:
        raise HTTPException(404, "항목을 찾을 수 없습니다.")
    for f in ("section", "category", "vendor", "method", "grp", "sort", "active"):
        v = getattr(body, f)
        if v is not None:
            setattr(i, f, v)
    db.commit()
    return ApiResponse(success=True, data=_i_view(i))


@router.delete("/pay-items/{iid}")
def delete_pay_item(iid: str, db: Session = Depends(get_db), user: User = Depends(_guard)):
    if not _is_admin(user):
        raise HTTPException(403, "삭제는 ADMIN만 가능합니다.")
    db.query(OperationPayment).filter(OperationPayment.item_id == iid).delete()
    db.query(OperationPayItem).filter(OperationPayItem.id == iid).delete()
    db.commit()
    return ApiResponse(success=True, data={"deleted": iid})


@router.get("/payments")
def list_payments(year: int, db: Session = Depends(get_db), _: User = Depends(_guard)):
    rows = (db.query(OperationPayment)
              .filter(OperationPayment.year_month.like(f"{year}-%"))
              .order_by(OperationPayment.created_at).all())
    out: dict = {}
    for p in rows:
        out.setdefault(p.item_id, {}).setdefault(p.year_month, []).append(
            {"id": p.id, "amount": p.amount, "paid_on": p.paid_on, "note": p.note})
    return ApiResponse(success=True, data=out)


class PaymentBody(BaseModel):
    item_id: Optional[str] = None
    year_month: Optional[str] = None
    amount: Optional[int] = None
    paid_on: Optional[str] = None
    note: Optional[str] = None


@router.post("/payments")
def create_payment(body: PaymentBody, db: Session = Depends(get_db), user: User = Depends(_guard)):
    if not body.item_id or not body.year_month or body.amount is None:
        raise HTTPException(400, "item_id·year_month·amount는 필수입니다.")
    p = OperationPayment(item_id=body.item_id, year_month=body.year_month,
                         amount=body.amount, paid_on=body.paid_on, note=body.note,
                         created_by=getattr(user, "name", None))
    db.add(p)
    db.commit()
    return ApiResponse(success=True, data={"id": p.id})


@router.put("/payments/{pid}")
def update_payment(pid: str, body: PaymentBody, db: Session = Depends(get_db), _: User = Depends(_guard)):
    p = db.query(OperationPayment).filter(OperationPayment.id == pid).first()
    if not p:
        raise HTTPException(404, "납부 기록을 찾을 수 없습니다.")
    for f in ("amount", "paid_on", "note", "year_month"):
        v = getattr(body, f)
        if v is not None:
            setattr(p, f, v)
    db.commit()
    return ApiResponse(success=True, data={"id": p.id})


@router.delete("/payments/{pid}")
def delete_payment(pid: str, db: Session = Depends(get_db), _: User = Depends(_guard)):
    db.query(OperationPayment).filter(OperationPayment.id == pid).delete()
    db.commit()
    return ApiResponse(success=True, data={"deleted": pid})


# ── 지출결의 연동 ───────────────────────────────────────────────────────────
# 최종 승인·지급된 지출결의 건을 납부 대장으로 끌어온다 — 이중 입력 제거.

@router.get("/expense-candidates")
def expense_candidates(year: int, db: Session = Depends(get_db), _: User = Depends(_guard)):
    """아직 납부 대장에 안 들어간 승인 지출결의 목록 (해당 연도)."""
    from app.models.expense import ExpenseRequest
    linked = {e for (e,) in db.query(OperationPayment.expense_id)
              .filter(OperationPayment.expense_id.isnot(None)).all()}
    rows = (db.query(ExpenseRequest)
              .filter(ExpenseRequest.status == "approved")
              .order_by(ExpenseRequest.approved_at.desc().nullslast())
              .limit(300).all())
    out = []
    for r in rows:
        if r.id in linked:
            continue
        base_dt = r.paid_at or r.approved_at or r.created_at
        ym = base_dt.strftime("%Y-%m") if base_dt else None
        if not ym or not ym.startswith(str(year)):
            continue
        out.append({
            "id": r.id, "title": r.title, "amount": r.amount, "vendor": r.vendor,
            "category": r.category, "payment_method": r.payment_method,
            "year_month": ym,
            "paid_on": (r.paid_at or r.approved_at).astimezone(KST_OP).strftime("%m.%d") if (r.paid_at or r.approved_at) else "",
            "paid": r.paid_at is not None,
            "requester": r.requester_name,
        })
    return ApiResponse(success=True, data=out)


@router.get("/expense-matrix")
def expense_matrix(year: int, db: Session = Depends(get_db), _: User = Depends(_guard)):
    """승인된 지출결의를 계정과목×월로 집계 — 납부 대장 아래 '계약 외 운영 지출'로 그대로 보여준다.

    수동으로 대장에 가져간 건(expense_id 연동)은 이중 집계를 막기 위해 뺀다.
    """
    from app.models.expense import ExpenseRequest
    linked = {e for (e,) in db.query(OperationPayment.expense_id)
              .filter(OperationPayment.expense_id.isnot(None)).all()}
    rows = (db.query(ExpenseRequest)
              .filter(ExpenseRequest.status == "approved").all())
    out: dict = {}
    for r in rows:
        if r.id in linked:
            continue
        base_dt = r.paid_at or r.approved_at or r.created_at
        if not base_dt:
            continue
        ym = base_dt.astimezone(KST_OP).strftime("%Y-%m")
        if not ym.startswith(str(year)):
            continue
        cat = r.category or "기타"
        cell = out.setdefault(cat, {}).setdefault(ym, {"amount": 0, "count": 0})
        cell["amount"] += r.amount or 0
        cell["count"] += 1
    data = [{"category": c, "months": mm,
             "total": sum(v["amount"] for v in mm.values())}
            for c, mm in out.items()]
    data.sort(key=lambda x: -x["total"])
    return ApiResponse(success=True, data=data)


class ImportExpenseBody(BaseModel):
    expense_id: str
    item_id: str
    year_month: Optional[str] = None
    paid_on: Optional[str] = None


@router.post("/import-expense")
def import_expense(body: ImportExpenseBody, db: Session = Depends(get_db), user: User = Depends(_guard)):
    from app.models.expense import ExpenseRequest
    r = db.query(ExpenseRequest).filter(ExpenseRequest.id == body.expense_id).first()
    if not r:
        raise HTTPException(404, "지출결의 건을 찾을 수 없습니다.")
    if r.status != "approved":
        raise HTTPException(409, "최종 승인된 건만 가져올 수 있습니다.")
    if db.query(OperationPayment).filter(OperationPayment.expense_id == r.id).first():
        raise HTTPException(409, "이미 납부 대장에 들어간 건입니다.")
    item = db.query(OperationPayItem).filter(OperationPayItem.id == body.item_id).first()
    if not item:
        raise HTTPException(404, "납부 항목을 찾을 수 없습니다.")
    base_dt = r.paid_at or r.approved_at or r.created_at
    ym = body.year_month or (base_dt.strftime("%Y-%m") if base_dt else None)
    if not ym:
        raise HTTPException(400, "year_month를 지정해주세요.")
    p2 = OperationPayment(
        item_id=item.id, year_month=ym, amount=r.amount or 0,
        paid_on=body.paid_on or (base_dt.astimezone(KST_OP).strftime("%m.%d") if base_dt else None),
        note=f"지출결의 · {r.title[:60]}", expense_id=r.id,
        created_by=getattr(user, "name", None))
    db.add(p2)
    db.commit()
    return ApiResponse(success=True, data={"id": p2.id, "year_month": ym, "amount": p2.amount})


# ── 엑셀 이관 시드 (1회) ────────────────────────────────────────────────────

@router.post("/seed")
def seed_from_excel(db: Session = Depends(get_db), user: User = Depends(_guard)):
    """2026 수기 엑셀 데이터 1회 이관 — 비어 있을 때만, ADMIN 전용."""
    if not _is_admin(user):
        raise HTTPException(403, "시드는 ADMIN만 실행할 수 있습니다.")
    if db.query(OperationContract).count() or db.query(OperationPayItem).count():
        raise HTTPException(409, "이미 데이터가 있어 시드를 건너뜁니다.")
    from app.services.operations_seed import SEED
    for i, c in enumerate(SEED["contracts"]):
        db.add(OperationContract(sort=i, updated_by="엑셀 이관", **c))
    item_ids = []
    for it in SEED["items"]:
        row = OperationPayItem(**it)
        db.add(row)
        db.flush()
        item_ids.append(row.id)
    for p in SEED["payments"]:
        db.add(OperationPayment(item_id=item_ids[p["item"]], year_month=p["ym"],
                                amount=p["amount"], paid_on=p.get("paid_on"),
                                created_by="엑셀 이관"))
    db.commit()
    return ApiResponse(success=True, data={
        "contracts": len(SEED["contracts"]), "items": len(SEED["items"]),
        "payments": len(SEED["payments"])})


@router.get("/missing-pay-items")
def missing_pay_items(db: Session = Depends(get_db), _: User = Depends(_guard)):
    """계약 대장에는 있는데 납부 대장에 없는 계약들.

    연동이 없던 시절에 넣은 계약들이 여기에 잡힌다.
    """
    linked = {i.contract_id for i in
              db.query(OperationPayItem).filter(OperationPayItem.contract_id.isnot(None)).all()}
    rows = (db.query(OperationContract)
              .filter(OperationContract.active == True)             # noqa: E712
              .order_by(OperationContract.sort, OperationContract.created_at).all())
    out = [c for c in rows if _payable(c.section) and c.id not in linked]
    # 이름·업체가 같은 항목이 이미 손으로 들어가 있으면 중복이므로 뺀다
    have = {((i.category or "").strip(), (i.vendor or "").strip())
            for i in db.query(OperationPayItem).all()}
    out = [c for c in out
           if ((c.category or "").strip(), (c.vendor or "").strip()) not in have]
    for c in out:
        c._on_ledger = False
    return ApiResponse(success=True, data=[_c_view(c) for c in out])


@router.post("/sync-pay-items")
def sync_pay_items(db: Session = Depends(get_db), user: User = Depends(_guard)):
    """빠져 있는 계약을 납부 대장에 한 번에 올린다."""
    res = missing_pay_items(db=db, _=user)
    ids = [c["id"] for c in res.data]
    added = []
    for cid in ids:
        c = db.query(OperationContract).filter(OperationContract.id == cid).first()
        if c and _sync_pay_item(db, c, want=True):
            added.append(c.category)
    db.commit()
    return ApiResponse(success=True, data={"added": len(added), "names": added[:20]},
                       message=f"{len(added)}건을 납부 대장에 올렸습니다.")
