"""backend 안의 'from app...' import 가 실제 파일을 가리키는지 확인한다.

■ 왜 있는가

  app.schemas.common 이라고 썼다. 그런 모듈은 없고 app.schemas.response 가
  맞았다. 이 한 줄 때문에 앱 전체가 import 에 실패해 API 가 전부 502 가 됐다.
  직원 평가만 안 된 게 아니라 로그인부터 막혔다.

  배포 전에는 문법 검사(ast.parse)만 했다. 문법은 멀쩡했다. 없는 모듈을
  가리키는 것은 문법으로 안 잡힌다.

  진짜 확인은 앱을 실제로 import 해 보는 것이지만, 그러려면 fastapi·
  sqlalchemy 같은 것을 다 설치해야 한다. 그래서 여기서는 표준 라이브러리만
  가지고 'app.X.Y' 가 파일로 존재하는지만 본다. 이번 사고는 그것만으로 잡힌다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_imports_resolve.py
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"


def _path(dotted: str):
    """'app.schemas.response' → 그 모듈의 파일/폴더 경로. 없으면 None.

    app/services 처럼 __init__.py 가 없는 폴더도 파이썬 3 에서는 패키지로
    쓸 수 있다(네임스페이스 패키지). 폴더만 있어도 있는 것으로 본다.
    """
    parts = dotted.split(".")
    p = BACKEND.joinpath(*parts)
    if p.with_suffix(".py").exists():
        return p.with_suffix(".py")
    if p.is_dir():
        return p
    return None


def _exists(dotted: str) -> bool:
    if not dotted.split(".")[0] == "app":
        return True                       # 바깥 라이브러리는 여기서 안 본다
    return _path(dotted) is not None


def _name_ok(module: str, name: str) -> bool:
    """'from app.services import login_guard' 의 login_guard 가 있는가.

    폴더에서 가져오는 경우에만 본다 — 그때는 이름이 하위 모듈이어야 하거나
    __init__.py 안에 있어야 한다. 파일에서 가져오는 이름(함수·상수)까지
    쫓지는 않는다. 여기서 잡으려는 것은 '없는 파일을 가리키는 import' 다.
    """
    p = _path(module)
    if p is None or p.is_file():
        return True
    if (p / f"{name}.py").exists() or (p / name).is_dir():
        return True
    init = p / "__init__.py"
    if init.exists():
        return name in init.read_text(encoding="utf-8")
    return False


def check() -> int:
    bad: list[str] = []
    files = 0

    for f in sorted(APP.rglob("*.py")):
        if "__pycache__" in f.parts:
            continue
        files += 1
        try:
            tree = ast.parse(f.read_text(encoding="utf-8"))
        except SyntaxError as e:
            bad.append(f"{f.relative_to(BACKEND)}: 문법 오류 {e.lineno}행 — {e.msg}")
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                # 상대 import(level>0)는 이 검사 대상이 아니다
                if node.level or not node.module:
                    continue
                if node.module.startswith("app.") or node.module == "app":
                    if not _exists(node.module):
                        bad.append(f"{f.relative_to(BACKEND)}:{node.lineno} "
                                   f"— 없는 모듈 '{node.module}'")
                        continue
                    for a in node.names:
                        if a.name != "*" and not _name_ok(node.module, a.name):
                            bad.append(f"{f.relative_to(BACKEND)}:{node.lineno} "
                                       f"— '{node.module}' 안에 '{a.name}' 가 없습니다")
            elif isinstance(node, ast.Import):
                for a in node.names:
                    if a.name.startswith("app.") and not _exists(a.name):
                        bad.append(f"{f.relative_to(BACKEND)}:{node.lineno} "
                                   f"— 없는 모듈 '{a.name}'")

    if bad:
        print("❌ 없는 모듈을 가리키는 import 가 있습니다 — 배포하면 앱이 뜨지 않습니다.")
        for b in sorted(set(bad)):
            print("   ·", b)
        return 1

    print(f"✅ import 모두 실재 — 파일 {files}개 검사")
    return 0


def test_imports_resolve():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
