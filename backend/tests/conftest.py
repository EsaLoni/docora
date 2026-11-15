"""Pytest Fixtures and Test Configuration for UDIP Backend.

Sets up isolated async SQLite test database, table schemas, dependency overrides,
and helper factories for authenticating API test clients.
"""

import asyncio
from datetime import timedelta
import os
from typing import AsyncGenerator, Generator
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

# Force test environment variables before app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key-32-characters-minimum-for-testing!!"
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-min32chars-for-testing!!"
os.environ["ALLOW_DEV_AUTH"] = "false"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["DATABASE_SYNC_URL"] = "sqlite:///:memory:"
os.environ["EMBEDDING_PROVIDER"] = "mock"
os.environ["LLM_PROVIDER"] = "mock"

from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.exceptions import UDIPException
from app.core.security import create_access_token
from app.main import create_app
import app.models  # noqa: F401 - Register all models with Base.metadata
from app.models.base import Base
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Provide isolated test settings."""
    return get_settings()


@pytest.fixture
def test_db_engine():
    """Create an isolated in-memory SQLite async engine with static pool for connection persistence."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    # Initialize all 14 schemas
    async def init_models():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(init_models())
    yield engine

    async def drop_models():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    asyncio.run(drop_models())


@pytest.fixture
def session_factory(test_db_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Return async sessionmaker bound to the test database engine."""
    return async_sessionmaker(
        bind=test_db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


@pytest.fixture
def app(test_settings: Settings, session_factory: async_sessionmaker[AsyncSession]) -> FastAPI:
    """Create test application instance with database override and diagnostic test endpoints."""
    test_app = create_app(settings=test_settings)

    # Dependency override for database sessions
    async def override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    test_app.dependency_overrides[get_db_session] = override_get_db_session

    # Attach test error endpoints to verify exception handlers
    @test_app.get("/api/v1/test-error/domain")
    def trigger_domain_error():
        raise UDIPException(
            message="Test domain error message",
            status_code=400,
            error_code="TEST_DOMAIN_ERROR",
            details={"field": "test_field"},
        )

    @test_app.get("/api/v1/test-error/unhandled")
    def trigger_unhandled_error():
        raise RuntimeError("Simulated unexpected crash")

    return test_app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Provide synchronous TestClient for testing API endpoints."""
    from app.services.llm.factory import LLMProviderFactory
    LLMProviderFactory.reset()
    return TestClient(app, base_url="http://testserver", raise_server_exceptions=False)


def make_test_token(
    user_id: str,
    email: str = "test@udip.local",
    secret: str = "test-supabase-jwt-secret-min32chars-for-testing!!",
    algorithm: str = "HS256",
    role: str = "authenticated",
    audience: str = "authenticated",
    expires_delta: timedelta = timedelta(hours=1),
) -> str:
    """Utility to generate a signed test JWT."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "aud": audience,
        "user_metadata": {"full_name": "Test User", "email": email},
    }
    return create_access_token(
        data=payload,
        secret=secret,
        algorithm=algorithm,
        expires_delta=expires_delta,
    )
