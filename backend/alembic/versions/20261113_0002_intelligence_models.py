"""Add document intelligence models.

Creates document_summaries, document_comparisons, document_insights, and intelligence_jobs tables.

Revision ID: 20261113_0002
Revises: 20261113_0001
Create Date: 2026-11-13 20:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = '20261113_0002'
down_revision: Union[str, None] = '20261113_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. document_summaries table
    op.create_table(
        "document_summaries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()") if is_postgres else None),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("summary_type", sa.String(50), nullable=False),
        sa.Column("custom_instruction", sa.Text(), nullable=True),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("structured_data", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("citations", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("model", sa.String(100), nullable=False, server_default="unknown"),
        sa.Column("provider", sa.String(100), nullable=False, server_default="unknown"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_document_summaries_workspace_id", "document_summaries", ["workspace_id"])
    op.create_index("ix_document_summaries_document_id", "document_summaries", ["document_id"])
    op.create_index("ix_document_summaries_summary_type", "document_summaries", ["summary_type"])

    # 2. document_comparisons table
    op.create_table(
        "document_comparisons",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()") if is_postgres else None),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_ids", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("comparison_type", sa.String(50), nullable=False, server_default="comprehensive"),
        sa.Column("custom_prompt", sa.Text(), nullable=True),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("structured_differences", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("citations", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("model", sa.String(100), nullable=False, server_default="unknown"),
        sa.Column("provider", sa.String(100), nullable=False, server_default="unknown"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_document_comparisons_workspace_id", "document_comparisons", ["workspace_id"])
    op.create_index("ix_document_comparisons_comparison_type", "document_comparisons", ["comparison_type"])

    # 3. document_insights table
    op.create_table(
        "document_insights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()") if is_postgres else None),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("insight_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False, server_default="directly_extracted_fact"),
        sa.Column("evidence_text", sa.Text(), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("citations", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_document_insights_workspace_id", "document_insights", ["workspace_id"])
    op.create_index("ix_document_insights_document_id", "document_insights", ["document_id"])
    op.create_index("ix_document_insights_insight_type", "document_insights", ["insight_type"])

    # 4. intelligence_jobs table
    op.create_table(
        "intelligence_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()") if is_postgres else None),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("document_ids", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("status", sa.String(50), nullable=False, server_default="QUEUED"),
        sa.Column("progress_percentage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("parameters_json", JSONB if is_postgres else sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("result_json", JSONB if is_postgres else sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_intelligence_jobs_workspace_id", "intelligence_jobs", ["workspace_id"])
    op.create_index("ix_intelligence_jobs_job_type", "intelligence_jobs", ["job_type"])
    op.create_index("ix_intelligence_jobs_status", "intelligence_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("intelligence_jobs")
    op.drop_table("document_insights")
    op.drop_table("document_comparisons")
    op.drop_table("document_summaries")
