#!/usr/bin/env python3
"""회의록(텍스트) + 사진들을 내부공지로 업로드한다.

카카오톡 대화 내보내기를 Claude 가 정리한 뒤 이 스크립트로 올리는 용도.
표준 라이브러리만 사용 — venv 없이 python3 로 바로 실행 가능.

사용:
    python3 upload_meeting.py --title "9월 직원회의" --content-file 회의록.txt \
        --photos-dir ~/Documents/01_행복한요양원/회의록 [--push] [--pinned] [--public]

인증: 환경변수 HAPPY_ADMIN_ID / HAPPY_ADMIN_PW,
      없으면 ~/.happy/credentials.env (KEY=VALUE 형식) 에서 읽는다.
"""
import argparse
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

DEFAULT_API = "https://api.xn--p80bu1t60gba47bg6abm347gsla.com"
CRED_FILE = Path.home() / ".happy" / "credentials.env"
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}
MAX_SIZE = 10 * 1024 * 1024  # 서버 upload-image 제한과 동일


def load_creds() -> tuple[str, str]:
    ident = os.environ.get("HAPPY_ADMIN_ID", "")
    pw = os.environ.get("HAPPY_ADMIN_PW", "")
    if not (ident and pw) and CRED_FILE.exists():
        for line in CRED_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k == "HAPPY_ADMIN_ID" and not ident:
                ident = v
            elif k == "HAPPY_ADMIN_PW" and not pw:
                pw = v
    if not (ident and pw):
        sys.exit(
            "오류: 관리자 계정 정보가 없습니다.\n"
            "환경변수 HAPPY_ADMIN_ID / HAPPY_ADMIN_PW 를 설정하거나,\n"
            f"{CRED_FILE} 파일에 아래 두 줄을 넣어주세요 (chmod 600 권장):\n"
            "  HAPPY_ADMIN_ID=아이디\n  HAPPY_ADMIN_PW=비밀번호"
        )
    return ident, pw


def request_json(url: str, *, method: str = "GET", token: str | None = None,
                 body: bytes | None = None, content_type: str | None = None) -> dict:
    req = urllib.request.Request(url, data=body, method=method)
    if content_type:
        req.add_header("Content-Type", content_type)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail).get("detail", detail)
        except Exception:
            pass
        sys.exit(f"오류: {method} {url} → HTTP {e.code}: {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"오류: 서버에 연결할 수 없습니다 ({url}): {e.reason}")


def login(base: str, ident: str, pw: str) -> str:
    data = json.dumps({"login_id": ident, "password": pw}).encode("utf-8")
    out = request_json(f"{base}/api/v1/auth/login", method="POST",
                       body=data, content_type="application/json")
    token = out.get("access_token") or (out.get("data") or {}).get("access_token")
    if not token:
        sys.exit(f"오류: 로그인 응답에 access_token 이 없습니다: {out}")
    return token


def upload_image(base: str, token: str, path: Path) -> str:
    data = path.read_bytes()
    if len(data) > MAX_SIZE:
        sys.exit(f"오류: {path.name} 이(가) 10MB 를 넘습니다 ({len(data)/1024/1024:.1f}MB).")
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: {ctype}\r\n\r\n"
    ).encode("utf-8") + data + f"\r\n--{boundary}--\r\n".encode("utf-8")
    out = request_json(f"{base}/api/v1/admin/notices/upload-image", method="POST",
                       token=token, body=body,
                       content_type=f"multipart/form-data; boundary={boundary}")
    url = (out.get("data") or {}).get("url")
    if not url:
        sys.exit(f"오류: 이미지 업로드 응답에 url 이 없습니다: {out}")
    return url


def collect_photos(photo_args: list[str], photos_dir: str | None) -> list[Path]:
    paths: list[Path] = [Path(p).expanduser() for p in photo_args]
    if photos_dir:
        d = Path(photos_dir).expanduser()
        if not d.is_dir():
            sys.exit(f"오류: 사진 폴더가 없습니다: {d}")
        paths += sorted(p for p in d.iterdir()
                        if p.is_file() and p.suffix.lower() in ALLOWED_EXT)
    seen: set[Path] = set()
    out: list[Path] = []
    for p in paths:
        p = p.resolve()
        if p in seen:
            continue
        seen.add(p)
        if not p.is_file():
            sys.exit(f"오류: 사진 파일이 없습니다: {p}")
        if p.suffix.lower() not in ALLOWED_EXT:
            sys.exit(f"오류: 허용되지 않는 이미지 형식입니다: {p.name}")
        out.append(p)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="회의록 + 사진을 내부공지로 업로드")
    ap.add_argument("--title", required=True, help="공지 제목")
    ap.add_argument("--content-file", help="본문 텍스트 파일 (일반 텍스트, 마크다운 아님)")
    ap.add_argument("--content", help="본문을 직접 지정 (--content-file 대신)")
    ap.add_argument("--photo", action="append", default=[], help="사진 파일 (여러 번 지정 가능)")
    ap.add_argument("--photos-dir", help="폴더 안의 이미지 전부 업로드 (이름순)")
    ap.add_argument("--level", default="info", choices=["info", "important", "urgent"])
    ap.add_argument("--pinned", action="store_true", help="상단 고정")
    ap.add_argument("--public", action="store_true", help="로그인 없이 링크 열람 허용")
    ap.add_argument("--push", action="store_true", help="직원앱 푸시 발송 (기본: 발송 안 함)")
    ap.add_argument("--api-base", default=os.environ.get("HAPPY_API_BASE", DEFAULT_API))
    ap.add_argument("--dry-run", action="store_true", help="업로드 없이 내용만 확인")
    args = ap.parse_args()

    if args.content_file:
        content = Path(args.content_file).expanduser().read_text(encoding="utf-8").strip()
    else:
        content = (args.content or "").strip()
    photos = collect_photos(args.photo, args.photos_dir)
    base = args.api_base.rstrip("/")

    print(f"제목   : {args.title}")
    print(f"등급   : {args.level}  고정={args.pinned}  공개링크={args.public}  푸시={args.push}")
    print(f"본문   : {len(content)}자")
    print(f"사진   : {len(photos)}장" + ("".join(f"\n  - {p.name}" for p in photos)))
    print(f"서버   : {base}")
    if args.dry_run:
        print("\n--dry-run: 여기까지. 업로드하지 않았습니다.")
        return

    ident, pw = load_creds()
    token = login(base, ident, pw)
    print("로그인 OK")

    urls = []
    for i, p in enumerate(photos, 1):
        url = upload_image(base, token, p)
        urls.append(url)
        print(f"사진 업로드 {i}/{len(photos)}: {p.name} → {url}")

    payload = {
        "title": args.title,
        "content": content or None,
        "level": args.level,
        "pinned": args.pinned,
        "public": args.public,
        "push": args.push,
        "image_url": urls[0] if urls else None,
        "content_images": urls or None,
    }
    out = request_json(f"{base}/api/v1/admin/notices", method="POST", token=token,
                       body=json.dumps(payload).encode("utf-8"),
                       content_type="application/json")
    data = out.get("data") or {}
    print(f"\n공지 등록 완료 — id: {data.get('id')}")
    if args.push:
        print(f"푸시 결과: {data.get('push')}")


if __name__ == "__main__":
    main()
