# app/models/public.py
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, func, JSON, Float
from app.core.database import Base

class ContactTicket(Base):
    __tablename__ = "contact_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String(40), unique=True, index=True, nullable=False)

    name = Column(String(100), nullable=False)
    phone = Column(String(40), nullable=False)
    email = Column(String(200), nullable=True)

    inquiry_type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    privacy_agreed = Column(Boolean, default=True, nullable=False)

    status = Column(String(30), default="NEW", nullable=False)  # NEW / IN_PROGRESS / DONE
    replied_at = Column(DateTime(timezone=True), nullable=True)
    reply = Column(Text, nullable=True)

    meta = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PublicHistoryPost(Base):
    __tablename__ = "public_history_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, index=True, nullable=False)

    category = Column(String(50), nullable=False)  # PROGRAM / EVENT / NOTICE ...
    excerpt = Column(Text, nullable=True)
    content_html = Column(Text, nullable=False)

    is_published = Column(Boolean, default=False, index=True, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PublicReview(Base):
    __tablename__ = "public_reviews"

    id = Column(Integer, primary_key=True, index=True)
    author = Column(String(100), nullable=False)     # 김**
    rating = Column(Integer, nullable=False)         # 1~5
    content = Column(Text, nullable=False)

    date = Column(String(20), nullable=True)         # "2024-01-15" 같이 문자열 유지(원하면 Date로)
    verified = Column(Boolean, default=False, nullable=False)
    featured = Column(Boolean, default=False, nullable=False)

    approved = Column(Boolean, default=False, index=True, nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PublicService(Base):
    __tablename__ = "public_services"

    id = Column(Integer, primary_key=True, index=True)
    icon = Column(String(50), nullable=False)        # "🏥"
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    features = Column(JSON, nullable=False, default=list)  # ["혈압 체크", ...]
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, index=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PublicDifferentiator(Base):
    __tablename__ = "public_differentiators"

    id = Column(Integer, primary_key=True, index=True)
    icon = Column(String(50), nullable=False)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, index=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PublicInfo(Base):
    __tablename__ = "public_info"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(Text, nullable=False)
    phone = Column(String(50), nullable=False)
    hours = Column(String(100), nullable=True)
    email = Column(String(200), nullable=True)

    # 단일 row로 운영할 거라면 id=1 고정해서 관리
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
