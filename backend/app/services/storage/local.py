"""Local Disk Storage Adapter.

Implements filesystem-based storage with strict workspace path isolation,
directory traversal defense, and HMAC-signed time-limited download URLs.
"""

import asyncio
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import time
from typing import Optional, Tuple
import uuid

from app.core.config import Settings, get_settings
from app.core.exceptions import UDIPException
from app.core.logging import get_logger
from app.services.storage.base import StorageAdapter

logger = get_logger("storage.local")


class LocalStorageAdapter(StorageAdapter):
    """Storage adapter persisting files to isolated workspace directories on local disk."""

    def __init__(self, settings: Optional[Settings] = None):
        if settings is None:
            settings = get_settings()
        self.settings = settings
        self.root_dir = Path(settings.LOCAL_STORAGE_DIR).resolve()
        self.secret_key = settings.SECRET_KEY.get_secret_value().encode("utf-8")
        # Ensure root directory exists
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, relative_path: str) -> Path:
        """Resolve and verify that a relative path stays strictly within the storage root."""
        # Sanitize path to prevent directory traversal
        clean_path = os.path.normpath(relative_path).lstrip("/\\")
        target_path = (self.root_dir / clean_path).resolve()

        if not str(target_path).startswith(str(self.root_dir)):
            logger.error("Path traversal attack detected: %s attempted from %s", relative_path, self.root_dir)
            raise UDIPException(
                message="Access denied: Invalid storage path.",
                status_code=403,
                error_code="STORAGE_PATH_TRAVERSAL",
            )
        return target_path

    async def save_file(
        self,
        workspace_id: uuid.UUID,
        document_id: uuid.UUID,
        content: bytes,
        mime_type: str,
    ) -> str:
        """Save file bytes into workspace-isolated folder using UUID naming."""
        rel_path = f"{workspace_id}/{document_id}.bin"
        target_path = self._resolve_safe_path(rel_path)

        def _write():
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with open(target_path, "wb") as f:
                f.write(content)

        await asyncio.to_thread(_write)
        logger.info("Saved %d bytes to storage path: %s", len(content), rel_path)
        return rel_path

    async def save_artifact_file(
        self,
        workspace_id: uuid.UUID,
        artifact_id: uuid.UUID,
        content: bytes,
        mime_type: str,
        filename: str,
    ) -> str:
        """Save generated Studio artifact binary into workspace storage."""
        rel_path = f"{workspace_id}/artifacts/{artifact_id}/{filename}"
        target_path = self._resolve_safe_path(rel_path)

        def _write():
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with open(target_path, "wb") as f:
                f.write(content)

        await asyncio.to_thread(_write)
        logger.info("Saved %d bytes to artifact path: %s", len(content), rel_path)
        return rel_path

    async def read_file(self, file_path: str) -> bytes:
        """Read file bytes from local storage."""
        target_path = self._resolve_safe_path(file_path)

        def _read():
            if not target_path.is_file():
                raise FileNotFoundError(f"File not found in storage: {file_path}")
            with open(target_path, "rb") as f:
                return f.read()

        return await asyncio.to_thread(_read)

    async def delete_file(self, file_path: str) -> bool:
        """Delete file from local disk."""
        target_path = self._resolve_safe_path(file_path)

        def _delete():
            if target_path.is_file():
                target_path.unlink()
                return True
            return False

        existed = await asyncio.to_thread(_delete)
        if existed:
            logger.info("Deleted storage file: %s", file_path)
        return existed

    async def get_signed_url(
        self,
        file_path: str,
        filename: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate HMAC-SHA256 signed download URL."""
        expires_at = int(time.time()) + expires_in
        payload_data = {
            "path": file_path,
            "filename": filename,
            "exp": expires_at,
        }
        raw_json = json.dumps(payload_data, separators=(",", ":"))
        encoded_token = base64.urlsafe_b64encode(raw_json.encode("utf-8")).decode("utf-8")

        # Generate HMAC signature
        signature = hmac.new(
            self.secret_key,
            encoded_token.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return f"{self.settings.API_V1_PREFIX}/documents/download/stream?token={encoded_token}&sig={signature}"

    def verify_signed_token(self, token: str, signature: str) -> Tuple[str, str]:
        """Validate HMAC signature and expiration on a signed download token.

        Returns:
            Tuple of (file_path, filename).

        Raises:
            UDIPException if signature is forged, token is malformed, or link expired.
        """
        # 1. Verify HMAC
        expected_sig = hmac.new(
            self.secret_key,
            token.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            logger.warning("Rejected download with invalid HMAC signature")
            raise UDIPException(
                message="Invalid download link signature.",
                status_code=403,
                error_code="INVALID_DOWNLOAD_SIGNATURE",
            )

        # 2. Decode payload
        try:
            raw_json = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
            data = json.loads(raw_json)
        except Exception:
            raise UDIPException(
                message="Malformed download token.",
                status_code=400,
                error_code="MALFORMED_TOKEN",
            )

        # 3. Check expiration
        expires_at = data.get("exp", 0)
        if time.time() > expires_at:
            logger.info("Rejected expired download link")
            raise UDIPException(
                message="Download link has expired.",
                status_code=410,
                error_code="DOWNLOAD_LINK_EXPIRED",
            )

        return data["path"], data.get("filename", "document.bin")
