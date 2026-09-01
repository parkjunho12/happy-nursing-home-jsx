"""프로그램 사진이 어느 날짜 폴더에 담기는가.

스무 장을 한꺼번에 올리며 사람이 일일이 날짜를 고르는 것은 현실적이지 않아서,
서버가 정한다. 그 규칙이 조용히 바뀌면 사진이 엉뚱한 날에 쌓이고, 나중에
'그날 뭐 했는지' 를 찾을 때 안 나온다.

순서
  ① 사진에 박힌 찍은 시각(EXIF)
  ② 브라우저가 아는 파일 수정시각
  ③ 둘 다 없으면 올린 날
     예전에는 1일로 몰았는데, 1일 폴더가 '날짜를 모르는 사진' 더미가 되어
     정작 1일에 찍은 사진과 섞였다.
  ④ 지난달을 보면서 올린 경우만 예전처럼 1일 — '오늘' 이 그 달에 없다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_program_photo_day.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent
       / "app" / "api" / "v1" / "endpoints" / "programs.py").read_text(encoding="utf-8")
KST = timezone(timedelta(hours=9))


def _pick_day():
    ns = {"datetime": datetime, "_KST_P": KST}
    exec("from typing import Optional\n", ns)
    exec(SRC[SRC.index("def _pick_day"):SRC.index("def _photo_view")], ns)
    return ns["_pick_day"]


def check() -> int:
    pick = _pick_day()
    bad: list[str] = []
    D = lambda s: datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=KST)

    def case(label, month, taken, fb, now, want_day):
        day, _ = pick(month, taken, fb, now)
        if day != want_day:
            bad.append(f"{label}: {want_day}일 이어야 하는데 {day}일")

    NOW = D("2026-09-01 10:00")      # 올린 날 = 9월 1일

    # ① 찍은 시각이 그 달이면 그 날
    case("EXIF 있음", "2026-09", D("2026-09-17 14:00"), None, NOW, 17)
    # EXIF 가 있으면 파일 수정시각보다 앞선다
    case("EXIF 우선", "2026-09", D("2026-09-17 14:00"), D("2026-09-20 09:00"), NOW, 17)
    # ② EXIF 가 없으면 파일 수정시각
    case("파일 수정시각", "2026-09", None, D("2026-09-20 09:00"), NOW, 20)
    # ③ 둘 다 없으면 올린 날 — 예전에는 1일이었다
    case("아무것도 없음", "2026-09", None, None, NOW, 1)   # 9/1 에 올렸으니 1일이 맞다
    case("아무것도 없음(9/17 업로드)", "2026-09", None, None, D("2026-09-17 08:00"), 17)
    # 찍은 달이 다르면 믿지 않는다 → 올린 날
    case("지난달 사진", "2026-09", D("2026-08-20 14:00"), None, D("2026-09-17 08:00"), 17)
    # ④ 지난달을 보면서 올리면 '오늘'이 그 달에 없다 → 1일
    case("지난달 정리", "2026-08", None, None, D("2026-09-17 08:00"), 1)
    case("지난달 정리(EXIF도 다른달)", "2026-08", D("2026-07-03 10:00"), None, D("2026-09-17 08:00"), 1)
    # 그 달 안이면 EXIF 를 그대로 쓴다 — 지난달을 정리해도
    case("지난달 정리(EXIF 맞음)", "2026-08", D("2026-08-03 10:00"), None, D("2026-09-17 08:00"), 3)
    # 말일 경계
    case("말일", "2026-09", None, None, D("2026-09-30 23:50"), 30)

    # taken_at 은 올린 시각으로 덮어쓰지 않는다 —
    # 올린 시각을 찍은 시각인 척 적으면 나중에 '언제 찍었지' 가 거짓말이 된다
    day, taken_at = pick("2026-09", None, None, NOW)
    if taken_at is not None:
        bad.append(f"찍은 시각을 모르는데 값을 만들어 냈다: {taken_at}")
    day, taken_at = pick("2026-09", D("2026-08-20 14:00"), None, NOW)
    if taken_at != D("2026-08-20 14:00"):
        bad.append("찍은 시각(다른 달)이 사라지거나 바뀌었다 — 원본 정보다")

    if bad:
        print("❌ 사진 날짜 규칙이 어긋납니다 — 사진이 엉뚱한 날에 쌓입니다.")
        for b in bad:
            print("   ·", b)
        return 1

    print("✅ 사진 날짜 정상 — 날짜 결정 10건 · 찍은 시각 보존 2건")
    return 0


def test_program_photo_day():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
