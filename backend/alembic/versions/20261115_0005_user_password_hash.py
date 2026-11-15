"""Add password_hash column to users table for native authentication.

Revision ID: 20261115_0005
Revises: 20261114_0004
Create Date: 2026-11-15 02:15:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20261115_0005"
down_revision: Union[str, None] = "20261114_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = [c["name"] for c in insp.get_columns("users")]
    if "password_hash" not in cols:
        op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = [c["name"] for c in insp.get_columns("users")]
    if "password_hash" in cols:
        op.drop_column("users", "password_hash")
