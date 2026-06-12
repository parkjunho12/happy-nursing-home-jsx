"""
ChecklistOccurrence 서비스

핵심 책임:
1. get_or_create_occurrence — 특정 아이템의 특정 날짜 occurrence 조회/생성
2. backfill_occurrences     — created_at ~ 오늘까지 누락된 모든 주기 채워 넣기
3. mark_overdue             — 마감 지난 pending → overdue
4. complete / uncomplete    — 완료 처리

주기 생성 규칙:
  daily       → 매일 1개 (최대 90일 과거까지)
  weekly      → 매주 월요일 기준 1개
  monthly     → 매월 1일 기준 1개
  quarterly   → 분기 시작일 기준 1개 (1/4/7/10월)
  half-yearly → 반기 시작일 기준 1개 (1월, 7월)
  yearly      → 매년 1월 1일 기준 1개
  이벤트성    → 아이템 생성 시 딱 1개 (이후 중복 생성 없음)
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta, datetime, timezone
from typing import Optional, List, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.eval import ChecklistItem, ChecklistOccurrence

# ── 상수 ──────────────────────────────────────────────────────────────────
RECURRING_FREQS = {'daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'}
EVENT_FREQS     = {'on_admission', 'on_discharge', 'on_hire'}

# 일일 occurrence 최대 소급 일수 (너무 오래된 것까지 만들면 DB 부담)
DAILY_BACKFILL_LIMIT = 90

KST = timezone(timedelta(hours=9))

def today_kst() -> date:
    """서버 타임존에 관계없이 KST 기준 오늘 날짜를 반환"""
    return datetime.now(KST).date()


def to_kst_date(dt: datetime) -> date:
    """
    DB에서 꺼낸 datetime(timezone-aware or naive)을 KST 기준 date로 변환.
    naive datetime은 UTC로 가정.
    """
    if dt is None:
        return today_kst()
    if dt.tzinfo is None:
        # naive → UTC로 가정
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).date()



# ══════════════════════════════════════════════════════════════════════════════
# 주기 계산 유틸
# ══════════════════════════════════════════════════════════════════════════════

def get_period_key(freq: str, d: date) -> str:
    if freq == 'daily':
        return d.isoformat()
    if freq == 'weekly':
        year, week, _ = d.isocalendar()
        return f"{year}-W{week:02d}"
    if freq == 'monthly':
        return f"{d.year}-{d.month:02d}"
    if freq == 'quarterly':
        q = (d.month - 1) // 3 + 1
        return f"{d.year}-Q{q}"
    if freq == 'half-yearly':
        h = 1 if d.month <= 6 else 2
        return f"{d.year}-H{h}"
    if freq == 'yearly':
        return str(d.year)
    return d.isoformat()   # 이벤트성


def get_period_bounds(freq: str, d: date) -> Tuple[date, date]:
    """주기의 (시작일, 마감일) 반환"""
    if freq == 'daily':
        return d, d

    if freq == 'weekly':
        start = d - timedelta(days=d.weekday())   # 월요일
        return start, start + timedelta(days=6)

    if freq == 'monthly':
        start = date(d.year, d.month, 1)
        if d.month == 12:
            return start, date(d.year, 12, 31)
        return start, date(d.year, d.month + 1, 1) - timedelta(days=1)

    if freq == 'quarterly':
        q  = (d.month - 1) // 3
        sm = q * 3 + 1
        start = date(d.year, sm, 1)
        em = sm + 2
        if em == 12:
            return start, date(d.year, 12, 31)
        return start, date(d.year, em + 1, 1) - timedelta(days=1)

    if freq == 'half-yearly':
        if d.month <= 6:
            return date(d.year, 1, 1), date(d.year, 6, 30)
        return date(d.year, 7, 1), date(d.year, 12, 31)

    if freq == 'yearly':
        return date(d.year, 1, 1), date(d.year, 12, 31)

    return d, d   # 이벤트성


def _period_start_dates(freq: str, from_date: date, to_date: date) -> List[date]:
    """
    from_date ~ to_date 사이에 해당하는 모든 주기 시작일 목록 반환.
    각 주기마다 occurrence 1개를 만들기 위한 대표 날짜.
    """
    starts: List[date] = []

    if freq == 'daily':
        # 일일: 날짜 하나하나
        cur = from_date
        while cur <= to_date:
            starts.append(cur)
            cur += timedelta(days=1)
        return starts

    if freq == 'weekly':
        # 이번 주의 월요일부터 시작
        cur = from_date - timedelta(days=from_date.weekday())
        while cur <= to_date:
            if cur >= from_date or (cur + timedelta(days=6)) >= from_date:
                starts.append(cur)
            cur += timedelta(weeks=1)
        return starts

    if freq == 'monthly':
        cur = date(from_date.year, from_date.month, 1)
        while cur <= to_date:
            starts.append(cur)
            # 다음 달 1일
            if cur.month == 12:
                cur = date(cur.year + 1, 1, 1)
            else:
                cur = date(cur.year, cur.month + 1, 1)
        return starts

    if freq == 'quarterly':
        # 분기 시작월: 1, 4, 7, 10
        sm = ((from_date.month - 1) // 3) * 3 + 1
        cur = date(from_date.year, sm, 1)
        while cur <= to_date:
            starts.append(cur)
            nm = cur.month + 3
            if nm > 12:
                cur = date(cur.year + 1, nm - 12, 1)
            else:
                cur = date(cur.year, nm, 1)
        return starts

    if freq == 'half-yearly':
        # 반기 시작월: 1, 7
        sm = 1 if from_date.month <= 6 else 7
        cur = date(from_date.year, sm, 1)
        while cur <= to_date:
            starts.append(cur)
            nm = cur.month + 6
            if nm > 12:
                cur = date(cur.year + 1, nm - 12, 1)
            else:
                cur = date(cur.year, nm, 1)
        return starts

    if freq == 'yearly':
        cur = date(from_date.year, 1, 1)
        while cur <= to_date:
            starts.append(cur)
            cur = date(cur.year + 1, 1, 1)
        return starts

    return []


# ══════════════════════════════════════════════════════════════════════════════
# 핵심 함수
# ══════════════════════════════════════════════════════════════════════════════

def get_or_create_occurrence(
    db: Session,
    item: ChecklistItem,
    target_date: Optional[date] = None,
) -> ChecklistOccurrence:
    """
    특정 날짜 기준 occurrence 조회, 없으면 생성. 멱등.
    """
    if target_date is None:
        target_date = today_kst()

    period_key = get_period_key(item.frequency, target_date)
    scheduled, due = get_period_bounds(item.frequency, target_date)

    occ = db.query(ChecklistOccurrence).filter(
        ChecklistOccurrence.checklist_item_id == item.id,
        ChecklistOccurrence.period_key == period_key,
    ).first()

    if occ:
        return occ

    occ = ChecklistOccurrence(
        id=str(uuid.uuid4()),
        checklist_item_id=item.id,
        period_key=period_key,
        frequency=item.frequency,
        scheduled_date=scheduled.isoformat(),
        due_date=due.isoformat(),
        status='pending',
    )
    db.add(occ)
    db.flush()
    return occ


def backfill_occurrences(
    db: Session,
    item_ids: Optional[List[str]] = None,
) -> int:
    """
    각 체크리스트의 created_at부터 오늘까지 누락된 모든 주기 occurrence를 채워 넣는다.

    - 반복 주기(daily~yearly): 각 주기마다 1개씩 생성
    - 이벤트성(on_admission 등): 아이템 생성 시 1개만 (이미 있으면 스킵)
    - 일일은 최대 DAILY_BACKFILL_LIMIT일 전까지만 소급
    - 이미 있는 occurrence는 건너뜀 (멱등, 중복 없음)
    """
    today = today_kst()

    q = db.query(ChecklistItem).filter(ChecklistItem.active == True)
    if item_ids:
        q = q.filter(ChecklistItem.id.in_(item_ids))
    items = q.all()

    # 기존 occurrence period_key를 아이템별로 미리 조회 (N+1 방지)
    item_id_list = [i.id for i in items]
    existing_raw = db.query(
        ChecklistOccurrence.checklist_item_id,
        ChecklistOccurrence.period_key,
    ).filter(
        ChecklistOccurrence.checklist_item_id.in_(item_id_list)
    ).all()

    existing: dict[str, set[str]] = {}
    for item_id, period_key in existing_raw:
        existing.setdefault(item_id, set()).add(period_key)

    created = 0
    new_occs: List[ChecklistOccurrence] = []

    for item in items:
        freq = item.frequency
        item_existing = existing.get(item.id, set())

        # ── 이벤트성 ──────────────────────────────────────────────────
        if freq in EVENT_FREQS:
            # 이미 occurrence가 1개라도 있으면 스킵
            if item_existing:
                continue
            # 없으면 생성일 기준으로 1개만 생성
            created_date = to_kst_date(item.created_at) if item.created_at else today
            period_key = get_period_key(freq, created_date)
            scheduled, due = get_period_bounds(freq, created_date)
            new_occs.append(ChecklistOccurrence(
                id=str(uuid.uuid4()),
                checklist_item_id=item.id,
                period_key=period_key,
                frequency=freq,
                scheduled_date=scheduled.isoformat(),
                due_date=due.isoformat(),
                status='pending',
            ))
            created += 1
            continue

        # ── 반복 주기 ─────────────────────────────────────────────────
        if freq not in RECURRING_FREQS:
            continue

        # 시작일: created_at 날짜 (단, 일일은 최대 90일 전까지)
        created_date = to_kst_date(item.created_at) if item.created_at else today
        if freq == 'daily':
            cutoff = today - timedelta(days=DAILY_BACKFILL_LIMIT)
            from_date = max(created_date, cutoff)
        else:
            from_date = created_date

        # 각 주기 시작일 목록 순회
        for period_start in _period_start_dates(freq, from_date, today):
            period_key = get_period_key(freq, period_start)

            if period_key in item_existing:
                continue   # 이미 있음

            scheduled, due = get_period_bounds(freq, period_start)
            status = 'overdue' if due < today else 'pending'

            new_occs.append(ChecklistOccurrence(
                id=str(uuid.uuid4()),
                checklist_item_id=item.id,
                period_key=period_key,
                frequency=freq,
                scheduled_date=scheduled.isoformat(),
                due_date=due.isoformat(),
                status=status,   # 과거 주기는 바로 overdue로 생성
            ))
            item_existing.add(period_key)   # 같은 배치 내 중복 방지
            created += 1

    if new_occs:
        db.bulk_save_objects(new_occs)
        db.flush()

    return created


def mark_overdue(db: Session) -> int:
    """
    due_date < 오늘(KST)이고 status = 'pending'인 occurrence → 'overdue'
    updated_at도 KST datetime으로 설정
    """
    today = today_kst()
    now   = datetime.now(KST)
    result = db.execute(
        text("""
            UPDATE checklist_occurrences
            SET    status     = 'overdue',
                   updated_at = :now
            WHERE  status     = 'pending'
            AND    due_date   < :today
        """),
        {"today": today.isoformat(), "now": now},
    )
    db.flush()
    return result.rowcount


def complete_occurrence(
    db: Session,
    occurrence: ChecklistOccurrence,
    completed_date: str,
    memo: str = "",
    attachment_name: str = "",
) -> ChecklistOccurrence:
    occurrence.status          = 'completed'
    occurrence.completed_date  = completed_date
    occurrence.memo            = memo
    occurrence.attachment_name = attachment_name
    db.flush()
    return occurrence


def uncomplete_occurrence(
    db: Session,
    occurrence: ChecklistOccurrence,
) -> ChecklistOccurrence:
    today = today_kst()
    due   = date.fromisoformat(occurrence.due_date)
    occurrence.status          = 'overdue' if today > due else 'pending'
    occurrence.completed_date  = None
    occurrence.memo            = ""
    occurrence.attachment_name = ""
    db.flush()
    return occurrence


def get_occurrences_for_period(
    db: Session,
    period_key: str,
    domain_id: Optional[str] = None,
    person_id: Optional[str] = None,
) -> List[ChecklistOccurrence]:
    q = (
        db.query(ChecklistOccurrence)
        .join(ChecklistItem, ChecklistOccurrence.checklist_item_id == ChecklistItem.id)
        .filter(ChecklistOccurrence.period_key == period_key)
        .filter(ChecklistItem.active == True)
    )
    if domain_id:
        q = q.filter(ChecklistItem.related_domain_id == domain_id)
    if person_id:
        q = q.filter(ChecklistItem.person_id == person_id)
    return q.all()


def get_occurrences_due_in_range(
    db: Session,
    start: date,
    end: date,
    include_overdue: bool = True,
) -> List[ChecklistOccurrence]:
    q = (
        db.query(ChecklistOccurrence)
        .join(ChecklistItem, ChecklistOccurrence.checklist_item_id == ChecklistItem.id)
        .filter(ChecklistItem.active == True)
        .filter(ChecklistOccurrence.due_date >= start.isoformat())
        .filter(ChecklistOccurrence.due_date <= end.isoformat())
    )
    if not include_overdue:
        q = q.filter(ChecklistOccurrence.status != 'overdue')
    return q.all()
