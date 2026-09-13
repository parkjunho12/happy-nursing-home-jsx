# 블로그 발행기 (blog-publisher)

검토가 끝난 블로그 초안을 **Aside 브라우저**로 네이버에 올리는 프로그램.
Aside 가 깔린 Mac 에서 돈다. 사람이 하는 일은 Aside 안에서 네이버에 한 번
로그인해 두는 것, 그리고 Admin 에서 초안을 검토해 「네이버에 발행」을 누르는 것.

```
Admin(검토 → 발행)  →  서버(발행 줄)  →  이 Mac  →  Aside 브라우저  →  blog.naver.com
                                         ↑ 5분마다 '발행할 것 있나' 묻는다
```

## 왜 이런 모양인가

- 네이버는 공식 글쓰기 API 가 없다. 로그인한 브라우저에서 글쓰기 화면을 조작하는
  수밖에 없고, 그 브라우저는 서버(리눅스)에 없다. Aside 는 macOS 에서만 돈다.
- 그래서 서버는 "발행할 것" 을 줄 세우기만 하고, 실제 발행은 이 Mac 이 가져가서 한다.
  Mac 이 꺼져 있으면 줄에 서 있다가 켜지면 나간다.
- 발행은 되돌릴 수 없다. 그래서 **모르면 모른다고 보고한다.** Aside 가 발행 버튼을
  눌렀는지 확실치 않은 상황(시간 초과 · 결과 줄 없음)은 `uncertain` 으로 보내고,
  서버는 그런 글을 자동으로 다시 올리지 않는다. 사람이 네이버를 보고 「다시 발행」을 누른다.

## 한 편이 처리되는 흐름

1. `POST /api/v1/admin/blog-drafts/publisher/next` — 줄에서 한 편 가져온다(서버가 30분 임대를 건다)
2. 가린 사진 N장과 원고를 `~/BlogPublisher/<draft_id>/attempt-<n>/` 에 내려받는다(시도마다 따로 — 앞선 시도의 로그를 지우지 않는다)
3. `aside exec --permission full-access "<지시문>"` — Aside 가 글쓰기 화면에 제목·본문·사진·태그를 넣고 발행한다
4. Aside 출력의 `RESULT:` 줄을 읽는다 — `PUBLISHED <주소>` / `FAILED <이유>` / `UNCERTAIN <이유>`. 여럿이면 '다시 올리지 않는 쪽'(PUBLISHED > UNCERTAIN > FAILED)으로 읽는다
5. 올렸으면 글 페이지(PostView)를 직접 열어 제목이 보이는지 확인한다
6. `POST /publisher/<id>/result` — 서버가 상태를 바꾸고 발행 이력(중복 검사 기준)에 넣는다

지시문 전문은 `blog_publisher/prompt.py` 에 있다. Aside 에게 "로그인 화면이면
로그인하지 말고 FAILED", "발행 버튼은 확인 후 한 번만", "발행 대신 임시저장으로
끝내지 말 것" 을 못박아 둔다.

## 설치 (Mac)

`CLAUDE.md` 가 단계별 지시서다. 요약:

```bash
# 1. Aside — https://aside.com/download 에서 받아 설치, 실행, Aside 계정 로그인
#    Aside 브라우저 안에서 https://blog.naver.com 에 로그인해 둔다 (로그인 유지 체크)
# 2. Aside CLI
curl -fsSL https://releases.aside.com/install.sh | bash
aside --version && aside account status
# 3. 발행기
git clone <이 저장소> ~/happy_admin && cd ~/happy_admin/apps/blog-publisher
python3 -m blog_publisher setup      # 서버 주소 · 발행기 토큰 · 네이버 블로그 아이디
python3 -m blog_publisher check      # Aside · 서버 연결 점검
python3 -m blog_publisher once       # 발행할 것이 있으면 한 편 올려 본다
# 4. 상시 실행 (launchd)
sed -e "s#__HOME__#$HOME#g" -e "s#__PYTHON__#$(which python3)#g" \
  launchd/com.happy.blog-publisher.plist > ~/Library/LaunchAgents/com.happy.blog-publisher.plist
launchctl load ~/Library/LaunchAgents/com.happy.blog-publisher.plist
tail -f ~/BlogPublisher/publisher.log
```

의존성은 없다 — Python 3.9+ 표준 라이브러리만 쓴다.

## 설정

`~/.blog-publisher/config.json` (`setup` 이 만든다). 환경변수 `BLOG_PUBLISHER_<KEY>` 가 있으면 그것이 이긴다.

| 키 | 뜻 | 기본 |
|---|---|---|
| `server_url` | 서버 주소 | 운영 서버 |
| `publisher_token` | 서버 `.env` 의 `BLOG_PUBLISHER_TOKEN` 과 같은 값 | (필수) |
| `publisher_name` | Admin 에 보일 이름 | 이 Mac 의 호스트명 |
| `naver_blog_id` | `https://blog.naver.com/<이것>` | (필수) |
| `aside_bin` | Aside CLI 경로 | `aside` |
| `aside_host` | 다른 Mac / Aside Cloud 에서 돌릴 때 (`aside host list`) | 이 Mac |
| `aside_account` | 네이버에 로그인해 둔 Aside 프로필 (`u0`, `u1`…) | 기본 프로필 |
| `aside_model` / `aside_effort` | 모델 · 사고 수준 | Aside 기본 / `high` |
| `aside_permission` | `full-access` (사진 폴더를 읽어야 한다. `guard` 는 무인 실행에서 승인을 기다리다 멈춘다) | `full-access` |
| `aside_timeout_seconds` | 한 편에 허용하는 시간 | 1500 (25분) |
| `poll_seconds` | 서버에 묻는 간격 | 300 |
| `work_dir` | 사진·원고·로그 폴더 | `~/BlogPublisher` |
| `keep_days` | 작업 폴더 보관 | 14 |

서버 쪽은 `infra/.env` 에 `BLOG_PUBLISHER_TOKEN=<긴 무작위 문자열>` 을 넣고 backend 를
다시 띄운다. 토큰이 비어 있으면 발행기 API 는 503 으로 닫혀 있다.

## 명령

```
python3 -m blog_publisher setup            설정 파일 만들기
python3 -m blog_publisher check            Aside · 서버 점검
python3 -m blog_publisher once             한 편 처리하고 끝
python3 -m blog_publisher run              계속 돌기 (launchd 용)
python3 -m blog_publisher dry-run pkg.json 서버 없이 지시문만 만들어 본다
python3 -m blog_publisher info             설정 보기
python3 tests/test_prompt.py               규칙 검사 (설치 없이)
```

## 문제가 생기면

| 증상 | 볼 곳 |
|---|---|
| Admin 에 "발행기가 아직 연결되지 않았습니다" | `python3 -m blog_publisher check` — 토큰 · 서버 주소 |
| `RESULT: FAILED 네이버 로그인 필요` | Aside 브라우저에서 blog.naver.com 에 다시 로그인 (`aside_account` 프로필이 맞는지) |
| "Aside isn't running on this machine" | Aside 앱을 켠다. launchd 는 로그인 세션에서 돌아야 한다 |
| 발행 실패 · "올라갔는지 확인" | `~/BlogPublisher/<draft_id>/attempt-<n>/aside.log` 에 Aside 가 한 말이 전부 있다. 네이버에서 글이 있는지 본 뒤 Admin 에서 「다시 발행」 |
| 사진이 안 들어감 | `aside_permission` 이 `full-access` 인지. `work_dir` 이 Aside 가 읽을 수 있는 폴더인지 |

## 지키는 것

- **원본 사진은 이 Mac 에 오지 않는다.** 서버가 얼굴을 가린 파생본만 준다.
- **토큰은 `config.json` 에만.** `.gitignore` 에 있다. 로그·채팅에 적지 않는다.
- **같은 글을 두 번 올리지 않는다.** 결과를 모르면 사람에게 넘긴다.
- **Aside 가 네이버 외 다른 사이트에 가거나 다른 글을 건드리지 않게** 지시문에 못박아 둔다. 그래도 Aside 브라우저는 사람이 로그인해 둔 계정이므로, 발행 전용 Aside 프로필(`aside_account`)을 따로 두는 편이 안전하다.
