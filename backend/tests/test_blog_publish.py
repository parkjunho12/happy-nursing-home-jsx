"""블로그 발행 줄 — 두 번 올리지 않고, 주소를 틀리지 않게.

여기서 지키려는 것 셋.

  ① 네이버 글 주소를 어떤 모양으로 받아도 같은 글 번호로 읽는다.
     글 번호가 중복 검사와 발행 이력의 열쇠다. 여기서 틀리면 같은 글을
     '다른 글' 로 보고 또 쓴다.
  ② 재시도는 '아무것도 안 올라갔다' 고 확언한 실패에만 한다. 올라갔을지
     모르는 것(uncertain · 임대 만료)은 자동으로 다시 올리지 않는다.
  ③ 본문의 [사진 n] 과 사진 목록이 어긋나면 발행하지 않는다.

표준 라이브러리만 쓴다 — 배포 전 검사는 설치 없이 돈다.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import blog_publish as pb  # noqa: E402

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


# ── ① 주소 읽기 ───────────────────────────────────────────────────────────
URLS = [
    ("https://blog.naver.com/happy_nokyang/223912345678",
     ("https://blog.naver.com/happy_nokyang/223912345678", "happy_nokyang", "223912345678")),
    ("https://m.blog.naver.com/happy_nokyang/223912345678?fromRss=true",
     ("https://blog.naver.com/happy_nokyang/223912345678", "happy_nokyang", "223912345678")),
    ("https://blog.naver.com/PostView.naver?blogId=happy_nokyang&logNo=223912345678&redirect=Dlog",
     ("https://blog.naver.com/happy_nokyang/223912345678", "happy_nokyang", "223912345678")),
    ("https://blog.naver.com/PostView.naver?logNo=223912345678&blogId=happy_nokyang",
     ("https://blog.naver.com/happy_nokyang/223912345678", "happy_nokyang", "223912345678")),
    # 발행기가 '완료' 문장 속에 주소를 섞어 보내도 읽는다
    ("RESULT: PUBLISHED https://blog.naver.com/happy_nokyang/223912345678 (제목 확인함)",
     ("https://blog.naver.com/happy_nokyang/223912345678", "happy_nokyang", "223912345678")),
    # 글 주소가 아닌 것
    ("https://blog.naver.com/happy_nokyang", None),
    ("https://blog.naver.com/PostWriteForm.naver?blogId=happy_nokyang", None),
    ("", None),
    ("발행했습니다", None),
]
for text, want in URLS:
    eq(pb.parse_post_url(text), want, f"주소 읽기 — {text[:50]}")


# ── ② 결과 뒤 상태 ────────────────────────────────────────────────────────
MAX = 3
CASES = [
    ("올렸다",                     dict(result="ok", attempts=1),        "published"),
    ("안 올라갔다 · 1회째",        dict(result="failed", attempts=1),    "queued"),
    ("안 올라갔다 · 2회째",        dict(result="failed", attempts=2),    "queued"),
    ("안 올라갔다 · 3회째(마지막)", dict(result="failed", attempts=3),    "publish_failed"),
    ("올라갔는지 모른다 · 1회째",  dict(result="uncertain", attempts=1), "publish_failed"),
    ("이상한 값",                  dict(result="???", attempts=1),       "publish_failed"),
]
for name, kw, want in CASES:
    eq(pb.decide_after_result(kw["result"], kw["attempts"], MAX), want, f"결과 뒤 — {name}")

# 임대 시한이 지난 것은 몇 번째든 자동으로 다시 올리지 않는다
eq(pb.decide_after_lease_expiry(), "publish_failed", "임대 만료 — 자동 재시도 없음")


# ── ③ 사진 번호와 목록 ───────────────────────────────────────────────────
blocks = [
    {"type": "intro", "text": "9월 첫째 주 맨손체조", "photo_id": ""},
    {"type": "photo", "text": "", "photo_id": "p1"},
    {"type": "caption", "text": "준비 운동", "photo_id": ""},
    {"type": "photo", "text": "", "photo_id": "p2"},
    {"type": "outro", "text": "다음 주에 뵙겠습니다", "photo_id": ""},
]
body, ids = pb.body_for_publish(blocks)
eq(ids, ["p1", "p2"], "사진 순서")
eq("[사진 1]" in body and "[사진 2]" in body, True, "본문 속 번호")
eq(pb.markers_match(body, 2), True, "번호와 목록이 맞음")
eq(pb.markers_match(body, 3), False, "목록이 하나 더 많음")
eq(pb.markers_match(body.replace("[사진 2]", ""), 2), False, "본문에서 번호가 빠짐")
eq(pb.markers_match("사진 없는 글", 0), True, "사진 없음끼리는 맞음")

# 사람이 화면에서 사진 블록을 지웠는데 photo_id 가 남은 경우 — 빈 id 는 세지 않는다
_body2, ids2 = pb.body_for_publish([{"type": "photo", "text": "", "photo_id": ""}])
eq(ids2, [], "빈 photo_id 는 사진이 아니다")

if fails:
    print("❌ 블로그 발행 규칙 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print(f"✅ 블로그 발행 규칙 정상 — 주소 {len(URLS)}건 · 결과 {len(CASES) + 1}건 · 사진 번호 6건")
