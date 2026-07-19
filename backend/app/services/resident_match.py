"""
인수인계 판독 결과의 어르신 이름 ↔ 등록 수급자 명단 매칭

한글 이름은 2~4자라 한 글자 오독이 곧 다른 사람이 된다.
따라서 자동 확정은 근거가 분명할 때만 하고, 애매하면 사람이 확인하도록 표시한다.

매칭 단계
  1) 완전 일치            → exact   (1.00)
  2) 마스킹 일치(맹○영)   → masked  (0.95)
  3) 성 + 길이 + 유사도    → fuzzy   (0.60~0.94)
  4) 후보 2명이 비슷하면    → ambiguous (사람 확인 필요)
  5) 그 외                → none
"""
from __future__ import annotations
import difflib
import re
from typing import Any, Dict, List, Optional

MASK_CHARS = set("○◯●∘*Oo□■?")
JAMO_MIN = 0.70           # 자모 유사도 하한
AMBIGUOUS_GAP = 0.06      # 1·2위 점수 차가 이보다 작으면 애매로 처리

# ── 한글 자모 분해 ────────────────────────────────────────────────
# 손글씨 오독은 글자가 아니라 '자모' 단위로 일어난다.
#   맹(ㅁㅐㅇ) → 명(ㅁㅕㅇ), 화(ㅎㅘ) → 하(ㅎㅏ)  … 모음만 틀린 경우가 흔하다.
# 특히 초성(자음)은 모음보다 훨씬 안정적이라 신원 판단의 핵심 단서다.
_CHO = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
_JUNG = list("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
_JONG = list(" ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")


def _decompose(s: str) -> str:
    out = []
    for ch in s:
        c = ord(ch)
        if 0xAC00 <= c <= 0xD7A3:
            i = c - 0xAC00
            out.append(_CHO[i // 588])
            out.append(_JUNG[(i % 588) // 28])
            if i % 28:
                out.append(_JONG[i % 28])
        else:
            out.append(ch)
    return "".join(out)


def _chosung(s: str) -> str:
    out = []
    for ch in s:
        c = ord(ch)
        out.append(_CHO[(c - 0xAC00) // 588] if 0xAC00 <= c <= 0xD7A3 else ch)
    return "".join(out)


# 손글씨에서 획 하나 차이로 흔히 혼동되는 자음 무리
# (ㅈ↔ㅊ, ㄷ↔ㅌ 처럼 가로획 유무 차이). 서로 무관한 자음은 넣지 않는다.
_CONFUSABLE = [set("ㄱㅋㄲ"), set("ㄷㅌㄸ"), set("ㅂㅍㅃ"), set("ㅈㅊㅉ"), set("ㅅㅆ")]


def _cho_near(a: str, b: str) -> bool:
    """초성 열이 '완전 일치 또는 혼동쌍 1곳 이내'인지 — 같은 사람일 가능성이 높은 범위"""
    if len(a) != len(b):
        return False
    subs = 0
    for ca, cb in zip(a, b):
        if ca == cb:
            continue
        if any(ca in g and cb in g for g in _CONFUSABLE):
            subs += 1
            if subs > 1:      # 두 곳 이상 다르면 다른 사람으로 본다
                return False
            continue
        return False
    return True


def _jamo_ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, _decompose(a), _decompose(b)).ratio()


def _norm(s: Optional[str]) -> str:
    return re.sub(r"[\s·.\-_()]", "", (s or "")).strip()


def _masked_equal(a: str, b: str) -> bool:
    """'맹○영' ↔ '맹라영' 처럼 마스크 자리를 제외하고 일치하는지"""
    if len(a) != len(b) or not a:
        return False
    saw_mask = False
    for ca, cb in zip(a, b):
        if ca in MASK_CHARS or cb in MASK_CHARS:
            saw_mask = True
            continue
        if ca != cb:
            return False
    return saw_mask


def match_one(raw: str, residents: List[Dict[str, Any]]) -> Dict[str, Any]:
    """이름 하나를 명단과 대조. 항상 dict 반환(매칭 실패 시 status='none')."""
    out = {"resident_id": None, "resident_name": None, "match": "none", "score": 0.0}
    n = _norm(raw)
    if not n or not residents:
        return out

    # 1) 완전 일치
    for r in residents:
        if _norm(r.get("name")) == n:
            return {"resident_id": r.get("id"), "resident_name": r.get("name"),
                    "match": "exact", "score": 1.0}

    # 2) 마스킹 일치 — 단, 후보가 여러 명이면 애매
    masked = [r for r in residents if _masked_equal(n, _norm(r.get("name")))]
    if len(masked) == 1:
        r = masked[0]
        return {"resident_id": r.get("id"), "resident_name": r.get("name"),
                "match": "masked", "score": 0.95}
    if len(masked) > 1:
        return {"resident_id": None, "resident_name": None,
                "match": "ambiguous", "score": 0.95,
                "candidates": [r.get("name") for r in masked[:4]]}

    # 3) 자모 기반 — 초성이 모두 같고 길이가 같으면 '모음만 오독'으로 보고 확정
    #    (맹화영 ↔ 명하영).  초성이 다르면 다른 사람일 수 있으므로 확정하지 않는다.
    strong = []
    weak = []
    for r in residents:
        m = _norm(r.get("name"))
        if not m or len(m) != len(n):
            continue                      # 길이가 다르면 후보에서 제외
        ratio = _jamo_ratio(n, m)
        cn, cm = _chosung(n), _chosung(m)
        if cn == cm:
            strong.append((max(0.85, ratio), r))            # 모음만 오독
        elif _cho_near(cn, cm) and ratio >= JAMO_MIN:
            strong.append((max(0.78, ratio - 0.05), r))     # 혼동 자음 1곳(ㅈ↔ㅊ 등)
        elif ratio >= JAMO_MIN:
            weak.append((ratio, r))

    if len(strong) == 1:
        sc, r = strong[0]
        return {"resident_id": r.get("id"), "resident_name": r.get("name"),
                "match": "fuzzy", "score": round(sc, 2)}
    if len(strong) > 1:
        strong.sort(key=lambda x: -x[0])
        if strong[0][0] - strong[1][0] >= AMBIGUOUS_GAP:
            sc, r = strong[0]
            return {"resident_id": r.get("id"), "resident_name": r.get("name"),
                    "match": "fuzzy", "score": round(sc, 2)}
        return {"resident_id": None, "resident_name": None, "match": "ambiguous",
                "score": round(strong[0][0], 2),
                "candidates": [x[1].get("name") for x in strong[:4]]}

    # 초성이 다른 경우 — 자동 확정하지 않고 '확인 필요'로만 제시(오지목 방지)
    if weak:
        weak.sort(key=lambda x: -x[0])
        return {"resident_id": None, "resident_name": None, "match": "ambiguous",
                "score": round(weak[0][0], 2),
                "candidates": [x[1].get("name") for x in weak[:4]],
                "suggest": [{"id": x[1].get("id"), "name": x[1].get("name"),
                             "score": round(x[0], 2)} for x in weak[:3]]}

    # 임계 미달이어도 '혹시 이 사람?' 후보는 제시한다(자동 확정은 하지 않음).
    near = []
    for r in residents:
        m = _norm(r.get("name"))
        if not m:
            continue
        ratio = _jamo_ratio(n, m)
        if len(m) == len(n):
            ratio += 0.05                       # 글자 수 같으면 가산
        if _chosung(n)[:1] == _chosung(m)[:1]:
            ratio += 0.03                       # 성이 같으면 가산
        if ratio >= 0.45:
            near.append((min(ratio, 0.99), r))
    if near:
        near.sort(key=lambda x: -x[0])
        out["suggest"] = [{"id": x[1].get("id"), "name": x[1].get("name"),
                           "score": round(x[0], 2)} for x in near[:3]]
    return out


def apply_matching(report: Dict[str, Any], residents: List[Dict[str, Any]],
                   staff: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """판독 결과의 이름을 명단과 대조해 확정한다.

    - 어르신 이름(entries.resident, alerts.resident, 제안 대상자)
    - 작성자(entries.writer) → 직원 명단
    원문은 그대로 보존하고 확정본을 별도 필드에 담는다(감사 가능).
    """
    if not isinstance(report, dict):
        return report

    cache: Dict[str, Dict[str, Any]] = {}

    def _m(name: str) -> Dict[str, Any]:
        key = _norm(name)
        if key not in cache:
            cache[key] = match_one(name, residents)
        return cache[key]

    unmatched: List[str] = []
    for e in report.get("entries") or []:
        if not isinstance(e, dict):
            continue
        raw = e.get("resident") or ""
        res = _m(raw)
        e["resident_id"] = res["resident_id"]
        e["resident_matched"] = res["resident_name"]     # 확정된 정식 이름
        e["match"] = res["match"]
        e["match_score"] = res["score"]
        if res.get("candidates"):
            e["match_candidates"] = res["candidates"]
        if res.get("suggest"):
            e["match_suggest"] = res["suggest"]      # [{id,name,score}] — 한 번 눌러 확정용
        if raw.strip() and res["match"] == "none" and raw not in unmatched:
            unmatched.append(raw)

        # 작성자 → 직원 명단 대조
        if staff:
            w = e.get("writer") or ""
            if w.strip():
                wres = match_one(w, staff)
                e["writer_matched"] = wres["resident_name"]
                e["writer_match"] = wres["match"]

    for a in report.get("alerts") or []:
        if not isinstance(a, dict):
            continue
        res = _m(a.get("resident") or "")
        a["resident_id"] = res["resident_id"]
        a["resident_matched"] = res["resident_name"]
        a["match"] = res["match"]

    for c in report.get("suggested_checklists") or []:
        if not isinstance(c, dict):
            continue
        res = _m(c.get("person_name") or "")
        c["resident_id"] = res["resident_id"]
        if res["resident_name"]:
            c["person_name"] = res["resident_name"]      # 체크리스트는 정식 이름으로 생성

    entries = report.get("entries") or []
    report["matching"] = {
        "staff_matched": sum(1 for e in entries
                             if isinstance(e, dict) and e.get("writer_matched")),
        "total": len(entries),
        "matched": sum(1 for e in entries if isinstance(e, dict) and e.get("resident_id")),
        "ambiguous": sum(1 for e in entries if isinstance(e, dict) and e.get("match") == "ambiguous"),
        "unmatched_names": unmatched,
        "roster_size": len(residents),
    }
    return report
