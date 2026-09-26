"""식이가 바뀌면 할 일을 만든다 — 그 규칙만 따로 본다.

DB·ORM 없이 본다. 넘겨받는 것은 값뿐이라 SimpleNamespace 로 시험된다.
배포 전 검사에서 설치 없이 부르므로 표준 라이브러리만 쓴다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.diet_followup import changed, label_of  # noqa: E402


def main() -> int:
    bad = []

    def eq(got, want, what):
        if got != want:
            bad.append(f"{what}: {want!r} 여야 하는데 {got!r}")

    # ── 이름 짓기 — 화면·종이에 같은 말이 나가야 한다
    eq(label_of({"rice": "죽", "side": "다진찬"}), "죽 · 다진찬", "밥+반찬")
    eq(label_of({"rice": "일반식", "side": None}), "일반식", "밥만")
    eq(label_of({"rice": None, "side": "갈찬"}), "갈찬", "반찬만")
    # 경관식은 밥·반찬을 고르지 않는다 — 그 한 단어로 끝난다
    eq(label_of({"tube": True, "rice": "죽", "side": "갈찬"}), "경관식", "경관식")
    eq(label_of(None), "미정", "없음")
    eq(label_of({}), "미정", "빈 값")

    # ── 언제 할 일을 만드는가
    a = {"rice": "일반식", "side": "일반찬"}
    eq(changed(a, a), False, "같은 값이면 안 만든다")
    eq(changed(a, {"rice": "죽", "side": "일반찬"}), True, "밥이 바뀌면 만든다")
    eq(changed(a, {"rice": "일반식", "side": "다진찬"}), True, "반찬이 바뀌면 만든다")
    eq(changed(None, a), True, "미정에서 정해져도 만든다")
    eq(changed(a, {"tube": True}), True, "경관식으로 바뀌면 만든다")
    eq(changed({"tube": True}, {"tube": True, "rice": "죽"}), False,
       "경관식끼리는 밥 값이 달라도 같은 것이다")
    eq(changed({"tube": True}, a), True, "경관식에서 풀리면 만든다")
    # 사유만 고친 것은 식이 변경이 아니다 — 할 일 아닌 줄이 쌓이면 아무도 안 본다
    eq(changed({"rice": "죽", "side": "갈찬"}, {"rice": "죽", "side": "갈찬"}), False,
       "사유만 고친 경우")
    # 빈 값과 None 을 다르게 보면 '미정 → 미정' 에도 할 일이 생긴다
    eq(changed({"rice": None, "side": None}, {"rice": "", "side": ""}), False,
       "빈 값과 None 은 같다")

    if bad:
        print("❌ 식이 후속조치 규칙이 어긋납니다.")
        for b in bad:
            print("   ·", b)
        return 1
    print("✅ 식이 후속조치 규칙 정상 — 이름 6건 · 생성 여부 9건")
    return 0


def test_rules():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
