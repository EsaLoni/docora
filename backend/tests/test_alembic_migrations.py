"""Tests for Alembic Migrations execution and rollback."""

import os
import tempfile
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_alembic_migration_lifecycle():
    """Verify that Alembic can migrate up to head and rollback to base cleanly."""
    temp_dir = tempfile.gettempdir()
    db_file = os.path.join(temp_dir, "test_migration.db")
    if os.path.exists(db_file):
        os.remove(db_file)

    try:
        # Configure Alembic to point to temp test database
        if os.path.exists("backend/alembic.ini"):
            ini_path = "backend/alembic.ini"
            script_loc = "backend/alembic"
        else:
            ini_path = "alembic.ini"
            script_loc = "alembic"

        cfg = Config(ini_path)
        cfg.set_main_option("script_location", script_loc)
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_file}")
        cfg.set_main_option("path_separator", "os")

        # 1. Upgrade to head
        command.upgrade(cfg, "head")

        # Verify all 14 tables were created
        engine = create_engine(f"sqlite:///{db_file}")
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        engine.dispose()

        expected_tables = {
            "users",
            "workspaces",
            "workspace_members",
            "folders",
            "documents",
            "document_pages",
            "document_chunks",
            "processing_jobs",
            "conversations",
            "messages",
            "citations",
            "extractions",
            "document_summaries",
            "document_comparisons",
            "document_insights",
            "intelligence_jobs",
            "action_items",
            "action_suggestions",
            "notifications",
            "notification_deliveries",
            "reminders",
            "audit_logs",
        }
        assert expected_tables.issubset(tables), f"Missing tables: {expected_tables - tables}"

        # 2. Downgrade to base
        command.downgrade(cfg, "base")

        # Verify tables were dropped
        engine = create_engine(f"sqlite:///{db_file}")
        inspector = inspect(engine)
        tables_after_downgrade = set(inspector.get_table_names())
        engine.dispose()

        assert len(tables_after_downgrade - {"alembic_version"}) == 0

    finally:
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
            except Exception:
                pass
