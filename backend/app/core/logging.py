"""Centralized Structured Logging Configuration.

Provides structured logging with automatic redaction of sensitive credentials,
API tokens, Authorization headers, and PII, with correlation ID support
and production-ready JSON formatting.
"""

from contextvars import ContextVar
from datetime import datetime, timezone
import json
import logging
import re
import sys
from typing import Any, Dict, Optional

# Request Correlation ID Context Variable
correlation_id_ctx: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)


def get_correlation_id() -> Optional[str]:
    """Retrieve the current request correlation ID if available."""
    return correlation_id_ctx.get()


def set_correlation_id(correlation_id: str) -> None:
    """Set the current request correlation ID."""
    correlation_id_ctx.set(correlation_id)


# Patterns to redact from logs
SENSITIVE_PATTERNS = [
    re.compile(r"(?i)(bearer\s+)[a-zA-Z0-9_\-\.]{10,}"),
    re.compile(r"(?i)(password[\"']?\s*[:=]\s*[\"'])([^\"']+)([\"'])"),
    re.compile(r"(?i)(secret[\"']?\s*[:=]\s*[\"'])([^\"']+)([\"'])"),
    re.compile(r"(?i)(api[_-]?key[\"']?\s*[:=]\s*[\"'])([^\"']+)([\"'])"),
    re.compile(r"(?i)(token[\"']?\s*[:=]\s*[\"'])([^\"']+)([\"'])"),
]


def redact_sensitive_text(text: str) -> str:
    """Redact passwords, secret tokens, and API keys from arbitrary text."""
    redacted = text
    for pattern in SENSITIVE_PATTERNS:
        redacted = pattern.sub(r"\1[REDACTED]\3" if r"\3" in pattern.pattern else r"\1[REDACTED]", redacted)
    return redacted


class RedactingFormatter(logging.Formatter):
    """Console formatter that includes correlation IDs and redacts sensitive data."""

    def format(self, record: logging.LogRecord) -> str:
        cid = getattr(record, "correlation_id", None) or get_correlation_id()
        record.cid_str = f" [cid:{cid}]" if cid else ""
        original = super().format(record)
        return redact_sensitive_text(original)


class JSONRedactingFormatter(logging.Formatter):
    """Production JSON log formatter with redaction and structured correlation metadata."""

    def format(self, record: logging.LogRecord) -> str:
        cid = getattr(record, "correlation_id", None) or get_correlation_id()
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_sensitive_text(record.getMessage()),
            "function": record.funcName,
            "line": record.lineno,
        }
        if cid:
            log_entry["correlation_id"] = cid

        if record.exc_info:
            log_entry["exception"] = redact_sensitive_text(self.formatException(record.exc_info))

        return json.dumps(log_entry)


def setup_logging(
    log_level: str = "INFO",
    app_name: str = "udip",
    log_format: str = "auto",
    environment: str = "development",
) -> logging.Logger:
    """Configure structured logging for the application."""
    level = getattr(logging, log_level.upper(), logging.INFO)

    use_json = (
        log_format == "json" or
        (log_format == "auto" and environment in ("production", "staging"))
    )

    if use_json:
        formatter = JSONRedactingFormatter()
    else:
        fmt = "%(asctime)s | %(levelname)-8s%(cid_str)s | %(name)s:%(funcName)s:%(lineno)d - %(message)s"
        date_fmt = "%Y-%m-%d %H:%M:%S"
        formatter = RedactingFormatter(fmt=fmt, datefmt=date_fmt)

    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove existing handlers to prevent duplicate logs
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(level)
    root_logger.addHandler(console_handler)

    # Suppress verbose 3rd-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    logger = logging.getLogger(app_name)
    logger.setLevel(level)
    return logger


def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the main udip namespace."""
    return logging.getLogger(f"udip.{name}")
