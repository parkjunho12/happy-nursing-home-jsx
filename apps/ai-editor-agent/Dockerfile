# AI 페이지 편집기 — 편집 에이전트
#
# 이 컨테이너가 하는 일은 '소스를 고치고 검증하는 것' 이다.
# 그래서 백엔드와 달리 git·node·pnpm·gh·Claude CLI 가 모두 필요하다.
# 백엔드 이미지에 이것들을 넣지 않은 이유가 그대로 여기 있다 —
# 웹에서 닿는 API 프로세스와, 소스를 고치는 프로세스를 갈라 둔다.
FROM node:20-bookworm-slim

# git    : worktree 를 판다
# python3: 에이전트 본체
# gh     : PR 을 만든다
# ripgrep: Claude 가 코드를 훑을 때 쓴다(없으면 느려진다)
# ca-certificates/curl: gh 설치와 HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends \
      git python3 python3-venv ca-certificates curl gnupg ripgrep less \
    && mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
         | gpg --dearmor -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
         > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Claude CLI · pnpm — 버전을 고정한다. 어느 날 갑자기 동작이 달라지면
# 원인을 찾는 데 하루가 간다.
RUN npm install -g @anthropic-ai/claude-code@2.1.221 pnpm@10.29.3 \
    && claude --version && pnpm --version

WORKDIR /app
COPY ai_editor_agent ./ai_editor_agent

# 작업 폴더는 볼륨으로 받는다(컨테이너를 다시 만들어도 남아 있게).
#   /repo  — 저장소 클론. 여기서 worktree 를 판다
#   /work  — worktree 가 생기는 자리
ENV AI_EDITOR_CONFIG=/data/config.json \
    PYTHONUNBUFFERED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# 컨테이너를 루트로 돌리지 않는다. 소스를 고치는 프로세스라 더더욱.
RUN useradd -m -u 10001 editor \
    && mkdir -p /data /repo /work \
    && chown -R editor:editor /app /data /repo /work
USER editor

COPY --chown=editor:editor docker-entrypoint.sh /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["run"]
