"""Supabase Private Storage Adapter.

Integrates with Supabase Storage REST API using Service Role Key for server-side
upload, retrieval, deletion, and signed download URL issuance.
"""

from typing import Optional
import uuid
import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import UDIPException
from app.core.logging import get_logger
from app.services.storage.base import StorageAdapter

logger = get_logger("storage.supabase")


class SupabaseStorageAdapter(StorageAdapter):
    """Storage adapter persisting files to private Supabase Storage buckets."""

    def __init__(self, settings: Optional[Settings] = None):
        if settings is None:
            settings = get_settings()
        self.settings = settings
        self.supabase_url = settings.SUPABASE_URL.rstrip("/")
        self.bucket = settings.SUPABASE_STORAGE_BUCKET
        self.service_key = settings.SUPABASE_SERVICE_ROLE_KEY.get_secret_value()

    def _headers(self, content_type: Optional[str] = None) -> dict:
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apiKey": self.service_key,
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    async def save_file(
        self,
        workspace_id: uuid.UUID,
        document_id: uuid.UUID,
        content: bytes,
        mime_type: str,
    ) -> str:
        """Upload file binary to private Supabase bucket."""
        path = f"{workspace_id}/{document_id}.bin"
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{path}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                content=content,
                headers=self._headers(mime_type),
            )
            if response.status_code not in (200, 201):
                logger.error("Supabase storage upload failed: %d %s", response.status_code, response.text)
                raise UDIPException(
                    message="Failed to persist file in cloud storage.",
                    status_code=502,
                    error_code="STORAGE_UPLOAD_ERROR",
                )

        logger.info("Uploaded %d bytes to Supabase storage: %s", len(content), path)
        return path

    async def save_artifact_file(
        self,
        workspace_id: uuid.UUID,
        artifact_id: uuid.UUID,
        content: bytes,
        mime_type: str,
        filename: str,
    ) -> str:
        """Upload generated Studio artifact binary to private Supabase bucket."""
        path = f"{workspace_id}/artifacts/{artifact_id}/{filename}"
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{path}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                content=content,
                headers=self._headers(mime_type),
            )
            if response.status_code not in (200, 201):
                logger.error("Supabase artifact upload failed: %d %s", response.status_code, response.text)
                raise UDIPException(
                    message="Failed to persist artifact file in cloud storage.",
                    status_code=502,
                    error_code="STORAGE_UPLOAD_ERROR",
                )

        logger.info("Uploaded %d bytes to Supabase artifact storage: %s", len(content), path)
        return path

    async def read_file(self, file_path: str) -> bytes:
        """Fetch raw file bytes from Supabase storage."""
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{file_path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self._headers())
            if response.status_code != 200:
                raise FileNotFoundError(f"Supabase storage object not found: {file_path}")
            return response.content

    async def delete_file(self, file_path: str) -> bool:
        """Delete object from Supabase storage."""
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{file_path}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.delete(url, headers=self._headers())
            return response.status_code == 200

    async def get_signed_url(
        self,
        file_path: str,
        filename: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate a time-limited signed URL via Supabase Storage sign API."""
        url = f"{self.supabase_url}/storage/v1/object/sign/{self.bucket}/{file_path}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                url,
                json={"expiresIn": expires_in},
                headers=self._headers("application/json"),
            )
            if response.status_code == 200:
                data = response.json()
                signed_path = data.get("signedURL")
                return f"{self.supabase_url}/storage/v1{signed_path}"

            raise UDIPException(
                message="Failed to generate signed download URL.",
                status_code=502,
                error_code="STORAGE_SIGNED_URL_ERROR",
            )
