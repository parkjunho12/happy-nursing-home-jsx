"""
네이버 광고 입찰가 변경 로그.
누가 / 언제 / 어떤 키워드를 / 얼마에서 얼마로 / 왜 바꿨는지 기록한다.
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Integer, Float, Text, DateTime, Boolean

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


class NaverAdBidChangeLog(Base):
    __tablename__ = "naver_ad_bid_change_logs"

    id                  = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    keyword_id          = Column(String, nullable=False, index=True)
    keyword             = Column(String, nullable=False)
    campaign_name       = Column(String, nullable=True)
    adgroup_name        = Column(String, nullable=True)
    old_bid             = Column(Integer, nullable=True)
    new_bid             = Column(Integer, nullable=True)
    change_rate         = Column(Float, nullable=True)
    reason              = Column(Text, nullable=True)
    suggested_by        = Column(String, nullable=True)          # 예: "rule_engine"
    approved_by_user_id = Column(String, nullable=True, index=True)
    applied_at          = Column(DateTime(timezone=True), nullable=True)
    # pending | applied | failed | skipped | dry_run
    status              = Column(String, nullable=False, default="pending", index=True)
    raw_response        = Column(Text, nullable=True)            # 민감정보 제외, 응답 요약만
    created_at          = Column(DateTime(timezone=True), default=now_kst)


class NaverAdsDaypartingConfig(Base):
    """시간대/요일 자동 입찰 가중치 설정 (단일 행, id='default')."""
    __tablename__ = "naver_ads_dayparting_config"

    id                  = Column(String, primary_key=True, default="default")
    enabled             = Column(Boolean, default=False, nullable=False)
    campaign_id         = Column(String, nullable=True)
    adgroup_id          = Column(String, nullable=True)
    hour_multipliers    = Column(Text, nullable=True)     # JSON {"0":0.9,...,"23":1.1}
    weekday_multipliers = Column(Text, nullable=True)     # JSON {"월":1.0,...}
    base_bids           = Column(Text, nullable=True)     # JSON {keyword_id: {"bid":int,"keyword":str,"adgroup_name":str,"campaign_name":str}}
    dry_run             = Column(Boolean, default=True, nullable=False)
    min_bid             = Column(Integer, default=70, nullable=False)
    last_run_at         = Column(DateTime(timezone=True), nullable=True)
    last_run_summary    = Column(Text, nullable=True)
    updated_by          = Column(String, nullable=True)
    updated_at          = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
    created_at          = Column(DateTime(timezone=True), default=now_kst)


class NaverAdKeywordSchedule(Base):
    """키워드별 시간(0~23)별 입찰가 스케줄. hourly_bids = JSON {"0":100,...}"""
    __tablename__ = "naver_ad_keyword_schedules"

    keyword_id    = Column(String, primary_key=True)
    keyword       = Column(String, nullable=True)
    campaign_name = Column(String, nullable=True)
    adgroup_name  = Column(String, nullable=True)
    adgroup_id    = Column(String, nullable=True)
    hourly_bids   = Column(Text, nullable=True)     # JSON {"0":100,...,"23":120}
    enabled       = Column(Boolean, default=True, nullable=False)
    updated_by    = Column(String, nullable=True)
    updated_at    = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
    created_at    = Column(DateTime(timezone=True), default=now_kst)


class NaverAdBidOverride(Base):
    """키워드 임시 입찰 오버라이드.
    지정한 시작~종료 시각 동안 입찰가를 override_bid 로 바꾸고,
    종료 시 시작 시점에 캡처한 original_bid 로 자동 복원한다. (1회성)
    """
    __tablename__ = "naver_ad_bid_overrides"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    keyword_id    = Column(String, nullable=False, index=True)
    keyword       = Column(String, nullable=True)
    adgroup_id    = Column(String, nullable=True)
    adgroup_name  = Column(String, nullable=True)
    campaign_name = Column(String, nullable=True)
    override_bid  = Column(Integer, nullable=False)        # 변경할 입찰가
    original_bid  = Column(Integer, nullable=True)         # 시작 시점 캡처(복원용)
    repeat        = Column(String, nullable=False, default="once")  # once | daily
    start_at      = Column(DateTime(timezone=True), nullable=True, index=True)  # once 용
    end_at        = Column(DateTime(timezone=True), nullable=True, index=True)  # once 용
    daily_start   = Column(String, nullable=True)          # daily 용 "HH:MM"
    daily_end     = Column(String, nullable=True)          # daily 용 "HH:MM"
    status        = Column(String, nullable=False, default="scheduled", index=True)  # scheduled|active|done|canceled|failed
    enabled       = Column(Boolean, default=True, nullable=False)
    note          = Column(Text, nullable=True)
    activated_at  = Column(DateTime(timezone=True), nullable=True)
    reverted_at   = Column(DateTime(timezone=True), nullable=True)
    created_by    = Column(String, nullable=True)
    created_at    = Column(DateTime(timezone=True), default=now_kst)
    updated_at    = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
