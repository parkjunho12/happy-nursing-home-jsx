"""
Simple Click Tracking API - 부정클릭 방지 + 팝업
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.models.click_event import ClickEvent

router = APIRouter()


def get_client_ip(request: Request) -> str:
    """클라이언트 IP 추출"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    if request.client:
        return request.client.host
    
    return "unknown"


def is_suspicious(ip_hash: str, db: Session) -> bool:
    """부정클릭 감지"""
    now = datetime.utcnow()
    
    # 1시간 내 5회 이상?
    one_hour_ago = now - timedelta(hours=1)
    recent_clicks = db.query(ClickEvent).filter(
        and_(
            ClickEvent.ip_hash == ip_hash,
            ClickEvent.created_at >= one_hour_ago
        )
    ).count()
    
    if recent_clicks >= 5:
        return True
    
    # 하루 내 10회 이상?
    one_day_ago = now - timedelta(days=1)
    daily_clicks = db.query(ClickEvent).filter(
        and_(
            ClickEvent.ip_hash == ip_hash,
            ClickEvent.created_at >= one_day_ago
        )
    ).count()
    
    return daily_clicks >= 10


def should_show_help_popup(ip_hash: str, event_type: str, db: Session) -> bool:
    """
    도움 팝업 표시 여부 판단
    같은 페이지를 1시간 내 3회 방문하면 True (테스트용)
    """
    # 페이지뷰 이벤트만 체크
    if not event_type.startswith('page_view_'):
        return False
    
    now = datetime.utcnow()
    one_hour_ago = now - timedelta(hours=1)
    
    # 같은 페이지 방문 횟수
    same_page_visits = db.query(ClickEvent).filter(
        and_(
            ClickEvent.ip_hash == ip_hash,
            ClickEvent.event_type == event_type,
            ClickEvent.created_at >= one_hour_ago
        )
    ).count()
    
    # 3회 이상 방문 시 팝업 표시 (테스트용 - 원래는 10회)
    return same_page_visits >= 3


# ========== Public API ==========

@router.post("/click")
async def track_click(
    event_type: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    클릭 추적 (IP 자동 수집)
    + 반복 방문 감지
    """
    # IP 추출 및 해싱
    client_ip = get_client_ip(request)
    ip_hash = ClickEvent.hash_ip(client_ip)
    
    # 부정클릭 감지
    suspicious = is_suspicious(ip_hash, db)
    
    # 도움 팝업 표시 여부
    show_popup = should_show_help_popup(ip_hash, event_type, db)
    
    # 저장
    click = ClickEvent(
        ip_hash=ip_hash,
        event_type=event_type,
        is_suspicious=suspicious
    )
    
    db.add(click)
    db.commit()
    
    # 디버깅용 로그
    print(f"[Track] {event_type} | IP: {ip_hash[:16]}... | Popup: {show_popup}")
    
    return {
        "success": True,
        "is_suspicious": suspicious,
        "show_help_popup": show_popup,
        "page": event_type.replace('page_view_', '') if event_type.startswith('page_view_') else None
    }


# ========== Admin API ==========

@router.get("/stats")
async def get_stats(
    days: int = 7,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """클릭 통계 (Admin)"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # 전체 클릭
    total = db.query(ClickEvent).filter(
        ClickEvent.created_at >= start_date
    ).count()
    
    # 의심 클릭
    suspicious = db.query(ClickEvent).filter(
        and_(
            ClickEvent.created_at >= start_date,
            ClickEvent.is_suspicious == True
        )
    ).count()
    
    # 고유 IP
    unique_ips = db.query(func.count(func.distinct(ClickEvent.ip_hash))).filter(
        ClickEvent.created_at >= start_date
    ).scalar()
    
    return {
        "total_clicks": total,
        "suspicious_clicks": suspicious,
        "unique_ips": unique_ips or 0,
        "suspicious_rate": f"{(suspicious/total*100):.1f}%" if total > 0 else "0%"
    }


@router.get("/suspicious")
async def get_suspicious_ips(
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """의심스러운 IP 목록 (Admin)"""
    # IP별 클릭 수 집계
    result = db.query(
        ClickEvent.ip_hash,
        func.count(ClickEvent.id).label('count'),
        func.max(ClickEvent.created_at).label('last_click')
    ).group_by(ClickEvent.ip_hash).all()
    
    # 10회 이상 클릭한 IP만
    suspicious = [
        {
            "ip_hash": ip_hash[:16] + "...",
            "click_count": count,
            "last_click": last_click.isoformat()
        }
        for ip_hash, count, last_click in result
        if count >= 10
    ]
    
    # 클릭 수 기준 정렬
    suspicious.sort(key=lambda x: x['click_count'], reverse=True)
    
    return suspicious


@router.get("/all")
async def get_all_events(
    days: int = 7,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """전체 이벤트 조회 (Admin)"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    events = db.query(ClickEvent).filter(
        ClickEvent.created_at >= start_date
    ).all()
    
    return [
        {
            "event_type": e.event_type,
            "ip_hash": e.ip_hash,
            "created_at": e.created_at.isoformat(),
            "is_suspicious": e.is_suspicious
        }
        for e in events
    ]