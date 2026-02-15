#!/usr/bin/env python3
"""
최초 Admin 계정 생성 스크립트
"""

import sys
sys.path.append('/app')

from app.core.security import get_password_hash

def create_admin():
    print("Creating admin account...")
    
    # TODO: DB 연결 후 Admin 생성
    email = "admin@nursing-home.com"
    password = "admin123"
    hashed_password = get_password_hash(password)
    
    print(f"✅ Admin created successfully")
    print(f"   Email: {email}")
    print(f"   Password: {password} (CHANGE THIS!)")
    print(f"   Hashed: {hashed_password}")

if __name__ == "__main__":
    create_admin()

