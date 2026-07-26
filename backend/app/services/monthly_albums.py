"""월별 보호자 앨범 자동 생성.

매월 초, 재원 중인 어르신 전원에게 그 달 앨범을 만들어준다 (퇴소자 제외).
인사말은 ChatGPT로 계절·시설 분위기에 맞게 한 번 생성해 전원이 공유한다.
멱등: 같은 달 앨범이 이미 있으면 건너뛴다 — 몇 번을 돌려도 안전.
"""
from __future__ import annotations
import logging
import uuid
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.album import Album
from app.models.eval import LtcResident

logger = logging.getLogger(__name__)

# AI 실패·키 없음 대비 폴백 — 계절감 있는 기본 인사말
FALLBACK = {
    1: "새해의 첫 달, 어르신들의 건강한 웃음으로 문을 엽니다. 한 달의 일상을 차곡차곡 담아드릴게요.",
    2: "아직 쌀쌀하지만 봄이 저만치 오고 있어요. 따뜻한 실내에서 보내는 정겨운 하루하루를 전해드립니다.",
    3: "봄기운이 스며드는 3월, 창가의 햇살처럼 포근한 순간들을 담았습니다.",
    4: "꽃피는 4월, 산책과 프로그램으로 활기찬 어르신들의 모습을 만나보세요.",
    5: "가정의 달 5월, 가족을 향한 그리움과 사랑이 가득한 날들을 기록합니다.",
    6: "초여름의 싱그러움 속에서 건강하게 지내시는 모습을 전해드려요.",
    7: "무더위도 잊게 하는 어르신들의 환한 미소, 7월의 일상을 담았습니다.",
    8: "한여름의 시원한 실내에서 즐겁게 보내시는 하루하루를 공유합니다.",
    9: "선선한 바람이 반가운 9월, 풍성한 한가위처럼 넉넉한 일상을 담았어요.",
    10: "단풍처럼 곱게 물든 10월의 나날, 어르신들의 가을 이야기를 전합니다.",
    11: "깊어가는 가을, 따뜻한 차 한 잔 같은 포근한 순간들을 모았습니다.",
    12: "한 해를 마무리하는 12월, 감사한 마음을 담아 어르신들의 겨울 일상을 전해드립니다.",
}


def generate_month_text(year: int, month: int) -> str:
    """그 달 앨범 인사말 — ChatGPT 1회 호출, 실패하면 폴백."""
    if not settings.OPENAI_API_KEY:
        return FALLBACK[month]
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        r = client.chat.completions.create(
            model=settings.OPENAI_MODEL or "gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": (
                    f"당신은 '행복한요양원'(경기 양주, 노인요양시설)의 따뜻한 안내 문구 작성자입니다. "
                    f"{year}년 {month}월 보호자 가족 앨범의 소개 인사말을 한국어로 2~3문장, 120자 이내로 써주세요. "
                    f"{month}월의 계절감을 담고, 보호자(가족)가 읽는 글이며, 어르신들의 한 달 일상을 사진으로 전한다는 내용. "
                    f"과장 없이 다정하게. 이모지는 1개까지만. 문구만 출력."
                ),
            }],
            max_tokens=200, temperature=0.8, timeout=20,
        )
        text = (r.choices[0].message.content or "").strip().strip('"')
        return text if 10 <= len(text) <= 200 else FALLBACK[month]
    except Exception as e:
        logger.warning("월별 앨범 인사말 생성 실패 — 폴백 사용: %s", e)
        return FALLBACK[month]


def ensure_monthly_albums(db: Session, year: int, month: int) -> dict:
    """재원 어르신 전원에게 그 달 앨범 보장.

    중복 판단은 제목이 아니라 '수급자 + 그 달' — 어르신이 그 달에 만든 앨범이
    하나라도 있으면(직접 만든 것 포함) 건너뛴다. 제목을 바꿔도 안전하다."""
    from datetime import datetime, timezone, timedelta
    KST = timezone(timedelta(hours=9))
    m_start = datetime(year, month, 1, tzinfo=KST)
    m_end = datetime(year + (month == 12), (month % 12) + 1, 1, tzinfo=KST)

    title_of = lambda name: f"{year}년 {month}월 · {name} 어르신"  # noqa: E731
    residents = (db.query(LtcResident)
                 .filter(LtcResident.status == "active").all())

    # 그 달에 앨범이 이미 있는 수급자 집합 — 자동 생성분이든 손으로 만든 것이든
    has_album = {a.resident_id for a in db.query(Album).filter(
        Album.created_at >= m_start, Album.created_at < m_end).all()}
    # 제목 규칙으로 만들어진 그 달 앨범도 포함 (생성일이 어긋난 경우 대비)
    prefix = f"{year}년 {month}월"
    has_album |= {a.resident_id for a in db.query(Album)
                  .filter(Album.title.like(f"{prefix}%")).all()}

    created, skipped = [], 0
    month_text = None
    for r in residents:
        if r.id in has_album:
            skipped += 1
            continue
        if month_text is None:                     # AI 호출은 달마다 한 번만
            month_text = generate_month_text(year, month)
        db.add(Album(id=str(uuid.uuid4()), resident_id=r.id,
                     title=title_of(r.name), description=month_text,
                     is_public=True))
        created.append(r.name)
    db.commit()
    return {"year": year, "month": month, "created": len(created),
            "created_names": created, "skipped": skipped,
            "text": month_text}
