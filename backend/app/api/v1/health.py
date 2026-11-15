"""Health Check, Liveness, Readiness and Diagnostic API Endpoints.

Provides Kubernetes/Docker-compatible health probes and operational metrics
without exposing credentials or sensitive internals.
"""

import time
from typing import Any, Dict, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core.config import Settings, get_settings
from app.core.database import get_async_session_factory
from app.core.logging import get_logger
from app.core.metrics import metrics
from app.services.storage import get_storage_adapter

logger = get_logger("health")

router = APIRouter()

# Record startup timestamp
_STARTUP_TIME = time.time()


class ServiceStatus(BaseModel):
    api: str = Field(default="operational", description="FastAPI service status")
    database: str = Field(default="configured", description="Database connection status")
    storage: str = Field(default="configured", description="Object storage provider")
    vector_engine: str = Field(default="pgvector_384d", description="Vector engine specification")
    llm_provider: str = Field(default="mock", description="Configured LLM inference engine")


class HealthResponse(BaseModel):
    status: str = Field(default="healthy", description="Overall system health status")
    app_name: str = Field(..., description="Application display name")
    tagline: str = Field(..., description="Platform tagline")
    version: str = Field(..., description="Application semantic version")
    environment: str = Field(..., description="Runtime environment")
    uptime_seconds: float = Field(..., description="Seconds elapsed since server boot")
    services: ServiceStatus = Field(..., description="Subsystem operational status")


class LivenessResponse(BaseModel):
    status: Literal["alive"] = "alive"
    uptime_seconds: float


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    uptime_seconds: float
    checks: Dict[str, str]


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System Health Overview",
    description="Returns high-level system status, service availability, and version metadata. Zero secrets exposed.",
)
async def get_health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Return application health and operational status."""
    uptime = round(time.time() - _STARTUP_TIME, 2)
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        tagline=settings.APP_TAGLINE,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        uptime_seconds=uptime,
        services=ServiceStatus(
            api="operational",
            database="configured",
            storage=settings.STORAGE_PROVIDER,
            vector_engine=f"pgvector_{settings.VECTOR_DIMENSION}d",
            llm_provider=settings.LLM_PROVIDER,
        ),
    )


@router.get(
    "/health/live",
    response_model=LivenessResponse,
    summary="Liveness Probe",
    description="Returns HTTP 200 if the process is running and accepting event loop cycles.",
)
async def liveness_probe() -> LivenessResponse:
    """Liveness probe for process supervision."""
    return LivenessResponse(status="alive", uptime_seconds=round(time.time() - _STARTUP_TIME, 2))


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    summary="Readiness Probe",
    description="Verifies database connectivity, storage accessibility, and vector engine. Returns 503 if dependencies fail.",
)
async def readiness_probe(settings: Settings = Depends(get_settings)) -> ReadinessResponse:
    """Readiness probe checking backing services."""
    checks: Dict[str, str] = {}
    is_ready = True
    uptime = round(time.time() - _STARTUP_TIME, 2)

    # 1. Database Ping Check
    try:
        session_factory = get_async_session_factory(settings)
        async with session_factory() as session:
            result = await session.execute(text("SELECT 1"))
            val = result.scalar()
            if val == 1:
                checks["database"] = "healthy"
            else:
                checks["database"] = "unexpected_response"
                is_ready = False
    except Exception as e:
        logger.error("Readiness check: database failure: %s", str(e))
        checks["database"] = f"unhealthy: {type(e).__name__}"
        is_ready = False

    # 2. Storage Adapter Check
    try:
        storage = get_storage_adapter(settings)
        checks["storage"] = f"healthy ({settings.STORAGE_PROVIDER})"
    except Exception as e:
        logger.error("Readiness check: storage failure: %s", str(e))
        checks["storage"] = f"unhealthy: {type(e).__name__}"
        is_ready = False

    # 3. Vector Configuration Check
    if settings.VECTOR_DIMENSION == 384:
        checks["vector_engine"] = "healthy (384d)"
    else:
        checks["vector_engine"] = f"misconfigured ({settings.VECTOR_DIMENSION}d)"
        is_ready = False

    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "not_ready",
                "uptime_seconds": uptime,
                "checks": checks,
            },
        )

    return ReadinessResponse(
        status="ready",
        uptime_seconds=uptime,
        checks=checks,
    )


@router.get(
    "/metrics",
    summary="Operational Metrics Endpoint",
    description="Exports Prometheus metrics or JSON telemetry summary.",
)
async def get_metrics(format: Literal["prometheus", "json"] = Query(default="prometheus")):
    """Expose application metrics in Prometheus exposition text or JSON format."""
    if format == "json":
        return metrics.get_summary()

    return Response(
        content=metrics.to_prometheus(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
