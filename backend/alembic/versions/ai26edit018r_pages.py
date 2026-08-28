"""AI 페이지 편집기 — 고를 수 있는 화면을 ADMIN 메뉴 전부로.

처음 등록할 때 10개만 넣어뒀다. 그래서 편집기에서 나머지 화면은 고를 수가
없었다. 사이드바에서 ADMIN 이 볼 수 있는 화면 전부(47개)로 채운다.
편집기 자신(/ai-editor)만 뺀다 — 편집기 안에서 편집기를 여는 건 혼란만 준다.

이미 등록된 행을 갱신해야 실제로 바뀐다. 코드의 기본값(DEFAULT_SERVICE)만
고치면 새로 등록할 때만 반영되고, 운영에 이미 있는 행은 그대로다.

손으로 고쳐 둔 설정을 덮지 않으려고 key='admin' 의 pages 만 건드린다.

Revision ID: ai26edit018r
Revises: ai26edit017q
"""
from alembic import op
import sqlalchemy as sa
import json

revision = "ai26edit018r"
down_revision = "ai26edit017q"
branch_labels = None
depends_on = None


PAGES = [
    {
        "path": "/",
        "label": "홈"
    },
    {
        "path": "/eval/record-guide",
        "label": "검수 기준"
    },
    {
        "path": "/enteral",
        "label": "경관식 관리"
    },
    {
        "path": "/work-schedule",
        "label": "근무표"
    },
    {
        "path": "/incidents",
        "label": "낙상·사고 보고서"
    },
    {
        "path": "/my-schedule",
        "label": "내 근무표"
    },
    {
        "path": "/notices",
        "label": "내부 공지 관리"
    },
    {
        "path": "/naver-ads",
        "label": "네이버 광고 관리"
    },
    {
        "path": "/assignments",
        "label": "담당 어르신 명단"
    },
    {
        "path": "/eval/workload",
        "label": "담당자별 현황"
    },
    {
        "path": "/broadcast",
        "label": "방송 관리"
    },
    {
        "path": "/eval/albums",
        "label": "보호자 앨범"
    },
    {
        "path": "/history",
        "label": "블로그 관리"
    },
    {
        "path": "/eval/blog-ai-writer",
        "label": "블로그 AI 작성"
    },
    {
        "path": "/contacts",
        "label": "상담 관리"
    },
    {
        "path": "/settings",
        "label": "설정"
    },
    {
        "path": "/eval/residents",
        "label": "수급자 관리"
    },
    {
        "path": "/facility-news",
        "label": "시설소식"
    },
    {
        "path": "/meals",
        "label": "식단표"
    },
    {
        "path": "/meal-count",
        "label": "식수 정산"
    },
    {
        "path": "/leave-history",
        "label": "신청 내역 (서명)"
    },
    {
        "path": "/resident-docs",
        "label": "어르신 서류현황"
    },
    {
        "path": "/operations",
        "label": "운영 · 계약"
    },
    {
        "path": "/monthly-routines",
        "label": "월간 업무"
    },
    {
        "path": "/monthly-report",
        "label": "월간 운영 리포트"
    },
    {
        "path": "/analytics/suspicious-ips",
        "label": "의심 IP 통계"
    },
    {
        "path": "/guide",
        "label": "이용 안내"
    },
    {
        "path": "/staffing",
        "label": "인력배치 시뮬레이터"
    },
    {
        "path": "/handover",
        "label": "인수인계 AI"
    },
    {
        "path": "/schedule",
        "label": "일정 캘린더"
    },
    {
        "path": "/volunteers",
        "label": "자원봉사 관리"
    },
    {
        "path": "/work-schedule-view",
        "label": "전체 근무표 보기"
    },
    {
        "path": "/eval/record-audit",
        "label": "제공기록지 검수"
    },
    {
        "path": "/audit-check",
        "label": "지도점검 체크리스트"
    },
    {
        "path": "/expense",
        "label": "지출결의"
    },
    {
        "path": "/eval/users",
        "label": "직원 계정 관리"
    },
    {
        "path": "/eval/staff",
        "label": "직원 관리"
    },
    {
        "path": "/education",
        "label": "직원 교육"
    },
    {
        "path": "/staff-hr",
        "label": "직원 상세"
    },
    {
        "path": "/recruitment",
        "label": "채용 관리"
    },
    {
        "path": "/eval/calendar",
        "label": "체크 캘린더"
    },
    {
        "path": "/eval/checklist",
        "label": "체크리스트"
    },
    {
        "path": "/pension",
        "label": "퇴직연금"
    },
    {
        "path": "/analytics/page-views",
        "label": "페이지뷰 통계"
    },
    {
        "path": "/programs",
        "label": "프로그램 관리"
    },
    {
        "path": "/reviews",
        "label": "후기 관리"
    },
    {
        "path": "/eval/ai-review",
        "label": "AI 체크리스트 검토"
    }
]


def upgrade() -> None:
    op.execute(sa.text("UPDATE ai_edit_services SET pages = :p WHERE key = 'admin'")
               .bindparams(p=json.dumps(PAGES, ensure_ascii=False)))


def downgrade() -> None:
    # 되돌릴 이유가 없다. 화면 목록은 데이터일 뿐이고, 줄여봐야 고를 수 있는
    # 것만 줄어든다. 그래도 체인을 끊지 않도록 자리는 남긴다.
    pass
