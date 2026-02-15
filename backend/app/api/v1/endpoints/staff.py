from fastapi import APIRouter, Depends
from app.core.security import get_current_admin_user

router = APIRouter()

@router.get("")
async def list_staff(current_user: dict = Depends(get_current_admin_user)):
    """직원 목록"""
    return {"success": True, "data": []}

@router.post("")
async def create_staff(data: dict, current_user: dict = Depends(get_current_admin_user)):
    """직원 등록"""
    return {"success": True, "message": "직원이 등록되었습니다"}