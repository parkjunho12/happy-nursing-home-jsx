#!/usr/bin/env python3
"""
최초 Admin 계정 생성 스크립트
"""

import sys
sys.path.append('/app')

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash
import uuid


def create_admin():
    db: Session = SessionLocal()

    email = "admin@nursing-home.com"
    password = "admin123"

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print("⚠️ Admin already exists")
        return

    user = User(
        id=str(uuid.uuid4()),
        email=email,
        name="Admin",
        hashed_password=get_password_hash(password),
        role="ADMIN",
    )

    db.add(user)
    db.commit()
    db.close()

    print("✅ Admin created successfully")
    print(f"   Email: {email}")
    print(f"   Password: {password} (CHANGE THIS!)")


if __name__ == "__main__":
    create_admin()
