from alembic import op
import sqlalchemy as sa

revision = "k1l2m3n4o5p6"
down_revision = "j1e2f3a4b5c6"
branch_labels = None
depends_on = None


def _has_column(table: str, col: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return col in [c["name"] for c in inspector.get_columns(table)]


def _has_index(table: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return index_name in [i["name"] for i in inspector.get_indexes(table)]


def upgrade():
    if not _has_column("checklist_items", "assigned_user_id"):
        op.add_column(
            "checklist_items",
            sa.Column("assigned_user_id", sa.String(), nullable=True),
        )

    if not _has_index("checklist_items", "ix_checklist_items_assigned_user_id"):
        op.create_index(
            "ix_checklist_items_assigned_user_id",
            "checklist_items",
            ["assigned_user_id"],
            unique=False,
        )


def downgrade():
    if _has_index("checklist_items", "ix_checklist_items_assigned_user_id"):
        op.drop_index(
            "ix_checklist_items_assigned_user_id",
            table_name="checklist_items",
        )

    if _has_column("checklist_items", "assigned_user_id"):
        op.drop_column("checklist_items", "assigned_user_id")