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
RECURRING_FREQS = {'daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly',
                   'weekly_dow', 'monthly_day', 'monthly_nth_dow'}
EVENT_FREQS     = {'on_admission', 'on_discharge', 'on_hire'}
ONE_TIME_FREQ   = 'one_time'

# frequency 표기 흔들림 정규화 (예: 'half_yearly' → 'half-yearly')
_FREQ_ALIASES = {
    'half_yearly': 'half-yearly', 'halfyearly': 'half-yearly',
    'semiannual': 'half-yearly', 'semi_annual': 'half-yearly',
    'half-year': 'half-yearly', 'biannual': 'half-yearly',
}
def canon_freq(freq):
    if not freq:
        return freq
    k = str(freq).strip()
    return _FREQ_ALIASES.get(k, _FREQ_ALIASES.get(k.lower(), k))

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

def cfg_from_item(item) -> dict:
    """ChecklistItem에서 반복 세부 설정을 dict로 추출 (컬럼 없을 수 있어 안전 처리)"""
    return {
        'weekday':       getattr(item, 'recur_weekday', None),
        'week_of_month': getattr(item, 'recur_week_of_month', None),
        'day':           getattr(item, 'recur_day', None),
        'due_day':       getattr(item, 'recur_due_day', None),
    }


def _clamp_day(year: int, month: int, day: int) -> date:
    """day가 해당 월 말일을 넘으면 말일로 보정"""
    if month == 12:
        last = 31
    else:
        last = (date(year, month + 1, 1) - timedelta(days=1)).day
    return date(year, month, max(1, min(day, last)))


def _week_start_sunday(d: date) -> date:
    """d가 속한 주의 일요일 (일~토 기준)"""
    return d - timedelta(days=d.isoweekday() % 7)


def _nth_weekday_of_month(year: int, month: int, weekday: int, n: int) -> date:
    """
    그 달의 n번째 weekday(0=일..6=토) 날짜.
    n>=5(또는 해당 주가 없으면) 마지막 weekday 반환.
    """
    weekday = weekday % 7
    first = date(year, month, 1)
    first_dow = first.isoweekday() % 7  # 0=일
    offset = (weekday - first_dow) % 7
    day = 1 + offset + (max(1, n) - 1) * 7
    # 월 말일 초과 시 마지막 발생일로
    if month == 12:
        last_day = 31
    else:
        last_day = (date(year, month + 1, 1) - timedelta(days=1)).day
    while day > last_day:
        day -= 7
    return date(year, month, day)


def get_period_key(freq: str, d: date, cfg: Optional[dict] = None) -> str:
    cfg = cfg or {}
    freq = canon_freq(freq)
    if freq == 'weekly_dow':
        # 매주 특정 요일 → 그 주의 해당 요일 날짜를 key로 (주마다 유일)
        wd = cfg.get('weekday')
        wd = 0 if wd is None else int(wd)
        target = _week_start_sunday(d) + timedelta(days=wd % 7)
        return target.isoformat()
    if freq in ('monthly_day', 'monthly_nth_dow'):
        # 매월 1개 → 월 단위 key
        return f"{d.year}-{d.month:02d}"
    if freq == 'daily':
        return d.isoformat()
    if freq == 'weekly':
        # 일요일 시작 기준 (일~토)
        day_of_week = d.isoweekday() % 7   # 일=0, 월=1, ..., 토=6
        sunday      = d - timedelta(days=day_of_week)
        jan1        = date(sunday.year, 1, 1)
        jan1_dow    = jan1.isoweekday() % 7
        week_num    = ((sunday - jan1).days + jan1_dow) // 7 + 1
        return f"{sunday.year}-W{week_num:02d}" 
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
    if freq == 'one_time':
        return d.isoformat()   # 기한 날짜를 key로
    return d.isoformat()   # 이벤트성


def get_period_bounds(freq: str, d: date, cfg: Optional[dict] = None) -> Tuple[date, date]:
    """주기의 (시작일, 마감일) 반환"""
    cfg = cfg or {}
    freq = canon_freq(freq)

    if freq == 'weekly_dow':
        wd = cfg.get('weekday')
        wd = 0 if wd is None else int(wd)
        target = _week_start_sunday(d) + timedelta(days=wd % 7)
        return target, target   # 지정 요일 당일

    if freq == 'monthly_day':
        start_day = cfg.get('day') or 1
        due_day   = cfg.get('due_day') or start_day
        start = _clamp_day(d.year, d.month, int(start_day))
        due   = _clamp_day(d.year, d.month, int(due_day))
        if due < start:
            due = start
        return start, due

    if freq == 'monthly_nth_dow':
        wd = cfg.get('weekday')
        wd = 1 if wd is None else int(wd)   # 기본 월요일 방어값
        n  = cfg.get('week_of_month') or 1
        target = _nth_weekday_of_month(d.year, d.month, wd, int(n))
        return target, target

    if freq == 'daily':
        return d, d

    if freq == 'weekly':
        # 일요일 시작 기준
        day_of_week = d.isoweekday() % 7  # 일=0
        start = d - timedelta(days=day_of_week)  # 이 주 일요일
        return start, start + timedelta(days=6)   # ~ 토요일

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


def _period_start_dates(freq: str, from_date: date, to_date: date, cfg: Optional[dict] = None) -> List[date]:
    """
    from_date ~ to_date 사이에 해당하는 모든 주기 시작일 목록 반환.
    각 주기마다 occurrence 1개를 만들기 위한 대표 날짜.
    """
    cfg = cfg or {}
    freq = canon_freq(freq)
    starts: List[date] = []

    if freq == 'weekly_dow':
        wd = cfg.get('weekday')
        wd = 0 if wd is None else int(wd)
        cur = _week_start_sunday(from_date)
        while cur <= to_date:
            target = cur + timedelta(days=wd % 7)
            if from_date <= target <= to_date:
                starts.append(target)
            cur += timedelta(weeks=1)
        return starts

    if freq in ('monthly_day', 'monthly_nth_dow'):
        # 매월 1개 — 대표 날짜는 각 달 1일 (key/bounds는 cfg로 계산)
        cur = date(from_date.year, from_date.month, 1)
        while cur <= to_date:
            starts.append(cur)
            if cur.month == 12:
                cur = date(cur.year + 1, 1, 1)
            else:
                cur = date(cur.year, cur.month + 1, 1)
        return starts

    if freq == 'daily':
        # 일일: 날짜 하나하나
        cur = from_date
        while cur <= to_date:
            starts.append(cur)
            cur += timedelta(days=1)
        return starts

    if freq == 'weekly':
        # 일요일 시작 기준
        day_of_week = from_date.isoweekday() % 7  # 일=0
        cur = from_date - timedelta(days=day_of_week)  # from_date가 속한 주의 일요일
        while cur <= to_date:
            # 이 주의 일요일이 from_date 이전이어도 토요일이 from_date 이후면 포함
            if cur + timedelta(days=6) >= from_date:
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

def reconcile_occurrences(db: Session, item) -> int:
    """한 항목의 occurrence를 '정규 주기키'로 재정렬하고 중복을 제거한다.
    (frequency 표기 변화 등으로 옛 키/중복이 생겨 완료가 미완료로 보이는 문제 해결)
    같은 주기키가 여러 개면 완료 > 지남 > 대기 우선으로 하나만 남긴다. 삭제 수 반환.
    """
    occs = db.query(ChecklistOccurrence).filter(
        ChecklistOccurrence.checklist_item_id == item.id
    ).all()
    if len(occs) <= 1:
        return 0

    freq = canon_freq(item.frequency)
    if freq not in RECURRING_FREQS and freq != ONE_TIME:
        return 0
    cfg = cfg_from_item(item)

    # 1) 정규 키로 재키
    for o in occs:
        base_s = (o.scheduled_date or o.due_date or "")[:10]
        try:
            base = date.fromisoformat(base_s)
            ck = get_period_key(freq, base, cfg)
        except Exception:
            continue
        if ck and o.period_key != ck:
            o.period_key = ck
        if o.frequency != freq:
            o.frequency = freq

    # 2) 같은 키 중복 제거 (완료 우선)
    RANK = {"completed": 0, "overdue": 1, "pending": 2}
    best: dict = {}
    deleted = 0
    for o in occs:
        k = o.period_key
        cur = best.get(k)
        if cur is None:
            best[k] = o
            continue
        if RANK.get(o.status, 3) < RANK.get(cur.status, 3):
            db.delete(cur); best[k] = o
        else:
            db.delete(o)
        deleted += 1
    return deleted


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

    cfg = cfg_from_item(item)
    freq = canon_freq(item.frequency)
    period_key = get_period_key(freq, target_date, cfg)
    scheduled, due = get_period_bounds(freq, target_date, cfg)

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
        frequency=freq,
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
        freq = canon_freq(item.frequency)
        item_existing = existing.get(item.id, set())

        # ── 일회성 (one_time) ─────────────────────────────────────────
        if freq == ONE_TIME_FREQ:
            if item_existing:
                continue  # 이미 생성됨
            # item.due_date가 기한, 없으면 생성일
            if hasattr(item, 'due_date') and item.due_date:
                due_date_str = item.due_date
                due_d = date.fromisoformat(due_date_str)
            else:
                due_d = to_kst_date(item.created_at) if item.created_at else today
                due_date_str = due_d.isoformat()
            created_date = to_kst_date(item.created_at) if item.created_at else today
            period_key   = due_date_str   # 기한 날짜를 period_key로
            status       = 'overdue' if due_d < today else 'pending'
            new_occs.append(ChecklistOccurrence(
                id=str(uuid.uuid4()),
                checklist_item_id=item.id,
                period_key=period_key,
                frequency=freq,
                scheduled_date=created_date.isoformat(),
                due_date=due_date_str,
                status=status,
            ))
            created += 1
            continue

        # ── 이벤트성 ──────────────────────────────────────────────────
        if freq in EVENT_FREQS:
            # 이미 occurrence가 1개라도 있으면 스킵
            if item_existing:
                continue
            # 없으면 생성일 기준으로 1개만 생성
            created_date = to_kst_date(item.created_at) if item.created_at else today
            period_key = get_period_key(freq, created_date)
            scheduled, due = get_period_bounds(freq, created_date)  # 이벤트성: cfg 불필요
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
            continue  # 위에서 처리 안 된 알 수 없는 frequency는 스킵

        # 시작일: created_at 날짜 (단, 일일은 최대 90일 전까지)
        created_date = to_kst_date(item.created_at) if item.created_at else today
        if freq == 'daily':
            cutoff = today - timedelta(days=DAILY_BACKFILL_LIMIT)
            from_date = max(created_date, cutoff)
        else:
            from_date = created_date

        # 각 주기 시작일 목록 순회
        cfg = cfg_from_item(item)
        for period_start in _period_start_dates(freq, from_date, today, cfg):
            period_key = get_period_key(freq, period_start, cfg)

            if period_key in item_existing:
                continue   # 이미 있음

            scheduled, due = get_period_bounds(freq, period_start, cfg)
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
