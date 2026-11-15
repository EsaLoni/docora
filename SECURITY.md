# Security Policy & Architecture

The **Docora** platform (*Your documents. Your intelligence.*) is architected with defense-in-depth principles to protect private workspace documents, user data, and AI interactions.

---

## 1. Security Architecture & Threat Model

```
+---------------------------------------------------------------------------------+
|                                Untrusted Internet                               |
+---------------------------------------------------------------------------------+
                                        │
                                        ▼ HTTPS (Port 443 / TLS 1.3)
+---------------------------------------------------------------------------------+
| Nginx Reverse Proxy: SSL Termination, Gzip, CSP, Nosniff, HSTS, 35MB Body Cap   |
+---------------------------------------------------------------------------------+
                                        │
                                        ▼
+---------------------------------------------------------------------------------+
| FastAPI Perimeter Middleware:                                                   |
| - CorrelationIdMiddleware (X-Request-ID propagation & tracing)                  |
| - RequestBodyLimitMiddleware (30 MB DoS prevention)                            |
| - SlidingWindowRateLimiter (120 req/min general, 20 upload/min, 40 LLM/min)      |
| - Redacting Structured Logging (Masks Authorization, API keys, secrets, PII)    |
+---------------------------------------------------------------------------------+
            │                                                 │
            ▼                                                 ▼
+───────────────────────────+                     +─────────────────────────────+
| Authentication & Identity |                     | Storage & Upload Validation |
| - Supabase JWT (HS256)    |                     | - Magic-byte inspection     |
| - Strict Audience/Issuer  |                     | - Traversal sanitization    |
| - Inactive user rejection |                     | - ZIP Bomb expansion checks |
| - DEV_AUTH blocked in prod|                     | - Pluggable malware scanner |
+───────────────────────────+                     +─────────────────────────────+
            │                                                 │
            ▼                                                 ▼
+─────────────────────────────────────────────────────────────────────────────────+
| Multi-Tenant Isolation Layer:                                                   |
| - Tenant filtering (workspace_id) enforced on every SQL query & Vector index    |
| - Role-Based Access Control (RBAC: owner, admin, member, viewer)               |
+─────────────────────────────────────────────────────────────────────────────────+
            │                                                 │
            ▼                                                 ▼
+───────────────────────────+                     +─────────────────────────────+
| Grounded RAG & AI Safety  |                     | Durable Background Worker   |
| - Delimiter token filter  |                     | - Concurrency semaphore (3) |
| - Strict grounding prompt |                     | - Atomic state transitions  |
| - Workspace citation check|                     | - Dead-letter failure state |
+───────────────────────────+                     +─────────────────────────────+
```

---

## 2. Security Safeguards

### 2.1. Authentication & JWT Validation
- **Cryptographic Signature Verification**: Incoming Bearer tokens are cryptographically verified against the configured Supabase JWT secret using strictly allowed algorithms (`HS256`).
- **Algorithm Hardening**: Any token with `alg: "none"` or mismatched asymmetric headers is rejected immediately with `401 Unauthorized`.
- **Audience & Issuer Enforcement**: Validates `aud` (default: `authenticated`) and optional `iss` claims.
- **Deactivated Account Defense**: Every authenticated request queries the user account state; deactivated accounts (`is_active = False`) are rejected with `403 Forbidden`.
- **Production Guardrail on Dev Auth**: `ALLOW_DEV_AUTH` is hard-disabled in production. Even if accidentally set in an environment variable, the application validator refuses to start or accept dev tokens when `ENVIRONMENT == "production"`.

### 2.2. Multi-Tenant Boundary Isolation
- Every document, chunk, vector embedding, chat conversation, message, citation, action item, reminder, and audit log is strictly partitioned by `workspace_id`.
- Tenant membership is verified on every request via FastAPI dependency injection (`get_active_workspace`). Cross-workspace access attempts are rejected with `403 Forbidden` and logged in audit trails.
- Role-Based Access Control (RBAC) verifies permissions (`require_workspace_role`) for sensitive operations.

### 2.3. File Upload & Binary Defense
- **Multi-Stage Validation**: All uploaded files pass through seven validation gates:
  1. Empty payload check.
  2. Maximum size limit (25 MB).
  3. Strict filename traversal sanitization (`..`, control characters, null bytes).
  4. Executable blocklist (`.exe`, `.bat`, `.sh`, `.py`, `.js`, etc.).
  5. Magic-byte signature verification (e.g. `%PDF-` for PDFs, `PK\x03\x04` for OpenXML).
  6. **ZIP Bomb Detection**: OpenXML documents (`.docx`, `.xlsx`) are inspected for compression ratio anomalies (>100:1) and maximum uncompressed expansion limits (>100 MB).
  7. **Malware Heuristics**: Payload scanning rejects embedded PE/ELF binaries, encoded PowerShell commands, and malicious macro execution routines.

### 2.4. Prompt Injection & AI Reliability
- **Delimiter Sanitization**: User inquiries are filtered for delimiter tokens (e.g., `<|im_start|>`, `<|system|>`, `--- BEGIN SYSTEM PROMPT ---`) before context construction.
- **Untrusted Context Framing**: All retrieved document text is explicitly presented to the LLM inside untrusted content delimiters with strict instructions to ignore embedded commands.
- **Citation Verification**: Every generated citation is verified against active workspace chunks before persisting.

---

## 3. Reporting a Vulnerability

We welcome security reports from researchers and users. Please do **NOT** report security vulnerabilities through public GitHub issues.

To report a vulnerability:
1. Email: `[YOUR SECURITY CONTACT EMAIL]` (or project maintainers).
2. Include a detailed description, reproducible steps, and proof of concept.
3. Allow up to 48 hours for an acknowledgment and response.
