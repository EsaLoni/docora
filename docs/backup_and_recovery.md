# Database Backup, Disaster Recovery & Migration Rollback Guide

This document outlines the backup, restoration, point-in-time recovery (PITR), and migration rollback procedures for the **Universal Document Intelligence Platform (UDIP)**.

---

## 1. Recovery Objectives (RPO & RTO)

| Service Level Metric | Target | Description |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **< 1 hour** | Maximum acceptable data loss window in a catastrophic disaster. |
| **Recovery Time Objective (RTO)** | **< 30 minutes** | Maximum allowable downtime to restore full platform availability. |

---

## 2. Automated PostgreSQL Backup Strategy

### 2.1. Daily Automated Snapshot Script (`scripts/backup_db.sh`)
Create the following script on your host machine or orchestration cron:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/udip"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/udip_db_${DATE}.sql.gz"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting UDIP PostgreSQL backup..."

# Execute pg_dump inside the running container
docker compose -f /opt/udip/docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres -d udip_db --format=plain --no-owner --clean --if-exists \
  | gzip -9 > "${BACKUP_FILE}"

echo "[$(date)] Backup successfully generated: ${BACKUP_FILE} ($(du -h ${BACKUP_FILE} | cut -f1))"

# Prune backups older than retention window
find "${BACKUP_DIR}" -type f -name "udip_db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Retention cleanup completed."
```

### 2.2. Automated Cron Configuration
Install as a cron job to run every 6 hours:
```bash
0 */6 * * * /opt/udip/scripts/backup_db.sh >> /var/log/udip_backup.log 2>&1
```

---

## 3. Database Restoration Procedure

To restore the database from a compressed snapshot:

```bash
# 1. Stop background workers to prevent concurrent writes during restore
docker compose -f docker-compose.prod.yml stop worker

# 2. Decompress and stream SQL into the database
gunzip -c /var/backups/udip/udip_db_20261113_120000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d udip_db

# 3. Restart the background worker
docker compose -f docker-compose.prod.yml start worker

# 4. Verify system readiness
curl -f http://localhost/health/ready
```

---

## 4. File Storage Backup

### 4.1. Local Storage Provider
If using local storage (`STORAGE_PROVIDER=local`), back up the volume directory:
```bash
rsync -avz --delete /var/lib/docker/volumes/udip_storage_data/_data/ /var/backups/udip/storage/
```

### 4.2. Supabase Storage Provider
If using Supabase Storage (`STORAGE_PROVIDER=supabase`), enable versioning and automated daily cross-region replication in your Supabase project dashboard.

---

## 5. Alembic Database Migration Rollback

If a migration fails or must be reversed:

### Check Current Migration Revision:
```bash
docker compose -f docker-compose.prod.yml exec backend alembic current
```

### Step Back One Revision:
```bash
docker compose -f docker-compose.prod.yml exec backend alembic downgrade -1
```

### Roll Back to a Specific Known Revision:
```bash
docker compose -f docker-compose.prod.yml exec backend alembic downgrade 20261113_0001
```

---

## 6. Disaster Recovery Drill Checklist

Execute quarterly drills to verify backup integrity:
1. Provision a test instance with `docker-compose.yml`.
2. Restore the latest production backup dump file into the test database.
3. Validate Alembic head state matches the production codebase: `alembic check`.
4. Trigger RAG query verification on an existing workspace.
5. Verify zero data corruption and log drill execution time.
