"""초안 한 편을 처음부터 끝까지 만든다 — 예약과 수동 생성이 같은 길을 쓴다.

  ① 지난 회차 이후의 사진을 모은다 — 프로그램 관리(내부용)와 보호자 앨범 둘 다
  ② 얼굴을 가리고, 공개 사용이 확인된 것만 남긴다
  ③ 활동으로 묶어 한 덩어리를 고른다
  ④ GPT-6 Astra 에 가린 사진과 활동 기록을 보내 글을 받는다
  ⑤ 기존 글과 겹치는지 본다
  ⑥ 초안으로 저장한다 — 여기서는 발행하지 않는다. 사람이 검토해 '발행' 을
     누르면 그때 발행 줄에 서고, Mac 의 발행기가 Aside 로 올린다(blog_publish)

■ 앨범 사진은 무엇이 다른가

  프로그램 사진에는 날짜·프로그램명·그룹이 있어 활동 기록(ProgramLog)과
  이어진다. 보호자 앨범 사진에는 앨범 제목과 올린 날짜뿐이다. 그래서 앨범
  사진은 '그날 있었던 일' 의 제목을 앨범 제목에서 빌리고, 기록이 없으면 없는
  대로 보낸다 — 모델은 사진에 보이는 것만 쓰도록 되어 있다.

  앨범에 올라갔다는 것이 공개 사용 동의는 아니다. 앨범 사진도 똑같이 사람이
  '공개 가능' 을 눌러야 후보가 된다.

■ 왜 한 함수인가

  예약이 만든 것과 사람이 만든 것이 다르게 나오면 안 된다. 예약에서만 나는
  문제를 사람이 재현할 수 없게 되고, 그러면 고칠 수가 없다.

■ 만들지 못할 때

  자료가 모자라면 만들지 않는다. 빈 글을 내놓거나 지어내는 것보다, '왜 못
  만들었는지' 를 적어 두는 편이 낫다. 그 이유가 곧 해야 할 일이다
  (동의 확인이 안 됐다 / 새 사진이 없다 / 기록이 없다).
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.album import Album, AlbumMedia
from app.models.blog_draft import (
    BlogDraft, BlogHistory, BlogPhotoUse,
    MASK_MASKED, MASK_FAILED, MASK_NO_FACE, USE_ALLOWED,
)
from app.models.program import ProgramLog, ProgramMonth, ProgramPhoto
from app.services import blog_dedup as dd
from app.services import blog_source as bs
from app.services import blog_writer as bw
from app.services import face_mask as fm

logger = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))

# 한 번에 모델에 보낼 사진 수 상한. 사진 한 장이 입력 토큰 500~600 을 쓴다.
MAX_SEND = 12
# 한 회차에 얼굴 가림을 새로 돌릴 앨범 사진 상한. 앨범은 보호자 수만큼 쌓여서
# 창 안의 사진을 다 가리면 한 번의 회차가 몇 분씩 걸린다. 최근 것부터 이만큼만.
ALBUM_MAX = int(os.getenv("BLOG_ALBUM_MAX", "40"))


class NotEnough(RuntimeError):
    """만들 자료가 모자라다 — 오류가 아니라 '오늘은 보류' 다."""


def _today() -> date:
    return datetime.now(KST).date()


def _photo_rows(db: Session, start: str, end: str) -> List[ProgramPhoto]:
    """창 안의 프로그램 사진. 영상은 뺀다."""
    months = sorted({start[:7], end[:7]})
    out: List[ProgramPhoto] = []
    for m in months:
        for p in (db.query(ProgramPhoto)
                  .filter(ProgramPhoto.month == m,
                          ProgramPhoto.media_type == "photo").all()):
            d = f"{m}-{p.day:02d}"
            if start <= d <= end:
                out.append(p)
    return out


class Source:
    """가릴 사진 한 장 — 어디서 왔든 같은 모양으로 다룬다."""

    __slots__ = ("source", "source_id", "file_url", "taken_on", "title", "group")

    def __init__(self, source: str, source_id: str, file_url: str,
                 taken_on: str, title: Optional[str], group: Optional[str] = None):
        self.source = source          # program | album
        self.source_id = source_id
        self.file_url = file_url
        self.taken_on = taken_on      # 'YYYY-MM-DD'
        self.title = title
        self.group = group


def _album_rows(db: Session, start: str, end: str) -> List[Source]:
    """창 안에 올라온 보호자 앨범 사진. 승인된 것만, 영상은 뺀다.

    앨범 사진에는 촬영일이 없다. 올린 날을 그날로 본다 — 보호자 앨범은
    보통 그날 찍어 그날 올린다.
    """
    lo = datetime.fromisoformat(start).replace(tzinfo=KST)
    hi = datetime.fromisoformat(end).replace(tzinfo=KST) + timedelta(days=1)
    # 비공개로 돌린 앨범은 보호자도 못 보는 것이니 후보에서 뺀다
    rows = (db.query(AlbumMedia)
            .join(Album, Album.id == AlbumMedia.album_id)
            .filter(AlbumMedia.media_type == "photo",
                    AlbumMedia.status == "approved",
                    Album.is_public.is_(True),
                    AlbumMedia.created_at >= lo, AlbumMedia.created_at < hi)
            .order_by(AlbumMedia.created_at.desc())
            .limit(ALBUM_MAX).all())
    titles: Dict[str, Optional[str]] = {}
    out: List[Source] = []
    for m in rows:
        if m.album_id not in titles:
            a = db.query(Album).filter(Album.id == m.album_id).first()
            titles[m.album_id] = (a.title if a else None)
        d = (m.created_at.astimezone(KST) if m.created_at.tzinfo else m.created_at).date().isoformat()
        out.append(Source("album", m.id, m.file_url, d, titles[m.album_id]))
    return out


def ensure_masked(db: Session, photo) -> BlogPhotoUse:
    """이 사진의 가림 상태를 확인하고, 아직이면 지금 가린다.

    원본은 건드리지 않는다. 가린 그림만 따로 만들어 둔다.
    ProgramPhoto 를 그대로 받거나 Source 를 받는다.
    """
    src = photo if isinstance(photo, Source) else Source(
        "program", photo.id, photo.file_url, f"{photo.month}-{photo.day:02d}",
        photo.title, photo.grp)
    row = (db.query(BlogPhotoUse)
           .filter(BlogPhotoUse.source == src.source,
                   BlogPhotoUse.source_id == src.source_id).first())
    if row and row.mask_status in (MASK_MASKED, MASK_NO_FACE, MASK_FAILED):
        return row
    if not row:
        row = BlogPhotoUse(source=src.source, source_id=src.source_id,
                           origin_url=src.file_url,
                           taken_on=src.taken_on,
                           program_title=src.title)
        db.add(row)

    from app.services.r2_storage import R2Storage
    try:
        raw = R2Storage().read_bytes(src.file_url)
    except Exception as e:
        raw = None
        logger.warning("사진을 읽지 못했습니다: %s", type(e).__name__)
    if not raw:
        row.mask_status = MASK_FAILED
        row.mask_reason = "원본을 읽지 못했습니다"
        db.commit()
        return row

    row.origin_sha256 = hashlib.sha256(raw).hexdigest()
    res = fm.mask_image(raw)
    row.mask_status = res.status
    row.mask_detector = res.detector
    row.mask_reason = res.reason or None
    row.width, row.height = res.width, res.height
    row.mask_boxes = [b.as_dict() for b in res.boxes]
    row.mask_at = datetime.now(KST)

    if res.status == MASK_MASKED and res.image_bytes:
        ok, why = fm.verify_masked(res.image_bytes, res.boxes, original=raw)
        if not ok:
            # 화소에 안 구워졌으면 쓰지 않는다. 원본으로 대체하지 않는다.
            row.mask_status = MASK_FAILED
            row.mask_reason = f"가림 검증 실패: {why}"
        else:
            try:
                # 출처를 이름에 넣는다 — 다른 출처의 같은 id 가 덮어쓰지 않게
                row.mask_url = R2Storage().put_bytes(
                    res.image_bytes, f"{src.source}-{src.source_id}.jpg", "blog-masked")
                if not row.mask_url:
                    raise RuntimeError("저장소가 설정되지 않았습니다")
            except Exception as e:
                row.mask_status = MASK_FAILED
                row.mask_reason = f"가린 사진을 저장하지 못했습니다({type(e).__name__})"
    db.commit()
    return row


def build(db: Session, *, run_key: Optional[str] = None,
          created_by: Optional[str] = None,
          effort: str = "low") -> BlogDraft:
    """초안 한 편. 못 만들면 NotEnough 를 낸다."""
    # ① 창 — 지난 초안이 다룬 마지막 날 다음날부터
    last = (db.query(BlogDraft)
            .filter(BlogDraft.activity_dates.isnot(None))
            .order_by(BlogDraft.created_at.desc()).first())
    covered = max(last.activity_dates) if (last and last.activity_dates) else None
    start, end = bs.window_for(covered, _today())

    rows: List[Source] = [
        Source("program", p.id, p.file_url, f"{p.month}-{p.day:02d}", p.title, p.grp)
        for p in _photo_rows(db, start, end)
    ] + _album_rows(db, start, end)
    if not rows:
        raise NotEnough(f"{start}~{end} 사이에 올라온 프로그램·앨범 사진이 없습니다.")

    # ② 가리고 거른다
    cands: List[bs.Candidate] = []
    stat = {"masked": 0, "no_face": 0, "failed": 0, "not_allowed": 0, "not_reviewed": 0}
    for p in rows:
        use = ensure_masked(db, p)
        stat[use.mask_status] = stat.get(use.mask_status, 0) + 1
        if use.mask_status != MASK_MASKED:
            continue
        if use.publicity != USE_ALLOWED:
            stat["not_allowed"] += 1
            continue
        if not use.mask_reviewed_at:
            stat["not_reviewed"] += 1
            continue
        if use.sensitive or bs.looks_sensitive(p.title):
            continue
        cands.append(bs.Candidate(use.id, p.source, p.taken_on, p.title, p.group, None,
                                  use.origin_sha256, False))

    if not cands:
        raise NotEnough(
            f"{start}~{end} 사진 {len(rows)}장 중 쓸 수 있는 것이 없습니다 — "
            f"가림 완료 {stat.get('masked',0)}장 · 공개 사용 미확인 {stat['not_allowed']}장 · "
            f"눈으로 확인 안 함 {stat['not_reviewed']}장 · 가림 실패 {stat.get('failed',0)}장")

    # ③ 묶고 고른다
    recent = [h.topic for h in (db.query(BlogHistory)
                                .order_by(BlogHistory.published_on.desc()).limit(6).all())
              if h.topic]
    picked = bs.pick(bs.cluster(cands), recent_topics=recent)
    if not picked:
        raise NotEnough(f"한 편으로 묶을 만한 사진이 모자랍니다(최소 {bs.MIN_PHOTOS}장).")

    # ④ 글 — 가린 사진과 활동 기록만 보낸다
    from app.services.r2_storage import R2Storage
    r2 = R2Storage()
    photos, images = [], {}
    for c in picked["items"][:MAX_SEND]:
        use = db.query(BlogPhotoUse).filter(BlogPhotoUse.id == c.photo_id).first()
        if not use or not use.mask_url:
            continue
        try:
            images[c.photo_id] = r2.read_bytes(use.mask_url)
        except Exception:
            continue
        photos.append({"id": c.photo_id, "taken_on": c.date,
                       "program_title": c.title or "프로그램 미지정"})
    if not photos:
        raise NotEnough("가린 사진을 불러오지 못했습니다.")

    ctx = bs.summarize(picked)
    _attach_logs(db, ctx)
    hist = [_hist_view(h) for h in (db.query(BlogHistory)
                                    .order_by(BlogHistory.published_on.desc()).limit(8).all())]
    avoid = [x for h in hist for x in (h.get("highlights") or [])]

    out, usage = bw.write_draft(ctx, photos, hist, avoid, effort=effort, images=images)
    clean, _warn = bw.sanitize(out, [p["id"] for p in photos])
    body = bw.body_text(clean["blocks"],
                        {pid: i + 1 for i, pid in enumerate(clean["used_photo_ids"])})

    # ⑤ 중복
    total_hist = db.query(BlogHistory).count()
    report = dd.check(
        new_body=body, new_topic=clean.get("topic"),
        new_activity_dates=picked["dates"],
        new_photo_hashes=[c.sha256 for c in picked["items"] if c.sha256],
        histories=hist,
        pending_drafts=[_draft_view(d) for d in (db.query(BlogDraft)
                        .filter(BlogDraft.status == "draft").limit(20).all())],
        boilerplate=[bw.FACILITY["name"], bw.FACILITY["address"], bw.FACILITY["phone"]],
        history_complete=total_hist > 0)

    # ⑥ 저장 — 발행하지 않는다
    det = usage.get("output_tokens_details") or {}
    d = BlogDraft(
        run_key=run_key, status="draft",
        title=clean.get("title"), title_alts=clean.get("title_alts"),
        blocks=clean.get("blocks"), hashtags=clean.get("hashtags"),
        topic=clean.get("topic"), activity_dates=picked["dates"],
        source_note="\n".join(f"{a['date']} {a['title']}" for a in ctx["activities"]),
        dup_status=report["status"], dup_report=report,
        model=bw.MODEL,
        input_tokens=usage.get("input_tokens"),
        cached_tokens=(usage.get("input_tokens_details") or {}).get("cached_tokens"),
        output_tokens=usage.get("output_tokens"),
        reasoning_tokens=det.get("reasoning_tokens"),
        cost_usd=bw.cost_of(usage), attempts=1, created_by=created_by,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def _attach_logs(db: Session, ctx: Dict[str, Any]) -> None:
    """활동 기록(목표·프로그램 내용)을 붙인다 — 이것이 본문의 뼈대가 된다."""
    for a in ctx.get("activities", []):
        d = a.get("date") or ""
        if len(d) != 10 or not a.get("title"):
            continue
        row = (db.query(ProgramLog)
               .filter(ProgramLog.month == d[:7], ProgramLog.day == int(d[8:]),
                       ProgramLog.title == a["title"]).first())
        if row and (row.goal or row.doing):
            parts = []
            if row.goal:
                parts.append(f"목표: {row.goal}")
            if row.doing:
                parts.append(f"프로그램 내용: {row.doing}")
            a["note"] = " / ".join(parts)


def _hist_view(h: BlogHistory) -> dict:
    return {"title": h.title, "url": h.url, "published_on": h.published_on,
            "activity_on": h.activity_on, "topic": h.topic, "body": h.body,
            "summary": h.summary, "highlights": h.highlights or [],
            "photo_refs": h.photo_refs or [], "kind": "history"}


def _draft_view(d: BlogDraft) -> dict:
    body = bw.body_text(d.blocks or [], {})
    return {"title": d.title, "url": None, "published_on": None,
            "activity_on": (d.activity_dates or [None])[0], "topic": d.topic,
            "body": body, "photo_refs": [], "kind": "draft"}
