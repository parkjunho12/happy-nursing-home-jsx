"""수가(급여) 계산기 API — ADMIN 전용 접근 통제 + CRUD 계약 + 동시성 검증.

■ 왜 있는가
  원본 스프레드시트 스냅샷과 시나리오 입력값은 민감한 경영 정보다. ADMIN 이
  아닌 누구도(비로그인, 일반 STAFF, 시설장 등 직군 예외 포함) 접근하면 안
  된다 — 다른 관리 화면처럼 '시설장은 예외' 를 넣는 순간 이 계산기만은
  뚫린 문이 된다. 그래서 여기서 세 가지를 각각 확인한다: 비로그인 401/403,
  일반 직원 403, **시설장(직군) 403** — 마지막이 가장 중요하다.

  낙관적 잠금(expected_updated_at)과 동시 생성 경쟁(IntegrityError) 처리가
  실제로 동작하는지도 함께 검증한다. 여기가 느슨해지면 두 사람이 같은 달
  시나리오를 덮어써도 아무 경고 없이 조용히 데이터가 사라지거나, 서버가
  500 으로 죽는다.

  시나리오 입력값(inputs)은 `apps/admin/src/utils/feeCalculator.ts` 의
  `FeeInputs`/`validateInputs()` 규칙을 서버에서도 그대로 지켜야 한다 —
  저장 시점에 막지 않으면 나중에 다른 브라우저의 계산 엔진(`calculateFee`)이
  `throw` 로 죽는다.

■ 격리 원칙 (중요)
  이 테스트는 `app.main`(전체 앱 — API 라우터 50여 개, TTS·firebase·opencv 같은
  무거운 서비스까지 전부 import)을 쓰지 않는다. 새로 만든 라우터가 실제로
  무엇에 의존하는지만 보기 위해, 이 파일 안에서 `fee_calculator` 라우터만
  얹은 **별도의 FastAPI 앱**을 만든다. 이렇게 해야 이 테스트가 새 라우터
  자체의 결함만 잡고, 무관한 모듈의 import 실패(예: opencv·firebase-admin
  미설치)에 흔들리지 않는다.

  다만 파이썬 패키지 import 규칙상 `from app.models.carefor import X` 처럼
  `app.models.<하위모듈>` 을 import 하면 `app/models/__init__.py` 가 먼저
  실행된다 — 그 파일은 (의도적으로) 60여 개 모델을 전부 등록하므로, 결국
  `Base.metadata` 에는 이 라우터와 무관한 모델까지 다 올라온다. 그래서
  `Base.metadata.create_all(tables=ISOLATED_TABLES)` 처럼 **실제로 만들 표를
  명시적으로 한정**한다 — User·FeeCalculatorSource·FeeCalculatorScenario·
  CareforResident 넷뿐이다. 관계없는 모델(예: Postgres 전용 JSONB 컬럼을 쓰는
  contacts)이 SQLite 테스트를 깨뜨리지 않는다.

  환경변수(DATABASE_URL 등)는 이 모듈 안에서만 강제한다 — 전역 conftest.py 를
  쓰지 않으므로 다른 테스트 파일이 이 파일 때문에 SQLite 로 바뀌는 사고가 없다.

■ 실행
  pytest 와 fastapi·sqlalchemy 가 설치된 환경에서:
      cd backend && pytest tests/test_fee_calculator.py -v
  또는 pytest 가 없으면 표준 unittest 로:
      cd backend && python3 -m unittest tests.test_fee_calculator -v
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime

# ── 이 모듈 안에서만 환경변수를 강제한다 ───────────────────────────────────
# app.core.config.Settings 는 DATABASE_URL·SECRET_KEY·CORS_ORIGINS 가 필수라
# import 시점에 없으면 곧바로 실패한다. 전역 conftest.py 를 쓰지 않으므로
# 이 파일을 import 하는 즉시(다른 무엇보다 먼저) 채워 둔다. 이미 다른 값이
# 설정돼 있어도(실제 .env 등) DATABASE_URL 은 테스트용 SQLite 로 강제 덮어써
# 실수로 운영 DB에 테스트가 붙는 사고를 막는다.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("CORS_ORIGINS", "http://localhost")
os.environ.setdefault("ENVIRONMENT", "test")

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ── 새 라우터와 '그 라우터가 실제로 쓰는' 모델만 import 한다 ────────────────
# app.models(패키지 전체)나 app.main 은 절대 import 하지 않는다 — 그 순간
# 이 테스트가 무관한 60여 개 모듈에 발목 잡힌다.
from app.api.v1.endpoints.fee_calculator import (
    SOURCE_SINGLETON_ID,
    router as fee_calculator_router,
)
from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models.carefor import CareforResident
from app.models.eval import LtcResident
from app.models.fee_calculator import FeeCalculatorScenario, FeeCalculatorSource
from app.models.resident_docs import ResidentDocStatus
from app.models.user import User, UserRole
from app.services.fee_calculator_validation import days_in_month

ADMIN = "/api/v1/admin/fee-calculator"

# 주의: `from app.models.carefor import CareforResident` 처럼 `app.models.<모듈>` 을
# import 하면, 파이썬 패키지 임포트 규칙상 `app/models/__init__.py` 가 먼저 실행된다.
# 그 파일은 (의도적으로) 60여 개 모델 전부를 등록하므로, 어떤 서브모듈만 import 해도
# `Base.metadata` 에는 결국 전체 모델이 다 올라온다 — 이건 이 테스트가 막을 수 없는
# 파이썬 임포트 동작이다. 대신 `create_all(tables=[...])` 로 **실제로 만들 테이블을
# 명시적으로 한정**해서, 관계없는 모델(예: Postgres 전용 JSONB 컬럼)이 SQLite 테스트를
# 깨뜨리지 않게 한다 — 이 라우터가 실제로 쓰는 테이블만 만든다.
ISOLATED_TABLES = [
    User.__table__,
    FeeCalculatorSource.__table__,
    FeeCalculatorScenario.__table__,
    LtcResident.__table__,
    ResidentDocStatus.__table__,
    # /context 가 이제 쓰지 않지만, '오래된 스냅샷이 결과에 영향을 주지 않아야 한다'를
    # 직접 검증하려면 stale 기지를 넣을 곳이 필요하다.
    CareforResident.__table__,
]


def default_fee_inputs(month: str) -> dict:
    """`apps/admin/src/utils/feeCalculator.ts::defaultInputs()` 와 같은 값.

    프론트가 처음 만드는 값 그대로를 서버 검증이 그대로 받아들여야 한다.
    """
    days = days_in_month(month) or 0
    return {
        "month": month,
        "tier": "enhanced",
        "counts": [0, 0, 0],
        "days": days,
        "averageResidents": 0,
        "capacity": 0,
        "copayRate": 0.2,
        "mealPrice": 4000,
        "mealsPerDay": 3,
        "snackPrice": 750,
        "snacksPerDay": 2,
        "noncoveredDays": days,
        "extraNursing": 0,
        "extraSocial": 0,
        "extraTherapy": 0,
        "registeredNurses": 0,
        "dayStaff": 0,
        "nightStaff": 0,
        "programPoints": 0,
        "programConfirmed": False,
        "staffingConfirmed": False,
        "nightConfirmed": False,
        "temporaryPoints": 0,
        "temporaryConfirmed": False,
        "caregiverFte": 0,
        "payroll": 0,
        "laborBasis": 0,
        "otherCosts": 0,
        "hireCost": 0,
    }


def _build_app() -> FastAPI:
    """fee_calculator 라우터 하나만 얹은 최소 앱."""
    app = FastAPI()
    app.include_router(fee_calculator_router, prefix=ADMIN)
    return app


class FeeCalculatorTestCase(unittest.TestCase):
    """SQLite in-memory + dependency_overrides 로 라우터를 통째로 돌린다."""

    @classmethod
    def setUpClass(cls):
        # StaticPool + check_same_thread=False — in-memory DB 를 여러 세션이
        # 공유하게 한다(그렇지 않으면 요청마다 빈 DB 가 된다).
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        cls.app = _build_app()

    def setUp(self):
        Base.metadata.create_all(bind=self.engine, tables=ISOLATED_TABLES)
        self.client = TestClient(self.app)
        self._set_default_get_db()

    def tearDown(self):
        self.app.dependency_overrides.pop(get_current_user, None)
        Base.metadata.drop_all(bind=self.engine, tables=ISOLATED_TABLES)

    # ── 헬퍼 ────────────────────────────────────────────────────────────
    def _set_default_get_db(self) -> None:
        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        self.app.dependency_overrides[get_db] = override_get_db

    def _user(self, role: UserRole, position: str | None = None) -> User:
        return User(
            id=str(uuid.uuid4()),
            email=f"{uuid.uuid4().hex}@example.com",
            name="테스트유저",
            hashed_password="x",
            role=role,
            position=position,
        )

    def _login_as(self, user: User) -> None:
        """get_current_user 만 바꿔치기 — get_current_admin_user 는 실제 구현을
        그대로 통과시켜, 권한 로직 자체는 우회하지 않는다."""
        self.app.dependency_overrides[get_current_user] = lambda: user

    def _login_admin(self) -> User:
        u = self._user(UserRole.ADMIN)
        self._login_as(u)
        return u


# ══════════════════════════════════════════════════════════════════════
# 접근 통제
# ══════════════════════════════════════════════════════════════════════
class TestAccessControl(FeeCalculatorTestCase):
    def test_anonymous_rejected(self):
        r = self.client.get(f"{ADMIN}/source")
        self.assertIn(r.status_code, (401, 403))

        r2 = self.client.put(
            f"{ADMIN}/source", json={"sheets": [], "captured_at": "2026-01-01T00:00:00"}
        )
        self.assertIn(r2.status_code, (401, 403))

    def test_nonadmin_staff_rejected(self):
        self._login_as(self._user(UserRole.STAFF, None))
        self.assertEqual(self.client.get(f"{ADMIN}/source").status_code, 403)
        self.assertEqual(self.client.get(f"{ADMIN}/scenarios").status_code, 403)
        self.assertEqual(self.client.get(f"{ADMIN}/context").status_code, 403)

    def test_facility_head_rejected_no_bypass(self):
        """시설장·대표·이사 등 직군으로도 우회할 수 없다 — ADMIN 만 통과."""
        for pos in ("시설장", "대표", "이사"):
            with self.subTest(pos=pos):
                self._login_as(self._user(UserRole.STAFF, pos))
                r = self.client.get(f"{ADMIN}/source")
                self.assertEqual(r.status_code, 403, f"{pos} 는 403 이어야 하는데 {r.status_code}")

                r2 = self.client.put(
                    f"{ADMIN}/source",
                    json={"sheets": [], "captured_at": "2026-01-01T00:00:00"},
                )
                self.assertEqual(r2.status_code, 403)

    def test_admin_allowed(self):
        self._login_admin()
        self.assertEqual(self.client.get(f"{ADMIN}/source").status_code, 200)


# ══════════════════════════════════════════════════════════════════════
# /source
# ══════════════════════════════════════════════════════════════════════
class TestSource(FeeCalculatorTestCase):
    def test_get_source_null_initially(self):
        self._login_admin()
        r = self.client.get(f"{ADMIN}/source")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json())

    def test_put_then_get_source_upsert_singleton(self):
        self._login_admin()
        body = {
            "sheets": [
                {
                    "name": "2026-01",
                    "gid": "12345",
                    "cells": [
                        {"cell": "A1", "value": "항목", "formula": None},
                        {"cell": "B1", "value": 120000, "formula": "=SUM(B2:B10)"},
                    ],
                }
            ],
            "captured_at": "2026-01-15T09:00:00+09:00",
            "source_url": "https://docs.google.com/spreadsheets/d/abc/edit",
        }
        r = self.client.put(f"{ADMIN}/source", json=body)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual(data["sheets"][0]["name"], "2026-01")
        self.assertEqual(data["sheets"][0]["cells"][0]["cell"], "A1")
        self.assertEqual(data["captured_at"], body["captured_at"])
        self.assertEqual(data["source_url"], body["source_url"])
        self.assertTrue(data["updated_at"])
        self.assertEqual(data["updated_by"], "테스트유저")

        r2 = self.client.get(f"{ADMIN}/source")
        got = r2.json()
        self.assertEqual(got["sheets"][0]["cells"][1]["formula"], "=SUM(B2:B10)")

        # 두 번째 PUT 은 upsert — 고정 id(SOURCE_SINGLETON_ID) 행 하나만 유지된다
        body2 = dict(body, captured_at="2026-02-01T00:00:00+09:00")
        r3 = self.client.put(f"{ADMIN}/source", json=body2)
        self.assertEqual(r3.status_code, 200)
        self.assertEqual(r3.json()["captured_at"], "2026-02-01T00:00:00+09:00")

        with self.SessionLocal() as s:
            self.assertEqual(s.query(FeeCalculatorSource).count(), 1)
            row = s.query(FeeCalculatorSource).first()
            self.assertEqual(row.id, SOURCE_SINGLETON_ID)

    def test_rejects_nan(self):
        self._login_admin()
        body = {
            "sheets": [{"name": "S", "cells": [{"cell": "A1", "value": float("nan")}]}],
            "captured_at": "2026-01-01T00:00:00",
        }
        r = self.client.put(f"{ADMIN}/source", json=body)
        self.assertIn(r.status_code, (400, 422))

    def test_rejects_bad_cell_ref(self):
        self._login_admin()
        body = {
            "sheets": [{"name": "S", "cells": [{"cell": "not-a-cell", "value": 1}]}],
            "captured_at": "2026-01-01T00:00:00",
        }
        r = self.client.put(f"{ADMIN}/source", json=body)
        self.assertEqual(r.status_code, 422)

    def test_rejects_nested_cell_value(self):
        """셀 값은 스칼라만 허용 — dict/list 는 거절돼야 한다."""
        self._login_admin()
        body = {
            "sheets": [{"name": "S", "cells": [{"cell": "A1", "value": {"nested": 1}}]}],
            "captured_at": "2026-01-01T00:00:00",
        }
        r = self.client.put(f"{ADMIN}/source", json=body)
        self.assertEqual(r.status_code, 422)

        body2 = {
            "sheets": [{"name": "S", "cells": [{"cell": "A1", "value": [1, 2, 3]}]}],
            "captured_at": "2026-01-01T00:00:00",
        }
        r2 = self.client.put(f"{ADMIN}/source", json=body2)
        self.assertEqual(r2.status_code, 422)

    def test_rejects_bad_captured_at(self):
        self._login_admin()
        body = {"sheets": [], "captured_at": "not-a-date"}
        r = self.client.put(f"{ADMIN}/source", json=body)
        self.assertEqual(r.status_code, 400)

    def test_rejects_too_many_sheets(self):
        self._login_admin()
        body = {
            "sheets": [{"name": f"S{i}", "cells": []} for i in range(51)],
            "captured_at": "2026-01-01T00:00:00",
        }
        r = self.client.put(f"{ADMIN}/source", json=body)
        self.assertEqual(r.status_code, 422)

    def test_source_url_must_be_google_sheets(self):
        self._login_admin()
        base_body = {"sheets": [], "captured_at": "2026-01-01T00:00:00"}

        bad_urls = [
            "https://evil.example.com/spreadsheets/x",
            "http://docs.google.com/spreadsheets/d/abc",  # http (not https)
            "https://docs.google.com/document/d/abc",      # 스프레드시트 아님
            "javascript:alert(1)",
            "not a url",
        ]
        for url in bad_urls:
            with self.subTest(url=url):
                r = self.client.put(f"{ADMIN}/source", json=dict(base_body, source_url=url))
                self.assertEqual(r.status_code, 422, f"{url} 는 거절돼야 하는데 {r.status_code}")

        r_ok = self.client.put(
            f"{ADMIN}/source",
            json=dict(base_body, source_url="https://docs.google.com/spreadsheets/d/abc123/edit#gid=0"),
        )
        self.assertEqual(r_ok.status_code, 200, r_ok.text)

    def test_source_url_length_bound(self):
        self._login_admin()
        long_url = "https://docs.google.com/spreadsheets/d/" + ("a" * 1100)
        body = {"sheets": [], "captured_at": "2026-01-01T00:00:00", "source_url": long_url}
        r = self.client.put(f"{ADMIN}/source", json=body)
        self.assertEqual(r.status_code, 422)


# ══════════════════════════════════════════════════════════════════════
# /scenarios
# ══════════════════════════════════════════════════════════════════════
class TestScenarios(FeeCalculatorTestCase):
    def test_list_empty_then_create(self):
        self._login_admin()
        self.assertEqual(self.client.get(f"{ADMIN}/scenarios").json(), [])

        r2 = self.client.put(
            f"{ADMIN}/scenarios/2026-01",
            json={"inputs": default_fee_inputs("2026-01")},
        )
        self.assertEqual(r2.status_code, 200, r2.text)
        data = r2.json()
        self.assertEqual(data["month"], "2026-01")
        self.assertEqual(data["inputs"]["month"], "2026-01")
        self.assertEqual(data["updated_by"], "테스트유저")
        self.assertTrue(data["updated_at"])

        arr = self.client.get(f"{ADMIN}/scenarios").json()
        self.assertEqual(len(arr), 1)
        self.assertEqual(arr[0]["month"], "2026-01")

    def test_rejects_bad_month_path(self):
        self._login_admin()
        r = self.client.put(f"{ADMIN}/scenarios/2026-13", json={"inputs": {}})
        self.assertEqual(r.status_code, 400)
        r2 = self.client.put(f"{ADMIN}/scenarios/not-a-month", json={"inputs": {}})
        self.assertEqual(r2.status_code, 400)

    def test_rejects_nan_inputs(self):
        self._login_admin()
        inputs = default_fee_inputs("2026-01")
        inputs["payroll"] = float("inf")
        r = self.client.put(f"{ADMIN}/scenarios/2026-01", json={"inputs": inputs})
        self.assertIn(r.status_code, (400, 422))

    def test_rejects_empty_inputs(self):
        """빈 dict — 필수 FeeInputs 필드가 전혀 없으면 422 로 막아야 한다."""
        self._login_admin()
        r = self.client.put(f"{ADMIN}/scenarios/2026-01", json={"inputs": {}})
        self.assertEqual(r.status_code, 422)
        errors = r.json()["detail"]["errors"]
        self.assertTrue(any("month" in e for e in errors))

    def test_rejects_month_mismatch_between_path_and_inputs(self):
        self._login_admin()
        inputs = default_fee_inputs("2026-02")  # 경로는 2026-01 인데 inputs.month 는 2026-02
        r = self.client.put(f"{ADMIN}/scenarios/2026-01", json={"inputs": inputs})
        self.assertEqual(r.status_code, 422)
        errors = r.json()["detail"]["errors"]
        self.assertTrue(any("경로" in e for e in errors))

    def test_rejects_unsupported_year(self):
        self._login_admin()
        # month 형식 자체는 유효해야 경로 검증(400)을 통과해 inputs 검증(422)까지 간다
        inputs = default_fee_inputs("2027-01")
        r = self.client.put(f"{ADMIN}/scenarios/2027-01", json={"inputs": inputs})
        self.assertEqual(r.status_code, 422)
        errors = r.json()["detail"]["errors"]
        self.assertTrue(any("2026" in e for e in errors))

    def test_rejects_missing_required_field(self):
        self._login_admin()
        inputs = default_fee_inputs("2026-01")
        del inputs["staffingConfirmed"]
        r = self.client.put(f"{ADMIN}/scenarios/2026-01", json={"inputs": inputs})
        self.assertEqual(r.status_code, 422)

    def test_rejects_negative_or_non_integer_counts(self):
        self._login_admin()
        inputs = default_fee_inputs("2026-01")
        inputs["counts"] = [-1, 2, 3]
        r = self.client.put(f"{ADMIN}/scenarios/2026-01", json={"inputs": inputs})
        self.assertEqual(r.status_code, 422)

        inputs2 = default_fee_inputs("2026-01")
        inputs2["counts"] = [1.5, 2, 3]
        r2 = self.client.put(f"{ADMIN}/scenarios/2026-01", json={"inputs": inputs2})
        self.assertEqual(r2.status_code, 422)

    def test_rejects_out_of_bounds_numeric(self):
        self._login_admin()
        inputs = default_fee_inputs("2026-01")
        inputs["copayRate"] = 0.5  # BOUNDS 상 0.2 초과
        r = self.client.put(f"{ADMIN}/scenarios/2026-01", json={"inputs": inputs})
        self.assertEqual(r.status_code, 422)

    def test_rejects_unknown_field(self):
        self._login_admin()
        inputs = default_fee_inputs("2026-01")
        inputs["totallyUnknownField"] = 1
        r = self.client.put(f"{ADMIN}/scenarios/2026-01", json={"inputs": inputs})
        self.assertEqual(r.status_code, 422)

    def test_optimistic_lock_conflict_and_success(self):
        self._login_admin()

        inputs_v1 = default_fee_inputs("2026-03")
        r1 = self.client.put(f"{ADMIN}/scenarios/2026-03", json={"inputs": inputs_v1})
        self.assertEqual(r1.status_code, 200, r1.text)
        first_updated_at = r1.json()["updated_at"]

        inputs_v2 = default_fee_inputs("2026-03")
        inputs_v2["capacity"] = 30

        # 잘못된(오래된) expected_updated_at 로 수정 시도 → 409, 값은 그대로
        r2 = self.client.put(
            f"{ADMIN}/scenarios/2026-03",
            json={"inputs": inputs_v2, "expected_updated_at": "2000-01-01T00:00:00+09:00"},
        )
        self.assertEqual(r2.status_code, 409)
        self.assertIn("existing", r2.json().get("detail", {}))

        r_check = self.client.get(f"{ADMIN}/scenarios")
        self.assertEqual(r_check.json()[0]["inputs"]["capacity"], 0)

        # 올바른 expected_updated_at 로는 성공
        r3 = self.client.put(
            f"{ADMIN}/scenarios/2026-03",
            json={"inputs": inputs_v2, "expected_updated_at": first_updated_at},
        )
        self.assertEqual(r3.status_code, 200, r3.text)
        self.assertEqual(r3.json()["inputs"]["capacity"], 30)

        # 존재하지 않는 시나리오에 expected_updated_at 을 지정하면 409
        inputs_new = default_fee_inputs("2026-04")
        r4 = self.client.put(
            f"{ADMIN}/scenarios/2026-04",
            json={"inputs": inputs_new, "expected_updated_at": "2020-01-01T00:00:00"},
        )
        self.assertEqual(r4.status_code, 409)


# ══════════════════════════════════════════════════════════════════════
# 동시성 — DB 제약(IntegrityError)과 경쟁 처리
# ══════════════════════════════════════════════════════════════════════
class TestConcurrency(FeeCalculatorTestCase):
    def test_source_singleton_unique_constraint_enforced_at_db_level(self):
        """고정 id(SOURCE_SINGLETON_ID) 로 두 세션이 동시에 처음 만들면
        나중에 커밋하는 쪽이 실제 IntegrityError 를 받는지 DB 레벨에서 확인한다."""
        with self.SessionLocal() as s_a, self.SessionLocal() as s_b:
            self.assertIsNone(
                s_a.query(FeeCalculatorSource).filter_by(id=SOURCE_SINGLETON_ID).first()
            )
            self.assertIsNone(
                s_b.query(FeeCalculatorSource).filter_by(id=SOURCE_SINGLETON_ID).first()
            )

            s_a.add(FeeCalculatorSource(id=SOURCE_SINGLETON_ID, sheets=[], captured_at="2026-01-01T00:00:00"))
            s_a.commit()

            s_b.add(FeeCalculatorSource(id=SOURCE_SINGLETON_ID, sheets=[], captured_at="2026-01-02T00:00:00"))
            with self.assertRaises(IntegrityError):
                s_b.flush()
            s_b.rollback()

    def test_scenario_month_unique_constraint_enforced_at_db_level(self):
        with self.SessionLocal() as s_a, self.SessionLocal() as s_b:
            s_a.add(FeeCalculatorScenario(month="2026-05", inputs={}))
            s_a.commit()

            s_b.add(FeeCalculatorScenario(month="2026-05", inputs={}))
            with self.assertRaises(IntegrityError):
                s_b.flush()
            s_b.rollback()

    def test_source_insert_race_returns_409_via_endpoint(self):
        """엔드포인트의 IntegrityError catch → 409 경로를 실제로 통과시킨다.

        진짜 스레드 경쟁은 SQLite in-memory 에서 결정적으로 재현하기 어렵다.
        대신 '두 요청이 동시에 처음 만들려다 하나가 진다'는 상황을 DB 제약
        위반이라는 같은 결과로 주입해, 라우터의 try/except IntegrityError →
        rollback → 409 로직이 실제로 실행되는지 확인한다.
        """
        self._login_admin()

        class _RaceSession:
            """정상 세션을 감싸 최초 한 번만 flush() 에서 IntegrityError 를 낸다."""

            def __init__(self, real):
                self._real = real
                self._boom_once = True

            def __getattr__(self, name):
                return getattr(self._real, name)

            def flush(self, *a, **kw):
                if self._boom_once:
                    self._boom_once = False
                    raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed"))
                return self._real.flush(*a, **kw)

        def override_get_db_race():
            real = self.SessionLocal()
            try:
                yield _RaceSession(real)
            finally:
                real.close()

        self.app.dependency_overrides[get_db] = override_get_db_race
        try:
            r = self.client.put(
                f"{ADMIN}/source",
                json={"sheets": [], "captured_at": "2026-01-01T00:00:00"},
            )
            self.assertEqual(r.status_code, 409, r.text)
        finally:
            self._set_default_get_db()

    def test_scenario_insert_race_returns_409_via_endpoint(self):
        self._login_admin()

        class _RaceSession:
            def __init__(self, real):
                self._real = real
                self._boom_once = True

            def __getattr__(self, name):
                return getattr(self._real, name)

            def flush(self, *a, **kw):
                if self._boom_once:
                    self._boom_once = False
                    raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed"))
                return self._real.flush(*a, **kw)

        def override_get_db_race():
            real = self.SessionLocal()
            try:
                yield _RaceSession(real)
            finally:
                real.close()

        self.app.dependency_overrides[get_db] = override_get_db_race
        try:
            r = self.client.put(
                f"{ADMIN}/scenarios/2026-06",
                json={"inputs": default_fee_inputs("2026-06")},
            )
            self.assertEqual(r.status_code, 409, r.text)
            self.assertIsNone(r.json()["detail"]["existing"])
        finally:
            self._set_default_get_db()


# ══════════════════════════════════════════════════════════════════════
# /context
# ══════════════════════════════════════════════════════════════════════
# 2026-09-21 운영 사고: /context 가 오래된 CareforResident 스냅샷을 읽어 29명을
# 돌려줌 — 관리자 화면(LtcResident 기준)은 41명. '현재 재원'은 반드시
# `LtcResident.status == 'active'` 로만 세야 하고(대시보드 `/dashboard/stats` 와 동일),
# 등급은 `ResidentDocStatus` 에서 연결된(active) 서류로만 받아야 한다.
def _ltc_resident(id_: str, status: str = "active", **overrides) -> LtcResident:
    base = dict(
        id=id_,
        name=f"어르신-{id_}",  # 응답에는 절대 들어가면 안 된다 — 내부 피그스처용일 뿐
        birth_date="1940-01-01",
        gender="F",
        admission_date="2020-01-01",
        care_grade_start_date="2020-01-01",
        status=status,
    )
    base.update(overrides)
    return LtcResident(**base)


def _doc(resident_id: str, grade: str, active: bool = True, **overrides) -> ResidentDocStatus:
    base = dict(resident_id=resident_id, grade=grade, active=active)
    base.update(overrides)
    return ResidentDocStatus(**base)


class TestContext(FeeCalculatorTestCase):
    def test_grade_counts_strip_label_and_exclude_inactive_resident(self):
        """'4/시설' 와 같은 라벨을 았자리 숫자로만 발라내고, 퇴소자(inactive)는 제외한다."""
        self._login_admin()
        with self.SessionLocal() as db:
            db.add_all(
                [
                    _ltc_resident("r1", status="active"),
                    _ltc_resident("r2", status="active"),
                    _ltc_resident("r3", status="active"),
                    _ltc_resident("r4", status="discharged"),  # 제외돼야 함
                ]
            )
            db.add_all(
                [
                    _doc("r1", "4/시설"),
                    _doc("r2", "4/시설"),
                    _doc("r3", "2/재가"),
                    _doc("r4", "3/시설"),  # 퇴소자 서류 — 집계에 안 잡혀야 함
                ]
            )
            db.commit()

        r = self.client.get(f"{ADMIN}/context")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["total"], 3)
        self.assertEqual(data["by_grade"], {"4": 2, "2": 1})

    def test_missing_doc_returns_unknown(self):
        """연결된 서류가 아예 없으면 '미상'."""
        self._login_admin()
        with self.SessionLocal() as db:
            db.add(_ltc_resident("r1", status="active"))
            db.commit()

        data = self.client.get(f"{ADMIN}/context").json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["by_grade"], {"미상": 1})

    def test_unparseable_grade_returns_unknown(self):
        """grade 값이 있어도 앞자리가 1~5 숫자가 아니면 '미상'."""
        self._login_admin()
        with self.SessionLocal() as db:
            db.add(_ltc_resident("r1", status="active"))
            db.add(_doc("r1", "미상정"))  # 1~5 숫자로 시작하지 않음
            db.commit()

        data = self.client.get(f"{ADMIN}/context").json()
        self.assertEqual(data["by_grade"], {"미상": 1})

    def test_duplicate_same_grade_not_double_counted(self):
        """한 어르신에게 서류가 여러 건(중복) 있어도 같은 등급이면 한 명만 세야 한다."""
        self._login_admin()
        with self.SessionLocal() as db:
            db.add(_ltc_resident("r1", status="active"))
            db.add_all(
                [
                    _doc("r1", "3/시설", id=str(uuid.uuid4())),
                    _doc("r1", "3", id=str(uuid.uuid4())),  # 같은 등급, 다른 라벨 표기
                    _doc("r1", "3/재가", id=str(uuid.uuid4())),
                ]
            )
            db.commit()

        data = self.client.get(f"{ADMIN}/context").json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["by_grade"], {"3": 1})  # 3명이 아니라 1명

    def test_conflicting_grades_return_unknown(self):
        """한 어르신에게 서로 다른 등급이 연결된 서류(충돌)가 있으면 '미상'."""
        self._login_admin()
        with self.SessionLocal() as db:
            db.add(_ltc_resident("r1", status="active"))
            db.add_all(
                [
                    _doc("r1", "2/시설", id=str(uuid.uuid4())),
                    _doc("r1", "4/시설", id=str(uuid.uuid4())),  # 서로 다름 — 충돌
                ]
            )
            db.commit()

        data = self.client.get(f"{ADMIN}/context").json()
        self.assertEqual(data["by_grade"], {"미상": 1})

    def test_inactive_doc_ignored(self):
        """active=False 인 서류는 연결으로 치지 않는다(퇴소로 숨겨진 서류)."""
        self._login_admin()
        with self.SessionLocal() as db:
            db.add(_ltc_resident("r1", status="active"))
            db.add_all(
                [
                    _doc("r1", "5/시설", active=False, id=str(uuid.uuid4())),  # 무시되어야 함
                ]
            )
            db.commit()

        data = self.client.get(f"{ADMIN}/context").json()
        self.assertEqual(data["by_grade"], {"미상": 1})  # active 서류가 없는 것과 동일

    def test_stale_carefor_snapshot_does_not_affect_counts(self):
        """오래된 CareforResident 스냅샷(29명)이 있어도 /context 는 그것을 전혀
        참조하지 않고 LtcResident 기준(이 테스트에서는 2명)으로만 집계해야 한다.
        2026-09-21 운영 사고(context=29 vs 관리자 화면=41)의 재발 방지 회귀 테스트."""
        self._login_admin()
        with self.SessionLocal() as db:
            # stale Carefor 스냅샷 29명 — /context 결과에 절대 섮여들면 안 된다
            db.add_all(
                [CareforResident(name=f"구수가-{i}", care_grade="1", status="active") for i in range(29)]
            )
            # 실제 기준(LtcResident)은 2명뿐
            db.add_all([_ltc_resident("r1", status="active"), _ltc_resident("r2", status="active")])
            db.add_all([_doc("r1", "1/시설"), _doc("r2", "2/시설")])
            db.commit()

            self.assertEqual(db.query(CareforResident).count(), 29)  # 전제 확인

        data = self.client.get(f"{ADMIN}/context").json()
        self.assertEqual(data["total"], 2)  # 29 가 아니라 2
        self.assertEqual(data["by_grade"], {"1": 1, "2": 1})

    def test_no_names_in_response(self):
        self._login_admin()
        with self.SessionLocal() as db:
            db.add(_ltc_resident("r1", status="active", name="가나다"))
            db.add(_doc("r1", "1/시설"))
            db.commit()

        r = self.client.get(f"{ADMIN}/context")
        data = r.json()
        self.assertNotIn("가나다", r.text)
        self.assertNotIn("name", data)
        self.assertNotIn("names", data)

    def test_source_label_and_timezone_aware_as_of(self):
        self._login_admin()
        r = self.client.get(f"{ADMIN}/context")
        data = r.json()
        self.assertEqual(data["source"], "admin 재원 원장 + 연결된 서류현황 등급")
        # ISO 8601 파싱 + timezone-aware 확인(offset 이 None 이 아니어야 함)
        parsed = datetime.fromisoformat(data["as_of"])
        self.assertIsNotNone(parsed.tzinfo)
        self.assertIsNotNone(parsed.tzinfo.utcoffset(parsed))


if __name__ == "__main__":
    unittest.main()
