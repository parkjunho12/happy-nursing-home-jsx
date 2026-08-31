"""방송이 실제로 나갔는지 판정하는 규칙.

왜 이 파일이 있는가.

  ffplay 는 형식을 잘못 짚으면 아무 소리도 내지 않고 종료코드 0 으로 끝난다.
  실제로 5분 16초짜리 음원이 1.2초 만에 '성공' 으로 기록됐고, 현장에서는
  여덟 번을 다시 눌러 볼 때까지 아무도 원인을 알 수 없었다. 기록이 성공이라고
  말하고 있었기 때문이다.

  그래서 잰 시간과 음원 길이를 견주는 규칙을 넣었다. 이 규칙이 조용히
  사라지면 같은 일이 그대로 되풀이된다. 그걸 막으려고 여기 못박아 둔다.

  의존성 없이 돌아야 한다.  python3 apps/broadcast-agent/tests/test_play_verify.py
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

MODULE = Path(__file__).resolve().parent.parent / "broadcast_agent" / "agent.py"


def _too_short():
    """agent.py 를 통째로 불러오지 않고 판정 함수만 꺼내 온다.
    (모듈 최상단이 설정 파일이나 네트워크를 건드려도 테스트가 막히지 않게)"""
    src = MODULE.read_text(encoding="utf-8")
    ns: dict = {}
    start = src.index("MIN_PLAY_RATIO")
    end = src.index("\nclass ", start)
    exec("from typing import Optional\n" + src[start:end], ns)
    return ns["_too_short"]


def check() -> int:
    f = _too_short()
    bad: list[str] = []

    def yes(sec, dur, why):
        if f(sec, dur) is None:
            bad.append(f"실패로 봐야 하는데 통과시킴 — {why} ({sec}초 / {dur}초)")

    def no(sec, dur, why):
        if f(sec, dur) is not None:
            bad.append(f"통과시켜야 하는데 실패로 봄 — {why} ({sec}초 / {dur}초)")

    # 실제로 있었던 사고
    yes(1.18, 316, "5분짜리가 1.2초 만에 끝났다")
    yes(0.30, 316, "0.3초 만에 끝났다")
    # 중간에 끊긴 경우
    yes(40, 316, "절반도 못 채웠다")
    # 정상
    no(316.8, 316, "끝까지 재생됐다")
    no(15.7, 15, "짧은 안내가 끝까지 나갔다")
    no(300, 316, "거의 다 나갔다 — 끝부분 무음까지 재면 조금 모자랄 수 있다")

    # 길이를 모르면 판정하지 않는다.
    # 확실하지 않은 근거로 멀쩡한 방송을 실패로 뒤집으면 다음 주기에 또 나간다 —
    # 어르신들께는 같은 안내가 두 번 들린다.
    for unknown in (None, 0, "", "몰라"):
        no(0.1, unknown, f"길이를 모른다({unknown!r})")

    # 짧은 음원이라도 아예 안 났으면 잡아야 한다
    yes(0.2, 3, "3초짜리가 0.2초 만에 끝났다")

    if bad:
        print("❌ 방송 성공 판정이 어긋납니다 — 소리가 안 나가도 '성공'으로 남을 수 있습니다.")
        for b in bad:
            print("   ·", b)
        return 1

    print("✅ 방송 성공 판정 정상 — 사고 사례 4건 · 정상 3건 · 판정보류 4건")
    return 0


def test_play_verify():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
