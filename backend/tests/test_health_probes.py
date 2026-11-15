"""Unit and Integration Tests for Production Health & Readiness Probes."""

from fastapi.testclient import TestClient


def test_health_overview(client: TestClient):
    """Verify /health returns operational status and zero secrets."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data
    assert "version" in data
    assert "services" in data
    assert data["services"]["api"] == "operational"
    # Ensure zero credentials are in payload
    assert "secret" not in str(data).lower()
    assert "key" not in str(data).lower() or "anon" in str(data).lower()


def test_liveness_probe(client: TestClient):
    """Verify /health/live returns 200 OK with alive status."""
    response = client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert data["uptime_seconds"] >= 0


def test_readiness_probe(client: TestClient):
    """Verify /health/ready checks backing dependencies and returns 200."""
    response = client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert "database" in data["checks"]
    assert "storage" in data["checks"]
    assert "vector_engine" in data["checks"]


def test_metrics_endpoint_prometheus(client: TestClient):
    """Verify /metrics returns Prometheus exposition formatted text."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    text = response.text
    assert "udip_uptime_seconds" in text
    assert "udip_http_requests_total" in text


def test_metrics_endpoint_json(client: TestClient):
    """Verify /api/v1/metrics?format=json returns structured JSON telemetry."""
    response = client.get("/api/v1/metrics?format=json")
    assert response.status_code == 200
    data = response.json()
    assert "uptime_seconds" in data
    assert "total_http_requests" in data
    assert "worker_jobs" in data
    assert "llm_inference" in data
