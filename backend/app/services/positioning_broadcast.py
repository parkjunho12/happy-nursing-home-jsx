"""체위변경 안내방송 — 대상 어르신 이름을 부르고 실시를 안내한다.

체위변경은 2시간마다 자세를 바꿔 드리는 일이다. 놓치면 욕창으로 이어지고,
평가에서도 '2시간 초과 미실시'는 그대로 지적으로 남는다. 그래서 시간마다
누구를 봐야 하는지 이름까지 불러 준다.

수급자 관리에서 '체위변경 대상자'로 표시된 분들이 그대로 명단이 된다.
어르신이 들어오고 나가면 명단이 바뀌므로, 바뀔 때마다 음성을 다시 만든다.

프로그램 자동방송과 같은 규칙을 따른다.
  1) 기본은 꺼져 있다. 미리보기로 확인하고 사람이 켠다
  2) 끄면 잡아둔 예약을 실제로 걷어낸다
  3) 대상자가 없으면 방송하지 않는다 — 빈 명단을 읽는 방송은 소음이다
  4) 사람이 만든 예약은 건드리지 않는다
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.broadcast import (
    BroadcastAutoSetting, BroadcastMedia, BroadcastRun, BroadcastSchedule,
    TYPE_TTS, ST_READY, ZONE_ALL, RUN_PENDING, RUN_PLAYING, RUN_SUCCESS, now_kst,
)
from app.models.eval import LtcResident
from app.services import broadcast_media as media_svc
from app.services.broadcast_schedule import to_kst
from app.services.tts import TTSError, get_provider

logger = logging.getLogger(__name__)

SOURCE_POSITION = "POSITION"
SETTING_KEY = "POSITION"

DEFAULT_TEMPLATE = (
    "안내 말씀드립니다. "
    "지금은 체위변경 시간입니다. "
    "대상 어르신은 {names} 어르신입니다. "
    "담당 선생님들께서는 체위변경을 실시해 주시기 바랍니다. "
    "감사합니다."
)

DEFAULTS: Dict[str, Any] = {
    "enabled": False,
    # 2시간 간격 — 체위변경 기준이 그렇다. 야간은 기본으로 넣지 않는다
    "times": ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
    "volume": 70,
    "voice": None,
    "template": DEFAULT_TEMPLATE,
    # 이름만 부를지, 호실을 같이 부를지. 건물 전체에 나가는 방송이라 고를 수 있게 둔다.
    #   name      : 김OO, 이OO
    #   room_name : 201호 김OO, 203호 이OO
    #   room      : 201호, 203호   (이름을 부르지 않는다)
    "name_style": "name",
    # 이보다 많으면 다 부르지 않고 '외 N분' 으로 줄인다 — 2분 넘는 방송은 아무도 안 듣는다
    "max_names": 20,
}

_HHMM = re.compile(r"^(\d{1,2}):(\d{2})$")


# ── 설정 ────────────────────────────────────────────────────────────

def load_config(db: Session) -> Dict[str, Any]:
    row = db.query(BroadcastAutoSetting).filter(
        BroadcastAutoSetting.key == SETTING_KEY).first()
    cfg = dict(DEFAULTS)
    for k, v in ((row.value or {}) if row else {}).items():
        if k in cfg:
            cfg[k] = v
    return _clean_config(cfg)


def _clean_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """말이 되는 값만 남긴다 — 설정 하나 잘못 들어가 새벽에 이름이 불리면 안 된다."""
    out = dict(DEFAULTS)
    out["enabled"] = bool(cfg.get("enabled", False))
    times = []
    for t in (cfg.get("times") or []):
        m = _HHMM.match(str(t).strip())
        if not m:
            continue
        h, mi = int(m.group(1)), int(m.group(2))
        if h > 23 or mi > 59:
            continue
        times.append(f"{h:02d}:{mi:02d}")
    out["times"] = sorted(dict.fromkeys(times))[:24]
    try:
        out["volume"] = min(max(int(cfg.get("volume", 70)), 0), 100)
    except (TypeError, ValueError):
        out["volume"] = 70
    v = cfg.get("voice")
    out["voice"] = (str(v).strip() or None) if v else None
    tpl = str(cfg.get("template") or "").strip()
    out["template"] = tpl[:500] if tpl else DEFAULT_TEMPLATE
    style = str(cfg.get("name_style") or "name")
    out["name_style"] = style if style in ("name", "room_name", "room") else "name"
    try:
        out["max_names"] = min(max(int(cfg.get("max_names", 20)), 1), 60)
    except (TypeError, ValueError):
        out["max_names"] = 20
    return out


def save_config(db: Session, patch: Dict[str, Any], actor: Optional[str] = None) -> Dict[str, Any]:
    cur = load_config(db)
    cur.update({k: v for k, v in (patch or {}).items() if k in DEFAULTS})
    cfg = _clean_config(cur)
    row = db.query(BroadcastAutoSetting).filter(
        BroadcastAutoSetting.key == SETTING_KEY).first()
    if not row:
        row = BroadcastAutoSetting(key=SETTING_KEY)
        db.add(row)
    row.value = cfg
    row.updated_by = actor
    db.commit()
    return cfg


# ── 대상 명단 ────────────────────────────────────────────────────────

def _room_no(r: LtcResident) -> int:
    """호실 순서로 정렬하기 위한 숫자. 못 읽으면 맨 뒤로."""
    m = re.search(r"\d+", r.room or "")
    return int(m.group()) if m else 99999


def targets(db: Session) -> List[LtcResident]:
    """지금 계신 체위변경 대상 어르신들. 호실 순서로 — 돌아보는 순서와 같게."""
    rows = (db.query(LtcResident)
              .filter(LtcResident.positioning == True,          # noqa: E712
                      LtcResident.status == "active")
              .all())
    return sorted(rows, key=lambda r: (_room_no(r), r.name or ""))


def _label(r: LtcResident, style: str) -> str:
    room = (r.room or "").strip()
    room_txt = f"{room}호" if room and not room.endswith("호") else room
    if style == "room" and room_txt:
        return room_txt
    if style == "room_name" and room_txt:
        return f"{room_txt} {r.name}"
    return r.name or ""


def name_list(rows: List[LtcResident], cfg: Dict[str, Any]) -> str:
    """이름을 말하듯 잇는다.

    쉼표는 TTS 가 짧게 쉬어 읽어 준다 — 이름 사이에는 그 쉼이 필요하다.
    가운뎃점은 붙여 읽으니 쓰지 않는다.
    """
    style = cfg.get("name_style", "name")
    labels = [x for x in (_label(r, style) for r in rows) if x]
    if not labels:
        return ""
    cap = int(cfg.get("max_names", 20))
    if len(labels) > cap:
        return ", ".join(labels[:cap]) + f" 외 {len(labels) - cap}분"
    return ", ".join(labels)


def build_text(cfg: Dict[str, Any], rows: List[LtcResident]) -> str:
    names = name_list(rows, cfg)
    tpl = cfg.get("template") or DEFAULT_TEMPLATE
    try:
        text = tpl.format(names=names, count=len(rows))
    except (KeyError, IndexError, ValueError):
        text = DEFAULT_TEMPLATE.format(names=names, count=len(rows))
    # 호실만 부르는 경우 '201호 어르신입니다' 가 되도록 템플릿이 이미 맞춰져 있다
    return text.strip()[:1000]


# ── 미리보기 ────────────────────────────────────────────────────────

def plan(db: Session, cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """무엇이 몇 시에 나갈지. 소리도 음성 파일도 만들지 않는다."""
    cfg = cfg or load_config(db)
    rows = targets(db)
    text = build_text(cfg, rows) if rows else ""
    return {
        "config": cfg,
        "times": cfg["times"],
        "count": len(rows),
        "targets": [{"id": r.id, "name": r.name, "room": r.room, "floor": r.floor}
                    for r in rows],
        "text": text,
        "skip": None if rows else "체위변경 대상자가 없습니다",
    }


# ── 실제 반영 ───────────────────────────────────────────────────────

def _existing(db: Session) -> Dict[str, BroadcastSchedule]:
    return {s.source_key: s for s in
            db.query(BroadcastSchedule).filter(
                BroadcastSchedule.source == SOURCE_POSITION).all()
            if s.source_key}


def _drop(db: Session, s: BroadcastSchedule) -> bool:
    """아직 안 나간 자동 예약을 걷어낸다. 이미 튼 것은 기록이므로 남긴다."""
    runs = db.query(BroadcastRun).filter(BroadcastRun.schedule_id == s.id).all()
    if any(r.status in (RUN_PLAYING, RUN_SUCCESS) for r in runs):
        # 이미 나간 적이 있는 예약은 지우지 않고 끈다 — 기록을 잃지 않으면서 멈춘다
        if s.enabled:
            s.enabled = False
        for r in runs:
            if r.status == RUN_PENDING:
                db.delete(r)
        return False
    for r in runs:
        db.delete(r)
    db.delete(s)
    return True


def _ensure_media(db: Session, text: str, cfg: Dict[str, Any],
                  actor: Optional[str]) -> BroadcastMedia:
    provider = get_provider()
    key = provider.cache_key(text, voice=cfg.get("voice"))
    m = db.query(BroadcastMedia).filter(BroadcastMedia.text_hash == key).first()
    if m:
        return m
    res = provider.synthesize(text, voice=cfg.get("voice"))
    audio = media_svc.prepare_tts(res.audio, res.ext)
    saved = media_svc.save_bytes(audio, ext=f".{res.ext}", stem="체위변경 안내")
    if saved.get("duration_sec") is None and res.ext == "wav":
        saved["duration_sec"] = media_svc.wav_duration(audio)
    m = BroadcastMedia(kind=TYPE_TTS, filename=saved["filename"], url=saved["url"],
                       mime=res.mime, size_bytes=saved["size_bytes"], sha256=saved["sha256"],
                       duration_sec=saved["duration_sec"], text_hash=key,
                       tts_provider=res.provider, tts_voice=res.voice,
                       created_by=actor or "체위변경 자동")
    db.add(m)
    db.flush()
    return m


def sync(db: Session, *, actor: Optional[str] = None) -> Dict[str, Any]:
    """설정과 대상 명단에 맞춰 예약을 만들고·고치고·걷어낸다.

    시각마다 예약 한 건을 '매일 반복'으로 둔다. 날마다 새로 만들지 않는
    이유는, 어르신 명단이 바뀌면 문구 하나만 갈아 끼우면 되기 때문이다.
    """
    cfg = load_config(db)
    rows = targets(db)
    existing = _existing(db)
    created = updated = removed = failed = 0
    errors: List[str] = []

    # 꺼졌거나 대상자가 없으면 아무것도 내보내지 않는다.
    # 빈 명단을 읽는 방송은 어르신들께 소음일 뿐이다.
    if not cfg["enabled"] or not rows:
        for s in existing.values():
            if _drop(db, s):
                removed += 1
        db.commit()
        return {"enabled": cfg["enabled"], "created": 0, "updated": 0, "removed": removed,
                "failed": 0, "planned": 0, "count": len(rows),
                "reason": "꺼져 있습니다" if not cfg["enabled"] else "체위변경 대상자가 없습니다",
                "errors": []}

    text = build_text(cfg, rows)
    wanted = {f"pos:{t.replace(':', '')}": t for t in cfg["times"]}
    now = now_kst()

    for k, s in existing.items():
        if k not in wanted and _drop(db, s):
            removed += 1

    for k, hhmm in wanted.items():
        h, mi = int(hhmm[:2]), int(hhmm[3:])
        at = now.replace(hour=h, minute=mi, second=0, microsecond=0)
        s = existing.get(k)
        try:
            if s is None:
                m = _ensure_media(db, text, cfg, actor)
                db.add(BroadcastSchedule(
                    title=f"[체위변경] {hhmm}", type=TYPE_TTS, text=text,
                    media_id=m.id, media_url=m.url,
                    scheduled_at=at, timezone="Asia/Seoul",
                    repeat_rule={"freq": "daily"},
                    zones=[ZONE_ALL], volume=int(cfg["volume"]),
                    max_seconds=settings.BROADCAST_MAX_SECONDS,
                    status=ST_READY, enabled=True,
                    source=SOURCE_POSITION, source_key=k,
                    created_by=actor or "체위변경 자동"))
                created += 1
            else:
                changed = False
                cur = to_kst(s.scheduled_at)
                if cur is None or (cur.hour, cur.minute) != (h, mi):
                    s.scheduled_at = at
                    changed = True
                if (s.text or "") != text:
                    # 명단이 바뀌었다 — 문구와 음성을 갈아 끼운다
                    m = _ensure_media(db, text, cfg, actor)
                    s.text, s.media_id, s.media_url = text, m.id, m.url
                    changed = True
                if s.volume != int(cfg["volume"]):
                    s.volume = int(cfg["volume"])
                    changed = True
                if not s.enabled or s.status != ST_READY:
                    s.enabled, s.status = True, ST_READY
                    changed = True
                if s.repeat_rule != {"freq": "daily"}:
                    s.repeat_rule = {"freq": "daily"}
                    changed = True
                if changed:
                    updated += 1
        except TTSError as e:
            failed += 1
            errors.append(f"{hhmm}: {e}")
        except Exception as e:
            failed += 1
            errors.append(f"{hhmm}: {type(e).__name__}")
            logger.warning("체위변경 예약 실패 %s: %s", k, e)

    db.commit()
    if created or updated or removed or failed:
        logger.info("체위변경 자동 예약 — 생성 %s / 수정 %s / 삭제 %s / 실패 %s (대상 %s명)",
                    created, updated, removed, failed, len(rows))
    return {"enabled": True, "created": created, "updated": updated, "removed": removed,
            "failed": failed, "planned": len(wanted), "count": len(rows),
            "reason": None, "errors": errors[:10]}


def sync_quiet(db_factory) -> None:
    """백그라운드에서 부르는 자리 — 실패가 요청을 깨지 않게 감싼다."""
    db = db_factory()
    try:
        sync(db, actor="체위변경 자동")
    except Exception as e:
        logger.warning("체위변경 예약 동기화 실패: %s: %s", type(e).__name__, e)
    finally:
        db.close()
