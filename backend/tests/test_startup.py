"""Application Startup and Lifecycle Tests."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app


def test_application_startup():
    """Verify application factory creates valid FastAPI instance with responsive routes."""
    app = create_app()
    assert isinstance(app, FastAPI)
    assert "Docora" in app.title

    with TestClient(app) as client:
        res = client.get("/api/v1/health")
        assert res.status_code == 200

        res_openapi = client.get("/api/v1/openapi.json")
        assert res_openapi.status_code == 200
        openapi_data = res_openapi.json()
        assert "/api/v1/health" in openapi_data.get("paths", {})


def test_custom_settings_injection():
    """Verify create_app respects custom injected settings."""
    custom_settings = Settings(
        APP_NAME="Custom UDIP Test",
        ENVIRONMENT="test",
        DEBUG=True,
    )
    custom_app = create_app(settings=custom_settings)
    assert custom_app.title == "Custom UDIP Test"
