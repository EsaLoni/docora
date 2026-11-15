"""Abstract Storage Adapter Interface.

Defines the contract for persistent file operations, workspace-scoped isolation,
and secure temporary download URL generation.
"""

from abc import ABC, abstractmethod
import uuid


class StorageAdapter(ABC):
    """Abstract interface for document binary storage."""

    @abstractmethod
    async def save_file(
        self,
        workspace_id: uuid.UUID,
        document_id: uuid.UUID,
        content: bytes,
        mime_type: str,
    ) -> str:
        """Persist file binary payload in isolated workspace storage.

        Args:
            workspace_id: The UUID of the owning workspace.
            document_id: The UUID of the document.
            content: Raw byte content of the file.
            mime_type: Normalized MIME type.

        Returns:
            Relative storage path (opaque to client).
        """
        pass

    async def save_artifact_file(
        self,
        workspace_id: uuid.UUID,
        artifact_id: uuid.UUID,
        content: bytes,
        mime_type: str,
        filename: str,
    ) -> str:
        """Persist generated artifact file in isolated workspace storage."""
        pass

    @abstractmethod
    async def read_file(self, file_path: str) -> bytes:
        """Retrieve raw file content bytes from storage.

        Args:
            file_path: Relative storage path.

        Returns:
            Raw bytes of the document.
        """
        pass

    @abstractmethod
    async def delete_file(self, file_path: str) -> bool:
        """Permanently delete file payload from storage.

        Args:
            file_path: Relative storage path.

        Returns:
            True if file existed and was removed, False otherwise.
        """
        pass

    @abstractmethod
    async def get_signed_url(
        self,
        file_path: str,
        filename: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate a time-limited HMAC-signed URL for client download.

        Args:
            file_path: Relative storage path.
            filename: Original user filename for Content-Disposition.
            expires_in: Expiration lifetime in seconds (default 3600).

        Returns:
            Publicly accessible temporary signed URL.
        """
        pass
