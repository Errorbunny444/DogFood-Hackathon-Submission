#!/usr/bin/env bash
# ==============================================================================
# DOGFOOD 2026 Production Database & Media Backup Script (POSIX)
#
# Usage:
#   ./scripts/backup.sh [BACKUP_DIR]
#
# Environment variables:
#   DATABASE_URL   - PostgreSQL connection string (defaults to local docker postgres)
#   STORAGE_PATH   - Path to local uploaded media (defaults to ./uploads)
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_URL="${DATABASE_URL:-postgresql://dogfood:dogfood@localhost:5432/dogfood}"
STORAGE_PATH="${STORAGE_PATH:-./uploads}"

mkdir -p "${BACKUP_DIR}"

DB_BACKUP_FILE="${BACKUP_DIR}/dogfood_db_${TIMESTAMP}.sql.gz"
MEDIA_BACKUP_FILE="${BACKUP_DIR}/dogfood_media_${TIMESTAMP}.tar.gz"
CHECKSUM_FILE="${BACKUP_DIR}/dogfood_backup_${TIMESTAMP}.sha256"

echo "=========================================================="
echo "📦 Initiating DOGFOOD Production Backup: ${TIMESTAMP}"
echo "=========================================================="

# 1. Dump PostgreSQL database with compression
echo "⏳ Backing up database from ${DATABASE_URL}..."
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip -9 > "${DB_BACKUP_FILE}"
else
  echo "⚠️  pg_dump not found on host, attempting docker compose exec..."
  docker compose exec -T db pg_dump -U dogfood -d dogfood --clean --if-exists --no-owner --no-privileges | gzip -9 > "${DB_BACKUP_FILE}"
fi
echo "✅ Database backup created: ${DB_BACKUP_FILE} ($(du -h "${DB_BACKUP_FILE}" | cut -f1))"

# 2. Archive Uploaded Media
echo "⏳ Archiving uploaded media from ${STORAGE_PATH}..."
if [ -d "${STORAGE_PATH}" ]; then
  tar -czf "${MEDIA_BACKUP_FILE}" -C "${STORAGE_PATH}" .
  echo "✅ Media backup created: ${MEDIA_BACKUP_FILE} ($(du -h "${MEDIA_BACKUP_FILE}" | cut -f1))"
else
  echo "ℹ️  No storage directory at ${STORAGE_PATH}, creating empty marker."
  touch "${MEDIA_BACKUP_FILE}"
fi

# 3. Generate SHA-256 Checksums
echo "⏳ Computing SHA-256 verification checksums..."
cd "${BACKUP_DIR}"
sha256sum "$(basename "${DB_BACKUP_FILE}")" "$(basename "${MEDIA_BACKUP_FILE}")" > "$(basename "${CHECKSUM_FILE}")"
cd - >/dev/null

echo "=========================================================="
echo "🎉 Backup completed successfully!"
echo "DB Dump   : ${DB_BACKUP_FILE}"
echo "Media Tar : ${MEDIA_BACKUP_FILE}"
echo "Checksum  : ${CHECKSUM_FILE}"
echo "=========================================================="
