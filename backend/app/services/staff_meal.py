"""오늘 점심을 드시는 직원 — 근무표에서 세어 낸다.

■ 왜 필요한가

  주방은 어르신 몫만으로 끝나지 않는다. 그날 나온 직원 수만큼 더 지어야
  한다. 지금은 근무표를 눈으로 훑어 세고 있는데, 사람이 세면 야간조를
  넣었다 뺐다 하고 반일 근무를 빼먹는다.

■ 무엇을 '점심을 드신다' 로 보는가

  근무 시간대가 점심 시각을 품고 있으면 드시는 것으로 본다. 코드마다
  시간대가 정해져 있고(D 08:50~18:00 · PD 13:30~18:00 …), 근무표에
  '0850 1600' 처럼 직접 적은 시간대도 그대로 읽는다.

  · D · M · AD  → 점심 시각에 계신다
  · PD          → 13:30 출근이라 12시 점심에는 안 계신다
  · N           → 09:00 퇴근이라 안 계신다
  · 연차·대휴·병가 → 안 나오신다

  '점심 시각' 은 식사 시간 설정에서 온다. 시설이 12:00 을 12:30 으로 바꾸면
  이 계산도 따라 바뀌어야 한다 — 여기에 12시를 박아 두지 않는다.

■ 왜 직종을 묶는가

  쓰시던 월별 식수현황 표가 사무실 · 간호 · 요양 · 기타 네 칸이었다.
  주방·정산이 그 칸으로 세어 왔으므로 같은 칸을 쓴다.

  표준 라이브러리만 쓴다 — 배포 전 검사가 설치 없이 이 규칙을 확인한다.
"""
from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Tuple

# 근무 코드 → (출근, 퇴근) 분 단위. shiftCodes.ts 의 time 과 같아야 한다.
# 야간은 자정을 넘기므로 퇴근이 1440 을 넘는 값으로 적는다.
CODE_SPAN: Dict[str, Tuple[int, int]] = {
    "D":  (8 * 60 + 50, 18 * 60),          # 주간 08:50~18:00
    "M":  (6 * 60 + 50, 16 * 60),          # 모닝 06:50~16:00
    "AD": (9 * 60, 13 * 60 + 30),          # 오전 09:00~13:30
    "PD": (13 * 60 + 30, 18 * 60),         # 오후 13:30~18:00
    "N":  (18 * 60, 24 * 60 + 9 * 60),     # 야간 18:00~익일 09:00
}

# 나오지 않는 날 — 세지 않는다
OFF_CODES = {"休", "대휴", "초과휴", "◆병", "◆"}

# 직종 묶음 — 쓰시던 월별 표의 네 칸 그대로
GROUPS: List[Tuple[str, Tuple[str, ...]]] = [
    ("사무실", ("시설장", "대표", "이사", "사회복지사", "사무원", "사무국장")),
    ("간호", ("간호팀장", "간호사", "간호조무사")),
    ("요양", ("요양보호사", "요양팀장")),
]
GROUP_NAMES = [g for g, _ in GROUPS] + ["기타"]

_TIME_RE = re.compile(r"^(\d{1,2})[:\s]?(\d{2})\s*[-~\s]\s*(\d{1,2})[:\s]?(\d{2})$")


def group_of(position: Optional[str]) -> str:
    """직종 → 표의 칸. 어디에도 없으면 '기타' 다(영양사·조리원·치료사 등)."""
    pos = (position or "").strip()
    for name, members in GROUPS:
        if pos in members:
            return name
    return "기타"


def to_minutes(hhmm: Optional[str]) -> Optional[int]:
    if not hhmm or ":" not in str(hhmm):
        return None
    try:
        h, m = str(hhmm).split(":")[:2]
        return int(h) * 60 + int(m)
    except ValueError:
        return None


def span_of(code: Optional[str]) -> Optional[Tuple[int, int]]:
    """근무 칸 하나 → (출근, 퇴근) 분. 근무가 아니면 None."""
    c = (code or "").strip()
    if not c or c in OFF_CODES:
        return None
    if c in CODE_SPAN:
        return CODE_SPAN[c]
    m = _TIME_RE.match(c)
    if not m:
        return None                       # 모르는 표시는 세지 않는다
    a, b, x, y = (int(g) for g in m.groups())
    start, end = a * 60 + b, x * 60 + y
    if end <= start:
        end += 24 * 60                    # 자정을 넘긴 근무
    return (start, end)


def at_meal(code: Optional[str], meal_minutes: int, *, from_yesterday: bool = False) -> bool:
    """그 칸의 근무가 그 끼니 시각에 걸치는가.

    from_yesterday 는 '어제 칸' 을 볼 때 켠다. 야간 근무는 어제 18시에 시작해
    오늘 9시에 끝나므로, 오늘 아침을 드시는 분은 '어제 N' 이다. '오늘 N' 인
    분은 오늘 저녁에 오신다 — 오늘 아침에는 안 계신다. 이 둘을 한 조건으로
    묶으면 야간조가 하루에 두 번 세어진다.

    시작 시각에 딱 맞으면 계신 것으로 본다(09:00 출근 · 09:00 아침).
    끝나는 시각에 딱 맞으면 나가시는 중이라 세지 않는다 — 13:30 퇴근인
    오전 근무는 13:30 점심을 드시지 않는다.
    """
    sp = span_of(code)
    if not sp:
        return False
    start, end = sp
    m = meal_minutes + 24 * 60 if from_yesterday else meal_minutes
    return start <= m < end


def count_for_day(
    cells: Iterable[Tuple[Optional[str], Optional[str]]],
    meal_minutes: int,
    prev_cells: Optional[Iterable[Tuple[Optional[str], Optional[str]]]] = None,
) -> Dict[str, int]:
    """(직종, 근무코드) 목록 → 칸별 인원.

    prev_cells 는 어제 칸이다. 야간 근무가 오늘 아침까지 이어지므로 아침을
    셀 때 필요하다. 점심에는 걸릴 일이 없지만, 부르는 쪽이 끼니를 바꿔도
    맞게 나오도록 받아 둔다.

    합계도 함께 낸다 — 화면과 주방이 같은 숫자를 보게.
    """
    out = {g: 0 for g in GROUP_NAMES}
    out["합계"] = 0

    def add(position: Optional[str]) -> None:
        out[group_of(position)] += 1
        out["합계"] += 1

    for position, code in cells:
        if at_meal(code, meal_minutes):
            add(position)
    for position, code in (prev_cells or []):
        if at_meal(code, meal_minutes, from_yesterday=True):
            add(position)
    return out
