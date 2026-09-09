"""초안 한 편에 넣을 소재 모으기 — 지난 회차 이후 있었던 일 전부에서.

■ 하루치가 아니라 '지난 회차 이후'

  주 2회로 쓰면 한 편이 사나흘을 담는다. 그 사이에 프로그램 사진도 쌓이고
  보호자 앨범에도 사진이 올라온다. 하루만 골라 쓰면 나머지 날은 영영 글에
  못 나오고, 그날 기록이 부실하면 글도 부실해진다.

  그래서 지난 초안이 다룬 마지막 날 다음날부터 오늘까지를 창으로 잡고,
  그 안의 프로그램 사진과 앨범 사진을 함께 모은다.

■ 그렇다고 다 밀어넣지는 않는다

  사나흘치를 전부 담으면 '이번 주에 이런 것들을 했습니다' 하는 나열이 된다.
  읽는 사람에게 남는 것이 없다. 그래서 활동을 묶어 덩어리로 만들고, 그중
  하나의 흐름을 골라 4~8장으로 구성한다. 나머지는 다음 회차로 넘긴다.

■ 묶는 기준

  같은 프로그램명끼리 먼저 묶고(9/1 맨손체조 + 9/4 맨손체조), 그다음
  같은 주제끼리 묶는다(맨손체조 + 좌식축구 = 신체활동). 여러 날에 걸친
  같은 흐름이 한 편이 되면 '이번 주 신체활동' 같은 글이 자연스럽게 나온다.

■ 고르기 전에 거르는 것

  · 공개 사용이 확인되지 않은 사진        (동의를 가정하지 않는다)
  · 얼굴 가림이 끝나지 않았거나 실패한 것
  · 사람이 눈으로 확인하지 않은 것
  · 사생활 우려로 표시된 것 (식사·목욕·처치 등)
  · 지난 글에 이미 쓴 사진 (원본 해시 기준)
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))

# 프로그램 그룹명 → 글의 주제. blog_dedup 의 주제 목록과 같은 말을 쓴다.
TOPIC_OF_GROUP = {
    "신체": "신체활동", "인지": "인지활동", "여가": "미술·만들기", "맞춤형": "인지활동",
}
# 프로그램명에 이 말이 들어가면 주제를 그쪽으로 본다 (그룹보다 우선)
TOPIC_OF_TITLE = [
    (("음악", "노래", "악기", "합창"), "음악"),
    (("미술", "공예", "만들기", "그리기", "한지", "색칠"), "미술·만들기"),
    (("체조", "축구", "배구", "걷기", "운동", "스트레칭", "볼링"), "신체활동"),
    (("생신", "잔치", "명절", "소풍", "행사", "나들이"), "계절행사"),
    (("인지", "기억", "퍼즐", "놀이"), "인지활동"),
]

# 자동 후보에서 빼는 장면 — 사생활 침해 우려가 큰 것들
SENSITIVE_WORDS = ("식사", "급식", "간식", "목욕", "샤워", "기저귀", "처치", "투약",
                   "진료", "채혈", "주사", "화장실", "배변", "체위")

MIN_PHOTOS = 4
MAX_PHOTOS = 8
MAX_PHOTOS_SPECIAL = 10     # 자료가 넉넉한 행사·특집


def today_kst() -> date:
    return datetime.now(KST).date()


def topic_of(title: Optional[str], group: Optional[str]) -> Optional[str]:
    t = (title or "")
    for words, topic in TOPIC_OF_TITLE:
        if any(w in t for w in words):
            return topic
    g = (group or "")
    for key, topic in TOPIC_OF_GROUP.items():
        if g.startswith(key):
            return topic
    return None


def looks_sensitive(title: Optional[str], caption: Optional[str] = None) -> bool:
    blob = f"{title or ''} {caption or ''}"
    return any(w in blob for w in SENSITIVE_WORDS)


def window_for(last_covered: Optional[str], today: Optional[date] = None,
               max_days: int = 14) -> Tuple[str, str]:
    """이번 회차가 다룰 기간.

    지난 초안이 다룬 마지막 날 다음날부터 오늘까지. 지난 초안이 없으면
    최근 max_days 일. 너무 길게 잡으면 오래된 사진이 '이번 소식'으로
    나가므로 상한을 둔다.
    """
    end = today or today_kst()
    if last_covered:
        try:
            start = datetime.strptime(last_covered, "%Y-%m-%d").date() + timedelta(days=1)
        except ValueError:
            start = end - timedelta(days=max_days)
    else:
        start = end - timedelta(days=max_days)
    floor = end - timedelta(days=max_days)
    if start < floor:
        start = floor
    if start > end:
        start = end
    return start.isoformat(), end.isoformat()


class Candidate:
    """사진 한 장 + 그 사진이 붙은 활동."""

    __slots__ = ("photo_id", "source", "date", "title", "group", "time",
                 "topic", "sha256", "sensitive", "note")

    def __init__(self, photo_id: str, source: str, date_: str, title: Optional[str],
                 group: Optional[str], time_: Optional[str], sha256: Optional[str],
                 sensitive: bool, note: Optional[str] = None):
        self.photo_id = photo_id
        self.source = source
        self.date = date_
        self.title = title
        self.group = group
        self.time = time_
        self.topic = topic_of(title, group)
        self.sha256 = sha256
        self.sensitive = sensitive
        self.note = note

    def as_dict(self) -> dict:
        return {"id": self.photo_id, "source": self.source, "taken_on": self.date,
                "program_title": self.title, "group": self.group, "time": self.time,
                "topic": self.topic}


def cluster(cands: Sequence[Candidate]) -> List[Dict[str, Any]]:
    """활동 덩어리로 묶는다 — 같은 프로그램명 먼저, 그다음 같은 주제.

    한 덩어리가 곧 한 편의 후보다. 사진이 많은 덩어리부터 앞에 둔다.
    """
    by_title: Dict[str, List[Candidate]] = defaultdict(list)
    for c in cands:
        key = (c.title or "").strip() or f"(제목없음·{c.date})"
        by_title[key].append(c)

    groups: List[Dict[str, Any]] = []
    for title, items in by_title.items():
        items = sorted(items, key=lambda x: (x.date, x.photo_id))
        groups.append({
            "kind": "program", "title": title,
            "topic": next((i.topic for i in items if i.topic), None),
            "dates": sorted({i.date for i in items}),
            "items": items,
        })

    # 같은 주제인데 사진이 적은 덩어리들은 하나로 합친다.
    # 세 장짜리 글 두 편보다 여섯 장짜리 한 편이 읽을 만하다.
    merged: List[Dict[str, Any]] = []
    small_by_topic: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for g in groups:
        if len(g["items"]) >= MIN_PHOTOS or not g["topic"]:
            merged.append(g)
        else:
            small_by_topic[g["topic"]].append(g)
    for topic, gs in small_by_topic.items():
        if len(gs) == 1:
            merged.append(gs[0])
            continue
        items = [i for g in gs for i in g["items"]]
        merged.append({
            "kind": "topic", "title": " · ".join(g["title"] for g in gs),
            "topic": topic,
            "dates": sorted({i.date for i in items}),
            "items": sorted(items, key=lambda x: (x.date, x.photo_id)),
        })

    merged.sort(key=lambda g: (-len(g["items"]), g["dates"][0] if g["dates"] else ""))
    return merged


def pick(groups: Sequence[Dict[str, Any]], *, recent_topics: Sequence[str] = (),
         special: bool = False) -> Optional[Dict[str, Any]]:
    """이번에 쓸 덩어리 하나를 고른다.

    최근 글이 몰린 주제는 뒤로 미룬다 — 그래야 소재가 골고루 돈다.
    사진이 MIN_PHOTOS 에 못 미치는 덩어리밖에 없으면 고르지 않는다.
    억지로 쓰면 '자료가 부족한데 지어낸 글'이 된다.
    """
    cap = MAX_PHOTOS_SPECIAL if special else MAX_PHOTOS
    recent = list(recent_topics)

    def penalty(g: Dict[str, Any]) -> int:
        t = g.get("topic")
        return recent.count(t) if t else 0

    ranked = sorted(groups, key=lambda g: (penalty(g), -len(g["items"])))
    for g in ranked:
        if len(g["items"]) >= MIN_PHOTOS:
            chosen = dict(g)
            chosen["items"] = _spread(g["items"], cap)
            return chosen
    return None


def _spread(items: Sequence[Candidate], cap: int) -> List[Candidate]:
    """비슷한 장면이 몰리지 않게 날짜별로 고르게 나눠 뽑는다.

    같은 순간에 연달아 찍은 사진 여덟 장을 넣으면 흐름이 안 보인다.
    날짜를 돌아가며 한 장씩 집는다.
    """
    if len(items) <= cap:
        return list(items)
    by_date: Dict[str, List[Candidate]] = defaultdict(list)
    for c in items:
        by_date[c.date].append(c)
    dates = sorted(by_date)
    out: List[Candidate] = []
    i = 0
    while len(out) < cap:
        added = False
        for d in dates:
            if i < len(by_date[d]):
                out.append(by_date[d][i])
                added = True
                if len(out) >= cap:
                    break
        if not added:
            break
        i += 1
    return out


def summarize(group: Dict[str, Any]) -> Dict[str, Any]:
    """모델에 넘길 활동 기록으로 정리한다. 기록에 있는 것만 담는다."""
    acts: List[Dict[str, Any]] = []
    seen = set()
    for c in group["items"]:
        key = (c.date, c.title)
        if key in seen:
            continue
        seen.add(key)
        acts.append({"date": c.date, "title": c.title, "group": c.group,
                     "time": c.time,
                     "note": c.note or "(기록에 활동 설명 없음)"})
    return {"activities": sorted(acts, key=lambda a: (a["date"], a.get("time") or ""))}
