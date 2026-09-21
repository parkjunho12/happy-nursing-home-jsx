"""입소 상담 기록 — 전화를 받으면서 그대로 채우는 한 장.

■ 왜 화면에 두는가

  지금은 받아 적는다. 종이에 적으면 그 종이를 쥔 사람만 알고, 며칠 뒤
  보호자가 다시 전화했을 때 지난번에 무엇을 여쭸는지 아무도 모른다.
  그러면 같은 것을 또 여쭙게 되고, 보호자는 그때 시설을 다시 본다.

  받아 적는 순서가 화면에 있으면 처음 전화를 받는 사람도 빠뜨리지 않는다.
  등급·본인부담률처럼 비용과 직결되는 것을 안 여쭤보면 나중에 입소 직전에
  다시 연락해야 한다.

■ 무엇을 담는가

  어르신 건강 상태가 적히는 표다. 전화 한 통에서 알 수 있는 만큼만 담고,
  다 못 채워도 저장된다 — 통화 중에 필수 항목 때문에 막히면 그 순간
  보호자를 기다리게 한다. 무엇이 비었는지는 화면이 알려준다.

■ 주민등록번호는 담지 않는다

  상담 단계에서 필요하지 않다. 입소가 정해지면 그때 입소 서류에서 받는다.
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Text, Integer, DateTime, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 진행 상태 — 상담 뒤에 무엇을 해야 하는지가 보이게
ST_OPEN = "open"          # 상담함 — 아직 결과가 정해지지 않음
ST_VISIT = "visit"        # 시설 방문·견학 예정
ST_ADMIT = "admit"        # 입소 예정
ST_DONE = "done"          # 입소 완료
ST_DROP = "drop"          # 종결 (타 시설·보류·연락 끊김)

STATUSES = [ST_OPEN, ST_VISIT, ST_ADMIT, ST_DONE, ST_DROP]


class Consult(Base):
    """상담 한 건. 항목 하나하나가 통화에서 여쭙는 순서 그대로다."""

    __tablename__ = "consults"
    __table_args__ = (
        Index("ix_consult_date", "consulted_on", "status"),
    )

    id = Column(String, primary_key=True, default=_uuid)

    # ── 상담 개요 ──
    consulted_on = Column(String(10), nullable=False, index=True)   # 'YYYY-MM-DD'
    consulted_at = Column(String(5), nullable=True)                 # 'HH:MM'
    counselor = Column(String(50), nullable=True)                   # 상담자
    route = Column(String(30), nullable=True)                       # 상담 경로
    method = Column(String(20), nullable=True)                      # 상담 방법
    caller = Column(String(50), nullable=True)                      # 상담하신 분 (보호자 본인이 아닐 수 있다)

    # ── 어르신 ──
    resident_name = Column(String(50), nullable=True)
    gender = Column(String(10), nullable=True)
    age = Column(Integer, nullable=True)
    height_cm = Column(String(10), nullable=True)
    weight_kg = Column(String(10), nullable=True)
    living = Column(String(40), nullable=True)                      # 현재 거주 상황
    living_note = Column(String(200), nullable=True)

    # ── 요양등급 · 비용 ──
    # 등급과 급여 종류와 본인부담률은 서로 다른 것이다. 한 칸에 몰아 적으면
    # 나중에 '시설급여 신청중이었나, 재가였나' 를 알 수 없다.
    grade = Column(String(20), nullable=True)                       # 1~5등급·인지지원·등급외·신청중·모름
    benefit = Column(String(20), nullable=True)                     # 시설급여·재가급여·등급외자·신청중·모름
    copay = Column(String(20), nullable=True)                       # 일반·감경 12%·감경 8%·기초수급자·모름
    grade_note = Column(String(200), nullable=True)                 # 인정번호·유효기간 등

    # ── 건강 상태 ──
    diagnosis = Column(Text, nullable=True)                         # 진단명
    behavior = Column(Text, nullable=True)                          # 심리상황·정신행동 양상
    sleep = Column(String(200), nullable=True)                      # 수면상태
    hearing = Column(String(40), nullable=True)                     # 청각기능
    hearing_aid = Column(String(20), nullable=True)                 # 보청기 사용 여부
    vision = Column(String(40), nullable=True)                      # 시각기능
    glasses = Column(String(20), nullable=True)                     # 안경 착용 여부
    speech = Column(String(40), nullable=True)                      # 언어능력
    mobility = Column(String(40), nullable=True)                    # 보행 능력
    toileting = Column(String(40), nullable=True)                   # 대소변
    eating = Column(String(40), nullable=True)                      # 식사
    diet = Column(String(40), nullable=True)                        # 식사 종류
    health_note = Column(Text, nullable=True)                       # 건강 관련 덧붙임

    # ── 보호자 · 가족 ──
    children = Column(String(40), nullable=True)                    # 자녀 여부
    guardian_name = Column(String(50), nullable=True)
    guardian_relation = Column(String(30), nullable=True)
    guardian_phone = Column(String(30), nullable=True)
    address = Column(String(200), nullable=True)

    # ── 진행 ──
    checkup = Column(String(40), nullable=True)                     # 건강검진 연계
    checkup_note = Column(String(200), nullable=True)               # 검진기관·일자
    wish_date = Column(String(10), nullable=True)                   # 희망 입소일 'YYYY-MM-DD'
    notes = Column(Text, nullable=True)                             # 특이사항
    # 안내한 것 — 월 비용·준비물처럼 통화에서 설명한 내용을 적어 둔다.
    # 다음에 전화가 오면 '지난번에 어디까지 말씀드렸는지' 가 여기 있다.
    guided = Column(Text, nullable=True)

    # ── 부부 상담 ──
    #
    # 부부는 한 통화에서 두 분을 상담한다. 그래도 기록은 한 분에 한 장이다.
    # 등급·건강 상태가 사람마다 다르고 급여 청구도 사람 단위로 나간다.
    # 무엇보다 한 분만 입소하게 되는 경우가 잦은데, 한 장에 섞어 적으면
    # 그때 기록을 쪼갤 수가 없다.
    #
    # 두 장을 서로 가리키게 해서 묶는다(A.partner_id=B, B.partner_id=A).
    partner_id = Column(String, nullable=True, index=True)
    # 아래 둘은 두 분에게 공통인 사실이라 짝에도 같이 적는다(엔드포인트가 맞춘다).
    couple_room = Column(String(30), nullable=True)      # 같은 방 희망 여부
    cost_guided = Column(String(40), nullable=True)      # 두 분 합산 금액 안내 여부

    status = Column(String(12), nullable=False, default=ST_OPEN, index=True)
    followup_on = Column(String(10), nullable=True, index=True)     # 다음 연락 예정일

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
