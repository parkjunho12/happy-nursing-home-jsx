"""검토가 끝난 초안을 네이버에 올리는 줄 — 서버 쪽 절반.

■ 어디서 무엇을 하는가

  네이버는 공식 글쓰기 API 가 없다. 그래서 실제로 글을 올리는 것은 사람이
  네이버에 로그인해 둔 브라우저(Aside)이고, 그 브라우저는 Mac 에 있다.
  서버(리눅스)는 그 브라우저를 만질 수 없다. 서버가 하는 일은 셋이다.

    · 발행할 초안을 줄 세운다                (queued)
    · 발행기가 가져가면 '누가 언제까지' 를 적는다 (publishing · 임대)
    · 결과를 받아 적고 발행 이력에 넣는다     (published · publish_failed)

  실제 글쓰기는 apps/blog-publisher 가 한다. 이 파일은 그 발행기가 무엇을
  받아 가고 무엇을 돌려주는지, 그리고 그 사이 상태가 어떻게 바뀌는지만 정한다.

■ 두 번 올리지 않기

  발행은 되돌릴 수 없다. 같은 글이 두 번 올라가면 지워도 검색엔진에 남는다.
  그래서 재시도는 '아무것도 올라가지 않았다' 고 발행기가 확언한 경우에만 한다.
  발행 버튼을 눌렀는데 결과를 모르겠으면(uncertain) 사람에게 넘긴다.

    · ok        → published. 주소와 글 번호를 적고 발행 이력에 넣는다
    · failed    → 아직 시도 횟수가 남았으면 다시 queued, 아니면 publish_failed
    · uncertain → publish_failed. 사람이 네이버에서 확인한다. 자동 재시도 없음

  발행기가 도중에 죽어 결과가 안 오면 임대 시한이 지난다. 이것도 '올라갔을지
  모른다' 는 뜻이라 자동으로 다시 올리지 않는다 — publish_failed 로 멈추고,
  사람이 네이버를 확인한 뒤 '다시 발행' 을 누른다.

■ 표준 라이브러리만

  규칙 함수(parse_post_url · decide_after_result · body_for_publish)는 배포 전
  검사에서 라이브러리 설치 없이 부른다. DB 를 만지는 함수만 안에서 SQLAlchemy 를
  들여온다 — blog_schedule 과 같은 방식이다.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

if TYPE_CHECKING:                      # 실행 때는 부르지 않는다
    from sqlalchemy.orm import Session
    from app.models.blog_draft import BlogDraft

logger = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))

# 발행기가 한 편을 잡고 있을 수 있는 시간. 사진 8장 올리고 발행하는 데
# 보통 3~6분이 든다. 넉넉히 잡되, 죽은 발행기 때문에 하루를 잃지는 않게.
LEASE_MINUTES = int(os.getenv("BLOG_PUBLISH_LEASE_MINUTES", "30"))
# '아무것도 안 올라갔다' 는 실패에 한해 다시 시도하는 횟수(첫 시도 포함)
MAX_ATTEMPTS = int(os.getenv("BLOG_PUBLISH_MAX_ATTEMPTS", "3"))

# 상태 이름 — 관리자 화면·발행기가 같은 말을 쓴다
ST_APPROVED = "approved"
ST_QUEUED = "queued"
ST_PUBLISHING = "publishing"
ST_PUBLISHED = "published"
ST_FAILED = "publish_failed"

# 발행기가 돌려주는 결과 종류
RESULT_OK = "ok"
RESULT_FAILED = "failed"          # 아무것도 올라가지 않았다 — 다시 해도 된다
RESULT_UNCERTAIN = "uncertain"    # 올라갔을지 모른다 — 사람이 본다
RESULTS = (RESULT_OK, RESULT_FAILED, RESULT_UNCERTAIN)


def now_kst() -> datetime:
    return datetime.now(KST)


# ── 규칙 (표준 라이브러리만) ──────────────────────────────────────────────

_URL_PATTERNS = [
    # https://blog.naver.com/{blogId}/{logNo}
    re.compile(r"https?://(?:m\.)?blog\.naver\.com/([A-Za-z0-9_\-]+)/(\d{6,})"),
    # https://blog.naver.com/PostView.naver?blogId=X&logNo=Y (순서 무관)
    re.compile(r"https?://(?:m\.)?blog\.naver\.com/PostView\.n?aver\?[^\s\"'<>]*?"
               r"blogId=([A-Za-z0-9_\-]+)[^\s\"'<>]*?logNo=(\d{6,})"),
    re.compile(r"https?://(?:m\.)?blog\.naver\.com/PostView\.n?aver\?[^\s\"'<>]*?"
               r"logNo=(\d{6,})[^\s\"'<>]*?blogId=([A-Za-z0-9_\-]+)"),
]


def parse_post_url(text: str) -> Optional[Tuple[str, str, str]]:
    """네이버 글 주소를 찾아 (정규화한 주소, blogId, logNo) 를 돌려준다.

    발행기가 브라우저에서 읽어 온 주소는 모양이 제각각이다(모바일 · PostView ·
    쿼리 순서). 글 번호(logNo)가 중복 검사와 이력의 열쇠라 여기서 한 번 고정한다.
    """
    if not text:
        return None
    for i, pat in enumerate(_URL_PATTERNS):
        m = pat.search(text)
        if not m:
            continue
        a, b = m.group(1), m.group(2)
        blog_id, log_no = (b, a) if i == 2 else (a, b)
        return f"https://blog.naver.com/{blog_id}/{log_no}", blog_id, log_no
    return None


def decide_after_result(result: str, attempts: int,
                        max_attempts: int = MAX_ATTEMPTS) -> str:
    """발행기의 보고를 받은 뒤 초안이 갈 상태.

    attempts 는 이번 시도를 포함한 누적 횟수다.
    """
    if result == RESULT_OK:
        return ST_PUBLISHED
    if result == RESULT_FAILED and attempts < max_attempts:
        return ST_QUEUED
    return ST_FAILED


def decide_after_lease_expiry() -> str:
    """결과 없이 임대 시한이 지난 초안이 갈 상태.

    발행기가 글을 올린 직후 죽었을 수 있다. 그래서 자동으로 다시 줄에 세우지
    않는다 — 사람이 네이버를 보고 '다시 발행' 을 누른다.
    """
    return ST_FAILED


def body_for_publish(blocks: List[Dict[str, Any]]) -> Tuple[str, List[str]]:
    """발행기에 줄 본문과, 본문 속 [사진 n] 순서대로의 photo_id 목록.

    blocks 의 사진 순서가 곧 번호다. 본문에 [사진 3] 이 있는데 사진 목록에
    3번이 없으면 발행기가 멈춰야 하므로, 둘을 같은 자리에서 만든다.
    """
    from app.services.blog_writer import body_text   # 표준 라이브러리만 쓰는 모듈
    ids = [b.get("photo_id") for b in (blocks or [])
           if b.get("type") == "photo" and b.get("photo_id")]
    body = body_text(blocks or [], {pid: i + 1 for i, pid in enumerate(ids)})
    return body, ids


def markers_match(body: str, n_photos: int) -> bool:
    """본문 속 사진 번호가 1..n 과 정확히 맞는가 — 빠지거나 넘치면 발행하지 않는다."""
    nums = sorted({int(x) for x in re.findall(r"\[사진 (\d+)\]", body or "")})
    return nums == list(range(1, n_photos + 1))


# ── DB 를 만지는 쪽 ───────────────────────────────────────────────────────

def request(db: "Session", draft: "BlogDraft", by: Optional[str]) -> "BlogDraft":
    """'발행' 버튼. 검토가 끝난 글(approved) 이나 실패한 글만 줄에 선다.

    실패한 글을 사람이 다시 올리면 시도 횟수는 처음부터 센다 — 사람이 네이버를
    확인하고 누른 것이니 이전 실패와는 다른 회차다.
    """
    if draft.status not in (ST_APPROVED, ST_FAILED):
        raise ValueError("검토 완료(approved) 또는 발행 실패 상태의 초안만 발행할 수 있습니다.")
    if not draft.title or not draft.blocks:
        raise ValueError("제목과 본문이 있어야 발행할 수 있습니다.")
    body, ids = body_for_publish(draft.blocks)
    if not ids:
        raise ValueError("사진이 한 장도 없는 글은 올리지 않습니다.")
    if not markers_match(body, len(ids)):
        raise ValueError("본문의 [사진 n] 번호와 사진 목록이 맞지 않습니다. 본문을 고쳐 주세요.")
    draft.status = ST_QUEUED
    draft.publish_requested_by = by
    draft.publish_requested_at = now_kst()
    draft.publish_error = None
    draft.publish_worker = None
    draft.publish_lease_until = None
    draft.publish_attempts = 0
    db.commit()
    db.refresh(draft)
    return draft


def abort(db: "Session", draft: "BlogDraft", error: str) -> "BlogDraft":
    """발행기에 주기도 전에 못 나가게 된 글 — 사람이 고쳐야 하므로 재시도 없이 멈춘다."""
    draft.status = ST_FAILED
    draft.publish_worker = None
    draft.publish_lease_until = None
    draft.publish_error = (error or "").strip()[:500] or None
    db.commit()
    db.refresh(draft)
    return draft


def cancel(db: "Session", draft: "BlogDraft") -> "BlogDraft":
    """줄에서 뺀다. 이미 발행기가 가져간 것(publishing)은 못 뺀다 — 브라우저가 이미 쓰고 있을 수 있다."""
    if draft.status != ST_QUEUED:
        raise ValueError("발행 대기 중인 초안만 취소할 수 있습니다.")
    draft.status = ST_APPROVED
    draft.publish_requested_by = None
    draft.publish_requested_at = None
    db.commit()
    db.refresh(draft)
    return draft


def expire_leases(db: "Session", now: Optional[datetime] = None) -> int:
    """시한이 지난 임대를 정리한다. 결과 없이 죽은 발행기의 몫. 정리한 수.

    발행기가 다시 오지 않을 수도 있으니(맥이 꺼짐 · 토큰 바뀜) 발행기의 요청
    때만이 아니라 서버의 예약 점검(blog_schedule.tick)에서도 부른다.
    """
    now = now or now_kst()
    from app.models.blog_draft import BlogDraft
    rows = (db.query(BlogDraft)
            .filter(BlogDraft.status == ST_PUBLISHING,
                    BlogDraft.publish_lease_until.isnot(None),
                    BlogDraft.publish_lease_until < now).all())
    for d in rows:
        nxt = decide_after_lease_expiry()
        d.status = nxt
        d.publish_worker = None
        d.publish_lease_until = None
        d.publish_error = ("발행기가 결과를 돌려주지 않은 채 시한이 지났습니다 — "
                           "네이버에 올라갔는지 확인한 뒤 다시 발행해 주세요")
        logger.warning("블로그 발행 임대 만료: %s → %s", d.id, nxt)
    if rows:
        db.commit()
    return len(rows)


def lease_next(db: "Session", worker: str) -> Optional["BlogDraft"]:
    """발행기가 다음 한 편을 가져간다. 없으면 None.

    먼저 줄에 선 것부터. 가져가는 순간 publishing 으로 바꾸고 시한을 적는다.
    여러 발행기가 동시에 오면 한 편은 하나만 가져가야 하므로 행 잠금을 건다.
    """
    from app.models.blog_draft import BlogDraft
    now = now_kst()
    expire_leases(db, now)
    q = (db.query(BlogDraft)
         .filter(BlogDraft.status == ST_QUEUED)
         .order_by(BlogDraft.publish_requested_at.asc().nullsfirst(), BlogDraft.created_at.asc()))
    try:
        d = q.with_for_update(skip_locked=True).first()
    except Exception:
        # SQLite 등 행 잠금이 없는 곳 — 단일 발행기 전제로 그냥 집는다
        d = q.first()
    if not d:
        return None
    d.status = ST_PUBLISHING
    d.publish_worker = (worker or "")[:100]
    d.publish_lease_until = now + timedelta(minutes=LEASE_MINUTES)
    d.publish_attempts = (d.publish_attempts or 0) + 1
    d.publish_error = None
    db.commit()
    db.refresh(d)
    return d


def package(db: "Session", draft: "BlogDraft") -> Dict[str, Any]:
    """발행기에 주는 꾸러미 — 제목 · 본문 · 번호 붙은 사진 주소 · 해시태그 · 시설 안내.

    사진은 가린 파생본(mask_url)만 준다. 원본 주소는 어디에도 싣지 않는다.
    가린 파생본이 없는 사진이 하나라도 있으면 꾸러미를 만들지 않는다.
    """
    from app.models.blog_draft import BlogPhotoUse
    from app.services import blog_writer as bw
    body, ids = body_for_publish(draft.blocks or [])
    photos = []
    for i, pid in enumerate(ids):
        use = db.query(BlogPhotoUse).filter(BlogPhotoUse.id == pid).first()
        if not use or not use.mask_url or not use.usable:
            raise ValueError(f"[사진 {i + 1}] 을 쓸 수 없습니다 — 가림·공개 사용 확인을 다시 봐 주세요")
        photos.append({"no": i + 1, "url": use.mask_url,
                       "file_name": f"{i + 1:02d}.jpg", "photo_id": pid})
    return {
        "draft_id": draft.id,
        "title": draft.title,
        "body": body,
        "facility": bw.facility_block(),
        "hashtags": list(draft.hashtags or []),
        "photos": photos,
        "attempt": draft.publish_attempts,
        "lease_until": draft.publish_lease_until.isoformat() if draft.publish_lease_until else None,
    }


def complete(db: "Session", draft: "BlogDraft", *, result: str,
             url: Optional[str] = None, error: Optional[str] = None,
             session_id: Optional[str] = None, verified: bool = False,
             worker: Optional[str] = None,
             expected_blog_id: Optional[str] = None) -> "BlogDraft":
    """발행기의 보고. ok 면 주소가 있어야 한다.

    임대 시한이 지나 publish_failed 로 넘어간 뒤에 '올렸다' 는 보고가 늦게 와도
    받는다 — 글은 이미 네이버에 있으니 주소와 이력을 적어 두는 것이 맞다.
    늦게 온 '실패' · '모름' 은 받지 않는다(이미 그렇게 적혀 있다).
    """
    from app.models.blog_draft import BlogHistory
    if result not in RESULTS:
        raise ValueError("result 는 ok · failed · uncertain 중 하나여야 합니다.")
    late_ok = (result == RESULT_OK and draft.status == ST_FAILED
               and not draft.published_url)
    if draft.status != ST_PUBLISHING and not late_ok:
        raise ValueError("발행 중(publishing)인 초안만 결과를 받을 수 있습니다.")
    if worker and draft.publish_worker and worker != draft.publish_worker:
        raise ValueError("다른 발행기가 가져간 초안입니다.")

    parsed = parse_post_url(url or "") if result == RESULT_OK else None
    if result == RESULT_OK and parsed and expected_blog_id and parsed[1] != expected_blog_id:
        # 우리 블로그가 아닌 주소 — 다른 글을 보고 있었을 수 있다. 사람이 본다
        parsed = None
        error = (error or "") + f" 보고된 주소가 우리 블로그({expected_blog_id})가 아닙니다"
    if result == RESULT_OK and not parsed:
        # 올렸다는데 주소를 못 읽었다 — 올라간 것은 맞을 수 있으니 사람이 본다
        result = RESULT_UNCERTAIN
        error = (error or "") + " 발행됐다고 보고했지만 글 주소를 읽지 못했습니다"
        if url:
            error += f" (받은 값: {url.strip()[:200]})"

    nxt = decide_after_result(result, draft.publish_attempts or 0)
    draft.status = nxt
    draft.publish_session = (session_id or "")[:80] or draft.publish_session
    draft.publish_worker = None
    draft.publish_lease_until = None
    draft.publish_error = (error or "").strip()[:500] or None

    if nxt == ST_PUBLISHED and parsed:
        full_url, _blog_id, log_no = parsed
        now = now_kst()
        draft.published_url = full_url
        draft.published_log_no = log_no
        draft.published_at = now
        draft.published_verified = bool(verified)
        # 발행 이력 — 다음 글의 중복 검사 기준이 된다
        body, _ids = body_for_publish(draft.blocks or [])
        h = db.query(BlogHistory).filter(BlogHistory.log_no == log_no).first()
        if not h:
            h = BlogHistory(log_no=log_no, url=full_url)
            db.add(h)
        h.url = full_url
        h.title = draft.title
        h.body = body
        h.published_on = now.date().isoformat()
        h.activity_on = (draft.activity_dates or [None])[0]
        h.topic = draft.topic
        h.summary = None
        h.highlights = []
        h.photo_refs = _photo_refs(db, draft)
        h.collected_by = "publisher"
        h.draft_id = draft.id
    elif nxt == ST_QUEUED:
        logger.info("블로그 발행 실패, 다시 줄에 섬: %s (%s회)", draft.id, draft.publish_attempts)
    else:
        logger.warning("블로그 발행 실패로 멈춤: %s — %s", draft.id, draft.publish_error)
    db.commit()
    db.refresh(draft)
    return draft


def _photo_refs(db: "Session", draft: "BlogDraft") -> List[Dict[str, Any]]:
    from app.models.blog_draft import BlogPhotoUse
    _body, ids = body_for_publish(draft.blocks or [])
    out = []
    for pid in ids:
        use = db.query(BlogPhotoUse).filter(BlogPhotoUse.id == pid).first()
        if use:
            out.append({"photo_id": pid, "sha256": use.origin_sha256, "mask_url": use.mask_url})
    return out


# ── 발행기 생존 신호 ──────────────────────────────────────────────────────
# 관리자 화면에 '발행기가 살아 있는가' 를 보여주기 위한 것. 서버가 여러 프로세스로
# 떠 있어(uvicorn --workers) 프로세스 안에 두면 화면이 켜졌다 꺼졌다 한다. 표에 둔다.

def heartbeat(db: "Session", worker: str, info: Optional[Dict[str, Any]] = None) -> None:
    from app.models.blog_draft import BlogPublisher
    row = db.query(BlogPublisher).filter(BlogPublisher.worker == worker).first()
    if not row:
        row = BlogPublisher(worker=worker)
        db.add(row)
    row.seen_at = now_kst()
    if info:
        row.info = {k: v for k, v in info.items() if v is not None}
    db.commit()


def publishers(db: "Session") -> List[Dict[str, Any]]:
    from app.models.blog_draft import BlogPublisher
    rows = db.query(BlogPublisher).order_by(BlogPublisher.seen_at.desc()).limit(10).all()
    return [{"worker": r.worker, "at": r.seen_at.isoformat() if r.seen_at else None,
             **(r.info or {})} for r in rows]
