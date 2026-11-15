"""Secure Multi-Stage File Upload Validator.

Enforces extension allowlists, magic-byte inspection, MIME type normalization,
size limits, path sanitization, and SHA-256 deduplication hashing.
"""

import hashlib
import io
import os
import re
from typing import NamedTuple, Optional, Set
import zipfile

from app.core.config import Settings, get_settings
from app.core.exceptions import IngestionValidationError
from app.core.logging import get_logger
from app.services.storage.malware import get_malware_scanner

logger = get_logger("upload.validator")

# Initial supported document formats
ALLOWED_EXTENSIONS: Set[str] = {
    ".pdf",
    ".docx",
    ".xlsx",
    ".csv",
    ".txt",
}

# Explicitly forbidden executable and dangerous extensions
DANGEROUS_EXTENSIONS: Set[str] = {
    ".exe", ".bat", ".cmd", ".sh", ".bash", ".ps1", ".vbs", ".js", ".mjs",
    ".php", ".phtml", ".py", ".rb", ".pl", ".cgi", ".jar", ".msi", ".dll",
    ".scr", ".com", ".hta", ".html", ".htm", ".xhtml", ".svg",
}

# Canonical MIME mappings
CANONICAL_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
}

# Magic byte signatures
MAGIC_SIGNATURES = {
    ".pdf": [b"%PDF-"],
    ".docx": [b"PK\x03\x04"],  # ZIP container header
    ".xlsx": [b"PK\x03\x04"],  # ZIP container header
}


class ValidatedFile(NamedTuple):
    """Result of successful multi-stage file validation."""
    sanitized_filename: str
    extension: str
    mime_type: str
    file_size_bytes: int
    file_hash: str


class FileValidator:
    """Multi-stage security validator for uploaded document binaries."""

    def __init__(self, settings: Optional[Settings] = None):
        if settings is None:
            settings = get_settings()
        self.settings = settings
        self.max_size_bytes = settings.MAX_UPLOAD_SIZE_BYTES

    def sanitize_filename(self, raw_filename: Optional[str]) -> str:
        """Sanitize filename to prevent directory traversal and filesystem attacks."""
        if not raw_filename:
            return "document.bin"

        # 1. Strip directory paths and backslashes
        basename = os.path.basename(raw_filename.replace("\\", "/"))

        # 2. Remove null bytes and control characters
        clean = re.sub(r"[\x00-\x1f\x7f]", "", basename)

        # 3. Strip directory traversal sequences (..)
        clean = clean.replace("..", "")

        # 4. Limit length
        if len(clean) > 250:
            name, ext = os.path.splitext(clean)
            clean = name[:245] + ext

        clean = clean.strip()
        return clean or "document.bin"

    def validate(self, raw_filename: str, content: bytes) -> ValidatedFile:
        """Run all security verification stages on uploaded file bytes."""
        # Stage 1: Empty file check
        if not content or len(content) == 0:
            raise IngestionValidationError("Uploaded file is empty (0 bytes).")

        # Stage 2: Maximum upload size check
        if len(content) > self.max_size_bytes:
            max_mb = self.max_size_bytes / (1024 * 1024)
            actual_mb = len(content) / (1024 * 1024)
            raise IngestionValidationError(
                f"File size ({actual_mb:.2f} MB) exceeds maximum allowed limit of {max_mb:.0f} MB.",
                details={"max_size_bytes": self.max_size_bytes, "actual_size_bytes": len(content)},
            )

        # Stage 3: Filename sanitization & path traversal check
        sanitized_name = self.sanitize_filename(raw_filename)
        _, ext = os.path.splitext(sanitized_name)
        ext = ext.lower()

        # Stage 4: Extension allowlist and dangerous executable check
        if ext in DANGEROUS_EXTENSIONS:
            logger.warning("Rejected upload with dangerous executable extension: %s", ext)
            raise IngestionValidationError(
                f"Security violation: Executable or script files ('{ext}') are strictly prohibited."
            )

        if ext not in ALLOWED_EXTENSIONS:
            allowed_list = sorted(list(ALLOWED_EXTENSIONS))
            raise IngestionValidationError(
                f"File format '{ext}' is not supported. Supported formats: {', '.join(allowed_list)}"
            )

        # Stage 5: Magic-byte inspection & anti-spoofing
        if ext in MAGIC_SIGNATURES:
            expected_headers = MAGIC_SIGNATURES[ext]
            matched = any(content.startswith(header) for header in expected_headers)
            if not matched:
                logger.warning("MIME spoofing detected for file %s claiming to be %s", sanitized_name, ext)
                raise IngestionValidationError(
                    f"File content signature does not match the stated file extension '{ext}'. Potential MIME spoofing detected."
                )
        elif ext in (".csv", ".txt"):
            # Plain text formats must not contain binary null bytes
            if b"\x00" in content[:1024]:
                logger.warning("Binary content found in text/csv upload %s", sanitized_name)
                raise IngestionValidationError(
                    f"Binary content detected in text file '{sanitized_name}'. Only valid text documents are supported."
                )
            # Verify decodability as text
            try:
                content[:4096].decode("utf-8")
            except UnicodeDecodeError:
                try:
                    content[:4096].decode("latin-1")
                except UnicodeDecodeError:
                    raise IngestionValidationError("Uploaded text file is not valid UTF-8 or text encoded.")

        # Stage 6: ZIP bomb and archive traversal inspection for container formats (.docx, .xlsx)
        if ext in (".docx", ".xlsx"):
            if zipfile.is_zipfile(io.BytesIO(content)):
                try:
                    with zipfile.ZipFile(io.BytesIO(content)) as zf:
                        infolist = zf.infolist()
                        if len(infolist) > 1000:
                            logger.warning("Rejected file with excessive archive member count (%d): %s", len(infolist), sanitized_name)
                            raise IngestionValidationError("Archive contains too many files (potential zip bomb).")

                        total_uncompressed = sum(info.file_size for info in infolist)
                        compressed_size = max(1, len(content))
                        ratio = total_uncompressed / compressed_size

                        # Safety thresholds: uncompressed > 100 MB or ratio > 100:1
                        if total_uncompressed > 100_000_000 or (ratio > 100 and total_uncompressed > 1_000_000):
                            logger.warning("Zip bomb ratio detected (ratio: %.1f, uncompressed: %d bytes): %s", ratio, total_uncompressed, sanitized_name)
                            raise IngestionValidationError("Potential zip bomb detected: archive expansion exceeds safety limits.")

                        # Check for path traversal within zip archive
                        for info in infolist:
                            if ".." in info.filename or info.filename.startswith("/") or info.filename.startswith("\\"):
                                logger.warning("Zip traversal pattern in archive entry: %s", info.filename)
                                raise IngestionValidationError("Malicious path traversal detected inside archive entries.")
                except zipfile.BadZipFile:
                    pass

        # Stage 7: Pluggable malware and embedded threat scanning
        if self.settings.MALWARE_SCANNER_ENABLED:
            scanner = get_malware_scanner(self.settings)
            scan_result = scanner.scan(content, sanitized_name)
            if not scan_result.is_clean:
                raise IngestionValidationError(
                    f"Security threat detected ({scan_result.threat_name}): {scan_result.details}"
                )

        # Stage 8: Canonical MIME type mapping
        canonical_mime = CANONICAL_MIME_TYPES.get(ext, "application/octet-stream")

        # Stage 9: SHA-256 deduplication checksum
        sha256_hash = hashlib.sha256(content).hexdigest()

        return ValidatedFile(
            sanitized_filename=sanitized_name,
            extension=ext,
            mime_type=canonical_mime,
            file_size_bytes=len(content),
            file_hash=sha256_hash,
        )
