"""add contracts JSON + ISO 날짜 이관

Revision ID: y8z9a0b1c2d3
Revises: x7y8z9a0b1c2
Create Date: 2026-07-09
"""
import json
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'y8z9a0b1c2d3'
down_revision = 'x7y8z9a0b1c2'
branch_labels = None
depends_on = None


def _iso(d):
    """'26.04.01' -> '2026-04-01'; 'X'/빈값 -> None; 이미 ISO면 그대로."""
    d = (d or "").strip()
    if not d or d.upper() == "X":
        return None
    if "-" in d and d[:4].isdigit():
        return d
    parts = d.replace("/", ".").split(".")
    if len(parts) == 3:
        y, m, dd = [p.strip() for p in parts]
        if len(y) == 2:
            y = "20" + y
        try:
            return f"{int(y):04d}-{int(m):02d}-{int(dd):02d}"
        except Exception:
            return None
    return None


def _parse_periods(text):
    """'26.04.01~26.06.30\\n26.07.01~27.03.31' -> [{start,end}, ...]"""
    out = []
    for line in (text or "").replace("\r", "").split("\n"):
        line = line.strip()
        if not line:
            continue
        if "~" in line:
            a, b = line.split("~", 1)
            s, e = _iso(a), _iso(b)
        else:
            s, e = _iso(line), None
        if s or e:
            out.append({"start": s, "end": e})
    return out


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("staff_hr_records")]
    if "contracts" not in cols:
        op.add_column("staff_hr_records", sa.Column("contracts", sa.JSON(), nullable=True))

    # 기존 데이터 → ISO 변환 + contracts 채우기
    rows = bind.execute(sa.text(
        "SELECT id, hire_date, renewal_date, contract_period, contracts FROM staff_hr_records"
    )).fetchall()
    for r in rows:
        rid = r[0]
        existing_contracts = r[4]
        contracts = _parse_periods(r[3]) if not existing_contracts else existing_contracts
        bind.execute(
            sa.text("UPDATE staff_hr_records SET hire_date=:h, renewal_date=:rn, contracts=:c WHERE id=:id"),
            {"h": _iso(r[1]), "rn": _iso(r[2]), "c": json.dumps(contracts, ensure_ascii=False), "id": rid},
        )


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("staff_hr_records")]
    if "contracts" in cols:
        op.drop_column("staff_hr_records", "contracts")
