"""주 2회 초안 자동 생성 — 화요일·금요일 오전 10시(KST).

■ 왜 화·금인가

  주 2회를 월·목이나 수·토로 두면 한쪽에 활동이 몰린다. 화·금이면 사이가
  3일·4일로 고르고, 금요일 글은 그 주에 있었던 일을 다 담을 수 있다.
  요일은 BLOG_AUTO_DAYS 로 바꿀 수 있다(0=월 … 6=일).

■ 왜 발행하지 않는가

  네이버는 공식 글쓰기 API 가 없다. 있다고 가정하고 만들 수도 없고, 로그인
  화면을 흉내 내 우회할 생각도 없다. 그래서 여기까지가 자동이고, 마지막
  '복사해서 붙여넣기' 는 사람이 한다.

■ 자료가 모자란 날

  글을 안 만든다. 대신 '왜 못 만들었는지' 를 held 초안으로 남겨 처리 대기에
  띄운다. 사람이 그 이유를 풀어 주면(사진 공개 사용 확인 등) 다음 tick 에서
  같은 회차가 이어서 만들어진다 — 자료가 없어 멈춘 동안에는 모델을 부르지
  않으므로 다시 시도해도 돈이 들지 않는다.

■ 두 번 만들지 않기

  run_key 에 unique 를 걸어 두었다. 서버가 여러 벌 떠 있어도 같은 회차는
  한 번만 들어간다 — 두 번째는 DB 가 막는다.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from typing import TYPE_CHECKING

if TYPE_CHECKING:                      # 실행 때는 부르지 않는다
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))

# 화(1)·금(4). 0=월요일.
DAYS = tuple(int(x) for x in os.getenv("BLOG_AUTO_DAYS", "1,4").split(",") if x.strip())
HOUR = int(os.getenv("BLOG_AUTO_HOUR", "10"))
# 자료가 모자라 보류된 회차를 몇 시까지 다시 시도할지. 퇴근 뒤에는 손볼 사람이
# 없으니 그만둔다.
RETRY_UNTIL_HOUR = int(os.getenv("BLOG_AUTO_RETRY_UNTIL", "18"))
ENABLED = os.getenv("BLOG_AUTO_ENABLED", "1") not in ("0", "false", "False")

TICK_SECONDS = 15 * 60


def run_key_for(d: date) -> str:
    return f"auto-{d.isoformat()}"


def due(now: Optional[datetime] = None) -> bool:
    now = now or datetime.now(KST)
    return now.weekday() in DAYS and HOUR <= now.hour < RETRY_UNTIL_HOUR


def tick(db: "Session", *, now: Optional[datetime] = None,
         force: bool = False) -> Optional[str]:
    """한 번 점검한다. 만든 초안 id 또는 None(할 일 없음 · 보류).

    무거운 것들은 여기서 부른다 — 요일·시각만 보는 검사가 DB 라이브러리 없이
    이 파일을 읽을 수 있게.
    """
    from sqlalchemy.exc import IntegrityError
    from app.models.blog_draft import BlogDraft
    from app.services import blog_run

    now = now or datetime.now(KST)
    if not ENABLED and not force:
        return None
    if not force and not due(now):
        return None

    key = run_key_for(now.date())
    prev = db.query(BlogDraft).filter(BlogDraft.run_key == key).first()
    if prev and prev.status != "held":
        return None                      # 이미 만들었다
    if prev and now.hour >= RETRY_UNTIL_HOUR:
        return None

    try:
        d = blog_run.build(db, run_key=key, created_by="자동")
    except blog_run.NotEnough as e:
        _hold(db, prev, key, str(e))
        return None
    except IntegrityError:
        # 다른 서버가 같은 회차를 먼저 넣었다 — 정상이다
        db.rollback()
        return None
    except Exception as e:
        logger.exception("블로그 자동 생성 실패")
        _hold(db, prev, key, f"오류로 만들지 못했습니다({type(e).__name__}) — 담당자 확인 필요")
        return None

    if prev:
        # 보류로 잡아 두었던 자리는 지운다 — 같은 회차가 두 줄로 남으면 안 된다
        db.delete(prev)
        db.commit()
    logger.info("블로그 초안 자동 생성: %s", key)
    return d.id


def _hold(db: "Session", prev, key: str, reason: str) -> None:
    """보류 사유를 남긴다 — 이 줄이 처리 대기의 '해야 할 일' 이 된다."""
    from sqlalchemy.exc import IntegrityError
    from app.models.blog_draft import BlogDraft

    reason = reason[:300]
    try:
        if prev:
            prev.hold_reason = reason
        else:
            db.add(BlogDraft(run_key=key, status="held", hold_reason=reason,
                             created_by="자동", dup_status="unknown"))
        db.commit()
    except IntegrityError:
        db.rollback()
    logger.info("블로그 초안 보류: %s — %s", key, reason)


async def loop() -> None:
    """서버가 사는 동안 도는 루프. 무슨 일이 있어도 죽지 않는다."""
    from app.core.database import SessionLocal
    while True:
        try:
            await asyncio.sleep(TICK_SECONDS)
            db = SessionLocal()
            try:
                await asyncio.to_thread(tick, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("블로그 예약 tick 오류: %s", type(e).__name__)
            await asyncio.sleep(60)
