"""Rate Limiting & Abuse Prevention Engine.

Provides an in-memory sliding window rate limiter supporting route-specific limits,
client IP / user scoping, and RFC 6585 compliant HTTP 429 Retry-After responses.
"""

from collections import deque
import threading
import time
from typing import Callable, Deque, Dict, Optional, Tuple
from fastapi import HTTPException, Request, status

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger("rate_limit")


class SlidingWindowRateLimiter:
    """Thread-safe sliding window rate limiter."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # map: key -> deque of timestamps
        self._windows: Dict[str, Deque[float]] = {}
        self._last_cleanup = time.time()
        self._cleanup_interval = 60.0  # seconds

    def _cleanup_expired(self, now: float, window_seconds: float) -> None:
        """Prune old empty buckets to prevent memory accumulation."""
        if now - self._last_cleanup < self._cleanup_interval:
            return
        self._last_cleanup = now
        stale_keys = []
        for key, timestamps in self._windows.items():
            while timestamps and timestamps[0] < (now - window_seconds):
                timestamps.popleft()
            if not timestamps:
                stale_keys.append(key)
        for key in stale_keys:
            del self._windows[key]

    def is_allowed(self, key: str, max_calls: int, window_seconds: float = 60.0) -> Tuple[bool, int]:
        """Check whether request under `key` is allowed.

        Returns:
            Tuple[bool, int]: (allowed, retry_after_seconds)
        """
        now = time.time()
        with self._lock:
            self._cleanup_expired(now, window_seconds)

            if key not in self._windows:
                self._windows[key] = deque()

            timestamps = self._windows[key]
            # Remove timestamps outside current window
            while timestamps and timestamps[0] < (now - window_seconds):
                timestamps.popleft()

            if len(timestamps) < max_calls:
                timestamps.append(now)
                return True, 0
            else:
                # Calculate retry after based on oldest timestamp in window
                oldest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - oldest)))
                return False, retry_after

    def reset_for_tests(self) -> None:
        """Reset internal rate limiting tables for unit tests."""
        with self._lock:
            self._windows.clear()


# Global rate limiter instance
_limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP, taking into account X-Forwarded-For if reverse proxied."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


class RateLimitDependency:
    """FastAPI Dependency for endpoint-level rate limits."""

    def __init__(
        self,
        calls_per_minute: int,
        scope: str = "general",
        key_func: Optional[Callable[[Request], str]] = None,
    ) -> None:
        self.calls_per_minute = calls_per_minute
        self.scope = scope
        self.key_func = key_func or get_client_ip

    async def __call__(self, request: Request) -> None:
        settings = get_settings()
        if not settings.RATE_LIMIT_ENABLED:
            return

        client_key = f"{self.scope}:{self.key_func(request)}"
        allowed, retry_after = _limiter.is_allowed(client_key, self.calls_per_minute, window_seconds=60.0)

        if not allowed:
            logger.warning("Rate limit exceeded for %s (scope: %s, retry_after: %ds)", client_key, self.scope, retry_after)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {self.calls_per_minute} requests per minute allowed.",
                headers={"Retry-After": str(retry_after)},
            )
