# 블로그 발행기 설치 작업 지시서 (Mac)

이 폴더에서 Claude Code 를 실행했다면, 당신은 **네이버 블로그 발행용 Mac 앞에 앉아 있다.**
목표는 이 Mac 을 켜 두면 Admin 에서 「네이버에 발행」을 누른 글이 Aside 브라우저를
통해 자동으로 올라가게 해 놓고 가는 것이다.

```
Admin(검토 → 발행)  →  서버(발행 줄)  →  이 Mac 의 발행기  →  Aside 브라우저  →  blog.naver.com
```

---

## 절대 하지 말 것

1. **네이버 비밀번호를 어디에도 적지 않는다.** 로그인은 사람이 Aside 브라우저 창에서
   직접 한다. 발행기도 Aside 도 비밀번호를 받지 않는다.
2. **발행기 토큰을 로그·채팅·파일에 남기지 않는다.** `~/.blog-publisher/config.json` 에만
   있다. 이 리포는 공개되어 있으므로 어떤 파일에도 실제 값을 적지 않는다.
3. **시험 삼아 글을 올리지 않는다.** 발행은 되돌릴 수 없다. `once` 는 Admin 에서 실제로
   「네이버에 발행」을 누른 글이 있을 때만 무언가를 올린다 — 시험은 `check` 와 `dry-run` 으로 한다.
4. **Aside 브라우저의 다른 로그인·탭·작업을 건드리지 않는다.** 이 Mac 을 다른 일에도
   쓰고 있을 수 있다. 발행 전용 Aside 프로필을 따로 두는 것을 권한다.
5. 사람 확인 없이 **재부팅하지 않는다.**

---

## 시작 전에 사람에게 물어볼 것

| 물어볼 것 | 예시 | 비고 |
|---|---|---|
| 발행기 토큰 | (관리자에게 받는다) | 서버 `infra/.env` 의 `BLOG_PUBLISHER_TOKEN`. **어디에도 남기지 않는다** |
| 네이버 블로그 아이디 | `happy_nokyang` | `https://blog.naver.com/<이것>` |
| 이 발행기 이름 | `사무실 맥미니` | Admin 화면에 보이는 이름 |
| Aside 프로필 | `u0` 또는 비움 | 네이버에 로그인해 둘 Aside 프로필. `aside account list` 로 본다 |

서버 주소는 이미 정해져 있다:
```
https://api.xn--p80bu1t60gba47bg6abm347gsla.com
```

---

## 순서대로 실행

각 단계는 **성공 판정 기준**이 있다. 통과하지 못하면 다음으로 넘어가지 않는다.

### 1단계 — 실행 환경

```bash
sw_vers -productVersion     # 15.0 이상이어야 Aside 가 돈다
python3 --version           # 3.9 이상
```

### 2단계 — Aside 설치와 로그인 (사람이 한다)

1. https://aside.com/download 에서 받아 설치하고 실행한다.
2. Aside 계정으로 로그인한다(없으면 앱 안에서 만든다).
3. **Aside 브라우저 안에서** https://blog.naver.com 에 네이버 계정으로 로그인한다.
   '로그인 상태 유지' 를 켠다. 글쓰기 버튼이 보이는지 확인한다.

**성공 판정:** Aside 브라우저에서 `https://blog.naver.com/<블로그 아이디>/postwrite` 가 로그인 없이 열린다.

### 3단계 — Aside CLI

```bash
curl -fsSL https://releases.aside.com/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"   # 셸 설정 파일에도 넣는다
aside --version
aside account status
```

**성공 판정:** `aside account status` 가 로그인된 계정을 보여준다.
"Aside isn't running" 이 나오면 2단계의 Aside 앱이 켜져 있는지 본다.

### 4단계 — 발행기 설정

```bash
cd ~/happy_admin/apps/blog-publisher       # 이 폴더
python3 tests/test_prompt.py               # 규칙 검사 — ✅ 가 나와야 한다
python3 -m blog_publisher setup            # 토큰·블로그 아이디·이름·프로필을 넣는다
python3 -m blog_publisher check
```

**성공 판정:** `check` 가 `Aside CLI: <버전>` 과 `서버: 연결됨` 을 찍는다.
Admin → 블로그 자동 초안 화면 머리에 "발행기 연결됨 · <이름>" 이 보인다.

### 5단계 — 지시문 확인 (글을 올리지 않는다)

```bash
cat > /tmp/pkg.json <<'EOF'
{"draft_id":"dry","title":"시험 제목","body":"첫 문단\n\n[사진 1]\n\n(설명)\n\n끝","facility":"위치: …",
 "hashtags":["요양원"],"photos":[{"no":1,"url":"https://example.com/1.jpg","file_name":"01.jpg"}]}
EOF
python3 -m blog_publisher dry-run /tmp/pkg.json
```

**성공 판정:** 지시문에 블로그 아이디·사진 수·`RESULT:` 규약이 들어 있고, 맨 아래 `aside exec … --permission full-access` 명령이 보인다.

### 6단계 — 상시 실행 (launchd)

```bash
sed -e "s#__HOME__#$HOME#g" -e "s#__PYTHON__#$(which python3)#g" \
  launchd/com.happy.blog-publisher.plist > ~/Library/LaunchAgents/com.happy.blog-publisher.plist
mkdir -p ~/BlogPublisher
launchctl load ~/Library/LaunchAgents/com.happy.blog-publisher.plist
sleep 5; tail -n 20 ~/BlogPublisher/publisher.log
```

**성공 판정:** 로그에 `blog-publisher 0.1.0 시작` 이 찍히고, Admin 의 발행기 표시가 "연결됨" 으로 유지된다.
Mac 은 잠자기에 들어가지 않게 둔다(시스템 설정 → 에너지 → 디스플레이가 꺼져도 자동으로 잠자기 방지).

### 7단계 — 첫 발행은 사람이 지켜본다

Admin 에서 검토가 끝난 초안 하나를 「네이버에 발행」한다. 5분 안에 이 Mac 의 Aside 가
글쓰기 화면을 열고 사진을 넣는 것이 보인다. 끝나면 Admin 에 "발행됨" 과 글 주소가 뜬다.

`~/BlogPublisher/<draft_id>/attempt-<n>/aside.log` 에 Aside 가 한 말이 전부 남는다. 잘못 올라갔으면
네이버에서 글을 지우고, Admin 발행 이력에서도 지운다.

---

## 끝내기 전에 남길 것

- Admin 발행기 표시가 "연결됨" 인 것 (스크린샷 대신 말로)
- 어느 Aside 프로필(`aside_account`)이 네이버에 로그인돼 있는지
- launchd 가 로그인 세션에서 돈다는 것 — 이 Mac 에서 로그아웃하면 발행기도 멈춘다
