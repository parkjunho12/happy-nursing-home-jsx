"""쓰시던 「식수현황」 엑셀을 그대로 읽어 식이 이력으로 옮긴다.

■ 왜 업로드인가

  다섯 달 치가 시트 55장이다. 손으로 다시 넣으면 하루가 가고, 옮겨 적다
  틀린다. 파일을 그대로 올리면 그 안에 이미 '언제 무엇이 바뀌었는지' 가
  들어 있다 — 시트 한 장이 곧 그날의 상태다.

■ 열 자리를 고정하지 않는 이유

  시트마다 열이 다르다. 실제로 55장 중 8장은 3층 블록이 두 칸 왼쪽에 있었다
  (이름 열이 14열 vs 15열). 자리를 박아 두면 그 8장을 조용히 잘못 읽는다.
  그래서 머리글('이름' · '일반식' · '입퇴소')을 찾아 그 자리를 쓴다.

■ 무엇을 만들지 않는가

  어르신을 새로 만들지 않는다. 이름이 명단에 없으면 그 줄은 건너뛰고 몇
  건인지만 알린다. 엑셀의 이름 한 칸으로 사람을 만들면, 개명·동명이인·
  퇴소자가 그대로 새 어르신이 되어 명단이 망가진다.

■ 스냅샷 → 변경 기록

  시트는 그날의 '상태' 다. 우리는 '바뀐 순간' 만 담는다. 그래서 날짜순으로
  훑으며 직전과 다를 때만 한 줄을 남긴다. 55장이 30여 건이 된다.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.services.diet_state import RICE_TYPES, SIDE_TYPES

logger = logging.getLogger(__name__)

# 시트 이름이 곧 날짜다: '26.09.07' · '26.8.21'
_SHEET_DATE = re.compile(r"^(\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})$")
HEADER_ROW = 13          # '이름 | 일반식 | … | 입퇴소' 가 있는 줄
FIRST_BODY_ROW = 14
LAST_BODY_ROW = 60


def sheet_date(name: str) -> Optional[str]:
    m = _SHEET_DATE.match((name or "").strip())
    if not m:
        return None
    yy, mm, dd = (int(g) for g in m.groups())
    if not (1 <= mm <= 12 and 1 <= dd <= 31):
        return None
    return f"20{yy:02d}-{mm:02d}-{dd:02d}"


def _txt(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def _blocks(ws) -> List[Dict[str, int]]:
    """층 블록의 열 자리를 머리글에서 찾는다 (2층·3층·4층이 옆으로 나란히 있다).

    자리를 세지 않고 머리글 글자로만 찾는다. 시트마다 열이 다르기도 하고
    (55장 중 8장이 두 칸 어긋나 있었다), 우리가 식이 종류를 하나 더 만들면
    '이름에서 몇 번째 칸' 이라는 계산이 통째로 밀린다. 종이에 없는 종류는
    그냥 안 잡히면 된다.
    """
    out: List[Dict[str, int]] = []
    width = ws.max_column or 0
    wanted = set(RICE_TYPES) | set(SIDE_TYPES)
    for c in range(1, width + 1):
        if _txt(ws.cell(HEADER_ROW, c).value) != "이름":
            continue
        blk = {"name": c, "room": c - 1}
        # 이 블록은 다음 '이름' 머리글 전까지다 — 옆 층 칸을 끌어오지 않게
        stop = width + 1
        for look in range(c + 1, width + 1):
            if _txt(ws.cell(HEADER_ROW, look).value) == "이름":
                stop = look - 1
                break
        for look in range(c + 1, stop):
            head = _txt(ws.cell(HEADER_ROW, look).value)
            if head in wanted and head not in blk:
                blk[head] = look
            elif head.replace("\n", "").replace(" ", "") == "입퇴소입원" and "note" not in blk:
                blk["note"] = look
        if any(k in blk for k in wanted):
            out.append(blk)
    return out


def read_sheet(ws) -> List[Dict[str, Any]]:
    """시트 한 장 = 그날의 상태. [{name, room, rice, side, tube, note}]"""
    rows: List[Dict[str, Any]] = []
    for blk in _blocks(ws):
        room = ""
        for r in range(FIRST_BODY_ROW, LAST_BODY_ROW + 1):
            rv = _txt(ws.cell(r, blk["room"]).value)
            if rv:
                room = rv
            name = _txt(ws.cell(r, blk["name"]).value)
            if not name:
                continue
            rice = [t for t in RICE_TYPES if t in blk and ws.cell(r, blk[t]).value is not None]
            side = [t for t in SIDE_TYPES if t in blk and ws.cell(r, blk[t]).value is not None]
            note = _txt(ws.cell(r, blk["note"]).value) if "note" in blk else ""
            rows.append({
                "name": name, "room": room,
                # 두 칸에 표시된 적은 없지만, 있더라도 첫 칸을 쓰고 넘어간다
                "rice": rice[0] if rice else None,
                "side": side[0] if side else None,
                "tube": note.startswith("경관"),
                "note": note or None,
            })
    return rows


def snapshots(wb) -> List[Tuple[str, List[Dict[str, Any]]]]:
    """날짜가 붙은 시트만, 날짜순으로."""
    out = []
    for nm in wb.sheetnames:
        d = sheet_date(nm)
        if d:
            out.append((d, read_sheet(wb[nm])))
    out.sort(key=lambda x: x[0])
    return out


def to_changes(snaps: List[Tuple[str, List[Dict[str, Any]]]]) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """스냅샷 여러 장 → 바뀐 순간만.

    첫 등장은 '그때부터 그 식이' 로 한 줄 남긴다. 그래야 그 이전 날짜를
    조회했을 때 '미정' 이라고 정직하게 답할 수 있다.
    """
    changes: List[Dict[str, Any]] = []
    last: Dict[str, Tuple] = {}
    stat = {"sheets": len(snaps), "rows": 0, "people": 0}
    for date, rows in snaps:
        for p in rows:
            stat["rows"] += 1
            key = (p["rice"], p["side"], bool(p["tube"]))
            prev = last.get(p["name"])
            if prev == key:
                continue
            if p["name"] not in last:
                stat["people"] += 1
            last[p["name"]] = key
            changes.append({
                "name": p["name"], "room": p["room"], "effective_date": date,
                "rice": p["rice"], "side": p["side"], "tube": bool(p["tube"]),
                "note": p["note"] if p["note"] and not p["note"].startswith("경관") else None,
                "first": prev is None,
            })
    return changes, stat
