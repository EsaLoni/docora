"""Core Application Configuration.

Loads environment variables using Pydantic Settings with strict validation.
Ensures sensitive secrets are never logged or returned in API responses.
"""

from functools import lru_cache
from typing import List, Literal, Optional, Union
from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # 1. Application & Runtime
    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: Literal["auto", "json", "text"] = "auto"
    APP_NAME: str = "Docora"
    APP_TAGLINE: str = "Your documents. Your intelligence."
    APP_VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: SecretStr = Field(
        default=SecretStr("insecure-dev-secret-key-change-in-production-min32chars!"),
        description="Application secret key used for cryptographic signatures",
    )
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # 2. Database & Vector Store
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/udip_db"
    DATABASE_SYNC_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/udip_db"
    ALEMBIC_DATABASE_URL: Optional[str] = None
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    VECTOR_DIMENSION: int = 384

    # 3. Authentication & Supabase
    AUTH_PROVIDER: str = "local_or_supabase"
    ALLOW_DEV_AUTH: bool = False
    DEV_USER_EMAIL: str = "dev@udip.local"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SUPABASE_URL: str = "https://placeholder.supabase.co"
    SUPABASE_ANON_KEY: str = "placeholder-anon-key"
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_JWT_ISSUER: str = ""
    SUPABASE_SERVICE_ROLE_KEY: SecretStr = Field(
        default=SecretStr("placeholder-service-role-key"),
        description="Supabase Service Role Key (NEVER exposed to frontend)",
    )
    SUPABASE_JWT_SECRET: SecretStr = Field(
        default=SecretStr("placeholder-jwt-secret-min32chars-for-testing!!"),
        description="Supabase JWT secret for token verification",
    )

    # 4. Storage Configuration
    STORAGE_PROVIDER: Literal["local", "supabase"] = "local"
    LOCAL_STORAGE_DIR: str = "./storage/documents"
    SUPABASE_STORAGE_BUCKET: str = "udip-documents"
    SIGNED_URL_EXPIRATION_SECONDS: int = 3600
    MAX_UPLOAD_SIZE_BYTES: int = 26_214_400  # 25 MB
    DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES: int = 104_857_600  # 100 MB
    ALLOWED_FILE_EXTENSIONS: List[str] = [
        ".pdf",
        ".docx",
        ".xlsx",
        ".csv",
        ".pptx",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg",
        ".tiff",
    ]

    # 5. AI Embeddings & Chunking (CPU-First)
    EMBEDDING_PROVIDER: str = "local"
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DEVICE: str = "cpu"
    EMBEDDING_BATCH_SIZE: int = 16
    CHUNK_SIZE_TOKENS: int = 400
    CHUNK_OVERLAP_TOKENS: int = 50
    HYBRID_RETRIEVAL_ALPHA: float = 0.6
    TOP_K_CHUNKS: int = 6
    RETRIEVAL_RRF_K: int = 60
    MAX_SEARCH_LIMIT: int = 50

    # 6. LLM Provider Configuration
    LLM_PROVIDER: Literal["mock", "ollama", "openai_compatible", "gemini"] = "mock"
    LLM_MODEL_NAME: str = "llama3.2:1b"
    LLM_BASE_URL: str = "http://localhost:11434/v1"
    LLM_API_KEY: SecretStr = Field(
        default=SecretStr(""),
        description="LLM Provider API key if applicable",
    )
    GEMINI_API_KEY: SecretStr = Field(
        default=SecretStr(""),
        description="Google Gemini API key if using Gemini provider",
    )
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_TOKENS: int = 1024
    LLM_TIMEOUT_SECONDS: float = 90.0

    # 7. RAG Engine Settings
    RAG_MAX_CONTEXT_TOKENS: int = 3000
    RAG_MIN_RELEVANCE_SCORE: float = 0.0
    RAG_MAX_CHUNKS: int = 8

    # 7. OCR Configuration
    OCR_ENABLED: bool = True
    TESSERACT_CMD_PATH: str = ""
    OCR_LANGUAGES: str = "eng"
    OCR_FALLBACK_TO_IMAGE_EXTRACTION: bool = True

    # 8. Production, Rate Limiting & Security Hardening
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 120
    RATE_LIMIT_UPLOAD_PER_MINUTE: int = 20
    RATE_LIMIT_INFERENCE_PER_MINUTE: int = 40
    MAX_REQUEST_BODY_SIZE_BYTES: int = 31_457_280  # 30 MB
    WORKER_CONCURRENCY: int = 3
    MALWARE_SCANNER_ENABLED: bool = True

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Strictly enforce security invariants in production environments and normalize database drivers."""
        if self.ENVIRONMENT == "production":
            if self.ALLOW_DEV_AUTH:
                raise ValueError("Security violation: ALLOW_DEV_AUTH cannot be True in production.")
            if self.SECRET_KEY.get_secret_value() == "insecure-dev-secret-key-change-in-production-min32chars!":
                raise ValueError("Security violation: SECRET_KEY must be set to a secure secret in production.")

        # Normalize async application DATABASE_URL
        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
        elif self.DATABASE_URL.startswith("postgresql://") and not self.DATABASE_URL.startswith("postgresql+"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Normalize synchronous migration DATABASE_SYNC_URL / ALEMBIC_DATABASE_URL
        if self.ALEMBIC_DATABASE_URL:
            sync_candidate = self.ALEMBIC_DATABASE_URL
        elif self.DATABASE_URL.startswith("postgresql+asyncpg://") and (
            not self.DATABASE_SYNC_URL
            or "sqlite" in self.DATABASE_SYNC_URL
            or "localhost:5432/udip_db" in self.DATABASE_SYNC_URL
        ):
            sync_candidate = self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        else:
            sync_candidate = self.DATABASE_SYNC_URL

        if sync_candidate.startswith("postgres://"):
            sync_candidate = sync_candidate.replace("postgres://", "postgresql+psycopg://", 1)
        elif sync_candidate.startswith("postgresql://") and not sync_candidate.startswith("postgresql+"):
            sync_candidate = sync_candidate.replace("postgresql://", "postgresql+psycopg://", 1)
        elif sync_candidate.startswith("postgresql+asyncpg://"):
            sync_candidate = sync_candidate.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)

        self.DATABASE_SYNC_URL = sync_candidate
        return self

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse allowed origins from JSON string or comma-separated list."""
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    def safe_dict(self) -> dict:
        """Return safe subset of configuration excluding all SecretStr and credentials."""
        return {
            "app_name": self.APP_NAME,
            "app_tagline": self.APP_TAGLINE,
            "app_version": self.APP_VERSION,
            "environment": self.ENVIRONMENT,
            "debug": self.DEBUG,
            "api_v1_prefix": self.API_V1_PREFIX,
            "storage_provider": self.STORAGE_PROVIDER,
            "vector_dimension": self.VECTOR_DIMENSION,
            "embedding_model": self.EMBEDDING_MODEL_NAME,
            "embedding_device": self.EMBEDDING_DEVICE,
            "llm_provider": self.LLM_PROVIDER,
            "llm_model": self.LLM_MODEL_NAME,
            "max_upload_size_mb": self.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024),
        }


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
