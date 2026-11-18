"""Add last_login_at and login_count to users table.

Revision ID: 20261119_0006
Revises: 20261115_0005
"""

from alembic import op
import sqlalchemy as sa

revision = "20261119_0006"
down_revision = "20261115_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("login_count", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "login_count")
    op.drop_column("users", "last_login_at")
