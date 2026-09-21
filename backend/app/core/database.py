from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create engine
# SQLite(특히 in-memory)는 QueuePool 전용 옵션(pool_size/max_overflow)을 받지 않는다 —
# 그대로 넘기면 create_engine() 자체가 TypeError 로 죽는다. 운영은 항상 Postgres라
# 이 분기가 실제로 영향을 주진 않지만, 로컬 테스트/개발에서 SQLite 를 쓸 수
# 있게(그리고 앱이 죽지 않게) dialect 별로 옵션을 갈라 넣는다.
_engine_kwargs = {"pool_pre_ping": True, "future": True}
if not settings.DATABASE_URL.startswith("sqlite"):
    _engine_kwargs.update(pool_size=10, max_overflow=20)

engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()