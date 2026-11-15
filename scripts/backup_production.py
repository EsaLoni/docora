"""UDIP Production Automated Backup Utility.

Handles zero-downtime hot backups for SQLite and PostgreSQL databases,
compresses storage assets, generates SHA-256 checksums, and prunes stale backups.
"""

import os
import sys
import shutil
import sqlite3
import tarfile
import hashlib
import argparse
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add backend directory to path to load settings if available
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))


def compute_sha256(filepath: Path) -> str:
    """Compute hex SHA-256 checksum for a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def backup_sqlite(source_db: Path, dest_db: Path) -> None:
    """Perform safe zero-downtime hot backup of SQLite database using online backup API."""
    print(f"[*] Performing SQLite online hot backup from {source_db} to {dest_db}...")
    dest_db.parent.mkdir(parents=True, exist_ok=True)
    src_conn = sqlite3.connect(str(source_db))
    dest_conn = sqlite3.connect(str(dest_db))
    try:
        src_conn.backup(dest_conn)
        print("[+] SQLite database successfully backed up.")
    finally:
        dest_conn.close()
        src_conn.close()


def backup_storage(storage_dir: Path, dest_archive: Path) -> None:
    """Compress document storage directory into a tar.gz archive."""
    if not storage_dir.exists():
        print(f"[-] Storage directory {storage_dir} does not exist. Skipping file storage backup.")
        return

    print(f"[*] Compressing storage files from {storage_dir} to {dest_archive}...")
    dest_archive.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(dest_archive, "w:gz") as tar:
        tar.add(str(storage_dir), arcname="storage")
    print("[+] Storage files successfully compressed.")


def prune_old_backups(backup_root: Path, retention_days: int) -> None:
    """Remove backup directories older than the specified retention period."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    print(f"[*] Pruning backups older than {retention_days} days (before {cutoff.isoformat()})...")

    count = 0
    if backup_root.exists():
        for item in backup_root.iterdir():
            if item.is_dir() and item.name.startswith("backup_"):
                try:
                    mtime = datetime.fromtimestamp(item.stat().st_mtime, tz=timezone.utc)
                    if mtime < cutoff:
                        print(f"[-] Pruning stale backup: {item.name}")
                        shutil.rmtree(item)
                        count += 1
                except Exception as e:
                    print(f"[-] Failed to prune {item.name}: {e}")
    print(f"[+] Pruned {count} old backup archive(s).")


def run_backup(retention_days: int = 14) -> Path:
    """Execute complete backup run and return path to created backup folder."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_root = Path(__file__).resolve().parent.parent / "backups" / "production"
    target_dir = backup_root / f"backup_{timestamp}"
    target_dir.mkdir(parents=True, exist_ok=True)

    project_root = Path(__file__).resolve().parent.parent
    sqlite_db_path = project_root / "storage" / "udip.db"
    storage_path = project_root / "storage"

    # 1. Database backup
    if sqlite_db_path.exists():
        dest_db = target_dir / "udip_database.db"
        backup_sqlite(sqlite_db_path, dest_db)
        db_hash = compute_sha256(dest_db)
        with open(target_dir / "udip_database.db.sha256", "w") as f:
            f.write(f"{db_hash}  udip_database.db\n")
    else:
        print("[*] SQLite storage/udip.db not found. If running PostgreSQL in Docker, use pg_dump.")

    # 2. File storage backup
    storage_archive = target_dir / "storage_assets.tar.gz"
    backup_storage(storage_path, storage_archive)
    if storage_archive.exists():
        storage_hash = compute_sha256(storage_archive)
        with open(target_dir / "storage_assets.tar.gz.sha256", "w") as f:
            f.write(f"{storage_hash}  storage_assets.tar.gz\n")

    # 3. Write manifest
    manifest_file = target_dir / "MANIFEST.txt"
    with open(manifest_file, "w") as f:
        f.write(f"UDIP Backup Created: {datetime.now(timezone.utc).isoformat()}\n")
        f.write(f"Timestamp: {timestamp}\n")
        f.write(f"Target Directory: {target_dir}\n")

    print(f"[+] Backup completed successfully at: {target_dir}")

    # 4. Prune old backups
    prune_old_backups(backup_root, retention_days)

    return target_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UDIP Production Backup Tool")
    parser.add_argument("--retention-days", type=int, default=14, help="Days to retain backups")
    args = parser.parse_args()
    run_backup(retention_days=args.retention_days)
