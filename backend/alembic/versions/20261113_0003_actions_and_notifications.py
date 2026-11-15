"""Add action items, suggestions, and notifications.

Creates action_items, action_suggestions, notifications, and notification_deliveries tables.
Augments reminders table with action_item_id, status, timezone, recurrence_rule, snooze_until, sent_at, notification_channels.

Revision ID: 20261113_0003
Revises: 20261113_0002
Create Date: 2026-11-13 20:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = '20261113_0003'
down_revision: Union[str, None] = '20261113_0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. action_items table
    op.create_table(
        "action_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()") if is_postgres else None),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("priority", sa.String(50), nullable=False, server_default="medium"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"),
        sa.Column("evidence_text", sa.Text(), nullable=True),
        sa.Column("origin", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_action_items_workspace_id", "action_items", ["workspace_id"])
    op.create_index("ix_action_items_user_id", "action_items", ["user_id"])
    op.create_index("ix_action_items_document_id", "action_items", ["document_id"])
    op.create_index("ix_action_items_status", "action_items", ["status"])
    op.create_index("ix_action_items_due_date", "action_items", ["due_date"])

    # 2. action_suggestions table
    op.create_table(
        "action_suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()") if is_postgres else None),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("proposed_due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_date_explicit", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("category", sa.String(50), nullable=False, server_default="obligation"),
        sa.Column("evidence_text", sa.Text(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False, server_default="0.9"),
        sa.Column("status", sa.String(50), nullable=False, server_default="suggested"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_action_suggestions_workspace_id", "action_suggestions", ["workspace_id"])
    op.create_index("ix_action_suggestions_document_id", "action_suggestions", ["document_id"])
    op.create_index("ix_action_suggestions_status", "action_suggestions", ["status"])

    # 3. Augment reminders table using batch mode
    with op.batch_alter_table("reminders") as batch_op:
        batch_op.add_column(sa.Column("action_item_id", UUID(as_uuid=True), sa.ForeignKey("action_items.id", ondelete="SET NULL"), nullable=True))
        batch_op.add_column(sa.Column("status", sa.String(50), nullable=False, server_default="scheduled"))
        batch_op.add_column(sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"))
        batch_op.add_column(sa.Column("recurrence_rule", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("snooze_until", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("notification_channels", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'[\"in_app\"]'")))
        batch_op.create_index("ix_reminders_status", ["status"])
        batch_op.create_index("ix_reminders_action_item_id", ["action_item_id"])

    # 4. notifications table
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()") if is_postgres else None),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_id", UUID(as_uuid=True), sa.ForeignKey("reminders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action_item_id", UUID(as_uuid=True), sa.ForeignKey("action_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(50), nullable=False, server_default="reminder"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_notifications_workspace_id", "notifications", ["workspace_id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    # 5. notification_deliveries table
    op.create_table(
        "notification_deliveries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()") if is_postgres else None),
        sa.Column("notification_id", UUID(as_uuid=True), sa.ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(50), nullable=False, server_default="in_app"),
        sa.Column("status", sa.String(50), nullable=False, server_default="delivered"),
        sa.Column("idempotency_key", sa.String(100), nullable=False, unique=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_notification_deliveries_notification_id", "notification_deliveries", ["notification_id"])
    op.create_index("ix_notification_deliveries_idempotency_key", "notification_deliveries", ["idempotency_key"])


def downgrade() -> None:
    op.drop_table("notification_deliveries")
    op.drop_table("notifications")
    with op.batch_alter_table("reminders") as batch_op:
        batch_op.drop_index("ix_reminders_action_item_id")
        batch_op.drop_index("ix_reminders_status")
        batch_op.drop_column("notification_channels")
        batch_op.drop_column("sent_at")
        batch_op.drop_column("snooze_until")
        batch_op.drop_column("recurrence_rule")
        batch_op.drop_column("timezone")
        batch_op.drop_column("status")
        batch_op.drop_column("action_item_id")
    op.drop_table("action_suggestions")
    op.drop_table("action_items")
