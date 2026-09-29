# ==============================================================================
# DOGFOOD 2026 Production Database & Media Restore Script (PowerShell / Windows)
#
# Usage:
#   .\scripts\restore.ps1 -DbBackupFile "./backups/dogfood_db_20260928.sql"
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$DbBackupFile,
    [string]$MediaBackupFile = "",
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$StoragePath = $env:STORAGE_PATH
)

if (-not $DatabaseUrl) {
    $DatabaseUrl = "postgresql://dogfood:dogfood@localhost:5432/dogfood"
}
if (-not $StoragePath) {
    $StoragePath = "./uploads"
}

if (-not (Test-Path $DbBackupFile)) {
    Write-Error "Database backup file '$DbBackupFile' not found."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Red
Write-Host "⚠️  RESTORING DOGFOOD DATABASE FROM BACKUP" -ForegroundColor Yellow
Write-Host "Target DB: $DatabaseUrl" -ForegroundColor Gray
Write-Host "Backup   : $DbBackupFile" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Red

# 1. Restore Database
Write-Host "⏳ Applying SQL dump to database..." -ForegroundColor Yellow
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Get-Content $DbBackupFile | & psql "$DatabaseUrl"
} else {
    Write-Host "ℹ️ psql not on PATH, querying docker compose exec..." -ForegroundColor Gray
    Get-Content $DbBackupFile | & docker compose exec -T db psql -U dogfood -d dogfood
}

Write-Host "✅ Database restore finished." -ForegroundColor Green

# 2. Restore Media Assets
if ($MediaBackupFile -and (Test-Path $MediaBackupFile)) {
    Write-Host "⏳ Extracting media backup to $StoragePath..." -ForegroundColor Yellow
    Expand-Archive -Path $MediaBackupFile -DestinationPath $StoragePath -Force
    Write-Host "✅ Media archive restored." -ForegroundColor Green
}

Write-Host "🎉 Restore operation completed." -ForegroundColor Green
