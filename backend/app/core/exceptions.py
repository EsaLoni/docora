"""Centralized Exception Handling and Domain Exceptions.

Ensures all errors return consistent, structured JSON responses without leaking
sensitive tracebacks or secrets to clients.
"""

import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("udip.exceptions")


class UDIPException(Exception):
    """Base class for all domain-specific application exceptions."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        error_code: str = "UDIP_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}


class DocumentNotFoundError(UDIPException):
    def __init__(self, document_id: str):
        super().__init__(
            message=f"Document '{document_id}' not found or access denied.",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="DOCUMENT_NOT_FOUND",
            details={"document_id": document_id},
        )


class WorkspaceAccessDeniedError(UDIPException):
    def __init__(self, workspace_id: str):
        super().__init__(
            message=f"Access to workspace '{workspace_id}' is denied.",
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="WORKSPACE_ACCESS_DENIED",
            details={"workspace_id": workspace_id},
        )


class AuthenticationFailedError(UDIPException):
    def __init__(self, message: str = "Invalid or expired authentication credentials.", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTHENTICATION_FAILED",
            details=details,
        )


class ResourceNotFoundError(UDIPException):
    def __init__(self, resource_type: str, resource_id: str):
        super().__init__(
            message=f"{resource_type} '{resource_id}' not found or access denied.",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RESOURCE_NOT_FOUND",
            details={"resource_type": resource_type, "resource_id": resource_id},
        )


class IngestionValidationError(UDIPException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            error_code="INGESTION_VALIDATION_ERROR",
            details=details,
        )


class InsufficientEvidenceError(UDIPException):
    def __init__(self, message: str = "Insufficient document evidence to answer the question."):
        super().__init__(
            message=message,
            status_code=status.HTTP_200_OK,  # 200 OK so client receives abstention cleanly
            error_code="INSUFFICIENT_EVIDENCE",
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Register centralized exception handlers with FastAPI application."""

    @app.exception_handler(UDIPException)
    async def udip_exception_handler(request: Request, exc: UDIPException) -> JSONResponse:
        logger.warning(
            "Domain exception: error_code=%s status_code=%d message=%s path=%s",
            exc.error_code,
            exc.status_code,
            exc.message,
            request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "detail": exc.message,
                "error": {
                    "code": exc.error_code,
                    "message": exc.message,
                    "details": exc.details,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning("Validation error on path=%s: %s", request.url.path, exc.errors())
        formatted_errors = []
        for err in exc.errors():
            formatted_errors.append({
                "field": ".".join(str(loc) for loc in err.get("loc", [])),
                "message": err.get("msg"),
                "type": err.get("type"),
            })
        detail_msg = "; ".join(f"{e['field']}: {e['message']}" for e in formatted_errors) or "Invalid request parameters or payload."
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "success": False,
                "detail": detail_msg,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request parameters or payload.",
                    "details": {"validation_errors": formatted_errors},
                },
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        logger.warning("HTTP %d error on %s: %s", exc.status_code, request.url.path, exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "detail": str(exc.detail),
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": str(exc.detail),
                },
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server exception on %s: %s", request.url.path, str(exc))
        from app.core.config import get_settings
        settings = get_settings()
        detail_msg = (
            f"Internal server error: {str(exc)}"
            if settings.DEBUG
            else "An unexpected internal server error occurred."
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "detail": detail_msg,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected internal server error occurred. Please try again later.",
                },
            },
        )
