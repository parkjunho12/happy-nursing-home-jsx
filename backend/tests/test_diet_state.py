"""식이 — 그날 무엇을 드시는가, 그리고 주방에 몇 인분을 올리는가.

이 계산이 틀리면 어르신이 못 드시는 음식을 받는다. 삼킴이 어려워 죽으로
내려 드린 분께 일반식이 가면 사고다. 그래서 경계를 못박아 둔다.

  · 적용일 당일부터 새 식이다 (그 전날까지는 이전 식이)
  · 앞날에 예약해 둔 변경은 오늘 집계에 섞이지 않는다
  · 같은 날 두 번 고쳤으면 나중에 적은 것이 이긴다
  · 경관식은 밥·반찬을 세지 않는다 — 두 번 세면 주방이 더 만든다
  · 아무도 안 정해 준 분은 0이 아니라 '미정' 이다 — 빈칸은 빈칸이라 말해야 채운다

의존성 없이 돌아야 한다.  python3 backend/tests/test_diet_state.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import diet_state as ds          # noqa: E402
from app.services.diet_import import sheet_date, _blocks, read_sheet   # noqa: E402
from app.services import staff_meal as smeal        # noqa: E402

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


def ch(date, rice=None, side=None, tube=False, at="1"):
    return {"effective_date": date, "rice": rice, "side": side,
            "tube": tube, "created_at": at}


# ── ① 그날의 식이 ─────────────────────────────────────────────────────────
H = [ch("2026-05-01", "일반식", "일반찬"),
     ch("2026-08-18", "미음", "갈찬"),
     ch("2026-08-19", "죽", "갈찬")]

eq(ds.state_at(H, "2026-04-30"), None, "첫 기록보다 앞 — 아직 미정")
eq((ds.state_at(H, "2026-05-01") or {}).get("rice"), "일반식", "적용일 당일부터")
eq((ds.state_at(H, "2026-08-17") or {}).get("rice"), "일반식", "바뀌기 전날")
eq((ds.state_at(H, "2026-08-18") or {}).get("rice"), "미음", "바뀐 날")
eq((ds.state_at(H, "2026-08-19") or {}).get("rice"), "죽", "하루 만에 또 바뀜")
eq((ds.state_at(H, "2026-12-31") or {}).get("rice"), "죽", "그 뒤로는 계속")

# 앞날 예약이 오늘로 새면 안 된다 — 주방이 오늘 그걸 만든다
F = H + [ch("2026-09-20", "미음", "갈찬")]
eq((ds.state_at(F, "2026-09-11") or {}).get("rice"), "죽", "앞날 예약은 오늘에 안 섞인다")
eq((ds.next_change(F, "2026-09-11") or {}).get("effective_date"), "2026-09-20", "다음 예정")
eq(ds.next_change(F, "2026-12-31"), None, "예정 없음")

# 같은 날 두 번 고쳤으면 나중에 적은 것
S = [ch("2026-09-11", "죽", "다진찬", at="10:00"),
     ch("2026-09-11", "미음", "갈찬", at="15:00")]
eq((ds.state_at(S, "2026-09-11") or {}).get("rice"), "미음", "같은 날 두 번 — 나중 것")

# ── ② 주방에 올릴 숫자 ────────────────────────────────────────────────────
STATES = [
    {"rice": "일반식", "side": "일반찬", "tube": False},
    {"rice": "다진식", "side": "다진찬", "tube": False},
    {"rice": "일반식", "side": "다진찬", "tube": False},
    {"rice": "죽", "side": "다진찬", "tube": False},
    {"rice": "미음", "side": "갈찬", "tube": False},
    {"rice": None, "side": None, "tube": True},        # 경관식
    None,                                              # 아무도 안 정해 줌
]
c = ds.counts(STATES)
eq(c["일반식"], 2, "일반식")
eq(c["다진식"], 1, "다진식")
eq(c["죽"], 1, "죽")
eq(c["미음"], 1, "미음")
eq(c["당뇨식"], 0, "당뇨식 — 쓰지 않아도 칸은 있다")
eq(c["일반찬"], 1, "일반찬")
eq(c["다진찬"], 3, "다진찬")
eq(c["갈찬"], 1, "갈찬")
eq(c["경관식"], 1, "경관식")
eq(c["미정"], 1, "미정")
eq(c["합계"], 7, "합계")
# 경관식이 밥·반찬에도 세어지면 주방이 더 만든다
eq(sum(c[k] for k in ds.RICE_TYPES), 5, "밥 합계는 경관식·미정을 빼고 5")
eq(sum(c[k] for k in ds.SIDE_TYPES), 5, "반찬 합계도 5")

# 밥만 정하고 반찬을 안 정한 경우 — 미정으로 세지 않는다(밥은 정해졌다)
half = ds.counts([{"rice": "죽", "side": None, "tube": False}])
eq((half["죽"], half["미정"]), (1, 0), "밥만 정해진 분")

# ── ③ 값 검사 ─────────────────────────────────────────────────────────────
for v, want in [("일반식", True), ("당뇨식", True), ("다진식", True), ("죽", True), ("미음", True),
                (None, True), ("라면", False), ("일반찬", False), ("", False)]:
    eq(ds.valid_rice(v), want, f"밥 값 검사 {v!r}")
for v, want in [("일반찬", True), ("다진찬", True), ("갈찬", True),
                (None, True), ("죽", False), ("무침", False)]:
    eq(ds.valid_side(v), want, f"반찬 값 검사 {v!r}")

# ── ④ 이력에 적히는 말 ────────────────────────────────────────────────────
eq(ds.diff(None, {"rice": "일반식", "side": "일반찬"}), ["미정 → 일반식 · 일반찬"], "첫 기록")
eq(ds.diff({"rice": "일반식", "side": "일반찬"}, {"rice": "죽", "side": "다진찬"}),
   ["일반식 · 일반찬 → 죽 · 다진찬"], "바뀐 말")
eq(ds.diff({"rice": "죽", "side": "갈찬"}, {"rice": "죽", "side": "갈찬"}), [], "안 바뀌면 빈 것")
eq(ds.diff({"rice": "죽", "side": "갈찬"}, {"tube": True}), ["죽 · 갈찬 → 경관식"], "경관식으로")

# ── ⑤ 엑셀 시트 이름 = 날짜 ───────────────────────────────────────────────
for name, want in [("26.09.07", "2026-09-07"), ("26.8.21", "2026-08-21"),
                   ("26.04.14", "2026-04-14"),
                   ("26.07월식수현황", None), ("일일식수표", None),
                   ("26.13.01", None), ("26.09.32", None), ("", None)]:
    eq(sheet_date(name), want, f"시트 이름 {name!r}")

# ── ⑥ 엑셀에서 열을 어떻게 찾는가 ─────────────────────────────────────────
# 시트마다 열이 다르다. 실제 파일에서 이른 시기 8장은 '당뇨식' 칸이 아예 없어
# 그 뒤가 통째로 한 칸씩 당겨져 있었다. 자리를 세면 그 8장의 죽·미음·반찬을
# 조용히 못 읽는다 — 그러면 그 시기 이력이 통째로 틀린다.
# 그래서 머리글 글자로 찾는다. openpyxl 없이 확인하려고 시트를 흉내 낸다.
class FakeCell:
    def __init__(self, v): self.value = v


class FakeSheet:
    """rows: {(행, 열): 값}"""
    def __init__(self, rows, width):
        self._rows, self.max_column = rows, width

    def cell(self, r, c):
        return FakeCell(self._rows.get((r, c)))


def sheet(headers, body=()):
    """headers: {열: 머리글}, body: {(행, 열): 값}"""
    rows = {(13, c): h for c, h in headers.items()}
    rows.update(body)
    return FakeSheet(rows, max(list(headers) + [c for _, c in rows]) + 2)


# ⓐ 지금 쓰는 모양 (당뇨식 있음)
now = sheet({1: "호실", 2: "이름", 3: "일반식", 4: "당뇨식", 5: "죽", 6: "미음",
             8: "일반찬", 9: "다진찬", 10: "갈찬", 12: "입퇴소\n 입원"})
b = _blocks(now)[0]
eq((b.get("죽"), b.get("미음"), b.get("일반찬"), b.get("갈찬"), b.get("note")),
   (5, 6, 8, 10, 12), "지금 모양 — 열 찾기")

# ⓑ 이른 시기 모양 (당뇨식 없음 — 뒤가 한 칸씩 당겨짐)
old = sheet({1: "호실", 2: "이름", 3: "일반식", 4: "죽", 5: "미음",
             7: "일반찬", 8: "다진찬", 9: "갈찬", 11: "입퇴소\n 입원"})
b = _blocks(old)[0]
eq((b.get("죽"), b.get("미음"), b.get("일반찬"), b.get("갈찬"), b.get("note")),
   (4, 5, 7, 9, 11), "당뇨식 없는 모양 — 열 찾기")
eq("당뇨식" in b, False, "없는 칸은 안 잡힌다")

# ⓒ 층 블록 두 개가 나란히 — 옆 층 칸을 끌어오지 않아야
two = sheet({1: "호실", 2: "이름", 3: "일반식", 4: "죽", 6: "일반찬", 8: "입퇴소\n 입원",
             13: "호실", 14: "이름", 15: "일반식", 16: "죽", 18: "일반찬", 20: "입퇴소\n 입원"})
bs = _blocks(two)
eq(len(bs), 2, "블록 두 개")
eq(bs[0].get("note"), 8, "왼쪽 블록의 입퇴소 칸")
eq(bs[1].get("note"), 20, "오른쪽 블록의 입퇴소 칸")
eq(bs[0].get("일반식"), 3, "왼쪽 블록의 일반식")
eq(bs[1].get("일반식"), 15, "오른쪽 블록의 일반식")

# ⓓ 줄을 실제로 읽는다 — 호실은 위에서 이어받고, 경관은 비고로 판단한다
s2 = sheet({1: "호실", 2: "이름", 3: "일반식", 4: "죽", 6: "일반찬", 7: "다진찬", 9: "입퇴소\n 입원"},
           {(14, 1): 201, (14, 2): "가", (14, 3): 0, (14, 6): 0,
            (15, 2): "나", (15, 4): 0, (15, 7): 0,
            (16, 2): "다", (16, 9): "경관",
            (18, 1): 202, (18, 2): "라", (18, 3): 0, (18, 6): 0})
got = [(r["name"], r["room"], r["rice"], r["side"], r["tube"]) for r in read_sheet(s2)]
eq(got, [("가", "201", "일반식", "일반찬", False),
         ("나", "201", "죽", "다진찬", False),
         ("다", "201", None, None, True),
         ("라", "202", "일반식", "일반찬", False)], "줄 읽기")

# ── ⑦ 직원 점심 인원 ──────────────────────────────────────────────────────
# 주방은 어르신 몫만으로 끝나지 않는다. 직원 수를 덜 세면 그만큼 덜 짓는다.
# 야간조를 두 번 세거나(어제 것 + 오늘 것) 반일 근무를 빼먹기 쉬운 자리다.
LUNCH, BREAKFAST = 12 * 60, 8 * 60

for code, want, why in [
    ("D", True, "주간 08:50~18:00"),
    ("M", True, "모닝 06:50~16:00"),
    ("AD", True, "오전 09:00~13:30"),
    ("PD", False, "오후 13:30 출근 — 12시 점심에는 안 계신다"),
    ("N", False, "야간 18:00 출근 — 점심에는 안 계신다"),
    ("休", False, "연차"), ("대휴", False, "대체휴무"), ("◆병", False, "병가"),
    ("0850 1600", True, "직접 적은 시간대"),
    ("1330~1800", False, "직접 적은 오후"),
    ("", False, "빈 칸"), (None, False, "없음"), ("??", False, "모르는 표시"),
]:
    eq(smeal.at_meal(code, LUNCH), want, f"점심 — {why}")

# 끝나는 시각에 딱 맞으면 나가시는 중이다. 시작 시각에 맞으면 계신다.
eq(smeal.at_meal("AD", 13 * 60 + 30), False, "13:30 퇴근 — 13:30 끼니는 안 드신다")
eq(smeal.at_meal("PD", 13 * 60 + 30), True, "13:30 출근 — 13:30 끼니는 드신다")

# 야간은 '어제 칸' 으로만 오늘 아침에 계신다. 한 조건으로 묶으면 두 번 세어진다.
eq(smeal.at_meal("N", BREAKFAST), False, "오늘 야간 — 오늘 아침에는 아직 안 오셨다")
eq(smeal.at_meal("N", BREAKFAST, from_yesterday=True), True, "어제 야간 — 오늘 아침에 계신다")
eq(smeal.at_meal("N", 9 * 60, from_yesterday=True), False, "09:00 퇴근 — 09:00 끼니는 안 드신다")
eq(smeal.at_meal("D", BREAKFAST, from_yesterday=True), False, "어제 주간이 오늘로 넘어오지 않는다")

# 시간제 — 네 시간이 안 되는 근무는 드시지 않는 것으로 본다.
# 09:30~12:30 만 오시는 물리치료사가 점심에 걸친다고 세면 주방이 헛일을 한다.
# 반대로 오전 근무(AD 4시간 30분)는 드신다 — 경계를 네 시간에 뒀다.
for code, want, why in [
    ("0930~1230", True, "3시간 — 시간제"),
    ("0930 1230", True, "3시간 (공백 표기)"),
    ("1000-1330", True, "3시간 30분"),
    ("1000-1400", False, "4시간 — 시간제 아님"),
    ("AD", False, "오전 근무 4시간 30분"),
    ("D", False, "주간"), ("N", False, "야간"), ("休", False, "연차 — 근무가 아니다"),
]:
    eq(smeal.is_part_time(code), want, f"시간제 판정 — {why}")
eq(smeal.at_meal("0930~1230", LUNCH), False, "시간제는 점심 시각에 걸쳐도 안 센다")

# 빠진 까닭을 사람 말로 적는다 — 숫자만 주면 근무표를 다시 펴 보게 된다
eq(smeal.why("休", LUNCH), "연차", "사유 — 연차")
eq(smeal.why("N", LUNCH), "그 시각엔 아직 출근 전(N)", "사유 — 야간")
eq(smeal.why("AD", 18 * 60), "그 시각엔 이미 퇴근(AD)", "사유 — 퇴근 뒤")
eq(smeal.why("0930~1230", LUNCH), "시간제 근무(0930~1230 · 3시간)", "사유 — 시간제")
eq(smeal.why("", LUNCH), "근무표가 비어 있음", "사유 — 빈 칸")
eq(smeal.why("??", LUNCH), "읽을 수 없는 표시(??)", "사유 — 모르는 표시")

# 직종 묶기 — 쓰시던 월별 표의 네 칸
for pos, want in [("시설장", "사무실"), ("사회복지사", "사무실"), ("사무원", "사무실"),
                  # 작업치료사는 시설이 사무실로 세어 왔다
                  ("작업치료사", "사무실"),
                  ("간호팀장", "간호"), ("간호사", "간호"), ("간호조무사", "간호"),
                  ("요양보호사", "요양"), ("요양팀장", "요양"),
                  ("영양사", "기타"), ("조리원", "기타"), ("물리치료사", "기타"),
                  ("", "기타"), (None, "기타")]:
    eq(smeal.group_of(pos), want, f"직종 묶기 {pos!r}")

REPORTED = [("간호팀장", "D"), ("사회복지사", "D"), ("사회복지사", "D"),
            ("시설장", "D"), ("작업치료사", "D"),
            ("물리치료사", "0930~1230"),          # 시간제 — 세지 않는다
            ("요양보호사", "D"), ("요양보호사", "M"), ("영양사", "D")]
eq(smeal.count_for_day(REPORTED, LUNCH),
   {"사무실": 4, "간호": 1, "요양": 2, "기타": 1, "합계": 8},
   "간호팀장 1 · 사회복지사 2 가 제 칸에 들어간다")

CELLS = [("시설장", "D"), ("사회복지사", "D"), ("사무원", "休"),
         ("간호팀장", "D"), ("간호사", "N"), ("간호조무사", "AD"),
         ("요양보호사", "D"), ("요양보호사", "D"), ("요양보호사", "N"),
         ("요양보호사", "PD"), ("요양팀장", "M"),
         ("영양사", "D"), ("조리원", "0600 1500"), ("물리치료사", "대휴")]
YESTERDAY = [("간호사", "N"), ("요양보호사", "D")]
got = smeal.count_for_day(CELLS, LUNCH, YESTERDAY)
eq(got, {"사무실": 2, "간호": 2, "요양": 3, "기타": 2, "합계": 9}, "점심 인원")
# 어제 야간이 점심에 섞이면 안 된다 — 어제 칸을 빼도 같아야 한다
eq(smeal.count_for_day(CELLS, LUNCH), got, "어제 칸은 점심에 영향 없음")
# 아침은 어제 야간이 들어온다
b = smeal.count_for_day(CELLS, BREAKFAST, YESTERDAY)
eq((b["간호"], b["요양"], b["합계"]), (1, 1, 3), "아침 — 어제 야간 둘 + 오늘 모닝 하나")

if fails:
    print("❌ 식이 계산 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✅ 식이 계산 정상 — 시점 판정 9건 · 집계 14건 · 값 검사 15건 "
      "· 이력 문구 4건 · 시트 이름 8건 · 엑셀 열 찾기 9건 "
      "· 직원 점심 48건")
