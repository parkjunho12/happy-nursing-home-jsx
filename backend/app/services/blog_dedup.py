"""중복 검사 — 네 가지를 따로 본다.

  ① 활동 중복  같은 회차·같은 활동 기록으로 이미 썼는가 (발행 글 + 대기 초안)
  ② 주제 중복  최근 글이 한쪽으로 쏠렸는가
  ③ 문장 중복  제목만 바꾸고 도입·전개·마무리를 되풀이했는가
  ④ 사진 중복  같은 사진을 다시 썼는가 (원본 해시 기준)

■ 왜 원본 해시로 보는가

  스마일 위치를 옮기거나 크기를 바꾸면 가린 파일의 해시는 달라진다. 그걸
  기준으로 삼으면 같은 사진이 새 사진으로 통과한다. 그래서 파생본이 아니라
  '어느 원본에서 나왔는가' 로 본다.

■ 공통 안내 문구는 빼고 센다

  주소·전화·상담 안내는 모든 글에 똑같이 들어간다. 그대로 두고 비교하면
  모든 글이 서로 중복으로 나온다. 그래서 승인된 공통 문구는 지운 뒤 센다.

■ 얼굴로 사람을 식별하지 않는다

  사진 중복은 파일이 같은가만 본다. 누가 찍혔는지는 보지 않는다.

■ 숫자 하나로 단정하지 않는다

  유사도는 '검토가 필요한가'를 가리는 데만 쓴다. 통과·검토필요·이력불완전
  셋으로 답하고, 무엇이 겹치는지 사람이 읽을 수 있게 함께 돌려준다.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Sequence

# 판정
DUP_PASS = "pass"              # 중복 검사 통과
DUP_REVIEW = "review"          # 중복 검토 필요
DUP_INCOMPLETE = "incomplete"  # 기존 이력 확인 불완전

# 이 값을 넘으면 사람이 봐야 한다. 넘었다고 곧바로 막지는 않는다.
SENT_SIM = 0.82        # 문장 하나끼리
DOC_SIM = 0.55         # 글 전체


def strip_boilerplate(text: str, boilerplate: Sequence[str]) -> str:
    """공통 안내 문구를 지운다. 이것 때문에 전 글이 중복으로 나오면 안 된다."""
    out = text or ""
    for b in boilerplate:
        b = (b or "").strip()
        if len(b) >= 6:
            out = out.replace(b, " ")
    # 주소·전화는 표기가 조금씩 달라 정규식으로도 한 번 훑는다
    out = re.sub(r"0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}", " ", out)
    out = re.sub(r"경기도\s*양주시[^\n]{0,40}", " ", out)
    return out


def _sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?…])\s+|\n+", text or "")
    return [re.sub(r"\s+", " ", p).strip() for p in parts if len(re.sub(r"\s+", "", p)) >= 12]


def _norm(s: str) -> str:
    """비교용으로 다듬기 — 이모지·문장부호·공백 차이로 다른 문장이 되지 않게."""
    s = re.sub(r"[^\w가-힣 ]+", " ", s or "")
    return re.sub(r"\s+", " ", s).strip()


def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def sentence_overlap(new_body: str, old_body: str, boilerplate: Sequence[str]) -> List[Dict[str, Any]]:
    """겹치는 대목을 찾아 그대로 돌려준다 — 점수만 주면 무엇을 고칠지 모른다."""
    a = _sentences(strip_boilerplate(new_body, boilerplate))
    b = _sentences(strip_boilerplate(old_body, boilerplate))
    hits: List[Dict[str, Any]] = []
    for s in a:
        best, bs = 0.0, ""
        for t in b:
            r = _sim(s, t)
            if r > best:
                best, bs = r, t
        if best >= SENT_SIM:
            hits.append({"new": s[:120], "old": bs[:120], "score": round(best, 3)})
    return hits


def doc_similarity(new_body: str, old_body: str, boilerplate: Sequence[str]) -> float:
    return _sim(strip_boilerplate(new_body, boilerplate)[:4000],
                strip_boilerplate(old_body, boilerplate)[:4000])


def check(*, new_body: str, new_topic: Optional[str], new_activity_dates: Sequence[str],
          new_photo_hashes: Sequence[str], histories: Sequence[Dict[str, Any]],
          pending_drafts: Sequence[Dict[str, Any]], boilerplate: Sequence[str],
          history_complete: bool) -> Dict[str, Any]:
    """네 축을 한 번에 보고 판정과 근거를 돌려준다.

    histories 는 발행된 글, pending_drafts 는 아직 검토 중인 초안이다.
    둘 다 봐야 한다 — 대기 중인 초안과 같은 소재로 또 쓰면 두 편이 겹친다.
    """
    report: Dict[str, Any] = {
        "compared_histories": len(histories),
        "compared_drafts": len(pending_drafts),
        "history_complete": history_complete,
        "similar": [], "activity_conflicts": [], "photo_reuse": [],
        "topic_recent": [], "reasons": [],
    }

    pool = list(histories) + list(pending_drafts)

    # ③ 문장·구성
    for h in pool:
        body = h.get("body") or ""
        if not body:
            continue
        d = doc_similarity(new_body, body, boilerplate)
        hits = sentence_overlap(new_body, body, boilerplate)
        if d >= DOC_SIM or hits:
            report["similar"].append({
                "title": h.get("title"), "url": h.get("url"),
                "published_on": h.get("published_on"),
                "doc_score": round(d, 3), "sentences": hits[:5],
                "kind": h.get("kind", "history"),
            })
    report["similar"].sort(key=lambda x: -x["doc_score"])
    report["similar"] = report["similar"][:3]

    # ① 활동 회차
    dates = {d for d in new_activity_dates if d}
    for h in pool:
        ha = h.get("activity_on")
        if ha and ha in dates and (h.get("topic") or "") == (new_topic or ""):
            report["activity_conflicts"].append({
                "title": h.get("title"), "url": h.get("url"), "activity_on": ha,
            })

    # ④ 사진 재사용 — 원본 해시로만 본다
    used_before = set()
    for h in pool:
        for ref in (h.get("photo_refs") or []):
            s = (ref or {}).get("sha256") if isinstance(ref, dict) else None
            if s:
                used_before.add(s)
    for s in new_photo_hashes:
        if s and s in used_before:
            report["photo_reuse"].append(s[:12])

    # ② 주제 쏠림 — 최근 발행 글 6편에서 같은 주제가 절반을 넘으면 알린다
    recent = [h.get("topic") for h in list(histories)[:6] if h.get("topic")]
    report["topic_recent"] = recent
    same = sum(1 for t in recent if t == new_topic)
    topic_heavy = bool(new_topic) and len(recent) >= 4 and same > len(recent) / 2

    # 판정
    if report["similar"] and report["similar"][0]["doc_score"] >= DOC_SIM:
        report["reasons"].append(f"기존 글과 전체 흐름이 비슷합니다({report['similar'][0]['doc_score']}).")
    if any(s["sentences"] for s in report["similar"]):
        report["reasons"].append("같거나 거의 같은 문장이 있습니다.")
    if report["activity_conflicts"]:
        report["reasons"].append("같은 날짜·같은 주제의 활동으로 이미 쓴 글이 있습니다.")
    if report["photo_reuse"]:
        report["reasons"].append(f"이전 글에 쓴 사진 {len(report['photo_reuse'])}장이 다시 들어갔습니다.")
    if topic_heavy:
        report["reasons"].append("최근 글이 같은 주제로 몰려 있습니다.")

    if not history_complete:
        # 못 가져온 글이 있으면 '통과' 라고 말하지 않는다.
        status = DUP_INCOMPLETE
        report["reasons"].insert(0, "확보하지 못한 기존 글이 있어 검사 범위가 완전하지 않습니다.")
    elif report["reasons"]:
        status = DUP_REVIEW
    else:
        status = DUP_PASS
    report["status"] = status
    return report
