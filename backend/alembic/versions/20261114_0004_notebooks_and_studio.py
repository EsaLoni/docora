"""Phase 11 Notebooks and Studio Artifacts.

Revision ID: 20261114_0004
Revises: 20261113_0003
Create Date: 2026-11-14 15:55:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261114_0004"
down_revision: Union[str, None] = "20261113_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. notebooks
    op.create_table(
        "notebooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False, default="Untitled Notebook"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_image_url", sa.String(512), nullable=True),
        sa.Column("color", sa.String(32), nullable=False, server_default="blue"),
        sa.Column("settings_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false", index=True),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("share_token", sa.String(64), nullable=True, unique=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 2. notebook_sources
    op.create_table(
        "notebook_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("notebook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("source_type", sa.String(32), nullable=False, server_default="document"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("url", sa.String(1024), nullable=True),
        sa.Column("raw_content", sa.Text(), nullable=True),
        sa.Column("is_active_for_queries", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("extraction_status", sa.String(32), nullable=False, server_default="completed"),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 3. notebook_notes
    op.create_table(
        "notebook_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("notebook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False, server_default="Untitled Note"),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("source_citations_json", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("color", sa.String(32), nullable=False, server_default="default"),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 4. studio_artifacts
    op.create_table(
        "studio_artifacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("notebook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("artifact_type", sa.String(32), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="completed", index=True),
        sa.Column("selected_source_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("data_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("export_file_path", sa.String(512), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("generation_time_ms", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 5. audio_generations
    op.create_table(
        "audio_generations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("artifact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("studio_artifacts.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("notebook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("format", sa.String(32), nullable=False, server_default="two_host_podcast"),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("voice_host_a", sa.String(64), nullable=False, server_default="en-US-GuyNeural"),
        sa.Column("voice_host_b", sa.String(64), nullable=False, server_default="en-US-JennyNeural"),
        sa.Column("dialogue_json", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("audio_file_path", sa.String(512), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("audio_format", sa.String(16), nullable=False, server_default="mp3"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audio_generations")
    op.drop_table("studio_artifacts")
    op.drop_table("notebook_notes")
    op.drop_table("notebook_sources")
    op.drop_table("notebooks")
