"""Database Connectivity & Session Management.

Provides async SQLAlchemy 2.0 engine, connection pooling, session dependency,
and synchronous engine support for Alembic migrations.
"""

from typing import AsyncGenerator, Optional
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger("database")

# Global engine and session factory caches
_async_engine: Optional[AsyncEngine] = None
_async_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_async_engine(settings: Optional[Settings] = None) -> AsyncEngine:
    """Create or return cached asynchronous SQLAlchemy engine."""
    global _async_engine
    if _async_engine is None:
        if settings is None:
            settings = get_settings()

        db_url = settings.DATABASE_URL
        is_sqlite = db_url.startswith("sqlite")

        if settings.ENVIRONMENT == "production" and is_sqlite:
            raise RuntimeError(
                "Database violation: SQLite cannot be used in production environments. "
                "Please configure PostgreSQL 16 + pgvector."
            )

        engine_kwargs = {
            "echo": settings.DEBUG,
            "future": True,
        }

        if is_sqlite:
            # SQLite does not support standard server connection pooling
            engine_kwargs["poolclass"] = NullPool
        else:
            # PostgreSQL connection pool configuration
            engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
            engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
            engine_kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
            engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE
            engine_kwargs["pool_pre_ping"] = True

            # If connecting to Supabase transaction pooler (port 6543), pgbouncer,
            # or transaction pooling mode, disable statement caching to prevent
            # asyncpg DuplicatePreparedStatementError / InvalidSQLStatementNameError.
            # Notice: prepared_statement_cache_size controls SQLAlchemy's asyncpg dialect LRU cache,
            # while statement_cache_size controls asyncpg's internal driver cache.
            # Neither is passed to PostgreSQL server_settings.
            if (
                ":6543" in db_url
                or "pooler.supabase.com" in db_url
                or "pgbouncer" in db_url
                or "pool_mode=transaction" in db_url
            ):
                connect_args = engine_kwargs.setdefault("connect_args", {})
                connect_args.setdefault("prepared_statement_cache_size", 0)
                connect_args.setdefault("statement_cache_size", 0)

        _async_engine = create_async_engine(db_url, **engine_kwargs)
        logger.info("Initialized async database engine (%s)", "sqlite" if is_sqlite else "postgresql")

    return _async_engine


def get_async_session_factory(settings: Optional[Settings] = None) -> async_sessionmaker[AsyncSession]:
    """Create or return cached sessionmaker factory."""
    global _async_session_factory
    if _async_session_factory is None:
        engine = get_async_engine(settings)
        _async_session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _async_session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an isolated async database session with automatic cleanup."""
    session_factory = get_async_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_sync_engine(settings: Optional[Settings] = None) -> Engine:
    """Create a synchronous engine for Alembic migrations and CLI operations."""
    if settings is None:
        settings = get_settings()

    sync_url = settings.DATABASE_SYNC_URL
    is_sqlite = sync_url.startswith("sqlite")

    engine_kwargs = {
        "echo": settings.DEBUG,
        "future": True,
    }

    if is_sqlite:
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
        engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
        engine_kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
        engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE
        engine_kwargs["pool_pre_ping"] = True

    return create_engine(sync_url, **engine_kwargs)


async def close_db_connections() -> None:
    """Gracefully close and dispose the async engine connections."""
    global _async_engine, _async_session_factory
    if _async_engine is not None:
        logger.info("Disposing async database engine connections...")
        await _async_engine.dispose()
        _async_engine = None
        _async_session_factory = None
        logger.info("Database connections safely disposed")


def reset_db_connections_for_tests() -> None:
    """Reset cached engines and session makers for isolated unit testing."""
    global _async_engine, _async_session_factory
    _async_engine = None
    _async_session_factory = None
