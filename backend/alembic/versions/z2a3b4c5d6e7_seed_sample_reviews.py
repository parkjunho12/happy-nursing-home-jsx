"""seed 10 sample (approved) public reviews

Revision ID: z2a3b4c5d6e7
Revises: y1z2a3b4c5d6
Create Date: 2026-06-25
"""
from datetime import datetime, timezone, timedelta
from alembic import op
import sqlalchemy as sa

revision = "z2a3b4c5d6e7"
down_revision = "y1z2a3b4c5d6"
branch_labels = None
depends_on = None

KST = timezone(timedelta(hours=9))

# (author, rating, content, date, verified, featured)
_REVIEWS = [
    ("김**(따님)", 5,
     "치매 초기 어머니를 모시면서 걱정이 많았는데, 선생님들이 가족처럼 살펴주셔서 마음이 놓입니다. 매일 어머니 일상 사진을 보내주셔서 멀리 있어도 안심이 돼요.",
     "2026-06-08", True, True),
    ("이**(보호자)", 5,
     "면회 갈 때마다 시설이 정말 깨끗하고 특유의 냄새가 전혀 없어서 놀랐습니다. 단독건물이라 채광도 좋고 어르신들 표정이 밝아요.",
     "2026-05-21", True, False),
    ("박**(아드님)", 4,
     "입소 상담부터 등급 안내까지 차분하게 설명해주셔서 결정에 큰 도움이 됐습니다. 처음엔 적응 걱정을 했는데 2주 만에 편안해하셨어요.",
     "2026-05-03", True, False),
    ("최**(며느리)", 5,
     "식사가 정말 정성스럽습니다. 시아버님이 치아가 안 좋으신데 따로 죽과 부드러운 반찬을 챙겨주셔서 식사량이 늘었어요.",
     "2026-04-15", True, True),
    ("정**(따님)", 5,
     "인지 프로그램, 노래교실, 가벼운 체조까지 매일 활동이 있어서 아버지가 무료해하지 않으세요. 면회 가면 '오늘 뭐 했다'고 자랑하십니다.",
     "2026-03-27", True, False),
    ("강**(아드님)", 5,
     "새벽에 어머니 상태가 안 좋아졌을 때 바로 연락 주시고 병원 동행까지 해주셨습니다. 신속한 대응 덕분에 큰일을 막았어요. 정말 감사합니다.",
     "2026-03-10", True, False),
    ("윤**(보호자)", 4,
     "녹양역에서 가까워 퇴근길에 자주 들릅니다. 주차도 편하고 면회 시간도 융통성 있게 배려해주셔서 좋아요.",
     "2026-02-18", True, False),
    ("임**(따님)", 5,
     "요양보호사 선생님들이 늘 웃으며 따뜻하게 대해주십니다. 낯을 많이 가리시던 어머니가 이제 선생님들을 먼저 반기세요.",
     "2026-01-29", True, False),
    ("한**(아드님)", 5,
     "멀리 살아서 자주 못 가는데 영상통화 면회를 잘 연결해주셔서 매주 얼굴을 봅니다. 어르신 건강 변화도 꼼꼼히 알려주셔서 믿음이 갑니다.",
     "2025-12-12", True, False),
    ("서**(며느리)", 5,
     "장기요양등급 신청과 비용 부분까지 솔직하고 자세히 안내해주셨어요. 막연한 부담이 줄었고, 무엇보다 어머님이 만족하셔서 가장 기쁩니다.",
     "2025-11-20", True, False),
]


def upgrade():
    reviews = sa.table(
        "public_reviews",
        sa.column("author", sa.String),
        sa.column("rating", sa.Integer),
        sa.column("content", sa.Text),
        sa.column("date", sa.String),
        sa.column("verified", sa.Boolean),
        sa.column("featured", sa.Boolean),
        sa.column("approved", sa.Boolean),
        sa.column("approved_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(KST)
    rows = [
        {
            "author": a, "rating": r, "content": c, "date": d,
            "verified": v, "featured": fe, "approved": True, "approved_at": now,
        }
        for (a, r, c, d, v, fe) in _REVIEWS
    ]
    op.bulk_insert(reviews, rows)


def downgrade():
    authors = tuple(r[0] for r in _REVIEWS)
    op.execute(
        sa.text("DELETE FROM public_reviews WHERE approved = true AND author IN :authors")
        .bindparams(sa.bindparam("authors", value=authors, expanding=True))
    )
