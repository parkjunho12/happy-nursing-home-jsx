# 편집 에이전트 — AI 페이지 편집기

> 서버에 띄우려면 **[운영 서버에 띄우기](#운영-서버에-띄우기-권장)** 로 바로 가세요.
> 아래 「이 기계에 필요한 것」부터는 개발자 PC에서 직접 돌릴 때의 안내입니다.

Admin 의 **AI 페이지 편집기**에서 접수한 수정 요청을 실제로 수행하는 프로그램입니다.
저장소를 고치고, 검증하고, 미리보기를 띄우고, PR 을 만듭니다.

```
Admin(브라우저)  →  백엔드(접수·상태 보관)  ←  편집 에이전트(여기)
```

백엔드는 소스를 만지지 않습니다. API 컨테이너에 git·셸·Claude CLI 를 넣으면
웹에서 닿는 프로세스가 소스와 배포 열쇠를 쥐게 되고, 사고 한 번이 저장소 전체가 됩니다.
그래서 실제 작업은 이 에이전트가 별도 기계에서 합니다.

---

## 이 기계에 필요한 것

| 도구 | 없으면 |
|---|---|
| **Claude CLI** (로그인됨) | 아무것도 못 고칩니다 |
| **git** | 작업 폴더를 못 만듭니다 |
| **node** (20 이상) | 검증·미리보기가 안 됩니다 |
| **gh** (로그인됨) | 고칠 수는 있지만 **PR 을 못 만듭니다** |

확인:

```bash
cd apps/ai-editor-agent
python3 -m ai_editor_agent info
```

`gh 로그인 ✗` 이면 `gh auth login` 을 먼저 하세요.

---

## 1단계 — 서버에 등록코드 넣기

서버 `.env` 에 한 줄 추가합니다.

```
AI_EDITOR_ENROLL_CODE=<아무도 모르는 긴 문자열>
```

> `.env` 는 이미지에 구워집니다. **재시작이 아니라 다시 빌드**해야 반영됩니다.
> ```
> docker compose build backend && docker compose up -d --force-recreate backend
> ```

> ⚠️ **등록코드를 문서·채팅·로그에 적지 마세요.** 이 저장소는 공개되어 있습니다.

## 2단계 — 서비스 등록

Admin → **AI 페이지 편집기** → 「관리자 화면 등록」 한 번 누르면 끝입니다.
(저장소·경로·검증 명령이 기본값으로 들어갑니다)

## 3단계 — 설정 파일

`apps/ai-editor-agent/config.json`:

```json
{
  "server_url": "https://api.xn--p80bu1t60gba47bg6abm347gsla.com",
  "agent_id": "mac-1",
  "name": "사무실 맥",
  "repo_dir": "/Users/you/.../01_Website",
  "work_dir": "/Users/you/.ai-editor-worktrees"
}
```

- `repo_dir` — 지금 쓰고 있는 작업 폴더를 그대로 적으면 됩니다.
  에이전트는 여기서 **worktree 만 파고**, 이 폴더의 체크아웃은 건드리지 않습니다.
- `work_dir` — 작업용 폴더가 생기는 자리. 저장소 밖에 두세요.
- `config.json` 에는 토큰이 들어갑니다. `.gitignore` 에 이미 있습니다 — **공유하지 마세요.**

## 4단계 — 등록

```bash
python3 -m ai_editor_agent register --code <등록코드>
```

`✓ 등록 완료` 가 나오면 됩니다. 한 번만 하면 됩니다.

## 5단계 — 켜두기

```bash
python3 -m ai_editor_agent run
```

Admin 화면 오른쪽 위에 **「편집 에이전트 1대」**가 초록으로 뜨면 준비 끝입니다.

### 계속 켜두기 (macOS)

```bash
# ~/Library/LaunchAgents/com.happy.ai-editor.plist 를 만들고
launchctl load ~/Library/LaunchAgents/com.happy.ai-editor.plist
```

### 계속 켜두기 (Linux)

`/etc/systemd/system/ai-editor-agent.service`

```ini
[Unit]
Description=AI 페이지 편집기 에이전트
After=network-online.target

[Service]
WorkingDirectory=/opt/happy/apps/ai-editor-agent
ExecStart=/usr/bin/python3 -m ai_editor_agent run
Restart=always
RestartSec=10
User=happy

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now ai-editor-agent
```

---

## 운영 서버에 띄우기 (권장)

개발자 PC를 켜둘 필요 없이, 서버에서 항상 돌게 합니다.

### 1) `infra/.env` 에 값 넣기

> `AI_EDITOR_ENROLL_CODE` 는 **백엔드와 에이전트가 같은 값을 봐야** 등록이 됩니다.
> compose 가 양쪽에 넘겨주므로 `infra/.env` 한 곳만 고치면 되고,
> 백엔드 이미지를 다시 구울 필요는 없습니다(다시 세우기만 하면 됩니다).

```bash
# 필수 — 없으면 배포가 멈춥니다
AI_EDITOR_REPO_URL=https://<GH_TOKEN>@github.com/parkjunho12/happy-nursing-home-jsx.git
AI_EDITOR_ENROLL_CODE=<아무도 모르는 긴 문자열>
ANTHROPIC_API_KEY=sk-ant-...

# PR 을 만들려면 필요 (repo 권한)
GH_TOKEN=ghp_...

# 미리보기를 밖에서 열려면
AI_EDITOR_PREVIEW_BASE=https://preview.행복한요양원녹양역.com
PREVIEW_USER=preview
PREVIEW_PASS_HASH='<아래 명령으로 만든 값>'   # ← 작은따옴표 필수
```

미리보기 비밀번호 해시:

```bash
docker run --rm caddy:2.7-alpine caddy hash-password --plaintext '원하는비밀번호'
```

> **⚠ 해시는 반드시 작은따옴표로 감싸세요.**
> bcrypt 해시에는 `$` 가 세 개 들어갑니다(`$2a$14$...`). 그냥 붙여넣으면
> docker compose 가 이걸 변수로 읽어 값을 잘라먹습니다. 직접 재본 결과:
>
> | .env 에 쓴 방식 | 컨테이너에 들어간 값 |
> |---|---|
> | 그냥 붙여넣기 | `$2a$14` — **잘림** |
> | 큰따옴표 `"..."` | `$2a$14` — **잘림** |
> | **작은따옴표 `'...'`** | **온전함** ✅ |
>
> 잘린 해시가 들어가면 Caddy 는 뜨지만 아무도 못 들어갑니다(401).
> 빈 값(`PREVIEW_PASS_HASH=`)을 넣으면 **Caddy 가 아예 안 떠서 사이트 전체가 내려갑니다.**
> 배포 워크플로가 이 세 가지를 미리 잡아 세웁니다.
>
> 이 줄을 아예 쓰지 않으면 Caddyfile 의 기본 해시가 그대로 삽니다 —
> 아무도 모르는 값이라 안전하게 잠깁니다.

> `PREVIEW_PASS_HASH` 를 넣지 않으면 **아무도 미리보기에 못 들어갑니다.**
> 열려 있는 것보다 닫혀 있는 편이 낫기 때문입니다.
> 개발 서버는 소스 파일(`/src/...`)도 그대로 내려주므로 반드시 막아야 합니다.

### 2) DNS

`preview.행복한요양원녹양역.com` 을 서버 IP로 향하게 합니다(A 레코드).
Caddy 가 인증서를 알아서 받습니다.

### 3) 배포

`main` 에 올라가면 **Deploy AI Editor Agent to VPS** 가 자동으로 돕니다.
손으로 돌리려면 GitHub → Actions → 그 워크플로 → Run workflow.

### 4) 확인

Admin → AI 페이지 편집기 → 오른쪽 위 **「편집 에이전트 1대」**가 초록이면 끝입니다.

```bash
# 서버에서
docker compose logs -f ai-editor
docker compose ps ai-editor
```

### 서버에서 알아둘 것

| | |
|---|---|
| **메모리** | 컨테이너를 4GB로 묶었습니다(서버 8GB · gna_2.8_n). 한 작업이 Claude CLI + tsc + vite build + 미리보기 서버를 동시에 띄우면 3GB 근처까지 갑니다 |
| **CPU** | 1코어로 묶었습니다. 코어가 둘뿐이라 하나는 실서비스 몫으로 남깁니다 — 편집이 느려지는 편이, 어르신 화면이 멈추는 것보다 낫습니다 |
| **디스크** | 저장소 클론 + node_modules + worktree 로 5GB 안팎 씁니다(50GB 중). 작업 폴더는 최근 5개만 남기고 지웁니다 |
| **첫 작업** | 의존성 설치로 5~10분 걸립니다. 그 뒤로는 빠릅니다 |
| **끄기** | `docker compose stop ai-editor` — 다른 서비스는 이것을 필요로 하지 않습니다 |

---

## 어떻게 도는가

1. **claim** — 서버에서 급한 작업부터 하나 가져옵니다
2. **worktree** — `ai/<서비스>-<번호>` 브랜치로 전용 폴더를 팝니다
3. **claude** — 화면에서 고른 요소의 **파일:줄:칸**을 프롬프트에 넣고 고치게 합니다
4. **검증** — 레지스트리에 적힌 명령을 순서대로 돌립니다
   (기본값은 배포 워크플로와 같은 `tsc` → `test` → `build`)
5. **미리보기** — 빈 포트에 개발 서버를 띄웁니다 (`VITE_INSPECTOR=1`)
6. **대기** — Admin 에서 사람이 보고 승인할 때까지 `PREVIEW` 로 둡니다
7. **PR / 병합** — 승인되면 push → `gh pr create` (→ 병합)
8. **배포** — 병합되면 **기존 GitHub Actions** 가 그대로 배포합니다.
   배포 경로를 새로 만들지 않았습니다

## 지키는 것

- `git reset --hard`, `stash`, 공유 브랜치 직접 수정 — **하지 않습니다**
- 사람이 쓰는 폴더의 체크아웃을 바꾸지 않습니다
- 레지스트리의 `root_path` 밖은 고치지 않습니다 (프롬프트에서 못박고, 리뷰에서 diff 로 확인)
- 검증을 통과하지 못하면 승인 버튼이 잠깁니다
- 「작업 중지」는 **돌던 명령을 죽이지 않고** 다음 단계 전에 멈춥니다.
  반쯤 고쳐진 파일이 남는 것보다 한 단계를 마치고 멈추는 편이 뒤처리가 깨끗합니다
- 되돌리기는 커밋을 지우지 않고 **revert PR** 을 만듭니다

## 문제 해결

| 증상 | 원인 · 할 일 |
|---|---|
| 「편집 에이전트 0대」 | `run` 이 꺼져 있습니다. 로그를 보세요 |
| 접수했는데 안 움직임 | 에이전트가 다른 작업 중이거나 꺼져 있습니다 |
| `등록코드가 설정돼 있지 않습니다` | 서버 `.env` 미설정 — **이미지 재빌드**가 필요합니다 |
| 검증에서 계속 실패 | 요청이 모호합니다. 「변경안 분석」으로 먼저 보세요 |
| PR 이 안 만들어짐 | `gh auth login` 이 안 되어 있습니다 |
| 미리보기가 안 뜸 | 첫 실행은 의존성 설치로 오래 걸립니다. 로그를 보세요 |
| 작업 폴더가 쌓임 | 최근 5개만 남기고 자동으로 지웁니다 (`keep_worktrees`) |

## 로그

```bash
# 직접 실행
python3 -m ai_editor_agent run

# systemd
sudo journalctl -u ai-editor-agent -f
```
