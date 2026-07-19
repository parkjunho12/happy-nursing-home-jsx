"""
인수인계 기록지(수기) 사진 → AI 판독 리포트

- 1순위: OpenAI 비전(손글씨 OCR), 실패 시 2순위: Claude 비전
- 출력: 항목별 구조화 + 요약 + 긴급 알림 + 후속 체크리스트 제안
- 모든 호출은 동기 SDK + 지연 import (패키지 없어도 부팅 안 깨짐)
"""
from __future__ import annotations
import base64
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))

VALID_FREQ = {"one_time", "daily", "weekly", "monthly", "quarterly", "half-yearly", "yearly"}
URGENCY = {"high", "medium", "low"}

SYSTEM_PROMPT = """당신은 한국 요양원의 야간 인수인계 기록지를 판독하는 간호 기록 전문가입니다.
사진은 손으로 쓴 '어르신 인수인계' 표이며 열은 보통 [월일, 시간, 어르신, 내용, 작성자] 입니다.

규칙:
1) 글자가 불확실하면 '가장 비슷해 보이는 글자'를 적고 confidence='low' 로 표시합니다.
   빈칸으로 비우거나 말이 되게 고쳐 쓰지 마세요.
   특히 이름은 '보이는 그대로' 적습니다. 그럴듯한 이름으로 바꾸지 마세요(교정은 이후 단계에서 합니다).
2) '어르신' 열 규칙:
   어르신 이름이 나오면, 그 다음 어르신 이름이 나오기 전까지의 모든 내용은
   그 어르신의 기록입니다. (이름이 매 줄 반복해서 적히지 않습니다)
3) 긴급도(urgency) 판단:
   - high  : 낙상, 119, 응급, 병원 이송·입원, 발열, 출혈, 의식저하, 투약 사고, 무단외출
   - medium: 통증 호소, 수면 장애·불면, 식사/수분 거부, 구토, 설사, 피부 발적·욕창 초기,
             배회·섬망 행동, 장루·도뇨 문제, 낙상 위험 행동(혼자 일어나려 함 등)
   - low   : 일상 케어 기록(기저귀 교체, 체위변경, 이동 지원, 특이사항 없음)
   판단이 애매하면 낮추지 말고 medium 으로 올립니다.
4) 활력징후(혈압/체온/맥박)는 vitals 에 원문 그대로 넣습니다.
5) 존재하지 않는 내용을 지어내지 않습니다. 판독 불가한 칸은 빈 문자열로 둡니다.
6) 반드시 JSON 만 출력합니다. 설명 문장을 덧붙이지 않습니다.
   alerts 와 key_points 는 역할이 다릅니다. 같은 내용을 양쪽에 쓰지 마세요.
   - alerts     : 위험 상황(urgency=high 중심) + 지금 해야 할 조치
   - key_points : alerts 에 담기지 않은 나머지 인계사항
7) 후속 조치(suggested_checklists)는 모두 '한 번 하고 끝나는 일회성 업무'로 제안합니다.
   반복 주기를 만들지 말고, 대신 '언제까지 해야 하는지'를 반드시 판단해 넣습니다.
   며칠간 관찰이 필요하면 '○일까지 경과 관찰 후 기록' 처럼 마감일이 있는 한 건으로 제안합니다.
   - due_days = 오늘로부터 며칠 안에 해야 하는지(정수). 0=오늘 중, 1=내일까지.
     · 응급 이송·낙상 직후 상태확인·보호자 연락 → 0
     · 통증/부종/발열 경과관찰, 병원 결과 확인 → 1~2
     · 욕창·피부 재확인, 식이 조정 확인 → 2~3
     · 물품 신청, 기록 보완 같은 행정 → 3~7
   - due_label = due_days 를 사람이 읽는 표현('오늘 중', '내일까지', '3일 내')으로 씁니다.

출력 JSON 스키마:
{
  "entries": [
    {"date":"", "time":"", "resident":"", "content":"", "writer":"",
     "vitals":"", "category":"낙상|응급|투약|활력징후|배설|식사|수면|행동|기타",
     "urgency":"high|medium|low", "confidence":"high|medium|low"}
  ],
  "summary": "인계받는 사람이 30초 안에 파악하도록 짧은 문장 3~4개. 긴급/이송/낙상 같은 중대 사항을 맨 앞 문장에. 어려운 한자어 대신 쉬운 말로. 각 문장은 40자 이내.",
  "key_points": ["alerts 에 없는 그 밖의 인계사항만 2~4개. alerts 내용을 반복하지 마세요. '어르신 이름 - 무엇을 확인/조치' 형태 15~30자"],
  "alerts": [{"resident":"", "issue":"위험 상황 자체", "action":"권장 후속 조치"}],
  "suggested_checklists": [
    {"title":"", "person_name":"", "reason":"", "due_days": 0, "due_label":"오늘 중"}
  ],
  "unreadable_notes": "판독이 어려웠던 부분 최대 3개, 각 40자 이내로 간단히. 없으면 빈 문자열"
}"""

# ── 이 양식 전용 판독 가이드 (in-context learning) ─────────────────
# 파인튜닝용 라벨 데이터가 쌓이기 전까지, 폼 구조·표기 관습·읽는 순서를
# 예시와 함께 주어 판독 정확도를 끌어올린다. 이름은 예시에서도 ○○○ 로 두어
# 특정 인물로 유도(bias)되지 않게 한다.
FORM_GUIDE = """
[이 기록지의 구조]
제목이 '어르신 인수인계' 인 5열 표입니다.
  월일 | 시간 | 어르신 | 내용 | 작성자

가장 중요 — '어르신' 열을 읽는 법:
이 표는 어르신 이름을 매 줄 반복해서 쓰지 않습니다.
어르신 이름이 한 번 나오면, 그 다음 어르신 이름이 나오기 전까지의 모든 줄은
그 어르신의 기록입니다.

- 어르신 칸에 이름이 있는 줄  → 여기서부터 그 어르신 구간이 시작됩니다.
- 어르신 칸이 비어 있는 줄    → 위에서 시작된 어르신의 기록이 이어지는 것입니다.
                               resident 는 비워 둬도 됩니다(뒤에서 자동으로 채웁니다).
- 다음 이름이 나오면          → 거기서부터 다른 어르신 구간입니다.

행을 나누는 기준:
- 시간이 새로 적힌 줄 → 별도 항목(같은 어르신의 다른 사건)
- 시간이 없고 문장이 이어지는 줄 → 위 항목에 이어붙임

[손글씨 표기 관습]
- 시간: 22:30, 23:51 / '23:10분경' 처럼 '경'이 붙기도 함
- 활력징후: '산포 100/86', '체온 36.2', 'BT 36.5' (산포=산소포화도, BT=체온)
- 자주 쓰는 말: 라운딩, 낙상, 기저귀 케어, 체위변경, 도포, 세라덤, 발적,
  욕창, 대변/소변, 유치도뇨, 경관식, 119, 응급, 이송, 입원, 프로그램실,
  휴게실, 침상, 휠체어, 배회, 섬망, 보호자
- 화살표(→)·물결(~)로 경과나 이동을 표시하기도 합니다.

[야간 근무는 자정을 넘습니다 — 매우 중요]
- 야간 인수인계는 보통 저녁(21~22시)에 시작해 다음 날 아침(07~09시)에 끝납니다.
- 따라서 실제 시간 순서는 22:30 → 23:51 → 00:45 → 07:19 입니다.
  07:19 는 '다음 날 아침'이므로 맨 뒤입니다. 숫자가 작다고 앞으로 보내지 마세요.
- 표에 적힌 행 순서가 곧 실제 발생 순서입니다. 순서를 임의로 바꾸지 마세요.
- 자정을 넘긴 기록(00:xx~09:xx)은 date 를 다음 날로 적거나, 모르면 비워 둡니다.

[읽는 순서]
1. 표의 행을 위에서 아래로 하나씩 봅니다(건너뛰지 않습니다).
2. 각 행에서 왼쪽부터 월일 → 시간 → 어르신 → 내용 → 작성자 순으로 읽습니다.
3. 빈 칸은 위 행에서 이어받되, 없는 내용을 지어내지 않습니다.
4. 글자가 겹치거나 흐려 확신이 없으면 confidence='low' 로 표시합니다.

[칸 → 필드 대응 예시]  ※ 이름은 placeholder 이며 실제 판독과 무관합니다
행: "1 | 22:30 | ○○○ | 20:30분경부터 앓는소리 하셨음 |"
→ date="1", time="22:30", resident="○○○",
   content="20:30분경부터 앓는소리 하셨음", writer="", vitals=""

행: "1 | : |  | 산포 100/86  체온 36.2 | 최○○"      ← 시간 없음 + 어르신 빈칸
→ 위 항목에 이어붙입니다. content 뒤에 추가, vitals="100/86, 36.2", writer="최○○"
   (산포=산소포화도)

행: "1 | 23:10 |  | 119 응급 병원 가심 | 최○○"        ← 시간은 있고 어르신만 빈칸
→ 별도 항목이지만 resident 는 상속: resident="○○○" (직전에 적힌 이름)
   time="23:10", content="119 응급 병원 가심"

행: "1 | 23:51 | □□□ | 침상에서 낙상하심 | 최○○"      ← 새 이름 등장
→ 여기서부터 다른 어르신. 이후 빈칸은 □□□ 를 상속합니다.
"""


USER_PROMPT = """다음은 요양원 인수인계 기록지 사진입니다(여러 장일 수 있음).
""" + FORM_GUIDE + """
위 구조와 순서에 따라 모두 판독해 하나의 리포트로 합쳐 주세요.
기록지에 적힌 행 순서를 그대로 유지합니다(시간 숫자로 다시 정렬하지 마세요).
후속 체크리스트는 실제로 조치가 필요한 항목만 최대 6개 제안하세요."""


def _safe_parse_json(raw: str) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    a, b = s.find("{"), s.rfind("}")
    if a != -1 and b != -1:
        try:
            return json.loads(s[a:b + 1])
        except Exception:
            pass
    return None


def _normalize(d: Dict[str, Any]) -> Dict[str, Any]:
    """모델 출력 정규화 — 프론트가 항상 같은 모양을 받도록."""
    out: Dict[str, Any] = {
        "entries": [], "summary": "", "key_points": [], "alerts": [],
        "suggested_checklists": [], "unreadable_notes": "",
    }
    if not isinstance(d, dict):
        return out

    for e in (d.get("entries") or []):
        if not isinstance(e, dict):
            continue
        u = str(e.get("urgency") or "low").lower()
        out["entries"].append({
            "date": str(e.get("date") or ""),
            "time": str(e.get("time") or ""),
            "resident": str(e.get("resident") or ""),
            "content": str(e.get("content") or ""),
            "writer": str(e.get("writer") or ""),
            "vitals": str(e.get("vitals") or ""),
            "category": str(e.get("category") or "기타"),
            "urgency": u if u in URGENCY else "low",
            "confidence": str(e.get("confidence") or "medium"),
        })

    out["summary"] = str(d.get("summary") or "")
    out["key_points"] = [str(x).strip() for x in (d.get("key_points") or [])
                         if x is not None and str(x).strip() and str(x).strip().lower() != "none"]
    out["unreadable_notes"] = str(d.get("unreadable_notes") or "")

    for a in (d.get("alerts") or []):
        if isinstance(a, dict):
            out["alerts"].append({
                "resident": str(a.get("resident") or ""),
                "issue": str(a.get("issue") or ""),
                "action": str(a.get("action") or ""),
            })

    today = datetime.now(KST).date()
    for c in (d.get("suggested_checklists") or []):
        if not isinstance(c, dict):
            continue
        # 후속 조치는 항상 일회성(one_time) — 기한(due_date)으로 관리
        try:
            dd = int(c.get("due_days"))
        except Exception:
            dd = 1
        dd = max(0, min(dd, 90))
        due_date = (today + timedelta(days=dd)).isoformat()
        label = str(c.get("due_label") or "").strip() or (
            "오늘 중" if dd == 0 else "내일까지" if dd == 1 else f"{dd}일 내")
        out["suggested_checklists"].append({
            "title": str(c.get("title") or "").strip(),
            "frequency": "one_time",
            "person_name": str(c.get("person_name") or ""),
            "reason": str(c.get("reason") or ""),
            "due_days": dd,
            "due_date": due_date,      # one_time 기한 (YYYY-MM-DD)
            "due_label": label,
        })
    out["suggested_checklists"] = [c for c in out["suggested_checklists"] if c["title"]]
    return out


def _claude_read(images: List[bytes], media_types: List[str]) -> Optional[Dict[str, Any]]:
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180)
        content: List[Dict[str, Any]] = []
        for b, mt in zip(images, media_types):
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": mt,
                           "data": base64.b64encode(b).decode()},
            })
        content.append({"type": "text", "text": USER_PROMPT})
        msg = client.messages.create(
            model=settings.CLAUDE_MODEL, max_tokens=4000, temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
        return _safe_parse_json(msg.content[0].text)
    except Exception as e:
        logger.warning(f"[handover] Claude 판독 실패: {e}")
        return None


TRANSCRIBE_SYSTEM = """당신은 한국 요양원의 손글씨 인수인계 기록지를 '전사'하는 전문가입니다.
해석·요약·추론을 하지 말고, 표에 적힌 것을 그대로 옮겨 적는 일만 합니다.
반드시 JSON 만 출력합니다.

출력 스키마:
{"rows":[{"date":"","time":"","resident":"","content":"","writer":"","vitals":"","confidence":"high|medium|low"}]}

원칙:
- 이름은 보이는 그대로 적습니다. 그럴듯한 이름으로 바꾸지 않습니다.
- 판독이 불확실하면 confidence='low' 로 표시합니다.
- '어르신' 열: 이름이 적힌 줄은 그대로 적고, 비어 있는 줄은 비워 둡니다.
  (이름이 나오면 다음 이름 전까지 같은 어르신이라는 건 뒤에서 처리합니다)
- 빈 칸을 임의로 채우거나 지어내지 마세요."""

PASS_A = """표를 위에서 아래로 한 행씩 순서대로, 보이는 그대로 전사하세요.
어르신 칸이 비어 있는 줄은 resident 를 비워 두면 됩니다(임의로 채우지 마세요)."""

def _gpt_transcribe(images, media_types, instruction: str) -> Optional[List[Dict[str, Any]]]:
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=180)
        parts: List[Dict[str, Any]] = [{"type": "text", "text": FORM_GUIDE + "\n" + instruction}]
        for b, mt in zip(images, media_types):
            parts.append({"type": "image_url",
                          "image_url": {"url": f"data:{mt};base64,{base64.b64encode(b).decode()}",
                                        "detail": "high"}})
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL, temperature=0, max_tokens=4000,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": TRANSCRIBE_SYSTEM},
                      {"role": "user", "content": parts}],
        )
        d = _safe_parse_json(resp.choices[0].message.content or "")
        rows = (d or {}).get("rows")
        return rows if isinstance(rows, list) else None
    except Exception as e:
        logger.warning(f"[handover] GPT 전사 실패: {e}")
        return None


# Claude 는 전사를 '다시 출력'하지 않는다.
# 고칠 행만 corrections 로 짚고, 요약·판단만 생성한다 → 출력 토큰 급감 + 잘림 방지.
CLAUDE_FINAL_SYSTEM = """당신은 한국 요양원 야간 인수인계 기록지의 최종 검토자입니다.
1차 전사 결과와 원본 사진을 함께 받아, 잘못 읽힌 곳을 짚고 최종 리포트를 만듭니다.

반드시 지킬 것:
- 전사 전체를 다시 쓰지 마세요. 고쳐야 할 행만 corrections 에 담습니다.
- 이름·시간·수치(혈압/체온)는 사진에서 다시 확인합니다.
- 전사에 없는 내용을 지어내지 마세요.
- 이름은 보이는 그대로 씁니다(교정은 이후 단계에서 합니다).
- resident 가 비어 있는 행이 있습니다. 이는 '위 어르신의 기록이 이어지는 줄'이며 정상입니다.
  빈 칸을 채우려 하지 마세요. 이름이 적힌 행의 오독만 corrections 로 고치면 됩니다.
- 반드시 JSON 만 출력합니다.

긴급도(urgency) 기준:
- high  : 낙상, 119, 응급, 병원 이송·입원, 발열, 출혈, 의식저하, 투약 사고, 무단외출
- medium: 통증 호소, 불면, 식사/수분 거부, 구토, 설사, 피부 발적, 배회·섬망,
          장루·도뇨 문제, 낙상 위험 행동
- low   : 일상 케어(기저귀 교체, 체위변경, 이동 지원)
애매하면 낮추지 말고 medium 으로 올립니다.

야간 근무는 자정을 넘습니다(22:00 → 23:51 → 00:45 → 07:19).
숫자가 작다고 아침 기록을 앞으로 보내지 마세요.

출력 JSON 스키마:
{
  "corrections": [
    {"index": 0, "resident":"", "time":"", "content":"", "vitals":"",
     "urgency":"high|medium|low", "category":"낙상|응급|투약|활력징후|배설|식사|수면|행동|기타",
     "confidence":"high|medium|low"}
  ],
  "urgency_by_index": {"0":"high", "3":"medium"},
  "summary": "인계받는 사람이 30초 안에 파악하도록 짧은 문장 3~4개. 중대 사항을 맨 앞에. 각 40자 이내.",
  "key_points": ["alerts 에 없는 나머지 인계사항만 2~4개. 중복 금지. 15~30자"],
  "alerts": [{"resident":"", "issue":"위험 상황", "action":"권장 후속 조치"}],
  "suggested_checklists": [
    {"title":"", "person_name":"", "reason":"", "due_days":0, "due_label":"오늘 중"}
  ],
  "unreadable_notes": "판독이 어려웠던 부분 최대 3개, 각 40자 이내. 없으면 빈 문자열"
}

corrections 에는 '실제로 고칠 행'만 넣습니다(맞게 읽힌 행은 넣지 마세요).
urgency_by_index 에는 모든 행의 긴급도를 index 기준으로 넣습니다."""


def _claude_finalize(images, media_types, rows: List[Dict]):
    """전사 검증 + 요약 생성. 반환: (리포트 dict | None, 에러 문자열)"""
    if not settings.ANTHROPIC_API_KEY:
        return None, "ANTHROPIC_API_KEY 미설정"
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180)
        content: List[Dict[str, Any]] = []
        for b, mt in zip(images, media_types):
            content.append({"type": "image",
                            "source": {"type": "base64", "media_type": mt,
                                       "data": base64.b64encode(b).decode()}})
        # 전사는 index 를 붙여 전달 → corrections 가 어느 행인지 지목 가능
        indexed = [{"index": i, **{k: v for k, v in r.items() if k in
                                   ("date", "time", "resident", "content", "writer", "vitals")}}
                   for i, r in enumerate(rows)]
        content.append({"type": "text", "text":
            "아래는 이 기록지의 1차 전사 결과입니다(index 포함). 사진과 대조해 검증하세요.\n"
            + json.dumps({"rows": indexed}, ensure_ascii=False)
            + "\n\n지정된 JSON 스키마로 출력하세요."})

        msg = client.messages.create(
            model=settings.CLAUDE_MODEL, max_tokens=8000, temperature=0,
            system=CLAUDE_FINAL_SYSTEM,
            messages=[{"role": "user", "content": content}],
        )
        if getattr(msg, "stop_reason", None) == "max_tokens":
            return None, "Claude 응답이 길이 제한으로 잘렸습니다"
        parsed = _safe_parse_json(msg.content[0].text)
        if not parsed:
            return None, "Claude 응답 JSON 파싱 실패"
        return parsed, ""
    except Exception as e:
        logger.warning(f"[handover] Claude 최종화 실패: {e}")
        return None, f"{type(e).__name__}: {e}"[:200]


def _apply_claude(rows: List[Dict], res: Dict[str, Any]) -> Dict[str, Any]:
    """GPT 전사 + Claude 교정/판단을 합쳐 최종 리포트를 만든다."""
    merged = [dict(r) for r in rows]

    for c in (res.get("corrections") or []):
        if not isinstance(c, dict):
            continue
        try:
            i = int(c.get("index", -1))
        except Exception:
            continue
        if not (0 <= i < len(merged)):
            continue
        for k in ("resident", "time", "content", "vitals", "urgency", "category", "confidence"):
            if c.get(k):
                merged[i][k] = c[k]

    ub = res.get("urgency_by_index") or {}
    if isinstance(ub, dict):
        for k, v in ub.items():
            try:
                i = int(k)
            except Exception:
                continue
            if 0 <= i < len(merged) and str(v).lower() in URGENCY:
                merged[i]["urgency"] = str(v).lower()

    merged = _merge_blocks(merged)     # 교정이 끝난 뒤 어르신 구간별로 합친다
    rep = _rows_to_report(merged)
    for k in ("summary", "key_points", "alerts", "suggested_checklists", "unreadable_notes"):
        if k in res:
            rep[k] = res[k]
    return rep


_URG_RANK = {"low": 0, "medium": 1, "high": 2}
_CONF_RANK = {"low": 0, "medium": 1, "high": 2}


def _merge_blocks(rows: List[Dict]) -> List[Dict]:
    """어르신 이름이 나오면 새 항목, 이름이 없는 줄은 위 항목에 줄바꿈으로 이어붙인다.

    표에서 이름은 구간 시작 줄에만 적히므로,
    '이름이 나온 줄 ~ 다음 이름이 나오기 전'까지가 한 어르신의 기록이다.
    이름 교정(Claude)이 끝난 뒤 마지막에 수행한다.
    """
    out: List[Dict] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        name = (r.get("resident") or "").strip()
        if name or not out:
            cur = dict(r)
            cur["resident"] = name
            cur["content"] = (r.get("content") or "").strip()
            cur["vitals"] = (r.get("vitals") or "").strip()
            out.append(cur)
            continue

        cur = out[-1]
        # 내용: 줄바꿈으로 이어붙임
        c = (r.get("content") or "").strip()
        if c:
            cur["content"] = (cur.get("content", "") + "\n" + c).strip()
        # 활력징후: 쉼표로 합침(중복 제외)
        v = (r.get("vitals") or "").strip()
        if v and v not in (cur.get("vitals") or ""):
            cur["vitals"] = (cur["vitals"] + ", " + v).strip(", ") if cur.get("vitals") else v
        # 비어 있던 항목만 채움
        for k in ("time", "date", "writer"):
            if not (cur.get(k) or "").strip() and (r.get(k) or "").strip():
                cur[k] = r[k]
        # 긴급도는 구간에서 가장 높은 값, 신뢰도는 가장 낮은 값(보수적)
        u = str(r.get("urgency") or "").lower()
        if u in _URG_RANK and _URG_RANK[u] > _URG_RANK.get(str(cur.get("urgency") or "low").lower(), 0):
            cur["urgency"] = u
        cf = str(r.get("confidence") or "").lower()
        if cf in _CONF_RANK and _CONF_RANK[cf] < _CONF_RANK.get(str(cur.get("confidence") or "high").lower(), 2):
            cur["confidence"] = cf
        # 구간 안에 카테고리가 명확한 줄이 있으면 채택
        if not (cur.get("category") or "").strip() or cur.get("category") == "기타":
            if (r.get("category") or "").strip():
                cur["category"] = r["category"]
    return out


def _rows_to_report(rows: List[Dict]) -> Dict[str, Any]:
    """Claude 실패 시 폴백 — 전사만으로 최소 리포트 구성."""
    entries = []
    for r in rows or []:
        entries.append({
            "date": r.get("date", ""), "time": r.get("time", ""),
            "resident": r.get("resident", ""), "content": r.get("content", ""),
            "writer": r.get("writer", ""), "vitals": r.get("vitals", ""),
            "category": r.get("category") or "기타",
            "urgency": (r.get("urgency") or "low"),
            "confidence": r.get("confidence", "medium"),
        })
    return {"entries": entries, "summary": "", "key_points": [], "alerts": [],
            "suggested_checklists": [], "unreadable_notes": ""}


def analyze_handover(images: List[bytes], media_types: List[str]) -> Dict[str, Any]:
    """GPT 전사 1회 + Claude 판정·구조화 1회.

    역할 분담
      GPT   : 손글씨 전사(강점)
      Claude: 사진과 전사를 함께 보며 검증 + 요약·긴급도·후속조치 구조화(추론 강점)
    명단은 주입하지 않는다(판독 편향 방지) — 이름 확정은 이후 매칭 단계.
    """
    stats = {"gpt_calls": 0, "claude_calls": 0, "rows": 0, "low_confidence": 0}

    rows = _gpt_transcribe(images, media_types, PASS_A)
    if rows is not None:
        stats["gpt_calls"] = 1
        rows = [r for r in rows if isinstance(r, dict)]
        stats["rows"] = len(rows)

    if not rows:
        # GPT 실패 → Claude 단독 판독 폴백
        parsed = _claude_read(images, media_types)
        stats["claude_calls"] = 1
        if not parsed:
            return {**_normalize({}), "model": None, "pipeline": stats,
                    "error": "AI 판독에 실패했습니다. 사진이 선명한지 확인 후 다시 시도해 주세요."}
        rep = _normalize(parsed)
        rep["model"] = f"claude:{settings.CLAUDE_MODEL} (단독)"
        rep["pipeline"] = stats
        rep["error"] = ""
        return rep

    # Claude 가 사진과 전사를 함께 보고 검증 + 판단 (교차 검증 역할)
    res, cerr = _claude_finalize(images, media_types, rows)
    if res:
        stats["claude_calls"] = 1
        stats["corrections"] = len(res.get("corrections") or [])
        rep = _normalize(_apply_claude(rows, res))
        rep["model"] = f"gpt + claude:{settings.CLAUDE_MODEL}"
    else:
        stats["claude_error"] = cerr          # 조용히 묻히지 않도록 화면까지 전달
        rep = _normalize(_rows_to_report(_merge_blocks(rows)))
        rep["model"] = "gpt (claude 미적용)"

    stats["low_confidence"] = sum(1 for e in rep.get("entries", [])
                                  if (e.get("confidence") or "").lower() == "low")
    rep["pipeline"] = stats
    rep["error"] = ""
    return rep


REGEN_SYSTEM = """당신은 한국 요양원 야간 인수인계 기록의 요약 담당자입니다.
이미 사람이 어르신 이름을 확정한 기록을 받아 요약을 다시 작성합니다.

반드시 지킬 것:
- 어르신 이름은 주어진 이름만 사용합니다. 바꾸거나 새로 만들지 마세요.
- 기록에 없는 사실을 지어내지 마세요.
- 반드시 JSON 만 출력합니다.

긴급도 참고: 낙상·119·응급·이송·발열·출혈·의식저하·투약사고는 위험 상황입니다.
야간 근무는 자정을 넘습니다(22:00 → 23:51 → 07:19 순서).

출력 JSON 스키마:
{
  "summary": "인계받는 사람이 30초 안에 파악하도록 짧은 문장 3~4개. 중대 사항을 맨 앞에. 각 40자 이내.",
  "key_points": ["alerts 에 없는 나머지 인계사항만 2~4개. 중복 금지. 15~30자"],
  "alerts": [{"resident":"", "issue":"위험 상황", "action":"권장 후속 조치"}],
  "suggested_checklists": [
    {"title":"", "person_name":"", "reason":"", "due_days":0, "due_label":"오늘 중"}
  ]
}
후속 조치는 실제로 조치가 필요한 것만 최대 6개. 모두 일회성이며 due_days 로 기한을 정합니다."""


def regenerate_summary(entries: List[Dict[str, Any]]):
    """확정된 이름 기준으로 요약·주의·후속조치를 다시 생성. 반환: (dict|None, 에러)"""
    if not settings.ANTHROPIC_API_KEY:
        return None, "ANTHROPIC_API_KEY 미설정"
    if not entries:
        return None, "판독된 내용이 없습니다"
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120)
        clean = [{
            "time": e.get("time", ""),
            "resident": (e.get("resident_matched") or e.get("resident") or "").strip(),
            "content": e.get("content", ""),
            "vitals": e.get("vitals", ""),
            "urgency": e.get("urgency", "low"),
        } for e in entries]
        msg = client.messages.create(
            model=settings.CLAUDE_MODEL, max_tokens=3000, temperature=0,
            system=REGEN_SYSTEM,
            messages=[{"role": "user", "content":
                       "아래는 어르신 이름이 확정된 인수인계 기록입니다.\n"
                       + json.dumps({"entries": clean}, ensure_ascii=False)
                       + "\n\n지정된 JSON 스키마로 요약을 작성하세요."}],
        )
        if getattr(msg, "stop_reason", None) == "max_tokens":
            return None, "응답이 길이 제한으로 잘렸습니다"
        parsed = _safe_parse_json(msg.content[0].text)
        if not parsed:
            return None, "응답 JSON 파싱 실패"
        return parsed, ""
    except Exception as e:
        logger.warning(f"[handover] 요약 재생성 실패: {e}")
        return None, f"{type(e).__name__}: {e}"[:200]
