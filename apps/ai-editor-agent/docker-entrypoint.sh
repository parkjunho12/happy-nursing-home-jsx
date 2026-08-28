#!/bin/sh
# 편집 에이전트 컨테이너 시작 절차.
#
# 매번 처음부터 다시 하지 않는다 — 저장소는 한 번 클론하고 이후엔 fetch 만,
# 설정 파일도 이미 있으면 그대로 쓴다. 컨테이너를 다시 만들어도
# /data 와 /repo 볼륨이 남아 있어 등록 토큰과 클론을 잃지 않는다.
set -e

REPO_DIR=${REPO_DIR:-/repo}
WORK_DIR=${WORK_DIR:-/work}
CONFIG=${AI_EDITOR_CONFIG:-/data/config.json}

say() { echo "[ai-editor] $*"; }

# ── 필수값 확인 — 없는 채로 돌면 작업을 받아놓고 전부 실패한다 ──
: "${AI_EDITOR_SERVER_URL:?AI_EDITOR_SERVER_URL 이 필요합니다}"
: "${AI_EDITOR_REPO_URL:?AI_EDITOR_REPO_URL 이 필요합니다}"

if [ -z "$ANTHROPIC_API_KEY" ] && [ ! -d "$HOME/.claude" ]; then
  say "⚠ ANTHROPIC_API_KEY 가 없습니다. Claude 가 코드를 고칠 수 없습니다."
  say "  infra/.env 에 ANTHROPIC_API_KEY 를 넣어주세요."
fi

# ── 저장소 ──
if [ ! -d "$REPO_DIR/.git" ]; then
  say "저장소를 처음 가져옵니다 — $AI_EDITOR_REPO_URL"
  git clone --no-single-branch "$AI_EDITOR_REPO_URL" "$REPO_DIR"
else
  say "저장소 최신화"
  git -C "$REPO_DIR" remote set-url origin "$AI_EDITOR_REPO_URL" || true
  git -C "$REPO_DIR" fetch --prune origin || say "⚠ fetch 실패 — 캐시로 진행"
fi
# 클론 직후 작업본이 비어 있을 수 있다(원격의 기본 브랜치가 다른 경우).
# 에이전트는 origin/<브랜치> 만 보고 worktree 를 파므로 동작에는 지장이 없지만,
# 로그와 문제 해결이 헷갈린다. 있는 브랜치 하나를 꺼내 둔다.
if ! git -C "$REPO_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  for b in main develop master; do
    if git -C "$REPO_DIR" rev-parse --verify "origin/$b" >/dev/null 2>&1; then
      say "작업본이 비어 있어 $b 를 꺼냅니다"
      git -C "$REPO_DIR" checkout -q -B "$b" "origin/$b"
      break
    fi
  done
fi

# 커밋을 남기려면 누구인지 알려야 한다
git -C "$REPO_DIR" config user.name  "${GIT_AUTHOR_NAME:-AI 페이지 편집기}"
git -C "$REPO_DIR" config user.email "${GIT_AUTHOR_EMAIL:-ai-editor@happy.local}"
git -C "$REPO_DIR" config --global --add safe.directory "$REPO_DIR" 2>/dev/null || true

# ── gh 로그인 — 토큰이 있으면 PR 을 만들 수 있다 ──
if [ -n "$GH_TOKEN" ]; then
  say "gh 인증 확인"
  if gh auth status >/dev/null 2>&1; then
    # git push 도 이 토큰으로 하게 만든다.
    #
    # 이렇게 하지 않으면 저장소 주소에 토큰을 박아 넣어야 하는데
    # (https://<토큰>@github.com/...), 그러면 토큰이 /repo 볼륨의
    # .git/config 에 평문으로 남는다. 볼륨은 컨테이너를 지워도 남는다.
    # 여기서는 토큰이 환경변수에만 있고 디스크에 떨어지지 않는다.
    gh auth setup-git >/dev/null 2>&1 \
      && say "git push 인증 준비 완료" \
      || say "⚠ gh auth setup-git 실패 — 브랜치를 밀지 못할 수 있습니다"

    # 밀 수 있는 토큰인지 지금 확인한다.
    #
    # 인증이 됐다고 밀 수 있는 것이 아니다. 권한이 모자란 토큰은 로그인은
    # 되고 push 에서만 403 으로 막힌다. 그걸 작업 끝에서 알면 Claude 를
    # 돌리고 검증까지 마친 시간이 통째로 버려진다. 여기서 미리 말한다.
    slug=$(printf '%s' "$AI_EDITOR_REPO_URL" \
             | sed -E 's#^.*github\.com[:/]+##; s#\.git$##; s#/$##')
    scopes=$(gh api -i user 2>/dev/null \
               | sed -n 's/^[Xx]-[Oo][Aa]uth-[Ss]copes: *//p' | tr -d '\r' | head -1)
    say "저장소 $slug · 토큰 권한: ${scopes:-(fine-grained 토큰이거나 표시되지 않음)}"

    # 실제로 미는 길을 그대로 두드려본다.
    #
    # 처음에는 gh api repos/<slug> 의 permissions.push 를 봤는데 그건
    # '토큰' 이 아니라 '계정' 의 권한이라, 저장소 주인이면 권한이 모자란
    # 토큰으로도 true 가 나온다. 실제로 그래서 '쓰기 권한 확인됨' 을 찍어놓고
    # 정작 push 는 403 으로 막혔다.
    #
    # --dry-run 은 서버에 receive-pack 을 요청해 권한까지 확인하지만
    # 브랜치를 만들지는 않는다(확인함).
    if git -C "$REPO_DIR" push --dry-run origin \
         "HEAD:refs/heads/ai/__permcheck__" >/dev/null 2>&1; then
      say "쓰기 권한 확인됨 — 브랜치를 밀 수 있습니다"
    else
      say "❌ 이 토큰으로는 $slug 에 밀 수 없습니다 (push 권한 없음)."
      say "   수정과 검증은 되지만, PR 을 만드는 마지막 단계에서 403 으로 막힙니다."
      say "   classic 토큰이면 'repo' 를, fine-grained 면 이 저장소에"
      say "   Contents: Read and write + Pull requests: Read and write 를 주세요."
    fi
  else
    say "⚠ gh 인증 실패 — 토큰을 확인해주세요. PR 을 만들 수 없습니다"
  fi
else
  say "⚠ GH_TOKEN 이 없습니다. 수정·검증은 되지만 PR 을 만들 수 없습니다."
fi

# ── 설정 파일 ──
if [ ! -f "$CONFIG" ]; then
  say "설정 파일을 만듭니다 — $CONFIG"
  cat > "$CONFIG" <<EOF
{
  "server_url": "$AI_EDITOR_SERVER_URL",
  "agent_id": "${AI_EDITOR_AGENT_ID:-vps-1}",
  "name": "${AI_EDITOR_AGENT_NAME:-운영 서버}",
  "repo_dir": "$REPO_DIR",
  "work_dir": "$WORK_DIR",
  "preview_host": "0.0.0.0",
  "preview_base": "${AI_EDITOR_PREVIEW_BASE:-}",
  "preview_port": ${AI_EDITOR_PREVIEW_PORT:-4310}
}
EOF
fi

# ── 등록 — 토큰이 없을 때만. 이미 등록돼 있으면 건너뛴다 ──
if ! grep -q '"agent_token"' "$CONFIG" 2>/dev/null; then
  if [ -n "$AI_EDITOR_ENROLL_CODE" ]; then
    say "서버에 등록합니다"
    python3 -m ai_editor_agent register --code "$AI_EDITOR_ENROLL_CODE" \
      || say "⚠ 등록 실패 — 등록코드를 확인해주세요"
  else
    say "⚠ AI_EDITOR_ENROLL_CODE 가 없어 등록할 수 없습니다."
  fi
fi

python3 -m ai_editor_agent info || true
say "시작합니다"
exec python3 -m ai_editor_agent "$@"
