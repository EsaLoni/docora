"""FastAPI Application Entrypoint & Factory.

Docora — Your documents. Your intelligence.
Modular Monolith API.
"""

from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.router import api_v1_router
from app.core.config import Settings, get_settings
from app.core.database import close_db_connections
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.metrics import metrics
from app.core.middleware import (
    CSRFProtectionMiddleware,
    CorrelationIdMiddleware,
    RequestBodyLimitMiddleware,
    RequestMetricsMiddleware,
    SecurityHeadersMiddleware,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle events for startup and shutdown."""
    settings = get_settings()
    logger = setup_logging(
        log_level=settings.LOG_LEVEL,
        app_name="udip",
        log_format=settings.LOG_FORMAT,
        environment=settings.ENVIRONMENT,
    )
    logger.info(
        "Starting %s v%s [Environment: %s, Debug: %s, Storage: %s]",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
        settings.DEBUG,
        settings.STORAGE_PROVIDER,
    )
    if settings.DATABASE_URL.startswith("sqlite"):
        from app.core.database import get_async_engine
        from app.models.base import Base
        import app.models  # noqa: F401
        engine = get_async_engine(settings)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Verified/initialized local SQLite database tables")
    yield
    logger.info("Shutting down %s", settings.APP_NAME)
    await close_db_connections()


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """Application factory for FastAPI modular monolith."""
    if settings is None:
        settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        description=f"{settings.APP_TAGLINE} - Production-oriented document intelligence platform API.",
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    # 1. Register Middlewares in Execution Order
    # Note: In Starlette, the last added middleware is executed first on inbound requests.
    # Outbound response processing happens in reverse.

    # Outermost: CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security Headers (nosniff, DENY, CSP, HSTS)
    app.add_middleware(SecurityHeadersMiddleware, settings=settings)

    # Double-submit Cookie CSRF Protection
    app.add_middleware(CSRFProtectionMiddleware)

    # Request Body Size Enforcer
    app.add_middleware(
        RequestBodyLimitMiddleware,
        max_body_size_bytes=settings.MAX_REQUEST_BODY_SIZE_BYTES,
    )

    # Latency & Metrics Tracking
    app.add_middleware(RequestMetricsMiddleware)

    # Innermost / First on Inbound: Correlation ID (X-Request-ID)
    app.add_middleware(CorrelationIdMiddleware)

    # 2. Register Centralized Exception Handlers
    register_exception_handlers(app)

    # 3. Mount Root Diagnostic Probes & Metrics for Orchestrators
    @app.get("/metrics", include_in_schema=False)
    async def root_prometheus_metrics():
        return Response(
            content=metrics.to_prometheus(),
            media_type="text/plain; version=0.0.4; charset=utf-8",
        )

    # Also mount health probes at root for standard Docker/K8s defaults
    app.include_router(health_router, prefix="", tags=["Probes"])

    # 4. Mount API v1 Routers
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    return app


# Default application instance for Uvicorn
app = create_app()
