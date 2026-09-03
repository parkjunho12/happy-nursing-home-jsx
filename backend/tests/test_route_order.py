"""고정 경로가 변수 경로보다 위에 있는지 검사한다.

FastAPI 는 적힌 순서대로 길을 찾는다. 그래서 이렇게 쓰면

    @router.put("/{bell_id}")   ← 먼저 적힘
    @router.put("/layout")

/layout 요청이 bell_id="layout" 로 잡혀서, 엉뚱하게 '그 벨을 찾을 수
없습니다' 가 돌아온다. 문법도 멀쩡하고 서버도 잘 뜨는데 그 기능만 조용히
안 먹는다 — 실제로 그렇게 배포했고, 눌러 보고서야 알았다.

같은 실수를 다시 하지 않으려고 여기서 막는다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_route_order.py
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

ENDPOINTS = Path(__file__).resolve().parent.parent / "app" / "api" / "v1" / "endpoints"
DEC = re.compile(r'^(?:\w+)\.(get|post|put|patch|delete)\(\s*[\'"]([^\'"]*)[\'"]')


def _routes(path: Path):
    """(라우터 이름, HTTP 메서드, 경로, 줄번호) 목록 — 적힌 순서 그대로.

    라우터를 구분해야 한다. 한 파일에 admin_router 와 family_router 가 함께
    있는 곳이 있는데, 서로 다른 prefix 로 붙으므로 서로를 가리지 않는다.
    구분하지 않으면 멀쩡한 코드를 문제라고 외치게 되고, 그러면 이 검사를
    아무도 안 믿게 된다.
    """
    out = []
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for d in node.decorator_list:
            if not isinstance(d, ast.Call):
                continue
            src = ast.unparse(d.func) if hasattr(ast, "unparse") else ""
            m = re.search(r"^(\w+)\.(get|post|put|patch|delete)$", src)
            if not m or not d.args:
                continue
            arg = d.args[0]
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                out.append((m.group(1), m.group(2), arg.value, d.lineno))
    return sorted(out, key=lambda x: x[3])


def _shape(path: str):
    """'/{id}/x' → ('*','x') — 변수 자리는 별표로 본다."""
    return tuple("*" if p.startswith("{") else p for p in path.strip("/").split("/") if p)


def check() -> int:
    bad: list[str] = []
    files = 0

    for f in sorted(ENDPOINTS.glob("*.py")):
        files += 1
        routes = _routes(f)
        for i, (r1, m1, p1, l1) in enumerate(routes):
            s1 = _shape(p1)
            if "*" not in s1:
                continue                      # 고정 경로는 가릴 일이 없다
            for (r2, m2, p2, l2) in routes[i + 1:]:
                if m2 != m1 or r2 != r1:      # 다른 라우터끼리는 서로 안 가린다
                    continue
                s2 = _shape(p2)
                if "*" in s2 or len(s1) != len(s2):
                    continue
                # 뒤에 온 고정 경로가 앞의 변수 경로에 삼켜지는가
                if all(a == "*" or a == b for a, b in zip(s1, s2)):
                    bad.append(
                        f"{f.name}: {m1.upper()} '{p2}'({l2}행)가 "
                        f"'{p1}'({l1}행)에 가려집니다 [{r1}] — 위로 올려주세요")

    if bad:
        print("❌ 가려지는 경로가 있습니다 — 그 기능만 조용히 안 먹습니다.")
        for b in sorted(set(bad)):
            print("   ·", b)
        return 1

    print(f"✅ 경로 순서 정상 — 파일 {files}개 검사 (라우터별로 따로 봄)")
    return 0


def test_route_order():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
