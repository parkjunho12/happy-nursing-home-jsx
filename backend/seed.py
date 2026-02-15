import sys
sys.path.append(".")

from datetime import date, datetime, timedelta
import time

from sqlalchemy import text
from app.core.database import SessionLocal, engine, Base

# ✅ 모델 import (테이블 생성/매핑 등록용)
from app.models.user import User, UserRole
from app.models.resident import Resident, Gender, ResidentStatus
from app.models.contact import Contact, ContactStatus
from app.models.history import History, HistoryCategory
from app.models.review import Review

# ✅ 비밀번호 해싱 (bcrypt 이슈가 있으면 fallback)
from app.core.security import get_password_hash


def ensure_tables():
    print("📦 Ensuring tables exist...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables ensured")


def quick_counts(db):
    # 테이블 존재/카운트 확인
    def count(table):
        return db.query(table).count()

    print("📊 Current counts:")
    print(f"  users:     {count(User)}")
    print(f"  residents: {count(Resident)}")
    print(f"  contacts:  {count(Contact)}")
    print(f"  history:   {count(History)}")
    print(f"  reviews:   {count(Review)}")


def safe_hash(password: str) -> str:
    """
    passlib/bcrypt 환경 꼬이면 여기서 터질 수 있음.
    - 정상: get_password_hash 사용
    - 실패: 임시로 평문 저장(개발용) -> 로그인 검증도 그에 맞춰야 함
    """
    try:
        return get_password_hash(password)
    except Exception as e:
        print("⚠️  Password hash failed. Reason:", repr(e))
        print("⚠️  DEV ONLY: storing password as plain text. Fix bcrypt/passlib later.")
        return password  # 개발용 임시


def seed_admin(db):
    email = "admin@nursing-home.com"
    admin = db.query(User).filter(User.email == email).first()
    if admin:
        print("ℹ️  Admin already exists:", email)
        return admin

    print("👤 Creating admin user...")
    admin = User(
        email=email,
        name="관리자",
        hashed_password=safe_hash("admin123"),
        role=UserRole.ADMIN if hasattr(UserRole, "ADMIN") else "ADMIN",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print("✅ Admin created:", admin.email)
    return admin


def seed_residents(db):
    if db.query(Resident).count() > 0:
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
    if db.query(Contact).count() > 0:
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
    if db.query(History).count() > 0:
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
    if db.query(Review).count() > 0:
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


def main():
    print("=" * 60)
    print("🌱 Running seed.py")
    print("=" * 60)

    ensure_tables()

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
        print("🔐 Login")
        print("  email:    admin@nursing-home.com")
        print("  password: admin123")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print("❌ Seed failed:", repr(e))
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
