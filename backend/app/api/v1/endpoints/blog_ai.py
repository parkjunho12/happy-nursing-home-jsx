"""
블로그 AI 작성 — 네이버 블로그용 글 초안 생성
- 입력: 얼굴 가림 처리된 이미지 + 활동 정보
- 처리: OpenAI Vision(사진 요약) → ChatGPT(초안) → Claude(문장 정제)
- 개인정보 보호: 실명/얼굴/질환/부정표현 금지
- 원본 이미지는 저장하지 않음 (분석 후 메모리에서만 사용)
"""
import base64
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from pydantic import BaseModel

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.blog_ai import BlogAiLog
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_IMAGES = 12          # 비용/시간 제한
MAX_FILE = 8 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

TONE_LABELS = {
    "warm":          "따뜻하고 정겨운",
    "guardian":      "보호자가 보아도 안심되는",
    "professional":  "전문적인 요양원 소개형",
    "seo":           "네이버 SEO 홍보형",
}

# ── 개인정보 보호 공통 규칙 ──────────────────────────────────────────────────
PRIVACY_RULES = """[개인정보 보호 규칙 — 반드시 준수]
- 어르신 실명/이니셜/호칭 외 신원정보 사용 금지. '어르신', '보호자님'으로만 지칭.
- 얼굴 특징/외모/신체 묘사 금지.
- 질환명(치매, 중풍, 당뇨 등) 직접 언급 금지.
- 사고/낙상/욕창/질환 악화 등 부정적 표현 금지.
- 사진 속 인물의 신원 추정 금지.
- 보호자가 읽어도 안심되는 따뜻한 표현 사용.
- '어르신', '보호자님', '프로그램', '일상' 중심으로 작성."""


# ── 문체 레퍼런스 (행복한요양원 녹양역점 실제 블로그 톤) ─────────────────────
FACILITY_INFO = """[우리 요양원 기본 정보]
- 이름: 행복한요양원 녹양역점 (양주 요양원, 의정부 인근, 녹양역 근처)
- 강점: 8년간 시설평가 A등급 유지 경력, 24시간 간호사 상주, 어르신 개별 맞춤 케어
  (AI·CCTV·로봇 장비 활용), 재활·놀이활동·산책, 맞춤 식단과 식사 품질 관리
- 위치: 경기도 양주시 외미로20번길 34 / 전화: 031-856-8090
- 비용은 어느 시설이든 동일하니 '어르신이 가장 편하고 안전한 곳'을 보고 선택하면 된다는 메시지"""

STYLE_REFERENCE = """[블로그 문체 예시 — 톤과 신뢰감만 참고하고 문장을 베끼지 말 것]
원장이 직접 1인칭으로 따뜻하고 진솔하게 이야기한다. 보호자의 불안한 마음에 공감하고,
어르신을 가족처럼 모신다는 진심, 시설·시스템·식사·재활에 대한 자부심을 담담히 전한다.
매주 어르신들의 일상을 블로그에 기록한다는 점을 자연스럽게 녹인다. 과장·압박 없이
'직접 보고 식사도 해보고 결정하셔도 된다'는 편안한 권유로 마무리한다."""

def _marker_rule(n: int) -> str:
    return (
        f"\n[사진 배치 규칙] 업로드된 사진은 총 {n}장이며 순서대로 모두 사용한다. "
        f"본문 중간중간 사진이 들어갈 자리에 정확히 '[사진 1]', '[사진 2]' … '[사진 {n}]' 형식의 "
        "표시를 한 줄로 넣어, 어디에 어떤 사진을 넣을지 알 수 있게 한다. "
        "각 표시는 그 사진 내용과 어울리는 단락 사이에 배치하고, 같은 번호를 중복하거나 빠뜨리지 않는다."
    )


def _index_summaries(photo_summaries):
    return [f"사진 {i + 1}: {x}" for i, x in enumerate(photo_summaries)]


def _is_allowed(user: User) -> bool:
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    pos = getattr(user, "position", None)
    return role == "ADMIN" or pos in ("사회복지사", "대표", "이사")


def _can_see_all(user: User) -> bool:
    """이력 전체 열람 권한 — ADMIN, 대표, 이사"""
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    pos = getattr(user, "position", None)
    return role == "ADMIN" or pos in ("대표", "이사")


class BlogResult(BaseModel):
    titles: List[str] = []
    body: str = ""
    hashtags: List[str] = []
    guardian_summary: str = ""
    photo_summaries: List[str] = []


# ── OpenAI Vision: 사진별 요약 ───────────────────────────────────────────────
def _summarize_photos(images_b64: List[str], captions: List[str]) -> List[str]:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=60)
    summaries: List[str] = []
    for i, b64 in enumerate(images_b64):
        cap = captions[i] if i < len(captions) and captions[i] else ""
        try:
            resp = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                temperature=0.4,
                max_tokens=220,
                messages=[
                    {"role": "system", "content":
                        "너는 요양원 블로그용 사진을 묘사하는 도우미다. "
                        "사진 속 '활동·분위기·프로그램 내용'만 2~3문장으로 요약한다. "
                        + PRIVACY_RULES},
                    {"role": "user", "content": [
                        {"type": "text", "text":
                            f"이 사진의 활동과 분위기를 요약해줘. 참고 설명: {cap or '(없음)'}"},
                        {"type": "image_url",
                         "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"}},
                    ]},
                ],
            )
            summaries.append((resp.choices[0].message.content or "").strip())
        except Exception as e:
            logger.warning(f"photo summarize 실패 #{i}: {e}")
            summaries.append(cap or "사진 분석을 불러오지 못했습니다.")
    return summaries


# ── ChatGPT: 1차 초안(JSON) ──────────────────────────────────────────────────
def _draft_with_gpt(ctx: dict, photo_summaries: List[str]) -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=90)
    tone = TONE_LABELS.get(ctx.get("tone"), "따뜻하고 정겨운")
    payload = {
        "제목키워드": ctx.get("title_keyword"),
        "활동날짜": ctx.get("activity_date"),
        "프로그램명": ctx.get("program_name"),
        "참여어르신수": ctx.get("participant_count"),
        "장소": ctx.get("location"),
        "글분위기": tone,
        "사진요약": _index_summaries(photo_summaries),
    }
    system = (
        "너는 한국 노인요양원 '행복한요양원 녹양역점'의 네이버 블로그 글을 원장의 목소리로 쓰는 작가다. "
        f"'{tone}' 분위기의 네이버 블로그 스타일(가독성 좋은 문단, 적당한 줄바꿈, 1인칭의 따뜻하고 진솔한 어투)로 작성한다. "
        "본문은 최대한 길고 풍부하게(공백 제외 1800자 이상 권장, 소제목과 여러 문단) 작성한다.\n"
        + FACILITY_INFO + "\n" + STYLE_REFERENCE + "\n"
        + "이번 글은 위 사진과 활동 정보를 바탕으로 한 '활동 소개' 글이다. 문체와 신뢰감은 예시를 참고하되 "
        "사진/활동 내용에 맞게 새로 쓰고, 시설 강점·위치·연락처는 글 흐름에 어울릴 때만 자연스럽게 한 번 언급한다.\n"
        + PRIVACY_RULES +
        "\n반드시 아래 JSON만 반환한다(마크다운 금지):\n"
        + _marker_rule(len(photo_summaries)) +
        '\n반드시 아래 JSON만 반환한다(마크다운 금지):\n'
        '{"titles": ["제목5개"], "body": "본문(네이버 블로그 스타일, 문단 구분, [사진 N] 표시 포함)", '
        '"hashtags": ["#해시태그8~12개"], "guardian_summary": "보호자 안내용 2~3문장 요약"}'
    )
    resp = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        temperature=0.7,
        max_tokens=3200,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
    )
    return json.loads(resp.choices[0].message.content or "{}")


# ── Claude: 사진 분석 결과로 본문 직접 집필 (레퍼런스 문체, 길게) ─────────────
def _write_with_claude(ctx: dict, photo_summaries: List[str], tone: str) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120)
    payload = {
        "제목키워드": ctx.get("title_keyword"),
        "활동날짜": ctx.get("activity_date"),
        "프로그램명": ctx.get("program_name"),
        "참여어르신수": ctx.get("participant_count"),
        "장소": ctx.get("location"),
        "글분위기": tone,
        "사진분석요약": _index_summaries(photo_summaries),
    }
    system = (
        "너는 '행복한요양원 녹양역점' 원장의 목소리로 네이버 블로그 글을 쓰는 한국어 작가다. "
        f"'{tone}' 분위기의 1인칭 따뜻하고 진솔한 어투, 네이버 블로그 스타일(소제목·문단·적당한 줄바꿈)로 쓴다.\n"
        + FACILITY_INFO + "\n" + STYLE_REFERENCE + "\n"
        + "ChatGPT가 분석한 사진 요약을 바탕으로 이번 활동을 소개하는 글을 직접 집필한다. "
        "문체와 신뢰감은 예시를 참고하되 문장을 그대로 베끼지 말고 새로 쓴다. "
        "글은 최대한 길고 풍부하게(공백 제외 2000자 이상 권장, 도입–활동 묘사–시설/케어 강점–식사–마무리 권유 등 여러 소제목과 문단) 작성한다. "
        "단, 거짓 사실을 지어내지 말고 사진 요약과 제공된 정보 범위 안에서 자연스럽게 확장하며, "
        "시설 강점·위치·연락처는 글 흐름에 어울릴 때 자연스럽게 녹인다.\n"
        + PRIVACY_RULES + _marker_rule(len(photo_summaries)) +
        "\n반드시 아래 JSON만 반환한다(마크다운/설명 금지):\n"
        '{"titles": ["제목5개"], "body": "긴 본문(소제목과 문단 구분)", '
        '"hashtags": ["#해시태그8~15개"], "guardian_summary": "보호자 안내용 2~3문장 요약"}'
    )
    msg = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=8192,
        temperature=0.7,
        system=system,
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
    )
    txt = (msg.content[0].text or "").strip().strip("`")
    a, b = txt.find("{"), txt.rfind("}")
    if a != -1 and b != -1:
        return json.loads(txt[a:b + 1])
    return {}


# ── Claude: 2차 문장 정제 ────────────────────────────────────────────────────
def _refine_with_claude(draft: dict, tone: str) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        return draft
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=90)
        system = (
            "너는 네이버 블로그 문장을 다듬는 한국어 에디터다. "
            f"'{tone}' 톤을 유지하며 더 자연스럽고 읽기 쉽게 본문과 제목을 다듬는다. "
            "새 사실을 지어내지 말고, 개인정보 보호 규칙을 반드시 지킨다.\n" + PRIVACY_RULES +
            "\n입력 JSON과 동일한 키(titles, body, hashtags, guardian_summary)의 JSON만 반환한다(마크다운 금지)."
        )
        msg = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=2000,
            temperature=0.5,
            system=system,
            messages=[{"role": "user", "content": json.dumps(draft, ensure_ascii=False)}],
        )
        txt = msg.content[0].text.strip()
        txt = txt.strip("`")
        s, e = txt.find("{"), txt.rfind("}")
        if s != -1 and e != -1:
            refined = json.loads(txt[s:e + 1])
            # 정제 결과가 비면 원본 유지
            for k in ("titles", "body", "hashtags", "guardian_summary"):
                if not refined.get(k):
                    refined[k] = draft.get(k)
            return refined
    except Exception as e:
        logger.warning(f"Claude 정제 실패 → GPT 초안 사용: {e}")
    return draft


@router.post("/analyze", response_model=ApiResponse)
async def analyze_blog(
    images: List[UploadFile] = File(...),
    title_keyword: Optional[str] = Form(None),
    activity_date: Optional[str] = Form(None),
    program_name: Optional[str] = Form(None),
    participant_count: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    tone: str = Form("warm"),
    captions: List[str] = Form(default=[]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_allowed(current_user):
        raise HTTPException(403, "관리자 또는 사회복지사만 사용할 수 있습니다")
    if not settings.OPENAI_API_KEY:
        raise HTTPException(503, "OPENAI_API_KEY가 설정되지 않았습니다")
    if not images:
        raise HTTPException(400, "사진을 1장 이상 업로드하세요")

    images = images[:MAX_IMAGES]
    images_b64: List[str] = []
    for f in images:
        if f.content_type not in ALLOWED:
            raise HTTPException(400, f"지원하지 않는 형식: {f.content_type}")
        data = await f.read()
        if len(data) > MAX_FILE:
            raise HTTPException(400, "이미지 1장은 8MB 이하만 허용합니다")
        images_b64.append(base64.b64encode(data).decode())
        # 원본은 저장하지 않는다 (메모리에서만 사용)

    ctx = {
        "title_keyword": title_keyword, "activity_date": activity_date,
        "program_name": program_name, "participant_count": participant_count,
        "location": location, "tone": tone,
    }
    tone_label = TONE_LABELS.get(tone, "따뜻하고 정겨운")

    try:
        # 1) ChatGPT Vision: 사진 분석
        photo_summaries = _summarize_photos(images_b64, captions)
        # 2) Claude: 분석 결과로 본문 직접 집필 (레퍼런스 문체, 길게)
        drafted = {}
        if settings.ANTHROPIC_API_KEY:
            try:
                drafted = _write_with_claude(ctx, photo_summaries, tone_label)
            except Exception as e:
                logger.warning(f"Claude 집필 실패 → GPT 폴백: {e}")
                drafted = {}
        # 3) Claude 키가 없거나 실패하면 GPT가 작성
        if not drafted.get("body"):
            drafted = _draft_with_gpt(ctx, photo_summaries)
    except Exception as e:
        logger.exception("blog-ai analyze 실패")
        raise HTTPException(502, f"AI 생성 실패: {str(e)[:120]}")

    result = BlogResult(
        titles=drafted.get("titles", [])[:5],
        body=drafted.get("body", ""),
        hashtags=drafted.get("hashtags", []),
        guardian_summary=drafted.get("guardian_summary", ""),
        photo_summaries=photo_summaries,
    )

    # ── 사용 이력 저장 (실패해도 생성 결과는 반환) ──────────────────────────
    try:
        role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        db.add(BlogAiLog(
            user_id=current_user.id, user_name=current_user.name,
            user_role=role, position=getattr(current_user, "position", None),
            title_keyword=title_keyword, program_name=program_name,
            location=location, activity_date=activity_date,
            participant_count=participant_count, tone=tone,
            photo_count=len(images_b64),
            titles=result.titles, body=result.body,
            hashtags=result.hashtags, guardian_summary=result.guardian_summary,
        ))
        db.commit()
    except Exception as e:
        logger.warning(f"blog-ai 로그 저장 실패: {e}")
        db.rollback()

    return ApiResponse(success=True, data=result.model_dump())


def _log_to_dict(l: BlogAiLog) -> dict:
    return {
        "id": l.id, "user_id": l.user_id, "user_name": l.user_name,
        "user_role": l.user_role, "position": l.position,
        "title_keyword": l.title_keyword, "program_name": l.program_name,
        "location": l.location, "activity_date": l.activity_date,
        "participant_count": l.participant_count, "tone": l.tone,
        "photo_count": l.photo_count, "titles": l.titles or [],
        "body": l.body or "", "hashtags": l.hashtags or [],
        "guardian_summary": l.guardian_summary or "",
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


@router.get("/logs", response_model=ApiResponse)
def list_logs(
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """사용 이력 — ADMIN·대표·이사는 전체, 사회복지사는 본인 것만."""
    if not _is_allowed(current_user):
        raise HTTPException(403, "권한이 없습니다")
    see_all = _can_see_all(current_user)

    q = db.query(BlogAiLog)
    if not see_all:
        q = q.filter(BlogAiLog.user_id == current_user.id)
    logs = q.order_by(desc(BlogAiLog.created_at)).limit(max(1, min(limit, 500))).all()

    # 계정별 사용 횟수 집계 (ADMIN·대표·이사는 전체, 그 외 본인)
    usage_q = db.query(BlogAiLog)
    if not see_all:
        usage_q = usage_q.filter(BlogAiLog.user_id == current_user.id)
    usage_map: dict = {}
    for l in usage_q.all():
        key = l.user_id or l.user_name or "?"
        if key not in usage_map:
            usage_map[key] = {"user_name": l.user_name, "position": l.position,
                              "user_role": l.user_role, "count": 0}
        usage_map[key]["count"] += 1
    usage = sorted(usage_map.values(), key=lambda x: x["count"], reverse=True)

    return ApiResponse(success=True, data={
        "logs": [_log_to_dict(l) for l in logs],
        "usage": usage,
        "total": sum(u["count"] for u in usage),
    })
