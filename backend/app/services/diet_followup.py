"""식이가 바뀌면 할 일을 한 줄 만든다.

■ 언제 만드는가

  실제로 드시는 것이 달라졌을 때만. 같은 값을 다시 적은 것(사유만 고친 경우
  등)에는 만들지 않는다 — 할 일이 아닌 줄이 쌓이면 목록을 아무도 안 보게 된다.

■ 이미 열려 있는 것이 있으면

  더 만들지 않고 그 줄을 최신 값으로 고친다. 죽 → 미음 → 다진식으로 사흘
  연달아 바뀌면 할 일은 여전히 하나다. 욕구사정도 계획서도 한 번만 쓰면 된다.
  다만 '무엇에서 무엇으로' 는 처음 값과 마지막 값으로 남겨야 한다.

■ 이름 짓기

  화면·종이에 같은 말이 나가도록 라벨을 여기서 만든다. 경관식은 밥·반찬을
  고르지 않으므로 그 한 단어로 끝난다.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.diet_followup import DietFollowUp
from app.services import diet_state as ds


def label_of(st: Optional[Dict[str, Any]]) -> str:
    """식이 한 줄을 사람이 읽는 말로. 없으면 '미정'."""
    if not st:
        return "미정"
    if st.get("tube"):
        return "경관식"
    parts = [str(st.get("rice") or "").strip(), str(st.get("side") or "").strip()]
    out = " · ".join(p for p in parts if p)
    return out or "미정"


def changed(before: Optional[Dict[str, Any]], after: Optional[Dict[str, Any]]) -> bool:
    """실제로 드시는 것이 달라졌는가 — 사유(note)만 고친 것은 아니다."""
    def key(s: Optional[Dict[str, Any]]):
        s = s or {}
        if s.get("tube"):
            return ("tube",)
        return (str(s.get("rice") or ""), str(s.get("side") or ""))
    return key(before) != key(after)


def open_for_change(db: Session, *, resident, change, before: Optional[Dict[str, Any]],
                    after: Dict[str, Any], who: Optional[str]) -> Optional[DietFollowUp]:
    """식이 변경 한 건에 딸린 할 일을 연다.

    돌려주는 것: 새로 만들었거나 고친 줄. 만들 일이 없으면 None.

    여기서 예외가 나도 식이 변경 자체는 살아야 한다 — 부르는 쪽이 감싼다.
    """
    if not changed(before, after):
        return None

    before_label, after_label = label_of(before), label_of(after)

    # 아직 안 끝난 것이 있으면 그 줄을 이어 쓴다. 사흘 연달아 바뀌어도 할 일은 하나다.
    cur = (db.query(DietFollowUp)
           .filter(DietFollowUp.resident_id == resident.id,
                   DietFollowUp.done_at.is_(None))
           .order_by(DietFollowUp.created_at.asc())
           .first())
    if cur:
        # '무엇에서' 는 처음 값을 지키고, '무엇으로' 만 최신으로 민다
        cur.after_label = after_label
        cur.effective_date = change.effective_date
        cur.change_id = change.id
        cur.note = (change.note or None)
        cur.floor = getattr(resident, "floor", None)
        cur.room = getattr(resident, "room", None)
        cur.resident_name = resident.name
        return cur

    f = DietFollowUp(
        change_id=change.id,
        resident_id=resident.id,
        resident_name=resident.name,
        floor=getattr(resident, "floor", None),
        room=getattr(resident, "room", None),
        effective_date=change.effective_date,
        before_label=before_label,
        after_label=after_label,
        note=(change.note or None),
        created_by=who,
    )
    db.add(f)
    return f


def state_before(db: Session, resident_id: str, on: str,
                 exclude_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """그 날짜 기준, 이번 변경을 빼고 본 직전 식이.

    이번에 넣은 줄을 빼고 계산해야 '무엇에서' 가 나온다. 안 빼면 방금 넣은
    값이 그대로 나와 '일반식 → 일반식' 이 된다.
    """
    from app.models.resident_diet import DietChange
    rows: List[Dict[str, Any]] = []
    for c in db.query(DietChange).filter(DietChange.resident_id == resident_id).all():
        if exclude_id and c.id == exclude_id:
            continue
        rows.append({
            "effective_date": c.effective_date, "rice": c.rice, "side": c.side,
            "tube": bool(c.tube),
            "created_at": c.created_at.isoformat() if c.created_at else "",
        })
    return ds.state_at(rows, on)
