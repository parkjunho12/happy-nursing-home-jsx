"""블로그 발행기 — 실행 진입점.

  python -m blog_publisher setup            # 설정 파일 만들기(대화형)
  python -m blog_publisher check            # 서버·Aside·네이버 로그인 점검
  python -m blog_publisher once             # 발행할 것이 있으면 한 편 올리고 끝
  python -m blog_publisher run              # 계속 돌기(launchd 로 띄운다)
  python -m blog_publisher dry-run <json>   # 서버 없이 지시문만 만들어 본다
  python -m blog_publisher info

■ 한 편의 흐름

  서버 /publisher/next  →  사진·원고 내려받기  →  aside exec  →  결과 줄 읽기
  →  (올렸으면) 글 페이지 열어 제목 확인  →  서버 /publisher/<id>/result

■ 모르면 모른다고 한다

  Aside 가 발행 버튼을 눌렀는지 모르는 상황(시간 초과 · 결과 줄 없음)은
  uncertain 으로 보낸다. 서버는 그런 글을 자동으로 다시 올리지 않는다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback

from . import __version__, aside_runner, config, naver, package, prompt
from .client import ApiClient, ApiError


def _log(msg: str) -> None:
    print(time.strftime("%Y-%m-%d %H:%M:%S"), msg, flush=True)


def _api(cfg: dict) -> ApiClient:
    return ApiClient(cfg["server_url"], cfg["publisher_token"], cfg["publisher_name"])


def _hb_info(cfg: dict) -> dict:
    info = {"naver_blog_id": cfg.get("naver_blog_id") or None,
            "host": cfg.get("aside_host") or "local"}
    try:
        info["aside_version"] = aside_runner.version(cfg)
    except Exception:
        info["aside_version"] = None
    return info


def publish_one(cfg: dict, api: ApiClient) -> bool:
    """한 편 처리. 처리한 것이 있으면 True."""
    r = api.next()
    if r.get("skipped"):
        _log(f"서버가 한 편을 건너뛰었습니다({r['skipped']}): {r.get('reason')}")
        return True
    pkg = r.get("draft")
    if not pkg:
        return False
    did = pkg["draft_id"]
    _log(f"가져옴: {did} · {pkg['title']!r} · 사진 {len(pkg.get('photos') or [])}장 · {pkg.get('attempt')}회째")

    try:
        folder = package.prepare(pkg, cfg["work_dir"])
    except package.PackageError as e:
        _log(f"꾸러미 오류(아무것도 안 올림): {e}")
        api.result(did, result="failed", error=f"발행기: {e}")
        return True
    except Exception as e:
        _log(f"사진을 받지 못했습니다(아무것도 안 올림): {type(e).__name__}: {e}")
        api.result(did, result="failed", error=f"발행기: 사진을 받지 못했습니다({type(e).__name__})")
        return True

    text = prompt.build(pkg, folder, cfg["naver_blog_id"])
    log_path = os.path.join(folder, "aside.log")
    try:
        out, timed_out = aside_runner.run(cfg, text, log_path)
    except aside_runner.AsideNotFound as e:
        api.result(did, result="failed", error=f"발행기: {e}")
        _log(str(e))
        return True

    sid = prompt.session_id(out)
    if timed_out:
        _log("Aside 가 시간 안에 끝나지 않았습니다 — 올라갔는지 모릅니다")
        api.result(did, result="uncertain", session_id=sid,
                   error="발행기: Aside 가 시간 안에 끝나지 않았습니다. 네이버에서 확인해 주세요")
        return True

    kind, rest = prompt.parse(out)
    if kind == "ok":
        ok, why = naver.verify(rest, pkg["title"])
        _log(f"올림: {rest} · {why}")
        api.result(did, result="ok", url=rest, session_id=sid, verified=ok,
                   error=None if ok else f"발행기: {why}", blog_id=cfg["naver_blog_id"])
    elif kind == "failed":
        _log(f"올리지 않음: {rest}")
        api.result(did, result="failed", session_id=sid, error=f"Aside: {rest}"[:500])
    else:
        _log(f"올라갔는지 모름: {rest}")
        api.result(did, result="uncertain", session_id=sid, error=f"Aside: {rest}"[:500])
    return True


def cmd_check(cfg: dict) -> int:
    bad = config.missing(cfg)
    if bad:
        print("설정이 비어 있습니다:", ", ".join(bad))
        print("  python -m blog_publisher setup 을 먼저 실행하세요.")
        return 1
    ok = True
    try:
        print("Aside CLI  :", aside_runner.version(cfg))
        print("Aside 계정 :", aside_runner.account_status(cfg).splitlines()[0] if aside_runner.account_status(cfg) else "(응답 없음)")
    except aside_runner.AsideNotFound as e:
        print("Aside CLI  :", e); ok = False
    try:
        _api(cfg).heartbeat(_hb_info(cfg))
        print("서버       : 연결됨 ·", cfg["server_url"])
    except ApiError as e:
        print("서버       :", e); ok = False
    except Exception as e:
        print("서버       :", type(e).__name__, e); ok = False
    print("네이버 로그인은 Aside 브라우저 안에서 직접 확인하세요 — https://blog.naver.com/" + cfg["naver_blog_id"])
    print("작업 폴더  :", cfg["work_dir"])
    return 0 if ok else 1


def cmd_setup(path: str) -> int:
    cfg = config.load(path)
    print("블로그 발행기 설정 —", path)
    print("(값을 비워 두면 지금 값을 유지합니다. 토큰은 화면에 그대로 보입니다.)")
    for key, label in [("server_url", "서버 주소"), ("publisher_token", "발행기 토큰(서버 BLOG_PUBLISHER_TOKEN)"),
                       ("publisher_name", "이 발행기 이름"), ("naver_blog_id", "네이버 블로그 아이디"),
                       ("aside_host", "Aside 호스트(이 Mac 이면 비움)"), ("aside_account", "Aside 프로필(u0 등, 기본이면 비움)")]:
        cur = cfg.get(key) or ""
        v = input(f"  {label} [{cur}]: ").strip()
        if v:
            cfg[key] = v
    config.save(cfg, path)
    print("저장했습니다. 다음: python -m blog_publisher check")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="blog_publisher")
    ap.add_argument("command", choices=["run", "once", "check", "setup", "info", "dry-run"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--config", default=os.environ.get("BLOG_PUBLISHER_CONFIG", config.DEFAULT_CONFIG))
    args = ap.parse_args()

    if args.command == "setup":
        return cmd_setup(args.config)

    cfg = config.load(args.config)

    if args.command == "info":
        print(f"blog-publisher {__version__}")
        for k in ("server_url", "publisher_name", "naver_blog_id", "aside_bin", "aside_host",
                  "aside_account", "aside_model", "aside_effort", "aside_permission",
                  "poll_seconds", "work_dir"):
            print(f"  {k:22}: {cfg.get(k)}")
        print(f"  {'publisher_token':22}: {'있음' if cfg.get('publisher_token') else '없음 — setup 필요'}")
        return 0

    if args.command == "dry-run":
        if not args.arg:
            print("dry-run <꾸러미 json 파일>"); return 2
        with open(args.arg, encoding="utf-8") as f:
            pkg = json.load(f)
        folder = os.path.join(cfg["work_dir"], pkg.get("draft_id", "dry"))
        print(prompt.build(pkg, folder, cfg.get("naver_blog_id") or "<blog_id>"))
        print("---- 실행될 명령 ----")
        print(" ".join(aside_runner.command(cfg, "<prompt>")))
        return 0

    if args.command == "check":
        return cmd_check(cfg)

    bad = config.missing(cfg)
    if bad:
        print("설정이 비어 있습니다:", ", ".join(bad)); return 1
    api = _api(cfg)

    if args.command == "once":
        api.heartbeat(_hb_info(cfg))
        did = publish_one(cfg, api)
        if not did:
            _log("발행할 것이 없습니다")
        return 0

    # run — 계속 돈다. 무슨 일이 있어도 죽지 않는다(launchd 가 다시 띄우긴 하지만).
    _log(f"blog-publisher {__version__} 시작 · {cfg['server_url']} · 블로그 {cfg['naver_blog_id']}")
    n_sweep = 0
    while True:
        try:
            api.heartbeat(_hb_info(cfg))
            while publish_one(cfg, api):
                pass
            n_sweep += 1
            if n_sweep % 12 == 0:
                removed = package.sweep(cfg["work_dir"], int(cfg.get("keep_days") or 14))
                if removed:
                    _log(f"오래된 작업 폴더 {removed}개 정리")
        except ApiError as e:
            _log(f"서버 오류: {e}")
        except KeyboardInterrupt:
            return 0
        except Exception:
            _log("예상 못 한 오류:\n" + traceback.format_exc())
        time.sleep(max(30, int(cfg.get("poll_seconds") or 300)))


if __name__ == "__main__":
    sys.exit(main())
