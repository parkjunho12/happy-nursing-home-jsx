"""
시간대/요일 자동 입찰 조정 스케줄러 로직.

기준(base) 입찰가 대비 현재 시각 가중치를 곱해 입찰가를 설정한다.
  bid = clamp(base_bid * hour_mult * weekday_mult, min_bid, base_bid*MAX_RANGE)
'기준 대비'로 계산하므로 매시간 실행해도 값이 드리프트(누적)되지 않는다.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from app.models.naver_ads import NaverAdBidChangeLog, NaverAdsDaypartingConfig, now_kst
from app.services.naver_ads_client import get_naver_ads_client, NaverAdsError

logger = logging.getLogger("naver_ads")

KST = timezone(timedelta(hours=9))
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]
MULT_MIN, MULT_MAX = 0.7, 1.3
BID_ROUND = 10


def get_or_create_config(db) -> NaverAdsDaypartingConfig:
    cfg = db.query(NaverAdsDaypartingConfig).filter(NaverAdsDaypartingConfig.id == "default").first()
    if not cfg:
        cfg = NaverAdsDaypartingConfig(id="default", enabled=False, dry_run=True, min_bid=70)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _json_load(text: Optional[str], default):
    if not text:
        return default
    try:
        return json.loads(text)
    except Exception:
        return default


def current_multiplier(cfg: NaverAdsDaypartingConfig, when: Optional[datetime] = None) -> float:
    when = when or datetime.now(KST)
    hours = _json_load(cfg.hour_multipliers, {})
    days = _json_load(cfg.weekday_multipliers, {})
    hm = float(hours.get(str(when.hour), 1.0) or 1.0)
    wm = float(days.get(WEEKDAYS[when.weekday()], 1.0) or 1.0)
    return round(max(MULT_MIN, min(MULT_MAX, hm * wm)), 2)


def capture_base_bids(client, campaign_id: Optional[str], adgroup_id: Optional[str]) -> Dict[str, Any]:
    """현재 입찰가를 기준(base)으로 캡처. {keyword_id: {bid, keyword, adgroup_name, campaign_name}}"""
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

    base: Dict[str, Any] = {}
    for k in raw:
        kid = k.get("nccKeywordId") or k.get("id")
        if not kid:
            continue
        ag_id = k.get("nccAdgroupId")
        base[kid] = {
            "bid": int(k.get("bidAmt") or 0),
            "keyword": k.get("keyword"),
            "adgroup_id": ag_id,
            "adgroup_name": ag_name.get(ag_id),
            "campaign_name": camp_name.get(ag_camp.get(ag_id)),
        }
    return base


def _current_bids(client, campaign_id, adgroup_id) -> Dict[str, int]:
    if adgroup_id:
        raw = client.get_keywords(adgroup_id)
    elif campaign_id:
        raw = []
        for a in client.get_adgroups(campaign_id):
            raw.extend(client.get_keywords(a.get("nccAdgroupId")))
    else:
        raw = client.get_keywords()
    return {(k.get("nccKeywordId") or k.get("id")): int(k.get("bidAmt") or 0) for k in raw}


def run_dayparting_once(db, *, force: bool = False, triggered_by: str = "scheduler") -> Dict[str, Any]:
    """현재 시각 가중치로 입찰가를 1회 조정한다. 결과 요약 반환."""
    cfg = get_or_create_config(db)
    if not cfg.enabled and not force:
        return {"ran": False, "reason": "disabled"}

    base = _json_load(cfg.base_bids, {})
    if not base:
        return {"ran": False, "reason": "no_base_bids"}

    now = datetime.now(KST)
    # 같은 시각(시간 단위) 중복 실행 방지 (멀티워커/재시작 대비) — force면 무시
    if not force and cfg.last_run_at:
        last = cfg.last_run_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=KST)
        if last.astimezone(KST).strftime("%Y%m%d%H") == now.strftime("%Y%m%d%H"):
            return {"ran": False, "reason": "already_ran_this_hour"}

    mult = current_multiplier(cfg, now)
    client = get_naver_ads_client()
    if not client.is_configured:
        return {"ran": False, "reason": "not_configured"}

    try:
        cur_bids = _current_bids(client, cfg.campaign_id, cfg.adgroup_id)
    except NaverAdsError:
        return {"ran": False, "reason": "fetch_failed"}

    min_bid = int(cfg.min_bid or 70)
    applied = failed = skipped = 0
    changes = []

    for kid, info in base.items():
        base_bid = int(info.get("bid") or 0)
        if base_bid <= 0:
            skipped += 1
            continue
        target = int(round((base_bid * mult) / BID_ROUND) * BID_ROUND)
        target = max(min_bid, target)
        cur = cur_bids.get(kid)
        if cur is not None and cur == target:
            skipped += 1
            continue

        log = NaverAdBidChangeLog(
            keyword_id=kid, keyword=info.get("keyword"),
            campaign_name=info.get("campaign_name"), adgroup_name=info.get("adgroup_name"),
            old_bid=cur if cur is not None else base_bid, new_bid=target,
            change_rate=round(((target - (cur or base_bid)) / (cur or base_bid)), 4) if (cur or base_bid) else 0,
            reason=f"시간대 자동조정 ({now.strftime('%a %H시')}, x{mult})",
            suggested_by="dayparting", approved_by_user_id=cfg.updated_by, status="pending",
        )

        if cfg.dry_run:
            log.status = "dry_run"; log.raw_response = "dry_run"
            db.add(log); skipped += 1
            continue
        try:
            resp = client.update_keyword_bid(kid, target, adgroup_id=info.get("adgroup_id"))
            log.status = "applied"; log.applied_at = now_kst()
            log.raw_response = json.dumps({"bidAmt": (resp or {}).get("bidAmt", target)}, ensure_ascii=False)
            db.add(log); applied += 1
            changes.append({"keyword": info.get("keyword"), "from": cur, "to": target})
            time.sleep(0.05)  # 레이트리밋 버스트 방지
        except NaverAdsError as e:
            log.status = "failed"
            log.raw_response = json.dumps({"status_code": e.status_code, "error_code": e.error_code, "detail": e.detail}, ensure_ascii=False)
            db.add(log); failed += 1

    summary = {
        "ran": True, "multiplier": mult, "hour": now.hour, "weekday": WEEKDAYS[now.weekday()],
        "dry_run": cfg.dry_run, "applied": applied, "failed": failed, "skipped": skipped,
        "changes": changes[:20],
    }
    cfg.last_run_at = now_kst()
    cfg.last_run_summary = json.dumps(summary, ensure_ascii=False)
    db.add(cfg)
    db.commit()
    try:
        if applied:
            client.clear_cache()
    except Exception:
        pass
    logger.info("dayparting run: mult=%s applied=%s failed=%s skipped=%s dry=%s",
                mult, applied, failed, skipped, cfg.dry_run)
    return summary


# --------------------------------------------------------------------------- #
# 키워드별 시간 입찰표 적용
# --------------------------------------------------------------------------- #
def apply_keyword_schedules(db, *, force: bool = False, dry_run: Optional[bool] = None) -> Dict[str, Any]:
    """
    각 키워드의 시간별(0~23) 입찰가 스케줄을 현재 시각에 맞춰 적용한다.
    dry_run 미지정 시 dayparting config의 dry_run 을 따른다.
    """
    from app.models.naver_ads import NaverAdKeywordSchedule

    rows = db.query(NaverAdKeywordSchedule).filter(NaverAdKeywordSchedule.enabled == True).all()  # noqa: E712
    if not rows:
        return {"ran": False, "reason": "no_schedules"}

    cfg = get_or_create_config(db)
    effective_dry = cfg.dry_run if dry_run is None else dry_run
    min_bid = int(cfg.min_bid or 70)

    client = get_naver_ads_client()
    if not client.is_configured:
        return {"ran": False, "reason": "not_configured"}

    now = datetime.now(KST)
    hkey = str(now.hour)

    # 대상 키워드들의 현재 입찰가 맵 (광고그룹 단위로 조회, 캐시 활용)
    cur_bids: Dict[str, int] = {}
    ag_ids = {r.adgroup_id for r in rows if r.adgroup_id}
    try:
        if ag_ids:
            for ag in ag_ids:
                for k in client.get_keywords(ag):
                    kid = k.get("nccKeywordId") or k.get("id")
                    if kid:
                        cur_bids[kid] = int(k.get("bidAmt") or 0)
        else:
            for k in client.get_keywords():
                kid = k.get("nccKeywordId") or k.get("id")
                if kid:
                    cur_bids[kid] = int(k.get("bidAmt") or 0)
    except NaverAdsError:
        cur_bids = {}

    applied = failed = skipped = 0
    for r in rows:
        bids = _json_load(r.hourly_bids, {})
        if hkey not in bids:
            skipped += 1
            continue
        target = max(min_bid, int(round(float(bids[hkey]) / BID_ROUND) * BID_ROUND))
        cur = cur_bids.get(r.keyword_id)
        if cur is not None and cur == target:
            skipped += 1
            continue

        log = NaverAdBidChangeLog(
            keyword_id=r.keyword_id, keyword=r.keyword,
            campaign_name=r.campaign_name, adgroup_name=r.adgroup_name,
            old_bid=cur, new_bid=target,
            change_rate=round(((target - cur) / cur), 4) if cur else 0,
            reason=f"키워드 시간표 ({now.strftime('%H시')})",
            suggested_by="keyword_schedule", approved_by_user_id=r.updated_by, status="pending",
        )
        if effective_dry:
            log.status = "dry_run"; log.raw_response = "dry_run"
            db.add(log); skipped += 1
            continue
        try:
            resp = client.update_keyword_bid(r.keyword_id, target, adgroup_id=r.adgroup_id)
            log.status = "applied"; log.applied_at = now_kst()
            log.raw_response = json.dumps({"bidAmt": (resp or {}).get("bidAmt", target)}, ensure_ascii=False)
            db.add(log); applied += 1
            time.sleep(0.05)  # 레이트리밋 버스트 방지
        except NaverAdsError as e:
            log.status = "failed"
            log.raw_response = json.dumps({"status_code": e.status_code, "error_code": e.error_code, "detail": e.detail}, ensure_ascii=False)
            db.add(log); failed += 1

    db.commit()
    try:
        if applied:
            client.clear_cache()
    except Exception:
        pass
    return {"ran": True, "hour": now.hour, "dry_run": effective_dry,
            "applied": applied, "failed": failed, "skipped": skipped}


LOG_RETENTION_DAYS = 90


def cleanup_old_bid_logs(db, days: int = LOG_RETENTION_DAYS) -> int:
    """오래된 입찰 변경 로그 정리. 삭제 행 수 반환."""
    cutoff = now_kst() - timedelta(days=days)
    try:
        deleted = db.query(NaverAdBidChangeLog).filter(
            NaverAdBidChangeLog.created_at < cutoff
        ).delete(synchronize_session=False)
        db.commit()
        if deleted:
            logger.info("naver_ads: cleaned up %s old bid logs (>%sd)", deleted, days)
        return int(deleted or 0)
    except Exception as e:
        db.rollback()
        logger.warning("bid log cleanup failed: %s", type(e).__name__)
        return 0


def run_hourly(db) -> Dict[str, Any]:
    """매시 실행: 키워드 시간표 + 시간대 가중치 둘 다 적용. 매일 04시 로그 정리."""
    kw = apply_keyword_schedules(db)
    mult = run_dayparting_once(db, triggered_by="scheduler")
    cleaned = 0
    if datetime.now(KST).hour == 4:
        cleaned = cleanup_old_bid_logs(db)
    return {"keyword_schedules": kw, "dayparting": mult, "logs_cleaned": cleaned}
