# Platform Upgrades & Database Migration Guide

This document details the procedure for upgrading DOGFOOD deployments to newer versions, executing schema migrations, and performing safe rollbacks.

---

## 1. Migration Philosophy

- **Zero Breaking DDL**: All schema migrations use idempotent DDL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- **Backward Compatibility**: Code is designed to run against both old and new schema variants during rolling updates.
- **Authoritative Migrations**: Migrations are codified in `@dogfood/database/src/migrations.ts` and executed automatically upon container boot.

---

## 2. Standard Upgrade Procedure

### Step 1: Pre-Upgrade Backup
Always create a fresh snapshot before performing an upgrade:
```bash
./scripts/backup.sh ./pre_upgrade_backup
```

### Step 2: Pull Latest Release
```bash
git fetch origin
git checkout v2.0.0 # or target git tag
```

### Step 3: Rebuild and Restart Containers
```bash
docker compose build --pull
docker compose up -d --remove-orphans
```

### Step 4: Verify Deployment
```bash
# Check container statuses
docker compose ps

# Check health probe
curl -f http://localhost:8080/api/v1/health

# Verify acceptance compatibility
python run.py .dogfood.toml
```

---

## 3. Rollback Procedure

If unexpected regressions occur:

```bash
# 1. Stop current containers
docker compose down

# 2. Checkout previous known-good tag
git checkout v1.0.0

# 3. If database changes require restoring previous snapshot:
./scripts/restore.sh ./pre_upgrade_backup/dogfood_db_<timestamp>.sql.gz

# 4. Restart previous release
docker compose up -d
```
