"""add eval tables

Revision ID: a1b2c3d4e5f6
Revises: 9708749016a9
Create Date: 2026-06-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "9708749016a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "eval_domains",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(30), server_default="blue"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("active", sa.Boolean(), server_default="true"),
    )

    op.create_table(
        "eval_categories",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "domain_id",
            sa.String(),
            sa.ForeignKey("eval_domains.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("question_count", sa.Integer(), server_default="0"),
        sa.Column("total_score", sa.Integer(), server_default="0"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("active", sa.Boolean(), server_default="true"),
    )
    op.create_index(
        "ix_eval_categories_domain_id",
        "eval_categories",
        ["domain_id"],
    )

    op.create_table(
        "eval_sub_indicators",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "category_id",
            sa.String(),
            sa.ForeignKey("eval_categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("score", sa.Integer(), server_default="0"),
        sa.Column("criteria", sa.Text(), server_default=""),
        sa.Column("evidence_list", sa.Text(), server_default="[]"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("active", sa.Boolean(), server_default="true"),
    )
    op.create_index(
        "ix_eval_sub_indicators_category_id",
        "eval_sub_indicators",
        ["category_id"],
    )

    op.create_table(
        "checklist_items",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), server_default=""),
        sa.Column("frequency", sa.String(30), nullable=False),
        sa.Column(
            "related_indicator_id",
            sa.String(),
            sa.ForeignKey("eval_sub_indicators.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "related_category_id",
            sa.String(),
            sa.ForeignKey("eval_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "related_domain_id",
            sa.String(),
            sa.ForeignKey("eval_domains.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("assignee", sa.String(100), server_default=""),
        sa.Column("evidence_required", sa.Text(), server_default=""),
        sa.Column("storage_location", sa.String(200), server_default=""),
        sa.Column("how_to", sa.Text(), server_default=""),
        sa.Column("eval_note", sa.Text(), server_default=""),
        sa.Column("risk_level", sa.String(20), server_default="medium"),
        sa.Column("active", sa.Boolean(), server_default="true"),
        sa.Column("memo", sa.Text(), server_default=""),
        sa.Column("attachment_name", sa.String(200), server_default=""),
        sa.Column("completed", sa.Boolean(), server_default="false"),
        sa.Column("completed_date", sa.String(20), nullable=True),
        sa.Column("last_checked_date", sa.String(20), nullable=True),
        sa.Column("person_id", sa.String(), nullable=True),
        sa.Column("person_name", sa.String(100), nullable=True),
        sa.Column("person_type", sa.String(20), nullable=True),
        sa.Column("template_id", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_checklist_items_person_id", "checklist_items", ["person_id"])
    op.create_index("ix_checklist_items_related_indicator_id", "checklist_items", ["related_indicator_id"])
    op.create_index("ix_checklist_items_related_category_id", "checklist_items", ["related_category_id"])
    op.create_index("ix_checklist_items_related_domain_id", "checklist_items", ["related_domain_id"])

    op.create_table(
        "completion_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "checklist_id",
            sa.String(),
            sa.ForeignKey("checklist_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_key", sa.String(20), nullable=False),
        sa.Column("completed_date", sa.String(20), nullable=False),
        sa.Column("memo", sa.Text(), server_default=""),
        sa.Column("attachment_name", sa.String(200), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_completion_records_checklist_id", "completion_records", ["checklist_id"])

    op.create_table(
        "ltc_residents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("birth_date", sa.String(20), nullable=False),
        sa.Column("gender", sa.String(10), nullable=False),
        sa.Column("admission_date", sa.String(20), nullable=False),
        sa.Column("discharge_date", sa.String(20), nullable=True),
        sa.Column("care_grade_start_date", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("memo", sa.Text(), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_ltc_residents_name", "ltc_residents", ["name"])
    op.create_index("ix_ltc_residents_status", "ltc_residents", ["status"])

    op.create_table(
        "ltc_staff_members",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("birth_date", sa.String(20), nullable=False),
        sa.Column("gender", sa.String(10), nullable=False),
        sa.Column("hire_date", sa.String(20), nullable=False),
        sa.Column("resign_date", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("memo", sa.Text(), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_ltc_staff_members_name", "ltc_staff_members", ["name"])
    op.create_index("ix_ltc_staff_members_status", "ltc_staff_members", ["status"])

    op.create_table(
        "eval_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("facility_name", sa.String(100), server_default="행복한 요양원"),
        sa.Column("eval_year", sa.Integer(), server_default="2025"),
        sa.Column("alert_days_before_due", sa.Integer(), server_default="7"),
        sa.Column("long_inactive_threshold_days", sa.Integer(), server_default="14"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("eval_settings")

    op.drop_index("ix_ltc_staff_members_status", table_name="ltc_staff_members")
    op.drop_index("ix_ltc_staff_members_name", table_name="ltc_staff_members")
    op.drop_table("ltc_staff_members")

    op.drop_index("ix_ltc_residents_status", table_name="ltc_residents")
    op.drop_index("ix_ltc_residents_name", table_name="ltc_residents")
    op.drop_table("ltc_residents")

    op.drop_index("ix_completion_records_checklist_id", table_name="completion_records")
    op.drop_table("completion_records")

    op.drop_index("ix_checklist_items_related_domain_id", table_name="checklist_items")
    op.drop_index("ix_checklist_items_related_category_id", table_name="checklist_items")
    op.drop_index("ix_checklist_items_related_indicator_id", table_name="checklist_items")
    op.drop_index("ix_checklist_items_person_id", table_name="checklist_items")
    op.drop_table("checklist_items")

    op.drop_index("ix_eval_sub_indicators_category_id", table_name="eval_sub_indicators")
    op.drop_table("eval_sub_indicators")

    op.drop_index("ix_eval_categories_domain_id", table_name="eval_categories")
    op.drop_table("eval_categories")

    op.drop_table("eval_domains")