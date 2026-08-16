"""납부 항목 ↔ 계약 연결

Revision ID: op26link009i
Revises: bc26tpl008h

계약 대장에 넣은 계약이 납부 대장에 안 나온다는 문제. 두 대장이 아무 관계 없이
따로 놀고 있었다. 계약에서 올라온 납부 항목을 표시해 두고 같이 움직이게 한다.
"""
from alembic import op
import sqlalchemy as sa

revision = "op26link009i"
down_revision = "bc26tpl008h"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("operation_pay_items", sa.Column("contract_id", sa.String(), nullable=True))
    op.create_index("ix_operation_pay_items_contract_id", "operation_pay_items", ["contract_id"])
    # 계약을 지워도 납부 기록은 남아야 한다 — 연결만 끊는다
    op.create_foreign_key("fk_pay_items_contract", "operation_pay_items",
                          "operation_contracts", ["contract_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_pay_items_contract", "operation_pay_items", type_="foreignkey")
    op.drop_index("ix_operation_pay_items_contract_id", table_name="operation_pay_items")
    op.drop_column("operation_pay_items", "contract_id")
