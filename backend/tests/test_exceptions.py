"""Centralized Exception Handling Tests."""

from fastapi.testclient import TestClient


def test_domain_exception_handling(client: TestClient):
    """Verify custom UDIPException produces structured JSON response."""
    response = client.get("/api/v1/test-error/domain")
    assert response.status_code == 400

    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "TEST_DOMAIN_ERROR"
    assert "Test domain error message" in data["error"]["message"]
    assert data["error"]["details"]["field"] == "test_field"


def test_not_found_exception_handling(client: TestClient):
    """Verify 404 routes return structured JSON."""
    response = client.get("/api/v1/non-existent-route-path")
    assert response.status_code == 404

    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "HTTP_404"


def test_unhandled_exception_handling(client: TestClient):
    """Verify unexpected exceptions return safe 500 without leaking tracebacks."""
    response = client.get("/api/v1/test-error/unhandled")
    assert response.status_code == 500

    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
    # Verify internal crash details / stack trace are NOT leaked
    assert "Simulated unexpected crash" not in data["error"]["message"]
    assert "Traceback" not in response.text
