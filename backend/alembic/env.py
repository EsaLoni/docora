"""Alembic Environment Script.

Configures database migration context using UDIP models and configuration.
Supports offline SQL generation and online migration execution.
"""

import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from app.models import Base

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Model metadata for autogenerate support
target_metadata = Base.metadata


def get_sync_url() -> str:
    """Retrieve synchronous database URL from Alembic config, environment, or application settings."""
    import os

    # 0. Command-line argument override via -x url=...
    try:
        x_args = context.get_x_argument(as_dictionary=True)
        if x_args.get("url"):
            url = x_args["url"].strip()
            if url.startswith("postgres://"):
                return url.replace("postgres://", "postgresql+psycopg://", 1)
            if url.startswith("postgresql://") and not url.startswith("postgresql+"):
                return url.replace("postgresql://", "postgresql+psycopg://", 1)
            if url.startswith("postgresql+asyncpg://"):
                return url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
            return url
    except Exception:
        pass

    # 1. Main option from Alembic Config (set dynamically in alembic.ini or programmatically by test suites)
    main_url = config.get_main_option("sqlalchemy.url")
    if main_url and main_url.strip():
        url = main_url.strip()
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        return url

    # 2. Direct environment variable overrides
    env_override = os.environ.get("ALEMBIC_DATABASE_URL") or os.environ.get("DATABASE_SYNC_URL")
    if env_override:
        if env_override.startswith("postgres://"):
            return env_override.replace("postgres://", "postgresql+psycopg://", 1)
        if env_override.startswith("postgresql://") and not env_override.startswith("postgresql+"):
            return env_override.replace("postgresql://", "postgresql+psycopg://", 1)
        if env_override.startswith("postgresql+asyncpg://"):
            return env_override.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        return env_override

    # 3. Application settings
    settings = get_settings()
    if hasattr(settings, "ALEMBIC_DATABASE_URL") and settings.ALEMBIC_DATABASE_URL:
        return settings.ALEMBIC_DATABASE_URL
    if settings.DATABASE_SYNC_URL and settings.DATABASE_SYNC_URL.strip():
        return settings.DATABASE_SYNC_URL.strip()

    return "sqlite:///storage/udip.db"


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and emits SQL DDL to standard output.
    """
    url = get_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Creates an Engine and associates a connection with the context.
    """
    url = get_sync_url()
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = url

    # For migrations, always use NullPool to ensure connections are closed
    # immediately upon completion without occupying slots in the database pooler.
    poolclass = pool.NullPool

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=poolclass,
    )

    with connectable.connect() as connection:
        # Enable pgvector on PostgreSQL
        if connection.dialect.name == "postgresql":
            connection.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector;")

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
