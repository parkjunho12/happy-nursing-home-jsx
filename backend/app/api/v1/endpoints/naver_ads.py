"""
네이버 검색광고 관리 (ADMIN 전용).

흐름: 제안(suggestion) → 관리자 승인 → 적용(apply).
모든 네이버 광고 API 호출은 백엔드에서만 처리하며, 인증정보는 응답/로그에 남기지 않는다.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.core.config import settings
from app.models.user import User
from app.models.naver_ads import NaverAdBidChangeLog, now_kst
from app.schemas.response import ApiResponse
from app.services.naver_ads_client import (
    get_naver_ads_client, NaverAdsError, NaverAdsNotConfigured,
)
from app.services.naver_ads_rules import (
    generate_bid_suggestions, generate_bid_suggestions_claude,
    summarize_performance, classify_tier,
    MAX_CHANGE_RATE, TIER1_MIN_BID,
)

logger = logging.getLogger("naver_ads")
router = APIRouter()

KST = timezone(timedelta(hours=9))


# --------------------------------------------------------------------------- #
# 정규화 헬퍼 (네이버 API 응답 필드명은 계정/문서 버전에 따라 다를 수 있음)
# --------------------------------------------------------------------------- #
def _norm_campaign(c: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "campaign_id": c.get("nccCampaignId") or c.get("id"),
        "name": c.get("name"),
        "campaign_type": c.get("campaignTp") or c.get("campaignType"),
        "status": c.get("status") or c.get("statusReason"),
    }


def _norm_adgroup(a: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "adgroup_id": a.get("nccAdgroupId") or a.get("id"),
        "campaign_id": a.get("nccCampaignId"),
        "name": a.get("name"),
        "status": a.get("status"),
    }


def _norm_keyword(k: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "keyword_id": k.get("nccKeywordId") or k.get("id"),
        "keyword": k.get("keyword"),
        "current_bid": int(k.get("bidAmt") or 0),
        "use_group_bid": bool(k.get("useGroupBidAmt", False)),
        "status": k.get("status") or ("paused" if k.get("userLock") else "active"),
        "adgroup_id": k.get("nccAdgroupId"),
    }


def _metric(stat: Dict[str, Any], *names: str) -> float:
    for n in names:
        if n in stat and stat[n] is not None:
            try:
                return float(stat[n])
            except (TypeError, ValueError):
                continue
    return 0.0


def _safe_div(a: float, b: float) -> float:
    return (a / b) if b else 0.0


def _client_or_unconfigured():
    client = get_naver_ads_client()
    return client, client.is_configured


# --------------------------------------------------------------------------- #
# Master data
# --------------------------------------------------------------------------- #
@router.get("/campaigns")
def list_campaigns(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    client, ok = _client_or_unconfigured()
    if not ok:
        return ApiResponse(success=True, data={"configured": False, "campaigns": []})
    try:
        rows = client.get_campaigns()
    except NaverAdsError:
        return ApiResponse(success=False, message="캠페인 목록을 불러오지 못했습니다.", data={"configured": True, "campaigns": []})
    return ApiResponse(success=True, data={"configured": True, "campaigns": [_norm_campaign(c) for c in rows]})


@router.get("/adgroups")
def list_adgroups(
    campaign_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    client, ok = _client_or_unconfigured()
    if not ok:
        return ApiResponse(success=True, data={"configured": False, "adgroups": []})
    try:
        rows = client.get_adgroups(campaign_id)
    except NaverAdsError:
        return ApiResponse(success=False, message="광고그룹 목록을 불러오지 못했습니다.", data={"configured": True, "adgroups": []})
    return ApiResponse(success=True, data={"configured": True, "adgroups": [_norm_adgroup(a) for a in rows]})


@router.get("/keywords")
def list_keywords(
    adgroup_id: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    client, ok = _client_or_unconfigured()
    if not ok:
        return ApiResponse(success=True, data={"configured": False, "keywords": []})
    try:
        # 캠페인/광고그룹명 매핑
        camp_name = {c.get("nccCampaignId"): c.get("name") for c in client.get_campaigns()}
        ag_rows = client.get_adgroups(campaign_id)
        ag_name = {a.get("nccAdgroupId"): a.get("name") for a in ag_rows}
        ag_camp = {a.get("nccAdgroupId"): a.get("nccCampaignId") for a in ag_rows}

        if adgroup_id:
            raw = client.get_keywords(adgroup_id)
        elif campaign_id:
            raw = []
            for a in ag_rows:
                raw.extend(client.get_keywords(a.get("nccAdgroupId")))
        else:
            raw = client.get_keywords()
    except NaverAdsError:
        return ApiResponse(success=False, message="키워드 목록을 불러오지 못했습니다.", data={"configured": True, "keywords": []})

    out = []
    for k in raw:
        n = _norm_keyword(k)
        ag_id = n["adgroup_id"]
        n["adgroup_name"] = ag_name.get(ag_id)
        n["campaign_name"] = camp_name.get(ag_camp.get(ag_id))
        n["tier"] = classify_tier(n["keyword"] or "")
        out.append(n)
    return ApiResponse(success=True, data={"configured": True, "keywords": out})


# --------------------------------------------------------------------------- #
# Performance
# --------------------------------------------------------------------------- #
def _build_keyword_performance(
    client, start_date: str, end_date: str,
    campaign_id: Optional[str], adgroup_id: Optional[str], keyword_filter: Optional[str],
) -> List[Dict[str, Any]]:
    camp_name = {c.get("nccCampaignId"): c.get("name") for c in client.get_campaigns()}
    ag_rows = client.get_adgroups(campaign_id)
    ag_name = {a.get("nccAdgroupId"): a.get("name") for a in ag_rows}
    ag_camp = {a.get("nccAdgroupId"): a.get("nccCampaignId") for a in ag_rows}

    if adgroup_id:
        raw = client.get_keywords(adgroup_id)
    elif campaign_id:
        raw = []
        for a in ag_rows:
            raw.extend(client.get_keywords(a.get("nccAdgroupId")))
    else:
        raw = client.get_keywords()

    keywords = [_norm_keyword(k) for k in raw]
    if keyword_filter:
        kf = keyword_filter.strip()
        keywords = [k for k in keywords if kf in (k["keyword"] or "")]

    ids = [k["keyword_id"] for k in keywords if k["keyword_id"]]
    stats = client.get_performance_report(ids, start_date, end_date) if ids else []
    # id → stat 매핑 (필드명 후보 다수 시도)
    stat_by_id: Dict[str, Dict[str, Any]] = {}
    for s in stats:
        sid = s.get("id") or s.get("nccKeywordId") or s.get("keywordId")
        if sid:
            stat_by_id[str(sid)] = s

    try:
        d_days = (datetime.strptime(end_date, "%Y-%m-%d") - datetime.strptime(start_date, "%Y-%m-%d")).days + 1
    except Exception:
        d_days = 0

    rows: List[Dict[str, Any]] = []
    for k in keywords:
        st = stat_by_id.get(str(k["keyword_id"]), {})
        imp = _metric(st, "impCnt", "impressions")
        clk = _metric(st, "clkCnt", "clicks")
        cost = _metric(st, "salesAmt", "cost")
        conv = _metric(st, "ccnt", "conversions", "convCnt", "cnvCnt", "ccnt1", "ccnt2")
        ctr = _metric(st, "ctr") or _safe_div(clk, imp)
        cpc = _metric(st, "cpc") or _safe_div(cost, clk)
        ag_id = k["adgroup_id"]
        rows.append({
            "keyword_id": k["keyword_id"],
            "keyword": k["keyword"],
            "current_bid": k["current_bid"],
            "status": k["status"],
            "campaign_name": camp_name.get(ag_camp.get(ag_id)),
            "adgroup_name": ag_name.get(ag_id),
            "adgroup_id": ag_id,
            "impressions": int(imp),
            "clicks": int(clk),
            "ctr": round(ctr, 4),
            "avg_cpc": round(cpc, 1),
            "cost": round(cost, 1),
            "conversions": round(conv, 1),
            "conversion_rate": round(_safe_div(conv, clk), 4),
            "cost_per_conversion": round(_safe_div(cost, conv), 1) if conv else None,
            "data_days": d_days,
            "tier": classify_tier(k["keyword"] or ""),
        })
    return rows


def _aggregate(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    imp = sum(r["impressions"] for r in rows)
    clk = sum(r["clicks"] for r in rows)
    cost = sum(r["cost"] for r in rows)
    conv = sum(r["conversions"] for r in rows)
    return {
        "impressions": imp,
        "clicks": clk,
        "cost": round(cost, 1),
        "ctr": round(_safe_div(clk, imp), 4),
        "avg_cpc": round(_safe_div(cost, clk), 1),
        "conversions": round(conv, 1),
        "conversion_rate": round(_safe_div(conv, clk), 4),
        "cost_per_conversion": round(_safe_div(cost, conv), 1) if conv else None,
    }


@router.get("/performance")
def get_performance(
    start_date: str = Query(...),
    end_date: str = Query(...),
    campaign_id: Optional[str] = Query(None),
    adgroup_id: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    client, ok = _client_or_unconfigured()
    if not ok:
        empty = {"impressions": 0, "clicks": 0, "cost": 0, "ctr": 0, "avg_cpc": 0,
                 "conversions": 0, "conversion_rate": 0, "cost_per_conversion": None,
                 "keywords": [], "configured": False}
        return ApiResponse(success=True, data=empty)
    try:
        rows = _build_keyword_performance(client, start_date, end_date, campaign_id, adgroup_id, keyword)
    except NaverAdsError:
        return ApiResponse(success=False, message="성과 데이터를 불러오지 못했습니다.",
                           data={"keywords": [], "configured": True})
    agg = _aggregate(rows)
    agg["keywords"] = rows
    agg["configured"] = True
    return ApiResponse(success=True, data=agg)


# --------------------------------------------------------------------------- #
# Bid suggestions
# --------------------------------------------------------------------------- #
class SuggestBody(BaseModel):
    start_date: str
    end_date: str
    campaign_id: Optional[str] = None
    adgroup_id: Optional[str] = None
    keyword: Optional[str] = None
    use_claude: bool = True   # Claude 분석 사용(미설정/실패 시 룰 기반 자동 폴백)


@router.post("/bid-suggestions")
def bid_suggestions(body: SuggestBody, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_admin_user)):
    client, ok = _client_or_unconfigured()
    if not ok:
        return ApiResponse(success=True, data={"configured": False, "suggestions": []})
    try:
        rows = _build_keyword_performance(client, body.start_date, body.end_date,
                                          body.campaign_id, body.adgroup_id, body.keyword)
    except NaverAdsError:
        return ApiResponse(success=False, message="성과 데이터를 불러오지 못했습니다.",
                           data={"configured": True, "suggestions": []})
    use_claude = body.use_claude and bool(settings.ANTHROPIC_API_KEY)
    if use_claude:
        suggestions = generate_bid_suggestions_claude(rows)
        engine = "claude" if any(s.get("source") == "claude" for s in suggestions) else "rule"
    else:
        suggestions = generate_bid_suggestions(rows)
        engine = "rule"
    return ApiResponse(success=True, data={"configured": True, "suggestions": suggestions,
                                           "engine": engine,
                                           "generated_at": now_kst().isoformat()})


# --------------------------------------------------------------------------- #
# Apply (승인된 항목만 실제 반영)
# --------------------------------------------------------------------------- #
class ApplyItem(BaseModel):
    keyword_id: str
    keyword: str
    current_bid: int
    recommended_bid: int
    change_rate: Optional[float] = None
    reason: Optional[str] = None
    campaign_name: Optional[str] = None
    adgroup_name: Optional[str] = None
    suggested_by: Optional[str] = "rule_engine"


class ApplyBody(BaseModel):
    items: List[ApplyItem] = Field(default_factory=list)
    dry_run: Optional[bool] = None  # None이면 환경에 따라 결정
    time_multiplier: Optional[float] = None  # 시간대/요일 입찰 가중치 (예: 1.13)


def _effective_dry_run(requested: Optional[bool]) -> bool:
    # 명시적으로 dry_run 값이 오면 그대로 따른다(관리자 UI 토글 존중).
    # 값이 없을 때만 환경 기본값 사용(개발=dry_run, 운영=실제반영).
    if requested is None:
        return settings.ENVIRONMENT != "production"
    return bool(requested)


def _clamp_safe(current: int, target: int, tier: Optional[int]) -> int:
    low = int(round(current * (1 - MAX_CHANGE_RATE)))
    high = int(round(current * (1 + MAX_CHANGE_RATE)))
    val = max(low, min(high, target))
    if tier == 1:
        val = max(val, TIER1_MIN_BID)
    return int(val)


@router.post("/apply-bid-suggestions")
def apply_bid_suggestions(body: ApplyBody, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_admin_user)):
    client, ok = _client_or_unconfigured()
    dry_run = _effective_dry_run(body.dry_run)

    # 일일 변경 제한 (옵션)
    daily_limit = settings.NAVER_ADS_DAILY_MAX_KEYWORD_CHANGES or 0
    applied_today = 0
    if daily_limit > 0:
        start_of_day = datetime.now(KST).replace(hour=0, minute=0, second=0, microsecond=0)
        applied_today = db.query(NaverAdBidChangeLog).filter(
            NaverAdBidChangeLog.status == "applied",
            NaverAdBidChangeLog.applied_at >= start_of_day,
        ).count()

    results = []
    for item in body.items:
        tier = classify_tier(item.keyword or "")
        mult = body.time_multiplier if (body.time_multiplier and body.time_multiplier > 0) else 1.0
        target_bid = int(round(item.recommended_bid * mult))
        safe_bid = _clamp_safe(item.current_bid, target_bid, tier)
        change_rate = ((safe_bid - item.current_bid) / item.current_bid) if item.current_bid else 0.0

        log = NaverAdBidChangeLog(
            keyword_id=item.keyword_id,
            keyword=item.keyword,
            campaign_name=item.campaign_name,
            adgroup_name=item.adgroup_name,
            old_bid=item.current_bid,
            new_bid=safe_bid,
            change_rate=round(change_rate, 4),
            reason=item.reason,
            suggested_by=item.suggested_by or "rule_engine",
            approved_by_user_id=current_user.id,
            status="pending",
        )

        # 변경 없음
        if safe_bid == item.current_bid:
            log.status = "skipped"; log.raw_response = "no change"
            db.add(log); results.append(_result(item, safe_bid, "skipped", "변경폭 없음"))
            continue

        # 일일 제한 초과
        if daily_limit > 0 and applied_today >= daily_limit and not dry_run:
            log.status = "skipped"; log.raw_response = "daily limit reached"
            db.add(log); results.append(_result(item, safe_bid, "skipped", "일일 변경 한도 초과"))
            continue

        if dry_run:
            log.status = "dry_run"; log.raw_response = "dry_run"
            db.add(log); results.append(_result(item, safe_bid, "dry_run", "모의 적용(미반영)"))
            continue

        if not ok:
            log.status = "failed"; log.raw_response = "not configured"
            db.add(log); results.append(_result(item, safe_bid, "failed", "API 미설정"))
            continue

        # 실제 반영 (재시도 없음)
        try:
            resp = client.update_keyword_bid(item.keyword_id, safe_bid)
            returned = (resp or {}).get("bidAmt")
            log.status = "applied"
            log.applied_at = now_kst()
            # 민감정보 제외, 변경 결과 요약만 저장
            log.raw_response = json.dumps({"bidAmt": returned}, ensure_ascii=False)
            applied_today += 1
            db.add(log); results.append(_result(item, safe_bid, "applied", f"반영 완료 (네이버 bidAmt={returned})"))
        except NaverAdsError as e:
            log.status = "failed"
            log.raw_response = json.dumps({"status_code": e.status_code, "error_code": e.error_code, "detail": e.detail}, ensure_ascii=False)
            db.add(log); results.append(_result(item, safe_bid, "failed", f"반영 실패 (status={e.status_code}, code={e.error_code}) {e.detail or ''}"))

    db.commit()
    # 입찰가가 바뀐 경우 키워드 캐시를 비워 다음 조회에 반영
    try:
        if any(r["status"] == "applied" for r in results):
            client.clear_cache()
    except Exception:
        pass
    n_applied = sum(1 for r in results if r["status"] == "applied")
    n_failed = sum(1 for r in results if r["status"] == "failed")
    return ApiResponse(success=True, data={
        "dry_run": dry_run,
        "requested_dry_run": body.dry_run,   # 클라이언트가 보낸 원래 값(디버그)
        "environment": settings.ENVIRONMENT,
        "applied": n_applied,
        "failed": n_failed,
        "results": results,
    })


def _result(item: ApplyItem, new_bid: int, status: str, message: str) -> Dict[str, Any]:
    return {
        "keyword_id": item.keyword_id, "keyword": item.keyword,
        "old_bid": item.current_bid, "new_bid": new_bid,
        "status": status, "message": message,
    }


# --------------------------------------------------------------------------- #
# AI 요약
# --------------------------------------------------------------------------- #
class AiSummaryBody(BaseModel):
    performance: Optional[Dict[str, Any]] = None
    keywords: Optional[List[Dict[str, Any]]] = None
    suggestions: Optional[List[Dict[str, Any]]] = None
    # 또는 기간으로 직접 조회
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    campaign_id: Optional[str] = None
    adgroup_id: Optional[str] = None
    use_llm: bool = False


@router.post("/ai-summary")
def ai_summary(body: AiSummaryBody, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_admin_user)):
    performance = body.performance or {}
    keyword_rows = body.keywords or []
    suggestions = body.suggestions or []

    # 입력이 없으면 기간으로 직접 조회
    if not keyword_rows and body.start_date and body.end_date:
        client, ok = _client_or_unconfigured()
        if ok:
            try:
                keyword_rows = _build_keyword_performance(
                    client, body.start_date, body.end_date, body.campaign_id, body.adgroup_id, None)
                performance = _aggregate(keyword_rows)
                suggestions = generate_bid_suggestions(keyword_rows)
            except NaverAdsError:
                pass

    result = summarize_performance(performance, keyword_rows, suggestions, use_llm=body.use_llm)
    return ApiResponse(success=True, data=result)


# --------------------------------------------------------------------------- #
# 변경 로그 조회
# --------------------------------------------------------------------------- #
@router.get("/change-logs")
def change_logs(limit: int = Query(50, le=200), db: Session = Depends(get_db),
                current_user: User = Depends(get_current_admin_user)):
    rows = (db.query(NaverAdBidChangeLog)
            .order_by(NaverAdBidChangeLog.created_at.desc())
            .limit(limit).all())
    data = [{
        "id": r.id, "keyword": r.keyword, "keyword_id": r.keyword_id,
        "campaign_name": r.campaign_name, "adgroup_name": r.adgroup_name,
        "old_bid": r.old_bid, "new_bid": r.new_bid, "change_rate": r.change_rate,
        "reason": r.reason, "suggested_by": r.suggested_by,
        "approved_by_user_id": r.approved_by_user_id,
        "status": r.status,
        "applied_at": r.applied_at.isoformat() if r.applied_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]
    return ApiResponse(success=True, data=data)


# --------------------------------------------------------------------------- #
# 전환 데이터 점검 (디버그) — 실제 /stats 가 어떤 필드를 주는지 그대로 확인
# --------------------------------------------------------------------------- #
@router.get("/stats-debug")
def stats_debug(
    start_date: str = Query(...),
    end_date: str = Query(...),
    limit: int = Query(5, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    소수 키워드에 대해 풍부한 필드로 /stats 를 호출하고, 네이버가 실제로 돌려주는
    원본 필드(키/값)를 그대로 반환한다. 전환(전환수/전환율) 필드명을 확인하는 용도.
    (인증정보 없음, 광고 지표만)
    """
    client, ok = _client_or_unconfigured()
    if not ok:
        return ApiResponse(success=True, data={"configured": False})

    # 첫 광고그룹에서 샘플 키워드 id 수집 (가벼운 호출)
    sample_ids: List[str] = []
    try:
        for ag in client.get_adgroups():
            for k in client.get_keywords(ag.get("nccAdgroupId")):
                kid = k.get("nccKeywordId") or k.get("id")
                if kid:
                    sample_ids.append(kid)
                if len(sample_ids) >= limit:
                    break
            if len(sample_ids) >= limit:
                break
    except NaverAdsError:
        return ApiResponse(success=False, message="키워드 샘플을 가져오지 못했습니다.")

    if not sample_ids:
        return ApiResponse(success=True, data={"configured": True, "note": "키워드가 없습니다.", "rows": []})

    # 전환 관련 후보 필드까지 포함해 시도 (실패하면 핵심 필드로 폴백)
    rich = ["impCnt", "clkCnt", "salesAmt", "ctr", "cpc", "ccnt", "convAmt", "crto", "cpConv", "ror"]
    used_fields = rich
    try:
        rows = client.get_performance_report(sample_ids, start_date, end_date, fields=rich)
    except NaverAdsError:
        used_fields = ["impCnt", "clkCnt", "salesAmt", "ccnt"]
        try:
            rows = client.get_performance_report(sample_ids, start_date, end_date, fields=used_fields)
        except NaverAdsError:
            return ApiResponse(success=False, message="성과 샘플 조회에 실패했습니다.")

    keys_seen = sorted({k for r in rows for k in (r or {}).keys()})
    has_conv = any(k in keys_seen for k in ("ccnt", "convAmt", "crto", "cpConv"))
    return ApiResponse(success=True, data={
        "configured": True,
        "requested_fields": used_fields,
        "returned_keys": keys_seen,          # 네이버가 실제 돌려준 필드명
        "has_conversion_field": has_conv,    # 전환 필드가 응답에 있는지
        "sample_count": len(rows),
        "rows": rows[:limit],                # 원본 행(키/값) — 전환 필드명 확인용
        "note": (
            "ccnt/convAmt 등 전환 필드가 보이고 값이 0보다 크면 전환율이 계산됩니다. "
            "전환 필드가 없거나 모두 0이면, 네이버 광고의 '전환추적(프리미엄 로그분석)'이 "
            "설정되어 있어야 전환 데이터가 집계됩니다."
        ),
    })


# --------------------------------------------------------------------------- #
# 시간대/요일 입찰 가중치 (dayparting)
# --------------------------------------------------------------------------- #
class DaypartingBody(BaseModel):
    raw_text: Optional[str] = None
    hours: Optional[List[Dict[str, Any]]] = None
    weekdays: Optional[List[Dict[str, Any]]] = None


@router.post("/dayparting-plan")
def dayparting_plan(body: DaypartingBody, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_admin_user)):
    """
    네이버 프리미엄 로그 분석의 시간대/요일 리포트를 받아 입찰 가중치를 산출한다.
    개인정보 없음(방문/문의/체류 지표만).
    """
    from app.services.naver_ads_dayparting import parse_dayparting, compute_dayparting_plan
    if body.raw_text:
        hours, weekdays = parse_dayparting(body.raw_text)
    else:
        hours, weekdays = (body.hours or []), (body.weekdays or [])
    if not hours and not weekdays:
        return ApiResponse(success=False, message="시간대/요일 데이터를 인식하지 못했습니다. 리포트를 그대로 붙여넣어 주세요.")
    plan = compute_dayparting_plan(hours, weekdays)
    return ApiResponse(success=True, data=plan)


# --------------------------------------------------------------------------- #
# 시간대 자동 입찰 설정 / 실행
# --------------------------------------------------------------------------- #
class DaypartingConfigBody(BaseModel):
    enabled: bool = False
    campaign_id: Optional[str] = None
    adgroup_id: Optional[str] = None
    hour_multipliers: Optional[Dict[str, float]] = None     # {"0":0.9,...}
    weekday_multipliers: Optional[Dict[str, float]] = None  # {"월":1.0,...}
    dry_run: bool = True
    min_bid: int = 70
    recapture_base: bool = True   # 저장 시 현재 입찰가를 기준(base)으로 재캡처


def _config_view(cfg) -> Dict[str, Any]:
    import json as _j
    base = {}
    try:
        base = _j.loads(cfg.base_bids) if cfg.base_bids else {}
    except Exception:
        base = {}
    last = None
    try:
        last = _j.loads(cfg.last_run_summary) if cfg.last_run_summary else None
    except Exception:
        last = None
    return {
        "enabled": cfg.enabled,
        "campaign_id": cfg.campaign_id,
        "adgroup_id": cfg.adgroup_id,
        "hour_multipliers": _j.loads(cfg.hour_multipliers) if cfg.hour_multipliers else {},
        "weekday_multipliers": _j.loads(cfg.weekday_multipliers) if cfg.weekday_multipliers else {},
        "dry_run": cfg.dry_run,
        "min_bid": cfg.min_bid,
        "base_keyword_count": len(base),
        "last_run_at": cfg.last_run_at.isoformat() if cfg.last_run_at else None,
        "last_run_summary": last,
    }


@router.get("/dayparting-config")
def get_dayparting_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    from app.services.naver_ads_scheduler import get_or_create_config, current_multiplier
    cfg = get_or_create_config(db)
    view = _config_view(cfg)
    view["current_multiplier"] = current_multiplier(cfg)
    return ApiResponse(success=True, data=view)


@router.post("/dayparting-config")
def save_dayparting_config(body: DaypartingConfigBody, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_admin_user)):
    import json as _j
    from app.services.naver_ads_scheduler import get_or_create_config, capture_base_bids, current_multiplier
    cfg = get_or_create_config(db)
    cfg.enabled = body.enabled
    cfg.campaign_id = body.campaign_id
    cfg.adgroup_id = body.adgroup_id
    if body.hour_multipliers is not None:
        cfg.hour_multipliers = _j.dumps({str(k): float(v) for k, v in body.hour_multipliers.items()})
    if body.weekday_multipliers is not None:
        cfg.weekday_multipliers = _j.dumps({str(k): float(v) for k, v in body.weekday_multipliers.items()})
    cfg.dry_run = body.dry_run
    cfg.min_bid = int(body.min_bid or 70)
    cfg.updated_by = current_user.id

    # 기준 입찰가 캡처 (현재 입찰가 = 가중치 1.0 기준)
    if body.recapture_base or not cfg.base_bids:
        client, ok = _client_or_unconfigured()
        if ok:
            try:
                base = capture_base_bids(client, body.campaign_id, body.adgroup_id)
                cfg.base_bids = _j.dumps(base, ensure_ascii=False)
            except NaverAdsError:
                pass

    db.add(cfg); db.commit(); db.refresh(cfg)
    view = _config_view(cfg)
    view["current_multiplier"] = current_multiplier(cfg)
    return ApiResponse(success=True, data=view)


@router.post("/dayparting-run-now")
def dayparting_run_now(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    from app.services.naver_ads_scheduler import run_dayparting_once, apply_keyword_schedules
    kw = apply_keyword_schedules(db)
    mult = run_dayparting_once(db, force=True, triggered_by=f"manual:{current_user.id}")
    return ApiResponse(success=True, data={"keyword_schedules": kw, "dayparting": mult})


# --------------------------------------------------------------------------- #
# 키워드별 시간 입찰표
# --------------------------------------------------------------------------- #
@router.get("/keyword-schedules")
def list_keyword_schedules(
    campaign_id: Optional[str] = Query(None),
    adgroup_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    import json as _j
    from app.models.naver_ads import NaverAdKeywordSchedule
    client, ok = _client_or_unconfigured()
    if not ok:
        return ApiResponse(success=True, data={"configured": False, "keywords": []})

    # 현재 입찰가 + 이름
    try:
        camp_name = {c.get("nccCampaignId"): c.get("name") for c in client.get_campaigns()}
        ag_rows = client.get_adgroups(campaign_id)
        ag_name = {a.get("nccAdgroupId"): a.get("name") for a in ag_rows}
        ag_camp = {a.get("nccAdgroupId"): a.get("nccCampaignId") for a in ag_rows}
        if adgroup_id:
            raw = client.get_keywords(adgroup_id)
        elif campaign_id:
            raw = []
            for a in ag_rows:
                raw.extend(client.get_keywords(a.get("nccAdgroupId")))
        else:
            raw = client.get_keywords()
    except NaverAdsError:
        return ApiResponse(success=False, message="키워드를 불러오지 못했습니다.", data={"configured": True, "keywords": []})

    saved = {s.keyword_id: s for s in db.query(NaverAdKeywordSchedule).all()}
    out = []
    for k in raw:
        n = _norm_keyword(k)
        sch = saved.get(n["keyword_id"])
        ag_id = n["adgroup_id"]
        out.append({
            "keyword_id": n["keyword_id"],
            "keyword": n["keyword"],
            "campaign_name": camp_name.get(ag_camp.get(ag_id)),
            "adgroup_name": ag_name.get(ag_id),
            "adgroup_id": ag_id,
            "current_bid": n["current_bid"],
            "enabled": bool(sch.enabled) if sch else False,
            "hourly_bids": (_j.loads(sch.hourly_bids) if (sch and sch.hourly_bids) else {}),
        })
    return ApiResponse(success=True, data={"configured": True, "keywords": out})


class KeywordScheduleItem(BaseModel):
    keyword_id: str
    keyword: Optional[str] = None
    campaign_name: Optional[str] = None
    adgroup_name: Optional[str] = None
    adgroup_id: Optional[str] = None
    enabled: bool = True
    hourly_bids: Dict[str, int] = Field(default_factory=dict)


class KeywordScheduleBody(BaseModel):
    items: List[KeywordScheduleItem] = Field(default_factory=list)


@router.post("/keyword-schedules")
def save_keyword_schedules(body: KeywordScheduleBody, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_admin_user)):
    import json as _j
    from app.models.naver_ads import NaverAdKeywordSchedule
    saved = 0
    for it in body.items:
        row = db.query(NaverAdKeywordSchedule).filter(
            NaverAdKeywordSchedule.keyword_id == it.keyword_id).first()
        # 0~23 정수 키만, 양수 입찰가만 저장
        hb = {str(int(h)): int(v) for h, v in (it.hourly_bids or {}).items()
              if str(h).isdigit() and 0 <= int(h) <= 23 and int(v) > 0}
        if not row:
            row = NaverAdKeywordSchedule(keyword_id=it.keyword_id)
            db.add(row)
        row.keyword = it.keyword
        row.campaign_name = it.campaign_name
        row.adgroup_name = it.adgroup_name
        row.adgroup_id = it.adgroup_id
        row.enabled = it.enabled
        row.hourly_bids = _j.dumps(hb)
        row.updated_by = current_user.id
        saved += 1
    db.commit()
    return ApiResponse(success=True, data={"saved": saved})


@router.get("/keyword-schedule/{keyword_id}")
def get_keyword_schedule(keyword_id: str, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_admin_user)):
    import json as _j
    from app.models.naver_ads import NaverAdKeywordSchedule
    row = db.query(NaverAdKeywordSchedule).filter(
        NaverAdKeywordSchedule.keyword_id == keyword_id).first()
    if not row:
        return ApiResponse(success=True, data={"exists": False, "enabled": True, "hourly_bids": {}})
    return ApiResponse(success=True, data={
        "exists": True,
        "enabled": bool(row.enabled),
        "hourly_bids": _j.loads(row.hourly_bids) if row.hourly_bids else {},
    })


@router.get("/keyword-detail/{keyword_id}")
def keyword_detail(keyword_id: str, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_admin_user)):
    """단일 키워드 상세(현재 입찰가/광고그룹/캠페인 + 저장된 시간 스케줄)."""
    import json as _j
    from app.models.naver_ads import NaverAdKeywordSchedule
    client, ok = _client_or_unconfigured()
    info: Dict[str, Any] = {
        "keyword_id": keyword_id, "keyword": None, "current_bid": 0,
        "campaign_name": None, "adgroup_name": None, "adgroup_id": None,
        "tier": None, "configured": ok,
    }
    if ok:
        try:
            objs = client.request("GET", "/ncc/keywords", params={"ids": [keyword_id]}) or []
            if objs:
                o = objs[0]
                info["keyword"] = o.get("keyword")
                info["current_bid"] = int(o.get("bidAmt") or 0)
                ag_id = o.get("nccAdgroupId")
                info["adgroup_id"] = ag_id
                ag_map = {a.get("nccAdgroupId"): a for a in client.get_adgroups()}
                camp_map = {c.get("nccCampaignId"): c.get("name") for c in client.get_campaigns()}
                a = ag_map.get(ag_id) or {}
                info["adgroup_name"] = a.get("name")
                info["campaign_name"] = camp_map.get(a.get("nccCampaignId"))
                info["tier"] = classify_tier(info["keyword"] or "")
        except NaverAdsError:
            pass
    row = db.query(NaverAdKeywordSchedule).filter(
        NaverAdKeywordSchedule.keyword_id == keyword_id).first()
    info["schedule"] = {
        "exists": bool(row),
        "enabled": bool(row.enabled) if row else True,
        "hourly_bids": (_j.loads(row.hourly_bids) if (row and row.hourly_bids) else {}),
    }
    return ApiResponse(success=True, data=info)
