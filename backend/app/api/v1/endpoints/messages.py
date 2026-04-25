from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.message_log import MessageLog, MessageStatus
from app.models.guardian import Guardian
from app.models.resident import Resident
from app.models.user import User
from app.schemas.message import MessageSendRequest, MessageLogResponse
from app.schemas.response import ApiResponse
from app.services.kakao import KakaoMessageService

router = APIRouter()


@router.post("/send", response_model=ApiResponse)
async def send_message(
    payload: MessageSendRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # 입소자 존재 확인
    resident = db.query(Resident).filter(Resident.id == payload.resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    # 카카오 서비스 초기화
    kakao_service = KakaoMessageService()
    results = []
    
    for guardian_id in payload.guardian_ids:
        guardian = db.query(Guardian).filter(Guardian.id == guardian_id).first()
        
        if not guardian or not guardian.receive_kakao:
            continue
        
        try:
            # 카카오 발송
            result = await kakao_service.send_message(
                phone=guardian.phone,
                message=payload.message_content,
                photo_urls=payload.photo_urls
            )
            
            # 로그 저장
            log = MessageLog(
                resident_id=payload.resident_id,
                guardian_id=guardian_id,
                message_content=payload.message_content,
                photo_urls=payload.photo_urls,
                status=MessageStatus.SUCCESS.value if result.success else MessageStatus.FAILED.value,
                error_message=result.error
            )
            db.add(log)
            
            results.append({
                "guardian_id": guardian_id,
                "success": result.success,
                "log_id": None  # Will be set after commit
            })
        
        except Exception as e:
            # 실패 로그
            log = MessageLog(
                resident_id=payload.resident_id,
                guardian_id=guardian_id,
                message_content=payload.message_content,
                photo_urls=payload.photo_urls,
                status=MessageStatus.FAILED.value,
                error_message=str(e)
            )
            db.add(log)
            
            results.append({
                "guardian_id": guardian_id,
                "success": False,
                "error": str(e)
            })
    
    db.commit()
    
    return ApiResponse(success=True, data={"results": results})


@router.get("/logs", response_model=ApiResponse)
def get_message_logs(
    resident_id: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(MessageLog)
    
    if resident_id:
        query = query.filter(MessageLog.resident_id == resident_id)
    
    logs = query.order_by(MessageLog.sent_at.desc()).limit(limit).all()
    
    # 데이터 변환 (resident, guardian 이름 포함)
    data = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "resident_id": log.resident_id,
            "guardian_id": log.guardian_id,
            "message_content": log.message_content,
            "photo_urls": log.photo_urls or [],
            "status": log.status,
            "error_message": log.error_message,
            "sent_at": log.sent_at,
            "resident_name": log.resident.name if log.resident else None,
            "guardian_name": log.guardian.name if log.guardian else None,
            "guardian_phone": log.guardian.phone if log.guardian else None,
        }
        data.append(log_dict)
    
    return ApiResponse(success=True, data=data)