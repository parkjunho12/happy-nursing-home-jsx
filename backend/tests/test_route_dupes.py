"""같은 라우터에 같은 (메서드, 경로) 가 두 번 있는지 검사한다.

■ 왜 필요한가

  FastAPI 는 먼저 등록된 것이 이긴다. 뒤엣것은 조용히 죽는다 — 오류도 안
  나고 서버도 잘 뜬다. 그래서 '저장은 되는데 화면에는 안 보이는' 증상이
  생기고, 원인을 찾기까지 한참 걸린다.

  실제로 프로그램 회차 기록을 /logs 로 만들었다가 이미 있던 변경 이력
  /logs 에 가려, 적어 놓은 기록이 사라진 것처럼 보였다. 파일 안에서
  400줄 떨어져 있어 눈으로는 못 봤다.

  이 검사는 라우터 객체별로 따로 본다. 서로 다른 라우터의 같은 경로는
  prefix 가 달라 문제가 없다(예: 여러 곳의 GET "").

의존성 없이 돌아야 한다(CI 에 pytest 가 없다).

    python3 backend/tests/test_route_dupes.py
"""
from __future__ import annotations

import ast
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENDPOINTS = HERE.parent / "app" / "api" / "v1" / "endpoints"

METHODS = {"get", "post", "put", "patch", "delete"}


def _routes(tree: ast.AST):
    """(라우터이름, 메서드, 경로, 줄번호, 함수명) 들을 뽑는다."""
    out = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            if not isinstance(dec, ast.Call) or not isinstance(dec.func, ast.Attribute):
                continue
            method = dec.func.attr
            if method not in METHODS:
                continue
            router = getattr(dec.func.value, "id", None)
            if not router:
                continue
            if not dec.args or not isinstance(dec.args[0], ast.Constant):
                continue
            path = dec.args[0].value
            if isinstance(path, str):
                out.append((router, method, path, node.lineno, node.name))
    return out


def check() -> int:
    bad = []
    checked = 0
    for f in sorted(ENDPOINTS.glob("*.py")):
        try:
            tree = ast.parse(f.read_text(encoding="utf-8"))
        except SyntaxError as e:
            print(f"⚠️  {f.name} 를 읽지 못했습니다: {e}")
            continue
        checked += 1
        seen = defaultdict(list)
        for router, method, path, line, fn in _routes(tree):
            seen[(router, method, path)].append((line, fn))
        for (router, method, path), hits in seen.items():
            if len(hits) > 1:
                where = " · ".join(f"{fn}():{line}" for line, fn in hits)
                bad.append(f"{f.name} — {method.upper()} {path!r} 가 {len(hits)}번: {where}")

    if bad:
        print("❌ 같은 경로가 여러 번 등록되어 있습니다.")
        print("   FastAPI 는 먼저 등록된 것만 씁니다 — 뒤엣것은 조용히 죽습니다.")
        for b in bad:
            print("   ·", b)
        print("\n둘 다 필요하다면 경로 이름을 다르게 지어주세요.")
        return 1

    print(f"✅ 중복 경로 없음 — 파일 {checked}개 검사")
    return 0


def test_no_duplicate_routes():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
