#!/usr/bin/env bash
# ==============================================================================
# DOGFOOD 2026 Production Database & Media Restore Script (POSIX)
#
# Usage:
#   ./scripts/restore.sh <DB_BACKUP_FILE> [MEDIA_BACKUP_FILE]
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-db-backup.sql.gz> [path-to-media-backup.tar.gz]"
  exit 1
fi

DB_BACKUP_FILE="$1"
MEDIA_BACKUP_FILE="${2:-}"
DATABASE_URL="${DATABASE_URL:-postgresql://dogfood:dogfood@localhost:5432/dogfood}"
STORAGE_PATH="${STORAGE_PATH:-./uploads}"

if [ ! -f "${DB_BACKUP_FILE}" ]; then
  echo "❌ Error: Database backup file '${DB_BACKUP_FILE}' does not exist."
  exit 1
fi

echo "=========================================================="
echo "⚠️  RESTORING DOGFOOD DATABASE FROM BACKUP"
echo "Target DB: ${DATABASE_URL}"
echo "Backup   : ${DB_BACKUP_FILE}"
echo "=========================================================="

echo "⏳ Restoring PostgreSQL database..."
if [[ "${DB_BACKUP_FILE}" == *.gz ]]; then
  gunzip -c "${DB_BACKUP_FILE}" | psql "${DATABASE_URL}"
else
  psql "${DATABASE_URL}" < "${DB_BACKUP_FILE}"
fi
echo "✅ Database restore completed."

if [ -n "${MEDIA_BACKUP_FILE}" ] && [ -f "${MEDIA_BACKUP_FILE}" ]; then
  echo "⏳ Restoring media assets to ${STORAGE_PATH}..."
  mkdir -p "${STORAGE_PATH}"
  tar -xzf "${MEDIA_BACKUP_FILE}" -C "${STORAGE_PATH}"
  echo "✅ Media assets restored."
fi

echo "🎉 Restore operation finished successfully."
