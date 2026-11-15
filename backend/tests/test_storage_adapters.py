"""Unit Tests for Local Storage Adapter and HMAC Signed URLs."""

import asyncio
import os
import tempfile
import time
import uuid
import pytest

from app.core.config import Settings
from app.core.exceptions import UDIPException
from app.services.storage.local import LocalStorageAdapter


def test_local_storage_lifecycle():
    """Verify local storage save, read, delete, and path isolation."""
    temp_dir = tempfile.mkdtemp()
    settings = Settings(
        LOCAL_STORAGE_DIR=temp_dir,
        SECRET_KEY="test-storage-key-minimum-32-characters-for-testing!!",
    )
    adapter = LocalStorageAdapter(settings)

    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    test_content = b"%PDF-1.4\nTest PDF content bytes"

    async def _test():
        # 1. Save file
        path = await adapter.save_file(ws_id, doc_id, test_content, "application/pdf")
        assert f"{ws_id}/{doc_id}.bin" in path

        # 2. Read file
        read_bytes = await adapter.read_file(path)
        assert read_bytes == test_content

        # 3. Signed URL generation & verification
        signed_url = await adapter.get_signed_url(path, "report.pdf", expires_in=60)
        assert "/api/v1/documents/download/stream?" in signed_url
        assert "token=" in signed_url and "sig=" in signed_url

        # Extract token and sig from url
        query_part = signed_url.split("?")[1]
        params = dict(p.split("=") for p in query_part.split("&"))
        token, sig = params["token"], params["sig"]

        verified_path, verified_filename = adapter.verify_signed_token(token, sig)
        assert verified_path == path
        assert verified_filename == "report.pdf"

        # 4. Delete file
        deleted = await adapter.delete_file(path)
        assert deleted is True

        # 5. Subsequent read raises FileNotFoundError
        with pytest.raises(FileNotFoundError):
            await adapter.read_file(path)

    asyncio.run(_test())


def test_path_traversal_prevention():
    """Verify adapter rejects path traversal attempts."""
    temp_dir = tempfile.mkdtemp()
    settings = Settings(LOCAL_STORAGE_DIR=temp_dir)
    adapter = LocalStorageAdapter(settings)

    with pytest.raises(UDIPException) as exc_info:
        adapter._resolve_safe_path("../../../windows/system32/config/sam")
    assert exc_info.value.status_code == 403


def test_signed_token_forgery_and_expiration():
    """Verify forged HMAC signatures and expired tokens are rejected."""
    temp_dir = tempfile.mkdtemp()
    settings = Settings(
        LOCAL_STORAGE_DIR=temp_dir,
        SECRET_KEY="test-storage-key-minimum-32-characters-for-testing!!",
    )
    adapter = LocalStorageAdapter(settings)

    async def _test():
        path = "test-ws/test-doc.bin"
        # 1. Expired token (expires_in = -10)
        expired_url = await adapter.get_signed_url(path, "doc.pdf", expires_in=-10)
        params = dict(p.split("=") for p in expired_url.split("?")[1].split("&"))
        with pytest.raises(UDIPException) as exp_exc:
            adapter.verify_signed_token(params["token"], params["sig"])
        assert exp_exc.value.status_code == 410

        # 2. Forged signature
        valid_url = await adapter.get_signed_url(path, "doc.pdf", expires_in=300)
        params_valid = dict(p.split("=") for p in valid_url.split("?")[1].split("&"))
        with pytest.raises(UDIPException) as sig_exc:
            adapter.verify_signed_token(params_valid["token"], "0000000000000000000000000000000000000000000000000000000000000000")
        assert sig_exc.value.status_code == 403

    asyncio.run(_test())
