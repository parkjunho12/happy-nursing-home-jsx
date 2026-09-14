"""발행기 — Aside 의 말을 잘못 읽어 같은 글을 두 번 올리지 않게.

  ① RESULT 줄이 없으면 '모른다' 다. 실패로 보고 다시 올리면 두 번 올라간다.
  ② 브라우저를 열기도 전에 멈춘 것(Aside 미실행 등)만 '실패' 로 본다.
  ③ 지시문에는 사진 수·파일 이름·제목·본문이 빠짐없이 들어간다.

표준 라이브러리만 쓴다.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from blog_publisher import aside_runner, naver, package, prompt  # noqa: E402

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


# ── ① ② 결과 읽기 ────────────────────────────────────────────────────────
CASES = [
    ("올림", "글을 썼습니다.\nRESULT: PUBLISHED https://blog.naver.com/happy/223900000001\n",
     ("ok", "https://blog.naver.com/happy/223900000001")),
    ("올리지 않음", "로그인 화면이 보입니다.\nRESULT: FAILED 네이버 로그인 필요", ("failed", "네이버 로그인 필요")),
    ("모름", "발행을 눌렀는데 페이지가 안 넘어갑니다\nRESULT: UNCERTAIN 발행 후 주소 확인 실패",
     ("uncertain", "발행 후 주소 확인 실패")),
    ("FAILED 뒤 PUBLISHED → 올림", "RESULT: FAILED 아직\n...\nRESULT: PUBLISHED https://blog.naver.com/happy/223900000002",
     ("ok", "https://blog.naver.com/happy/223900000002")),
    # 올린 뒤에 '실패' 라고 고쳐 말해도 다시 올리지 않는다 — 이 한 줄이 이중 발행을 막는다
    ("PUBLISHED 뒤 FAILED → 그래도 올림", "RESULT: PUBLISHED https://blog.naver.com/happy/223900000003\n주소를 다시 못 읽음\nRESULT: FAILED 주소 확인 실패",
     ("ok", "https://blog.naver.com/happy/223900000003")),
    ("UNCERTAIN 뒤 FAILED → 모름", "RESULT: UNCERTAIN 눌렀는데 모름\nRESULT: FAILED 그냥 실패",
     ("uncertain", "눌렀는데 모름")),
    # 긴 출력 속의 'signed out' 은 브라우저 안에서 한 말일 수 있다 — 모름으로 본다
    ("긴 출력 속 signed out → 모름", "사이드바에 signed out 표시가 있었지만 로그인됨\n" + ("작업 중...\n" * 300),
     ("uncertain", "Aside 가 결과 줄(RESULT:)을 남기지 않았습니다")),
    ("결과 줄 없음 → 모름", "뭔가 했습니다. 끝.", ("uncertain", "Aside 가 결과 줄(RESULT:)을 남기지 않았습니다")),
    ("빈 출력 → 모름", "", ("uncertain", "Aside 가 결과 줄(RESULT:)을 남기지 않았습니다")),
    ("Aside 미실행 → 실패(안전)", "Failed to request daemon auth challenge: fetch failed\nAside isn't running on this machine.",
     ("failed", "Aside 가 브라우저를 열지 못했습니다: Failed to request daemon auth challenge: fetch failed")),
]
for name, out, want in CASES:
    eq(prompt.parse(out), want, f"결과 읽기 — {name}")

eq(prompt.session_id("session ses_01HQ7BABC started"), "ses_01HQ7BABC", "세션 id")
eq(prompt.session_id("no session here"), None, "세션 id 없음")

# ── ③ 지시문 ──────────────────────────────────────────────────────────────
PKG = {
    "draft_id": "d1", "title": "9월 첫째 주 맨손체조",
    "body": "안녕하세요.\n\n[사진 1]\n\n(준비 운동)\n\n[사진 2]\n\n다음 주에 뵙겠습니다.",
    "facility": "위치: 양주시\n전화번호: 031-000-0000",
    "hashtags": ["요양원", "#맨손체조"],
    "photos": [{"no": 1, "url": "https://cdn/1.jpg", "file_name": "01.jpg"},
               {"no": 2, "url": "https://cdn/2.jpg", "file_name": "02.jpg"}],
}
p = prompt.build(PKG, "/Users/me/BlogPublisher/d1", "happy_blog")
for needle, name in [
    ("아이디 happy_blog", "블로그 아이디"),
    ("사진 2장", "사진 수"),
    ("01.jpg, 02.jpg", "파일 이름"),
    ("제목: 9월 첫째 주 맨손체조", "제목"),
    ("[사진 1]", "본문 사진 자리"),
    ("다음 주에 뵙겠습니다.", "본문 끝"),
    ("전화번호: 031-000-0000", "시설 안내"),
    ("#요양원 #맨손체조", "태그(# 하나로)"),
    ("RESULT: PUBLISHED", "결과 규약"),
    ("로그인을 시도하지 말고", "로그인 금지"),
    ("딱 한 번만", "발행 한 번"),
    ("정확히 2장", "발행 전 사진 수 확인"),
]:
    eq(needle in p, True, f"지시문 — {name}")

t = package.post_text(PKG)
eq(t.startswith("제목: 9월 첫째 주 맨손체조"), True, "원고 첫 줄")
eq("태그: #요양원 #맨손체조" in t, True, "원고 태그")

# ── 명령 조립 ─────────────────────────────────────────────────────────────
cmd = aside_runner.command({"aside_bin": "aside", "aside_host": "mini", "aside_account": "u1",
                            "aside_model": "", "aside_effort": "high",
                            "aside_permission": "full-access"}, "P")
eq(cmd, ["aside", "exec", "--host", "mini", "--account", "u1", "--effort", "high",
         "--permission", "full-access", "P"], "aside 명령")

# ── 주소 읽기 ─────────────────────────────────────────────────────────────
eq(naver.parse("https://blog.naver.com/happy/223900000001"), ("happy", "223900000001"), "주소 — 짧은 꼴")
eq(naver.parse("https://blog.naver.com/PostView.naver?logNo=223900000001&blogId=happy"),
   ("happy", "223900000001"), "주소 — 순서 바뀐 쿼리")
eq(naver.parse("https://blog.naver.com/happy"), None, "주소 아님")

if fails:
    print("❌ 발행기 규칙 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print(f"✅ 발행기 규칙 정상 — 결과 읽기 {len(CASES)}건 · 지시문 12건 · 명령 1건 · 주소 3건")
