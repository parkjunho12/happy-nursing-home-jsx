# scripts/init_db.py
import os
import sys

sys.path.append("/app")

from sqlalchemy import create_engine
from app.core.database import Base

# ✅ 모델 import 강제 (Base.metadata에 등록되게)
import app.models  # noqa

DATABASE_URL = os.environ["DATABASE_URL"]

def main():
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    print("✅ DB schema created via Base.metadata.create_all()")

if __name__ == "__main__":
    main()
