"""함수 안에서 들여온 이름을 다른 함수가 쓰고 있지는 않은가.

■ 왜 이 검사가 생겼나

  식이 현황이 운영에서 통째로 500 이 났다. 까닭은 한 줄이었다.

      def current(...):
          from app.services import away as aw      # ← 이 함수 안에서만 산다
          ...
      def _merge_away(a, ab):
          out = {**a, "label": aw.away_label(a)}    # ← 여기서는 없는 이름

  문법 검사(compileall)는 통과한다. import 가 실재하는지 보는 검사
  (test_imports_resolve)도 통과한다 — import 문 자체는 멀쩡하기 때문이다.
  이름이 없다는 것은 그 줄이 실제로 실행될 때에야 드러난다.

■ 무엇을 보는가

  모듈 안의 각 함수에서 '지역 import 로 들어온 이름' 을 모으고, 그 이름을
  같은 모듈의 다른 함수가 쓰는지 본다. 다만 쓰는 쪽이 그 이름을 스스로
  만들어 쓰고 있으면(대입·매개변수·for·with·except·내포) 남의 것이 아니므로
  넘어간다. 이걸 안 보면 `date` 같은 흔한 이름이 죄다 걸린다.

  엔드포인트만 본다. 여기가 요청을 직접 받는 자리라, 여기서 나는 NameError 는
  곧바로 500 이 된다.

  표준 라이브러리만 쓴다 — 배포 전 검사에서 설치 없이 부른다.
"""
from __future__ import annotations

import ast
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "app", "api", "v1", "endpoints")


def _imported_in(node: ast.AST) -> set:
    """이 덩어리 안에서 import 로 들어온 이름들."""
    out = set()
    for n in ast.walk(node):
        if isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names:
                out.add((a.asname or a.name).split(".")[0])
    return out


def _bound_in(fn: ast.AST) -> set:
    """이 함수가 스스로 만들어 쓰는 이름 — 매개변수·대입·for·with·except·내포."""
    out = set()
    args = getattr(fn, "args", None)
    if args is not None:
        for a in (list(args.posonlyargs) + list(args.args) + list(args.kwonlyargs)):
            out.add(a.arg)
        for a in (args.vararg, args.kwarg):
            if a:
                out.add(a.arg)
    for n in ast.walk(fn):
        if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)):
            out.add(n.id)
        elif isinstance(n, ast.excepthandler) and n.name:
            out.add(n.name)
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            out.add(n.name)
    return out


def check_file(path: str) -> list:
    tree = ast.parse(open(path, encoding="utf-8").read())
    funcs = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]

    # 모듈 맨 위에서 생긴 이름 — 어디서나 쓸 수 있다
    module_names = _imported_in_toplevel(tree)

    # 이름 → 그 이름을 함수 안에서만 들여온 함수
    local_only = {}
    for fn in funcs:
        for nm in _imported_in(fn):
            if nm not in module_names:
                local_only.setdefault(nm, fn.name)

    bad = []
    for fn in funcs:
        mine = _imported_in(fn) | _bound_in(fn)
        for nm in {n.id for n in ast.walk(fn)
                   if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load)}:
            owner = local_only.get(nm)
            if owner and owner != fn.name and nm not in mine:
                bad.append(f"{os.path.basename(path)}: {fn.name}() 가 {nm} 을 쓰는데, "
                           f"{owner}() 안에서만 들여왔습니다 — 모듈 맨 위로 올려주세요")
    return bad


def _imported_in_toplevel(tree: ast.Module) -> set:
    out = set()
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                out.add((a.asname or a.name).split(".")[0])
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    out.add(t.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            out.add(node.target.id)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            out.add(node.name)
        elif isinstance(node, (ast.If, ast.Try)):
            # try/except ImportError 로 감싼 import 도 모듈 이름이다
            out |= _imported_in(node)
    return out


def main() -> int:
    bad = []
    files = sorted(f for f in os.listdir(TARGET) if f.endswith(".py"))
    for f in files:
        bad.extend(check_file(os.path.join(TARGET, f)))
    if bad:
        print("❌ 함수 안에서만 들여온 이름을 다른 함수가 씁니다 — 그 줄이 실행되면 500 입니다.")
        for b in bad:
            print("   ·", b)
        return 1
    print(f"✅ 지역 import 를 넘겨 쓰는 곳 없음 — 파일 {len(files)}개 검사")
    return 0


def test_no_leaked_local_imports():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
