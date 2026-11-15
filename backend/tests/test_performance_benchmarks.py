"""Performance and Latency Benchmark Tests.

Ensures critical CPU and request pathways meet production SLA latency thresholds.
"""

import time
import uuid
import jwt
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings, get_settings
from app.core.logging import redact_sensitive_text
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.security import verify_jwt_token
from app.services.chunking.recursive import RecursiveTextChunker


def test_health_probe_latency_benchmark(client: TestClient):
    """Benchmark: Liveness probe must execute under 50 milliseconds."""
    # Warmup
    client.get("/health/live")

    start = time.perf_counter()
    iterations = 20
    for _ in range(iterations):
        resp = client.get("/health/live")
        assert resp.status_code == 200

    total_elapsed = time.perf_counter() - start
    avg_latency_ms = (total_elapsed / iterations) * 1000
    assert avg_latency_ms < 50.0, f"Average health probe latency too high: {avg_latency_ms:.2f}ms"


def test_jwt_verification_latency_benchmark():
    """Benchmark: JWT cryptographic signature verification must complete in under 5ms."""
    secret = "benchmark-secret-key-min-32-chars-long!!"
    settings = Settings(SUPABASE_JWT_SECRET=SecretStr(secret))
    token = jwt.encode(
        {"sub": "user-uuid-123", "aud": "authenticated", "role": "authenticated", "exp": int(time.time()) + 3600},
        key=secret,
        algorithm="HS256",
    )

    # Warmup
    verify_jwt_token(token, settings=settings)

    start = time.perf_counter()
    iterations = 50
    for _ in range(iterations):
        payload = verify_jwt_token(token, settings=settings)
        assert payload.sub == "user-uuid-123"

    total_elapsed = time.perf_counter() - start
    avg_latency_ms = (total_elapsed / iterations) * 1000
    assert avg_latency_ms < 5.0, f"Average JWT verification latency too high: {avg_latency_ms:.2f}ms"


def test_rate_limiter_overhead_benchmark():
    """Benchmark: Rate limiter check overhead must be less than 0.5ms."""
    limiter = SlidingWindowRateLimiter()
    key = "benchmark_client_key"

    start = time.perf_counter()
    iterations = 200
    for _ in range(iterations):
        limiter.is_allowed(key, max_calls=1000, window_seconds=60.0)

    total_elapsed = time.perf_counter() - start
    avg_latency_ms = (total_elapsed / iterations) * 1000
    assert avg_latency_ms < 0.5, f"Rate limiter overhead too high: {avg_latency_ms:.4f}ms"


def test_chunking_throughput_benchmark():
    """Benchmark: Recursive chunker must process > 40,000 characters in under 500ms."""
    chunker = RecursiveTextChunker(chunk_size_tokens=300, chunk_overlap_tokens=30)
    sample_text = (
        "Universal Document Intelligence Platform enables deep document semantic search. "
        "Each section preserves page numbers, bounding boxes, and tables. "
    ) * 300  # ~45,000 chars

    start = time.perf_counter()
    chunks = chunker.chunk_page(
        page_content=sample_text,
        page_number=1,
        page_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert len(chunks) > 0
    assert elapsed_ms < 500.0, f"Chunking throughput too slow: {elapsed_ms:.2f}ms for {len(sample_text)} chars"


def test_logging_redaction_throughput_benchmark():
    """Benchmark: Redaction regex parsing must process > 10,000 characters in under 50ms."""
    log_text = "User signed in with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThis and password='SuperSecretPassword123!' " * 50

    start = time.perf_counter()
    redacted = redact_sensitive_text(log_text)
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert "[REDACTED]" in redacted
    assert "SuperSecretPassword123!" not in redacted
    assert elapsed_ms < 50.0, f"Redaction too slow: {elapsed_ms:.2f}ms"
