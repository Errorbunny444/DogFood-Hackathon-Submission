# ==============================================================================
# DOGFOOD 2026 Production Database & Media Backup Script (PowerShell / Windows)
#
# Usage:
#   .\scripts\backup.ps1 -BackupDir "./backups"
# ==============================================================================

param (
    [string]$BackupDir = "./backups",
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$StoragePath = $env:STORAGE_PATH
)

if (-not $DatabaseUrl) {
    $DatabaseUrl = "postgresql://dogfood:dogfood@localhost:5432/dogfood"
}
if (-not $StoragePath) {
    $StoragePath = "./uploads"
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDirFullPath = [System.IO.Path]::GetFullPath($BackupDir)

if (-not (Test-Path $BackupDirFullPath)) {
    New-Item -ItemType Directory -Path $BackupDirFullPath -Force | Out-Null
}

$DbBackupFile = Join-Path $BackupDirFullPath "dogfood_db_$Timestamp.sql"
$MediaBackupFile = Join-Path $BackupDirFullPath "dogfood_media_$Timestamp.zip"
$ChecksumFile = Join-Path $BackupDirFullPath "dogfood_backup_$Timestamp.sha256"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "📦 Initiating DOGFOOD Production Backup: $Timestamp" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Database Backup
Write-Host "⏳ Backing up database to $DbBackupFile..." -ForegroundColor Yellow
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    & pg_dump "$DatabaseUrl" --clean --if-exists --no-owner --no-privileges -f "$DbBackupFile"
} else {
    Write-Host "ℹ️ pg_dump not on PATH, querying docker compose exec..." -ForegroundColor Gray
    & docker compose exec -T db pg_dump -U dogfood -d dogfood --clean --if-exists --no-owner --no-privileges > "$DbBackupFile"
}

if (Test-Path $DbBackupFile) {
    Write-Host "✅ Database backup created: $DbBackupFile" -ForegroundColor Green
} else {
    Write-Host "⚠️ Warning: Database dump file was not generated." -ForegroundColor Yellow
}

# 2. Uploaded Media Backup
if (Test-Path $StoragePath) {
    Write-Host "⏳ Compressing media assets from $StoragePath..." -ForegroundColor Yellow
    Compress-Archive -Path "$StoragePath\*" -DestinationPath "$MediaBackupFile" -Force
    Write-Host "✅ Media archive created: $MediaBackupFile" -ForegroundColor Green
}

# 3. Checksums
Write-Host "⏳ Computing SHA-256 verification hashes..." -ForegroundColor Yellow
$Hashes = @()
if (Test-Path $DbBackupFile) {
    $Hashes += (Get-FileHash -Path $DbBackupFile -Algorithm SHA256)
}
if (Test-Path $MediaBackupFile) {
    $Hashes += (Get-FileHash -Path $MediaBackupFile -Algorithm SHA256)
}

$Hashes | ForEach-Object { "$($_.Hash)  $([System.IO.Path]::GetFileName($_.Path))" } | Set-Content -Path $ChecksumFile

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🎉 Backup completed successfully!" -ForegroundColor Green
Write-Host "DB Dump   : $DbBackupFile"
Write-Host "Media Zip : $MediaBackupFile"
Write-Host "Checksum  : $ChecksumFile"
Write-Host "==========================================================" -ForegroundColor Cyan
