"""
네이버 광고 유입 CTA 추적.
- 공개: CTA 이벤트 수집 (rate limit, 개인정보 미저장, IP 해시)
- 어드민: 집계 조회 (ADMIN)
"""
from __future__ import annotations

import hashlib
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Request, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.core.config import settings
from app.models.user import User
from app.models.marketing import MarketingCtaEvent, now_kst
from app.schemas.response import ApiResponse

logger = logging.getLogger("marketing")

public_router = APIRouter()
admin_router = APIRouter()

EVENT_TYPES = ["phone_click", "consultation_click", "consultation_submit", "kakao_click"]


def _is_ad_event(r) -> bool:
    """네이버 광고 유입 여부.
    - utm_source == 'naver'  (파워링크/파워콘텐츠 공통)
    - 또는 네이버 광고 파라미터(naver_query/campaign/keyword/ad) 존재
    ⚠️ utm_source=qr(인스타 QR), facebook, google 등 다른 채널 utm 은 광고로 보지 않는다.
    """
    src = (r.utm_source or "").strip().lower()
    return bool(
        src == "naver"
        or r.naver_query or r.naver_campaign_id or r.naver_keyword_id or r.naver_ad_id
        or getattr(r, "naver_napm", None)
    )


def _ad_platform(r) -> Optional[str]:
    """광고 유입 플랫폼 추정(파라미터 체계 기반).
    - 'mobile' : NaPm 트래커(모바일 검색광고)
    - 'pc'     : n_query/n_* 파워링크 사이트링크 파라미터(PC)
    - None     : 구분 불가(예: utm_source=naver 만 있는 경우)
    """
    if getattr(r, "naver_napm", None):
        return "mobile"
    if r.naver_query or r.naver_keyword_id or r.naver_adgroup_id or r.naver_ad_id or r.naver_campaign_id:
        return "pc"
    return None


KST = timezone(timedelta(hours=9))

# ── 간단 in-memory rate limit (IP해시 기준) ──
_RL: Dict[str, list] = {}
_RL_LIMIT = 120      # 분당 최대
_RL_WINDOW = 60


def _rate_ok(key: str) -> bool:
    now = time.time()
    arr = [t for t in _RL.get(key, []) if now - t < _RL_WINDOW]
    if len(arr) >= _RL_LIMIT:
        _RL[key] = arr
        return False
    arr.append(now)
    _RL[key] = arr
    return True


def _client_ip(req: Request) -> str:
    xff = req.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return req.client.host if req.client else "unknown"


def _ip_hash(ip: str) -> str:
    salt = (settings.SECRET_KEY or "salt")[:16]
    return hashlib.sha256(f"{ip}:{salt}".encode("utf-8")).hexdigest()[:16]


def _device_type(ua: str) -> str:
    u = (ua or "").lower()
    if "ipad" in u or "tablet" in u:
        return "tablet"
    if "mobi" in u or "android" in u or "iphone" in u:
        return "mobile"
    return "desktop"


# --------------------------------------------------------------------------- #
# 공개: 수집
# --------------------------------------------------------------------------- #
class CtaEventBody(BaseModel):
    event_type: str
    page_path: Optional[str] = None
    page_title: Optional[str] = None
    component_name: Optional[str] = None
    section_name: Optional[str] = None
    button_label: Optional[str] = None
    destination: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    naver_query: Optional[str] = None
    naver_campaign_id: Optional[str] = None
    naver_adgroup_id: Optional[str] = None
    naver_keyword_id: Optional[str] = None
    naver_ad_id: Optional[str] = None
    naver_keyword: Optional[str] = None
    naver_rank: Optional[str] = None
    naver_media: Optional[str] = None
    naver_match_type: Optional[str] = None
    naver_campaign_type: Optional[str] = None
    naver_napm: Optional[str] = None
    naver_napm_ci: Optional[str] = None
    naver_napm_tr: Optional[str] = None
    session_id: Optional[str] = None
    device_type: Optional[str] = None


def _clip(v: Optional[str], n: int = 300) -> Optional[str]:
    if v is None:
        return None
    v = str(v)
    return v[:n]


@public_router.post("/cta-event")
def collect_cta_event(body: CtaEventBody, request: Request, db: Session = Depends(get_db)):
    if body.event_type not in EVENT_TYPES:
        return ApiResponse(success=True, data={"ok": False, "reason": "ignored"})

    ip = _client_ip(request)
    iph = _ip_hash(ip)
    if not _rate_ok(iph):
        return ApiResponse(success=True, data={"ok": False, "reason": "rate_limited"})

    ua = request.headers.get("user-agent", "")
    ev = MarketingCtaEvent(
        event_type=body.event_type,
        page_path=_clip(body.page_path),
        page_title=_clip(body.page_title),
        component_name=_clip(body.component_name, 80),
        section_name=_clip(body.section_name, 80),
        button_label=_clip(body.button_label, 120),
        destination=_clip(body.destination, 200),
        utm_source=_clip(body.utm_source, 80),
        utm_medium=_clip(body.utm_medium, 80),
        utm_campaign=_clip(body.utm_campaign, 120),
        utm_term=_clip(body.utm_term, 120),
        utm_content=_clip(body.utm_content, 120),
        naver_query=_clip(body.naver_query, 120),
        naver_campaign_id=_clip(body.naver_campaign_id, 80),
        naver_adgroup_id=_clip(body.naver_adgroup_id, 80),
        naver_keyword_id=_clip(body.naver_keyword_id, 80),
        naver_ad_id=_clip(body.naver_ad_id, 80),
        naver_keyword=_clip(body.naver_keyword, 120),
        naver_rank=_clip(body.naver_rank, 20),
        naver_media=_clip(body.naver_media, 40),
        naver_match_type=_clip(body.naver_match_type, 20),
        naver_campaign_type=_clip(body.naver_campaign_type, 20),
        naver_napm=_clip(body.naver_napm, 300),
        naver_napm_ci=_clip(body.naver_napm_ci, 80),
        naver_napm_tr=_clip(body.naver_napm_tr, 20),
        session_id=_clip(body.session_id, 80),
        device_type=_clip(body.device_type, 20) or _device_type(ua),
        user_agent=_clip(ua, 400),
        ip_hash=iph,
    )
    try:
        db.add(ev)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning("cta event save failed: %s", type(e).__name__)
        return ApiResponse(success=True, data={"ok": False})
    return ApiResponse(success=True, data={"ok": True})


# --------------------------------------------------------------------------- #
# 어드민: 집계
# --------------------------------------------------------------------------- #
@admin_router.get("/cta-events")
def cta_events_dashboard(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    page: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    campaign: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    component: Optional[str] = Query(None),
    source: str = Query('ad'),  # 'ad'(광고유입만) | 'organic'(비광고) | 'all'(전체)
    platform: str = Query(''),  # ''(전체) | 'pc' | 'mobile'
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    q = db.query(MarketingCtaEvent)
    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=KST)
            q = q.filter(MarketingCtaEvent.created_at >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=KST) + timedelta(days=1)
            q = q.filter(MarketingCtaEvent.created_at < ed)
        except ValueError:
            pass
    if page:
        q = q.filter(MarketingCtaEvent.page_path == page)
    if event_type and event_type in EVENT_TYPES:
        q = q.filter(MarketingCtaEvent.event_type == event_type)
    if campaign:
        q = q.filter(MarketingCtaEvent.utm_campaign == campaign)
    if component:
        q = q.filter(MarketingCtaEvent.component_name == component)
    rows = q.order_by(MarketingCtaEvent.created_at.desc()).limit(20000).all()

    if keyword:
        kw = keyword.strip()
        rows = [r for r in rows if (r.utm_term == kw or r.naver_query == kw)]

    # 채널 분포(검증용): source/platform 필터 적용 전, 현재 기간/필터 조건 기준
    ad_rows = [r for r in rows if _is_ad_event(r)]
    pc_cnt = sum(1 for r in ad_rows if _ad_platform(r) == "pc")
    mobile_cnt = sum(1 for r in ad_rows if _ad_platform(r) == "mobile")
    channel_summary = {
        "naver_ad": len(ad_rows),
        "naver_ad_pc": pc_cnt,
        "naver_ad_mobile": mobile_cnt,
        "naver_ad_etc": len(ad_rows) - pc_cnt - mobile_cnt,
        "organic": len(rows) - len(ad_rows),
        "total": len(rows),
    }

    # 유입 채널 필터 (기본: 광고 유입만)
    if source == 'ad':
        rows = [r for r in rows if _is_ad_event(r)]
    elif source == 'organic':
        rows = [r for r in rows if not _is_ad_event(r)]
    # source == 'all' → 전체

    # 광고 플랫폼 필터 (PC/모바일)
    if platform in ('pc', 'mobile'):
        rows = [r for r in rows if _ad_platform(r) == platform]

    kpi = {"total": 0, "phone_click": 0, "consultation_click": 0, "consultation_submit": 0, "kakao_click": 0}
    by_page: Dict[str, Dict[str, Any]] = {}
    by_comp: Dict[tuple, Dict[str, Any]] = {}
    by_kw: Dict[tuple, Dict[str, Any]] = {}

    def blank_counts():
        return {"phone_click": 0, "consultation_click": 0, "consultation_submit": 0, "kakao_click": 0, "total": 0}

    for r in rows:
        et = r.event_type
        kpi["total"] += 1
        if et in kpi:
            kpi[et] += 1

        # 페이지별
        p = r.page_path or "(unknown)"
        if p not in by_page:
            by_page[p] = {"page_path": p, "page_title": r.page_title, **blank_counts()}
        if et in by_page[p]:
            by_page[p][et] += 1
        by_page[p]["total"] += 1

        # 컴포넌트별
        ck = (r.component_name or "(none)", r.section_name or "", r.button_label or "", et)
        if ck not in by_comp:
            by_comp[ck] = {"component_name": ck[0], "section_name": ck[1], "button_label": ck[2], "event_type": et, "count": 0}
        by_comp[ck]["count"] += 1

        # 키워드별 (네이버는 검색어 n_query 우선)
        kwv = r.naver_query or r.utm_term or "(none)"
        kk = (kwv, p)
        if kk not in by_kw:
            by_kw[kk] = {
                "keyword": kwv, "page_path": p,
                "keyword_text": r.naver_keyword, "media": r.naver_media,
                "match_type": r.naver_match_type, "rank_best": None,
                **blank_counts(),
            }
        g = by_kw[kk]
        if not g.get("keyword_text") and r.naver_keyword:
            g["keyword_text"] = r.naver_keyword
        if not g.get("media") and r.naver_media:
            g["media"] = r.naver_media
        if not g.get("match_type") and r.naver_match_type:
            g["match_type"] = r.naver_match_type
        try:
            rk = int(str(r.naver_rank))
            if g["rank_best"] is None or rk < g["rank_best"]:
                g["rank_best"] = rk
        except (TypeError, ValueError):
            pass
        if et in g:
            g[et] += 1
        g["total"] += 1

    comp_list = sorted(by_comp.values(), key=lambda x: x["count"], reverse=True)
    total_comp = sum(c["count"] for c in comp_list) or 1
    for c in comp_list:
        c["ratio"] = round(c["count"] / total_comp * 100, 1)

    # 필터 옵션 (전체 분포 기준 distinct)
    all_rows = db.query(MarketingCtaEvent).all()
    pages = sorted({r.page_path for r in all_rows if r.page_path})
    components = sorted({r.component_name for r in all_rows if r.component_name})
    campaigns = sorted({r.utm_campaign for r in all_rows if r.utm_campaign})
    keywords = sorted({(r.utm_term or r.naver_query) for r in all_rows if (r.utm_term or r.naver_query)})

    # 전체 대비 광고/비광고 분포(현재 기간·필터 조건 무시한 단순 참고치는 아니고, source 미적용 분포)
    return ApiResponse(success=True, data={
        "source": source,
        "platform": platform,
        "channel_summary": channel_summary,
        "kpi": kpi,
        "by_page": sorted(by_page.values(), key=lambda x: x["total"], reverse=True),
        "by_component": comp_list,
        "by_keyword": sorted(by_kw.values(), key=lambda x: x["total"], reverse=True),
        "filters": {"pages": pages, "components": components, "campaigns": campaigns, "keywords": keywords},
        "event_types": EVENT_TYPES,
    })
