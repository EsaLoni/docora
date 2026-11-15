"""Tests for Cookie Authentication and CSRF Protection."""

import uuid
import pytest
from fastapi.testclient import TestClient


def test_cookie_login_and_logout_flow(client: TestClient):
    # Register a unique user
    unique_email = f"cookie_user_{uuid.uuid4().hex[:6]}@example.com"
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "SecurePassword123!"},
    )
    assert reg_resp.status_code == 201
    # Verify access_token and csrf_token cookies are set
    assert "access_token" in reg_resp.cookies
    assert "csrf_token" in reg_resp.cookies

    # Logout clears cookies
    logout_resp = client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200


def test_csrf_protection_on_cookie_auth(client: TestClient):
    # Register user to get cookie
    email = f"csrf_test_{uuid.uuid4().hex[:6]}@example.com"
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!"},
    )
    assert reg.status_code == 201
    csrf_token = reg.cookies.get("csrf_token")
    access_token = reg.cookies.get("access_token")
    assert csrf_token is not None
    assert access_token is not None

    # State changing request using cookies but without X-CSRF-Token should be rejected 403
    bad_req = client.post(
        "/api/v1/notebooks",
        json={"title": "Unauthorized Notebook"},
        cookies={"access_token": access_token, "csrf_token": csrf_token},
    )
    assert bad_req.status_code == 403
    assert "CSRF_VALIDATION_FAILED" in bad_req.text

    # State changing request using cookies WITH matching X-CSRF-Token should succeed
    good_req = client.post(
        "/api/v1/notebooks",
        json={"title": "Protected Notebook"},
        cookies={"access_token": access_token, "csrf_token": csrf_token},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert good_req.status_code == 201
    assert good_req.json()["title"] == "Protected Notebook"
