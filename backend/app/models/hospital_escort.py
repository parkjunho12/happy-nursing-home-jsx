"""병원동행 요청 — 간호팀이 올리고, 복지팀이 업체에 전달한다.

■ 왜 화면에 두는가

  지금은 말로 전한다. 말로 전하면 '휠체어 쓰신다고 했나' 를 나중에 아무도
  확인할 수 없고, 이동수단이 어르신 상태와 안 맞게 잡히면 그날 병원 앞에서
  문제가 된다. 누가 무엇을 언제 전했는지가 남아야 한다.

■ 단계

  ① 간호팀이 어르신 상태(보행·편마비·휠체어·주의사항)와 진료 일정을 적는다
  ② 부서 톡방에 공유한다 — 붙여넣을 글은 화면이 만들어 준다
  ③ 복지팀이 그 내용을 병원동행업체에 전달한다
  ④ 이동수단은 보호자와 업체가 협의해 정한다 — 시설이 임의로 정하지 않는다
  ⑤ 정해진 이동수단을 다시 톡방에 공유한다

  각 단계에 누가·언제가 함께 남는다.
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Text, DateTime, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 진행 단계
ST_DRAFT = "draft"        # 간호팀 작성 — 아직 톡방에 안 올림
ST_SHARED = "shared"      # 부서 톡방에 공유함
ST_SENT = "sent"          # 복지팀이 업체에 전달함
ST_DECIDED = "decided"    # 이동수단 확정 (보호자·업체 협의 결과)
ST_DONE = "done"          # 동행 완료
ST_CANCELED = "canceled"  # 취소 (진료 연기·보호자 동행 등)

STATUS_ORDER = [ST_DRAFT, ST_SHARED, ST_SENT, ST_DECIDED, ST_DONE]

WALKING = ["가능", "부축 필요", "불가"]
HEMIPLEGIA = ["없음", "있음"]
WHEELCHAIR = ["미사용", "사용"]


class HospitalEscort(Base):
    __tablename__ = "hospital_escorts"
    __table_args__ = (
        Index("ix_escort_visit", "visit_date", "status"),
    )

    id = Column(String, primary_key=True, default=_uuid)

    # 누구
    resident_id = Column(String, nullable=True, index=True)
    resident_name = Column(String(100), nullable=False)
    floor = Column(String(20), nullable=True)
    room = Column(String(10), nullable=True)

    # 간호팀이 확인해 적는 것 — 이동수단을 정하는 근거가 된다
    walking = Column(String(10), nullable=True)        # 가능 · 부축 필요 · 불가
    hemiplegia = Column(String(10), nullable=True)     # 있음 · 없음
    wheelchair = Column(String(10), nullable=True)     # 사용 · 미사용
    notes = Column(Text, nullable=True)                # 특이사항 · 이동 시 주의사항

    # 진료
    hospital = Column(String(120), nullable=False)
    department = Column(String(60), nullable=True)     # 진료과
    visit_date = Column(String(10), nullable=False)    # 'YYYY-MM-DD'
    visit_time = Column(String(5), nullable=True)      # 'HH:MM'

    status = Column(String(12), nullable=False, default=ST_DRAFT, index=True)

    # 부서 톡방 공유
    shared_at = Column(DateTime(timezone=True), nullable=True)
    shared_by = Column(String(100), nullable=True)

    # 복지팀 → 업체
    vendor = Column(String(120), nullable=True)        # 병원동행업체
    sent_at = Column(DateTime(timezone=True), nullable=True)
    sent_by = Column(String(100), nullable=True)

    # 이동수단 — 시설이 정하지 않는다. 보호자·업체가 협의한 결과를 적는다.
    transport = Column(String(120), nullable=True)
    transport_note = Column(Text, nullable=True)       # 협의 내용
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decided_by = Column(String(100), nullable=True)

    done_at = Column(DateTime(timezone=True), nullable=True)
    done_by = Column(String(100), nullable=True)
    cancel_reason = Column(String(200), nullable=True)

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class HospitalEscortLog(Base):
    """무엇을 누가 언제 했는가 — 구두로만 전하지 않기 위한 기록.

    상태 칸에도 시각이 남지만, 되돌리거나 두 번 전달한 일까지 남기려면
    줄로 쌓아야 한다. '분명히 전달했다' 와 '못 받았다' 가 갈릴 때 볼 것은
    이 목록이다.
    """
    __tablename__ = "hospital_escort_logs"

    id = Column(String, primary_key=True, default=_uuid)
    escort_id = Column(String, nullable=False, index=True)
    action = Column(String(20), nullable=False)   # create | share | send | decide | done | cancel | edit
    memo = Column(Text, nullable=True)
    actor = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
