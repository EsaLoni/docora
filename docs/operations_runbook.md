# UDIP Operations & Incident Response Runbook

This runbook provides actionable procedures for Site Reliability Engineers (SREs), system administrators, and developers maintaining the **Universal Document Intelligence Platform (UDIP)** in production.

---

## 1. Quick Diagnostic Reference

| Symptom | Diagnostic Command | Immediate Action |
| :--- | :--- | :--- |
| **503 Service Unavailable** | `curl -v http://localhost/health/ready` | Check which check failed (`database`, `storage`, `vector`). Inspect DB connections. |
| **High API Latency (> 1s)** | `curl -s http://localhost/metrics \| grep latency` | Check worker CPU usage or active LLM inference timeout. |
| **Worker Processing Stalled** | `docker compose logs --tail=100 worker` | Check for crashed or stuck unhandled job. Worker runner auto-recovers on restart. |
| **High Memory (> 85%)** | `docker stats --no-stream` | Verify worker concurrency limit. Restart worker if embedding model leaked memory. |
| **Rate Limit 429 Alerts** | `docker compose logs backend \| grep "Rate limit exceeded"` | Check client IP. Adjust `RATE_LIMIT_PER_MINUTE` if traffic is legitimate. |

---

## 2. Health & Readiness Probe Analysis

The application exposes three diagnostic endpoints:

### 2.1. `/health/live` (Process Alive)
- **Status 200**: FastAPI process is alive and event loop is healthy.
- **Timeout / No Response**: Process is hung or deadlocked. Action: Restart backend container:
  ```bash
  docker compose -f docker-compose.prod.yml restart backend
  ```

### 2.2. `/health/ready` (Dependency Readiness)
Checks PostgreSQL connectivity (`SELECT 1`), storage adapter accessibility, and 384d vector configuration:
```json
{
  "status": "ready",
  "uptime_seconds": 1420.5,
  "checks": {
    "database": "healthy",
    "storage": "healthy (supabase)",
    "vector_engine": "healthy (384d)"
  }
}
```
If `"database"` returns `"unhealthy"`, check PostgreSQL container:
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
```

---

## 3. Worker Troubleshooting & Stale Job Recovery

The background worker automatically re-queues interrupted or stalled jobs across restarts up to `MAX_RETRIES` (3).

### Inspect Processing Queue:
Connect to database and check job distribution:
```sql
SELECT status, count(*) FROM processing_jobs GROUP BY status;
SELECT status, count(*) FROM intelligence_jobs GROUP BY status;
```

### Manually Recover Deadlocked Jobs:
If a worker container crashes during processing, restarting the worker automatically re-queues them:
```bash
docker compose -f docker-compose.prod.yml restart worker
```

### Inspect Dead-Letter / Permanently Failed Jobs:
```sql
SELECT id, document_id, error_message, retry_count, updated_at 
FROM processing_jobs 
WHERE status = 'FAILED' 
ORDER BY updated_at DESC LIMIT 10;
```

---

## 4. Log Correlation & Request Tracing

Every inbound HTTP request receives a unique `X-Request-ID`. In production, logs are emitted in JSON format containing `"correlation_id"`:

```bash
# Filter all logs associated with a specific request ID
docker compose -f docker-compose.prod.yml logs backend | grep "3a8f9c1b7e4d"
```

Sample production JSON log entry:
```json
{
  "timestamp": "2026-11-13T16:30:12.102Z",
  "level": "INFO",
  "logger": "udip.api.chat",
  "message": "Grounded RAG query completed for conversation e92a...",
  "correlation_id": "3a8f9c1b7e4d",
  "function": "send_message",
  "line": 346
}
```

---

## 5. Key Rotation Procedure

### 5.1. Rotating Application `SECRET_KEY`
1. Generate new 32-character key: `openssl rand -hex 32`
2. Update `SECRET_KEY` in `.env.production`.
3. Restart backend and worker:
   ```bash
   docker compose -f docker-compose.prod.yml restart backend worker
   ```

### 5.2. Rotating Supabase Service Role Key & JWT Secret
1. Generate new JWT secret in Supabase dashboard.
2. Update `SUPABASE_JWT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.production`.
3. Gracefully reload backend with zero downtime:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-deps backend
   ```
