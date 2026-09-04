#!/usr/bin/env powershell
# MinerU Installation Script for Windows
# Installs MinerU Python package and downloads model files

$ErrorActionPreference = "Stop"

Write-Host "=== MinerU Installation Script (Windows) ===" -ForegroundColor Cyan

# Check Python version (requires 3.10-3.13)
Write-Host "`n[1/4] Checking Python version..." -ForegroundColor Yellow
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "ERROR: Python is not installed. Please install Python 3.10-3.13." -ForegroundColor Red
    Write-Host "Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}
$pyVersion = & python --version 2>&1
Write-Host "Found: $pyVersion" -ForegroundColor Green

# Check if Python version is in range 3.10-3.13
$versionMatch = [regex]::Match($pyVersion, 'Python (\d+)\.(\d+)')
if ($versionMatch.Success) {
    $major = [int]$versionMatch.Groups[1].Value
    $minor = [int]$versionMatch.Groups[2].Value
    if ($major -eq 3 -and $minor -ge 10 -and $minor -le 13) {
        Write-Host "Python version OK (3.$minor)" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Python 3.$minor may not be compatible with MinerU (requires 3.10-3.13)" -ForegroundColor Yellow
        Write-Host "If installation fails, install Python 3.11 or 3.12" -ForegroundColor Yellow
    }
}

# Install MinerU
Write-Host "`n[2/4] Installing MinerU package..." -ForegroundColor Yellow
pip install "mineru[pipeline]" 2>&1 | Select-Object -Last 5
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install MinerU" -ForegroundColor Red
    exit 1
}
Write-Host "MinerU installed successfully" -ForegroundColor Green

# Verify installation
Write-Host "`n[3/4] Verifying MinerU installation..." -ForegroundColor Yellow
$mineruExe = Get-Command mineru -ErrorAction SilentlyContinue
if ($mineruExe) {
    $version = & mineru --version 2>&1
    Write-Host "MinerU version: $version" -ForegroundColor Green
} else {
    Write-Host "WARNING: 'mineru' command not found in PATH" -ForegroundColor Yellow
    Write-Host "Try: python -m mineru --version" -ForegroundColor Yellow
}

# Download models
Write-Host "`n[4/4] Downloading model files (2-4GB, may take 10-30 minutes)..." -ForegroundColor Yellow
Write-Host "You can also run this manually: mineru-models-download" -ForegroundColor Yellow
try {
    "auto`n" | mineru-models-download 2>&1 | Select-Object -Last 10
    Write-Host "Models downloaded successfully" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Model download failed. Run 'mineru-models-download' manually." -ForegroundColor Yellow
}

Write-Host "`n=== Installation Complete ===" -ForegroundColor Cyan
Write-Host "To start MinerU API service:" -ForegroundColor Green
Write-Host "  mineru-api --host 127.0.0.1 --port 8080" -ForegroundColor White
Write-Host "`nOr use PM2:" -ForegroundColor Green
Write-Host "  pm2 start mineru-api --name mineru-api -- --host 127.0.0.1 --port 8080" -ForegroundColor White
