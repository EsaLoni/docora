"""UDIP Production Disaster Recovery & Restoration Tool.

Restores database and storage assets from verified backup archives,
checks SHA-256 integrity, and validates data consistency.
"""

import os
import sys
import shutil
import sqlite3
import tarfile
import hashlib
import argparse
from pathlib import Path


def verify_sha256(filepath: Path, expected_hash_file: Path) -> bool:
    """Verify file integrity matches stored SHA-256 hash."""
    if not expected_hash_file.exists():
        print(f"[-] Checksum file {expected_hash_file} missing. Skipping checksum validation.")
        return True

    with open(expected_hash_file, "r") as f:
        expected = f.read().split()[0].strip()

    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    actual = h.hexdigest()

    if actual.lower() != expected.lower():
        print(f"[!] Checksum mismatch for {filepath.name}! Expected: {expected}, Actual: {actual}")
        return False
    print(f"[+] Integrity verified for {filepath.name} ({actual[:12]}...)")
    return True


def validate_database_integrity(db_path: Path) -> bool:
    """Run integrity check and count core table rows."""
    print(f"[*] Validating restored database integrity at {db_path}...")
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check;")
        status = cursor.fetchone()[0]
        if status != "ok":
            print(f"[!] Integrity check failed: {status}")
            return False

        tables = ["users", "workspaces", "documents", "notebooks", "studio_artifacts"]
        counts = {}
        for t in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {t}")
                counts[t] = cursor.fetchone()[0]
            except Exception:
                counts[t] = "N/A"
        print(f"[+] Database health verified: {counts}")
        return True
    finally:
        conn.close()


def restore_backup(backup_dir: Path, target_dir: Path) -> bool:
    """Execute complete restoration from backup archive directory."""
    print(f"[*] Starting disaster recovery restoration from {backup_dir} to {target_dir}...")

    # 1. Verify database archive
    db_backup = backup_dir / "udip_database.db"
    db_checksum = backup_dir / "udip_database.db.sha256"
    if db_backup.exists():
        if not verify_sha256(db_backup, db_checksum):
            print("[!] Halting restore: database checksum failure!")
            return False

        dest_db = target_dir / "storage" / "udip.db"
        dest_db.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(db_backup, dest_db)
        print(f"[+] Restored database to {dest_db}")

        if not validate_database_integrity(dest_db):
            print("[!] Restored database failed integrity check!")
            return False

    # 2. Verify and extract storage assets
    storage_archive = backup_dir / "storage_assets.tar.gz"
    storage_checksum = backup_dir / "storage_assets.tar.gz.sha256"
    if storage_archive.exists():
        if not verify_sha256(storage_archive, storage_checksum):
            print("[!] Halting restore: storage archive checksum failure!")
            return False

        print(f"[*] Extracting storage archive into {target_dir}...")
        with tarfile.open(storage_archive, "r:gz") as tar:
            tar.extractall(path=target_dir)
        print(f"[+] Restored storage files to {target_dir / 'storage'}")

    print("[+] Disaster recovery restoration completed successfully.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UDIP Production Restore Tool")
    parser.add_argument("--backup-dir", required=True, type=Path, help="Path to backup directory")
    args = parser.parse_args()
    project_root = Path(__file__).resolve().parent.parent
    restore_backup(args.backup_dir, project_root)
