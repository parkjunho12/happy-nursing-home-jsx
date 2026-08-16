"""프로그램 시간표 → 안내방송 자동 예약.

프로그램표에 시간이 적힌 항목을 읽어, 시작 몇 분 전에 나갈 안내방송 예약을
자동으로 만들어 둔다. 프로그램표를 고치면 다시 맞춘다.

어르신들이 생활하는 공간에 사람 손 없이 소리가 나가는 기능이라 다음을 지킨다.

1) 기본은 꺼져 있다. 관리자가 미리보기로 확인하고 직접 켠다.
2) 끄면 앞으로 잡아둔 자동 예약을 실제로 걷어낸다. 화면만 꺼지면 안 된다.
3) 정해진 시간대(기본 08:00~20:00) 밖에는 만들지 않는다. 이른 아침·밤에 스피커가
   울리는 일이 없어야 한다.
4) 같은 시각에 여러 프로그램이 있으면 한 번으로 합친다. 연달아 세 번 울리지 않게.
5) 사람이 만든 예약은 건드리지 않는다. source='PROGRAM' 인 것만 다룬다.
6) 이미 나간 방송은 손대지 않는다. 기록이다.
"""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, date as date_cls, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.broadcast import (
    BroadcastMedia, BroadcastRun, BroadcastSchedule,
    KST, TYPE_TTS, ST_READY, ZONE_ALL,
    RUN_PENDING, RUN_PLAYING, RUN_SUCCESS, now_kst,
)
from app.models.program import ProgramMonth, ProgramSetting
from app.services import broadcast_media as media_svc
from app.services.broadcast_schedule import to_kst
from app.services.tts import TTSError, get_provider

logger = logging.getLogger(__name__)

SOURCE_PROGRAM = "PROGRAM"

DEFAULT_TEMPLATE = (
    "안내 말씀드립니다. 잠시 후 {time}부터 {title} 프로그램을 시작합니다. "
    "{who} 프로그램실로 와 주시기 바랍니다."
)

DEFAULTS: Dict[str, Any] = {
    "enabled": False,          # 기본 꺼짐 — 사람이 확인하고 켠다
    "lead_min": 10,            # 시작 몇 분 전에 방송할지
    "volume": 70,
    "voice": None,
    "template": DEFAULT_TEMPLATE,
    "exclude_kinds": ["교육"],  # 직원 교육은 어르신 안내가 아니다
    "quiet_start": "08:00",    # 이 시각 이전에는 방송하지 않는다
    "quiet_end": "20:00",      # 이 시각 이후에는 방송하지 않는다
    "days_ahead": 7,           # 며칠치를 미리 만들어 둘지
}

_HHMM = re.compile(r"(\d{1,2})\s*[:시]\s*(\d{1,2})?")


# ── 설정 ────────────────────────────────────────────────────────────

def _row(db: Session) -> ProgramSetting:
    row = db.query(ProgramSetting).first()
    if not row:
        row = ProgramSetting(times=[])
        db.add(row)
        db.flush()
    return row


def load_config(db: Session) -> Dict[str, Any]:
    """저장된 설정 + 기본값. 저장된 적이 없으면 기본값 그대로."""
    saved = _row(db).broadcast or {}
    cfg = dict(DEFAULTS)
    for k, v in (saved or {}).items():
        if k in cfg:
            cfg[k] = v
    return _clean_config(cfg)


def _clean_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """말이 되는 값만 남긴다 — 설정 하나 잘못 들어가 새벽에 방송되면 안 된다."""
    out = dict(DEFAULTS)
    out["enabled"] = bool(cfg.get("enabled", False))
    try:
        out["lead_min"] = min(max(int(cfg.get("lead_min", 10)), 0), 60)
    except (TypeError, ValueError):
        out["lead_min"] = 10
    try:
        out["volume"] = min(max(int(cfg.get("volume", 70)), 0), 100)
    except (TypeError, ValueError):
        out["volume"] = 70
    v = cfg.get("voice")
    out["voice"] = (str(v).strip() or None) if v else None
    tpl = str(cfg.get("template") or "").strip()
    # 문구가 비어 있으면 소리 없는 방송이 된다. 기본 문구로 되돌린다.
    out["template"] = tpl[:500] if tpl else DEFAULT_TEMPLATE
    kinds = cfg.get("exclude_kinds")
    out["exclude_kinds"] = [str(k).strip() for k in kinds if str(k).strip()][:10] \
        if isinstance(kinds, list) else list(DEFAULTS["exclude_kinds"])
    out["quiet_start"] = _hhmm_str(cfg.get("quiet_start"), "08:00")
    out["quiet_end"] = _hhmm_str(cfg.get("quiet_end"), "20:00")
    if out["quiet_start"] >= out["quiet_end"]:
        out["quiet_start"], out["quiet_end"] = "08:00", "20:00"
    try:
        out["days_ahead"] = min(max(int(cfg.get("days_ahead", 7)), 1),
                                max(int(settings.BROADCAST_SYNC_DAYS), 1))
    except (TypeError, ValueError):
        out["days_ahead"] = 7
    return out


def _hhmm_str(v: Any, fallback: str) -> str:
    m = _HHMM.match(str(v or ""))
    if not m:
        return fallback
    h = int(m.group(1))
    mi = int(m.group(2) or 0)
    if h > 23 or mi > 59:
        return fallback
    return f"{h:02d}:{mi:02d}"


def save_config(db: Session, patch: Dict[str, Any], actor: Optional[str] = None) -> Dict[str, Any]:
    cur = load_config(db)
    cur.update({k: v for k, v in (patch or {}).items() if k in DEFAULTS})
    cfg = _clean_config(cur)
    row = _row(db)
    row.broadcast = cfg
    row.updated_by = actor
    db.commit()
    return cfg


# ── 문구 만들기 ──────────────────────────────────────────────────────

def parse_start(time_str: Optional[str]) -> Optional[tuple]:
    """'10:00~10:40' → (10, 0). 시간을 못 읽으면 None — 그런 항목은 건너뛴다."""
    if not time_str:
        return None
    head = str(time_str).split("~")[0].split("-")[0].strip()
    m = _HHMM.match(head)
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2) or 0)
    if h > 23 or mi > 59:
        return None
    return h, mi


def speak_time(h: int, mi: int) -> str:
    """'10:00' 을 그대로 읽히면 어색하다 — '10시', '10시 30분' 으로."""
    return f"{h}시" if mi == 0 else f"{h}시 {mi}분"


def _join_titles(titles: List[str]) -> str:
    ts = list(dict.fromkeys([t.strip() for t in titles if t and t.strip()]))
    if not ts:
        return "프로그램"
    if len(ts) == 1:
        return ts[0]
    return ", ".join(ts[:-1]) + f"와 {ts[-1]}"


def _who(groups: List[Optional[str]]) -> str:
    gs = list(dict.fromkeys([g.strip() for g in groups if g and g.strip()]))
    if not gs:
        return "참여하실 어르신께서는"
    return f"{'·'.join(gs)} 그룹 어르신께서는"


def build_text(cfg: Dict[str, Any], *, h: int, mi: int,
               titles: List[str], groups: List[Optional[str]]) -> str:
    tpl = cfg.get("template") or DEFAULT_TEMPLATE
    try:
        text = tpl.format(time=speak_time(h, mi), title=_join_titles(titles), who=_who(groups))
    except (KeyError, IndexError, ValueError):
        # 사람이 템플릿에 이상한 자리표시자를 넣어도 방송은 나가야 한다
        text = DEFAULT_TEMPLATE.format(time=speak_time(h, mi),
                                       title=_join_titles(titles), who=_who(groups))
    return text.strip()[:1000]


def source_key(d: date_cls, h: int, mi: int, titles: List[str]) -> str:
    """같은 날·같은 시각·같은 내용이면 같은 키. 내용이 바뀌면 다른 키가 되어
    옛 예약은 걷히고 새로 만들어진다."""
    sig = "|".join(sorted(t.strip() for t in titles if t and t.strip()))
    return f"prog:{d.isoformat()}:{h:02d}{mi:02d}:{hashlib.sha1(sig.encode()).hexdigest()[:8]}"


# ── 무엇이 언제 나갈지 계산 (소리는 내지 않는다) ──────────────────────

def plan(db: Session, cfg: Optional[Dict[str, Any]] = None, *,
         today: Optional[datetime] = None, days: Optional[int] = None) -> List[Dict[str, Any]]:
    """앞으로 며칠간 나갈 안내방송 목록.

    순수 계산이다 — DB 를 바꾸지도, 음성을 만들지도 않는다.
    미리보기 화면과 실제 반영이 같은 답을 보게 하려고 하나로 둔다.
    """
    cfg = cfg or load_config(db)
    now = today or now_kst()
    span = days if days is not None else int(cfg["days_ahead"])
    lead = timedelta(minutes=int(cfg["lead_min"]))
    qs = _hhmm_str(cfg["quiet_start"], "08:00")
    qe = _hhmm_str(cfg["quiet_end"], "20:00")
    excl = set(cfg.get("exclude_kinds") or [])

    # 창이 달을 넘어갈 수 있다 — 필요한 달만 읽는다
    dates = [(now.date() + timedelta(days=i)) for i in range(span + 1)]
    months = {d.strftime("%Y-%m") for d in dates}
    rows = {r.month: (r.days or {}) for r in
            db.query(ProgramMonth).filter(ProgramMonth.month.in_(list(months))).all()}

    out: List[Dict[str, Any]] = []
    for d in dates:
        entries = rows.get(d.strftime("%Y-%m"), {}).get(str(d.day)) or []
        # 같은 시각끼리 묶는다 — 연달아 여러 번 울리지 않게
        slots: Dict[tuple, List[dict]] = {}
        for e in entries:
            if not isinstance(e, dict):
                continue
            if (e.get("kind") or "") in excl:
                continue
            hm = parse_start(e.get("time"))
            if not hm:
                continue                       # 시간이 없는 항목은 예약하지 않는다
            slots.setdefault(hm, []).append(e)

        for (h, mi), group in sorted(slots.items()):
            start = datetime(d.year, d.month, d.day, h, mi, tzinfo=KST)
            at = (start - lead).replace(second=0, microsecond=0)
            titles = [str(e.get("title") or "").strip() for e in group]
            groups = [e.get("group") for e in group]
            item = {
                "date": d.isoformat(),
                "program_time": f"{h:02d}:{mi:02d}",
                "at": at.isoformat(),
                "titles": [t for t in titles if t],
                "groups": [g for g in groups if g],
                "text": build_text(cfg, h=h, mi=mi, titles=titles, groups=groups),
                "source_key": source_key(d, h, mi, titles),
                "skip": None,
            }
            if at <= now:
                item["skip"] = "지난 시각"
            elif at.strftime("%H:%M") < qs or at.strftime("%H:%M") > qe:
                item["skip"] = f"방송 시간대({qs}~{qe}) 밖"
            out.append(item)

    out.sort(key=lambda x: x["at"])
    return out


# ── 실제 반영 ───────────────────────────────────────────────────────

def _future_program_schedules(db: Session, now: datetime) -> List[BroadcastSchedule]:
    return (db.query(BroadcastSchedule)
              .filter(BroadcastSchedule.source == SOURCE_PROGRAM,
                      BroadcastSchedule.scheduled_at > now)
              .all())


def _drop(db: Session, s: BroadcastSchedule) -> bool:
    """아직 안 나간 자동 예약을 걷어낸다. 이미 튼 것은 남긴다(기록이다)."""
    runs = db.query(BroadcastRun).filter(BroadcastRun.schedule_id == s.id).all()
    if any(r.status in (RUN_PLAYING, RUN_SUCCESS) for r in runs):
        return False
    for r in runs:
        if r.status == RUN_PENDING:
            db.delete(r)
    db.delete(s)
    return True


def _ensure_media(db: Session, text: str, cfg: Dict[str, Any],
                  actor: Optional[str]) -> BroadcastMedia:
    """문구에 해당하는 음성을 얻는다. 같은 문구는 다시 만들지 않는다."""
    provider = get_provider()
    key = provider.cache_key(text, voice=cfg.get("voice"))
    m = db.query(BroadcastMedia).filter(BroadcastMedia.text_hash == key).first()
    if m:
        return m
    res = provider.synthesize(text, voice=cfg.get("voice"))
    audio = media_svc.normalize_wav(res.audio) if res.ext == "wav" else res.audio
    saved = media_svc.save_bytes(audio, ext=f".{res.ext}", stem=text[:20])
    if saved.get("duration_sec") is None and res.ext == "wav":
        saved["duration_sec"] = media_svc.wav_duration(audio)
    m = BroadcastMedia(kind=TYPE_TTS, filename=saved["filename"], url=saved["url"],
                       mime=res.mime, size_bytes=saved["size_bytes"], sha256=saved["sha256"],
                       duration_sec=saved["duration_sec"], text_hash=key,
                       tts_provider=res.provider, tts_voice=res.voice,
                       created_by=actor or "프로그램 자동")
    db.add(m)
    db.flush()
    return m


def sync(db: Session, *, actor: Optional[str] = None) -> Dict[str, Any]:
    """프로그램표에 맞춰 자동 예약을 만들고·고치고·걷어낸다.

    껐으면 앞으로 잡아둔 것을 모두 걷어낸다 — 끈다는 말이 실제로 소리가
    안 난다는 뜻이어야 한다.
    """
    now = now_kst()
    cfg = load_config(db)
    existing = {s.source_key: s for s in _future_program_schedules(db, now) if s.source_key}
    created = updated = removed = failed = 0
    errors: List[str] = []

    if not cfg["enabled"]:
        for s in existing.values():
            if _drop(db, s):
                removed += 1
        db.commit()
        return {"enabled": False, "created": 0, "updated": 0,
                "removed": removed, "failed": 0, "planned": 0, "errors": []}

    items = [p for p in plan(db, cfg, today=now) if not p["skip"]]
    wanted = {p["source_key"]: p for p in items}

    # 없어진 것 걷어내기 (프로그램이 지워졌거나 시간·내용이 바뀐 경우)
    for k, s in existing.items():
        if k not in wanted and _drop(db, s):
            removed += 1

    for k, p in wanted.items():
        at = datetime.fromisoformat(p["at"])
        s = existing.get(k)
        try:
            if s is None:
                m = _ensure_media(db, p["text"], cfg, actor)
                s = BroadcastSchedule(
                    title=f"[프로그램] {_join_titles(p['titles'])}"[:200],
                    type=TYPE_TTS, text=p["text"], media_id=m.id, media_url=m.url,
                    scheduled_at=at, timezone="Asia/Seoul", repeat_rule={"freq": "once"},
                    zones=[ZONE_ALL], volume=int(cfg["volume"]),
                    max_seconds=settings.BROADCAST_MAX_SECONDS,
                    status=ST_READY, enabled=True,
                    source=SOURCE_PROGRAM, source_key=k,
                    created_by=actor or "프로그램 자동")
                db.add(s)
                created += 1
            else:
                # 시각·문구·음량이 달라졌으면 맞춘다 (안내 시간 설정을 바꾼 경우 등)
                changed = False
                # DB 가 시간대 없는 값을 돌려주기도 한다 — 그대로 비교하면
                # 매번 '바뀌었다'가 되어 6시간마다 헛되이 다시 쓴다
                if to_kst(s.scheduled_at) != at:
                    s.scheduled_at = at
                    changed = True
                if (s.text or "") != p["text"]:
                    m = _ensure_media(db, p["text"], cfg, actor)
                    s.text, s.media_id, s.media_url = p["text"], m.id, m.url
                    changed = True
                if s.volume != int(cfg["volume"]):
                    s.volume = int(cfg["volume"])
                    changed = True
                if not s.enabled or s.status != ST_READY:
                    s.enabled, s.status = True, ST_READY
                    changed = True
                if changed:
                    # 시각이 바뀌면 잡아둔 회차는 의미가 없다
                    for r in db.query(BroadcastRun).filter(
                            BroadcastRun.schedule_id == s.id,
                            BroadcastRun.status == RUN_PENDING).all():
                        db.delete(r)
                    updated += 1
        except TTSError as e:
            failed += 1
            errors.append(f"{p['date']} {p['program_time']}: {e}")
        except Exception as e:                     # 한 건이 실패해도 나머지는 만든다
            failed += 1
            errors.append(f"{p['date']} {p['program_time']}: {type(e).__name__}")
            logger.warning("프로그램 자동 예약 실패 %s: %s", p["source_key"], e)

    db.commit()
    if created or updated or removed or failed:
        logger.info("프로그램 자동 예약 — 생성 %s / 수정 %s / 삭제 %s / 실패 %s",
                    created, updated, removed, failed)
    return {"enabled": True, "created": created, "updated": updated, "removed": removed,
            "failed": failed, "planned": len(items), "errors": errors[:10]}


def sync_quiet(db_factory) -> None:
    """백그라운드에서 부르는 자리 — 실패가 요청을 깨지 않게 감싼다."""
    db = db_factory()
    try:
        sync(db, actor="프로그램 자동")
    except Exception as e:
        logger.warning("프로그램 자동 예약 동기화 실패: %s: %s", type(e).__name__, e)
    finally:
        db.close()
