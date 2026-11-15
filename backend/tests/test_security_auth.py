"""Tests for JWT Authentication, Token Verification, Security Controls, and Inactive User Rejection."""

from datetime import timedelta
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.core.config import Settings
from app.core.security import create_access_token, verify_jwt_token
from app.models.user import User
from tests.conftest import make_test_token


def test_missing_auth_header_rejected(client: TestClient):
    """Verify endpoint rejects requests missing Authorization header with 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_FAILED"


def test_malformed_auth_header_rejected(client: TestClient):
    """Verify malformed authorization headers are rejected with 401."""
    response = client.get("/api/v1/auth/me", headers={"Authorization": "NotBearer 12345"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_FAILED"


def test_valid_supabase_token_authenticates(client: TestClient):
    """Verify valid Supabase JWT authenticates successfully and auto-provisions user profile."""
    uid = f"sub-{uuid.uuid4().hex[:12]}"
    email = f"user_{uuid.uuid4().hex[:8]}@company.com"
    token = make_test_token(user_id=uid, email=email)

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["is_active"] is True
    assert len(data["workspaces"]) >= 1
    assert data["workspaces"][0]["role"] == "owner"


def test_expired_jwt_rejected(client: TestClient):
    """Verify expired JWT is rejected with 401 Token has expired."""
    uid = f"sub-{uuid.uuid4().hex[:12]}"
    token = make_test_token(user_id=uid, expires_delta=timedelta(seconds=-10))

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"
    assert "expired" in data["error"]["message"].lower()


def test_invalid_signature_rejected(client: TestClient):
    """Verify token signed with forged secret is rejected with 401."""
    uid = f"sub-{uuid.uuid4().hex[:12]}"
    token = make_test_token(user_id=uid, secret="wrong-unauthorized-secret-key-32chars!")

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_FAILED"


def test_none_algorithm_tampering_rejected(client: TestClient):
    """Verify tokens attempting algorithm 'none' are rejected immediately."""
    import jwt
    payload = {"sub": "attacker", "email": "attacker@evil.com", "role": "authenticated"}
    token = jwt.encode(payload, key="", algorithm="none")

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_FAILED"


def test_invalid_audience_rejected(client: TestClient):
    """Verify token with mismatched audience claim is rejected with 401."""
    uid = f"sub-{uuid.uuid4().hex[:12]}"
    token = make_test_token(user_id=uid, audience="unexpected-audience")

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_FAILED"


def test_dev_token_endpoint_disabled_by_default(client: TestClient):
    """Verify dev-token endpoint is forbidden when ALLOW_DEV_AUTH is false."""
    response = client.post("/api/v1/auth/dev-token", json={"email": "developer@test.local"})
    assert response.status_code == 403
    assert "disabled" in response.json()["error"]["message"].lower()


def test_dev_token_issuance_and_auth_when_enabled(app, session_factory):
    """Verify local dev auth works when ALLOW_DEV_AUTH is explicitly set to True."""
    import asyncio
    custom_settings = Settings(
        ALLOW_DEV_AUTH=True,
        ENVIRONMENT="development",
        SECRET_KEY="test-secret-key-32-characters-minimum-for-testing!!",
        SUPABASE_JWT_SECRET="test-supabase-jwt-secret-min32chars-for-testing!!",
    )
    from app.core.config import get_settings
    app.dependency_overrides[get_settings] = lambda: custom_settings

    test_client = TestClient(app, base_url="http://testserver")

    # 1. Request dev token
    res = test_client.post("/api/v1/auth/dev-token", json={"email": "devuser@test.local"})
    assert res.status_code == 200
    token = res.json()["access_token"]

    # 2. Authenticate with dev token
    me_res = test_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "devuser@test.local"

    # Reset override
    app.dependency_overrides.pop(get_settings, None)


def test_deactivated_user_rejected(client: TestClient, session_factory: async_sessionmaker[AsyncSession]):
    """Verify deactivated user account (is_active=False) is rejected with 403 Forbidden."""
    import asyncio
    uid = f"sub-{uuid.uuid4().hex[:12]}"
    email = f"deactivated_{uuid.uuid4().hex[:8]}@company.com"
    token = make_test_token(user_id=uid, email=email)

    # 1. First sign in to create account
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    user_id = uuid.UUID(res.json()["id"])

    # 2. Deactivate user in database
    async def deactivate():
        async with session_factory() as s:
            await s.execute(update(User).where(User.id == user_id).values(is_active=False))
            await s.commit()

    asyncio.run(deactivate())

    # 3. Subsequent request must be rejected with 403
    res_deactivated = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_deactivated.status_code == 403
    assert "deactivated" in res_deactivated.json()["error"]["message"].lower()


def test_native_user_registration_and_login(client: TestClient):
    """Verify native user registration, password hashing, and login token issuance."""
    test_email = f"native_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePassword123!"
    full_name = "Jane Researcher"

    # 1. Register new user
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": test_email, "password": password, "full_name": full_name},
    )
    assert reg_res.status_code == 201, reg_res.text
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == test_email
    assert reg_data["user"]["full_name"] == full_name
    assert len(reg_data["user"]["workspaces"]) == 1
    assert reg_data["user"]["workspaces"][0]["is_owner"] is True

    # 2. Duplicate registration rejected
    dup_res = client.post(
        "/api/v1/auth/register",
        json={"email": test_email, "password": password},
    )
    assert dup_res.status_code == 400

    # 3. Login with correct password
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": password},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token

    # 4. Authenticate /me with login token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == test_email

    # 5. Login with invalid password rejected
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": "WrongPassword999!"},
    )
    assert bad_login.status_code == 401


def test_password_reset_workflow(client: TestClient):
    """Verify forgot-password and reset-password token verification."""
    test_email = f"reset_{uuid.uuid4().hex[:8]}@example.com"
    initial_pwd = "InitialPassword123!"
    new_pwd = "BrandNewSecurePassword456!"

    # Register user
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": test_email, "password": initial_pwd},
    )
    assert reg.status_code == 201

    # Request forgot-password token
    forgot = client.post("/api/v1/auth/forgot-password", json={"email": test_email})
    assert forgot.status_code == 200
    reset_token = forgot.json().get("reset_token")
    assert reset_token is not None

    # Reset password using token
    reset_res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": new_pwd},
    )
    assert reset_res.status_code == 200

    # Login with old password fails
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": initial_pwd},
    )
    assert old_login.status_code == 401

    # Login with new password succeeds
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": new_pwd},
    )
    assert new_login.status_code == 200


def test_logout_endpoint(client: TestClient):
    """Verify logout endpoint returns success."""
    res = client.post("/api/v1/auth/logout")
    assert res.status_code == 200
    assert res.json()["success"] is True

