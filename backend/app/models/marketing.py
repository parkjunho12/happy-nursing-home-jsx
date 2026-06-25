"""네이버 광고 유입 CTA 추적 (개인정보 미저장)"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


class MarketingCtaEvent(Base):
    __tablename__ = "marketing_cta_events"

    id                = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type        = Column(String, nullable=False, index=True)  # phone_click/consultation_click/consultation_submit/kakao_click
    page_path         = Column(String, nullable=True, index=True)
    page_title        = Column(String, nullable=True)
    component_name    = Column(String, nullable=True)
    section_name      = Column(String, nullable=True)
    button_label      = Column(String, nullable=True)
    destination       = Column(String, nullable=True)
    utm_source        = Column(String, nullable=True, index=True)
    utm_medium        = Column(String, nullable=True)
    utm_campaign      = Column(String, nullable=True, index=True)
    utm_term          = Column(String, nullable=True, index=True)
    utm_content       = Column(String, nullable=True)
    naver_query       = Column(String, nullable=True, index=True)
    naver_campaign_id = Column(String, nullable=True)
    naver_adgroup_id  = Column(String, nullable=True)
    naver_keyword_id  = Column(String, nullable=True)
    naver_ad_id       = Column(String, nullable=True)
    naver_keyword     = Column(String, nullable=True)   # n_keyword: 등록 키워드 텍스트
    naver_rank        = Column(String, nullable=True)   # n_rank: 광고 노출 순위
    naver_media       = Column(String, nullable=True)   # n_media: 매체 코드
    naver_match_type  = Column(String, nullable=True)   # n_match: 매치 유형
    naver_campaign_type = Column(String, nullable=True) # n_campaign_type: 캠페인 유형(1=파워링크 등)
    naver_napm        = Column(String, nullable=True)   # NaPm: 네이버 유료클릭 트래커 원본(디코드)
    naver_napm_ci     = Column(String, nullable=True, index=True)  # NaPm ci: 클릭 식별자
    naver_napm_tr     = Column(String, nullable=True)   # NaPm tr: 광고 유형(sa=search ad 등)
    session_id        = Column(String, nullable=True, index=True)
    device_type       = Column(String, nullable=True)   # mobile/tablet/desktop
    user_agent        = Column(Text, nullable=True)      # optional
    ip_hash           = Column(String, nullable=True)    # 해시만 저장(원본 IP 미저장)
    created_at        = Column(DateTime(timezone=True), default=now_kst, index=True)
