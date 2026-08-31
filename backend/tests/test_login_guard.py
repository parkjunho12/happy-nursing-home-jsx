"""로그인 잠금 규칙 — 네 자리 비밀번호를 쓸 수 있게 만드는 장치.

아이디를 H001, H002 … 로 바꾸면 아이디를 추측할 필요가 없어진다. 거기에
비밀번호가 네 자리면 계정당 경우의 수가 1만이다. **자릿수가 아니라 이 잠금이
안전을 만든다.** 이 규칙이 느슨해지거나 사라지면 네 자리 비밀번호는 그냥
뚫린 문이 된다. 그래서 여기 못박아 둔다.

특히 지키는 것: **아이디만으로는 절대 잠그지 않는다.**
아이디가 순번이라 그렇게 하면 누구나 전 직원을 못 들어오게 만들 수 있다.
요양원에서 그건 그날 기록이 통째로 밀린다는 뜻이다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_login_guard.py
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

MODULE = Path(__file__).resolve().parent.parent / "app" / "services" / "login_guard.py"


def _load():
    spec = importlib.util.spec_from_file_location("login_guard", MODULE)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class FakeRedis:
    """레디스 흉내 — 실제 서버 없이 규칙만 본다."""

    def __init__(self, broken: bool = False):
        self.v: dict = {}
        self.ttl_: dict = {}
        self.broken = broken

    def _boom(self):
        if self.broken:
            raise ConnectionError("redis down")

    def get(self, k):
        self._boom(); return self.v.get(k)

    def incr(self, k):
        self._boom(); self.v[k] = int(self.v.get(k, 0)) + 1; return self.v[k]

    def expire(self, k, s):
        self._boom(); self.ttl_[k] = s

    def ttl(self, k):
        self._boom(); return self.ttl_.get(k, -1)

    def delete(self, k):
        self._boom(); self.v.pop(k, None); self.ttl_.pop(k, None)


def check() -> int:
    m = _load()
    bad: list[str] = []

    # ── 잠금 시간이 늘어나는 규칙 ──────────────────────────────────
    L = m.FAIL_LIMIT_ID_IP
    for fails, want in [
        (0, 0), (L - 1, 0),                    # 한도 전에는 안 잠근다
        (L, m.LOCK_STEPS[0]),                  # 처음엔 1분 — 사람은 대개 여기서 기억해낸다
        (L * 2, m.LOCK_STEPS[1]),              # 계속 틀리면 5분
        (L * 3, m.LOCK_STEPS[2]),              # 그다음 30분
        (L * 50, m.LOCK_STEPS[-1]),            # 무한정 늘지 않는다 — 다음 날 아침이 막히면 안 된다
    ]:
        got = m.lock_seconds(fails, L)
        if got != want:
            bad.append(f"{fails}회 실패: {want}초 여야 하는데 {got}초")

    if m.LOCK_STEPS[0] > 300:
        bad.append("첫 잠금이 5분을 넘는다 — 비밀번호를 헷갈린 선생님이 업무를 못 본다")

    # ── 네 자리를 실제로 지켜 주는가 ──────────────────────────────
    # 1만 가지를 다 넣어보려면 몇 번의 잠금을 통과해야 하는지 대략 센다.
    # 30분 벽에 걸린 뒤로는 5회마다 30분이다.
    tries_before_max = L * 3
    remaining = 10000 - tries_before_max
    hours = (remaining / L) * (m.LOCK_STEPS[-1] / 3600)
    if hours < 24 * 30:
        bad.append(f"네 자리를 다 훑는 데 {hours:.0f}시간뿐 — 잠금이 너무 약하다")

    # ── 아이디만으로는 잠그지 않는다 (남을 못 잠근다) ──────────────
    g = m.LoginGuard(FakeRedis())
    for _ in range(50):
        g.record_failure("H001", "1.1.1.1")     # 공격자가 다른 곳에서 두드린다
    if g.locked_for("H001", "9.9.9.9") != 0:
        bad.append("다른 곳에서 틀린 것 때문에 정상 사용자가 잠겼다 — 남의 계정을 잠글 수 있다")
    if g.locked_for("H001", "1.1.1.1") == 0:
        bad.append("같은 곳에서 계속 틀렸는데 안 잠긴다")

    # ── 아이디 훑기는 접속지로 잡는다 ──────────────────────────────
    g2 = m.LoginGuard(FakeRedis())
    for i in range(m.FAIL_LIMIT_IP + 1):
        g2.record_failure(f"H{i:03d}", "2.2.2.2")   # 아이디를 갈아가며
    if g2.locked_for("H999", "2.2.2.2") == 0:
        bad.append("한 곳에서 아이디를 갈아가며 훑는 것을 못 막는다")

    # ── 들어오면 없던 일로 ────────────────────────────────────────
    g3 = m.LoginGuard(FakeRedis())
    for _ in range(L):
        g3.record_failure("H002", "3.3.3.3")
    g3.clear("H002", "3.3.3.3")
    if g3.locked_for("H002", "3.3.3.3") != 0:
        bad.append("비밀번호를 맞게 넣었는데도 실패 기록이 남아 있다")

    # ── 대소문자를 가리지 않는다 ──────────────────────────────────
    g4 = m.LoginGuard(FakeRedis())
    for _ in range(L):
        g4.record_failure("h001", "4.4.4.4")
    if g4.locked_for("H001", "4.4.4.4") == 0:
        bad.append("대소문자만 바꿔 넣으면 잠금을 피할 수 있다")

    # ── 레디스가 죽어도 로그인은 막지 않는다 ──────────────────────
    # 요양원에서 기록을 못 남기는 쪽이 더 큰 사고다.
    g5 = m.LoginGuard(FakeRedis(broken=True))
    g5.record_failure("H001", "5.5.5.5")
    if g5.locked_for("H001", "5.5.5.5") != 0:
        bad.append("레디스가 죽었을 때 전 직원이 못 들어온다")
    g6 = m.LoginGuard(None)
    if g6.locked_for("H001", "5.5.5.5") != 0:
        bad.append("레디스가 없을 때 전 직원이 못 들어온다")

    # ── 사람이 읽을 수 있게 ───────────────────────────────────────
    for sec, want in [(30, "30초"), (60, "1분"), (61, "2분"), (300, "5분"), (1800, "30분")]:
        got = m.human_wait(sec)
        if got != want:
            bad.append(f"남은 시간 표기 {sec}초: '{want}' 여야 하는데 '{got}'")

    if bad:
        print("❌ 로그인 잠금 규칙이 어긋납니다 — 네 자리 비밀번호가 무방비가 됩니다.")
        for b in bad:
            print("   ·", b)
        return 1

    print("✅ 로그인 잠금 정상 — 잠금 단계 6건 · 남의 계정 잠금 불가 · 아이디 훑기 차단 · "
          "성공 시 해제 · 대소문자 · 레디스 장애 2건 · 표기 5건")
    return 0


def test_login_guard():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
