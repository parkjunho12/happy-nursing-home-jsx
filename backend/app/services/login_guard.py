"""로그인 시도 제한 — 네 자리 비밀번호를 쓸 수 있게 만드는 장치.

■ 왜 필요한가

  아이디를 H001, H002 … 로 바꾸면 아이디를 더 이상 추측할 필요가 없어진다.
  거기에 비밀번호가 네 자리면 계정 하나당 경우의 수가 1만이다. 아무 제한이
  없으면 스크립트로 다 열린다. 자릿수가 아니라 이 잠금이 안전을 만든다.

■ 무엇으로 세는가 — 아이디만으로는 절대 잠그지 않는다

  아이디가 순번이라, 아이디만 보고 잠그면 누구나 H001~H032 를 몇 번씩
  틀려서 전 직원을 못 들어오게 만들 수 있다. 요양원에서 그건 그날 기록이
  통째로 밀린다는 뜻이다. 공격을 막으려다 업무를 막는 셈이다.

  그래서 두 가지로 센다.
    · (아이디 + 접속지) — 한 곳에서 한 사람의 비밀번호를 캐는 것
    · (접속지)         — 한 곳에서 이 아이디 저 아이디 훑는 것
  둘 다 '어디서' 를 포함한다. 다른 사람의 계정을 잠글 방법이 없다.

■ 얼마나 잠그는가

  처음부터 30분을 잠그지 않는다. 선생님들이 비밀번호를 헷갈리는 일은 늘
  있고, 그때마다 30분을 기다리게 하면 시스템을 안 쓰게 된다.
  1분 → 5분 → 30분으로 늘린다. 사람은 대개 1분이면 기억해내고, 스크립트는
  30분 벽에 걸린다.

■ 레디스가 죽으면

  잠금을 못 걸어도 로그인은 되게 둔다(경고 로그만 남긴다). 요양원에서
  기록을 못 남기는 쪽이 더 큰 사고다. 대신 로그로 남겨 알 수 있게 한다.
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 같은 곳에서 한 아이디를 이만큼 틀리면 잠근다.
# 5회 — 사람이 비밀번호를 헷갈리는 횟수로는 넉넉하고,
# 1만 가지를 훑기에는 턱없이 모자란다.
FAIL_LIMIT_ID_IP = 5

# 같은 곳에서 아이디를 갈아가며 틀린 횟수. 아이디 훑기를 잡는다.
# 한 사무실에서 여러 선생님이 번갈아 로그인하다 틀릴 수 있어 넉넉히 둔다.
FAIL_LIMIT_IP = 20

# 실패 횟수를 세는 창(초). 이 시간 동안 조용하면 없던 일이 된다.
WINDOW_SEC = 15 * 60

# 잠금 시간(초) — 갈수록 길어진다
LOCK_STEPS = (60, 5 * 60, 30 * 60)


def lock_seconds(fails: int, limit: int) -> int:
    """이만큼 틀렸을 때 몇 초를 잠글지. 한도에 못 미치면 0.

    한도를 넘길 때마다 한 단계씩 길어지고 마지막 단계에서 멈춘다.
    무한정 늘리지 않는다 — 하루를 잠가 두면 다음 날 아침 근무 기록이 막힌다.
    """
    if fails < limit:
        return 0
    step = (fails - limit) // limit
    return LOCK_STEPS[min(step, len(LOCK_STEPS) - 1)]


def _norm(v: Optional[str]) -> str:
    return (v or "").strip().lower()


class LoginGuard:
    """레디스에 실패 횟수를 담아 두고 잠글지 판단한다."""

    def __init__(self, redis_client):
        self.r = redis_client

    # ── 키 ──
    def _k_pair(self, ident: str, ip: str) -> str:
        return f"login:fail:{_norm(ident)}@{ip}"

    def _k_ip(self, ip: str) -> str:
        return f"login:fail:ip:{ip}"

    def locked_for(self, ident: str, ip: str) -> int:
        """지금 잠겨 있으면 남은 초, 아니면 0."""
        if not self.r:
            return 0
        try:
            for key, limit in ((self._k_pair(ident, ip), FAIL_LIMIT_ID_IP),
                               (self._k_ip(ip), FAIL_LIMIT_IP)):
                fails = int(self.r.get(key) or 0)
                if lock_seconds(fails, limit) > 0:
                    ttl = self.r.ttl(key)
                    # 잠금이 남아 있는 동안만 막는다. 창이 지나면 풀린다.
                    if ttl and ttl > 0:
                        return min(ttl, lock_seconds(fails, limit))
            return 0
        except Exception as e:                       # 레디스가 아플 때
            logger.warning("로그인 잠금 확인 실패 — 잠금 없이 진행합니다 (%s)", type(e).__name__)
            return 0

    def record_failure(self, ident: str, ip: str) -> None:
        if not self.r:
            return
        try:
            for key in (self._k_pair(ident, ip), self._k_ip(ip)):
                n = self.r.incr(key)
                # 첫 실패에만 만료를 건다. 매번 늘리면 계속 틀리는 동안
                # 창이 끝나지 않아 영영 안 풀린다.
                if n == 1:
                    self.r.expire(key, WINDOW_SEC)
        except Exception as e:
            logger.warning("로그인 실패 기록 못 함 (%s)", type(e).__name__)

    def clear(self, ident: str, ip: str) -> None:
        """들어왔으면 없던 일로. 비밀번호를 아는 사람을 계속 세지 않는다."""
        if not self.r:
            return
        try:
            self.r.delete(self._k_pair(ident, ip))
        except Exception:
            pass


def human_wait(seconds: int) -> str:
    """남은 시간을 사람 말로. 초 단위를 그대로 보여주면 읽지 않는다."""
    if seconds >= 60:
        return f"{(seconds + 59) // 60}분"
    return f"{max(1, seconds)}초"
