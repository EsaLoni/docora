"""Health Check API Tests."""

from fastapi.testclient import TestClient


def test_health_endpoint_success(client: TestClient):
    """Verify /api/v1/health returns 200 OK with expected schema and values."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "Docora" in data["app_name"]
    assert data["tagline"] == "Your documents. Your intelligence."
    assert data["version"] == "0.1.0"
    assert data["environment"] == "test"
    assert data["uptime_seconds"] >= 0.0

    # Service status checks
    services = data["services"]
    assert services["api"] == "operational"
    assert services["database"] == "configured"
    assert services["storage"] in ["local", "supabase"]
    assert "pgvector_384d" in services["vector_engine"]
    assert services["llm_provider"] in ["mock", "ollama", "openai_compatible", "gemini"]


def test_health_endpoint_does_not_expose_secrets(client: TestClient):
    """Verify health endpoint never leaks secret keys or credentials."""
    response = client.get("/api/v1/health")
    raw_text = response.text.lower()

    # Assert no sensitive patterns appear in output
    assert "secret" not in raw_text
    assert "password" not in raw_text
    assert "service_role" not in raw_text
    assert "jwt_secret" not in raw_text
    assert "api_key" not in raw_text
