"""Storage Service Module.

Provides storage adapter factory based on application configuration.
"""

from typing import Optional
from app.core.config import Settings, get_settings
from app.services.storage.base import StorageAdapter
from app.services.storage.local import LocalStorageAdapter
from app.services.storage.supabase import SupabaseStorageAdapter


def get_storage_adapter(settings: Optional[Settings] = None) -> StorageAdapter:
    """Return configured StorageAdapter instance (Local or Supabase)."""
    if settings is None:
        settings = get_settings()

    if settings.STORAGE_PROVIDER == "supabase":
        return SupabaseStorageAdapter(settings)
    return LocalStorageAdapter(settings)


__all__ = ["StorageAdapter", "LocalStorageAdapter", "SupabaseStorageAdapter", "get_storage_adapter"]
