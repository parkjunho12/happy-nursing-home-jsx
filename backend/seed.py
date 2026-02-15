import os
import sys
sys.path.append(".")

from datetime import date, datetime, timedelta
import time
import subprocess
from typing import Optional, Any

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, OperationalError, SQLAlchemyError

from app.core.database import SessionLocal, engine, Base

# ✅ 모델 import (테이블 생성/매핑 등록용)
from app.models.user import User, UserRole
from app.models.resident import Resident, Gender, ResidentStatus
from app.models.contact import Contact, ContactStatus
from app.models.history import History, HistoryCategory
from app.models.review import Review

from app.core.security import get_password_hash


# =============================================================================
# Helpers: schema checks
# =============================================================================

def db_scalar(sql: str, params: Optional[dict] = None) -> Any:
    with engine.connect() as conn:
        res = conn.execute(text(sql), params or {}).scalar()
        return res


def table_exists(table_name: str, schema: str = "public") -> bool:
    sql = """
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema=:s AND table_name=:t
    LIMIT 1
    """
    return db_scalar(sql, {"s": schema, "t": table_name}) is not None


def column_exists(table_name: str, column_name: str, schema: str = "public") -> bool:
    sql = """
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema=:s AND table_name=:t AND column_name=:c
    LIMIT 1
    """
    return db_scalar(sql, {"s": schema, "t": table_name, "c": column_name}) is not None


def safe_count(db, model, label: str) -> Optional[int]:
    try:
        return db.query(model).count()
    except ProgrammingError as e:
        # schema mismatch (undefined column/table etc.)
        msg = str(e.orig) if getattr(e, "orig", None) else str(e)
        print(f"  {label:<10}: ❌ schema mismatch -> {msg.splitlines()[0]}")
        db.rollback()
        return None


# =============================================================================
# Migrations / Table creation strategy
# =============================================================================

def try_alembic_upgrade_head() -> bool:
    """
    Prefer migrations (correct way). If it fails, return False and fallback to create_all.
    """
    try:
        subprocess.check_call(["alembic", "upgrade", "head"])
        return True
    except FileNotFoundError:
        # alembic not installed in image or PATH
        print("⚠️  alembic command not found. Fallback to create_all.")
        return False
    except subprocess.CalledProcessError as e:
        print("⚠️  alembic upgrade head failed. Fallback to create_all.")
        print("    reason:", repr(e))
        return False


def ensure_schema():
    """
    1) Try alembic upgrade head (best)
    2) Fallback to Base.metadata.create_all (dev-only fallback)
    """
    print("📦 Ensuring DB schema...")

    migrated = try_alembic_upgrade_head()
    if migrated:
        print("✅ Alembic migrations applied")
        return

    print("⚠️  Using create_all fallback (dev-only). This will NOT add missing columns.")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables ensured (create_all fallback)")


# =============================================================================
# Password hashing
# =============================================================================

def safe_hash(password: str) -> str:
    try:
        return get_password_hash(password)
    except Exception as e:
        print("⚠️  Password hash failed. Reason:", repr(e))
        print("⚠️  DEV ONLY: storing password as plain text. Fix bcrypt/passlib later.")
        return password


# =============================================================================
# Seeds (idempotent)
# =============================================================================

def seed_admin(db):
    email = os.getenv("SEED_ADMIN_EMAIL", "admin@nursing-home.com")
    password = os.getenv("SEED_ADMIN_PASSWORD", "admin123")
    name = os.getenv("SEED_ADMIN_NAME", "관리자")

    admin = db.query(User).filter(User.email == email).first()
    if admin:
        print("ℹ️  Admin already exists:", email)
        return admin

    print("👤 Creating admin user...")
    admin = User(
        email=email,
        name=name,
        hashed_password=safe_hash(password),
        role=UserRole.ADMIN if hasattr(UserRole, "ADMIN") else "ADMIN",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print("✅ Admin created:", admin.email)
    return admin


def seed_residents(db):
    if safe_count(db, Resident, "residents") not in (None, 0):
        print("ℹ️  Residents already exist")
        return

    print("👵 Seeding residents...")
    residents = [
        Resident(
            name="김영희",
            birth_date=date(1945, 3, 15),
            gender=Gender.FEMALE,
            admission_date=date(2023, 1, 10),
            room_number="101",
            grade="2",
            emergency_contact="김철수",
            emergency_phone="010-1234-5678",
            status=ResidentStatus.ACTIVE,
            notes="치매 2등급. 아침 산책 좋아하심",
        ),
        Resident(
            name="박순자",
            birth_date=date(1940, 7, 22),
            gender=Gender.FEMALE,
            admission_date=date(2023, 2, 15),
            room_number="102",
            grade="3",
            emergency_contact="박민수",
            emergency_phone="010-2345-6789",
            status=ResidentStatus.ACTIVE,
            notes="당뇨 관리 필요",
        ),
        Resident(
            name="이철수",
            birth_date=date(1948, 11, 5),
            gender=Gender.MALE,
            admission_date=date(2023, 3, 20),
            room_number="201",
            grade="1",
            emergency_contact="이영미",
            emergency_phone="010-3456-7890",
            status=ResidentStatus.ACTIVE,
            notes="고혈압 약 복용 중",
        ),
        Resident(
            name="정미자",
            birth_date=date(1943, 5, 18),
            gender=Gender.FEMALE,
            admission_date=date(2023, 4, 5),
            room_number="103",
            grade="2",
            emergency_contact="정태현",
            emergency_phone="010-4567-8901",
            status=ResidentStatus.HOSPITALIZED,
            notes="현재 대학병원 입원 중",
        ),
    ]
    db.add_all(residents)
    db.commit()
    print(f"✅ Residents seeded: {len(residents)}")


def seed_contacts(db):
    if safe_count(db, Contact, "contacts") not in (None, 0):
        print("ℹ️  Contacts already exist")
        return

    print("📞 Seeding contacts...")
    now = int(time.time())
    contacts = [
        Contact(
            ticket_id=f"CNT-{now}",
            name="김철수",
            phone="010-1234-5678",
            email="kim@example.com",
            inquiry_type="입소상담",
            message="어머니 입소 상담을 받고 싶습니다.",
            status=ContactStatus.PENDING,
            privacy_agreed=True,
        ),
        Contact(
            ticket_id=f"CNT-{now+1}",
            name="박영희",
            phone="010-2345-6789",
            email="park@example.com",
            inquiry_type="비용문의",
            message="3등급 기준 비용 문의드립니다.",
            status=ContactStatus.REPLIED,
            reply="4인실 기준 월 120만원 정도입니다.",
            replied_at=datetime.utcnow() - timedelta(hours=2),
            replied_by="관리자",
            privacy_agreed=True,
        ),
    ]
    db.add_all(contacts)
    db.commit()
    print(f"✅ Contacts seeded: {len(contacts)}")


def seed_history(db):
    if safe_count(db, History, "history") not in (None, 0):
        print("ℹ️  History already exist")
        return

    print("📝 Seeding history...")
    items = [
        History(
            title="봄나들이 행사",
            slug="spring-outing-2024",
            category=HistoryCategory.EVENT,
            content="따뜻한 봄날, 공원으로 나들이를 다녀왔습니다.",
            excerpt="입소자분들과 함께한 봄나들이 행사",
            is_published=True,
            published_at=datetime.utcnow() - timedelta(days=30),
            view_count=45,
            tags=["행사", "나들이", "봄"],
            image_url=None,
        ),
        History(
            title="건강체조 프로그램",
            slug="health-exercise-program",
            category=HistoryCategory.PROGRAM,
            content="매주 화, 목 오전 10시 건강체조를 진행합니다.",
            excerpt="주 2회 건강체조로 건강한 생활",
            is_published=True,
            published_at=datetime.utcnow() - timedelta(days=15),
            view_count=67,
            tags=["프로그램", "운동", "건강"],
            image_url=None,
        ),
    ]
    db.add_all(items)
    db.commit()
    print(f"✅ History seeded: {len(items)}")


def seed_reviews(db):
    # ✅ 스키마 체크: author_name 컬럼 없으면 아예 스킵
    if not table_exists("reviews"):
        print("⚠️  reviews table missing -> skip seed_reviews")
        return
    if not column_exists("reviews", "author_name"):
        print("⚠️  reviews.author_name missing -> skip seed_reviews (run migrations / ALTER TABLE)")
        return

    existing = safe_count(db, Review, "reviews")
    if existing not in (None, 0):
        print("ℹ️  Reviews already exist")
        return

    print("⭐ Seeding reviews...")
    items = [
        Review(
            author_name="김**",
            resident_name="김영희",
            rating=5,
            content="어머니께서 행복해하십니다. 직원분들이 친절해요.",
            is_approved=True,
            approved_at=datetime.utcnow() - timedelta(days=10),
            approved_by="관리자",
        ),
        Review(
            author_name="박**",
            resident_name="박순자",
            rating=5,
            content="프로그램 다양하고 식사도 좋아요.",
            is_approved=True,
            approved_at=datetime.utcnow() - timedelta(days=5),
            approved_by="관리자",
        ),
    ]
    db.add_all(items)
    db.commit()
    print(f"✅ Reviews seeded: {len(items)}")


# =============================================================================
# Main
# =============================================================================

def quick_counts(db):
    print("📊 Current counts:")
    print(f"  users:     {safe_count(db, User, 'users')}")
    print(f"  residents: {safe_count(db, Resident, 'residents')}")
    print(f"  contacts:  {safe_count(db, Contact, 'contacts')}")
    print(f"  history:   {safe_count(db, History, 'history')}")
    print(f"  reviews:   {safe_count(db, Review, 'reviews')}")


def main():
    print("=" * 60)
    print("🌱 Running seed.py")
    print("=" * 60)

    ensure_schema()

    db = SessionLocal()
    try:
        quick_counts(db)

        seed_admin(db)
        seed_residents(db)
        seed_contacts(db)
        seed_history(db)
        seed_reviews(db)

        print("-" * 60)
        quick_counts(db)
        print("-" * 60)

        email = os.getenv("SEED_ADMIN_EMAIL", "admin@nursing-home.com")
        password = os.getenv("SEED_ADMIN_PASSWORD", "admin123")

        print("🔐 Login")
        print(f"  email:    {email}")
        print(f"  password: {password}")
        print("=" * 60)

    except (OperationalError, SQLAlchemyError) as e:
        db.rollback()
        print("❌ Seed failed:", repr(e))
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # RUN_SEED가 true일 때만 실행하고 싶으면 아래처럼 가드도 가능
    if os.getenv("RUN_SEED") == "true":
        main()
    else:
        print("seed.py skipped (RUN_SEED != true)")
    main()
