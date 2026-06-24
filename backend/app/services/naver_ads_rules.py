"""
입찰가 조정 룰 엔진 + AI 요약.

설계 원칙:
  - 초기 버전은 LLM이 아니라 '룰 기반' 으로 조정안을 만든다.
  - 나중에 Claude/OpenAI 분석을 끼워넣을 수 있도록 함수 단위로 분리한다.
  - 개인정보는 절대 다루지 않는다 (광고 성과 지표 + 키워드 텍스트만).
  - 1회 최대 변경폭 ±20%, Tier1 최소 입찰가 500원.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger("naver_ads")

# --------------------------------------------------------------------------- #
# 키워드 우선순위 (Tier)
# --------------------------------------------------------------------------- #
TIER1_KEYWORDS = [
    "양주요양원", "양주 요양원 추천", "양주 부모님 요양원",
    "의정부요양원", "의정부 요양원 추천", "의정부 부모님 요양원",
    "서울북부요양원", "서울북부 요양원 추천", "서울북부 부모님 요양원",
    "노원요양원", "도봉요양원", "강북요양원", "중랑요양원",
    "녹양역요양원", "경기북부요양원",
]
TIER2_KEYWORDS = [
    "가능동 요양원", "민락동 요양원", "장암동 요양원", "회룡역 요양원",
    "망월사역 요양원", "옥정동 요양원", "고읍동 요양원", "덕정동 요양원",
    "회천동 요양원", "덕계동 요양원", "별내 요양원", "다산 요양원",
]
TIER3_KEYWORDS = [
    "요양원 비용", "요양원 입소", "장기요양등급 요양원", "치매 요양원",
    "파킨슨 요양원", "부모님 요양원", "근처 요양원",
]

# 가장 공격적으로 유지할 핵심 지역
CORE_AGGRESSIVE = ("양주", "의정부", "녹양역")
# 거리상 넓은 타깃 — CTR/전환 함께 보고 신중히
BROAD_REGION = ("서울북부", "노원", "도봉", "강북", "중랑")

# --------------------------------------------------------------------------- #
# 룰 파라미터 (튜닝 가능)
# --------------------------------------------------------------------------- #
TIER1_MIN_BID = 500          # Tier1 최소 입찰가(원)
MAX_CHANGE_RATE = 0.20       # 1회 최대 변경폭 ±20%
GOOD_CTR = 0.05              # '좋은' CTR 기준 (5%)
LOW_CTR = 0.01              # '낮은' CTR 기준 (1%)
TIER1_PROTECT_MIN_CLICKS = 30   # Tier1 인하 보호: 최소 클릭 수
TIER1_PROTECT_MIN_DAYS = 7      # Tier1 인하 보호: 최소 관측일
TIER3_DECREASE_MIN_CLICKS = 20  # Tier3 인하 판단 최소 클릭
BID_ROUND_UNIT = 10            # 입찰가 반올림 단위(원)


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", (s or "")).lower()


def classify_tier(keyword: str) -> Optional[int]:
    """키워드 → Tier(1/2/3). 정확/부분 매칭 모두 시도. 미분류는 None."""
    k = _norm(keyword)
    for tier, group in ((1, TIER1_KEYWORDS), (2, TIER2_KEYWORDS), (3, TIER3_KEYWORDS)):
        for kw in group:
            if _norm(kw) == k:
                return tier
    # 부분 매칭 (지역명/일반니즈 포함)
    for tier, group in ((1, TIER1_KEYWORDS), (2, TIER2_KEYWORDS), (3, TIER3_KEYWORDS)):
        for kw in group:
            if _norm(kw) in k or k in _norm(kw):
                return tier
    return None


def detect_region(keyword: str) -> Optional[str]:
    k = keyword or ""
    for r in CORE_AGGRESSIVE:
        if r in k:
            return r
    for r in BROAD_REGION:
        if r in k:
            return r
    return None


def _clamp_bid(current_bid: int, target_bid: float, tier: Optional[int]) -> int:
    """±20% 클램프 + Tier1 최소 입찰가 + 반올림."""
    low = current_bid * (1 - MAX_CHANGE_RATE)
    high = current_bid * (1 + MAX_CHANGE_RATE)
    val = max(low, min(high, target_bid))
    if tier == 1:
        val = max(val, TIER1_MIN_BID)
    # 반올림
    val = round(val / BID_ROUND_UNIT) * BID_ROUND_UNIT
    return int(val)


@dataclass
class BidSuggestion:
    keyword_id: str
    keyword: str
    current_bid: int
    recommended_bid: int
    change_rate: float          # -0.2 ~ +0.2
    action: str                 # "increase" | "decrease" | "hold"
    severity: str               # "high" | "medium" | "low"
    reason: str
    expected_effect: str
    needs_creative_review: bool
    tier: Optional[int] = None
    campaign_name: Optional[str] = None
    adgroup_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def suggest_for_keyword(row: Dict[str, Any]) -> BidSuggestion:
    """
    단일 키워드 성과 → 조정안.
    기대 입력 키: keyword_id, keyword, current_bid, impressions, clicks, ctr,
    avg_cpc, cost, conversions, conversion_rate, cost_per_conversion,
    budget_spent_ratio, data_days, campaign_name, adgroup_name, campaign_type, target_region
    """
    keyword = row.get("keyword", "")
    kid = str(row.get("keyword_id", ""))
    current_bid = int(row.get("current_bid") or 0)
    clicks = int(row.get("clicks") or 0)
    ctr = float(row.get("ctr") or 0.0)
    conv = float(row.get("conversions") or 0.0)
    cost = float(row.get("cost") or 0.0)
    data_days = int(row.get("data_days") or 0)
    spent_ratio = float(row.get("budget_spent_ratio") or 0.0)

    tier = classify_tier(keyword)
    region = row.get("target_region") or detect_region(keyword)

    action = "hold"
    severity = "low"
    target = float(current_bid)
    reason = ""
    needs_creative = False

    if tier == 1:
        is_core = region in CORE_AGGRESSIVE if region else any(r in keyword for r in CORE_AGGRESSIVE)
        # 1) 전환 있거나 CTR 우수 → 인상
        if conv > 0 or ctr >= GOOD_CTR:
            pct = 0.20 if (conv > 0 and is_core) else 0.15 if conv > 0 else 0.10
            target = current_bid * (1 + pct)
            action = "increase"
            severity = "high" if conv > 0 else "medium"
            reason = (
                f"Tier1 핵심 키워드. {'전환 발생' if conv > 0 else f'CTR {ctr*100:.1f}%로 양호'}"
                f"하여 입찰가 {int(pct*100)}% 인상으로 상위 노출을 강화합니다."
            )
        else:
            # 데이터 부족하면 인하 보류 (보호 규칙)
            enough = (clicks >= TIER1_PROTECT_MIN_CLICKS) or (data_days >= TIER1_PROTECT_MIN_DAYS)
            if not enough:
                action = "hold"
                severity = "low"
                reason = (
                    f"Tier1 키워드. 데이터가 부족(클릭 {clicks}회 / {data_days}일)하여 "
                    f"인하하지 않고 유지합니다(최소 {TIER1_PROTECT_MIN_CLICKS}클릭 또는 {TIER1_PROTECT_MIN_DAYS}일 확보 후 판단)."
                )
            else:
                # 데이터 충분 + 전환 없음 → 소폭 인하 + 소재 점검
                if is_core:
                    action = "hold"
                    severity = "medium"
                    reason = "Tier1 핵심 지역(양주/의정부/녹양역) 키워드는 공격적으로 유지합니다. 전환이 없으나 광고 소재 점검을 권장합니다."
                    needs_creative = True
                else:
                    target = current_bid * 0.90
                    action = "decrease"
                    severity = "medium"
                    reason = "Tier1이지만 충분한 데이터에도 전환이 없어 10% 소폭 인하하고 소재를 점검합니다."
                    needs_creative = True
        # 최소 입찰가 보장
        if current_bid < TIER1_MIN_BID and action != "decrease":
            target = max(target, TIER1_MIN_BID)
            if action == "hold":
                action = "increase"
            reason += f" Tier1 최소 입찰가({TIER1_MIN_BID}원)를 적용합니다."

    elif tier == 2:
        # 성과 기반 탄력 조정
        if conv > 0 or ctr >= GOOD_CTR:
            target = current_bid * 1.10
            action = "increase"; severity = "medium"
            reason = f"Tier2 확장 키워드. {'전환 발생' if conv>0 else 'CTR 양호'}로 10% 인상합니다."
        elif clicks >= TIER3_DECREASE_MIN_CLICKS and conv == 0 and ctr < LOW_CTR:
            target = current_bid * 0.85
            action = "decrease"; severity = "medium"
            reason = f"Tier2 키워드. 클릭 {clicks}회에도 전환이 없고 CTR이 낮아 15% 인하합니다."
            needs_creative = True
        else:
            action = "hold"; severity = "low"
            reason = "Tier2 키워드. 성과 데이터가 더 필요해 현 입찰가를 유지합니다."

    elif tier == 3:
        # 비용 소진 빠르고 전환 없으면 빠르게 인하/보류
        if conv == 0 and (clicks >= TIER3_DECREASE_MIN_CLICKS or spent_ratio >= 0.5):
            target = current_bid * 0.80
            action = "decrease"; severity = "high"
            reason = "Tier3 일반 키워드. 비용은 소진되나 전환이 없어 20% 인하 또는 보류를 권장합니다."
            needs_creative = True
        elif conv > 0:
            target = current_bid * 1.05
            action = "increase"; severity = "low"
            reason = "Tier3 키워드이나 전환이 있어 소폭(5%) 인상합니다."
        else:
            action = "hold"; severity = "low"
            reason = "Tier3 키워드. 비용 소진이 크지 않아 유지하며 관찰합니다."

    else:
        # 미분류 키워드: 보수적으로 유지, 명백한 낭비만 인하
        if conv == 0 and clicks >= TIER3_DECREASE_MIN_CLICKS and ctr < LOW_CTR:
            target = current_bid * 0.90
            action = "decrease"; severity = "low"
            reason = "분류되지 않은 키워드. 클릭 대비 전환·CTR이 저조해 10% 인하합니다."
        else:
            action = "hold"; severity = "low"
            reason = "분류되지 않은 키워드. 현 입찰가를 유지합니다."

    recommended = _clamp_bid(current_bid, target, tier) if current_bid > 0 else int(max(target, TIER1_MIN_BID if tier == 1 else target))
    change_rate = ((recommended - current_bid) / current_bid) if current_bid > 0 else 0.0
    if abs(change_rate) < 1e-6:
        action = "hold"

    expected = _expected_effect(action, severity, region)

    return BidSuggestion(
        keyword_id=kid,
        keyword=keyword,
        current_bid=current_bid,
        recommended_bid=recommended,
        change_rate=round(change_rate, 4),
        action=action,
        severity=severity,
        reason=reason.strip(),
        expected_effect=expected,
        needs_creative_review=needs_creative,
        tier=tier,
        campaign_name=row.get("campaign_name"),
        adgroup_name=row.get("adgroup_name"),
    )


def _expected_effect(action: str, severity: str, region: Optional[str]) -> str:
    if action == "increase":
        return "상위 노출 비중 증가, 클릭·상담 문의 유입 확대 기대"
    if action == "decrease":
        return "불필요한 광고비 절감, 전환 효율(CPA) 개선 기대"
    return "현 상태 유지하며 데이터 추가 확보"


def generate_bid_suggestions(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """키워드 성과 리스트 → 조정안 리스트(dict)."""
    out: List[Dict[str, Any]] = []
    for row in rows:
        try:
            out.append(suggest_for_keyword(row).to_dict())
        except Exception as e:  # 개별 실패는 건너뜀 (개인정보 없음)
            logger.warning("bid suggestion failed for a keyword: %s", type(e).__name__)
            continue
    # 우선순위: severity high → action increase 우선 정렬
    sev_order = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda s: (sev_order.get(s["severity"], 3), 0 if s["action"] != "hold" else 1))
    return out


# --------------------------------------------------------------------------- #
# AI 요약 (룰 기반 + 선택적 LLM)
# --------------------------------------------------------------------------- #
def summarize_performance(
    performance: Dict[str, Any],
    keyword_rows: List[Dict[str, Any]],
    suggestions: List[Dict[str, Any]],
    use_llm: bool = False,
) -> Dict[str, Any]:
    """
    광고 성과/조정안 → 요약. 개인정보는 입력하지 않는다(지표·키워드만).
    use_llm=True 이고 OPENAI_API_KEY가 있으면 LLM으로 자연어 요약을 보강한다.
    """
    base = _rule_based_summary(performance, keyword_rows, suggestions)
    if not use_llm:
        return base
    try:
        enhanced = _llm_summary(performance, keyword_rows, suggestions)
        if enhanced and enhanced.get("summary"):
            # 룰 기반 findings/actions는 유지하고 summary 문장만 보강
            base["summary"] = enhanced["summary"]
            for k in ("key_findings", "recommended_actions", "warnings"):
                if enhanced.get(k):
                    base[k] = enhanced[k]
    except Exception as e:
        logger.warning("llm summary skipped: %s", type(e).__name__)
    return base


def _rule_based_summary(performance, keyword_rows, suggestions) -> Dict[str, Any]:
    incs = [s for s in suggestions if s["action"] == "increase"]
    decs = [s for s in suggestions if s["action"] == "decrease"]
    creative = [s for s in suggestions if s.get("needs_creative_review")]

    top_inc = sorted(incs, key=lambda s: s["change_rate"], reverse=True)[:3]
    top_dec = sorted(decs, key=lambda s: s["change_rate"])[:3]

    cost = float(performance.get("cost") or 0)
    conv = float(performance.get("conversions") or 0)
    cpa = performance.get("cost_per_conversion")

    summary_parts = []
    if top_inc:
        names = ", ".join(f"'{s['keyword']}'" for s in top_inc)
        summary_parts.append(f"{names} 키워드는 성과가 좋아 입찰가 인상을 권장합니다.")
    if top_dec:
        names = ", ".join(f"'{s['keyword']}'" for s in top_dec)
        summary_parts.append(f"{names} 키워드는 클릭 대비 전환이 약해 입찰가 인하 또는 소재 점검을 권장합니다.")
    if not summary_parts:
        summary_parts.append("현재 데이터로는 큰 조정 없이 현 입찰가를 유지하며 관찰하는 것이 좋습니다.")

    key_findings = [
        f"분석 키워드 {len(keyword_rows)}개 · 인상 제안 {len(incs)}개 · 인하 제안 {len(decs)}개",
        f"총 광고비 {int(cost):,}원 · 전환 {int(conv)}건" + (f" · CPA {int(cpa):,}원" if cpa else ""),
    ]
    recommended_actions = []
    for s in top_inc:
        recommended_actions.append(f"'{s['keyword']}' 입찰가 {s['current_bid']:,}→{s['recommended_bid']:,}원 ({s['change_rate']*100:+.0f}%)")
    for s in top_dec:
        recommended_actions.append(f"'{s['keyword']}' 입찰가 {s['current_bid']:,}→{s['recommended_bid']:,}원 ({s['change_rate']*100:+.0f}%)")
    if not recommended_actions:
        recommended_actions.append("이번 주는 적용할 변경이 없습니다. 데이터를 더 확보하세요.")

    warnings = []
    if creative:
        kws = ", ".join(f"'{s['keyword']}'" for s in creative[:5])
        warnings.append(f"소재(광고문구) 점검 권장: {kws}")
    warnings.append("모든 변경은 관리자 승인 후에만 실제 계정에 반영됩니다.")

    return {
        "summary": " ".join(summary_parts),
        "key_findings": key_findings,
        "recommended_actions": recommended_actions,
        "warnings": warnings,
    }


def _llm_summary(performance, keyword_rows, suggestions) -> Optional[Dict[str, Any]]:
    """OpenAI로 자연어 요약 보강 (개인정보 없음, 실패 시 None)."""
    import json
    from app.services.openai import get_openai_client

    client = get_openai_client()
    if not getattr(client, "client", None):
        return None

    # 개인정보 제거된 지표만 전달
    payload = {
        "performance": {k: performance.get(k) for k in (
            "impressions", "clicks", "ctr", "cost", "avg_cpc",
            "conversions", "conversion_rate", "cost_per_conversion")},
        "keywords": [
            {k: r.get(k) for k in ("keyword", "current_bid", "impressions", "clicks",
                                    "ctr", "avg_cpc", "cost", "conversions", "conversion_rate")}
            for r in keyword_rows[:60]
        ],
        "suggestions": [
            {k: s.get(k) for k in ("keyword", "action", "change_rate", "recommended_bid", "reason")}
            for s in suggestions[:60]
        ],
    }
    prompt = (
        "당신은 요양원 검색광고 운영 전문가입니다. 아래 네이버 검색광고 성과/조정안(개인정보 없음)을 "
        "보호자 상담 전환 관점에서 분석해 한국어로 요약하세요. 과장 없이 사실 기반으로 작성하고, "
        "반드시 아래 JSON 형식으로만 답하세요.\n"
        '{"summary": "2~3문장 요약", "key_findings": ["..."], '
        '"recommended_actions": ["..."], "warnings": ["..."]}\n\n'
        f"데이터:\n{json.dumps(payload, ensure_ascii=False)}"
    )
    resp = client.client.chat.completions.create(
        model=getattr(__import__('app.core.config', fromlist=['settings']).settings, 'OPENAI_MODEL', 'gpt-4o-mini'),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    content = resp.choices[0].message.content
    return json.loads(content)


# --------------------------------------------------------------------------- #
# Claude(Anthropic) 기반 입찰가 제안
#   - Claude가 키워드별 조정안을 생성하고, 서버에서 안전장치(±20%, Tier1 최소가)로
#     다시 클램프한다. 키/실패 시 룰 기반으로 폴백한다. 개인정보는 전달하지 않는다.
# --------------------------------------------------------------------------- #
def _extract_json_array(text: str):
    import json
    t = (text or "").strip()
    if "```" in t:
        t = t.split("```")[1]
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    a, b = t.find("["), t.rfind("]")
    if a == -1 or b == -1:
        return None
    return json.loads(t[a:b + 1])


def claude_bid_decisions(rows):
    """Claude에게 키워드별 조정안을 요청 → {keyword_id: decision}. 실패/미설정 시 None."""
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        import json
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60)

        items = [{
            "keyword_id": str(r.get("keyword_id")),
            "keyword": r.get("keyword"),
            "tier": classify_tier(r.get("keyword", "")),
            "current_bid": int(r.get("current_bid") or 0),
            "impressions": int(r.get("impressions") or 0),
            "clicks": int(r.get("clicks") or 0),
            "ctr": round(float(r.get("ctr") or 0), 4),
            "avg_cpc": float(r.get("avg_cpc") or 0),
            "cost": float(r.get("cost") or 0),
            "conversions": float(r.get("conversions") or 0),
            "conversion_rate": round(float(r.get("conversion_rate") or 0), 4),
            "cost_per_conversion": r.get("cost_per_conversion"),
            "data_days": int(r.get("data_days") or 0),
        } for r in rows[:80]]

        rules = (
            "당신은 요양원(행복한요양원 녹양역점) 네이버 검색광고 입찰 최적화 전문가입니다. "
            "목표는 '상담 전환 가능성이 높은 키워드에 예산을 집중'하는 것입니다. 다음 규칙을 지키세요.\n"
            "- Tier1(핵심 지역: 양주/의정부/녹양역/서울북부 등)은 최소 입찰가 500원 이상 유지, 전환 또는 높은 CTR이면 10~20% 인상.\n"
            "- Tier1은 데이터 부족(클릭<30 또는 관측<7일)이면 전환이 없어도 인하하지 말고 유지.\n"
            "- 양주/의정부/녹양역 키워드는 가장 공격적으로 유지/인상.\n"
            "- 서울북부 등 광역 키워드는 CTR과 전환을 함께 보고 신중히 조정.\n"
            "- Tier2는 성과 기반 탄력 조정. Tier3(요양원 비용/입소 등 일반 키워드)는 비용 소진 대비 전환 없으면 빠르게 인하/보류.\n"
            "- 1회 변경폭은 ±20%를 넘지 마세요(서버에서도 강제 클램프됨).\n"
            "- 전환이 없는데 클릭/비용만 큰 키워드는 needs_creative_review=true(광고문구 점검)로 표시.\n"
            "각 키워드에 대해 아래 JSON 배열로만 답하세요(설명 텍스트 금지):\n"
            '[{"keyword_id":"...","action":"increase|decrease|hold","recommended_bid":정수원,'
            '"severity":"high|medium|low","reason":"한국어 한 문장","expected_effect":"한국어 한 문장",'
            '"needs_creative_review":true|false}]'
        )
        prompt = rules + "\n\n데이터:\n" + json.dumps(items, ensure_ascii=False)

        msg = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(getattr(b, "text", "") for b in msg.content)
        arr = _extract_json_array(text)
        if not arr:
            return None
        return {str(d.get("keyword_id")): d for d in arr if d.get("keyword_id") is not None}
    except Exception as e:
        logger.warning("claude bid decisions failed: %s", type(e).__name__)
        return None


def generate_bid_suggestions_claude(rows):
    """Claude 제안 + 서버 안전 클램프. Claude 미설정/실패 시 룰 기반으로 폴백."""
    cmap = claude_bid_decisions(rows)
    if not cmap:
        return generate_bid_suggestions(rows)

    out = []
    for r in rows:
        rid = str(r.get("keyword_id"))
        base = suggest_for_keyword(r)         # 룰 기반 베이스(폴백/보강용)
        c = cmap.get(rid)
        if not c:
            out.append(base.to_dict())
            continue

        tier = classify_tier(r.get("keyword", ""))
        current = int(r.get("current_bid") or 0)
        try:
            target = float(c.get("recommended_bid", base.recommended_bid))
        except (TypeError, ValueError):
            target = float(base.recommended_bid)
        rec = _clamp_bid(current, target, tier) if current > 0 else base.recommended_bid
        change = ((rec - current) / current) if current else 0.0
        action = (c.get("action") or base.action)
        if abs(change) < 1e-6:
            action = "hold"

        out.append({
            "keyword_id": rid,
            "keyword": r.get("keyword"),
            "current_bid": current,
            "recommended_bid": rec,
            "change_rate": round(change, 4),
            "action": action if action in ("increase", "decrease", "hold") else base.action,
            "severity": c.get("severity") if c.get("severity") in ("high", "medium", "low") else base.severity,
            "reason": (c.get("reason") or base.reason),
            "expected_effect": (c.get("expected_effect") or base.expected_effect),
            "needs_creative_review": bool(c.get("needs_creative_review", base.needs_creative_review)),
            "tier": tier,
            "campaign_name": r.get("campaign_name"),
            "adgroup_name": r.get("adgroup_name"),
            "source": "claude",
        })

    sev_order = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda s: (sev_order.get(s["severity"], 3), 0 if s["action"] != "hold" else 1))
    return out
