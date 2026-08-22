"""안내방송 음질 — 다이나믹 레인지를 재고 눌러준다.

문제: TTS 음성은 문장 안에서 세기가 들쭉날쭉하다. 어떤 음절은 튀고 어떤 말끝은
묻힌다. 최대치만 맞춰 놓으면(peak 정규화) 튀는 한 음절이 기준이 되어,
나머지 말은 전부 작아진다. 앰프를 올리면 그 한 음절만 귀를 때린다.

그래서 방송국·마이크가 하는 일을 그대로 한다.
  1) 컴프레서 — 기준선을 넘는 부분만 눌러 큰 데와 작은 데의 차이를 줄인다
  2) 리미터   — 그래도 넘는 순간을 막아 찌그러짐(클리핑)을 없앤다
  3) 라우드니스 정규화 — 사람이 느끼는 크기를 일정하게 맞춘다(EBU R128)

콘덴서 마이크로 잡은 목소리가 방송으로 나갈 때의 느낌이 이 순서에서 나온다.

ffmpeg 이 없으면 아무것도 하지 않고 원본을 돌려준다 — 음질을 못 다듬는 것이
방송을 못 내보내는 것보다 낫다.
"""
from __future__ import annotations

import array
import io
import logging
import math
import os
import re
import subprocess
import tempfile
import wave
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

SETTING_KEY = "AUDIO"

# 프리셋 — 숫자를 모르는 사람이 고를 수 있게 네 가지만 둔다.
# threshold: 이 세기를 넘으면 누르기 시작 / ratio: 넘은 만큼을 몇 대 1로 줄일지
# attack·release: 얼마나 빨리 물고 놓을지 / makeup: 누른 만큼 다시 올릴지
PRESETS: Dict[str, Dict[str, Any]] = {
    "off": {
        "label": "끄기", "hint": "원본 그대로 — 세기 차이가 그대로 나갑니다",
        "threshold_db": 0, "ratio": 1.0, "attack_ms": 20, "release_ms": 250,
        "target_lufs": None, "knee": 0, "mix": 100, "gain_db": 0, "detection": "rms",
        "eq": [0, 0, 0, 0, 0, 0, 0, 0],
    },
    "soft": {
        "label": "부드럽게", "hint": "살짝만 고르게 — 말맛이 가장 많이 남습니다",
        "threshold_db": -18, "ratio": 2.5, "attack_ms": 20, "release_ms": 300,
        "target_lufs": -18,
        # 웅웅거리는 저음만 살짝 덜어낸다
        "knee": 4, "mix": 80, "gain_db": 2, "detection": "rms",
        "eq": [-3, -2, 0, 0, 1, 1, 0, 0],
    },
    "normal": {
        "label": "보통 (권장)", "hint": "콘덴서 마이크로 잡은 방송 느낌 — 어디서나 또렷합니다",
        "threshold_db": -22, "ratio": 4, "attack_ms": 10, "release_ms": 220,
        "target_lufs": -16,
        # 저음을 덜고 자음 대역(2~4k)을 올린다 — 방송에서 말이 또렷해지는 자리다
        "knee": 3, "mix": 100, "gain_db": 4, "detection": "rms",
        "eq": [-5, -3, -1, 0, 2, 3, 2, 0],
    },
    "strong": {
        "label": "강하게", "hint": "복도·식당처럼 시끄러운 곳 — 작은 말도 끌어올립니다",
        "threshold_db": -26, "ratio": 7, "attack_ms": 5, "release_ms": 160,
        "target_lufs": -14,
        # 시끄러운 곳 — 저음을 더 덜고 자음을 더 세운다
        "knee": 2, "mix": 100, "gain_db": 6, "detection": "peak",
        "eq": [-7, -4, -2, 0, 3, 4, 3, 1],
    },
}

# 8밴드 이큐 — 한 옥타브 간격. 사람 목소리와 안내방송에 필요한 대역만 고른다.
#   63/125 저음(웅웅거림) · 250/500 두께 · 1k/2k 또렷함(자음) · 4k/8k 치찰음·공기감
EQ_BANDS = [63, 125, 250, 500, 1000, 2000, 4000, 8000]
EQ_Q = 1.4              # 약 한 옥타브 폭 — 옆 대역을 크게 물지 않는다
EQ_MAX_DB = 12.0        # 이보다 올리면 찌그러지기 시작한다

# 비율은 X32 와 같은 단계로만 고르게 한다 — 4.3:1 같은 값은 귀로 구분되지 않고,
# 단계로 두면 '한 칸 올린다' 는 감각이 생긴다. (ffmpeg acompressor 상한이 20)
# 1.0 은 '누르지 않음' — 이 값이 있어야 끄기가 진짜로 꺼진다
RATIO_STEPS = [1.0, 1.1, 1.3, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0, 20.0]


def snap_ratio(v: float) -> float:
    """가장 가까운 단계로 붙인다."""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return 4.0
    return min(RATIO_STEPS, key=lambda x: abs(x - v))

DEFAULTS: Dict[str, Any] = {
    "preset": "normal",
    # 대역별 증감(dB). 0 이면 손대지 않는다.
    "eq": [0, 0, 0, 0, 0, 0, 0, 0],
    # ── 컴프레서 (X32 다이내믹스와 같은 항목) ──
    "knee": 3.0,            # 0(딱딱) ~ 5(부드럽게) — X32 표기 그대로
    "mix": 100.0,           # 눌린 소리와 원래 소리를 섞는 비율(%) — 100이면 전부 눌린 소리
    "gain_db": 0.0,         # 누른 만큼 다시 올리기 (X32 GAIN)
    "detection": "rms",     # rms(부드럽게) | peak(튀는 것을 잡음)
    # 프리셋을 쓰지 않고 직접 맞추고 싶을 때만 켠다
    "custom": False,
    "threshold_db": -22,
    "ratio": 4,
    "attack_ms": 10,
    "release_ms": 220,
    "target_lufs": -16,
    # 리미터가 넘지 못하게 막는 천장. -1dBFS 는 기기마다 생기는 오차를 감안한 값이다.
    "ceiling_db": -1.0,
}


def load_config(db) -> Dict[str, Any]:
    from app.models.broadcast import BroadcastAutoSetting
    row = db.query(BroadcastAutoSetting).filter(
        BroadcastAutoSetting.key == SETTING_KEY).first()
    cfg = dict(DEFAULTS)
    for k, v in ((row.value or {}) if row else {}).items():
        if k in cfg:
            cfg[k] = v
    return clean_config(cfg)


def clean_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """말이 되는 값만 남긴다 — 설정 하나 잘못 들어가 방송이 찌그러지면 안 된다."""
    out = dict(DEFAULTS)
    p = str(cfg.get("preset") or "normal")
    out["preset"] = p if p in PRESETS else "normal"
    out["custom"] = bool(cfg.get("custom", False))

    def num(key, lo, hi, default):
        try:
            return min(max(float(cfg.get(key, default)), lo), hi)
        except (TypeError, ValueError):
            return default

    out["threshold_db"] = num("threshold_db", -60, 0, DEFAULTS["threshold_db"])
    out["ratio"] = snap_ratio(cfg.get("ratio", DEFAULTS["ratio"]))
    # X32 와 같은 범위 — 어택 0~120ms, 릴리즈 5~4000ms
    out["attack_ms"] = num("attack_ms", 0.5, 120, DEFAULTS["attack_ms"])
    out["release_ms"] = num("release_ms", 5, 4000, DEFAULTS["release_ms"])
    tl = cfg.get("target_lufs")
    out["target_lufs"] = None if tl in (None, "") else num("target_lufs", -30, -8, -16)
    out["ceiling_db"] = num("ceiling_db", -6, -0.1, DEFAULTS["ceiling_db"])
    # 예전에 dB 로 저장해 둔 값이 있으면 X32 눈금(0~5)으로 옮긴다
    knee_src = cfg.get("knee", cfg.get("knee_db", DEFAULTS["knee"] * 8) / 8
                       if cfg.get("knee_db") is not None else DEFAULTS["knee"])
    out["knee"] = min(max(float(knee_src) if str(knee_src).replace(".", "", 1)
                          .replace("-", "", 1).isdigit() else DEFAULTS["knee"], 0), 5)
    out["mix"] = num("mix", 0, 100, DEFAULTS["mix"])
    out["gain_db"] = num("gain_db", 0, 24,
                         cfg.get("makeup_db") if cfg.get("makeup_db") is not None
                         else DEFAULTS["gain_db"])
    det = str(cfg.get("detection") or "rms").lower()
    out["detection"] = det if det in ("rms", "peak") else "rms"

    eq = cfg.get("eq")
    band = []
    for i in range(len(EQ_BANDS)):
        try:
            v = float((eq or [])[i])
        except (TypeError, ValueError, IndexError):
            v = 0.0
        band.append(round(min(max(v, -EQ_MAX_DB), EQ_MAX_DB), 1))
    out["eq"] = band
    return out


def effective(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """실제로 쓸 값 — 직접 맞추기가 꺼져 있으면 프리셋 값을 쓴다."""
    if cfg.get("custom"):
        return cfg
    p = PRESETS.get(cfg.get("preset") or "normal", PRESETS["normal"])
    out = dict(cfg)
    out.update({k: p[k] for k in
                ("threshold_db", "ratio", "attack_ms", "release_ms", "target_lufs",
                 "knee", "mix", "gain_db", "detection")})
    out["eq"] = list(p.get("eq") or [0] * len(EQ_BANDS))
    out["ratio"] = snap_ratio(out["ratio"])      # 프리셋도 같은 단계 위에 놓는다
    return out


def save_config(db, patch: Dict[str, Any], actor: Optional[str] = None) -> Dict[str, Any]:
    from app.models.broadcast import BroadcastAutoSetting
    cur = load_config(db)
    cur.update({k: v for k, v in (patch or {}).items() if k in DEFAULTS})
    cfg = clean_config(cur)
    row = db.query(BroadcastAutoSetting).filter(
        BroadcastAutoSetting.key == SETTING_KEY).first()
    if not row:
        row = BroadcastAutoSetting(key=SETTING_KEY)
        db.add(row)
    row.value = cfg
    row.updated_by = actor
    db.commit()
    return cfg


# ── 재기 ────────────────────────────────────────────────────────────

def analyze(data: bytes) -> Dict[str, Any]:
    """소리가 실제로 어떤지 — 표준 라이브러리만으로 잰다.

    peak  : 가장 큰 순간
    rms   : 전체적으로 느껴지는 크기
    range : 둘의 차이(크레스트). 이 값이 크면 '어떤 데는 크고 어떤 데는 작다'는 뜻이라,
            방송으로 내보내면 한쪽이 안 들린다. 컴프레서가 줄이려는 것이 이 값이다.
    """
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            if w.getsampwidth() != 2:
                return {"ok": False}
            ch, rate = w.getnchannels(), w.getframerate()
            frames = w.readframes(w.getnframes())
        a = array.array("h")
        a.frombytes(frames[:len(frames) - (len(frames) % 2)])
        if not a:
            return {"ok": False}
        peak = max(abs(min(a)), abs(max(a))) / 32768.0
        rms = math.sqrt(sum(x * x for x in a) / len(a)) / 32768.0
        db = lambda v: round(20 * math.log10(v), 1) if v > 1e-6 else -90.0
        # 말소리 구간만 골라 조용한 데와 큰 데의 차이를 본다.
        # 기준을 절대값(예: 0.005)으로 두면 안 된다 — 눌러서 전체가 커지면
        # 원래 무음이던 구간이 새로 들어와, 편차가 줄었는데도 늘어난 것처럼 보인다.
        # 가장 큰 구간에서 35dB 아래까지만 '말소리'로 본다.
        win = max(int(rate * ch * 0.05), 1)
        wins = []
        for i in range(0, len(a) - win, win):
            seg = a[i:i + win]
            r = math.sqrt(sum(x * x for x in seg) / len(seg)) / 32768.0
            if r > 1e-6:
                wins.append(db(r))
        top = max(wins) if wins else -90.0
        loud = sorted(x for x in wins if x >= top - 35)
        quiet_p = loud[int(len(loud) * 0.1)] if loud else -90.0
        loud_p = loud[int(len(loud) * 0.9)] if loud else -90.0
        return {
            "ok": True,
            "peak_db": db(peak),
            "rms_db": db(rms),
            "crest_db": round(db(peak) - db(rms), 1),
            # 말소리 구간 안에서의 세기 차이 — 사람이 '어떤 데는 크다'고 느끼는 값
            "range_db": round(loud_p - quiet_p, 1) if loud else 0.0,
            "quiet_db": quiet_p, "loud_db": loud_p,
            "duration_sec": round(len(a) / max(ch * rate, 1), 1),
        }
    except Exception as e:
        logger.warning("음향 측정 실패: %s: %s", type(e).__name__, e)
        return {"ok": False}


# ── 다듬기 ──────────────────────────────────────────────────────────

def _has_ffmpeg() -> bool:
    import shutil
    return bool(shutil.which("ffmpeg"))


def build_filter(cfg: Dict[str, Any]) -> Optional[str]:
    """ffmpeg 필터 한 줄. 아무것도 안 건드리면 None.

    화면(브라우저)에서 듣고 맞춘 값을 여기서 그대로 쓴다.
    이큐는 양쪽 다 피킹 바이쿼드라 계산이 같고, 컴프레서는 구현이 달라
    소리가 미세하게 다를 수 있다 — 그래서 화면에 서버가 만든 음성을
    바로 들어볼 수 있는 자리를 따로 둔다.
    """
    e = effective(cfg)
    eq = [float(x) for x in (e.get("eq") or [])]
    comp_on = not ((e.get("preset") == "off" and not e.get("custom"))
                   or float(e["ratio"]) <= 1.01)
    eq_on = any(abs(g) >= 0.1 for g in eq)
    if not comp_on and not eq_on:
        return None
    ceiling = float(e["ceiling_db"])
    parts = []
    # 이큐가 먼저다 — 깎아낼 것을 깎고 나서 눌러야, 웅웅거리는 저음 때문에
    # 컴프레서가 엉뚱한 데서 물지 않는다
    for f, g in zip(EQ_BANDS, eq):
        if abs(g) >= 0.1:
            parts.append(f"equalizer=f={f}:t=q:w={EQ_Q}:g={g:.1f}")
    if comp_on:
        # X32 눈금을 ffmpeg 값으로 옮긴다.
        #   knee 0~5(딱딱~부드럽게) → ffmpeg 1~8
        #   gain 0~24dB → makeup 1~16배
        #   mix 0~100% → 0~1 (병렬 압축 — 눌린 소리와 원래 소리를 섞는다)
        knee = 1 + (min(max(float(e.get("knee", 3)), 0), 5) / 5) * 7
        gain = 10 ** (min(max(float(e.get("gain_db", 0)), 0), 24) / 20)
        mix = min(max(float(e.get("mix", 100)), 0), 100) / 100
        parts.append(
            # threshold 는 0~1 진폭으로 넘긴다
            "acompressor="
            f"threshold={10 ** (float(e['threshold_db']) / 20):.6f}:"
            f"ratio={float(e['ratio']):.2f}:"
            f"attack={float(e['attack_ms']):.2f}:"
            f"release={float(e['release_ms']):.0f}:"
            f"knee={knee:.2f}:"
            f"makeup={gain:.3f}:"
            f"mix={mix:.3f}:"
            f"detection={e.get('detection', 'rms')}")
    if comp_on and e.get("target_lufs") is not None:
        # 사람이 느끼는 크기를 맞춘다. 한 번만 훑는 방식이라 몇 초짜리 안내방송에 알맞다.
        parts.append(f"loudnorm=I={float(e['target_lufs']):.1f}:TP={ceiling:.1f}:LRA=7")
    # 마지막 안전장치 — 어떤 경우에도 천장을 넘지 않게
    parts.append(f"alimiter=limit={10 ** (ceiling / 20):.6f}:level=disabled")
    return ",".join(parts)


def process(data: bytes, cfg: Dict[str, Any]) -> Tuple[bytes, bool]:
    """다듬은 WAV 를 돌려준다. (결과, 실제로 다듬었는지)

    실패하면 원본을 그대로 준다 — 음질을 못 다듬는 것이 방송을 못 내보내는 것보다 낫다.
    """
    flt = build_filter(cfg)
    if not flt or not data:
        return data, False
    if not _has_ffmpeg():
        logger.info("ffmpeg 이 없어 음질 보정을 건너뜁니다")
        return data, False

    src = dst = None
    try:
        fd, src = tempfile.mkstemp(suffix=".wav"); os.close(fd)
        fd, dst = tempfile.mkstemp(suffix=".wav"); os.close(fd)
        with open(src, "wb") as f:
            f.write(data)
        r = subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", src, "-af", flt,
             "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", dst],
            capture_output=True, timeout=120)
        if r.returncode != 0 or not os.path.getsize(dst):
            logger.warning("음질 보정 실패(원본 사용): %s", r.stderr.decode()[:200])
            return data, False
        with open(dst, "rb") as f:
            return f.read(), True
    except Exception as e:
        logger.warning("음질 보정 건너뜀 (%s: %s)", type(e).__name__, e)
        return data, False
    finally:
        for p in (src, dst):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
