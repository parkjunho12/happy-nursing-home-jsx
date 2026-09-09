"""GPT-6 Astra 로 블로그 초안을 쓴다.

■ 밖으로 무엇을 보내는가

  얼굴 가림과 공개 사용 확인을 마친 사진 + 활동 기록. 그 둘뿐이다.
  원본 사진, 원본 주소, 내부 메모, 어르신 개인정보·보호자 정보는 보내지 않는다.

  처음에는 사진도 안 보내고 기록만 보냈다. 그랬더니 어느 사진이 무엇을 담고
  있는지 모르니 '그날 찍힌 순서' 대로 배치했고, 풍선 사진 밑에 낚시 설명이
  붙었다. 사진과 글이 어긋나면 읽는 사람이 먼저 알아본다.

  그래서 가린 사진을 함께 보낸다. 다만 사진에서 읽어도 되는 것과 안 되는
  것을 분명히 나눈다 — 보이는 것(도구·자리 배치·인원 규모)은 쓰고,
  안 보이는 것(대화·감정·날씨·건강 상태)은 쓰지 않는다.

■ 사진 주소를 모델이 만들게 두지 않는다

  블록에는 우리가 준 photo_id 만 쓰게 하고, 돌아온 뒤 서버에서 그 id 가
  실제로 우리가 준 목록에 있는지 다시 확인한다. 없는 id 는 버린다.

■ 규격은 실제로 확인한 것만 쓴다

  /v1/responses · reasoning.effort · max_output_tokens · text.format.json_schema
  네 가지는 이 계정에서 실제 호출로 확인했다. 확인하지 않은 파라미터는 쓰지
  않는다. 모델을 못 쓰면 다른 모델로 조용히 바꾸지 않고 그대로 실패시킨다 —
  바꿔치기하면 왜 글투가 달라졌는지 아무도 모른다.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

MODEL = "gpt-6-astra"
API_URL = "https://api.openai.com/v1/responses"

# 단가(USD / 100만 토큰). 공식 문서 확인값이며 설정으로 바꿀 수 있다.
PRICE = {
    "input": 10.0,
    "cached_input": 1.0,
    # 캐시에 새로 쓰는 토큰은 일반 입력의 1.25배로 청구된다.
    # 실제 호출의 usage 에 cache_write_tokens 가 1,222개 찍혀 있었는데
    # 이걸 일반 입력으로 세면 비용이 7% 적게 나온다.
    "cache_write": 12.5,
    "output": 50.0,          # 추론 토큰은 output_tokens 안에 이미 들어 있다
}

TOPICS = ["신체활동", "인지활동", "미술·만들기", "음악", "계절행사", "생활환경", "보호자 소통"]

# 블록 종류 — 화면·복사·사진 순서가 모두 이 배열 하나를 따른다
BLOCK_TYPES = ["intro", "heading", "paragraph", "photo", "caption", "outro"]

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["title", "title_alts", "topic", "blocks", "hashtags", "unverified_notes"],
    "properties": {
        "title": {"type": "string"},
        "title_alts": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
        "topic": {"type": "string", "enum": TOPICS},
        "blocks": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["type", "text", "photo_id"],
                "properties": {
                    "type": {"type": "string", "enum": BLOCK_TYPES},
                    "text": {"type": "string"},
                    # 사진 블록에서만 쓴다. 나머지는 빈 문자열.
                    "photo_id": {"type": "string"},
                },
            },
        },
        "hashtags": {"type": "array", "items": {"type": "string"}, "minItems": 5, "maxItems": 8},
        # 근거가 약해 관리자가 확인해야 하는 문장을 모델이 스스로 신고하게 한다
        "unverified_notes": {"type": "array", "items": {"type": "string"}},
    },
}

SYSTEM = """당신은 요양원의 블로그 글을 쓰는 사람입니다.

[이 블로그의 결]
- 보호자가 읽는 글입니다. 따뜻하고 정중하게, 그러나 담백하게 씁니다.
- 인사로 시작합니다: "안녕하세요, 행복한요양원 녹양역점입니다."
- 짧은 문단을 여러 개 씁니다. 한 문단은 두세 문장. 휴대폰에서 읽습니다.
- 소제목으로 장면을 나눕니다. 준비 → 진행 → 마무리의 흐름이 보이게.
- 이모지는 문단 끝에 가끔. 한 글에 서너 개면 충분합니다.
- 넉넉히 씁니다. 본문 1,800~2,800자를 목표로 합니다. 다만 아래 [사실]을
  어겨 가며 늘리지는 않습니다. 쓸 것이 없으면 짧게 끝냅니다.

[사실 — 이것이 가장 중요합니다]
- 활동 기록과 사진, 이 둘에서 확인되는 것만 씁니다.
- 사진을 봅니다. 다만 사진에서 읽어도 되는 것과 안 되는 것이 다릅니다.
    읽어도 됨 — 무엇을 쓰고 있는지(도구·재료), 어떻게 앉았는지, 대략 몇 분인지,
                실내인지, 무엇이 걸려 있는지, 무엇을 준비해 두었는지
    읽으면 안 됨 — 나눈 대화, 속마음, 감정, 날씨, 건강 상태, 누가 누구인지
- 어르신의 말을 따옴표로 지어내지 마세요. 기록에 그 말이 적혀 있을 때만 씁니다.
- "기뻐하셨습니다", "즐거워하셨습니다", "웃음꽃이 피었습니다" 처럼 마음을
  단정하는 말을 쓰지 마세요. 대신 무엇을 했는지를 자세히 씁니다.
  잘 쓴 글은 감정을 말하지 않아도 그 자리가 어땠는지 전해집니다.
- 사진 속 사람의 얼굴은 노란 스마일로 가려져 있습니다. 그 스티커를 설명하거나
  표정·인상을 쓰지 마세요.
- '치매 예방', '인지기능 개선', '보행 회복' 같은 효과를 단정하지 않습니다.
  그 활동이 무엇을 쓰는 시간인지(손끝, 호흡, 균형)는 써도 됩니다.
- 어르신의 실명·진단명·개인 사연을 쓰지 않습니다.
- 근거가 약한 문장은 unverified_notes 에 그대로 옮겨 적습니다.

[따뜻하게 쓰되 지어내지 않는 법]
- 나쁜 예: "어르신들께서 환하게 웃으며 즐거워하셨습니다"  ← 마음을 단정함
- 좋은 예: "손에 힘이 부족하신 분은 직원이 낚싯대 끝을 함께 잡아드렸고,
           한 마리를 건져 올릴 때마다 뒷면의 숫자를 같이 읽었습니다"
- 나쁜 예: "\"이렇게 축하받으니 참 좋네\" 하셨습니다"  ← 지어낸 대사
- 좋은 예: "케이크에 초를 켜고 다 함께 축하 노래를 불렀습니다"
- 정성은 문장을 꾸며서가 아니라, 무엇을 어떻게 준비했는지를 적어서 드러납니다.

[구성]
- blocks 는 순서대로 읽는 글입니다. intro → (heading/paragraph/photo/caption 반복) → outro.
- photo 블록의 photo_id 는 반드시 주어진 사진 목록의 id 중 하나여야 합니다.
- 사진은 그 사진에 실제로 찍힌 활동을 설명한 문단 옆에 둡니다.
  사진에 그 활동이 안 찍혀 있으면 그 자리에 쓰지 마세요.
- 활동과 상관없는 사진(빈 방, 장식만, 흐린 사진)은 아예 쓰지 마세요.
  받은 사진을 다 쓸 필요는 없습니다. 안 맞는 사진을 넣는 것이 더 나쁩니다.
- caption 은 그 사진에 보이는 것을 한 줄로. 본문 문장을 반복하지 않습니다.
- outro 는 그날을 한 문단으로 여미고, 앞으로도 이런 시간을 이어가겠다는
  인사로 맺습니다. 같은 뜻을 여러 문단으로 늘리지 마세요.
- 시설 소개·주소·전화는 쓰지 마세요. 시스템이 승인된 문구를 뒤에 붙입니다.
- 제목은 읽기 쉬운 한 문장. 키워드를 슬래시로 나열하지 마세요."""


class BlogWriteError(RuntimeError):
    pass


def _api_key() -> str:
    from app.core.config import settings
    key = (settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY") or "").strip()
    if not key:
        raise BlogWriteError("OPENAI_API_KEY 가 설정되어 있지 않습니다.")
    return key


def cost_of(usage: Dict[str, Any], price: Optional[Dict[str, float]] = None) -> float:
    """이번 호출의 비용(USD).

    추론 토큰은 output_tokens 안에 이미 포함돼 있다(실측 확인). 따로 더하면
    두 번 세는 것이 되어 비용이 부풀려진다.
    """
    p = price or PRICE
    det = usage.get("input_tokens_details") or {}
    inp = int(usage.get("input_tokens") or 0)
    cached = int(det.get("cached_tokens") or 0)
    written = int(det.get("cache_write_tokens") or 0)
    out = int(usage.get("output_tokens") or 0)
    # 입력 = 캐시에서 읽은 것 + 캐시에 쓴 것 + 나머지 새 입력
    fresh = max(0, inp - cached - written)
    return (fresh * p["input"] + cached * p["cached_input"]
            + written * p["cache_write"] + out * p["output"]) / 1_000_000


# 모델에 보낼 사진의 긴 변 길이. 원본(4000px)을 그대로 보내면 입력 토큰이
# 몇 배가 되는데, 무엇이 찍혔는지 알아보는 데는 이 정도면 충분하다.
PHOTO_SEND_PX = 768


def _photo_part(masked_bytes: bytes) -> Dict[str, Any]:
    """가린 사진 한 장을 모델이 볼 수 있는 형태로. 줄여서 보낸다."""
    import base64
    import io
    from PIL import Image

    im = Image.open(io.BytesIO(masked_bytes)).convert("RGB")
    w, h = im.size
    if max(w, h) > PHOTO_SEND_PX:
        r = PHOTO_SEND_PX / max(w, h)
        im = im.resize((max(1, int(w * r)), max(1, int(h * r))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=80)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return {"type": "input_image", "image_url": f"data:image/jpeg;base64,{b64}"}


def _prompt(ctx: Dict[str, Any], photos: List[Dict[str, Any]],
            history: List[Dict[str, Any]], avoid: List[str]) -> str:
    """모델에 보낼 자료 — 필요한 것만.

    지난 글은 '무엇을 이미 썼는가'를 알려주려고 요약만 보낸다. 본문 전체를
    매번 보내면 입력 토큰이 몇 배가 되고, 그 글의 에피소드를 그대로 베낄
    위험도 커진다.
    """
    lines = []
    lines.append("[이번 글의 활동 기록]")
    for a in ctx.get("activities", []):
        lines.append(f"- {a.get('date','')} · {a.get('title','')}"
                     + (f" · 그룹 {a['group']}" if a.get("group") else "")
                     + (f" · 시간 {a['time']}" if a.get("time") else ""))
        if a.get("note"):
            lines.append(f"  기록: {a['note']}")

    lines.append("\n[쓸 수 있는 사진] (가림·공개 사용 확인을 마친 것만)")
    lines.append("아래에 사진을 차례로 붙입니다. 각 사진 바로 앞에 그 사진의 id 를 적었습니다.")
    for p in photos:
        lines.append(f"- id={p['id']} · {p.get('taken_on','')} · {p.get('program_title') or '프로그램 미지정'}")

    if history:
        lines.append("\n[최근 발행한 글 — 되풀이하지 말 것]")
        for h in history:
            lines.append(f"- {h.get('published_on','')} · {h.get('title','')}"
                         + (f" · 주제 {h['topic']}" if h.get("topic") else ""))
            if h.get("summary"):
                lines.append(f"  요약: {h['summary'][:200]}")
    if avoid:
        lines.append("\n[지난 글의 내용이라 이번 글에 쓰면 안 되는 것]")
        for a in avoid:
            lines.append(f"- {a}")

    lines.append("\n위 기록만을 근거로 블로그 초안을 써 주세요.")
    return "\n".join(lines)


def write_draft(ctx: Dict[str, Any], photos: List[Dict[str, Any]],
                history: List[Dict[str, Any]], avoid: List[str],
                effort: str = "low", timeout: int = 300,
                images: Optional[Dict[str, bytes]] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """초안 한 편을 만든다. (결과, usage) 를 돌려준다.

    effort 는 낮은 값에서 시작한다 — 높일수록 추론 토큰이 늘고 그대로 비용이 된다.
    """
    import httpx

    if effort not in ("low", "medium", "high", "xhigh", "max"):
        raise BlogWriteError(f"지원하지 않는 추론 강도입니다: {effort}")

    # 글과 사진을 한 번에 보낸다. 사진 앞에 그 사진의 id 를 적어 두어야
    # 모델이 '이 사진이 그 id' 라고 짚을 수 있다.
    user: List[Dict[str, Any]] = [{"type": "input_text",
                                   "text": _prompt(ctx, photos, history, avoid)}]
    for p in photos:
        raw = (images or {}).get(p["id"])
        if not raw:
            continue
        user.append({"type": "input_text", "text": f"[사진 id={p['id']}]"})
        user.append(_photo_part(raw))

    body = {
        "model": MODEL,
        "input": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        "reasoning": {"effort": effort},
        "max_output_tokens": 16000,
        "text": {"format": {"type": "json_schema", "name": "blog_draft",
                            "schema": SCHEMA, "strict": True}},
    }
    with httpx.Client(timeout=timeout) as cli:
        r = cli.post(API_URL, headers={"Authorization": f"Bearer {_api_key()}",
                                       "Content-Type": "application/json"}, json=body)
    if r.status_code != 200:
        # 모델을 못 쓰면 그대로 알린다 — 다른 모델로 조용히 바꾸지 않는다
        detail = ""
        try:
            detail = (r.json().get("error") or {}).get("message", "")[:300]
        except Exception:
            detail = r.text[:300]
        raise BlogWriteError(f"{MODEL} 호출 실패 (HTTP {r.status_code}) {detail}")

    data = r.json()
    usage = data.get("usage") or {}
    if data.get("status") == "incomplete":
        raise BlogWriteError("응답이 중간에 끊겼습니다(max_output_tokens 초과).")

    text = ""
    for o in data.get("output", []):
        if o.get("type") == "message":
            for c in o.get("content", []):
                if c.get("type") == "output_text":
                    text += c.get("text", "")
    if not text:
        raise BlogWriteError("모델이 본문을 돌려주지 않았습니다.")
    try:
        out = json.loads(text)
    except json.JSONDecodeError as e:
        raise BlogWriteError(f"응답을 JSON 으로 읽지 못했습니다: {e}")
    return out, usage


def sanitize(out: Dict[str, Any], allowed_photo_ids: List[str]) -> Tuple[Dict[str, Any], List[str]]:
    """돌아온 결과를 서버에서 다시 검사한다.

    모델이 없는 사진 id 를 지어내면 그 블록을 버린다. 화면에서 깨진 사진이
    보이는 것보다, 사진 한 장이 빠진 채 관리자가 채우는 편이 낫다.
    """
    allowed = set(allowed_photo_ids)
    warnings: List[str] = []
    blocks: List[Dict[str, Any]] = []
    used: List[str] = []

    for b in out.get("blocks", []):
        t = b.get("type")
        if t not in BLOCK_TYPES:
            warnings.append(f"모르는 블록 종류를 버렸습니다: {t}")
            continue
        if t == "photo":
            pid = (b.get("photo_id") or "").strip()
            if pid not in allowed:
                warnings.append(f"목록에 없는 사진 id 를 버렸습니다: {pid[:12]}")
                continue
            if pid in used:
                warnings.append("같은 사진이 두 번 나와 뒤엣것을 버렸습니다")
                continue
            used.append(pid)
            blocks.append({"type": "photo", "text": "", "photo_id": pid})
            continue
        txt = (b.get("text") or "").strip()
        if not txt:
            continue
        blocks.append({"type": t, "text": txt, "photo_id": ""})

    # 캡션이 사진보다 앞에 오면 순서를 맞춘다 — 붙여넣을 때 그대로 어긋난다
    fixed: List[Dict[str, Any]] = []
    for i, b in enumerate(blocks):
        if b["type"] == "caption" and (not fixed or fixed[-1]["type"] != "photo"):
            warnings.append("사진 없이 놓인 캡션을 문단으로 바꿨습니다")
            b = {**b, "type": "paragraph"}
        fixed.append(b)

    out = dict(out)
    out["blocks"] = fixed
    out["used_photo_ids"] = used
    return out, warnings


# ── 시설 안내 (승인된 문구만) ──────────────────────────────────────────────
#
# 글마다 모델이 새로 쓰게 두면 없는 시설·없는 장비가 만들어진다. 그래서 여기
# 한 곳에 두고 글 뒤에 그대로 붙인다. 바뀌면 여기만 고친다.
#
# CONFIRMED — 주소·전화처럼 확인된 사실.
# NEEDS_OK  — 발행된 글에는 있지만 '지금도 그런가' 를 시설이 확인해야 하는 것.
#             확인 전에는 붙이지 않는다. 예전 글에 있었다는 이유로 계속 싣는
#             것은, 그 사이 바뀌었다면 거짓말이 된다.

FACILITY = {
    "name": "행복한요양원 녹양역점",
    "address": "경기도 양주시 외미로20번길 34",
    "phone": "031-856-8090",
}

# 시설이 확인해 주면 켠다. 기본은 꺼 둔다.
FACILITY_CLAIMS = [
    "각 층 간호팀 운영",
    "재활 특화 시스템 운영",
    "어르신 상태별 맞춤 케어",
    "다양한 인지·정서 프로그램 진행",
    "보호자와의 꾸준한 소통",
]


def facility_block(claims: Optional[List[str]] = None,
                   intro: Optional[str] = None) -> str:
    """글 끝에 붙는 시설 안내.

    claims 를 넘기지 않으면 항목 없이 주소·전화만 붙는다 — 확인되지 않은
    운영 설명을 자동으로 싣지 않기 위해서다.
    """
    f = FACILITY
    lines = [f"양주요양원 {f['name']} 소개", ""]
    if intro:
        lines += [intro.strip(), ""]
    for c in (claims or []):
        lines.append(f"- {c}")
    if claims:
        lines.append("")
    lines += [
        "입소 상담 및 시설 안내는 언제든 편하게 문의주세요.",
        "",
        f"위치: {f['address']}",
        f"전화번호: {f['phone']}",
        f["name"],
    ]
    return "\n".join(lines)


def body_text(blocks: List[Dict[str, Any]], photo_no: Optional[Dict[str, int]] = None) -> str:
    """네이버 편집기에 붙여넣을 본문.

    사진 자리에는 [사진 1] 처럼 번호를 남긴다. 사진 파일도 같은 번호로
    내려받게 해서, 붙여넣을 때 어디에 무엇을 넣을지 헷갈리지 않게 한다.
    """
    photo_no = photo_no or {}
    out: List[str] = []
    for b in blocks:
        # 사람이 화면에서 손댄 블록도 들어온다 — 칸이 비어 있어도 죽지 않게 한다
        t = b.get("type")
        text = (b.get("text") or "").strip()
        if t == "photo":
            out.append(f"[사진 {photo_no.get(b.get('photo_id'), '?')}]")
        elif t == "heading":
            out.append(f"\n■ {text}")
        elif t == "caption":
            out.append(f"({text})")
        else:
            out.append(text)
    return "\n\n".join(x for x in out if x).strip()
