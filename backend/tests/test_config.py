"""Configuration Validation Tests."""

import os
import pytest
from pydantic import SecretStr
from app.core.config import Settings, get_settings


def test_config_defaults(test_settings: Settings):
    """Verify default configuration values."""
    assert test_settings.APP_NAME == "Docora"
    assert test_settings.VECTOR_DIMENSION == 384
    assert test_settings.EMBEDDING_MODEL_NAME == "sentence-transformers/all-MiniLM-L6-v2"
    assert test_settings.MAX_UPLOAD_SIZE_BYTES > 0


def test_secrets_are_masked():
    """Verify SecretStr fields do not reveal plain text in str() or repr()."""
    settings = Settings(
        SECRET_KEY=SecretStr("super-confidential-secret-key-1234567"),
        SUPABASE_SERVICE_ROLE_KEY=SecretStr("super-secret-service-role-key"),
    )
    # str and repr must mask
    assert "super-confidential" not in str(settings.SECRET_KEY)
    assert "super-confidential" not in repr(settings.SECRET_KEY)
    assert "**********" in str(settings.SECRET_KEY) or "**********" in repr(settings.SECRET_KEY)

    # get_secret_value returns plain text securely
    assert settings.SECRET_KEY.get_secret_value() == "super-confidential-secret-key-1234567"


def test_cors_origins_parsing():
    """Verify CORS origins string is parsed correctly."""
    # Test JSON string format
    s1 = Settings(ALLOWED_ORIGINS='["http://example.com", "http://test.com"]')
    assert "http://example.com" in s1.ALLOWED_ORIGINS
    assert "http://test.com" in s1.ALLOWED_ORIGINS

    # Test comma-separated format
    s2 = Settings(ALLOWED_ORIGINS="http://alpha.com, http://beta.com")
    assert "http://alpha.com" in s2.ALLOWED_ORIGINS
    assert "http://beta.com" in s2.ALLOWED_ORIGINS


def test_safe_dict_excludes_secrets(test_settings: Settings):
    """Verify safe_dict() contains only public safe settings."""
    safe = test_settings.safe_dict()
    assert "secret_key" not in safe
    assert "supabase_service_role_key" not in safe
    assert "supabase_jwt_secret" not in safe


def test_public_config_endpoint(client):
    """Verify GET /api/v1/config/public returns safe platform metadata."""
    res = client.get("/api/v1/config/public")
    assert res.status_code == 200
    data = res.json()
    assert "api_url" in data
    assert "model_name" in data
    assert "model_label" in data
    assert len(data.get("supported_languages", [])) >= 5
    assert data["feature_flags"]["interactive_quiz"] is True
    assert data["feature_flags"]["command_palette"] is True

    assert "llm_api_key" not in data
    assert "supabase_jwt_secret" not in data
