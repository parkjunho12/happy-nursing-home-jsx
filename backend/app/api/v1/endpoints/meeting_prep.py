"""회의 준비 — 카카오톡 대화(txt·csv) → 회의 준비 문서. ADMIN 전용.

대화 원문과 준비 문서 모두 관리자만 볼 수 있다.
"""
import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.meeting import MeetingPrep
from app.models.user import User
from app.schemas.response import ApiResponse
from app.services.meeting_ai import prepare_meeting_chat

router = APIRouter()

MAX_FILE = 5 * 1024 * 1024
MAX_SOURCE_CHARS = 300_000   # DB 에 남길 원문 상한 (초과분은 앞부분을 버린다)


def _admin_only(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(403, "회의 준비는 관리자만 사용할 수 있습니다.")
    return current_user


def _view(p: MeetingPrep, with_source: bool = False) -> dict:
    d = {
        "id": p.id, "title": p.title, "content": p.content,
        "source_name": p.source_name, "model": p.model,
        "author_name": p.author_name,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
    if with_source:
        d["source_text"] = p.source_text
    return d


def _csv_to_text(raw: str) -> str:
    """카카오톡 CSV 내보내기(날짜,이름,메시지) → 모바일 txt 와 같은 줄 형식."""
    lines = []
    for row in csv.reader(io.StringIO(raw)):
        cells = [c.strip() for c in row]
        if not any(cells):
            continue
        if len(cells) >= 3:
            lines.append(f"{cells[0]}, {cells[1]} : {','.join(cells[2:])}")
        else:
            lines.append(" ".join(cells))
    return "\n".join(lines)


@router.post("", status_code=201)
async def create_prep(file: UploadFile = File(...),
                      db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_only)):
    """카카오톡 대화 내보내기(txt·csv) 하나로 회의 준비 문서를 만든다 — 버튼 하나."""
    name = (file.filename or "").lower()
    if not name.endswith((".txt", ".csv")):
        raise HTTPException(400, "카카오톡 '대화 내용 내보내기'로 저장한 .txt 또는 .csv 파일을 올려주세요.")
    data = await file.read()
    if len(data) > MAX_FILE:
        raise HTTPException(400, "파일이 너무 큽니다(최대 5MB). 최근 대화만 내보내 주세요.")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        text = data.decode("cp949", errors="replace")   # 윈도우 PC 내보내기 대비
    if name.endswith(".csv"):
        text = _csv_to_text(text)

    result, err = prepare_meeting_chat(text)
    if not result:
        raise HTTPException(502, f"회의 준비 문서 생성에 실패했습니다. ({err})")

    row = MeetingPrep(
        title=result["title"], content=result["content"],
        source_name=(file.filename or None),
        source_text=text[-MAX_SOURCE_CHARS:],
        model=settings.CLAUDE_MODEL,
        author_name=getattr(current_user, "name", None),
    )
    db.add(row); db.commit(); db.refresh(row)
    return ApiResponse(success=True, data=_view(row))


@router.get("")
def list_preps(db: Session = Depends(get_db), _: User = Depends(_admin_only)):
    rows = (db.query(MeetingPrep)
            .order_by(MeetingPrep.created_at.desc()).limit(50).all())
    return ApiResponse(success=True, data=[_view(r) for r in rows])


@router.get("/{pid}")
def get_prep(pid: str, db: Session = Depends(get_db), _: User = Depends(_admin_only)):
    r = db.query(MeetingPrep).filter(MeetingPrep.id == pid).first()
    if not r:
        raise HTTPException(404, "문서를 찾을 수 없습니다.")
    return ApiResponse(success=True, data=_view(r, with_source=True))


@router.delete("/{pid}")
def delete_prep(pid: str, db: Session = Depends(get_db), _: User = Depends(_admin_only)):
    r = db.query(MeetingPrep).filter(MeetingPrep.id == pid).first()
    if not r:
        raise HTTPException(404, "문서를 찾을 수 없습니다.")
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")
