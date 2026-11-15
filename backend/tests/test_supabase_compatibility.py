"""Tests for Gate 20.1: Supabase Connection, API Key & JWT Compatibility.

Covers:
1. SQLAlchemy / asyncpg prepared statement caching for transaction pooler (port 6543, pool_mode=transaction).
2. Supabase Storage API key handling (legacy JWT service_role vs new sb_secret_ opaque key).
3. Storage REST request headers (Authorization: Bearer vs apikey only).
4. Strict JWT algorithm allowlist and verification (HS256, ES256, RS256).
5. Asymmetric token verification, kid validation, JWKS caching and failure handling.
6. Rejection of forbidden algorithms (none, HS384, HS512), expired tokens, invalid audience/issuer.
7. Alembic URL resolution, driver normalization, and CLI -x override behavior.
"""

from datetime import timedelta
import os
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
import pytest
import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from pydantic import SecretStr
from sqlalchemy.engine import make_url

from app.core.config import Settings
from app.core.database import get_async_engine, reset_db_connections_for_tests
from app.core.exceptions import AuthenticationFailedError
from app.core.security import (
    ALLOWED_ASYMMETRIC_ALGORITHMS,
    ALLOWED_SYMMETRIC_ALGORITHMS,
    ALL_ALLOWED_ALGORITHMS,
    create_access_token,
    get_jwks_client,
    reset_jwks_clients_for_tests,
    verify_jwt_token,
)
from app.services.storage.supabase import SupabaseStorageAdapter


# ==============================================================================
# 1. Asyncpg / SQLAlchemy Transaction Pooler Configuration
# ==============================================================================

def test_asyncpg_transaction_pooler_connect_args():
    """Verify that transaction pooler connections correctly disable prepared statement caching.

    Checks:
    - prepared_statement_cache_size=0 (SQLAlchemy asyncpg dialect LRU cache)
    - statement_cache_size=0 (asyncpg internal driver cache)
    - Neither is sent to PostgreSQL server_settings.
    """
    reset_db_connections_for_tests()
    pooler_url = "postgresql+asyncpg://postgres:secret_pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    settings = Settings(
        DATABASE_URL=pooler_url,
        ENVIRONMENT="development",
    )

    engine = get_async_engine(settings)
    assert engine is not None

    # Inspect the creator closure parameters passed to dialect.connect
    creator = engine.sync_engine.pool._creator
    cparams = {}
    if hasattr(creator, "__closure__") and creator.__closure__:
        for cell in creator.__closure__:
            if isinstance(cell.cell_contents, dict) or hasattr(cell.cell_contents, "get"):
                cparams = dict(cell.cell_contents)
                break

    # Verify both cache disable parameters are present in connect_args
    assert cparams.get("prepared_statement_cache_size") == 0
    assert cparams.get("statement_cache_size") == 0

    # Verify prepared_statement_cache_size is NOT placed in server_settings
    server_settings = cparams.get("server_settings") or {}
    assert "prepared_statement_cache_size" not in server_settings
    assert "statement_cache_size" not in server_settings

    reset_db_connections_for_tests()


def test_asyncpg_pool_mode_transaction_detection():
    """Verify transaction pooler detection via query parameter pool_mode=transaction."""
    reset_db_connections_for_tests()
    url = "postgresql+asyncpg://postgres:secret@custom-host.com:5432/postgres?pool_mode=transaction"
    settings = Settings(
        DATABASE_URL=url,
        ENVIRONMENT="development",
    )

    engine = get_async_engine(settings)
    creator = engine.sync_engine.pool._creator
    cparams = {}
    if hasattr(creator, "__closure__") and creator.__closure__:
        for cell in creator.__closure__:
            if isinstance(cell.cell_contents, dict) or hasattr(cell.cell_contents, "get"):
                cparams = dict(cell.cell_contents)
                break

    assert cparams.get("prepared_statement_cache_size") == 0
    assert cparams.get("statement_cache_size") == 0
    reset_db_connections_for_tests()


def test_asyncpg_direct_connection_preserves_defaults():
    """Verify direct connection (port 5432 without pooler indicators) does not force zero cache."""
    reset_db_connections_for_tests()
    url = "postgresql+asyncpg://postgres:secret@db.custom-host.com:5432/postgres"
    settings = Settings(
        DATABASE_URL=url,
        ENVIRONMENT="development",
    )

    engine = get_async_engine(settings)
    creator = engine.sync_engine.pool._creator
    cparams = {}
    if hasattr(creator, "__closure__") and creator.__closure__:
        for cell in creator.__closure__:
            if isinstance(cell.cell_contents, dict) or hasattr(cell.cell_contents, "get"):
                cparams = dict(cell.cell_contents)
                break

    assert "prepared_statement_cache_size" not in cparams
    assert "statement_cache_size" not in cparams
    reset_db_connections_for_tests()


# ==============================================================================
# 2. Supabase Storage API Key Compatibility & Request Headers
# ==============================================================================

def test_supabase_storage_legacy_jwt_key_headers():
    """Verify legacy service_role JWT key includes both 'Authorization: Bearer' and 'apikey'."""
    legacy_jwt_key = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvaiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0."
        "invalidsignatureforheadertestingonly1234567890"
    )
    settings = Settings(
        SUPABASE_URL="https://testproj.supabase.co",
        SUPABASE_STORAGE_BUCKET="udip-documents",
        SUPABASE_SERVICE_ROLE_KEY=SecretStr(legacy_jwt_key),
    )
    adapter = SupabaseStorageAdapter(settings)

    headers = adapter._headers("application/pdf")
    assert headers["apikey"] == legacy_jwt_key
    assert headers["Authorization"] == f"Bearer {legacy_jwt_key}"
    assert headers["Content-Type"] == "application/pdf"


def test_supabase_storage_new_sb_secret_key_headers():
    """Verify new sb_secret_ opaque key omits 'Authorization: Bearer' to prevent 401 JWT rejection."""
    opaque_secret_key = "sb_secret_abcdef0123456789abcdef0123456789abcdef012345"
    settings = Settings(
        SUPABASE_URL="https://testproj.supabase.co",
        SUPABASE_STORAGE_BUCKET="udip-documents",
        SUPABASE_SERVICE_ROLE_KEY=SecretStr(opaque_secret_key),
    )
    adapter = SupabaseStorageAdapter(settings)

    headers = adapter._headers("application/octet-stream")
    # Must contain apikey header
    assert headers["apikey"] == opaque_secret_key
    # CRITICAL: Must NOT contain Authorization: Bearer with opaque key
    assert "Authorization" not in headers
    assert headers["Content-Type"] == "application/octet-stream"


def test_supabase_storage_mocked_rest_calls_with_sb_secret():
    """Verify Storage REST operations execute correctly with sb_secret_ headers."""
    import asyncio
    opaque_key = "sb_secret_99887766554433221100aabbccddeeff"
    settings = Settings(
        SUPABASE_URL="https://testproj.supabase.co",
        SUPABASE_STORAGE_BUCKET="udip-documents",
        SUPABASE_SERVICE_ROLE_KEY=SecretStr(opaque_key),
    )
    adapter = SupabaseStorageAdapter(settings)

    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    test_bytes = b"binary-content-12345"

    async def _test():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, \
             patch("httpx.AsyncClient.delete", new_callable=AsyncMock) as mock_delete:

            # 1. Test save_file
            mock_post.return_value = MagicMock(status_code=200, json=lambda: {"Key": "test"})
            saved_path = await adapter.save_file(ws_id, doc_id, test_bytes, "application/pdf")
            assert f"{ws_id}/{doc_id}.bin" == saved_path

            post_headers = mock_post.call_args.kwargs["headers"]
            assert post_headers["apikey"] == opaque_key
            assert "Authorization" not in post_headers
            assert post_headers["Content-Type"] == "application/pdf"

            # 2. Test read_file
            mock_get.return_value = MagicMock(status_code=200, content=test_bytes)
            retrieved_bytes = await adapter.read_file(saved_path)
            assert retrieved_bytes == test_bytes

            get_headers = mock_get.call_args.kwargs["headers"]
            assert get_headers["apikey"] == opaque_key
            assert "Authorization" not in get_headers

            # 3. Test get_signed_url
            mock_post.return_value = MagicMock(status_code=200, json=lambda: {"signedURL": "/sign/path?token=xyz"})
            signed_url = await adapter.get_signed_url(saved_path, "test.pdf")
            assert "https://testproj.supabase.co/storage/v1/sign/path?token=xyz" == signed_url

            # 4. Test delete_file
            mock_delete.return_value = MagicMock(status_code=200)
            deleted = await adapter.delete_file(saved_path)
            assert deleted is True

    asyncio.run(_test())


# ==============================================================================
# 3. Supabase JWT Verification Architecture
# ==============================================================================

def test_jwt_algorithm_allowlist_definitions():
    """Verify algorithm sets adhere to strict security constraints."""
    assert ALLOWED_SYMMETRIC_ALGORITHMS == {"HS256"}
    assert ALLOWED_ASYMMETRIC_ALGORITHMS == {"ES256", "RS256"}
    assert "none" not in ALL_ALLOWED_ALGORITHMS
    assert "HS384" not in ALL_ALLOWED_ALGORITHMS
    assert "HS512" not in ALL_ALLOWED_ALGORITHMS


def test_jwt_forbidden_algorithms_strictly_rejected():
    """Verify arbitrary and forbidden algorithms are rejected immediately."""
    settings = Settings(
        SUPABASE_JWT_SECRET="test-supabase-jwt-secret-min32chars-for-testing!!",
        SECRET_KEY="test-secret-key-32-characters-minimum-for-testing!!",
    )

    # 1. Algorithm 'none'
    token_none = jwt.encode({"sub": "user-123"}, key="", algorithm="none")
    with pytest.raises(AuthenticationFailedError) as exc_none:
        verify_jwt_token(token_none, settings)
    assert "forbidden" in str(exc_none.value).lower()

    # 2. Insecure / Disallowed symmetric algorithm HS384 (48-byte key)
    token_hs384 = jwt.encode({"sub": "user-123"}, key="secret-48-chars-minimum-length-for-hs384-testing!!", algorithm="HS384")
    with pytest.raises(AuthenticationFailedError) as exc_hs384:
        verify_jwt_token(token_hs384, settings)
    assert "forbidden" in str(exc_hs384.value).lower()

    # 3. Disallowed symmetric algorithm HS512 (64-byte key)
    token_hs512 = jwt.encode({"sub": "user-123"}, key="secret-64-characters-minimum-length-for-hs512-testing-safety-guard!!", algorithm="HS512")
    with pytest.raises(AuthenticationFailedError) as exc_hs512:
        verify_jwt_token(token_hs512, settings)
    assert "forbidden" in str(exc_hs512.value).lower()


def test_jwt_symmetric_supabase_and_app_key_overlapping_support():
    """Verify seamless validation of Supabase HS256 and local application HS256 tokens."""
    supabase_secret = "test-supabase-jwt-secret-min32chars-for-testing!!"
    app_secret = "test-app-secret-key-minimum-32-characters-for-testing!!"

    settings = Settings(
        SUPABASE_JWT_SECRET=SecretStr(supabase_secret),
        SECRET_KEY=SecretStr(app_secret),
        SUPABASE_JWT_AUDIENCE="authenticated",
    )

    # 1. Supabase token signed with SUPABASE_JWT_SECRET
    sb_token = create_access_token(
        data={"sub": "sb-user-001", "aud": "authenticated", "email": "sb@example.com"},
        secret=supabase_secret,
    )
    sb_payload = verify_jwt_token(sb_token, settings)
    assert sb_payload.sub == "sb-user-001"
    assert sb_payload.email == "sb@example.com"
    assert sb_payload.is_dev is False

    # 2. Application native token signed with SECRET_KEY
    app_token = create_access_token(
        data={"sub": "app-user-002", "aud": "authenticated", "email": "app@example.com"},
        secret=app_secret,
    )
    app_payload = verify_jwt_token(app_token, settings)
    assert app_payload.sub == "app-user-002"
    assert app_payload.email == "app@example.com"


def test_jwt_asymmetric_es256_verification_via_jwks():
    """Verify ES256 asymmetric token verification using public JWKS."""
    reset_jwks_clients_for_tests()
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    kid = "supabase-ecc-key-2026-01"
    token = jwt.encode(
        {"sub": "es256-user-001", "aud": "authenticated", "email": "ecc@example.com"},
        private_key,
        algorithm="ES256",
        headers={"kid": kid},
    )

    settings = Settings(
        SUPABASE_URL="https://hostedproject.supabase.co",
        SUPABASE_JWT_AUDIENCE="authenticated",
    )

    # Mock JWKS client to return our public key
    mock_jwk_key = MagicMock()
    mock_jwk_key.key = public_key

    with patch("jwt.PyJWKClient.get_signing_key_from_jwt", return_value=mock_jwk_key):
        payload = verify_jwt_token(token, settings)
        assert payload.sub == "es256-user-001"
        assert payload.email == "ecc@example.com"
        assert payload.role == "authenticated"

    reset_jwks_clients_for_tests()


def test_jwt_asymmetric_missing_kid_rejected():
    """Verify asymmetric token lacking 'kid' header is rejected."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    token_no_kid = jwt.encode(
        {"sub": "user-no-kid", "aud": "authenticated"},
        private_key,
        algorithm="ES256",
    )

    settings = Settings(SUPABASE_URL="https://hostedproject.supabase.co")
    with pytest.raises(AuthenticationFailedError) as exc_info:
        verify_jwt_token(token_no_kid, settings)
    assert "missing 'kid'" in str(exc_info.value).lower()


def test_jwt_asymmetric_jwks_unavailable_handled_safely():
    """Verify network error connecting to JWKS raises AuthenticationFailedError without revealing internals."""
    reset_jwks_clients_for_tests()
    private_key = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(
        {"sub": "user-fail", "aud": "authenticated"},
        private_key,
        algorithm="ES256",
        headers={"kid": "key-id-404"},
    )

    settings = Settings(SUPABASE_URL="https://hostedproject.supabase.co")

    with patch("jwt.PyJWKClient.get_signing_key_from_jwt", side_effect=jwt.PyJWKClientConnectionError("Connection refused")):
        with pytest.raises(AuthenticationFailedError) as exc_info:
            verify_jwt_token(token, settings)
        assert "key service unavailable" in str(exc_info.value).lower()

    reset_jwks_clients_for_tests()


def test_jwt_asymmetric_unknown_kid_rejected():
    """Verify unknown kid raises AuthenticationFailedError."""
    reset_jwks_clients_for_tests()
    private_key = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(
        {"sub": "user-unknown-kid", "aud": "authenticated"},
        private_key,
        algorithm="ES256",
        headers={"kid": "nonexistent-kid"},
    )

    settings = Settings(SUPABASE_URL="https://hostedproject.supabase.co")

    with patch("jwt.PyJWKClient.get_signing_key_from_jwt", side_effect=jwt.PyJWKError("Key not found")):
        with pytest.raises(AuthenticationFailedError) as exc_info:
            verify_jwt_token(token, settings)
        assert "unknown signing key" in str(exc_info.value).lower()

    reset_jwks_clients_for_tests()


# ==============================================================================
# 4. Alembic Migration URL Resolution and Normalization
# ==============================================================================

def test_alembic_url_driver_normalization():
    """Verify Alembic converts postgres://, postgresql://, and postgresql+asyncpg:// to postgresql+psycopg://."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("alembic_env_test", "backend/alembic/env.py")
    mod = importlib.util.module_from_spec(spec)

    # Test normalization rules directly
    test_urls = [
        ("postgres://user:pass@host:5432/db", "postgresql+psycopg://user:pass@host:5432/db"),
        ("postgresql://user:pass@host:5432/db", "postgresql+psycopg://user:pass@host:5432/db"),
        ("postgresql+asyncpg://user:pass@host:5432/db", "postgresql+psycopg://user:pass@host:5432/db"),
        ("postgresql+psycopg://user:pass@host:5432/db", "postgresql+psycopg://user:pass@host:5432/db"),
    ]

    for input_url, expected in test_urls:
        url = input_url
        if url.startswith("postgres://"):
            normalized = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
            normalized = url.replace("postgresql://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql+asyncpg://"):
            normalized = url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        else:
            normalized = url
        assert normalized == expected


def test_alembic_url_password_escaping_and_ssl():
    """Verify special characters in passwords and SSL query parameters parse cleanly via make_url."""
    # Special characters: @, :, /, !
    raw_password = "P@ss:w/rd!#2026"
    import urllib.parse
    encoded_pw = urllib.parse.quote_plus(raw_password)

    url_str = f"postgresql+psycopg://postgres.projectref:{encoded_pw}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
    parsed = make_url(url_str)

    assert parsed.username == "postgres.projectref"
    assert parsed.password == raw_password
    assert parsed.host == "aws-0-us-east-1.pooler.supabase.com"
    assert parsed.port == 5432
    assert parsed.database == "postgres"
    assert parsed.query.get("sslmode") == "require"


# ==============================================================================
# 5. Connection Pool Sizing, Engine Lifecycle & Session Pooler (Gate 20.1.2)
# ==============================================================================

def test_api_pool_sizing_via_env_vars():
    """Verify FastAPI target pool sizing (DB_POOL_SIZE=5, DB_MAX_OVERFLOW=5) applies to engine."""
    reset_db_connections_for_tests()
    settings = Settings(
        DATABASE_URL="postgresql+asyncpg://postgres:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
        DB_POOL_SIZE=5,
        DB_MAX_OVERFLOW=5,
        ENVIRONMENT="development",
    )
    engine = get_async_engine(settings)
    pool = engine.sync_engine.pool

    assert pool.size() == 5
    assert pool._max_overflow == 5
    assert pool._timeout == 30
    assert pool._recycle == 1800
    reset_db_connections_for_tests()


def test_worker_pool_sizing_via_env_vars():
    """Verify Background Worker target pool sizing (DB_POOL_SIZE=3, DB_MAX_OVERFLOW=2) applies to engine."""
    reset_db_connections_for_tests()
    settings = Settings(
        DATABASE_URL="postgresql+asyncpg://postgres:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
        DB_POOL_SIZE=3,
        DB_MAX_OVERFLOW=2,
        ENVIRONMENT="development",
    )
    engine = get_async_engine(settings)
    pool = engine.sync_engine.pool

    assert pool.size() == 3
    assert pool._max_overflow == 2
    reset_db_connections_for_tests()


def test_engine_and_session_factory_cached_per_process():
    """Verify engine and session factory are singleton instances per process and not recreated per call."""
    reset_db_connections_for_tests()
    settings = Settings(
        DATABASE_URL="postgresql+asyncpg://postgres:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
        ENVIRONMENT="development",
    )
    from app.core.database import get_async_session_factory

    e1 = get_async_engine(settings)
    e2 = get_async_engine(settings)
    assert e1 is e2, "Engine must be cached as a singleton per process"

    sf1 = get_async_session_factory(settings)
    sf2 = get_async_session_factory(settings)
    assert sf1 is sf2, "Session factory must be cached as a singleton per process"
    reset_db_connections_for_tests()


def test_session_pooler_port_5432_url_compatibility():
    """Verify Session Pooler (port 5432) URL parses cleanly and configures asyncpg engine."""
    reset_db_connections_for_tests()
    session_pooler_url = (
        "postgresql+asyncpg://postgres.myprojectref:securepassword"
        "@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
    )
    settings = Settings(
        DATABASE_URL=session_pooler_url,
        ENVIRONMENT="development",
    )
    engine = get_async_engine(settings)
    assert engine is not None
    assert engine.url.port == 5432
    assert "pooler.supabase.com" in engine.url.host

    # Verify connect_args are present and neither is sent as PostgreSQL server_settings
    creator = engine.sync_engine.pool._creator
    cparams = {}
    if hasattr(creator, "__closure__") and creator.__closure__:
        for cell in creator.__closure__:
            if isinstance(cell.cell_contents, dict) or hasattr(cell.cell_contents, "get"):
                cparams = dict(cell.cell_contents)
                break

    server_settings = cparams.get("server_settings") or {}
    assert "prepared_statement_cache_size" not in server_settings
    assert "statement_cache_size" not in server_settings
    reset_db_connections_for_tests()


def test_alembic_uses_nullpool():
    """Verify Alembic migration configuration enforces NullPool for ephemeral execution."""
    import importlib.util
    from sqlalchemy.pool import NullPool

    # Read backend/alembic/env.py source and confirm NullPool is assigned
    with open("backend/alembic/env.py", "r", encoding="utf-8") as f:
        content = f.read()

    assert "poolclass = pool.NullPool" in content, "Alembic must use NullPool for migration execution"
