"""Production Security and Observability Middleware.

Provides:
- X-Request-ID propagation & context correlation.
- Hardened HTTP security headers (nosniff, DENY, strict referrer, CSP).
- Request latency tracking & Prometheus metric recording.
- Early payload size enforcement to prevent DoS.
"""

import time
import uuid
from typing import Callable
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import Settings, get_settings
from app.core.logging import get_logger, set_correlation_id
from app.core.metrics import metrics

logger = get_logger("middleware")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Propagates or generates unique correlation ID for every inbound request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        incoming_id = request.headers.get("X-Request-ID")
        # Validate or generate clean UUID hex
        if incoming_id and len(incoming_id) <= 64 and incoming_id.replace("-", "").isalnum():
            req_id = incoming_id
        else:
            req_id = uuid.uuid4().hex

        set_correlation_id(req_id)
        request.state.correlation_id = req_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects defense-in-depth security headers into all responses."""

    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Standard OWASP recommended security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        # Restrict content security policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: blob:; "
            "font-src 'self' data:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "connect-src 'self' *; "
            "frame-ancestors 'none';"
        )

        # Enforce HSTS when running on HTTPS / production
        if self.settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    """Tracks request completion metrics and logs structured access logs."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        try:
            response = await call_next(request)
        except Exception:
            duration = time.time() - start_time
            metrics.record_http_request(request.method, request.url.path, 500, duration)
            raise

        duration = time.time() - start_time
        metrics.record_http_request(request.method, request.url.path, response.status_code, duration)

        # Log completion
        req_id = getattr(request.state, "correlation_id", "none")
        logger.debug(
            "%s %s %d (%.2f ms) [req:%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration * 1000,
            req_id,
        )

        return response


class RequestBodyLimitMiddleware(BaseHTTPMiddleware):
    """Rejects oversized requests before buffering into RAM to mitigate DoS."""

    def __init__(self, app, max_body_size_bytes: int) -> None:
        super().__init__(app)
        self.max_body_size_bytes = max_body_size_bytes

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                if length > self.max_body_size_bytes:
                    max_mb = self.max_body_size_bytes / (1024 * 1024)
                    return JSONResponse(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        content={
                            "error": {
                                "code": "REQUEST_TOO_LARGE",
                                "message": f"Payload size exceeds maximum allowable limit of {max_mb:.0f} MB.",
                            }
                        },
                    )
            except ValueError:
                pass

        return await call_next(request)


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """Enforces double-submit CSRF cookie token on state-changing requests using cookie authentication."""

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    EXEMPT_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/logout",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/health",
        "/api/v1/health/ready",
        "/metrics",
        "/docs",
        "/redoc",
        "/openapi.json",
    }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method in self.SAFE_METHODS:
            return await call_next(request)

        # If path is explicitly exempt (e.g. initial login/registration), allow
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        # CSRF only applies if the browser is using cookie-based authentication
        # (Bearer token auth via Authorization header is immune to cross-origin browser auto-submission)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return await call_next(request)

        access_cookie = request.cookies.get("access_token")
        if access_cookie:
            csrf_cookie = request.cookies.get("csrf_token")
            csrf_header = request.headers.get("X-CSRF-Token")

            if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                logger.warning(
                    "CSRF validation failed for %s %s (cookie=%s, header=%s)",
                    request.method,
                    request.url.path,
                    bool(csrf_cookie),
                    bool(csrf_header),
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": {
                            "code": "CSRF_VALIDATION_FAILED",
                            "message": "Invalid or missing CSRF token. State-changing requests using cookie authentication require matching X-CSRF-Token header.",
                        }
                    },
                )

        return await call_next(request)
