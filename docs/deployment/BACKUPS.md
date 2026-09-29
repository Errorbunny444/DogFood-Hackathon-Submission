# Production Database & Asset Backup Architecture

DOGFOOD 2026 utilizes an authoritative PostgreSQL relational datastore and an abstracted storage layer (local filesystem volume or S3/R2 object storage). Ensuring disaster resilience requires regular, automated backups and verified restore procedures.

---

## 1. What Needs Backing Up

1. **PostgreSQL Database**:
   - Contains all users, organizations, events, projects, rubrics, reviews, normalization runs, audit logs, and background jobs.
2. **Uploaded Media Assets**:
   - When using `LocalStorageProvider`: the `./uploads/` directory on the persistent volume.
   - When using `S3StorageProvider`: S3 bucket versioning and cross-region replication provide underlying object durability.

---

## 2. Backup Procedures

### Automated Daily Dumps via Script

We provide native backup scripts for both POSIX (Linux/macOS) and Windows environments:

#### POSIX / Linux / Docker host:
```bash
# Back up to ./backups (creates compressed SQL and media archive)
./scripts/backup.sh ./backups
```

#### Windows PowerShell:
```powershell
.\scripts\backup.ps1 -BackupDir "./backups"
```

The script performs the following operations:
1. Executes `pg_dump` with `--clean --if-exists --no-owner --no-privileges` to produce an atomic, self-contained schema and data snapshot.
2. Compresses the database dump using `gzip -9` / standard zip.
3. Compresses uploaded media from the configured storage directory.
4. Generates a cryptographic `SHA-256` checksum manifest file (`dogfood_backup_<timestamp>.sha256`) to guarantee dump integrity.

### Automated Cron Job Example (Linux VPS)

Add to `/etc/cron.d/dogfood-backup`:
```cron
# Run daily at 03:00 UTC
0 3 * * * root cd /opt/dogfood && ./scripts/backup.sh /var/backups/dogfood >> /var/log/dogfood-backup.log 2>&1
```

### Backup Retention & Rotation

To prevent disk saturation, maintain a 30-day rolling window:
```bash
# Retain backups for 30 days, purge older
find /var/backups/dogfood -type f -mtime +30 -delete
```

---

## 3. Disaster Recovery & Restore Procedures

> [!CAUTION]
> Restoring a database snapshot drops and overwrites existing tables. Ensure you have captured a pre-restore backup before proceeding.

### Restore Using Script

#### POSIX:
```bash
# Restore database and uploaded media
./scripts/restore.sh ./backups/dogfood_db_20260928_030000.sql.gz ./backups/dogfood_media_20260928_030000.tar.gz
```

#### Windows PowerShell:
```powershell
.\scripts\restore.ps1 -DbBackupFile "./backups/dogfood_db_20260928_030000.sql" -MediaBackupFile "./backups/dogfood_media_20260928_030000.zip"
```

### Manual Restore Step-by-Step

If restoring onto a fresh PostgreSQL instance:
```bash
# 1. Unpack dump and pipe to psql
gunzip -c dogfood_db_20260928_030000.sql.gz | psql -U dogfood -d dogfood

# 2. Extract media assets
tar -xzf dogfood_media_20260928_030000.tar.gz -C ./uploads

# 3. Verify health
curl -s http://localhost:8080/api/v1/health | jq .
```

---

## 4. Offsite & S3 Replication

For production resilience, replicate daily backups to an offsite S3/R2 cold-storage bucket:
```bash
aws s3 sync /var/backups/dogfood/ s3://my-dogfood-backups-bucket/db/ --storage-class GLACIER_IR
```

---

## 5. Recovery Verification Drills

"A backup without a tested restore procedure is not a backup."

Quarterly disaster recovery testing checklist:
- [ ] Spin up an isolated staging database.
- [ ] Restore the latest production backup using `./scripts/restore.sh`.
- [ ] Verify acceptance test suite: `python run.py .dogfood.toml`.
- [ ] Check project gallery and review data consistency.
